import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Euler,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { GARAGE_SIGN, SHOP_SIGN } from '@shared/world'

import { venueOf } from '../sceneStyle'
import { SHOP_SIGN_FACING } from './shop'
import { ARCH_SIGN } from './startGate'

const FONT = '"Fredoka One", "Arial Rounded MT Bold", sans-serif'

const GOLD = ['#fffbd0', '#ffd21f', '#ff8a00']
const ICE = ['#ffffff', '#bfeaff', '#4fb8ff']
const WHITE = ['#ffffff', '#ffffff', '#e6ecf5']

/** Painted decals lie this far over the ground (clear of it: no z-fighting). */
const DECAL_Y = 0.04

/**
 * Big chunky lettering painted into one rectangle `[rx, ry, rw, rh]` of the shared atlas,
 * slanted by shear (the font has no italic face): a solid extruded edge in `edge` under a
 * thick dark outline, the face filled with a top-to-bottom gradient of `fill` stops, and a
 * glossy band across the top of each letter. Clipped to its own rectangle, so signs
 * can't spill into each other.
 */
function paintText(ctx, rect, text, { fill, edge, slant = 0.22, outline = '#10142a' }) {
  const [rx, ry, rw, rh] = rect
  ctx.save()
  ctx.beginPath()
  ctx.rect(rx, ry, rw, rh)
  ctx.clip()
  ctx.font = `100px ${FONT}`
  const size = Math.min(rh * 0.7, (100 * rw * 0.95) / (ctx.measureText(text).width * (1 + slant * 0.5)))
  const x = rw / 2
  const y = rh * 0.46
  const depth = size * 0.1
  ctx.font = `${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.setTransform(1, 0, -slant, 1, rx + rh * slant * 0.55, ry)

  ctx.lineWidth = size * 0.22
  ctx.strokeStyle = outline
  ctx.fillStyle = edge
  for (let i = depth; i > 0; i -= Math.max(1, depth / 8)) {
    ctx.strokeText(text, x, y + i)
    ctx.fillText(text, x, y + i)
  }
  ctx.strokeText(text, x, y)
  const gradient = ctx.createLinearGradient(0, y - size * 0.45, 0, y + size * 0.45)
  fill.forEach((stop, i) => gradient.addColorStop(i / (fill.length - 1), stop))
  ctx.fillStyle = gradient
  ctx.fillText(text, x, y)
  ctx.globalCompositeOperation = 'source-atop'
  const gloss = ctx.createLinearGradient(0, y - size * 0.45, 0, y)
  gloss.addColorStop(0, 'rgba(255,255,255,0.55)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.fillRect(-rw, y - size * 0.45, rw * 3, size * 0.4)
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

/** White stencil lettering on the ground with an arrow either side pointing up the image. */
function paintStencil(ctx, rect, text) {
  const [rx, ry, rw, rh] = rect
  const pad = rh * 0.95
  paintText(ctx, [rx + pad, ry, rw - pad * 2, rh], text, { fill: WHITE, edge: '#9fb0c8', slant: 0, outline: '#1d2333' })
  for (const cx of [rx + pad / 2, rx + rw - pad / 2]) {
    ctx.save()
    ctx.translate(cx, ry + rh / 2)
    const a = rh * 0.32
    ctx.beginPath()
    ctx.moveTo(0, -a)
    ctx.lineTo(a * 0.95, a * 0.7)
    ctx.lineTo(-a * 0.95, a * 0.7)
    ctx.closePath()
    ctx.lineJoin = 'round'
    ctx.lineWidth = rh * 0.08
    ctx.strokeStyle = '#1d2333'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()
  }
}

const _q = new Quaternion()
const _qFlat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
const _e = new Euler()
const _v = new Vector3()
const _at = new Vector3()

/** The atlas's cells, as fractions of its size: [x, y, w, h], and how each is painted. */
const cellsFor = (v) => ({
  start: { rect: [0, 0, 1, 0.22], paint: (ctx, r) => paintText(ctx, r, 'START', { fill: v.snow ? ICE : GOLD, edge: v.snow ? '#1f5f9a' : '#c2410c', slant: 0.14 }) },
  shop: { rect: [0, 0.22, 1, 0.18], paint: (ctx, r) => paintText(ctx, r, 'BIKE SHOP', { fill: v.snow ? ICE : GOLD, edge: v.snow ? '#1f5f9a' : '#c2410c', slant: 0.14 }) },
  title: { rect: [0, 0.4, 1, 0.2], paint: (ctx, r) => paintText(ctx, r, 'BIKE HILL RUSH', { fill: GOLD, edge: '#b45309', slant: 0.12 }) },
  dir: { rect: [0, 0.6, 1, 0.14], paint: (ctx, r) => paintStencil(ctx, r, 'TO THE START') },
  garage: { rect: [0, 0.74, 1, 0.2], paint: (ctx, r) => paintText(ctx, r, 'GARAGE', { fill: v.snow ? ICE : GOLD, edge: v.snow ? '#1f5f9a' : '#c2410c', slant: 0.14 }) },
})

/**
 * Every quad: which cell it shows, its width in the world (its height follows the cell's
 * shape), its centre, its turn about the vertical, and whether it lies flat on the ground
 * (north up on screen at yaw 0, so it reads from the south, the way you walk to the gate).
 */
function quadList() {
  const f = SHOP_SIGN_FACING
  return [
    { cell: 'start', width: ARCH_SIGN.width - 0.3, at: [0, ARCH_SIGN.y, ARCH_SIGN.faceZ + 0.04], yaw: 0, flat: false },
    {
      cell: 'shop',
      width: SHOP_SIGN.maxZ - SHOP_SIGN.minZ - 3,
      // On the sign's face (0.4 plaza-side of its centre line), turned to the plaza.
      at: [SHOP_SIGN.x + 0.44 * f, SHOP_SIGN.top - 3.8, (SHOP_SIGN.minZ + SHOP_SIGN.maxZ) / 2],
      yaw: (f * Math.PI) / 2,
      flat: false,
    },
    { cell: 'title', width: 9.4, at: [0, DECAL_Y, 30], yaw: 0, flat: true },
    { cell: 'dir', width: 9.4, at: [0, DECAL_Y, 6], yaw: 0, flat: true },
    {
      cell: 'garage',
      width: GARAGE_SIGN.width - 0.5,
      at: [GARAGE_SIGN.x + Math.sin(GARAGE_SIGN.yaw) * 0.23, GARAGE_SIGN.top - 1.6, GARAGE_SIGN.z + Math.cos(GARAGE_SIGN.yaw) * 0.23],
      yaw: GARAGE_SIGN.yaw,
      flat: false,
    },
  ]
}

/**
 * The painted signs, drawn once the font has loaded: START on the gate's arch, BIKE SHOP
 * on the shop's sign, and on the path the game's name and a TO THE START stencil. All of
 * them share ONE square atlas texture (at most the preset's texture size) and are merged
 * into ONE mesh: a single draw call. Flat ones lie 4 cm over the ground, and the material
 * is pulled towards the camera in depth (polygon offset) - no z-fighting.
 *
 * @param {number} maxTexture texture size cap for the preset
 * @param {number} [world] the world whose venue it's lettered for
 * @returns {Promise<Array<{ geometry, material, texture, position: number[], rotation: number[] }>>}
 */
export async function createPaintedSigns(maxTexture, world = 0) {
  const CELLS = cellsFor(venueOf(world))
  await document.fonts?.load(`64px ${FONT}`).catch(() => null)

  const size = Math.min(1024, maxTexture)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const px = (rect) => rect.map((v) => Math.round(v * size))
  for (const cell of Object.values(CELLS)) cell.paint(ctx, px(cell.rect))

  const positions = []
  const uvs = []
  const indices = []
  const vertex = (quad, rect, height, cx, cy) => {
    const [rx, ry, rw, rh] = rect
    _v.set(cx * quad.width, cy * height, 0).applyQuaternion(_q).add(_at)
    positions.push(_v.x, _v.y, _v.z)
    uvs.push((rx + (cx + 0.5) * rw) / size, 1 - (ry + (0.5 - cy) * rh) / size)
    return positions.length / 3 - 1
  }
  for (const quad of quadList()) {
    const rect = px(CELLS[quad.cell].rect)
    const height = quad.width * (rect[3] / rect[2])
    _q.setFromEuler(_e.set(0, quad.yaw, 0))
    if (quad.flat) _q.multiply(_qFlat)
    _at.fromArray(quad.at)
    const o = vertex(quad, rect, height, -0.5, -0.5)
    vertex(quad, rect, height, 0.5, -0.5)
    vertex(quad, rect, height, 0.5, 0.5)
    vertex(quad, rect, height, -0.5, 0.5)
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = size > 512 ? 4 : 1
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()

  return [{ geometry, material, texture, position: [0, 0, 0], rotation: [0, 0, 0] }]
}
