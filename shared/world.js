import { BIKES } from './balance.js'
import { TRACK_START } from './track.js'

/**
 * Lobby layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a stand or the start gate is.
 *
 * Units are metres (the avatar is 1.8 tall). +X is east, -Z is north. The lobby is a
 * plaza on the mountain top: you spawn at its south end, the START gate stands at its
 * north edge where the road drops away down the mountain (track.js TRACK_START), the bike
 * shop's stands run along the west side, the Frost Ridge portal is east of the gate,
 * and the leaderboards stand along the back.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

export { TRACK_START }

export const SPAWN = { x: 0, z: 44 }

/** The flat, walkable plaza. */
export const PLAZA = { minX: -42, maxX: 40, minZ: TRACK_START.z, maxZ: 62 }
/** The path from spawn to the gate (half its width). */
export const PATH_HALF = 5

/** The START gate: walking into it starts a ride. */
export const RIDE_ZONE = { minX: -6.5, maxX: 6.5, minZ: TRACK_START.z, maxZ: TRACK_START.z + 9 }
/** The gate's pillars, either side of the road. */
export const START_ARCH = { x: 9.2, z: TRACK_START.z + 3 }
/** Where you're put back after a ride: just short of the gate, facing it. */
export const RIDE_RETURN = { x: 0, z: TRACK_START.z + 16 }

// --- Bike shop ----------------------------------------------------------------------

/** The bike shop: a raised yard along the west side, three rows of display stands. */
export const SHOP = { minX: -40, maxX: -15, minZ: -24, maxZ: 34 }
export const STAND_SIZE = 4.2
export const STAND_HEIGHT = 0.4
/** The big BIKE SHOP sign along the back (west) edge. */
export const SHOP_SIGN = { x: -40.6, minZ: -14, maxZ: 24, top: 13 }
const STAND_ROWS_X = [-19, -27, -35]
const STANDS_PER_ROW = 8
const STAND_PITCH = 6.5

/** One stand per bike, eight to a row, nearest the plaza first. */
export const BIKE_STANDS = BIKES.map((bike, i) => {
  const row = Math.floor(i / STANDS_PER_ROW)
  return {
    index: i,
    bikeId: bike.id,
    row,
    x: STAND_ROWS_X[row],
    z: (SHOP.minZ + SHOP.maxZ) / 2 - (STAND_PITCH * (STANDS_PER_ROW - 1)) / 2 + (i % STANDS_PER_ROW) * STAND_PITCH,
    y: STAND_HEIGHT,
  }
})

export const standRect = (stand) => ({
  minX: stand.x - STAND_SIZE / 2,
  maxX: stand.x + STAND_SIZE / 2,
  minZ: stand.z - STAND_SIZE / 2,
  maxZ: stand.z + STAND_SIZE / 2,
})

// --- The garage --------------------------------------------------------------------------

/**
 * The GARAGE, east of the path where you see it from spawn: a workshop open to the west.
 * Walking in opens the bike parts upgrades. Its sign stands out front on two poles,
 * turned (yaw about +Y; 0 faces south) to face the path and spawn.
 */
export const GARAGE = { minX: 19, maxX: 31, minZ: 15, maxZ: 27 }
export const GARAGE_SIGN = { x: 15.5, z: 29.5, yaw: -Math.PI / 4, width: 7, top: 6.4 }
/** Standing inside it (give or take `margin`). */
export const inGarage = (x, z, margin = 0) => x >= GARAGE.minX + 0.6 - margin && x <= GARAGE.maxX - 0.6 + margin && z >= GARAGE.minZ + 0.6 - margin && z <= GARAGE.maxZ - 0.6 + margin

// --- Leaderboards, portal, gift ----------------------------------------------------------

export const LEADERBOARDS = [
  { id: 'rebirths', x: -18, z: 59.5 },
  { id: 'wins', x: -6, z: 59.5 },
  { id: 'distance', x: 6, z: 59.5 },
  { id: 'playtime', x: 18, z: 59.5 },
]

/** The Frost Ridge portal, east of the start gate. Name and price in balance.js. */
export const PORTALS = [{ id: 'world2', x: 25, z: TRACK_START.z + 12, radius: 3.4 }]

export const FREE_REWARD = { x: 12, z: 48, radius: 3 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ })

/** Solid, never-changing obstacles. */
export const STATIC_COLLIDERS = [
  { minX: SHOP_SIGN.x - 0.5, maxX: SHOP_SIGN.x + 0.5, minZ: SHOP_SIGN.minZ - 0.5, maxZ: SHOP_SIGN.maxZ + 0.5 },
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  ...PORTALS.flatMap((p) => [box(p.x - p.radius, p.z, 0.6, 0.8), box(p.x + p.radius, p.z, 0.6, 0.8)]),
  // The garage's walls (back and sides; the front is open) and its sign's poles.
  { minX: GARAGE.maxX - 0.6, maxX: GARAGE.maxX, minZ: GARAGE.minZ, maxZ: GARAGE.maxZ },
  { minX: GARAGE.minX, maxX: GARAGE.maxX, minZ: GARAGE.minZ, maxZ: GARAGE.minZ + 0.6 },
  { minX: GARAGE.minX, maxX: GARAGE.maxX, minZ: GARAGE.maxZ - 0.6, maxZ: GARAGE.maxZ },
  ...[-1, 1].map((side) =>
    box(GARAGE_SIGN.x + side * (GARAGE_SIGN.width / 2 - 0.4) * Math.cos(GARAGE_SIGN.yaw), GARAGE_SIGN.z - side * (GARAGE_SIGN.width / 2 - 0.4) * Math.sin(GARAGE_SIGN.yaw), 0.3, 0.3),
  ),
  box(-START_ARCH.x, START_ARCH.z, 1, 1),
  box(START_ARCH.x, START_ARCH.z, 1, 1),
  // The mountain's edge either side of the road.
  { minX: PLAZA.minX, maxX: -START_ARCH.x - 1, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
  { minX: START_ARCH.x + 1, maxX: PLAZA.maxX, minZ: PLAZA.minZ - 1, maxZ: PLAZA.minZ + 0.6 },
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = BIKE_STANDS.map((s) => ({ ...standRect(s), height: STAND_HEIGHT }))

/** Walkable ground; the controller clamps the player into it. */
export const WALKABLE = [PLAZA]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) => x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

export const inRideZone = (x, z, margin = 0) => inRect(RIDE_ZONE, x, z, margin)

/** The portal whose swirl (x, z) is in, give or take `margin`, or null. */
export function portalAt(x, z, margin = 0) {
  for (const p of PORTALS) if (Math.hypot(x - p.x, z - p.z) < p.radius + margin) return p
  return null
}

/** Index of the bike stand under (x, z), or -1. */
export function standAt(x, z, margin = 0) {
  for (const stand of BIKE_STANDS) if (inRect(standRect(stand), x, z, margin)) return stand.index
  return -1
}

/** Whether a move to `to` is the hop back after a ride (faster than walking: allowed). */
export const isRideReturn = (to) => Math.hypot(to.x - RIDE_RETURN.x, to.z - RIDE_RETURN.z) < 2.5

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) if (p.height > h && inRect(p, x, z)) h = p.height
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately walk, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
