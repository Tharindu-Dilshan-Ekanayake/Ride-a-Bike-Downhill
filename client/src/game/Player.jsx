import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { clampToWalkable, groundHeightAt, STATIC_COLLIDERS } from '@shared/world'

import { sfx } from '../audio/sfx'
import ErrorBoundary from '../ui/ErrorBoundary'
import FallbackAvatar from './FallbackAvatar'
import PlayerAvatar from './PlayerAvatar'
import { BODY, SEAT } from './playerPose'
import { ride } from './ride/rideControl'
import { runtime } from './runtime'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
const RADIUS = 0.45

const WALK_SPEED = 10.875
const ACCELERATION = 16
const GRAVITY = 32
const JUMP_SPEED = 10.5
/** Ledges up to this high are walked straight onto (the bike stands). */
const STEP_UP = 1.05

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }
const _seat = new Vector3()

/** Where your blob shadow lies out on the road (undefined in the lobby: the floor there). */
function setFloor(caster, floor) {
  caster.floor = floor
}

/** Pushes a circle out of an axis-aligned rect. Returns true on contact. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return false
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const push = (RADIUS - d) / d
    pos.x += dx * push
    pos.z += dz * push
    return true
  }
  // Centre inside the rect: leave by the nearest side.
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
  return true
}

/**
 * The local player: a kinematic character controller in the lobby, and the rider on the
 * bike during a ride.
 *
 * No physics engine: the lobby is flat ground, a few raised floors and a list of
 * rectangular walls, which a circle-vs-rect push-out handles exactly (zero rigid bodies,
 * no ~2 MB Rapier download).
 *
 * During a ride your logical position stays in the lobby (that's what the server
 * checks); the avatar is seated on the bike wherever the ride has it (runtime.rideView,
 * written by the ride chunk just before this runs), pedalling, tucking and leaning - or
 * tumbling through the air after a bail.
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 *
 * @param {{ onAvatarReady?: () => void }} props
 */
export function Player({ onAvatarReady }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(new Vector3())
  const vy = useRef(0)

  /** Handed to the avatar so it can pose itself. A ref: written every frame. */
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: WALK_SPEED, vy: 0, stride: 0, ride: 0, pedal: 0, tuck: 0, stand: 0, tumble: 0, cheer: 0 })

  // The blob shadow follows the character (or the bike, riding).
  const shownAt = useMemo(() => new Vector3().copy(runtime.player.position), [])
  const caster = useMemo(() => ({ position: shownAt, size: 1.1, floor: undefined }), [shownAt])
  useEffect(() => {
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [caster])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const player = runtime.player
    const pos = player.position
    const motion = motionRef.current
    motion.time += delta
    const group = groupRef.current
    const visual = visualRef.current
    if (!group || !visual) return

    // --- On the bike ----------------------------------------------------------------
    const view = runtime.rideView
    if (ride.phase !== 'idle' && view.active) {
      const bailing = view.bail
      motion.ride = bailing ? 0 : 1
      motion.tumble = bailing ? 1 : 0
      motion.grounded = true
      motion.speed = 0
      motion.pedal = view.pedal
      motion.tuck = view.tuck
      motion.stand = view.stand
      motion.cheer = view.cheer
      // Seen from your own eyes: you're not drawn (your shoulders would fill the view).
      group.visible = !(view.firstPerson && !bailing)
      if (bailing) {
        // Tumbling: the body turns about its middle.
        group.position.copy(view.riderPos)
        visual.quaternion.copy(view.riderQuat)
        _seat.set(0, -BODY.pivot, 0).applyQuaternion(visual.quaternion)
        visual.position.copy(_seat)
      } else {
        // Seated: the avatar's feet-origin sits at SEAT in the bike's frame.
        group.position.copy(view.position)
        visual.quaternion.copy(view.quaternion)
        _seat.set(0, 0, SEAT.z).applyQuaternion(view.quaternion)
        visual.position.copy(_seat)
      }
      shownAt.copy(bailing ? view.riderPos : view.position)
      setFloor(caster, view.groundY)
      player.anim = 'idle'
      return
    }
    motion.ride = 0
    motion.tumble = 0
    motion.cheer = 0
    group.visible = true
    setFloor(caster, undefined)

    // --- Walking in the lobby --------------------------------------------------------
    const k = keys.current
    const joy = runtime.input
    _input.set(0, 0, 0)
    const still = player.frozen
    if (!still) _input.set((k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX, 0, (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY)
    const inputLength = Math.min(1, _input.length())
    if (inputLength > 0.02) {
      _input.normalize()
      // "Up" always means "away from the camera".
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()
        .multiplyScalar(WALK_SPEED * inputLength)
    } else {
      _move.set(0, 0, 0)
    }
    velocity.current.lerp(_move, 1 - Math.exp(-ACCELERATION * delta))

    const prevX = pos.x
    const prevZ = pos.z
    pos.x += velocity.current.x * delta
    pos.z += velocity.current.z * delta
    for (const rect of STATIC_COLLIDERS) pushOut(pos, rect)
    for (const rect of runtime.dynamicColliders) pushOut(pos, rect)
    clampToWalkable(pos.x, pos.z, _clamped)
    pos.x = _clamped.x
    pos.z = _clamped.z
    let floor = groundHeightAt(pos.x, pos.z)
    if (floor - pos.y > STEP_UP) {
      pos.x = prevX
      pos.z = prevZ
      floor = groundHeightAt(pos.x, pos.z)
    }

    const wantJump = !still && (k.jump || joy.jump)
    if (wantJump && player.grounded) {
      vy.current = JUMP_SPEED
      player.grounded = false
      sfx.jump()
    }
    vy.current -= GRAVITY * delta
    pos.y += vy.current * delta
    if (pos.y <= floor) {
      if (!player.grounded && vy.current < -5) sfx.jumpLand()
      pos.y = floor
      vy.current = 0
      player.grounded = true
    } else if (pos.y - floor > 0.05) {
      player.grounded = false
    }

    const speed = Math.hypot(velocity.current.x, velocity.current.z)
    if (speed > 0.3) player.yaw = Math.atan2(velocity.current.x, velocity.current.z)

    // Step-ups ease in on the visual only; the logical position snaps.
    const shownY = group.position.y
    const steppingUp = player.grounded && pos.y > shownY
    const y = steppingUp ? shownY + (pos.y - shownY) * Math.min(1, delta * 18) : pos.y
    group.position.set(pos.x, y, pos.z)
    visual.position.set(0, 0, 0)
    _targetQuat.setFromAxisAngle(_up, player.yaw)
    visual.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0005, delta))
    shownAt.set(pos.x, pos.y, pos.z)

    player.speed = speed
    player.anim = !player.grounded ? 'jump' : speed > 0.5 ? 'walk' : 'idle'
    motion.speed = speed
    motion.grounded = player.grounded
    motion.vy = vy.current
    motion.stride += delta * (5 + 6 * Math.min(1, speed / WALK_SPEED))
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} onReady={onAvatarReady} />}>
          <Suspense fallback={<FallbackAvatar motionRef={motionRef} />}>
            <PlayerAvatar onReady={onAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
          </Suspense>
        </ErrorBoundary>
      </group>
    </group>
  )
}

export default Player
