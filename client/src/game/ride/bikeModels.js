import { BoxGeometry, CylinderGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { BIKES } from '@shared/balance'

import { PropBuilder } from '../blocks'
import { STYLE } from '../materials'

/**
 * The bikes, built from primitives into vertex-coloured geometry for the shared toy
 * material (so every bike, in the shop or on the road, shares its one shader program).
 *
 * Every model keeps the same contact points (BIKE_FRAME) - saddle, bars, pedals - so the
 * rider's pose fits them all; they differ in wheels, tubes, paint and extras (a basket,
 * suspension, a battery, rockets).
 *
 * Bike space: forward +Z, up +Y, the ground at y = 0, the middle between the axles at
 * z = 0. (The avatar faces +Z too.)
 *
 * Geometries are built once per bike and cached for the whole session (module-level,
 * shared by every user); never dispose them from a component.
 */

/** Where the rider meets the bike, in bike space (metres). */
export const BIKE_FRAME = {
  saddle: { y: 0.98, z: -0.27 },
  bar: { y: 1.14, z: 0.4, half: 0.3 },
  bb: { y: 0.3, z: -0.04 },
  crank: 0.17,
  axleZ: 0.56,
}

const TIRE = '#1f2430'
const RIM = '#cfd6df'
const STEEL = '#8f9aa8'
const SEAT = '#2b2f3a'

/** How each model differs. */
const MODELS = {
  cruiser: { r: 0.36, tire: 0.055, step: true, basket: true, fenders: true, bar: 'swept' },
  city: { r: 0.36, tire: 0.045, step: true, rack: true, fenders: true, bar: 'swept' },
  bmx: { r: 0.29, tire: 0.06, pegs: true, bar: 'riser' },
  road: { r: 0.36, tire: 0.028, bar: 'drop' },
  mtb: { r: 0.37, tire: 0.065, fork: 'susp', bar: 'flat' },
  fat: { r: 0.38, tire: 0.11, fork: 'rigidFat', bar: 'flat' },
  dh: { r: 0.37, tire: 0.07, fork: 'triple', shock: true, bar: 'riser' },
  ebike: { r: 0.36, tire: 0.05, battery: true, light: true, bar: 'flat', motor: true },
  jet: { r: 0.36, tire: 0.06, rockets: true, glowRim: true, bar: 'drop' },
}

const _a = new Vector3()
const _b = new Vector3()
const _dir = new Vector3()
const _up = new Vector3(0, 1, 0)
const _q = new Quaternion()
const _m = new Matrix4()
const _s = new Vector3()

const CYL = new CylinderGeometry(1, 1, 1, 6, 1)
const BOX = new BoxGeometry(1, 1, 1)
const BALL = new SphereGeometry(1, 6, 5)

/** A tube of `radius` from point a to point b (arrays [x, y, z]). */
function tube(pb, a, b, radius, color, style = STYLE.SMOOTH) {
  _a.fromArray(a)
  _b.fromArray(b)
  _dir.subVectors(_b, _a)
  const len = _dir.length()
  if (len < 1e-4) return
  _q.setFromUnitVectors(_up, _dir.normalize())
  _m.compose(_a.add(_b).multiplyScalar(0.5), _q, _s.set(radius, len, radius))
  pb.transform = _m
  pb.add(CYL, { color, style })
  pb.transform = null
}

const box = (pb, x, y, z, sx, sy, sz, color, style = STYLE.SMOOTH, rotation = [0, 0, 0]) =>
  pb.add(BOX, { position: [x, y, z], scale: [sx, sy, sz], color, style, rotation })
const ball = (pb, x, y, z, r, color, style = STYLE.SMOOTH) => pb.add(BALL, { position: [x, y, z], scale: r, color, style })

/** One wheel, centred on its axle, spinning about X. */
function buildWheel(model, bike) {
  const pb = new PropBuilder()
  const { r, tire } = model
  // Tyre and rim: tori turned to stand in the YZ plane.
  pb.add(new TorusGeometry(r - tire, tire, 5, 16), { rotation: [0, Math.PI / 2, 0], color: TIRE, style: STYLE.SMOOTH })
  pb.add(new TorusGeometry(r - tire * 2 - 0.012, 0.016, 3, 16), {
    rotation: [0, Math.PI / 2, 0],
    color: model.glowRim ? bike.accent : RIM,
    style: model.glowRim ? STYLE.GLOW : STYLE.SMOOTH,
  })
  // Spokes and hub.
  const spoke = r - tire * 2 - 0.02
  for (let i = 0; i < 4; i += 1) {
    const ang = (i / 4) * Math.PI
    box(pb, 0, 0, 0, 0.012, spoke * 2, 0.012, STEEL, STYLE.SMOOTH, [ang, 0, 0])
  }
  const hub = model.motor ? 0.09 : 0.04
  pb.add(CYL, { rotation: [0, 0, Math.PI / 2], scale: [hub, model.motor ? 0.12 : 0.1, hub], color: model.motor ? '#2b2f3a' : STEEL, style: STYLE.SMOOTH })
  return pb.build()
}

/** The frame and everything on it but the wheels. */
function buildFrame(model, bike) {
  const pb = new PropBuilder()
  const F = BIKE_FRAME
  const c = bike.color
  const acc = bike.accent
  const r = model.r
  const rear = [0, r, -F.axleZ]
  const bb = [0, F.bb.y, F.bb.z]
  const seatTop = [0, F.saddle.y - 0.1, F.saddle.z + 0.05]
  const headTop = [0, 0.98, 0.43]
  const headLow = [0, 0.8, 0.48]
  const t = model.fork === 'triple' || model.shock ? 0.034 : 0.026

  // Main triangle.
  tube(pb, bb, seatTop, t, c)
  tube(pb, bb, headLow, t * 1.15, c)
  if (model.step) tube(pb, [0, 0.42, 0.0], [0, 0.85, 0.44], t, c)
  else tube(pb, seatTop, headTop, t, c)
  tube(pb, headLow, headTop, t * 1.2, c)
  // Rear triangle.
  tube(pb, bb, rear, t * 0.7, c)
  tube(pb, seatTop, rear, t * 0.65, c)
  // Fork.
  const forkTop = [0, 0.8, 0.48]
  if (model.fork === 'susp' || model.fork === 'triple') {
    for (const sx of [-0.06, 0.06]) {
      tube(pb, [sx, forkTop[1] + (model.fork === 'triple' ? 0.16 : 0), forkTop[2] - 0.02], [sx, 0.55, 0.52], 0.024, STEEL)
      tube(pb, [sx, 0.58, 0.515], [sx, r, F.axleZ], 0.032, acc)
    }
    if (model.fork === 'triple') box(pb, 0, 0.98, 0.45, 0.18, 0.04, 0.08, acc)
  } else {
    const w = model.fork === 'rigidFat' ? 0.1 : 0.05
    for (const sx of [-w, w]) tube(pb, [sx * 0.6, forkTop[1], forkTop[2]], [sx, r, F.axleZ], 0.02, c)
  }
  if (model.shock) {
    tube(pb, [0, 0.66, -0.12], [0, 0.48, -0.42], 0.045, acc)
    tube(pb, [0, 0.66, -0.12], [0, 0.48, -0.42], 0.022, '#ffd23f')
  }
  // Stem and bars.
  const bar = [0, F.bar.y, F.bar.z]
  tube(pb, headTop, [0, F.bar.y - 0.02, F.bar.z - 0.02], 0.022, STEEL)
  const half = F.bar.half
  if (model.bar === 'swept') {
    tube(pb, [-half * 0.4, bar[1], bar[2]], [half * 0.4, bar[1], bar[2]], 0.016, STEEL)
    for (const sx of [-1, 1]) tube(pb, [sx * half * 0.4, bar[1], bar[2]], [sx * half, bar[1] + 0.03, bar[2] - 0.12], 0.016, STEEL)
  } else if (model.bar === 'drop') {
    tube(pb, [-half * 0.8, bar[1], bar[2]], [half * 0.8, bar[1], bar[2]], 0.016, STEEL)
    for (const sx of [-1, 1]) tube(pb, [sx * half * 0.8, bar[1], bar[2]], [sx * half * 0.8, bar[1] - 0.14, bar[2] + 0.08], 0.016, acc)
  } else if (model.bar === 'riser') {
    for (const sx of [-1, 1]) tube(pb, [sx * 0.08, bar[1] - 0.06, bar[2]], [sx * half, bar[1] + 0.02, bar[2] - 0.02], 0.016, STEEL)
    tube(pb, [-half, bar[1] + 0.02, bar[2] - 0.02], [half, bar[1] + 0.02, bar[2] - 0.02], 0.016, STEEL)
  } else {
    tube(pb, [-half, bar[1], bar[2]], [half, bar[1], bar[2]], 0.016, STEEL)
  }
  // Grips.
  for (const sx of [-1, 1]) {
    const gx = model.bar === 'swept' ? sx * half : sx * half * (model.bar === 'drop' ? 0.8 : 1)
    const gz = model.bar === 'swept' ? bar[2] - 0.12 : bar[2]
    tube(pb, [gx - sx * 0.05, bar[1] + 0.02, gz], [gx + sx * 0.03, bar[1] + 0.02, gz], 0.024, model.bar === 'drop' ? acc : '#2b2f3a')
  }
  // Saddle and seat post.
  tube(pb, seatTop, [0, F.saddle.y - 0.03, F.saddle.z], 0.018, STEEL)
  box(pb, 0, F.saddle.y, F.saddle.z + 0.02, 0.16, 0.06, 0.28, model.step ? acc : SEAT)
  // Cranks and pedals (the pedals turn with the legs on the ride: kept simple, level).
  box(pb, 0, bb[1], bb[2], 0.14, 0.09, 0.09, STEEL)
  for (const sx of [-1, 1]) {
    box(pb, sx * 0.09, bb[1], bb[2], 0.02, 0.03, F.crank * 2, STEEL)
    box(pb, sx * 0.15, bb[1], bb[2] + sx * F.crank, 0.1, 0.025, 0.07, '#2b2f3a')
  }
  // Chainring.
  pb.add(new TorusGeometry(0.1, 0.012, 3, 10), { position: [0.07, bb[1], bb[2]], rotation: [0, Math.PI / 2, 0], color: STEEL, style: STYLE.SMOOTH })

  // Extras.
  if (model.fenders) {
    for (const [z, a0] of [
      [F.axleZ, -0.2],
      [-F.axleZ, 0.2],
    ]) {
      pb.add(new TorusGeometry(r + 0.03, 0.025, 3, 10, Math.PI * 0.7), {
        position: [0, r, z],
        rotation: [0, Math.PI / 2, Math.PI * 0.15 + a0],
        color: acc,
        style: STYLE.SMOOTH,
      })
    }
  }
  if (model.basket) {
    box(pb, 0, 1.0, 0.72, 0.36, 0.22, 0.3, '#c99a5b', STYLE.PLATE)
    box(pb, 0, 1.12, 0.72, 0.38, 0.03, 0.32, '#a87b45')
  }
  if (model.rack) box(pb, 0, 0.82, -0.6, 0.22, 0.03, 0.4, STEEL)
  if (model.pegs) for (const sx of [-1, 1]) tube(pb, [sx * 0.06, r, -F.axleZ], [sx * 0.2, r, -F.axleZ], 0.03, STEEL)
  if (model.battery) {
    box(pb, 0, 0.55, 0.2, 0.12, 0.12, 0.42, acc, STYLE.SMOOTH, [-0.85, 0, 0])
    box(pb, 0, 0.6, 0.21, 0.04, 0.04, 0.3, '#7fffd4', STYLE.GLOW, [-0.85, 0, 0])
  }
  if (model.light) ball(pb, 0, 0.98, 0.56, 0.05, '#fff6c2', STYLE.GLOW)
  if (model.rockets) {
    for (const sx of [-1, 1]) {
      pb.add(CYL, { position: [sx * 0.24, 0.72, -0.48], rotation: [Math.PI / 2, 0, 0], scale: [0.08, 0.42, 0.08], color: STEEL, style: STYLE.PLATE })
      pb.add(CYL, { position: [sx * 0.24, 0.72, -0.72], rotation: [Math.PI / 2, 0, 0], scale: [0.065, 0.08, 0.065], color: acc, style: STYLE.GLOW })
      tube(pb, [sx * 0.04, 0.8, -0.2], [sx * 0.22, 0.74, -0.32], 0.02, STEEL)
    }
    box(pb, 0, 0.9, 0.05, 0.08, 0.04, 0.5, acc, STYLE.GLOW)
  }
  // A paint stripe on the down tube catches the eye.
  tube(pb, [0, 0.42, 0.08], [0, 0.66, 0.36], t * 1.25, acc)
  return pb.build()
}

const cache = new Map()

/**
 * The parts of bike `bikeOrId` (a BIKES entry or its id): `frame` and one `wheel`
 * geometry (centred on its axle, to place at `front` and `rear` and spin about X), and
 * the wheel radius.
 */
export function bikeParts(bikeOrId) {
  const bike = typeof bikeOrId === 'string' ? BIKES.find((b) => b.id === bikeOrId) || BIKES[0] : bikeOrId
  let parts = cache.get(bike.id)
  if (!parts) {
    const model = MODELS[bike.model] || MODELS.cruiser
    const wheel = buildWheel(model, bike)
    const frame = buildFrame(model, bike)
    parts = {
      bike,
      frame,
      wheel,
      radius: model.r,
      front: [0, model.r, BIKE_FRAME.axleZ],
      rear: [0, model.r, -BIKE_FRAME.axleZ],
      whole: null,
    }
    cache.set(bike.id, parts)
  }
  return parts
}

/** Bike `bikeOrId` in one piece, wheels on (for the shop's displays and other riders). */
export function bikeGeometry(bikeOrId) {
  const parts = bikeParts(bikeOrId)
  if (!parts.whole) {
    const front = parts.wheel.clone().translate(...parts.front)
    const rear = parts.wheel.clone().translate(...parts.rear)
    parts.whole = mergeGeometries([parts.frame, front, rear], false)
    front.dispose()
    rear.dispose()
    parts.whole.computeBoundingSphere()
  }
  return parts.whole
}
