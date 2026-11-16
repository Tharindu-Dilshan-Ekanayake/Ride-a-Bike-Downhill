import { hash2 } from '@shared/rng'
import { PLAZA, TRACK_START } from '@shared/world'

import { STYLE } from '../materials'

/**
 * The mountain round the summit plaza: blocky rock, one box per column on a 4 m grid.
 * East, west and south it climbs in terraces the further out it stands - grassy ledges
 * just past the plaza, then grey cliffs, then snowy peaks 40 m up (all snow and ice at
 * Frost Ridge). To the north, either side of the road, it drops away instead: ledges
 * stepping down the mountainside below the plaza's edge, the road running down between
 * them (a clear corridor down the middle is left for it: the ride draws the road).
 * Pines grow on the terraces and round the plaza's edge, and a big billboard with the
 * game's name stands on the south slope.
 *
 * Everything goes into the world's block set: no draw calls of its own, nothing to do per
 * frame. `density` (the preset's decorDensity) thins the trees and, on LOW, coarsens the
 * grid to 8 m columns (a quarter of the boxes).
 */

/** The open ground the mountain keeps clear of: the plaza and a strip round its edge. */
const OPEN = { minX: PLAZA.minX - 4, maxX: PLAZA.maxX + 4, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ + 4 }
/** The road's corridor north of the plaza: nothing of the lobby's in it. */
const CORRIDOR_HALF = 18
/** How far out the mountain goes, and how far down the north slope. */
const REACH = { x: 100, south: PLAZA.maxZ + 108, north: TRACK_START.z - 64 }
/** The north slope's columns go this deep (they're seen from the road below). */
const NORTH_BASE = -60

/** The billboard on the south slope: its lettering is a world label (lobbyLabels.js). */
export const BILLBOARD = { x: 0, z: PLAZA.maxZ + 15, y: 9, width: 30, height: 11 }

/** Metres from (x, z) to the plaza's open ground. */
function openDistance(x, z) {
  const dx = Math.max(OPEN.minX - x, 0, x - OPEN.maxX)
  const dz = Math.max(OPEN.minZ - z, 0, z - OPEN.maxZ)
  return Math.hypot(dx, dz)
}

const underBillboard = (x, z) => Math.abs(x - BILLBOARD.x) < BILLBOARD.width / 2 + 3 && Math.abs(z - BILLBOARD.z) < 5

/**
 * A blocky pine standing on `base` at (x, z): a trunk and three tiers of needles, each
 * smaller than the one below (snow on the top tier, and on every tier's top at Frost Ridge).
 */
export function addPine(blocks, x, base, z, scale, trees, k = 0) {
  const s = scale
  blocks.addOn(x, base, z, 0.7 * s, 1.6 * s, 0.7 * s, trees.trunk, STYLE.SMOOTH)
  const tiers = [
    [3.6, 1.6],
    [2.7, 1.5],
    [1.7, 1.4],
  ]
  let y = base + 1.3 * s
  tiers.forEach(([w, h], i) => {
    const color = trees.leaves[(i + Math.floor(hash2(k, i, 7) * 3)) % trees.leaves.length]
    blocks.addOn(x, y, z, w * s, h * s, w * s, color, STYLE.STUDS)
    if (trees.snowTop || i === 2) blocks.addOn(x, y + h * s, z, w * s * (trees.snowTop ? 0.86 : 0.6), 0.3 * s, w * s * (trees.snowTop ? 0.86 : 0.6), '#f6fbff', STYLE.STUDS)
    y += h * s
  })
}

/** The billboard: two legs, a white frame, a navy face and a row of lamps along the top. */
function addBillboard(blocks, v) {
  const { x, z, y, width, height } = BILLBOARD
  for (const side of [-1, 1]) blocks.addOn(x + side * (width / 2 - 3), 0, z + 0.4, 1.4, y, 1.2, v.dark, STYLE.SMOOTH)
  blocks.addOn(x, y, z, width + 1.6, height + 1.6, 1.4, '#e6ecf5', STYLE.SMOOTH)
  blocks.addOn(x, y + 0.8, z - 0.2, width, height, 1.4, v.dark, STYLE.SMOOTH)
  blocks.addOn(x, y + 0.5, z - 1, width - 0.6, 0.35, 0.2, v.accent, STYLE.GLOW)
  blocks.addOn(x, y + height + 0.35, z - 1, width - 0.6, 0.35, 0.2, v.accent, STYLE.GLOW)
  for (const side of [-1, 1]) blocks.addOn(x + side * (width / 2 - 0.3), y + 0.8, z - 1, 0.35, height, 0.2, v.accent, STYLE.GLOW)
  for (let i = 0; i < 15; i += 1) blocks.addOn(x - width / 2 + 1 + i * 2, y + height + 1.6, z, 1.2, 0.9, 1.2, i % 2 ? v.primary : '#ffffff', STYLE.GLOW)
}

/**
 * Builds the mountain into `blocks` in `venue`'s colours (sceneStyle VENUES: `mountain`,
 * `trees`). Returns how many columns and trees went in (for tests/debug).
 */
export function buildMountain(blocks, { density = 1, venue } = {}) {
  const look = venue.mountain
  const cell = density < 0.5 ? 8 : 4
  const treeChance = density >= 0.75 ? 0.08 : density >= 0.5 ? 0.06 : 0.04
  let columns = 0
  let trees = 0
  for (let gx = -REACH.x; gx < REACH.x; gx += cell) {
    for (let gz = REACH.north; gz < REACH.south; gz += cell) {
      const x = gx + cell / 2
      const z = gz + cell / 2
      const k = Math.floor(gx / 4) * 977 + Math.floor(gz / 4)
      const n = hash2(Math.floor(gx / 8), Math.floor(gz / 8))
      if (z < OPEN.minZ) {
        // North: the mountainside dropping away either side of the road.
        if (Math.abs(x) - cell / 2 < CORRIDOR_HALF) continue
        // Beyond the plaza's sides the terraces carry on from the east and west slopes;
        // either way, every step north drops it further below the plaza.
        const fall = OPEN.minZ - z
        const side = Math.max(OPEN.minX - x, 0, x - OPEN.maxX)
        const climb = side > 2 ? Math.min(11, 1 + Math.floor(side / 10 + n * 1.3)) : 0
        const top = (climb > 0 ? 4 * climb : -1.5) - Math.floor(fall / 8 + n * 1.2) * 3
        const step = Math.min(look.rock.length - 1, Math.floor(Math.max(0, climb - 1) / 2))
        blocks.addOn(x, NORTH_BASE, z, cell, top - NORTH_BASE, cell, look.rock[step], look.styles[step])
        columns += 1
        if (hash2(k, 30) < treeChance * 1.5 * (cell / 4) ** 2 && top > -24) {
          addPine(blocks, x + (hash2(k, 33) - 0.5) * (cell - 3), top, z + (hash2(k, 34) - 0.5) * (cell - 3), 0.9 + hash2(k, 35) * 0.5, venue.trees, k)
          trees += 1
        }
        continue
      }
      const d = openDistance(x, z)
      if (d < 2) continue
      // Terraces 4 m apart in height, every ~10 m out, with a little noise so the edges
      // wander; never higher than 44 m.
      const step = Math.min(11, 1 + Math.floor(d / 10 + n * 1.3))
      let h = 4 * step
      if (underBillboard(x, z)) h = Math.min(h, 4)
      const tier = Math.min(look.rock.length - 1, Math.floor((step - 1) / 2))
      blocks.addOn(x, 0, z, cell, h, cell, look.rock[tier], look.styles[tier])
      columns += 1
      // Pines on the lower terraces, near enough to be seen.
      if (d < 64 && tier <= 2 && hash2(k, 30) < treeChance * (cell / 4) ** 2) {
        addPine(blocks, x + (hash2(k, 33) - 0.5) * (cell - 3), h, z + (hash2(k, 34) - 0.5) * (cell - 3), 0.9 + hash2(k, 35) * 0.6, venue.trees, k)
        trees += 1
      }
    }
  }
  // A ring of pines on the grass just outside the plaza's edge (not by the road's mouth).
  const ring = density >= 0.5 ? 8 : 14
  const edgeTree = (x, z, i) => {
    if (density < 0.75 && i % 2) return
    addPine(blocks, x, 0, z, 1 + hash2(i, 77) * 0.35, venue.trees, i + 500)
    trees += 1
  }
  let i = 0
  for (let z = PLAZA.minZ + 10; z < PLAZA.maxZ; z += ring) {
    edgeTree(PLAZA.minX - 2.2, z, i++)
    edgeTree(PLAZA.maxX + 2.2, z, i++)
  }
  for (let x = PLAZA.minX + 2; x < PLAZA.maxX; x += ring) if (!underBillboard(x, PLAZA.maxZ + 2)) edgeTree(x, PLAZA.maxZ + 2.2, i++)
  addBillboard(blocks, venue)
  return { columns, trees }
}
