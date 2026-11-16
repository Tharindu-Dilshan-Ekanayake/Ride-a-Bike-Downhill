import { CylinderGeometry } from 'three'

import { GARAGE, GARAGE_SIGN } from '@shared/world'

import { STYLE } from '../materials'

const TIRE = new CylinderGeometry(1, 1, 1, 12, 1)
const WALL = 5
const THICK = 0.6

/**
 * The GARAGE, on the east side of the path where you see it from spawn: a workshop open
 * to the west, with a lift and a bike stand in the middle, a pegboard of tools, stacks of
 * tyres and a big sign on poles out front. Walking in opens the parts upgrades (ticker.js).
 * Boxes into the lobby's block set, the tyres into its merged props.
 */
export function buildGarage(blocks, props, { venue, detail = true }) {
  const { minX, maxX, minZ, maxZ } = GARAGE
  const midZ = (minZ + maxZ) / 2
  const depth = maxZ - minZ
  const width = maxX - minX
  const wall = venue.snow ? '#9fb7d3' : '#c8553d'
  const trim = venue.snow ? '#e8f4ff' : '#fff1d6'
  const roof = venue.snow ? '#f4f9ff' : '#3a4256'

  // Floor: a grey workshop slab, a yellow line round the lift.
  blocks.addOn((minX + maxX) / 2, 0, midZ, width, 0.12, depth, '#8a93a3', STYLE.PLATE)
  blocks.addOn(minX + width * 0.55, 0.12, midZ, 5.4, 0.04, 5.4, '#ffd23f', STYLE.SMOOTH)
  blocks.addOn(minX + width * 0.55, 0.12, midZ, 5, 0.06, 5, '#5b6272', STYLE.PLATE)
  // Walls: back (east) and the two sides; the west side is open.
  blocks.addOn(maxX - THICK / 2, 0, midZ, THICK, WALL, depth, wall, STYLE.STUDS)
  blocks.addOn((minX + maxX) / 2, 0, minZ + THICK / 2, width, WALL, THICK, wall, STYLE.STUDS)
  blocks.addOn((minX + maxX) / 2, 0, maxZ - THICK / 2, width, WALL, THICK, wall, STYLE.STUDS)
  // Roof with a trim along the front, and a striped awning.
  blocks.addOn((minX + maxX) / 2 + 0.2, WALL, midZ, width + 1.6, 0.6, depth + 1.2, roof, STYLE.STUDS)
  blocks.addOn(minX - 0.2, WALL - 0.4, midZ, 0.5, 0.6, depth + 1.2, trim, STYLE.SMOOTH)
  for (let i = 0; i < 6; i += 1) {
    const z = minZ + 0.5 + (i * (depth - 1)) / 5
    blocks.add(minX - 1.1, WALL - 0.65, z, 1.8, 0.12, (depth - 1) / 5.2, i % 2 ? trim : '#ffd23f', STYLE.SMOOTH, 0, 0, -0.35)
  }
  // The lift: four posts and a raised deck.
  const lx = minX + width * 0.55
  for (const dx of [-2.1, 2.1]) for (const dz of [-2.1, 2.1]) blocks.addOn(lx + dx, 0.18, midZ + dz, 0.35, 2.4, 0.35, '#ffd23f', STYLE.STRIPES)
  blocks.addOn(lx, 1.2, midZ, 4.2, 0.18, 1.2, '#2b3242', STYLE.PLATE)
  // Pegboard and tools on the back wall.
  blocks.addOn(maxX - THICK - 0.06, 1.2, midZ, 0.1, 2.6, depth - 4, '#d9b88a', STYLE.SMOOTH)
  if (detail) {
    const tools = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#9ca3af']
    for (let i = 0; i < 12; i += 1) {
      const z = minZ + 2.6 + (i * (depth - 5.2)) / 11
      blocks.add(maxX - THICK - 0.15, 2.4 - (i % 3) * 0.55, z, 0.12, 0.42, 0.14, tools[i % tools.length], STYLE.SMOOTH)
    }
    // A red tool chest and a workbench.
    blocks.addOn(maxX - 1.6, 0.12, minZ + 1.8, 1.6, 1.4, 1.1, '#dc2626', STYLE.PLATE)
    blocks.addOn(maxX - 1.6, 1.52, minZ + 1.8, 1.7, 0.12, 1.2, '#1f2937', STYLE.SMOOTH)
    blocks.addOn(maxX - 1.7, 0.12, maxZ - 2.2, 1.4, 1.1, 2.6, '#8a5a33', STYLE.SMOOTH)
    // Stacks of tyres by the door.
    for (const [x, z, n] of [
      [minX + 1.4, minZ + 1.6, 4],
      [minX + 1.4, maxZ - 1.6, 3],
      [minX + 2.8, maxZ - 1.5, 2],
    ]) {
      for (let k = 0; k < n; k += 1) {
        props.add(TIRE, { position: [x, 0.25 + k * 0.42, z], scale: [0.62, 0.38, 0.62], color: '#1f2430', style: STYLE.SMOOTH })
        props.add(TIRE, { position: [x, 0.25 + k * 0.42, z], scale: [0.3, 0.4, 0.3], color: '#9aa4b2', style: STYLE.SMOOTH })
      }
    }
  }
  // The sign out front on two poles, turned to face the path and spawn.
  const { x, z, yaw, width: signWidth, top } = GARAGE_SIGN
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  for (const side of [-1, 1]) {
    const px = x + side * (signWidth / 2 - 0.4) * cos
    const pz = z - side * (signWidth / 2 - 0.4) * sin
    blocks.addOn(px, 0, pz, 0.35, top - 1.4, 0.35, '#5b6272', STYLE.SMOOTH)
  }
  blocks.add(x, top - 1.6, z, signWidth, 2.6, 0.4, '#1d2333', STYLE.SMOOTH, yaw)
  blocks.add(x, top - 0.2, z, signWidth + 0.2, 0.25, 0.5, '#ffd23f', STYLE.GLOW, yaw)
  blocks.add(x, top - 3, z, signWidth + 0.2, 0.25, 0.5, '#ffd23f', STYLE.GLOW, yaw)
}
