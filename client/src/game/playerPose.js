/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way.
 *
 * `computePose` turns the motion state into joint angles; each avatar applies them to its
 * own limbs. Angles are radians in character space (the character faces +Z, its left
 * side is +X), about each joint's pivot:
 *   swing - about X: negative swings a hanging limb forward (arm up in front, knee up);
 *           on the spine and neck, which point up, positive bends them forward
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward
 * `lift` raises (or lowers) the body, in metres. `stretchL` / `stretchR` stay 1 (the rig
 * still supports stretching arms; this game doesn't use it).
 */

import { BIKE_FRAME } from './ride/bikeModels'

export const POSED_BONES = ['Spine1', 'Neck1', 'ArmL1', 'ArmL2', 'ArmR1', 'ArmR2', 'LegL1', 'LegL2', 'LegR1', 'LegR2']

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  stretchL: 1,
  stretchR: 1,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
}

/**
 * The 1.8 m character's measurements: shoulder height and how far out from the middle,
 * arm length (shoulder to palm), hip height (the pivot the body turns about), and the
 * thigh and shin.
 */
export const BODY = { shoulderY: 1.35, shoulderX: 0.56, arm: 0.63, pivot: 0.9, hipX: 0.13, thigh: 0.46, shin: 0.44 }

/**
 * Seated on the bike: where the avatar's feet-origin sits in bike space so its hips are
 * on the saddle (Player and other riders place the avatar there).
 */
export const SEAT = { y: BIKE_FRAME.saddle.y - BODY.pivot + 0.04, z: BIKE_FRAME.saddle.z + 0.02 }

/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

/** Relaxed stance: knees soft, breathing, arms hanging. */
function stance(w, time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.04, 0.06 * OUT_L, 0, w)
  add('LegL2', 0.08, 0, 0, w)
  add('LegR1', 0.04, 0.06 * OUT_R, 0, w)
  add('LegR2', 0.08, 0, 0, w)
  add('Spine1', 0.03 + breath * 0.015, 0, 0, w)
  add('ArmL1', 0.05 + breath * 0.02, 0.1 * OUT_L, 0, w)
  add('ArmR1', 0.05 - breath * 0.02, 0.1 * OUT_R, 0, w)
  add('ArmL2', -0.12, 0, 0, w)
  add('ArmR2', -0.12, 0, 0, w)
  pose.lift += breath * 0.006 * w
}

/** Walk to run: the legs swing, the arms swing against them, the body bobs once per step. */
function stride(phase, ratio) {
  const cycle = Math.sin(phase)
  const leg = 0.85 * ratio
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  add('ArmL1', -cycle * 0.75 * ratio, 0.08 * OUT_L, 0, 1)
  add('ArmR1', cycle * 0.75 * ratio, 0.08 * OUT_R, 0, 1)
  add('ArmL2', -0.35 * ratio, 0, 0, 1)
  add('ArmR2', -0.35 * ratio, 0, 0, 1)
  add('Spine1', (0.06 + 0.1 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
  pose.lift += (Math.abs(Math.cos(phase)) * 0.05 - 0.015) * ratio
}

/** In the air (a lobby jump): one knee up on the way up, arms out; falling, legs reach down. */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('ArmL1', -0.6, 0.55 * OUT_L, 0, 1)
  add('ArmR1', -0.6, 0.55 * OUT_R, 0, 1)
  add('Spine1', lerp(0.15, -0.06, f), 0, 0, 1)
}

/** Points both upper arms from the shoulders along (out, up, fwd) metres, no stretching. */
function aimArms(out, up, fwd, parentSwing, w) {
  const len = Math.max(0.05, Math.hypot(out, up, fwd))
  const sway = Math.asin(Math.min(1, Math.max(-1, out / len)))
  const swing = Math.atan2(-fwd, -up) - parentSwing
  add('ArmL1', swing, sway * OUT_L, 0, w)
  add('ArmR1', swing, sway * OUT_R, 0, w)
  // Elbows bend a touch when the bars are closer than the arms are long.
  const bend = Math.acos(Math.min(1, len / BODY.arm)) * 1.4
  add('ArmL2', -bend, 0, 0, w)
  add('ArmR2', -bend, 0, 0, w)
}

/** Two-bone leg reaching from the hip to a pedal at (y, z) in character space. */
function legTo(name1, name2, y, z, side, w) {
  const dy = y - BODY.pivot
  const dz = z
  const L1 = BODY.thigh
  const L2 = BODY.shin
  const d = Math.min(L1 + L2 - 0.005, Math.max(0.12, Math.hypot(dy, dz)))
  const knee = Math.PI - Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))))
  const toTarget = Math.atan2(dz, -dy)
  const offset = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
  add(name1, -(toTarget + offset), 0.04 * side, 0, w)
  add(name2, knee, 0, 0, w)
}

/**
 * On the bike: hips on the saddle, hands on the bars, feet going round with the pedals
 * (`phase`, radians of crank). `tuck` (0-1) crouches low over the bars (boosting, in the
 * air); `stand` (0-1) rises off the saddle (absorbing a landing).
 */
function riding(phase, tuck, stand, w) {
  const lean = 0.42 + 0.35 * tuck
  add('Spine1', lean, 0, 0, w)
  add('Neck1', -0.32 - 0.25 * tuck, 0, 0, w)
  pose.lift += (SEAT.y + stand * 0.12) * w
  // The bars, in character space (the avatar's feet-origin is at SEAT in bike space).
  const torso = BODY.shoulderY - BODY.pivot
  const shoulderY = BODY.pivot + torso * Math.cos(lean)
  const shoulderZ = torso * Math.sin(lean)
  const barY = BIKE_FRAME.bar.y - SEAT.y
  const barZ = BIKE_FRAME.bar.z - SEAT.z
  aimArms(BIKE_FRAME.bar.half - BODY.shoulderX, barY - shoulderY, barZ - shoulderZ, lean, w)
  // Feet on the pedals.
  const bbY = BIKE_FRAME.bb.y - SEAT.y - stand * 0.12
  const bbZ = BIKE_FRAME.bb.z - SEAT.z
  const c = BIKE_FRAME.crank
  legTo('LegL1', 'LegL2', bbY + c * Math.sin(phase), bbZ + c * Math.cos(phase), OUT_L, w)
  legTo('LegR1', 'LegR2', bbY - c * Math.sin(phase), bbZ - c * Math.cos(phase), OUT_R, w)
}

/** Thrown off the bike: arms and legs flailing as you tumble. */
function tumbling(time, w) {
  const a = Math.sin(time * 13)
  const b = Math.cos(time * 11)
  add('ArmL1', -2.4 + a * 0.6, (0.9 + b * 0.3) * OUT_L, 0, w)
  add('ArmR1', -2.2 - a * 0.6, (0.9 - b * 0.3) * OUT_R, 0, w)
  add('ArmL2', -0.4, 0, 0, w)
  add('ArmR2', -0.4, 0, 0, w)
  add('LegL1', -0.5 + b * 0.5, 0.35 * OUT_L, 0, w)
  add('LegR1', -0.2 - b * 0.5, 0.35 * OUT_R, 0, w)
  add('LegL2', 0.6 + a * 0.3, 0, 0, w)
  add('LegR2', 0.4 - a * 0.3, 0, 0, w)
  add('Spine1', -0.2, 0, 0, w)
  add('Neck1', -0.4, 0, 0, w)
}

/** One arm punching the air (riding over the finish line, or celebrating in the lobby). */
function cheering(time, w) {
  const wave = Math.sin(time * 10) * 0.28
  add('ArmR1', -2.9 + wave, 0.3 * OUT_R, 0, w)
  add('ArmR2', -0.25, 0, 0, w)
  add('Neck1', -0.15, 0, 0, w)
}

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, ride?: number, pedal?: number, tuck?: number,
 *   stand?: number, tumble?: number, cheer?: number, emote?: string|null }} motion
 *   `ride` (0-1) is sitting on the bike (`pedal` the crank angle, `tuck`/`stand` as in
 *   riding()); `tumble` (0-1) is bailing off it; `cheer` (0-1) punching the air.
 *   `emote` is a Boxity emote id to play over this pose, or null: the Bloxity avatar
 *   blends the emote clip on top (avatarRig.updateEmote).
 */
export function computePose(motion) {
  const { time = 0, speed = 0, maxSpeed = 6, grounded = true, vy = 0, stride: phase = time * 5, ride = 0, pedal = 0, tuck = 0, stand = 0, tumble = 0, cheer = 0 } = motion
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0
  pose.stretchL = 1
  pose.stretchR = 1

  if (tumble > 0) {
    tumbling(time, 1)
    return pose
  }
  if (ride > 0) {
    riding(pedal, tuck, stand, 1)
    if (cheer > 0) cheering(time, cheer)
    return pose
  }
  const ratio = grounded ? clamp01(speed / Math.max(maxSpeed, 0.001)) : 0
  if (grounded) {
    const still = 1 - smooth(0.05, 0.4, ratio)
    stance(still, time)
    if (ratio > 0.02) stride(phase, ratio)
  } else {
    airborne(vy)
  }
  if (cheer > 0) cheering(time, cheer)
  return pose
}
