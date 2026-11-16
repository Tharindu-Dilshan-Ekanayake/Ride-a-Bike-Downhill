import { MILESTONE, PHYSICS, WORLDS } from '@shared/balance'
import { at, EDGE, firstAtOrAfter, firstCoinAtOrAfter, OBSTACLES, RAMP_VY, rampAt, roadY, stepSpeed, WALL_X, worldPoint, zoneIndexIn } from '@shared/track'

import { sfx } from '../../audio/sfx'
import { COUNTDOWN_MS, endRide, ride, startRiding } from './rideControl'

/**
 * The ride's physics: one bike on one road, stepped every frame by Ride.jsx. No physics
 * engine (zero rigid bodies): the road is a curve with a height profile, so the bike is a
 * point in road space - metre along, metres across, height - with arcade rules on top:
 *
 *  - On the ground, speed follows the slope (track.stepSpeed: downhill it chases a
 *    target, up a climb it's momentum only); A/D turn the bike, and the road bends under
 *    it, so you steer through the corners. The grass shoulder slows you, the banks beyond
 *    it bounce you back (or throw you off if you hit them hard).
 *  - Leaving the ground (a ramp's lip, a crest taken fast, a hop) is ballistic. In the
 *    air you lean back or forward to flip; land within reach of the slope and you ride
 *    on (a flip pays), land badly or too hard for your bike's suspension and you bail.
 *  - Solid obstacles throw you off; crates and cones smash; boost pads kick you on.
 *  - A climb that runs your speed out rolls you back: the ride ends there.
 *
 * Writes only into `ride` (and calls endRide/startRiding, which defer any store update),
 * allocates nothing per frame.
 */

const G = PHYSICS.gravity
const TAU = Math.PI * 2
/** How far W can nose the bike down below the slope in the air (radians). */
const FORWARD_LEAN = 0.5
/** Landing at more than this angle off the slope bails (about 66 degrees). */
const BAD_ANGLE = 1.15
/** How much harder a landing a bike takes per m/s it's going (fast landings come from longer flights). */
const LANDING_PER_SPEED = 0.35
const _ramp = { h: 0, slope: 0 }
const _p = { x: 0, y: 0, z: 0 }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const wrap = (a) => a - TAU * Math.round(a / TAU)

/** Height of the riding surface at (m, x): the road, plus any ramp there. */
export function surfaceAt(track, m, x, out = _ramp) {
  rampAt(track, m, x, out)
  return roadY(track, m) + out.h
}

/** The bike's world position and heading, for drawing and the camera. */
export function bikeWorld(out) {
  const track = ride.track
  worldPoint(track, ride.m, ride.x, ride.y - roadY(track, ride.m), out)
  return out
}

/** World heading (radians from north, positive towards east) of the bike. */
export const bikeHeading = () => at(ride.track.head, ride.m) + ride.yaw

/** Input for one step, filled by Ride.jsx from the keyboard and the touch buttons. */
export const input = { steer: 0, brake: false, boost: false, jump: false, leanFwd: false, leanBack: false }
let jumpHeld = false

/**
 * Advances the ride by `dt` seconds of real time (`now` = performance.now()). `bike` is
 * the ridden bike's stats with its GARAGE parts (logic.bikeStats): top, handling,
 * landing, accel, grip, smashKeep.
 */
export function stepRide(dt, now, bike) {
  if (!ride.track) return
  if (ride.phase === 'countdown') {
    if (now - ride.countdownAt >= COUNTDOWN_MS) {
      startRiding(now)
      sfx.windStart()
    }
    return
  }
  // Small steps keep landings and bounces honest on a slow frame.
  const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 60))))
  const h = dt / steps
  for (let i = 0; i < steps; i += 1) {
    if (ride.phase === 'riding' || ride.phase === 'finish') stepBike(h, now, bike)
    else if (ride.phase === 'bail') stepBail(h, now)
    else if (ride.phase === 'stall') stepStall(h, now)
  }
  if (ride.phase === 'riding' || ride.phase === 'finish') sfx.windSet(Math.min(1, ride.v / 45), true)
}

function stepBike(dt, now, bike) {
  const track = ride.track
  const top = bike.top
  const finishing = ride.phase === 'finish'
  const steer = finishing ? 0 : input.steer
  const grade = at(track.grade, ride.m)
  const kappa = at(track.curv, ride.m)
  ride.onGrass = Math.abs(ride.x) > EDGE
  ride.onIce = onIce(track)

  // --- Boost ------------------------------------------------------------------------
  const boosting = !finishing && input.boost && ride.boost > 0
  if (boosting) ride.boost = Math.max(0, ride.boost - dt)
  if (boosting && !ride.boosting) sfx.boost?.()
  ride.boosting = boosting
  ride.braking = !finishing && input.brake && ride.grounded

  if (ride.grounded) {
    // --- Steering: the bike turns, the road bends under it --------------------------
    const grip = ride.onIce ? 0.4 + bike.grip : ride.onGrass ? Math.min(1, 0.8 + bike.grip * 0.5) : 1
    const handling = bike.handling * grip * clamp(1.2 - ride.v / (top * 2.4), 0.62, 1.15)
    ride.yaw += steer * handling * dt
    if (Math.abs(steer) < 0.1) ride.yaw -= ride.yaw * Math.min(1, (ride.onIce ? 0.35 : 1.7) * dt)
    ride.yaw = clamp(ride.yaw, -1.1, 1.1)

    // --- Speed ----------------------------------------------------------------------
    ride.v = stepSpeed(ride.v, grade, top, dt, boosting, ride.braking, ride.onGrass, bike.accel)
    if (finishing) ride.v = Math.max(0, ride.v - 7 * dt)
    if (grade > PHYSICS.climbGrade && ride.v < PHYSICS.stallSpeed && !finishing) {
      stall(now)
      return
    }
    ride.v = Math.max(0, ride.v)

    // --- Move -----------------------------------------------------------------------
    const vh = ride.v / Math.sqrt(1 + grade * grade)
    ride.vh = vh
    advance(track, vh, kappa, dt)
    surfaceAt(track, ride.m, ride.x, _ramp)
    const ground = roadY(track, ride.m) + _ramp.h
    const slope = at(track.grade, ride.m) + _ramp.slope
    const yBall = ride.y + ride.vy * dt - 0.5 * G * dt * dt
    // A hop off the ground.
    const hop = input.jump && !jumpHeld && !finishing
    jumpHeld = input.jump
    if (hop) {
      ride.vy = Math.max(ride.vy, vh * slope) + PHYSICS.hop
      takeOff(now)
      ride.y = ground + 0.03
      sfx.jump()
    } else if (yBall > ground + 0.04) {
      // The ground fell away under you: a ramp's lip, a crest, a kicker. Off a ramp the
      // kick upwards is capped, so a fast bike gets big air, not a trip to orbit.
      if (ride.onRamp) ride.vy = Math.min(ride.vy, RAMP_VY)
      ride.vy -= G * dt
      ride.y = yBall
      takeOff(now)
    } else {
      ride.vy = (ground - ride.y) / dt
      ride.y = ground
      ride.pitch += (Math.atan(slope) - ride.pitch) * Math.min(1, 14 * dt)
    }
    ride.onRamp = _ramp.h > 0.01
  } else {
    // --- In the air -------------------------------------------------------------------
    jumpHeld = input.jump
    ride.airTime += dt
    const bikeTop = top
    ride.yaw = clamp(ride.yaw + steer * bike.handling * 0.45 * dt, -1.1, 1.1)
    // Boost in the air only gets you back to the bike's top speed, as on the ground.
    if (boosting && ride.vh < bikeTop * PHYSICS.boostShare) ride.vh = Math.min(bikeTop * PHYSICS.boostShare, ride.vh + 5 * dt)
    ride.vh *= 1 - 0.02 * dt
    advance(track, ride.vh, kappa, dt)
    ride.vy -= G * dt
    ride.y += ride.vy * dt
    // Lean back (S / brake) to flip backwards; W / forward only noses the bike down a
    // little to meet the slope (never a front flip: tipping forward is how you bail). Let
    // go and the nose follows the arc.
    const back = (input.leanBack || input.brake) && !finishing
    const forward = input.leanFwd && !finishing
    if (back && !forward) {
      const rate = 6.2 * dt
      ride.pitch += rate
      ride.flipRot += rate
    } else if (forward && !back) {
      // Down to half a radian below the slope under you, no further.
      const floor = Math.atan(at(track.grade, ride.m)) - FORWARD_LEAN
      if (ride.pitch > floor) ride.pitch = Math.max(floor, ride.pitch - 2.4 * dt)
    } else {
      const arc = Math.atan2(ride.vy, Math.max(1, ride.vh)) * 0.6
      const diff = wrap(arc - ride.pitch)
      ride.pitch += diff * Math.min(1, 2.6 * dt)
    }
    const ground = surfaceAt(track, ride.m, ride.x, _ramp)
    if (ride.y <= ground) {
      land(track, ground, bike, now)
      if (ride.phase !== 'riding' && ride.phase !== 'finish') return
    }
  }

  // --- The banks ---------------------------------------------------------------------
  if (Math.abs(ride.x) > WALL_X) {
    const side = Math.sign(ride.x)
    const into = ride.v * Math.sin(ride.yaw) * side
    ride.x = side * WALL_X
    if (into > 10 && ride.v > 15 && !finishing) {
      crash(now, 'bank')
      return
    }
    ride.yaw = -ride.yaw * 0.35
    ride.v *= 0.86
    ride.vh *= 0.86
    sfx.bounce?.(1)
  }

  // --- Obstacles, pads, coins --------------------------------------------------------
  if (!finishing && hitObstacles(track, now, bike)) return
  applyPads(track, bike, now)
  takeCoins(track, now)

  // --- Records and moments -----------------------------------------------------------
  if (!finishing) ride.time += dt
  if (ride.m > ride.distance) {
    const before = Math.floor(ride.distance / MILESTONE)
    ride.distance = ride.m
    const after = Math.floor(ride.distance / MILESTONE)
    if (after > before) {
      ride.milestone = after * MILESTONE
      ride.milestoneAt = now
      sfx.levelUp()
    }
    const zone = zoneIndexIn(WORLDS[ride.world], ride.distance)
    if (zone !== ride.zone) {
      ride.zone = zone
      ride.zoneAt = now
    }
  }
  ride.topSpeed = Math.max(ride.topSpeed, ride.v)
  ride.steer += (steer - ride.steer) * Math.min(1, 8 * dt)
  ride.lean = ride.steer * Math.min(1, ride.v / 12) * 0.38

  if (!finishing && ride.m >= track.length - 1) {
    ride.phase = 'finish'
    ride.endedAt = now
    sfx.wins()
    sfx.levelUp()
  }
  if (finishing && (ride.v < 0.6 || now - ride.endedAt > 2600)) endRide('finish')
}

/** Moves the bike along the road at horizontal speed `vh` for `dt`. */
function advance(track, vh, kappa, dt) {
  const fwd = vh * Math.cos(ride.yaw)
  const lat = vh * Math.sin(ride.yaw)
  const ds = (fwd * dt) / Math.max(0.3, 1 - kappa * ride.x)
  ride.m = Math.max(0, ride.m + ds)
  ride.x += lat * dt
  ride.yaw -= kappa * ds
}

function takeOff(now) {
  if (!ride.grounded) return
  ride.grounded = false
  ride.airTime = 0
  ride.flipRot = 0
  ride.tookOffAt = now
}

/** Touching down: ride on, flips counted - or bail, if it was too hard or at a bad angle. */
function land(track, ground, bike, now) {
  const slope = at(track.grade, ride.m) + _ramp.slope
  const norm = Math.sqrt(1 + slope * slope)
  const impact = (ride.vh * slope - ride.vy) / norm
  const along = (ride.vh + ride.vy * slope) / norm
  const angle = Math.abs(wrap(ride.pitch - Math.atan(slope)))
  ride.y = ground
  const tolerance = bike.landing + LANDING_PER_SPEED * ride.vh
  if (impact > tolerance || angle > BAD_ANGLE) {
    crash(now, impact > tolerance ? 'landing' : 'angle')
    return
  }
  const flips = Math.floor(Math.abs(ride.flipRot) / TAU + 0.12)
  if (flips > 0 && ride.phase === 'riding') {
    ride.flips += flips
    ride.flipAt = now
    sfx.trophy?.()
  }
  ride.grounded = true
  ride.pitch = Math.atan(slope)
  // Landed a bit crooked or hard: you stay on, but it costs speed.
  ride.v = Math.max(0, along) * (impact > tolerance * 0.6 || angle > 0.6 ? 0.88 : 0.97)
  ride.vy = ride.vh * slope
  ride.landedAt = now
  sfx.jumpLand()
}

function onIce(track) {
  const list = track.obstacles
  for (let i = firstAtOrAfter(list, ride.m - 10); i < list.length && list[i].m < ride.m + 10; i += 1) {
    const o = list[i]
    if (o.kind !== 'ice') continue
    const def = OBSTACLES.ice
    if (Math.abs(ride.m - o.m) < def.hl && Math.abs(ride.x - o.x) < def.hw) return true
  }
  return false
}

function hitObstacles(track, now, bike) {
  // ?debug god mode (the automated perf run rides the whole road).
  if (typeof window !== 'undefined' && window.__pp?.godMode) return false
  const list = track.obstacles
  const ground = roadY(track, ride.m)
  for (let i = firstAtOrAfter(list, ride.m - 3); i < list.length && list[i].m < ride.m + 3; i += 1) {
    if (ride.smashedSet[i]) continue
    const o = list[i]
    const def = OBSTACLES[o.kind]
    if (def.surface) continue
    if (Math.abs(ride.m - o.m) > def.hl + 0.6 || Math.abs(ride.x - o.x) > def.hw + 0.35) continue
    if (ride.y - ground > def.h - 0.05) continue
    if (def.smash) {
      ride.smashedSet[i] = 1
      ride.smashed += 1
      ride.smashAt = now
      ride.v *= bike.smashKeep
      ride.vh *= bike.smashKeep
      sfx.wallSmash?.(1)
      continue
    }
    if (ride.v < 5) {
      // Rolled into it at walking pace: a bump, not a bail.
      ride.v = 0
      ride.m -= 0.5
      sfx.bounce?.(2)
      continue
    }
    crash(now, o.kind)
    return true
  }
  return false
}

function applyPads(track, bike, now) {
  const list = track.pads
  for (let i = firstAtOrAfter(list, ride.m - 3); i < list.length && list[i].m < ride.m + 3; i += 1) {
    if (ride.padsUsed[i]) continue
    const p = list[i]
    if (!ride.grounded || Math.abs(ride.m - p.m) > p.hl || Math.abs(ride.x - p.x) > p.hw) continue
    ride.padsUsed[i] = 1
    ride.pads += 1
    ride.padAt = now
    ride.v = Math.max(ride.v, Math.min(ride.v + PHYSICS.padSpeed, bike.top * PHYSICS.padCap))
    ride.boost = Math.min(ride.boostMax, ride.boost + PHYSICS.padRefill)
    sfx.boost?.()
  }
}

function takeCoins(track, now) {
  const r = ride.pickup
  const coins = track.coins
  const riderY = ride.y + 0.9
  for (let j = firstCoinAtOrAfter(track, ride.m - r - 1); j < track.coinCount && coins[j * 3] < ride.m + r + 1; j += 1) {
    if (ride.taken[j]) continue
    const dm = coins[j * 3] - ride.m
    const dx = coins[j * 3 + 1] - ride.x
    if (dm * dm + dx * dx > r * r) continue
    const dy = roadY(track, coins[j * 3]) + coins[j * 3 + 2] - riderY
    if (Math.abs(dy) > 1.6 + (r - PHYSICS.pickup)) continue
    ride.taken[j] = 1
    ride.coinList.push(j)
    ride.coinAt = now
    sfx.coins?.(1)
  }
}

// --- Bailing ----------------------------------------------------------------------------

/**
 * Thrown off: the rider and the bike each tumble on from where the bike was, flung
 * forward at the speed you were going (and up a little), bouncing down the road until
 * they come to rest. Both move in road space too (metre, across, height, with velocity
 * along / across / up), so the road's height is always right under them.
 */
const rider = { m: 0, x: 0, y: 0, vf: 0, vl: 0, vy: 0, rest: 0 }
const bikeBody = { m: 0, x: 0, y: 0, vf: 0, vl: 0, vy: 0, rest: 0 }

function crash(now, cause) {
  ride.phase = 'bail'
  ride.cause = cause
  ride.crashedAt = now
  ride.boosting = false
  const b = ride.bail
  const v = Math.max(ride.v, ride.vh)
  const fwd = v * Math.cos(ride.yaw)
  const lat = v * Math.sin(ride.yaw)
  Object.assign(rider, { m: ride.m, x: ride.x, y: ride.y + 1, vf: fwd * 0.92, vl: lat * 0.9, vy: Math.max(ride.vy, 0) + 3.5 + v * 0.08, rest: 0 })
  Object.assign(bikeBody, { m: ride.m, x: ride.x, y: ride.y, vf: fwd * 0.55, vl: lat * 0.6 + (Math.random() - 0.5) * 3, vy: Math.max(ride.vy, 0) + 1.5, rest: 0 })
  b.spin.x = 6 + v * 0.25
  b.spin.y = (Math.random() - 0.5) * 4
  b.spin.z = (Math.random() - 0.5) * 6
  b.rot.x = ride.pitch
  b.rot.y = 0
  b.rot.z = ride.lean
  b.bikeRot.x = ride.pitch
  b.bikeRot.y = 0
  b.bikeRot.z = ride.lean
  b.flew = 0
  b.bounces = 0
  b.restAt = 0
  worldPoint(ride.track, rider.m, rider.x, 0, _p)
  b.from.x = _p.x
  b.from.z = _p.z
  sfx.groundSmash?.(Math.min(1, v / 30))
  sfx.windStop()
}

/** One body's step: returns true while it's still moving. */
function stepBody(track, body, dt, bounce, friction, onBounce) {
  const kappa = at(track.curv, body.m)
  const ds = (body.vf * dt) / Math.max(0.3, 1 - kappa * body.x)
  body.m = Math.min(track.length + 30, Math.max(0, body.m + ds))
  body.x += body.vl * dt
  body.vy -= G * dt
  body.y += body.vy * dt
  if (Math.abs(body.x) > WALL_X + 1.5) {
    body.x = Math.sign(body.x) * (WALL_X + 1.5)
    body.vl = -body.vl * 0.4
  }
  const ground = surfaceAt(track, body.m, body.x, _ramp)
  if (body.y <= ground) {
    body.y = ground
    if (body.vy < -2.5) {
      body.vy = -body.vy * bounce
      body.vf *= 0.72
      body.vl *= 0.72
      onBounce?.()
    } else {
      body.vy = 0
      // Sliding along the road.
      const speed = Math.hypot(body.vf, body.vl)
      const slow = Math.max(0, speed - friction * dt)
      const k = speed > 1e-4 ? slow / speed : 0
      body.vf *= k
      body.vl *= k
    }
  }
  return Math.hypot(body.vf, body.vl) > 0.5 || body.y > ground + 0.05
}

function stepBail(dt, now) {
  const track = ride.track
  const b = ride.bail
  const riderMoving = stepBody(track, rider, dt, 0.38, 7, () => {
    b.bounces += 1
    b.spin.x *= 0.6
    b.spin.z *= 0.6
    sfx.bounce?.(b.bounces)
  })
  const bikeMoving = stepBody(track, bikeBody, dt, 0.3, 6)
  b.rot.x += b.spin.x * dt
  b.rot.y += b.spin.y * dt
  b.rot.z += b.spin.z * dt
  const tumbling = riderMoving ? 1 : 0.2
  b.spin.x *= 1 - (1 - tumbling) * 4 * dt
  b.spin.z *= 1 - (1 - tumbling) * 4 * dt
  if (bikeMoving) {
    b.bikeRot.x += 3 * dt
    b.bikeRot.z += 2.4 * dt
  }
  worldPoint(track, rider.m, rider.x, rider.y - roadY(track, rider.m), b.pos)
  worldPoint(track, bikeBody.m, bikeBody.x, bikeBody.y - roadY(track, bikeBody.m), b.bikePos)
  b.flew = Math.max(b.flew, Math.hypot(b.pos.x - b.from.x, b.pos.z - b.from.z))
  // The bike keeps its road position for the camera and other players.
  ride.m = rider.m
  ride.x = rider.x
  ride.y = rider.y
  if (!riderMoving && !b.restAt) b.restAt = now
  if ((b.restAt && now - b.restAt > 1100) || now - ride.crashedAt > 6000) endRide('crash')
}

// --- Rolling back ----------------------------------------------------------------------

function stall(now) {
  ride.phase = 'stall'
  ride.crashedAt = now
  ride.v = 0
  ride.boosting = false
  sfx.windStop()
  sfx.error?.()
}

/** Out of speed on a climb: you roll back a little, wobble, and tip over. */
function stepStall(dt, now) {
  const track = ride.track
  const t = (now - ride.crashedAt) / 1000
  if (t < 1.2) {
    ride.v = Math.max(-4, ride.v - 3 * dt)
    ride.m = Math.max(0, ride.m + ride.v * dt)
    ride.y = surfaceAt(track, ride.m, ride.x, _ramp)
    ride.pitch = Math.atan(at(track.grade, ride.m))
  }
  ride.lean = Math.min(1.4, Math.max(0, t - 0.6) * 2.2)
  if (t > 2) endRide('stall')
}

// --- ?debug autopilot -------------------------------------------------------------------

const LANES = [0, -2.5, 2.5, -5, 5]

/**
 * Steers `input` like a careful rider: the nearest lane with nothing solid in the next
 * 35 m, a hop over logs, boost up the hills. Only for the automated test runs (?debug).
 */
export function autopilot(target) {
  const track = ride.track
  if (!track) return
  const list = track.obstacles
  let lane = null
  let log = false
  for (const candidate of LANES) {
    let clear = true
    for (let i = firstAtOrAfter(list, ride.m - 1); i < list.length && list[i].m < ride.m + 35; i += 1) {
      const o = list[i]
      const def = OBSTACLES[o.kind]
      if (def.surface || def.smash || ride.smashedSet[i]) continue
      if (o.kind === 'log') {
        if (o.m - ride.m < 7 && o.m > ride.m) log = true
        continue
      }
      if (Math.abs(o.x - candidate) < def.hw + 0.95) {
        clear = false
        break
      }
    }
    if (clear) {
      lane = candidate
      break
    }
  }
  const goal = lane ?? 0
  target.steer = Math.max(-1, Math.min(1, -((ride.x - goal) * 0.3 + ride.yaw * 2.4)))
  target.boost = at(track.grade, ride.m) > PHYSICS.climbGrade
  target.brake = false
  target.leanBack = false
  target.leanFwd = false
  target.jump = log
}

