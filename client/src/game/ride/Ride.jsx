import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Euler, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'

import { BIKES, WORLDS } from '@shared/balance'
import { at, getTrack, OBSTACLES, roadY, WALL_X, worldPoint } from '@shared/track'
import { mulberry32 } from '@shared/rng'

import { sfx } from '../../audio/sfx'
import { useGame } from '../../store/game'
import { getQuality, useQuality } from '../../store/quality'
import { asToyInstance } from '../blocks'
import { burst } from '../fx/fxQueue'
import { spawnScattered } from '../fx/popups'
import { sharedMaterials } from '../materials'
import { runtime } from '../runtime'
import { bikeParts } from './bikeModels'
import { BODY, SEAT } from '../playerPose'
import { ride, toggleRideCamera } from './rideControl'
import { autopilot, bikeHeading, input, stepRide } from './ridePhysics'
import {
  bankHeightAt,
  buildArch,
  buildBoulder,
  buildCoin,
  buildObstacle,
  buildPad,
  buildRamp,
  buildRoadChunk,
  buildTree,
  CHUNK_LENGTH,
  chunkCount,
  RIDE_THEMES,
} from './trackMesh'
import { WindowedInstances } from './windowed'

/**
 * The ride, drawn and run: the mountain road for the world you're in (built in chunks
 * as you approach them, shown only within view distance), its obstacles, ramps, boost
 * pads, coins, trees and arches (each one instanced draw call, windowed around you), your
 * bike, and the chase camera. Its frame callback runs before everything else: physics,
 * then your bike, then the camera, so the player, name tags and popups all see the
 * finished frame.
 *
 * Mounted (lazily, its own chunk) once the lobby is up; in the lobby it shows just the
 * top of the road beyond the START gate.
 */

/** Frame-loop priority: before every other system (negative, so R3F still renders). */
const BEFORE_EVERYTHING = -1
/** Shown behind the rider, and in front up to the view distance. */
const BEHIND = 40
/** In the lobby, the road is drawn this far down from the gate. */
const LOBBY_VIEW = 170

const _m4 = new Matrix4()
const _q = new Quaternion()
const _q2 = new Quaternion()
const _e = new Euler(0, 0, 0, 'YXZ')
const _v = new Vector3()
const _s = new Vector3()
const _p = { x: 0, y: 0, z: 0 }
const _desired = new Vector3()
const _look = new Vector3()
const _fwd = new Vector3()
const _up = new Vector3(0, 1, 0)
const _axisX = new Vector3(1, 0, 0)

/** A matrix placing a prop at road point (m, x, h), turned with the road (+ `yaw`), scaled. */
function roadMatrix(track, m, x, h, yaw, sx, sy, sz, out) {
  worldPoint(track, m, x, h, _p)
  const head = at(track.head, m)
  _q.setFromAxisAngle(_up, Math.PI - head + yaw)
  return out.compose(_v.set(_p.x, _p.y, _p.z), _q, _s.set(sx, sy, sz))
}

/** Everything static along world `world`'s road, built once per world. */
function buildWorldProps(world) {
  const track = getTrack(world)
  const theme = RIDE_THEMES[WORLDS[world].theme] || RIDE_THEMES.pine
  const material = sharedMaterials().toy
  const { decorDensity } = getQuality()
  const rand = mulberry32(WORLDS[world].seed * 7 + 3)
  const sets = []

  // Obstacles, one instanced set per kind.
  const byKind = new Map()
  track.obstacles.forEach((o, index) => {
    if (!byKind.has(o.kind)) byKind.set(o.kind, [])
    byKind.get(o.kind).push({ o, index })
  })
  const obstacleSets = []
  for (const [kind, list] of byKind) {
    const carColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#f8fafc']
    const items = list.map(({ o }, i) => ({
      m: o.m,
      matrix: roadMatrix(track, o.m, o.x, 0, kind === 'car' ? 0 : (i * 1.7) % 0.6 - 0.3, 1, 1, 1, new Matrix4()),
      color: kind === 'car' ? carColors[i % carColors.length] : '#ffffff',
    }))
    const set = new WindowedInstances(buildObstacle(kind, theme), material, items, 48)
    const indices = list.map((e) => e.index)
    set.hidden = (i) => ride.phase !== 'idle' && ride.smashedSet[indices[i]] === 1
    obstacleSets.push(set)
    sets.push(set)
  }

  // Ramps and boost pads.
  const ramps = new WindowedInstances(
    buildRamp(),
    material,
    track.ramps.map((r) => ({ m: r.m, matrix: roadMatrix(track, r.m, r.x, 0, 0, r.hw * 2, r.h, r.len, new Matrix4()) })),
    16,
  )
  sets.push(ramps)
  const pads = new WindowedInstances(
    buildPad(),
    material,
    track.pads.map((p) => ({ m: p.m, matrix: roadMatrix(track, p.m, p.x, 0, 0, p.hw * 2, 1, p.hl * 2, new Matrix4()) })),
    16,
  )
  sets.push(pads)

  // Arches: over each hill's crest (the zone's start line) and the finish.
  const arches = new WindowedInstances(
    buildArch(theme, false),
    material,
    track.hills.map((h) => ({ m: h.crest + 6, matrix: roadMatrix(track, h.crest + 6, 0, 0, 0, 1, 1, 1, new Matrix4()) })),
    6,
  )
  sets.push(arches)
  const finish = new WindowedInstances(buildArch(theme, true), material, [{ m: track.length, matrix: roadMatrix(track, track.length, 0, 0, 0, 1, 1, 1, new Matrix4()) }], 1)
  sets.push(finish)

  // Trees and boulders on the banks.
  const trees = []
  const rocks = []
  const step = 7 / Math.max(0.3, decorDensity)
  for (let m = 6; m < track.length + 30; m += step * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue
      const x = side * (WALL_X + 4 + rand() * 44)
      const h = bankHeightAt(m, x, WORLDS[world].seed) - 0.2
      const s = 0.75 + rand() * 0.7
      if (rand() < 0.86) {
        const tint = 0.85 + rand() * 0.15
        trees.push({ m, matrix: roadMatrix(track, m, x, h, rand() * 6, s, s * (0.9 + rand() * 0.3), s, new Matrix4()), color: `rgb(${Math.round(255 * tint)},${Math.round(255 * tint)},${Math.round(255 * tint)})` })
      } else {
        rocks.push({ m, matrix: roadMatrix(track, m, x, h, rand() * 6, s, s * 0.8, s, new Matrix4()) })
      }
    }
  }
  const treeSet = new WindowedInstances(buildTree(theme), material, trees, 420)
  const rockSet = new WindowedInstances(buildBoulder(theme), material, rocks, 80)
  sets.push(treeSet, rockSet)

  // Coins: spun every frame, so their matrices are written per frame (see Ride).
  const coinGeo = buildCoin()
  const coins = new InstancedMesh(coinGeo, material, 160)
  for (let i = 0; i < 160; i += 1) coins.setColorAt(i, _white)
  coins.count = 0
  coins.frustumCulled = false
  const coinPos = new Float32Array(track.coinCount * 3)
  for (let i = 0; i < track.coinCount; i += 1) {
    const m = track.coins[i * 3]
    worldPoint(track, m, track.coins[i * 3 + 1], track.coins[i * 3 + 2], _p)
    coinPos[i * 3] = _p.x
    coinPos[i * 3 + 1] = _p.y
    coinPos[i * 3 + 2] = _p.z
  }

  return { track, theme, sets, obstacleSets, coins, coinPos, coinGeo }
}
const _white = new Color(1, 1, 1)
/** Stock stats for frames with no ride under way (nothing rides then). */
const STOCK = { top: BIKES[0].top, handling: BIKES[0].handling, landing: BIKES[0].landing, accel: 1, grip: 0, smashKeep: 0.84 }

export default function Ride() {
  const profileWorld = useGame((s) => s.profile.world || 0)
  const rideWorld = useGame((s) => (s.ride ? s.ride.world : null))
  const world = rideWorld ?? profileWorld
  // A level picked in Settings rebuilds the scene anyway; density is read at build time.
  const rebuild = useQuality((s) => s.rebuild)
  return <RideWorld key={`${world}:${rebuild}`} world={world} />
}

function RideWorld({ world }) {
  const camera = useThree((s) => s.camera)
  const bikeId = useGame((s) => s.profile.bike)
  const props = useMemo(() => buildWorldProps(world), [world])
  const chunkGroup = useMemo(() => new Group(), [])
  const chunks = useRef([])
  const bikeGroup = useRef(null)
  const wheels = useRef({ front: null, rear: null, angle: 0, pedal: 0 })
  const cam = useRef({ heading: 0, init: false, baseFov: 60, shake: 0, lastLand: 0, lastCrash: 0 })
  const seen = useRef({ coin: 0, smash: 0, pad: 0, flip: 0, milestone: 0, zone: 0, land: 0 })
  const shadows = useQuality((s) => s.settings.shadows === 'realtime')

  // The player's bike: frame and two spinning wheels, each a one-instance toy mesh.
  const bike = useMemo(() => {
    const parts = bikeParts(bikeId)
    const material = sharedMaterials().toy
    const group = new Group()
    const frame = asToyInstance(parts.frame, material)
    const front = asToyInstance(parts.wheel, material)
    const rear = asToyInstance(parts.wheel, material)
    front.position.fromArray(parts.front)
    rear.position.fromArray(parts.rear)
    for (const mesh of [frame, front, rear]) {
      mesh.frustumCulled = false
      group.add(mesh)
    }
    group.visible = false
    return { group, frame, front, rear, radius: parts.radius, bike: parts.bike }
  }, [bikeId])
  useEffect(() => {
    wheels.current.front = bike.front
    wheels.current.rear = bike.rear
    // The meshes are one-instance wrappers around the cached bike geometry: only they go.
    return () => {
      bike.frame.dispose()
      bike.front.dispose()
      bike.rear.dispose()
    }
  }, [bike])

  // Ride keys: steer, brake, boost, hop, lean, camera.
  useEffect(() => {
    const keys = { left: false, right: false, up: false, down: false, boost: false, jump: false }
    const map = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'jump' }
    const apply = () => {
      const t = runtime.input
      input.steer = Math.max(-1, Math.min(1, (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + t.steer))
      input.brake = keys.down || t.brake
      input.boost = keys.boost || t.boost
      input.jump = keys.jump || t.jump
      input.leanFwd = keys.up || t.leanFwd
      input.leanBack = keys.down || t.brake
      // ?debug autopilot (the automated perf run): down the middle, boosting up hills.
      if (window.__pp?.autopilot) autopilot(input)
    }
    const down = (e) => {
      if (ride.phase === 'idle') return
      if (e.code === 'KeyC' && !e.repeat) toggleRideCamera()
      const k = map[e.code]
      if (!k) return
      e.preventDefault()
      keys[k] = true
    }
    const up = (e) => {
      const k = map[e.code]
      if (k) keys[k] = false
    }
    const blur = () => {
      for (const k of Object.keys(keys)) keys[k] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    input.apply = apply
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      input.apply = null
    }
  }, [])

  // Dispose everything this world built when it goes (a world change, a quality rebuild).
  useEffect(
    () => () => {
      for (const set of props.sets) set.dispose()
      props.coins.dispose()
      props.coinGeo.dispose()
      for (const mesh of chunks.current) {
        if (!mesh) continue
        mesh.geometry.dispose()
        mesh.dispose()
        chunkGroup.remove(mesh)
      }
      chunks.current = []
    },
    [props, chunkGroup],
  )

  useFrame(
    (state, rawDelta) =>
      rideFrame(state, rawDelta, { props, chunkList: chunks.current, chunkGroup, bike, wheels: wheels.current, cam: cam.current, seen: seen.current, camera, shadows, world }),
    BEFORE_EVERYTHING,
  )

  // Hand the camera back to the lobby view when the ride ends.
  const rideState = useGame((s) => s.ride)
  useEffect(() => {
    const c = cam.current
    if (rideState) {
      if (!c.active) {
        c.active = true
        c.init = false
        c.baseFov = camera.fov
        Object.assign(seen.current, { coin: 0, smash: 0, pad: 0, flip: 0, milestone: 0, zone: 0, land: 0 })
      }
      return
    }
    if (c.active) {
      c.active = false
      restoreLens(camera, c.baseFov)
    }
  }, [rideState, camera])

  return (
    <>
      <primitive object={chunkGroup} />
      {props.sets.map((set, i) => (
        <primitive key={i} object={set.mesh} castShadow={shadows} receiveShadow={false} />
      ))}
      <primitive object={props.coins} />
      <primitive ref={bikeGroup} object={bike.group} />
    </>
  )
}

/**
 * One frame of the ride (called from RideWorld's frame callback, before everything else):
 * physics, the road and props in view, your bike and you, the moments, the camera. A plain
 * function, so the per-frame mutation of the scene objects it's handed stays out of render.
 */
function rideFrame(state, rawDelta, ctx) {
  const { props, chunkList, chunkGroup, bike, wheels, cam, seen, camera, shadows, world } = ctx
  const now = performance.now()
  const dt = Math.min(rawDelta, 0.05)
  const { track, theme } = props
  const riding = ride.phase !== 'idle' && ride.track === track
  const bikeInfo = (riding && ride.stats) || STOCK

  // --- Physics -----------------------------------------------------------------------
  if (riding) {
    input.apply?.()
    stepRide(dt, now, bikeInfo)
  }

  // --- What's in view ------------------------------------------------------------------
  const view = getQuality().viewDistance
  const center = riding ? ride.m : 0
  const from = riding ? Math.max(0, center - BEHIND) : 0
  const to = riding ? center + view : LOBBY_VIEW
  updateChunks(track, theme, world, chunkList, chunkGroup, from, to, riding && ride.phase === 'countdown', shadows)
  for (const set of props.sets) set.update(from - 20, to + 20)
  if (riding && ride.smashed !== seen.smash) for (const set of props.obstacleSets) set.dirty = true
  updateCoins(props, from, to, state.clock.elapsedTime, riding, camera)

  // --- Your bike and you --------------------------------------------------------------
  const rv = runtime.rideView
  const group = bike.group
  if (!riding) {
    group.visible = false
    rv.active = false
    return
  }
  group.visible = true
  rv.active = true
  const heading = bikeHeading()
  const bail = ride.phase === 'bail'
  const b = ride.bail
  if (bail) {
    group.position.set(b.bikePos.x, b.bikePos.y, b.bikePos.z)
    _e.set(-b.bikeRot.x, Math.PI - heading, b.bikeRot.z)
    group.quaternion.setFromEuler(_e)
    rv.bail = true
    rv.riderPos.set(b.pos.x, b.pos.y + 0.6, b.pos.z)
    _e.set(-b.rot.x, Math.PI - heading + b.rot.y, b.rot.z)
    rv.riderQuat.setFromEuler(_e)
  } else {
    worldPoint(track, ride.m, ride.x, ride.y - roadY(track, ride.m), _p)
    group.position.set(_p.x, _p.y, _p.z)
    _e.set(-ride.pitch, Math.PI - heading, ride.lean)
    group.quaternion.setFromEuler(_e)
    rv.bail = false
  }
  rv.position.copy(group.position)
  rv.quaternion.copy(group.quaternion)
  rv.groundY = roadY(track, ride.m)
  // Wheels roll with the ground speed; the pedals turn with them (not in the air).
  const w = wheels
  const rolling = ride.phase === 'riding' || ride.phase === 'finish' || ride.phase === 'stall'
  const sp = rolling ? (ride.grounded ? ride.v : ride.vh) : 0
  w.angle += (sp * dt) / bike.radius
  if (rolling && ride.grounded && !ride.braking && ride.v < bikeInfo.top * 1.05) w.pedal += (sp * dt) / (bike.radius * 2.6)
  if (w.front) w.front.quaternion.setFromAxisAngle(_axisX, w.angle)
  if (w.rear) w.rear.quaternion.setFromAxisAngle(_axisX, w.angle)
  rv.pedal = w.pedal
  rv.tuck += ((ride.boosting ? 1 : ride.grounded ? Math.min(0.5, ride.v / 60) : 0.6) - rv.tuck) * Math.min(1, 6 * dt)
  rv.stand = Math.max(0, 1 - (now - ride.landedAt) / 300)
  rv.cheer += ((ride.phase === 'finish' || (ride.phase === 'over' && ride.reason === 'finish') ? 1 : 0) - rv.cheer) * Math.min(1, 5 * dt)
  runtime.flightFocus = rv.position

  // --- Moments: popups, sparkles, shakes -------------------------------------------------
  moments(now, seen, cam, rv)

  // --- The chase camera -------------------------------------------------------------------
  if (runtime.camera.mode === 'ride') driveCamera(camera, cam, heading, dt, now, bikeInfo)
}

/** The ride's over: the lens back to the lobby's, the sun back on you. */
function restoreLens(camera, fov) {
  camera.fov = fov
  camera.near = NEAR_CHASE
  runtime.rideView.firstPerson = false
  camera.updateProjectionMatrix()
  runtime.flightFocus = null
  runtime.rideView.active = false
}

/**
 * Shows the road's chunks between metres `from` and `to`, building any not yet made -
 * all of them at once during the countdown (behind the white flash), else one a frame.
 */
function updateChunks(track, theme, world, list, group, from, to, eager, shadows) {
  const total = chunkCount(track)
  const first = Math.max(0, Math.floor(from / CHUNK_LENGTH))
  const last = Math.min(total - 1, Math.floor(to / CHUNK_LENGTH))
  let built = 0
  for (let i = first; i <= last; i += 1) {
    if (!list[i] && (eager || built === 0 || i === first)) {
      const mesh = asToyInstance(buildRoadChunk(track, i, theme, WORLDS[world].seed), sharedMaterials().toy)
      mesh.receiveShadow = shadows
      list[i] = mesh
      group.add(mesh)
      built += 1
    }
  }
  for (let i = 0; i < list.length; i += 1) {
    const mesh = list[i]
    if (mesh) mesh.visible = i >= first && i <= last
  }
}

/** Spins the coins in view (taken ones gone) into the instance buffer. */
function updateCoins({ track, coins, coinPos }, from, to, time, riding, camera) {
  const data = track.coins
  let lo = 0
  let hi = track.coinCount
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (data[mid * 3] < from) lo = mid + 1
    else hi = mid
  }
  let k = 0
  for (let i = lo; i < track.coinCount && data[i * 3] < to && k < 160; i += 1) {
    if (riding && ride.taken[i]) continue
    _q2.setFromAxisAngle(_up, time * 3 + i * 0.7)
    _v.set(coinPos[i * 3], coinPos[i * 3 + 1] + Math.sin(time * 4 + i) * 0.12, coinPos[i * 3 + 2])
    // A coin right in front of the camera would fill the screen (first person above all):
    // it shrinks away over the last few metres, and is gone before it touches the lens.
    const near = Math.min(1, Math.max(0, (_v.distanceTo(camera.position) - 1.6) / 6))
    if (near <= 0) continue
    _m4.compose(_v, _q2, _s.set(near, near, near))
    _m4.toArray(coins.instanceMatrix.array, k * 16)
    k += 1
  }
  coins.count = k
  coins.instanceMatrix.needsUpdate = true
}

/** Turns the ride's moments (coins, smashes, pads, flips, milestones, zones) into effects. */
function moments(now, seen, cam, rv) {
  const p = rv.position
  const particles = getQuality().particles
  // (Coins just vanish with a ching: a sparkle there flew straight into the camera.)
  seen.coin = ride.coinList.length
  if (ride.smashed !== seen.smash) {
    seen.smash = ride.smashed
    if (particles) burst({ x: p.x, y: p.y + 0.8, z: p.z, count: 10, palette: 'wood', speed: 4 })
    spawnScattered('SMASH!', { scale: 0.9 })
  }
  if (ride.pads !== seen.pad) {
    seen.pad = ride.pads
    spawnScattered('BOOST!', { scale: 1 })
  }
  if (ride.flips !== seen.flip) {
    const n = ride.flips - seen.flip
    seen.flip = ride.flips
    spawnScattered(n > 1 ? `${n}x FLIP!` : 'FLIP!', { scale: 1.3 })
    if (particles) burst({ x: p.x, y: p.y + 1.5, z: p.z, count: 30, palette: 'confetti', speed: 8 })
  }
  if (ride.milestoneAt !== seen.milestone) {
    seen.milestone = ride.milestoneAt
    if (ride.milestone > 0) spawnScattered(`${ride.milestone} m!`, { scale: 1.2 })
  }
  if (ride.landedAt !== seen.land) {
    seen.land = ride.landedAt
    cam.shake = Math.max(cam.shake, 0.25)
  }
  if (ride.crashedAt && ride.crashedAt !== cam.lastCrash) {
    cam.lastCrash = ride.crashedAt
    cam.shake = ride.phase === 'bail' ? 0.9 : 0.3
    if (ride.phase === 'bail' && particles) burst({ x: p.x, y: p.y + 1, z: p.z, count: 26, palette: 'confetti', speed: 7 })
    if (ride.phase === 'stall') sfx.error?.()
  }
}

/** Camera presets: distance behind, height, how far ahead it looks. */
const CAMS = [
  [6.4, 2.6, 7],
  [10.5, 4.4, 9],
]
/** First person: the near plane comes in so the bars right under you aren't clipped. */
const NEAR_CHASE = 0.5
const NEAR_FIRST = 0.04
const _yFlip = new Quaternion().setFromAxisAngle(_up, Math.PI)
const _lookDown = new Quaternion().setFromAxisAngle(_axisX, -0.13)
const _eye = new Vector3()
const _camQ = new Quaternion()

function setNear(camera, near) {
  if (camera.near === near) return
  camera.near = near
  camera.updateProjectionMatrix()
}

/**
 * First person: your eyes, over the saddle and leaning with you, looking down the road
 * with the bars and the front wheel at the bottom of the screen (you aren't drawn:
 * Player). The view tilts with the bike, a little less than it leans.
 */
function firstPerson(camera, cam, heading, dt, bikeInfo) {
  const rv = runtime.rideView
  const lean = 0.42 + 0.35 * rv.tuck
  _eye.set(0, SEAT.y + BODY.pivot + 0.66 * Math.cos(lean) - 0.08 + rv.stand * 0.1, SEAT.z + 0.66 * Math.sin(lean) - 0.12)
  _eye.applyQuaternion(rv.quaternion).add(rv.position)
  camera.position.copy(_eye)
  _e.set(-ride.pitch * 0.85, Math.PI - heading, ride.lean * 0.55)
  _camQ.setFromEuler(_e).multiply(_yFlip).multiply(_lookDown)
  if (!cam.init) {
    camera.quaternion.copy(_camQ)
    cam.init = true
  } else camera.quaternion.slerp(_camQ, 1 - Math.exp(-14 * dt))
  if (cam.shake > 0.01) {
    camera.position.y += (Math.random() - 0.5) * cam.shake * 0.12
    cam.shake *= Math.exp(-7 * dt)
  }
  setNear(camera, NEAR_FIRST)
  const speedK = Math.min(1, ride.v / Math.max(20, bikeInfo.top * 1.1))
  const fov = cam.baseFov + 18 + 12 * speedK + (ride.boosting ? 6 : 0)
  camera.fov += (fov - camera.fov) * Math.min(1, 4 * dt)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

function driveCamera(camera, cam, heading, dt, now, bikeInfo) {
  const rv = runtime.rideView
  const bail = ride.phase === 'bail'
  // First person until you're thrown off (tumbling from the inside is no fun to watch).
  const fp = ride.cam === 2 && !bail
  if (fp !== cam.fp) {
    cam.fp = fp
    cam.init = false
  }
  rv.firstPerson = fp
  if (fp) {
    firstPerson(camera, cam, heading, dt, bikeInfo)
    return
  }
  setNear(camera, NEAR_CHASE)
  const target = bail ? rv.riderPos : rv.position
  if (!cam.init) {
    cam.heading = heading
  }
  // Ease the heading so the camera swings round corners rather than snapping.
  let dh = heading - cam.heading
  dh = Math.atan2(Math.sin(dh), Math.cos(dh))
  if (!bail) cam.heading += dh * Math.min(1, 5 * dt)
  const [dist, height, ahead] = CAMS[ride.cam] || CAMS[0]
  _fwd.set(Math.sin(cam.heading), 0, -Math.cos(cam.heading))
  const d = bail ? dist + 3 : dist
  const hgt = bail ? height + 2 : height
  _desired.set(target.x - _fwd.x * d, target.y + hgt, target.z - _fwd.z * d)
  // Never below the road behind you.
  const track = ride.track
  const behindM = Math.max(0, ride.m - d)
  const floor = roadY(track, behindM) + 1.2
  if (_desired.y < floor) _desired.y = floor
  _look.set(target.x + _fwd.x * (bail ? 0 : ahead), target.y + 1.1, target.z + _fwd.z * (bail ? 0 : ahead))
  if (!cam.init) {
    camera.position.copy(_desired)
    cam.init = true
  }
  camera.position.lerp(_desired, 1 - Math.exp(-(bail ? 3 : 9) * dt))
  // A jolt on landing, a bigger one on a crash.
  if (cam.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * cam.shake * 0.5
    camera.position.y += (Math.random() - 0.5) * cam.shake * 0.5
    cam.shake *= Math.exp(-7 * dt)
  }
  camera.lookAt(_look)
  // The lens widens with speed (and a punch more while boosting).
  const speedK = Math.min(1, ride.v / Math.max(20, bikeInfo.top * 1.1))
  const fov = cam.baseFov + 14 * speedK + (ride.boosting ? 7 : 0)
  camera.fov += (fov - camera.fov) * Math.min(1, 4 * dt)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

/** Kept for readers: obstacle footprints come from track.OBSTACLES. */
export const OBSTACLE_TYPES = OBSTACLES
