import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'

import { BIKES } from '@shared/balance'
import { at, getTrack, worldPoint } from '@shared/track'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { SEAT } from '../playerPose'
import { bikeGeometry } from '../ride/bikeModels'
import { hideNameplatesFrom, NAMEPLATE_POOL_SIZE, placeNameplate } from './nameplates'

/** Remote players are drawn this far in the past, so 10 Hz updates interpolate. */
const INTERP_DELAY_MS = 110
const MAX_REMOTES = 8
const PARTS = 6
const S = 0.36

/** Classic blocky figure, in studs-scaled units: [x, y(pivot), size, hangs from pivot]. */
const PART_LAYOUT = [
  { key: 'head', pos: [0, 1.62, 0], size: [1.2 * S, 1 * S, 1 * S] },
  { key: 'torso', pos: [0, 1.08, 0], size: [2 * S, 2 * S, 1 * S] },
  { key: 'armL', pos: [-1.5 * S, 1.44, 0], size: [1 * S, 2 * S, 1 * S], swing: -1 },
  { key: 'armR', pos: [1.5 * S, 1.44, 0], size: [1 * S, 2 * S, 1 * S], swing: 1 },
  { key: 'legL', pos: [-0.5 * S, 0.72, 0], size: [1 * S, 2 * S, 1 * S], swing: 1 },
  { key: 'legR', pos: [0.5 * S, 0.72, 0], size: [1 * S, 2 * S, 1 * S], swing: -1 },
]

// Parsed once: setColorAt runs for every limb of every player, every frame.
const palette = (list) => list.map((c) => new Color(c))
const SHIRTS = palette(['#e8423a', '#2f7fe6', '#3ccf4e', '#9b4dff', '#ff9a1f', '#1d1f26', '#ffffff', '#ff5fa8'])
const PANTS = palette(['#2d3a5c', '#1d1f26', '#4a3a2a', '#3a3a46', '#2f5aa8'])
const SKINS = palette(['#f5cd47', '#e8b48a', '#c98a5a', '#8a5a3a', '#ffd9b3'])
const WHITE = new Color('#ffffff')

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const _m = new Matrix4()
const _base = new Matrix4()
const _local = new Matrix4()
const _rot = new Matrix4()
const _scale = new Matrix4()
const _seatShift = new Matrix4()
const _q = new Quaternion()
const _s = new Vector3()
const _v = new Vector3()
const _up = new Vector3(0, 1, 0)
const _prev = new Vector3()
const _p = { x: 0, y: 0, z: 0 }

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Interpolates a remote player's lobby position to `renderTime`. */
function interpolate(r, renderTime) {
  const snaps = r.snaps
  if (snaps.length === 0) return
  let i = snaps.length - 1
  while (i > 0 && snaps[i - 1].t > renderTime) i -= 1
  const b = snaps[i]
  const a = snaps[Math.max(0, i - 1)]
  const span = b.t - a.t
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.t) / span)) : 1
  _prev.copy(r.position)
  r.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
  r.yaw = lerpAngle(a.r, b.r, t)
  while (snaps.length > 2 && snaps[1].t < renderTime) snaps.shift()
}

/** Interpolates a rider's road point to `renderTime`, and places their bike in the world. */
function interpolateRide(r, renderTime, delta) {
  const snaps = r.rideSnaps
  if (snaps.length === 0) return
  let i = snaps.length - 1
  while (i > 0 && snaps[i - 1].t > renderTime) i -= 1
  const b = snaps[i]
  const a = snaps[Math.max(0, i - 1)]
  const span = b.t - a.t
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.t) / span)) : 1
  const ride = r.ride
  const before = ride.m
  ride.m = a.m + (b.m - a.m) * t
  ride.x = a.x + (b.x - a.x) * t
  ride.h = a.h + (b.h - a.h) * t
  ride.yaw = a.r + (b.r - a.r) * t
  ride.state = b.s
  ride.speed = ride.speed * 0.85 + (Math.abs(ride.m - before) / Math.max(delta, 1e-3)) * 0.15
  while (snaps.length > 2 && snaps[1].t < renderTime) snaps.shift()
  const track = getTrack(r.world)
  worldPoint(track, ride.m, ride.x, ride.h, _p)
  r.bikePosition.set(_p.x, _p.y, _p.z)
  r.bikeHeading = at(track.head, ride.m) + ride.yaw
}

/**
 * Writes one blocky figure's six parts from `base` (its feet), limbs swung by `swing`
 * (and arms by `armSwing`, if given). Returns the next free instance.
 */
function writeFigure(body, instance, r, base, swing, armSwing, legSwing = null) {
  const h = hashString(r.sessionId)
  const shirt = SHIRTS[h % SHIRTS.length]
  const pants = PANTS[(h >>> 8) % PANTS.length]
  const skin = SKINS[(h >>> 16) % SKINS.length]
  for (const part of PART_LAYOUT) {
    const hangs = part.swing !== undefined
    const isArm = part.key.startsWith('arm')
    const isLeg = part.key.startsWith('leg')
    let angle = hangs ? swing * part.swing : 0
    if (isArm && armSwing !== null) angle = armSwing
    if (isLeg && legSwing !== null) angle = legSwing
    _local.makeTranslation(part.pos[0], part.pos[1], part.pos[2])
    _rot.makeRotationX(angle)
    _scale.makeScale(part.size[0], part.size[1], part.size[2])
    if (hangs) _scale.setPosition(0, -part.size[1] / 2, 0)
    _m.copy(base).multiply(_local).multiply(_rot).multiply(_scale)
    body.setMatrixAt(instance, _m)
    body.setColorAt(instance, part.key === 'torso' ? shirt : isLeg ? pants : skin)
    instance += 1
  }
  return instance
}

/** Puts a name tag over `at`, if it's on screen; returns the next free tag. */
function writeNameplate(plate, name, at, distance, maxDistance, camera, size, uid) {
  if (plate >= NAMEPLATE_POOL_SIZE) return plate
  if (distance < maxDistance) {
    _v.copy(at).project(camera)
    if (_v.z < 1) {
      const fade = Math.min(1, (maxDistance - distance) / 6)
      placeNameplate(plate, name, (_v.x * 0.5 + 0.5) * size.width, (-_v.y * 0.5 + 0.5) * size.height, fade, uid)
      return plate + 1
    }
  }
  placeNameplate(plate, '', null)
  return plate + 1
}

/**
 * Everyone else: blocky avatars (one InstancedMesh for every limb of every player) for
 * those not drawn as their real avatar (RemoteAvatars), name tags, and - for anyone out on
 * the road - their bike, ridden down the same road you ride (one instanced draw call per
 * bike model in use). Also works out, once a frame for everyone, where each rider's bike is
 * (`r.bikePosition`, `r.bikeHeading`), which RemoteAvatars seats their avatar on. Hidden
 * past the preset's draw distance.
 */
export function RemotePlayers() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const bodyRef = useRef(null)

  const assets = useMemo(() => {
    const body = createBoxInstances(MAX_REMOTES * PARTS, sharedMaterials().toy, STYLE.SMOOTH)
    body.castShadow = true
    /**
     * One instanced mesh per bike model someone is riding. The frame loop only notes a
     * model it hasn't got (`wanted`); a timer outside it makes the mesh, so nothing is
     * created mid-frame and nothing is built at start-up for bikes nobody rides.
     */
    const bikes = new Map()
    const wanted = new Set()
    return { body, bikes, wanted }
  }, [])

  const bikeGroupRef = useRef(null)
  useEffect(() => {
    // Makes the bike meshes the frame loop asked for.
    const id = setInterval(() => {
      for (const bikeId of assets.wanted) {
        const bike = BIKES.find((b) => b.id === bikeId) || BIKES[0]
        const mesh = new InstancedMesh(bikeGeometry(bike), sharedMaterials().toy, MAX_REMOTES)
        for (let i = 0; i < MAX_REMOTES; i += 1) mesh.setColorAt(i, WHITE)
        mesh.count = 0
        mesh.frustumCulled = false
        assets.bikes.set(bikeId, mesh)
        bikeGroupRef.current?.add(mesh)
      }
      assets.wanted.clear()
    }, 250)
    return () => {
      clearInterval(id)
      disposeBlocks(assets.body)
      for (const mesh of assets.bikes.values()) mesh.dispose()
      assets.bikes.clear()
      hideNameplatesFrom(0)
    }
  }, [assets])

  useFrame((state, rawDelta) => {
    const body = bodyRef.current
    if (!body) return
    const delta = Math.min(rawDelta, 0.05)
    const settings = getQuality()
    const now = performance.now()
    const renderTime = now - INTERP_DELAY_MS

    let instance = 0
    let plate = 0
    for (const mesh of assets.bikes.values()) mesh.count = 0

    for (const r of remotePlayers.values()) {
      interpolate(r, renderTime)
      const moved = _prev.distanceTo(r.position)
      r.speed = r.speed * 0.8 + (moved / Math.max(delta, 1e-3)) * 0.2
      if (r.riding) interpolateRide(r, renderTime, delta)

      const shownAt = r.riding ? r.bikePosition : r.position
      r.shadow.position.copy(shownAt)
      const distance = camera.position.distanceTo(shownAt)
      const visible = distance < settings.remoteDrawDistance
      r.shadow.visible = visible

      if (visible && r.riding) {
        // Their bike (not while they're tumbling off it: it lies where it fell).
        const mesh = assets.bikes.get(r.bikeId)
        if (!mesh) assets.wanted.add(r.bikeId)
        _q.setFromAxisAngle(_up, Math.PI - r.bikeHeading)
        _base.compose(r.bikePosition, _q, _s.set(1, 1, 1))
        if (mesh && mesh.count < MAX_REMOTES) {
          mesh.setMatrixAt(mesh.count, _base)
          mesh.count += 1
          mesh.instanceMatrix.needsUpdate = true
        }
        if (!r.fullAvatar && instance + PARTS <= MAX_REMOTES * PARTS) {
          // Seated, leaning to the bars, legs to the pedals.
          _seatShift.makeTranslation(0, SEAT.y, SEAT.z)
          _base.multiply(_seatShift)
          const pedal = Math.sin(now / 120) * 0.25
          instance = writeFigure(body, instance, r, _base, 0, -1.25, r.ride.state === 'bail' ? 0.6 : -1.1 + pedal)
        }
      } else if (visible && !r.fullAvatar && instance + PARTS <= MAX_REMOTES * PARTS) {
        const walking = r.speed > 0.6
        if (walking) r.walkPhase += delta * (6 + Math.min(r.speed, 10) * 0.5)
        const swing = walking ? Math.sin(r.walkPhase) * 0.9 : 0
        _q.setFromAxisAngle(_up, r.yaw)
        _base.compose(r.position, _q, _s.set(1, 1, 1))
        instance = writeFigure(body, instance, r, _base, swing, walking ? -swing * 0.7 : 0.05)
      }

      if (visible) {
        _v.set(shownAt.x, shownAt.y + (r.riding ? 2.4 : 2.05), shownAt.z)
        plate = writeNameplate(plate, r.name, _v, distance, settings.remoteNameDistance, camera, size, r.uid)
      }
    }
    hideNameplatesFrom(plate)
    body.count = instance
    body.instanceMatrix.needsUpdate = true
    if (body.instanceColor) body.instanceColor.needsUpdate = true
  })

  return (
    <>
      <primitive ref={bodyRef} object={assets.body} />
      <group ref={bikeGroupRef} />
    </>
  )
}

export default RemotePlayers
