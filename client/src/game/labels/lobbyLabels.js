import { BIKES, KMH, RARITIES, WORLD_PORTALS, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { BIKE_STANDS, FREE_REWARD, GARAGE, PORTALS, START_ARCH } from '@shared/world'

import { BILLBOARD } from '../world/mountain'

/** Text styles, as gradients top-to-bottom, matching the game's signage. */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#fff6b0', '#ffd52a', '#ff9c00'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/**
 * Ownership state of each bike stand: 'equipped' | 'owned' | 'buy' (the next one, yours
 * to buy now) | 'locked' (buy the one before it first). `profile` needs `bike` and `bikes`.
 */
export function standState(profile, index) {
  const bike = BIKES[index]
  if (profile.bike === bike.id) return 'equipped'
  if (profile.bikes.includes(bike.id)) return 'owned'
  const previous = BIKES[index - 1]
  return !previous || profile.bikes.includes(previous.id) ? 'buy' : 'locked'
}

/** A bike's rarity line, in its rarity's colour (rainbow for the Mythic one). */
const rarityLine = (bike) => {
  const rarity = RARITIES[bike.rarity]
  return bike.rarity === 'mythic'
    ? { text: rarity.name.toUpperCase(), size: 36, rainbow: true }
    : { text: rarity.name.toUpperCase(), size: 34, gradient: tint(rarity.color) }
}

const speedText = (bike) => `TOP ${Math.round(bike.top * KMH)} km/h`

/**
 * Over each stand: a state tag (EQUIPPED / OWNED / CAN BUY! / LOCKED), the bike's name,
 * its top speed, then its price in Coins - or its rarity once it's yours.
 */
export function standLabelSpec(index, state) {
  const bike = BIKES[index]
  const tag =
    state === 'equipped'
      ? { text: 'EQUIPPED', size: 36, gradient: TEXT.green }
      : state === 'owned'
        ? { text: 'OWNED', size: 36, gradient: TEXT.blue }
        : state === 'buy'
          ? { text: 'CAN BUY!', size: 36, gradient: TEXT.gold }
          : { text: 'LOCKED', size: 36, gradient: TEXT.red }
  const last =
    state === 'equipped' || state === 'owned'
      ? rarityLine(bike)
      : { text: bike.cost === 0 ? 'FREE' : `${formatNumber(bike.cost)} Coins`, size: 40, icon: 'coin', gradient: state === 'locked' ? TEXT.red : TEXT.price }
  return {
    lines: [tag, { text: bike.name, size: 46, fill: '#ffffff' }, { text: speedText(bike), size: 38, gradient: TEXT.blue }, last],
    pxPerUnit: 70,
  }
}

/** Largest a stand label can get, so its atlas slot fits every state. */
const standReserve = (index) => ({
  lines: [
    { text: 'EQUIPPED', size: 36 },
    { text: BIKES[index].name, size: 46 },
    { text: speedText(BIKES[index]), size: 38 },
    { text: `${formatNumber(BIKES[index].cost)} Coins`, size: 40, icon: 'coin' },
  ],
})

export function standLabels(profile) {
  return BIKE_STANDS.map((stand) => ({
    id: `stand-${stand.index}`,
    // Each row back rides higher, so they clear the row in front seen from the plaza.
    position: [stand.x, stand.y + 4.4 + stand.row * 1.4, stand.z],
    spec: standLabelSpec(stand.index, standState(profile, stand.index)),
    reserve: standReserve(stand.index),
    fade: 70,
  }))
}

/** The billboard on the south slope: the game's name. */
const billboardLabel = () => ({
  id: 'billboard',
  position: [BILLBOARD.x, BILLBOARD.y + 0.8 + BILLBOARD.height / 2, BILLBOARD.z - 1.5],
  spec: {
    lines: [
      { text: 'BIKE HILL RUSH', size: 100, gradient: TEXT.gold },
      { text: 'RIDE DOWN - DODGE - GO FASTER', size: 44, gradient: TEXT.white },
    ],
    pxPerUnit: 34,
  },
  fade: 220,
})

/** Over the START gate: which mountain this is, and how to go. */
const gateLabel = (profile) => ({
  id: 'gate',
  position: [0, 16.5, START_ARCH.z],
  spec: {
    lines: [
      { text: (WORLDS[profile.world || 0] ?? WORLDS[0]).name.toUpperCase(), size: 60, gradient: profile.world === 1 ? TEXT.blue : TEXT.green },
      { text: 'Walk in to ride down!', size: 40, gradient: TEXT.white },
    ],
    pxPerUnit: 52,
  },
  reserve: {
    lines: [
      { text: WORLDS.reduce((a, w) => (w.name.length > a.length ? w.name : a), '').toUpperCase(), size: 60 },
      { text: 'Walk in to ride down!', size: 40 },
    ],
  },
  fade: 160,
})

const freeRewardLabel = () => ({
  id: 'free-reward',
  position: [FREE_REWARD.x, 4.8, FREE_REWARD.z],
  spec: { lines: [{ text: 'FREE GIFT', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 60 },
  fade: 90,
})

/**
 * Where the portal goes: Frost Ridge (and what opens it - reaching the bottom of Pine
 * Peak - until it's open), or back to Pine Peak.
 */
const portalLabel = (profile) => (portal) => {
  const away = profile.world === 1
  const open = profile.world2Unlocked
  const need = WORLD_PORTALS[portal.id]
  const lines = away
    ? [
        { text: WORLDS[0].name.toUpperCase(), size: 56, gradient: TEXT.green },
        { text: 'Back home', size: 42, gradient: TEXT.white },
      ]
    : [
        { text: WORLDS[1].name.toUpperCase(), size: 60, gradient: TEXT.blue },
        open
          ? { text: `x${WORLDS[1].pay} Coins!`, size: 46, icon: 'coin', gradient: TEXT.gold }
          : { text: `Finish ${WORLDS[need.finish].name} to open`, size: 40, icon: 'flag', gradient: TEXT.white },
      ]
  return {
    id: `portal-${portal.id}`,
    position: [portal.x, portal.radius * 2 + 2.8, portal.z],
    spec: { lines, pxPerUnit: 56 },
    // Big enough for either side of the portal.
    reserve: {
      lines: [
        { text: WORLDS[1].name.toUpperCase(), size: 60 },
        { text: `Finish ${WORLDS[need.finish].name} to open`, size: 46, icon: 'flag' },
      ],
    },
    fade: 140,
  }
}

/** Over the garage's open front: what it's for. */
const garageLabel = () => ({
  id: 'garage',
  position: [GARAGE.minX - 0.2, 7.4, (GARAGE.minZ + GARAGE.maxZ) / 2],
  spec: {
    lines: [
      { text: 'GARAGE', size: 60, gradient: TEXT.gold },
      { text: 'Upgrade your bike, part by part', size: 40, icon: 'wrench', gradient: TEXT.white },
    ],
    pxPerUnit: 56,
  },
  fade: 120,
})

/** Every label in the lobby. */
export function lobbyLabels(profile) {
  return [...standLabels(profile), billboardLabel(), gateLabel(profile), freeRewardLabel(), garageLabel(), ...PORTALS.map(portalLabel(profile))]
}
