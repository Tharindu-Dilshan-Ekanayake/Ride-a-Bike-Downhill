import { bikeStats } from '@shared/logic'
import { getTrack } from '@shared/track'
import { RIDE_RETURN } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { send } from '../../net/actions'
import { getGame } from '../../store/game'
import { fadeThrough } from '../../ui/fade'
import { runtime } from '../runtime'

/**
 * The ride: one trip down the mountain, from the countdown at the START gate to the
 * results screen. This module is the ride's state machine and its link to the authority
 * (rideStart / ridePos / rideEnd); the physics (ridePhysics.js) and everything drawn
 * (Ride.jsx) live in the ride's own chunk and read and write the `ride` object below.
 *
 *   idle -> countdown (requestRide) -> riding (GO!) -> bail | stall | finish -> over
 *        -> (results claimed: claimRide) -> idle
 *
 * `ride` changes every frame and is never React state. The UI hears about the phase
 * changes it needs through the game store's `ride` (set from timers, never from the
 * frame loop) and reads the rest straight from here (RideOverlay writes the DOM).
 */

/** The 3, 2, 1, GO! before you roll off. */
export const COUNTDOWN_MS = 2400
/** Ride positions to the server (for other players to watch) this often. */
const POS_MS = 100
/** No result from the authority this long after the ride ended: show what we know. */
const RESULT_WAIT_MS = 6000

export function createRideState() {
  return {
    /** 'idle' | 'countdown' | 'riding' | 'bail' | 'stall' | 'finish' | 'over' */
    phase: 'idle',
    world: 0,
    track: null,
    countdownAt: 0,
    goAt: 0,
    endedAt: 0,
    /** Where you are: metre along the road, metres across, world height of the wheels. */
    m: 0,
    x: 0,
    y: 0,
    /** Speed along the ground (m/s), vertical speed in the air, heading off the road's. */
    v: 0,
    vh: 0,
    vy: 0,
    yaw: 0,
    /** The bike's pitch (nose up +) and lean into turns, for the pose and the camera. */
    pitch: 0,
    lean: 0,
    grounded: true,
    /** On a ramp's slope last step (its lip caps the take-off). */
    onRamp: false,
    airTime: 0,
    /** Rotation turned through in this jump (radians) and flips landed this ride. */
    flipRot: 0,
    flips: 0,
    steer: 0,
    boostMax: 1,
    boost: 1,
    boosting: false,
    braking: false,
    onGrass: false,
    onIce: false,
    pickup: 1.5,
    /** Coins taken (by index, 1 = taken), and the list sent with the result. */
    taken: new Uint8Array(0),
    coinList: [],
    /** Obstacles smashed (by index), boost pads used (by index). */
    smashedSet: new Uint8Array(0),
    smashed: 0,
    padsUsed: new Uint8Array(0),
    pads: 0,
    /** Seconds since GO, furthest metre reached, fastest speed. */
    time: 0,
    distance: 0,
    topSpeed: 0,
    /** Why it ended: 'crash' | 'stall' | 'finish' | 'end', and what hit you. */
    reason: '',
    cause: '',
    /** Thrown off: the rider's tumble (world space) and the bike's own. */
    bail: {
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 },
      rot: { x: 0, y: 0, z: 0 },
      bikePos: { x: 0, y: 0, z: 0 },
      bikeVel: { x: 0, y: 0, z: 0 },
      bikeRot: { x: 0, y: 0, z: 0 },
      from: { x: 0, z: 0 },
      flew: 0,
      bounces: 0,
      restAt: 0,
    },
    /** performance.now() of the moments the effects and sounds key off. */
    landedAt: 0,
    tookOffAt: 0,
    crashedAt: 0,
    coinAt: 0,
    padAt: 0,
    smashAt: 0,
    flipAt: 0,
    milestoneAt: 0,
    milestone: 0,
    zone: 0,
    zoneAt: 0,
    /** The ridden bike with its GARAGE parts (logic.bikeStats), fixed at the start. */
    stats: null,
    /** Camera: 0 chase, 1 far chase, 2 first person. */
    cam: 0,
  }
}

export const ride = createRideState()

let posTimer = null
let resultTimer = null

const deferred = (fn) => setTimeout(fn, 0)

/** Whether a ride is under way (countdown included), as opposed to the lobby. */
export const isRiding = () => ride.phase !== 'idle'

/** Resets the ride state for world `world`, ready for the countdown. */
function prepare(world) {
  const fresh = createRideState()
  const track = getTrack(world)
  // (?debug's bikeOverride lets the automated perf run ride the whole road on the fastest bike.)
  const profile = getGame().profile
  const bikeId = (typeof window !== 'undefined' && window.__pp?.bikeOverride) || profile.bike
  Object.assign(ride, fresh, {
    world,
    track,
    phase: 'countdown',
    countdownAt: performance.now(),
    taken: new Uint8Array(track.coinCount),
    smashedSet: new Uint8Array(track.obstacles.length),
    padsUsed: new Uint8Array(track.pads.length),
    y: track.py[0],
    stats: bikeStats(profile, bikeId),
    cam: ride.cam,
  })
}

/**
 * Off down the mountain: the PLAY button, or walking into the START gate. A white flash
 * takes you to the top of the road, the countdown runs, and the authority starts its
 * clock. Ignored while a ride is already under way or a panel is open over the game.
 */
export function requestRide() {
  if (ride.phase !== 'idle') return false
  const game = getGame()
  const world = game.profile.world || 0
  game.closePanel()
  prepare(world)
  runtime.player.frozen = true
  send('rideStart')
  fadeThrough(() => {
    runtime.camera.mode = 'ride'
    runtime.camera.snap = true
    ride.countdownAt = performance.now()
  })
  deferred(() => getGame().setRide({ phase: 'countdown', world }))
  sfx.countdown?.()
  return true
}

/** The authority's go-ahead: how much boost this ride has and how far coins are grabbed from. */
export function onRideGo(payload) {
  if (!payload) return
  ride.boostMax = Math.max(0, Number(payload.boost) || 1)
  ride.boost = ride.boostMax
  ride.pickup = Number(payload.pickup) || ride.pickup
}

/** Called by the physics the frame the countdown hits GO. */
export function startRiding(now) {
  ride.phase = 'riding'
  ride.goAt = now
  clearInterval(posTimer)
  posTimer = setInterval(sendPosition, POS_MS)
  deferred(() => getGame().setRide({ phase: 'riding', world: ride.world }))
}

function sendPosition() {
  if (ride.phase === 'idle' || ride.phase === 'over' || !ride.track) return
  const state = ride.phase === 'bail' ? 'bail' : ride.grounded ? 'ride' : 'air'
  const h = ride.y - (ride.track.py[Math.min(ride.track.n - 1, Math.max(0, Math.round(ride.m)))] || 0)
  send('ridePos', {
    m: Math.round(ride.m * 100) / 100,
    x: Math.round(ride.x * 100) / 100,
    h: Math.round(h * 100) / 100,
    r: Math.round(ride.yaw * 100) / 100,
    s: state,
  })
}

/**
 * The ride is over: `reason` is 'crash' (bailed and come to rest), 'stall' (rolled back
 * down a hill), 'finish' (the bottom!) or 'end' (the END button). Sends the result to the
 * authority, which checks it and pays (onRideResult). Safe to call from the frame loop:
 * every store update is deferred.
 */
export function endRide(reason = 'end') {
  if (ride.phase === 'idle' || ride.phase === 'over') return
  ride.reason = reason
  ride.phase = 'over'
  ride.endedAt = performance.now()
  clearInterval(posTimer)
  posTimer = null
  sfx.windStop()
  send('rideEnd', {
    distance: Math.round(ride.distance * 10) / 10,
    time: Math.round(ride.time * 1000) / 1000,
    finished: reason === 'finish',
    crashed: reason === 'crash',
    reason,
    coins: ride.coinList,
    flips: ride.flips,
    smashed: ride.smashed,
    pads: ride.pads,
    flew: Math.round(ride.bail.flew * 10) / 10,
    bounces: ride.bail.bounces,
    topSpeed: Math.round(ride.topSpeed * 10) / 10,
  })
  const world = ride.world
  deferred(() => getGame().setRide({ phase: 'over', world }))
  clearTimeout(resultTimer)
  // The authority never answered (connection lost mid-ride): show what we know, unpaid.
  resultTimer = setTimeout(() => {
    if (getGame().rideResult) return
    getGame().setRideResult({
      ok: false,
      world,
      distance: ride.distance,
      reason,
      finished: reason === 'finish',
      crashed: reason === 'crash',
      picked: ride.coinList.length,
      flips: ride.flips,
      flew: ride.bail.flew,
      bounces: ride.bail.bounces,
      parts: {},
      total: 0,
      multiplier: 1,
      id: Date.now(),
    })
  }, RESULT_WAIT_MS)
}

/** The authority's checked and paid result: the results screen shows it. */
export function onRideResult(payload) {
  clearTimeout(resultTimer)
  getGame().setRideResult({ ...payload, reason: ride.reason || payload.reason, id: Date.now() })
  sfx.wins()
}

/** CLAIM on the results screen: a white flash, and you're back at the gate in the lobby. */
export function claimRide() {
  if (ride.phase === 'idle') return
  fadeThrough(() => {
    clearInterval(posTimer)
    clearTimeout(resultTimer)
    const cam = ride.cam
    Object.assign(ride, createRideState(), { cam })
    const player = runtime.player
    player.position.set(RIDE_RETURN.x, 0, RIDE_RETURN.z)
    player.yaw = Math.PI
    player.frozen = false
    runtime.camera.mode = 'follow'
    runtime.camera.yaw = 0
    runtime.camera.snap = true
    const game = getGame()
    game.setRide(null)
    game.setRideResult(null)
  })
}

/** CAM / the C key: chase, far chase, first person (from the saddle, the bars in front of you). */
export function toggleRideCamera() {
  ride.cam = (ride.cam + 1) % 3
  sfx.click()
}
