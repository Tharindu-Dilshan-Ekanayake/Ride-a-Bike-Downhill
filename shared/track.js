import { BIKES, HILL, hillGrade, hillLength, hillSpan, PHYSICS, runUpLength, WORLDS } from './balance.js'
import { mulberry32 } from './rng.js'

/**
 * The mountain roads, generated from a seed so that every client and the server build
 * exactly the same one: the server uses it to check a ride's result (how far it could
 * have got, which coins exist where), the client to draw and ride it.
 *
 * Coordinates: a road is a centreline measured in horizontal metres `m` from the start
 * gate. At each metre it has a world point, a heading (0 = north, -Z; positive turns
 * east) and a grade (dy/dm, negative downhill). A point on the road is `(m, x, h)`: `x`
 * metres to the right of the centreline, `h` up from the road surface.
 *
 * Pure JS, no three.js: it runs on the server too. Everything is allocation-free once
 * built, so the frame loop can query it freely.
 */

/** Half the asphalt's width, the kerb beyond it, and the grass shoulder beyond that. */
export const ROAD_HALF = 7
export const CURB = 0.9
export const SHOULDER = 4.6
/** Where the kerb ends (the road you can ride at full speed). */
export const EDGE = ROAD_HALF + CURB
/** Where the shoulder ends and the bank starts: the wall you bounce off. */
export const WALL_X = EDGE + SHOULDER

/** Where the road leaves the lobby: the start gate, facing north (-Z). */
export const TRACK_START = { x: 0, y: 0, z: -46 }

/** The hills' layout lives in balance.js (zone lengths are worked out from it). */
export const HILL_SHARE = HILL.share
export { hillGrade, hillLength }
/** Fastest a ramp throws a bike upwards (m/s); the ride's physics caps it the same. */
export const RAMP_VY = 9.5
const { crest: CREST, drop: DROP, dropGrade: DROP_GRADE, finishRun: FINISH_RUN } = HILL

/** Obstacle kinds: footprint half-width/half-length, height, and whether you smash through. */
export const OBSTACLES = {
  crate: { hw: 0.7, hl: 0.7, h: 1.4, smash: true },
  cone: { hw: 0.35, hl: 0.35, h: 0.8, smash: true },
  barrel: { hw: 0.55, hl: 0.55, h: 1.1 },
  hay: { hw: 1.3, hl: 0.8, h: 1.25 },
  rock: { hw: 1.1, hl: 1, h: 1.3 },
  log: { hw: EDGE, hl: 0.35, h: 0.55 },
  car: { hw: 1, hl: 2.2, h: 1.5 },
  snowman: { hw: 0.6, hl: 0.6, h: 1.8 },
  iceblock: { hw: 0.9, hl: 0.9, h: 1.2 },
  /** A slippery patch: no collision, but steering slides. */
  ice: { hw: 3, hl: 9, h: 0, surface: true },
}
export const OBSTACLE_KINDS = Object.keys(OBSTACLES)

/** What each theme puts on the road. */
const THEME_OBSTACLES = {
  pine: { solid: ['barrel', 'hay', 'rock', 'barrel', 'hay'], smash: ['crate', 'cone'], car: true, log: true, ice: false },
  frost: { solid: ['snowman', 'iceblock', 'rock', 'barrel'], smash: ['crate', 'cone'], car: true, log: true, ice: true },
}

const cache = new Map()

/** The road for world `index` (balance WORLDS), built once and cached. */
export function getTrack(index) {
  const key = WORLDS[index] ? index : 0
  let track = cache.get(key)
  if (!track) {
    track = buildTrack(key)
    cache.set(key, track)
  }
  return track
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t

/** Smooths an array in place with a box filter of half-width `r`, `passes` times. */
function smoothArray(arr, r, passes, locked) {
  const n = arr.length
  const tmp = new Float32Array(n)
  for (let p = 0; p < passes; p += 1) {
    let sum = 0
    let count = 0
    for (let i = 0; i < Math.min(n, r); i += 1) {
      sum += arr[i]
      count += 1
    }
    for (let i = 0; i < n; i += 1) {
      if (i + r < n) {
        sum += arr[i + r]
        count += 1
      }
      if (i - r - 1 >= 0) {
        sum -= arr[i - r - 1]
        count -= 1
      }
      tmp[i] = sum / count
    }
    for (let i = 0; i < n; i += 1) if (!locked || !locked[i]) arr[i] = tmp[i]
  }
}

/**
 * Builds world `index`'s road: centreline, zones, hills, obstacles, ramps, boost pads
 * and coins. See the file comment for the coordinate system.
 */
export function buildTrack(index) {
  const world = WORLDS[index]
  const rand = mulberry32(world.seed)
  const rr = (a, b) => a + (b - a) * rand()
  const pick = (list) => list[Math.floor(rand() * list.length)]
  const theme = THEME_OBSTACLES[world.theme] || THEME_OBSTACLES.pine
  const length = world.length
  const n = length + 1

  // --- Grade profile, section by section --------------------------------------------
  const grade = new Float32Array(n).fill(-0.12)
  /** Metres whose grade must not be smoothed (hills and run-ups stay exact). */
  const locked = new Uint8Array(n)
  /** What each metre is: 0 body, 1 run-up, 2 hill, 3 crest/drop, 4 finish. */
  const kind = new Uint8Array(n)
  const hills = []
  const fill = (from, to, g, k, lock) => {
    for (let i = Math.max(0, Math.floor(from)); i < Math.min(n, Math.ceil(to)); i += 1) {
      grade[i] = g
      kind[i] = k
      if (lock) locked[i] = 1
    }
  }

  world.zones.forEach((zone, zi) => {
    const zoneEnd = zone.start + zone.length
    let cursor = zone.start
    if (zone.gate >= 0) {
      const top = BIKES[zone.gate].top
      const need = HILL.share * top
      const g = hillGrade(zone.gate)
      const len = hillSpan(zone.gate)
      fill(cursor, cursor + len, g, 2, true)
      hills.push({ zone: zi, m: cursor, crest: cursor + len, grade: g, need, gate: zone.gate, height: len * g })
      cursor += len
      fill(cursor, cursor + CREST, 0, 3, true)
      cursor += CREST
      fill(cursor, cursor + DROP, DROP_GRADE, 3, false)
      cursor += DROP
    }
    const next = world.zones[zi + 1]
    const runUp = next && next.gate >= 0 ? runUpLength(BIKES[next.gate].top) : 0
    const bodyEnd = next ? zoneEnd - runUp : zoneEnd - FINISH_RUN
    // The zone's body: a random mix of sections, busier further down.
    while (cursor < bodyEnd - 8) {
      const left = bodyEnd - cursor
      const r = rand()
      let len
      if (r < 0.34) {
        len = rr(50, 110)
        fill(cursor, cursor + len, -rr(0.1, 0.16), 0, false)
      } else if (r < 0.52) {
        len = rr(25, 50)
        fill(cursor, cursor + len, -rr(0.2, 0.28), 0, false)
      } else if (r < 0.68) {
        len = rr(30, 60)
        fill(cursor, cursor + len, -rr(0.02, 0.05), 0, false)
      } else if (r < 0.84) {
        // Rollers: little bumps that pop you into the air at speed.
        len = rr(40, 72)
        for (let b = 0; b < len; b += 12) {
          fill(cursor + b, cursor + b + 6, 0.1, 0, false)
          fill(cursor + b + 6, cursor + b + 12, -0.2, 0, false)
        }
      } else {
        // A kicker: easing off, then a steep drop you fly off.
        len = 42
        fill(cursor, cursor + 18, -0.04, 0, false)
        fill(cursor + 18, cursor + 42, -0.34, 0, false)
      }
      len = Math.min(len, left)
      cursor += len
    }
    if (next && runUp > 0) fill(bodyEnd, zoneEnd, -PHYSICS.refGrade, 1, true)
    if (!next) fill(bodyEnd, zoneEnd + 1, -0.05, 4, false)
  })
  smoothArray(grade, 4, 2, locked)

  // --- Curvature: straights and bends, steering back towards north ---------------------
  const curv = new Float32Array(n)
  {
    let m = 0
    let heading = 0
    while (m < length) {
      const zi = zoneIndexIn(world, m)
      const straight = rand() < 0.45 || kind[Math.min(n - 1, Math.floor(m))] >= 2
      if (straight) {
        const len = rr(40, 110)
        m += len
        continue
      }
      const rMin = Math.max(55, 110 - 7 * zi)
      const radius = rr(rMin, 170)
      const len = rr(30, 95)
      // Turn back towards north the further off it the road has wandered.
      const pRight = clamp(0.5 - heading / 1.4, 0.08, 0.92)
      let sign = rand() < pRight ? 1 : -1
      if (Math.abs(heading + (sign * len) / radius) > 0.9) sign = -sign
      for (let i = Math.floor(m); i < Math.min(n, m + len); i += 1) {
        // No bends on hills, crests and drops: those are about speed.
        if (kind[i] >= 2) break
        curv[i] = sign / radius
        heading += sign / radius
      }
      m += len
    }
  }
  smoothArray(curv, 8, 2, null)

  // --- Integrate the centreline -------------------------------------------------------
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const pz = new Float32Array(n)
  const head = new Float32Array(n)
  px[0] = TRACK_START.x
  py[0] = TRACK_START.y
  pz[0] = TRACK_START.z
  for (let i = 1; i < n; i += 1) {
    head[i] = head[i - 1] + curv[i - 1]
    const h = (head[i] + head[i - 1]) / 2
    px[i] = px[i - 1] + Math.sin(h)
    pz[i] = pz[i - 1] - Math.cos(h)
    py[i] = py[i - 1] + (grade[i - 1] + grade[i]) / 2
  }

  // --- Obstacles, ramps, pads, coins ------------------------------------------------------
  const obstacles = []
  const ramps = []
  const pads = []
  const coins = []
  const free = (m, len) => {
    for (let i = Math.floor(m); i <= Math.ceil(m + len); i += 1) if (i >= n || kind[i] !== 0) return false
    return true
  }
  const blocked = (m, x, r) => obstacles.some((o) => !OBSTACLES[o.kind].surface && Math.abs(o.m - m) < OBSTACLES[o.kind].hl + r && Math.abs(o.x - x) < OBSTACLES[o.kind].hw + r)
  const addObstacle = (k, m, x) => obstacles.push({ kind: k, m, x })
  const addCoin = (m, x, h = 1.1) => {
    if (m < 4 || m > length - 4 || Math.abs(x) > EDGE - 0.5) return
    if (blocked(m, x, 0.9)) return
    if (ramps.some((r) => m >= r.m - 1 && m <= r.m + r.len + 1 && Math.abs(x - r.x) < r.hw + 0.5) && h < 1.5) return
    coins.push(m, x, h)
  }
  const lane = () => pick([-5, -2.5, 0, 2.5, 5])
  const coinLine = (m, x, count, spacing = 4, wave = 0) => {
    for (let c = 0; c < count; c += 1) addCoin(m + c * spacing, x + Math.sin(c * 0.9) * wave)
  }

  // A welcome line of coins off the start.
  coinLine(12, 0, 8, 4)

  world.zones.forEach((zone, zi) => {
    const zoneEnd = zone.start + zone.length
    const d = zone.density
    const spacing = lerp(36, 14, d)
    // A clear run off the start line to get going; obstacles from there on.
    let m = zi === 0 ? 45 : zone.start + 20
    // Coins up and over the hill: a reward for cresting it.
    const hill = hills.find((h) => h.zone === zi)
    if (hill) {
      coinLine(hill.m + 3, 0, Math.floor((hill.crest - hill.m) / 5), 5)
      coinLine(hill.crest + 2, 0, 4, 3)
    }
    // Coins down every run-up (nothing in the way there: it's a straight run at the hill).
    for (let ru = zone.start; ru < zoneEnd; ru += 1) {
      if (kind[ru] !== 1) continue
      for (let c = ru + 10; c < zoneEnd - 10 && kind[Math.floor(c)] === 1; c += 46) coinLine(c, pick([-3, 0, 3]), 5, 3.5)
      break
    }
    while (m < zoneEnd - 10) {
      m += spacing * rr(0.75, 1.25)
      const x = lane()
      // In a run-up (not its last 50 m): something to dodge, but nothing that slows you
      // except the cones you choose to smash, and no pads or ramps: hills are crested on
      // the bike's own speed.
      const at = Math.floor(m)
      if (at < n && kind[at] === 1) {
        let end = at
        while (end < n && kind[end] === 1) end += 1
        if (m + 26 > end - 50) continue
        const q = rand()
        if (q < 0.45) addObstacle(pick(theme.solid), m, x)
        else if (q < 0.75) for (let c = 0; c < 4; c += 1) addObstacle('cone', m + c * 9, (c % 2 === 0 ? 2.5 : -2.5) * (x >= 0 ? 1 : -1))
        else coinLine(m, x, 6, 3.5)
        m += 10
        continue
      }
      if (!free(m - 6, 26)) continue
      const r = rand()
      if (r < 0.2) {
        // A ramp, with coins along the arc you fly.
        const hw = rr(2.2, 3)
        const len = 7
        const h = rr(1.7, 2.6)
        const rx = clamp(x, -ROAD_HALF + hw, ROAD_HALF - hw)
        if (blocked(m + len / 2, rx, hw + 2)) continue
        ramps.push({ m, x: rx, hw, len, h })
        const v = (zone.gate >= 0 ? BIKES[zone.gate].top : BIKES[1].top) * 0.95
        // The ride caps a ramp's kick upwards (ridePhysics RAMP_VY): the arc follows it.
        const vy = Math.min(RAMP_VY, v * (h / len))
        for (let t = 0.15; t < 1.4; t += 0.16) {
          const y = h + vy * t - 0.5 * PHYSICS.gravity * t * t
          if (y < 0.8) break
          addCoin(m + len + v * t, rx, y + 0.6)
        }
      } else if (r < 0.31) {
        // A boost pad, not in a run-up (hills must be crested on the bike's own speed).
        pads.push({ m, x: clamp(x, -5, 5), hw: 1.8, hl: 2.5 })
        coinLine(m + 8, clamp(x, -5, 5), 5, 4)
      } else if (r < 0.45) {
        // A single solid obstacle, coins round it.
        addObstacle(pick(theme.solid), m, x)
        coinLine(m - 14, x + (x > 0 ? -3 : 3), 5, 3)
      } else if (r < 0.55 && zi >= 1) {
        // A wall across the road with one gap (not in the first zone: you're still learning).
        const gap = pick([-5, -2.5, 0, 2.5, 5])
        for (const lx of [-5, -2.5, 0, 2.5, 5]) if (Math.abs(lx - gap) > 1) addObstacle(pick(theme.solid), m, lx)
        coinLine(m - 10, gap, 5, 2.5)
      } else if (r < 0.65) {
        // A slalom of cones (smash them or weave).
        const side = rand() < 0.5 ? -1 : 1
        for (let c = 0; c < 5; c += 1) addObstacle('cone', m + c * 9, side * (c % 2 === 0 ? 2.5 : -2.5))
        coinLine(m, 0, 10, 4.5, 0)
        m += 40
      } else if (r < 0.74) {
        // Crates to smash through.
        const cx = clamp(x, -5, 5)
        addObstacle('crate', m, cx)
        addObstacle('crate', m + 2, cx + 1.6)
        if (rand() < 0.5) addObstacle('crate', m + 4, cx - 1.6)
        coinLine(m + 8, cx, 4, 3)
      } else if (r < 0.82 && theme.log && zi >= 1) {
        // A log across the road: hop it, or go round on the grass.
        addObstacle('log', m, 0)
        for (let c = 0; c < 3; c += 1) addCoin(m - 1 + c * 1.5, pick([-3, 0, 3]), 2.4)
      } else if (r < 0.9 && theme.car && zi >= 1) {
        // A parked car on one side of the road.
        const side = rand() < 0.5 ? -1 : 1
        addObstacle('car', m, side * 4.6)
        coinLine(m - 6, -side * 3, 6, 3)
      } else if (theme.ice && r < 0.97) {
        addObstacle('ice', m, clamp(x, -4, 4))
        coinLine(m - 8, clamp(x, -4, 4), 6, 3)
      } else {
        coinLine(m, x, 8, 4, rand() < 0.5 ? 2 : 0)
      }
    }
  })

  obstacles.sort((a, b) => a.m - b.m)
  ramps.sort((a, b) => a.m - b.m)
  pads.sort((a, b) => a.m - b.m)
  // Coins sorted by m too (their index is what a ride reports).
  const order = []
  for (let i = 0; i < coins.length; i += 3) order.push(i)
  order.sort((a, b) => coins[a] - coins[b])
  const coinData = new Float32Array(coins.length)
  order.forEach((src, i) => {
    coinData[i * 3] = coins[src]
    coinData[i * 3 + 1] = coins[src + 1]
    coinData[i * 3 + 2] = coins[src + 2]
  })

  return {
    world: index,
    length,
    n,
    px,
    py,
    pz,
    head,
    grade,
    curv,
    kind,
    hills,
    obstacles,
    ramps,
    pads,
    coins: coinData,
    coinCount: coinData.length / 3,
  }
}

// --- Queries ----------------------------------------------------------------------------

/** Index of the zone of `world` (a WORLDS entry) at metre `m`. */
export function zoneIndexIn(world, m) {
  const zones = world.zones
  for (let i = zones.length - 1; i >= 0; i -= 1) if (m >= zones[i].start) return i
  return 0
}

/** Linear interpolation of a per-metre array at metre `m`. */
export function at(arr, m) {
  const n = arr.length
  if (m <= 0) return arr[0]
  if (m >= n - 1) return arr[n - 1]
  const i = Math.floor(m)
  const t = m - i
  return arr[i] + (arr[i + 1] - arr[i]) * t
}

/** The road's centreline height at metre `m` (beyond the end it carries on flat). */
export const roadY = (track, m) => at(track.py, m)

/** Height of any ramp at (m, x) above the road, and its slope along the road. */
export function rampAt(track, m, x, out) {
  out.h = 0
  out.slope = 0
  const ramps = track.ramps
  for (let i = 0; i < ramps.length; i += 1) {
    const r = ramps[i]
    if (r.m > m) break
    const t = (m - r.m) / r.len
    if (t < 0 || t > 1 || Math.abs(x - r.x) > r.hw) continue
    out.h = r.h * t
    out.slope = r.h / r.len
    return out
  }
  return out
}

/** World point of road point (m, x, h). */
export function worldPoint(track, m, x, h, out) {
  const head = at(track.head, m)
  const cx = at(track.px, m)
  const cz = at(track.pz, m)
  out.x = cx + Math.cos(head) * x
  out.y = at(track.py, m) + h
  out.z = cz + Math.sin(head) * x
  return out
}

/** Index of the first item in a list sorted by `m` at or after metre `m` (binary search). */
export function firstAtOrAfter(list, m) {
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid].m < m) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Same for the packed coin array. */
export function firstCoinAtOrAfter(track, m) {
  let lo = 0
  let hi = track.coinCount
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (track.coins[mid * 3] < m) lo = mid + 1
    else hi = mid
  }
  return lo
}

// --- The speed model (the client's ride physics and the server's bounds both use it) ---

/** A bike's target speed on `grade`, as a share of its top speed. */
export function targetShare(grade) {
  const P = PHYSICS
  const down = -grade
  if (down >= P.refGrade) return Math.min(P.steepShare, 1 + ((down - P.refGrade) * (P.steepShare - 1)) / (0.3 - P.refGrade))
  if (down >= 0) return P.flatShare + ((1 - P.flatShare) * down) / P.refGrade
  return Math.max(0.3, P.flatShare - (grade / P.climbGrade) * 0.15)
}

/**
 * Advances forward speed `v` (m/s, along the slope) by `dt` on `grade` for a bike of
 * `top` speed. Downhill, speed chases a target that depends on the slope (boost: the
 * bike's top speed); up a climb it's momentum only, gravity against you, and boost can't
 * help. Returns the new speed (may go below zero on a climb: rolled back).
 */
export function stepSpeed(v, grade, top, dt, boost, brake, grass, accel = 1) {
  const P = PHYSICS
  if (grade > P.climbGrade) {
    const sin = grade / Math.sqrt(1 + grade * grade)
    let a = -(P.gravity * sin + P.roll)
    if (v < P.pedalSpeed) a += P.pedal
    if (brake) a -= P.brake
    if (grass) a -= 2.5
    return v + a * dt
  }
  let target = top * targetShare(grade)
  if (grass) target *= P.grassShare
  let rate = P.accelShare * top * accel
  // Boost: back up to the bike's own top speed, fast - never past it.
  if (boost) {
    target = Math.max(target, top * P.boostShare)
    rate *= P.boostRate
  }
  if (v < target) v = Math.min(target, v + rate * dt)
  else v = Math.max(target, v - (v - target) * P.decay * dt)
  if (brake) v = Math.max(0, v - P.brake * dt)
  return v
}

/**
 * The fastest a bike of `top` speed could average over a whole ride, steep drops, boost
 * and boost pads included: what the server holds a ride's distance to.
 */
export const maxRideSpeed = (top) => top * 1.3 + PHYSICS.padSpeed + 4

/**
 * Rides `track` straight down the middle on a bike of `top` speed, never touching an
 * obstacle (and boosting wherever it's below its top speed while `boostSeconds` last):
 * how far it gets before a hill rolls it back (or the road's length if it never does).
 * For tests and the balance simulation.
 */
export function ghostReach(track, top, boostSeconds = 0) {
  let m = 0
  let v = 0
  let boost = boostSeconds
  const dt = 1 / 30
  for (let t = 0; t < 1200; t += dt) {
    const g = at(track.grade, m)
    const climbing = g > PHYSICS.climbGrade
    const useBoost = !climbing && boost > 0 && v < top * 0.98
    if (useBoost) boost -= dt
    v = stepSpeed(v, g, top, dt, useBoost, false, false)
    if (climbing && v < PHYSICS.stallSpeed) return m
    m += (v * dt) / Math.sqrt(1 + g * g)
    if (m >= track.length) return track.length
  }
  return m
}
