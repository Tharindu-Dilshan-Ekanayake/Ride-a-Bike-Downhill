import { CylinderGeometry, SphereGeometry } from 'three'

import { PLAZA, RIDE_ZONE, START_ARCH, TRACK_START } from '@shared/world'

import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'
import { APRON } from './ground'

const DISC = new CylinderGeometry(1, 1, 1, 24)
const BALL = new SphereGeometry(1, 12, 8)

/** Height of the arch's beam, and the sign hung on its south face. */
const ARCH_TOP = 10.5
export const ARCH_SIGN = { width: 11, height: 3, y: ARCH_TOP - 1.7, faceZ: START_ARCH.z + 1.05 }

/** The start line: a checkered strip across the apron just short of the plaza's edge. */
export const START_LINE_Z = TRACK_START.z + 1.4

/**
 * The START gate where every ride begins: the asphalt apron (painted into the ground map,
 * ground.js) with a checkered start line and white chevrons pointing down the road, a big
 * striped arch over it with a START sign facing the plaza (lettering: signs.js), a set of
 * race lights on the beam and a chequered flag either side; and along the plaza's north
 * edge, either side of the road's mouth, a low wooden fence with flags where the mountain
 * drops away. In the venue's colours.
 *
 * Boxes go into the world's block set and the round parts into its props, so the whole
 * thing rides in those two draw calls. `detail` (off on LOW) adds the bulbs and flags.
 * No two faces share a plane (flush faces flicker, worst on phones' coarser depth buffers).
 */
export function buildStartGate(blocks, props, { detail = true, venue }) {
  const c = venue.arch
  const midX = (APRON.minX + APRON.maxX) / 2
  const width = APRON.maxX - APRON.minX

  // The start line: two rows of checks lying on the apron.
  const checks = Math.round(width / 0.9)
  for (let i = 0; i < checks; i += 1) {
    for (let row = 0; row < 2; row += 1) {
      const x = APRON.minX + (i + 0.5) * (width / checks)
      blocks.addOn(x, 0, START_LINE_Z + (row - 0.5) * 0.9, width / checks, 0.04, 0.9, PALETTE.checker[(i + row) % 2], STYLE.SMOOTH)
    }
  }
  // Chevrons on the apron, pointing down the road (north).
  for (let z = RIDE_ZONE.maxZ - 1.5; z > START_LINE_Z + 2; z -= 2.6) {
    for (const side of [-1, 1]) blocks.add(midX + side * 0.75, 0.06, z, 2.2, 0.04, 0.45, PALETTE.line, STYLE.GLOW, -side * 0.75)
  }
  // The apron's white kerbs, either side.
  for (const side of [-1, 1]) blocks.addOn(midX + side * (width / 2 + 0.2), 0, (APRON.minZ + APRON.maxZ) / 2, 0.6, 0.14, APRON.maxZ - APRON.minZ, '#ffffff', STYLE.STRIPES)

  // The arch: striped pillars on navy feet, a beam carrying the sign, a glowing crest.
  const archZ = START_ARCH.z
  const span = START_ARCH.x * 2
  for (const side of [-1, 1]) {
    const x = side * START_ARCH.x
    blocks.addOn(x, 0, archZ, 2.2, 0.8, 2.2, c.base)
    blocks.addOn(x, 0.8, archZ, 1.6, ARCH_TOP - 0.8, 1.6, c.pillar, STYLE.STRIPES)
    props.add(BALL, { position: [x, ARCH_TOP + 2.3, archZ], scale: 0.95, color: c.crest, style: STYLE.GLOW })
    if (detail) {
      for (let y = 1.8; y < ARCH_TOP - 0.6; y += 1.1) blocks.add(x, y, archZ + 0.88, 0.3, 0.3, 0.16, Math.round(y) % 2 ? '#ffffff' : c.crest, STYLE.GLOW)
      // A chequered flag on a pole beside each pillar, flying outwards.
      const fx = x + side * 2.2
      blocks.addOn(fx, 0, archZ, 0.22, 7.5, 0.22, PALETTE.steel, STYLE.SMOOTH)
      for (let col = 0; col < 4; col += 1) {
        for (let row = 0; row < 3; row += 1) {
          blocks.add(fx + side * (0.45 + col * 0.5), 7.0 - row * 0.5, archZ, 0.5, 0.5, 0.06, PALETTE.checker[(col + row) % 2], STYLE.SMOOTH)
        }
      }
    }
  }
  blocks.addOn(0, ARCH_TOP - 0.2, archZ, span + 1, 1.5, 1.3, c.pillar, STYLE.STRIPES)
  blocks.addOn(0, ARCH_TOP - 0.45, archZ, span - 1.4, 0.25, 1.4, c.glow, STYLE.GLOW)
  // The sign: a crest-coloured frame round a dark panel, the lettering painted on.
  blocks.addOn(0, ARCH_SIGN.y - ARCH_SIGN.height / 2 - 0.15, archZ + 0.75, ARCH_SIGN.width + 0.6, ARCH_SIGN.height + 0.3, 0.3, c.crest)
  blocks.addOn(0, ARCH_SIGN.y - ARCH_SIGN.height / 2, archZ + 0.8, ARCH_SIGN.width, ARCH_SIGN.height, 0.3, c.base, STYLE.SMOOTH)
  // Race lights on top of the beam: red, amber, green.
  blocks.addOn(0, ARCH_TOP + 1.3, archZ, 5.4, 1.6, 1.1, '#1d2333', STYLE.SMOOTH)
  ;['#ff3b3b', '#ffb21e', '#3fdc4a'].forEach((color, i) => {
    props.add(DISC, { position: [(i - 1) * 1.6, ARCH_TOP + 2.1, archZ + 0.6], rotation: [Math.PI / 2, 0, 0], scale: [0.55, 0.12, 0.55], color, style: STYLE.GLOW })
  })
  if (detail) {
    for (let x = -START_ARCH.x + 1.5; x <= START_ARCH.x - 1.49; x += 1) {
      if (Math.abs(x) < ARCH_SIGN.width / 2 + 0.7) continue
      blocks.add(x, ARCH_TOP + 0.62, archZ + 0.73, 0.3, 0.3, 0.16, Math.round(x) % 2 ? c.crest : '#ffffff', STYLE.GLOW)
    }
  }

  // The fence along the plaza's north edge, either side of the road's mouth: posts and two
  // rails, a flag on every few posts. (Just inside the plaza: the road's corridor stays clear.)
  const fenceZ = PLAZA.minZ + 0.45
  for (const side of [-1, 1]) {
    const from = START_ARCH.x + 1.3
    const to = side < 0 ? -PLAZA.minX : PLAZA.maxX
    let n = 0
    for (let ax = from; ax <= to + 0.01; ax += 3, n += 1) {
      const x = side * ax
      blocks.addOn(x, 0, fenceZ, 0.32, 1.25, 0.32, PALETTE.woodDark, STYLE.SMOOTH)
      if (detail && n % 3 === 1) {
        blocks.addOn(x, 1.25, fenceZ, 0.12, 2.6, 0.12, PALETTE.steel, STYLE.SMOOTH)
        blocks.add(x + side * 0.65, 3.4, fenceZ, 1.2, 0.75, 0.06, venue.flags[n % venue.flags.length], STYLE.SMOOTH)
      }
    }
    const len = to - from
    for (const y of [0.45, 0.95]) blocks.add(side * (from + len / 2), y, fenceZ, len, 0.16, 0.12, PALETTE.wood, STYLE.SMOOTH)
  }
}
