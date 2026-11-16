import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { at, CURB, EDGE, ROAD_HALF, WALL_X } from '@shared/track'
import { hash2 } from '@shared/rng'

import { PropBuilder, toColor } from '../blocks'
import { STYLE } from '../materials'

/**
 * Geometry for the ride: the road in chunks (asphalt, kerbs, grass shoulders and the
 * green banks rising either side), and the props along it - obstacles, ramps, boost
 * pads, coins, trees, rocks and the arches. Everything is vertex-coloured with a toy
 * style per vertex, drawn through the one shared toy material.
 */

/** Each world's colours on the road. */
export const RIDE_THEMES = {
  pine: {
    road: '#3f4656',
    line: '#ffd23f',
    curbA: '#ef4444',
    curbB: '#f8fafc',
    shoulder: '#53d84a',
    bank: ['#41c94f', '#4dd35a', '#38bd48'],
    far: '#2f9e48',
    trunk: '#7a4b2a',
    leaves: ['#1f8f3a', '#22a046', '#18803a'],
    snowCap: null,
    rock: '#8d96a3',
    arch: '#ffd21f',
    archBase: '#1f4fd8',
    fog: '#cdeaff',
    sky: '#7cc6ff',
  },
  frost: {
    road: '#465063',
    line: '#7dd3fc',
    curbA: '#38bdf8',
    curbB: '#f8fafc',
    shoulder: '#e7f3ff',
    bank: ['#f3f8ff', '#e6f0fb', '#dbe8f7'],
    far: '#cfdff0',
    trunk: '#6b4a32',
    leaves: ['#1d6b45', '#21794d', '#185d3c'],
    snowCap: '#ffffff',
    rock: '#9aa7b8',
    arch: '#7dd3fc',
    archBase: '#1e3a8a',
    fog: '#e3f0ff',
    sky: '#9fd2ff',
  },
}

/** Metres per row of road geometry, and rows per chunk. */
export const ROW = 2
export const CHUNK_ROWS = 40
export const CHUNK_LENGTH = ROW * CHUNK_ROWS

/** Height of the banks at `x` beyond the shoulder, with some lumpiness. */
function bankHeight(m, x, seed) {
  const ax = Math.abs(x)
  const side = x < 0 ? 1 : 2
  const n = hash2(Math.floor(m / 24), side, seed) * 0.6 + hash2(Math.floor(m / 9), side + 7, seed) * 0.4
  if (ax <= WALL_X) return 0
  if (ax <= WALL_X + 2) return ((ax - WALL_X) / 2) * 1.4
  if (ax <= 34) return 1.4 + ((ax - WALL_X - 2) / (34 - WALL_X - 2)) * (6 + 5 * n)
  return 7.4 + 5 * n + ((ax - 34) / 36) * (10 + 14 * n)
}
export const bankHeightAt = bankHeight

/** Builds a strip of quads between columns, row by row, into the arrays. */
class StripBuilder {
  constructor() {
    this.pos = []
    this.col = []
    this.sty = []
    this.idx = []
  }

  vertex(x, y, z, color, style) {
    const c = toColor(color)
    this.pos.push(x, y, z)
    this.col.push(c.r, c.g, c.b)
    this.sty.push(style)
    return this.pos.length / 3 - 1
  }

  quad(a, b, c, d) {
    // a-b along the row, c-d the next row.
    this.idx.push(a, b, c, b, d, c)
  }

  build() {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3))
    g.setAttribute('aStyle', new BufferAttribute(new Float32Array(this.sty), 1))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
}

/** World point of road point (m, x, h) without allocating: writes `out`. */
function point(track, m, x, h, out) {
  const head = at(track.head, m)
  out[0] = at(track.px, m) + Math.cos(head) * x
  out[1] = at(track.py, m) + h
  out[2] = at(track.pz, m) + Math.sin(head) * x
  return out
}
const _v = [0, 0, 0]

/**
 * The road's geometry for chunk `index` (CHUNK_LENGTH metres from index * CHUNK_LENGTH):
 * asphalt with a dashed centre line, red-and-white kerbs, grass shoulders and banks.
 */
export function buildRoadChunk(track, index, theme, seed) {
  const sb = new StripBuilder()
  const m0 = index * CHUNK_LENGTH
  const rows = []
  for (let r = 0; r <= CHUNK_ROWS; r += 1) {
    const m = Math.min(track.length + 40, m0 + r * ROW)
    rows.push(m)
    if (m >= track.length + 40) break
  }
  const strip = (columns) => {
    // columns: [{ x, h(m) , color(m, r), style }]
    const ids = []
    for (let r = 0; r < rows.length; r += 1) {
      const m = rows[r]
      const row = []
      for (const c of columns) {
        const x = c.x
        const h = typeof c.h === 'function' ? c.h(m) : c.h
        point(track, m, x, h, _v)
        row.push(sb.vertex(_v[0], _v[1], _v[2], typeof c.color === 'function' ? c.color(m, r) : c.color, c.style))
      }
      ids.push(row)
    }
    for (let r = 0; r + 1 < ids.length; r += 1) {
      for (let c = 0; c + 1 < columns.length; c += 1) sb.quad(ids[r][c], ids[r][c + 1], ids[r + 1][c], ids[r + 1][c + 1])
    }
  }
  const bankColor = (m) => theme.bank[Math.floor(hash2(Math.floor(m / 8), 3, seed) * theme.bank.length)]
  // Asphalt.
  strip([
    { x: -ROAD_HALF, h: 0, color: theme.road, style: STYLE.ROAD },
    { x: ROAD_HALF, h: 0, color: theme.road, style: STYLE.ROAD },
  ])
  // Shoulders and banks, each side (left goes outwards to -x).
  for (const side of [-1, 1]) {
    const cols = [
      { x: side * EDGE, h: 0, color: theme.shoulder, style: STYLE.STUDS },
      { x: side * WALL_X, h: 0, color: theme.shoulder, style: STYLE.STUDS },
    ]
    strip(side < 0 ? cols.reverse() : cols)
    const bank = [WALL_X, WALL_X + 2, 22, 34, 52, 72].map((ax, i) => ({
      x: side * ax,
      h: (m) => bankHeight(m, side * ax, seed),
      color: i >= 4 ? theme.far : bankColor,
      style: STYLE.STUDS,
    }))
    strip(side < 0 ? bank.reverse() : bank)
  }
  // Kerbs (alternating per 2 m) and the dashed centre line: quads of their own.
  for (let r = 0; r + 1 < rows.length; r += 1) {
    const ma = rows[r]
    const mb = rows[r + 1]
    const curb = Math.floor(ma / ROW) % 2 === 0 ? theme.curbA : theme.curbB
    for (const side of [-1, 1]) {
      const xs = side < 0 ? [-EDGE, -ROAD_HALF] : [ROAD_HALF, EDGE]
      const a = sb.vertex(...point(track, ma, xs[0], 0.06, _v), curb, STYLE.SMOOTH)
      const b = sb.vertex(...point(track, ma, xs[1], 0.06, _v), curb, STYLE.SMOOTH)
      const c = sb.vertex(...point(track, mb, xs[0], 0.06, _v), curb, STYLE.SMOOTH)
      const d = sb.vertex(...point(track, mb, xs[1], 0.06, _v), curb, STYLE.SMOOTH)
      sb.quad(a, b, c, d)
    }
    if (Math.floor(ma / 6) % 2 === 0) {
      const a = sb.vertex(...point(track, ma, -0.16, 0.025, _v), theme.line, STYLE.SMOOTH)
      const b = sb.vertex(...point(track, ma, 0.16, 0.025, _v), theme.line, STYLE.SMOOTH)
      const c = sb.vertex(...point(track, mb, -0.16, 0.025, _v), theme.line, STYLE.SMOOTH)
      const d = sb.vertex(...point(track, mb, 0.16, 0.025, _v), theme.line, STYLE.SMOOTH)
      sb.quad(a, b, c, d)
    }
  }
  return sb.build()
}

export const chunkCount = (track) => Math.ceil((track.length + 40) / CHUNK_LENGTH)

// --- Props ------------------------------------------------------------------------------

const CYL = new CylinderGeometry(1, 1, 1, 12, 1)
const CYL_LOW = new CylinderGeometry(1, 1, 1, 8, 1)
const CONE = new ConeGeometry(1, 1, 10, 1)
const BALL = new SphereGeometry(1, 10, 7)
const ROCK = new IcosahedronGeometry(1, 0)

/** One geometry per obstacle kind, footprint as in track OBSTACLES, origin on the road. */
export function buildObstacle(kind, theme) {
  const pb = new PropBuilder()
  switch (kind) {
    case 'crate':
      pb.box(0, 0.7, 0, 1.4, 1.4, 1.4, '#c98b4b', STYLE.SMOOTH)
      for (const y of [0.12, 1.28]) pb.box(0, y, 0, 1.46, 0.16, 1.46, '#8a5a2b', STYLE.SMOOTH)
      pb.box(0, 0.7, 0, 1.46, 0.16, 1.46, '#a8713c', STYLE.SMOOTH, [0, 0, Math.PI / 4])
      break
    case 'cone':
      pb.add(CONE, { position: [0, 0.42, 0], scale: [0.32, 0.8, 0.32], color: '#ff7a1a', style: STYLE.SMOOTH })
      pb.add(CYL_LOW, { position: [0, 0.42, 0], scale: [0.22, 0.14, 0.22], color: '#ffffff', style: STYLE.SMOOTH })
      pb.box(0, 0.03, 0, 0.7, 0.06, 0.7, '#ff7a1a', STYLE.SMOOTH)
      break
    case 'barrel':
      pb.add(CYL, { position: [0, 0.55, 0], scale: [0.55, 1.1, 0.55], color: '#d9482b', style: STYLE.SMOOTH })
      for (const y of [0.25, 0.85]) pb.add(CYL, { position: [0, y, 0], scale: [0.57, 0.08, 0.57], color: '#5b616e', style: STYLE.SMOOTH })
      pb.add(CYL, { position: [0, 1.1, 0], scale: [0.45, 0.02, 0.45], color: '#ffd23f', style: STYLE.SMOOTH })
      break
    case 'hay':
      pb.add(CYL, { position: [0, 0.62, 0], rotation: [0, 0, Math.PI / 2], scale: [0.62, 2.5, 0.62], color: '#e9c25a', style: STYLE.STRIPES })
      pb.add(CYL, { position: [0, 0.62, 0], rotation: [0, 0, Math.PI / 2], scale: [0.5, 2.54, 0.5], color: '#d9a93c', style: STYLE.SMOOTH })
      break
    case 'rock':
      pb.add(ROCK, { position: [0, 0.55, 0], scale: [1.15, 0.85, 1.05], color: theme.rock, style: STYLE.SMOOTH })
      pb.add(ROCK, { position: [0.5, 0.35, 0.4], scale: [0.55, 0.45, 0.5], color: theme.rock, style: STYLE.SMOOTH })
      if (theme.snowCap) pb.add(ROCK, { position: [0, 1.05, 0], scale: [0.75, 0.3, 0.7], color: theme.snowCap, style: STYLE.SMOOTH })
      break
    case 'log':
      pb.add(CYL, { position: [0, 0.32, 0], rotation: [0, 0, Math.PI / 2], scale: [0.32, EDGE * 2, 0.32], color: '#8a5a33', style: STYLE.SMOOTH })
      for (const x of [-EDGE, EDGE]) pb.add(CYL, { position: [x, 0.32, 0], rotation: [0, 0, Math.PI / 2], scale: [0.27, 0.04, 0.27], color: '#d9b07a', style: STYLE.SMOOTH })
      break
    case 'car':
      // White body (the instance colour paints it), dark glass and tyres.
      pb.box(0, 0.6, 0, 2, 0.7, 4.4, '#ffffff', STYLE.SMOOTH)
      pb.box(0, 1.2, -0.3, 1.8, 0.6, 2.2, '#ffffff', STYLE.SMOOTH)
      pb.box(0, 1.2, -0.3, 1.84, 0.42, 2.0, '#26324a', STYLE.SMOOTH)
      for (const [x, z] of [
        [-0.9, 1.4],
        [0.9, 1.4],
        [-0.9, -1.4],
        [0.9, -1.4],
      ]) {
        pb.add(CYL_LOW, { position: [x, 0.36, z], rotation: [0, 0, Math.PI / 2], scale: [0.36, 0.3, 0.36], color: '#1f2430', style: STYLE.SMOOTH })
      }
      pb.box(0, 0.7, 2.21, 1.6, 0.18, 0.04, '#fff6c2', STYLE.GLOW)
      break
    case 'snowman':
      pb.add(BALL, { position: [0, 0.5, 0], scale: 0.6, color: '#ffffff', style: STYLE.SMOOTH })
      pb.add(BALL, { position: [0, 1.15, 0], scale: 0.42, color: '#ffffff', style: STYLE.SMOOTH })
      pb.add(BALL, { position: [0, 1.6, 0], scale: 0.28, color: '#ffffff', style: STYLE.SMOOTH })
      pb.add(CONE, { position: [0, 1.6, 0.32], rotation: [Math.PI / 2, 0, 0], scale: [0.06, 0.26, 0.06], color: '#ff7a1a', style: STYLE.SMOOTH })
      pb.add(CYL, { position: [0, 1.88, 0], scale: [0.2, 0.25, 0.2], color: '#1f2430', style: STYLE.SMOOTH })
      break
    case 'iceblock':
      pb.box(0, 0.6, 0, 1.8, 1.2, 1.8, '#a5e8ff', STYLE.SMOOTH)
      pb.box(0, 0.6, 0, 1.6, 1.24, 1.6, '#d6f6ff', STYLE.SMOOTH)
      break
    case 'ice':
      pb.box(0, 0.04, 0, 6, 0.04, 18, '#cdeeff', STYLE.SMOOTH)
      break
    default:
      pb.box(0, 0.5, 0, 1, 1, 1, '#ff00ff', STYLE.SMOOTH)
  }
  return pb.build()
}

/** A unit ramp: rises from z = 0 to z = 1, 1 high, 1 wide (scaled per ramp). */
export function buildRamp() {
  const pb = new PropBuilder()
  const g = new BufferGeometry()
  // A wedge: base rectangle, top sloping to a vertical back face.
  const p = [
    // bottom
    -0.5, 0, 0, 0.5, 0, 0, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1,
    // slope
    -0.5, 0, 0, -0.5, 1, 1, 0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 1, 0.5, 1, 1,
    // back
    -0.5, 0, 1, 0.5, 0, 1, -0.5, 1, 1, 0.5, 0, 1, 0.5, 1, 1, -0.5, 1, 1,
    // sides
    -0.5, 0, 0, -0.5, 0, 1, -0.5, 1, 1, 0.5, 0, 0, 0.5, 1, 1, 0.5, 0, 1,
  ]
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
  g.computeVertexNormals()
  pb.add(g, { color: '#ffb020', style: STYLE.PLATE })
  // Stripes on the lip.
  pb.box(0, 0.98, 0.985, 1.02, 0.05, 0.04, '#1f2430', STYLE.SMOOTH)
  return pb.build()
}

/** A boost pad: a flat glowing plate with chevrons, 1 x 1 (scaled per pad). */
export function buildPad() {
  const pb = new PropBuilder()
  pb.box(0, 0.03, 0, 1, 0.05, 1, '#1d4ed8', STYLE.SMOOTH)
  for (let i = 0; i < 3; i += 1) {
    const z = -0.3 + i * 0.3
    pb.box(-0.18, 0.065, z, 0.42, 0.03, 0.08, '#7df9ff', STYLE.GLOW, [0, Math.PI / 4, 0])
    pb.box(0.18, 0.065, z, 0.42, 0.03, 0.08, '#7df9ff', STYLE.GLOW, [0, -Math.PI / 4, 0])
  }
  return pb.build()
}

/** A coin, standing on its edge, facing along Z (spun about Y as it floats). */
export function buildCoin() {
  const pb = new PropBuilder()
  pb.add(CYL, { rotation: [Math.PI / 2, 0, 0], scale: [0.55, 0.12, 0.55], color: '#ffc61a', style: STYLE.GLOW })
  pb.add(new TorusGeometry(0.5, 0.06, 4, 16), { color: '#ffe36b', style: STYLE.GLOW })
  pb.box(0, 0, 0, 0.16, 0.5, 0.16, '#ffae00', STYLE.GLOW)
  return pb.build()
}

/** A pine tree (snow-capped in the frost world), origin at its foot, about 6 m tall. */
export function buildTree(theme, variant = 0) {
  const pb = new PropBuilder()
  pb.add(CYL_LOW, { position: [0, 0.9, 0], scale: [0.3, 1.8, 0.3], color: theme.trunk, style: STYLE.SMOOTH })
  const leaves = theme.leaves[variant % theme.leaves.length]
  const tiers = [
    [2.0, 2.3, 2.6],
    [3.3, 1.8, 2.2],
    [4.5, 1.25, 1.9],
  ]
  for (const [y, r, h] of tiers) {
    pb.add(CONE, { position: [0, y, 0], scale: [r, h, r], color: leaves, style: STYLE.SMOOTH })
    if (theme.snowCap) pb.add(CONE, { position: [0, y + h * 0.28, 0], scale: [r * 0.55, h * 0.45, r * 0.55], color: theme.snowCap, style: STYLE.SMOOTH })
  }
  return pb.build()
}

/** A boulder for the banks. */
export function buildBoulder(theme) {
  const pb = new PropBuilder()
  pb.add(ROCK, { position: [0, 0.6, 0], scale: [1.4, 1.1, 1.2], color: theme.rock, style: STYLE.SMOOTH })
  if (theme.snowCap) pb.add(ROCK, { position: [0, 1.25, 0], scale: [0.9, 0.35, 0.8], color: theme.snowCap, style: STYLE.SMOOTH })
  return pb.build()
}

/**
 * An arch over the road: two pillars and a beam, `width` across. `finish` gets a
 * chequered beam.
 */
export function buildArch(theme, finish = false) {
  const pb = new PropBuilder()
  const w = WALL_X + 1.5
  for (const x of [-w, w]) {
    pb.box(x, 3.5, 0, 1.4, 7, 1.4, theme.arch, STYLE.STRIPES)
    pb.box(x, 0.3, 0, 2, 0.6, 2, theme.archBase, STYLE.SMOOTH)
  }
  if (finish) {
    const cells = 14
    for (let i = 0; i < cells; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = -w + ((i + 0.5) * (w * 2)) / cells
        pb.box(x, 6.6 + j * 0.7, 0, (w * 2) / cells, 0.7, 0.6, (i + j) % 2 ? '#111827' : '#ffffff', STYLE.SMOOTH)
      }
    }
  } else {
    pb.box(0, 7, 0, w * 2 + 1.4, 1.2, 1, theme.archBase, STYLE.SMOOTH)
    pb.box(0, 7, 0.52, w * 2 - 1, 0.6, 0.06, theme.arch, STYLE.GLOW)
  }
  return pb.build()
}

/** Kept so CURB stays meaningful to readers of this file: the kerb's width. */
export const KERB = CURB
