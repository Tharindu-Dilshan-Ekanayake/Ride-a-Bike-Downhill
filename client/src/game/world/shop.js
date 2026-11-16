import { FREE_REWARD, SHOP, SHOP_SIGN } from '@shared/world'

import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'

/** The shop's sign faces east, towards the plaza. */
export const SHOP_SIGN_FACING = 1

/**
 * The bike shop's yard (its floor is painted into the ground map; the display stands and
 * bikes are BikeShop.jsx's): the big BIKE SHOP sign along its back - two striped legs, a
 * dark panel in a coloured frame, lettering painted on (signs.js), bulbs round it on
 * MEDIUM and up - a glowing post at each corner of the yard, and a string of bunting over
 * the aisle between the two rows of stands.
 */
export function buildShop(blocks, { detail = true, venue } = {}) {
  const { band, strip, post, panel } = venue.shop
  const { x, minZ, maxZ, top } = SHOP_SIGN
  const f = SHOP_SIGN_FACING
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const bottom = top - 7.6
  for (const z of [minZ + 1.5, maxZ - 1.5]) blocks.addOn(x - 0.1 * f, 0, z, 0.9, bottom + 0.3, 0.9, band, STYLE.STRIPES)
  blocks.addOn(x, bottom, midZ, 0.6, top - bottom, length, band)
  blocks.addOn(x + 0.1 * f, bottom + 0.5, midZ, 0.6, top - bottom - 1, length - 1, panel, STYLE.SMOOTH)
  blocks.addOn(x, top, midZ, 0.9, 0.4, length + 0.4, post, STYLE.GLOW)
  if (detail) {
    for (let z = minZ + 1; z <= maxZ - 0.99; z += 1.5) {
      blocks.add(x + 0.42 * f, bottom + 0.25, z, 0.16, 0.3, 0.3, Math.round(z) % 2 ? '#ffffff' : post, STYLE.GLOW)
      blocks.add(x + 0.42 * f, top - 0.25, z + 0.75, 0.16, 0.3, 0.3, Math.round(z) % 2 ? post : '#ffffff', STYLE.GLOW)
    }
  }

  // A glowing marker post at each corner of the yard.
  for (const cx of [SHOP.minX + 0.6, SHOP.maxX + 0.4]) {
    for (const cz of [SHOP.minZ - 0.4, SHOP.maxZ + 0.4]) {
      blocks.addOn(cx, 0, cz, 0.5, 1.6, 0.5, post, STYLE.STRIPES)
      blocks.addOn(cx, 1.6, cz, 0.7, 0.4, 0.7, strip, STYLE.GLOW)
    }
  }

  // Bunting over the aisle: little flags on a line between two tall poles.
  if (detail) {
    // Down the aisle between the front two rows of stands (BIKE_STANDS: x -19, -27, -35).
    const ax = -23
    for (const z of [SHOP.minZ + 1, SHOP.maxZ - 1]) blocks.addOn(ax, 0, z, 0.25, 6.2, 0.25, PALETTE.steel, STYLE.SMOOTH)
    const span = SHOP.maxZ - SHOP.minZ - 2
    blocks.add(ax, 6.1, (SHOP.minZ + SHOP.maxZ) / 2, 0.06, 0.06, span, '#ffffff', STYLE.SMOOTH)
    for (let i = 0, z = SHOP.minZ + 2.5; z < SHOP.maxZ - 2; i += 1, z += 1.6) {
      blocks.add(ax, 5.75, z, 0.05, 0.6, 0.7, venue.flags[i % venue.flags.length], STYLE.SMOOTH, 0, 0, 0)
    }
  }
}

/**
 * The gift stand by spawn: a striped podium with a big present on it - red, a gold ribbon
 * both ways and a bow on top - glowing a little so it catches the eye.
 */
export function buildGiftStand(blocks) {
  const { x, z } = FREE_REWARD
  blocks.addOn(x, 0, z, 2.6, 0.5, 2.6, '#ffffff', STYLE.STRIPES)
  blocks.addOn(x, 0.5, z, 2.2, 0.2, 2.2, PALETTE.ribbon, STYLE.GLOW)
  blocks.addOn(x, 0.7, z, 1.7, 1.5, 1.7, PALETTE.gift, STYLE.STUDS)
  blocks.addOn(x, 0.7, z, 1.78, 1.52, 0.36, PALETTE.ribbon, STYLE.SMOOTH)
  blocks.addOn(x, 0.7, z, 0.36, 1.54, 1.78, PALETTE.ribbon, STYLE.SMOOTH)
  blocks.addOn(x, 2.24, z, 1.85, 0.34, 1.85, PALETTE.gift, STYLE.STUDS)
  for (const side of [-1, 1]) blocks.add(x + side * 0.38, 2.82, z, 0.7, 0.42, 0.42, PALETTE.ribbon, STYLE.GLOW, 0, 0, side * 0.5)
}
