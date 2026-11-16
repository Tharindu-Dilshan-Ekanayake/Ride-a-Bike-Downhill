import {
  AD_REWARDS,
  BADGES,
  BAIL_METERS,
  BIG_TANK_SECONDS,
  BIKES,
  DAILY_INTERVAL_MS,
  DAILY_REWARDS,
  dayNumber,
  FLIP_METERS,
  FREE_REWARD,
  GEM_PRODUCTS,
  ITEMS,
  MILESTONE,
  MILESTONE_METERS,
  niceRound,
  PART_LEVELS,
  PARTS,
  partPrice,
  PHYSICS,
  PLAYTIME_REWARDS,
  rebirthMultiplier,
  rebirthPrice,
  SHOP,
  SMASH_METERS,
  streakMultiplier,
  TURBO_SECONDS,
  TUTORIAL,
  UPGRADES,
  WORLD_PORTALS,
  WORLDS,
} from './balance.js'
import { getTrack, maxRideSpeed, zoneIndexIn } from './track.js'

/**
 * Game rules as pure functions over a plain profile object.
 *
 * The server runs these authoritatively; the client runs the very same functions for
 * offline play and for display (costs, multipliers, what a button would do). Mutating
 * functions change the profile in place and return a small result describing what
 * happened, which is what gets sent to the client as an event.
 *
 * `session` is the per-connection state that is never saved: when this session
 * started, which playtime rewards were claimed, the ride in progress.
 */

export const PROFILE_VERSION = 2

const STARTER = BIKES[0].id

export function createProfile(id, name) {
  return {
    v: PROFILE_VERSION,
    id,
    name,
    /** Coins (the platform's leaderboard calls them wins). */
    wins: 0,
    rebirths: 0,
    bike: STARTER,
    bikes: [STARTER],
    upgrades: { boost: 0, income: 0 },
    /** Each bike's GARAGE parts: { [bikeId]: { tires, suspension, gears } } (levels). */
    parts: {},
    items: {},
    /** Potion timers: when each runs out (ms since epoch). */
    boosts: { wins: 0, turbo: 0 },
    passes: {},
    daily: { start: 0, claimed: [] },
    freeRewardClaimed: false,
    tutorialStep: 0,
    badges: [],
    stats: {
      rides: 0,
      /** Furthest single ride in any world (the leaderboard). */
      bestDistance: 0,
      playtime: 0,
      totalWins: 0,
      coins: 0,
      flips: 0,
      finishes: 0,
      crashes: 0,
      /** Fastest speed ever reached (m/s). */
      topSpeed: 0,
      /** Per world: furthest ride (m), best finish time (ms, 0 = never finished), furthest zone. */
      best: [0, 0],
      bestTime: [0, 0],
      bestZone: [0, 0],
    },
    /** The world you're in (index into WORLDS), and whether Frost Ridge's portal is open. */
    world: 0,
    world2Unlocked: false,
    lastSeen: 0,
    settings: {},
    /** Today's quests (engage.js): the day they're for, the three, the bonus chest taken. */
    quests: { day: -1, list: [], bonus: false },
    /** Login streak: the last day played (balance.dayNumber), days in a row, the best run. */
    streak: { day: -1, days: 0, best: 0 },
  }
}

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback)
const perWorld = (raw, base) => WORLDS.map((_, i) => Math.max(0, num(Array.isArray(raw) ? raw[i] : undefined, base[i] ?? 0)))

/** Fills in anything missing from an older or partial save. Never throws. */
export function normalizeProfile(raw, id, name) {
  const base = createProfile(id, name)
  if (!raw || typeof raw !== 'object' || raw.v !== PROFILE_VERSION) {
    // Saves from before this game (the template's) start fresh.
    return base
  }
  const p = { ...base, ...raw, id, name: name || raw.name || base.name }
  p.wins = Math.max(0, num(raw.wins))
  p.rebirths = Math.max(0, Math.floor(num(raw.rebirths)))
  p.boosts = { ...base.boosts, ...(raw.boosts || {}) }
  p.settings = { ...(raw.settings || {}) }
  p.daily = { ...base.daily, ...(raw.daily || {}) }
  const stats = { ...base.stats, ...(raw.stats || {}) }
  stats.best = perWorld(raw.stats?.best, base.stats.best)
  stats.bestTime = perWorld(raw.stats?.bestTime, base.stats.bestTime)
  stats.bestZone = perWorld(raw.stats?.bestZone, base.stats.bestZone).map((z, i) => Math.min(WORLDS[i].zones.length - 1, Math.floor(z)))
  p.stats = stats
  const upgrades = raw.upgrades || {}
  p.upgrades = Object.fromEntries(Object.entries(UPGRADES).map(([key, up]) => [key, Math.min(up.max, Math.max(0, Math.floor(num(upgrades[key]))))]))
  const streak = raw.streak && typeof raw.streak === 'object' ? raw.streak : {}
  p.streak = {
    day: Number.isInteger(streak.day) ? streak.day : -1,
    days: Math.max(0, Math.floor(streak.days) || 0),
    best: Math.max(0, Math.floor(streak.best) || 0),
  }
  const quests = raw.quests && typeof raw.quests === 'object' ? raw.quests : {}
  p.quests = {
    day: Number.isInteger(quests.day) ? quests.day : -1,
    list: Array.isArray(quests.list)
      ? quests.list
          .filter((q) => q && typeof q.type === 'string' && Number.isFinite(q.target))
          .map((q) => ({ type: q.type, tier: Math.max(0, Math.min(2, Math.floor(q.tier) || 0)), target: q.target, progress: Math.max(0, Number(q.progress) || 0), claimed: q.claimed === true }))
      : [],
    bonus: quests.bonus === true,
  }
  p.items = Object.fromEntries(Object.entries(raw.items || {}).filter(([itemId, n]) => ITEMS[itemId] && Number.isFinite(n) && n > 0))
  p.passes = Object.fromEntries(Object.entries(raw.passes || {}).filter(([productId]) => SHOP[productId]))
  p.parts = {}
  for (const [bikeId, levels] of Object.entries(raw.parts && typeof raw.parts === 'object' ? raw.parts : {})) {
    if (bikeIndex(bikeId) < 0 || !levels || typeof levels !== 'object') continue
    p.parts[bikeId] = Object.fromEntries(Object.keys(PARTS).map((key) => [key, Math.min(PART_LEVELS, Math.max(0, Math.floor(num(levels[key]))))]))
  }
  const owned = Array.isArray(raw.bikes) ? raw.bikes.filter((bikeId) => bikeIndex(bikeId) >= 0) : []
  p.bikes = owned.length ? [...new Set(owned)] : [STARTER]
  if (!p.bikes.includes(p.bike)) p.bike = p.bikes[0]
  p.world2Unlocked = raw.world2Unlocked === true
  p.world = p.world2Unlocked && raw.world === 1 ? 1 : 0
  p.badges = Array.isArray(raw.badges) ? raw.badges.filter((b) => BADGES[b]) : []
  p.tutorialStep = p.rebirths > 0 ? TUTORIAL.length : Math.min(TUTORIAL.length, Math.max(0, Math.floor(p.tutorialStep) || 0))
  p.v = PROFILE_VERSION
  return p
}

export function createSession(now) {
  return { start: now, playtimeClaimed: [], freeRewardTaken: false, adAt: {} }
}

// --- Lookups ------------------------------------------------------------------------

export const bikeIndex = (id) => BIKES.findIndex((b) => b.id === id)
export const bikeById = (id) => BIKES.find((b) => b.id === id) || BIKES[0]
/** The best bike you own (its index). */
export const bestBikeIndex = (profile) => profile.bikes.reduce((best, id) => Math.max(best, bikeIndex(id)), 0)
/** The next bike in the shop you don't have yet, or null. */
export const nextBike = (profile) => BIKES.find((b) => !profile.bikes.includes(b.id)) || null

/**
 * Values are kept to a tenth below a million and whole above, so repeated small gains
 * don't pile up float dust.
 */
export const tidy = (value) => (value < 1e6 ? Math.round(value * 10) / 10 : Math.round(value))

export { niceRound }

// --- Bike parts (the GARAGE) --------------------------------------------------------

export const partLevel = (profile, bikeId, part) => profile.parts?.[bikeId]?.[part] || 0
/** Coins for the next level of `part` on bike `bikeId`, or null when it's maxed. */
export function partCost(profile, bikeId, part) {
  const level = partLevel(profile, bikeId, part)
  return level >= PART_LEVELS ? null : partPrice(bikeById(bikeId).cost, level + 1)
}

export function buyPart(profile, bikeId, part) {
  if (!PARTS[part]) return { ok: false, error: 'Unknown part' }
  if (!profile.bikes.includes(bikeId)) return { ok: false, error: 'You don’t own that bike' }
  const cost = partCost(profile, bikeId, part)
  if (cost === null) return { ok: false, error: 'Maxed out!' }
  if (profile.wins < cost) return { ok: false, error: 'Not enough Coins!' }
  profile.wins -= cost
  const levels = { tires: 0, suspension: 0, gears: 0, ...(profile.parts[bikeId] || {}) }
  levels[part] += 1
  profile.parts = { ...profile.parts, [bikeId]: levels }
  return { ok: true, bikeId, part, level: levels[part] }
}

/**
 * How bike `bikeId` rides with its parts: top speed (m/s), handling (rad/s), landing it
 * survives (m/s), pick-up (x the stock acceleration), extra grip on grass and ice (0-1)
 * and the share of speed kept smashing a crate. What the ride's physics uses.
 */
export function bikeStats(profile, bikeId) {
  const bike = bikeById(bikeId)
  const lv = (part) => partLevel(profile, bike.id, part)
  return {
    id: bike.id,
    top: bike.top * (1 + PARTS.gears.top * lv('gears')),
    handling: bike.handling * (1 + PARTS.tires.handling * lv('tires')),
    grip: PARTS.tires.grip * lv('tires'),
    landing: bike.landing + PARTS.suspension.landing * lv('suspension'),
    accel: 1 + PARTS.gears.accel * lv('gears'),
    smashKeep: 0.84 + PARTS.suspension.smash * lv('suspension'),
  }
}

// --- Upgrades -----------------------------------------------------------------------

export const upgradeLevel = (profile, key) => profile.upgrades?.[key] || 0
/** What upgrade `key` is worth `ahead` levels from where you are. */
export const upgradeValue = (profile, key, ahead = 0) => UPGRADES[key].value(Math.min(UPGRADES[key].max, upgradeLevel(profile, key) + ahead))
export const isUpgradeMaxed = (profile, key) => upgradeLevel(profile, key) >= UPGRADES[key].max
/** Coins for the next level of upgrade `key`. */
export const upgradeCost = (profile, key) => niceRound(UPGRADES[key].base * UPGRADES[key].growth ** upgradeLevel(profile, key))

export function buyUpgrade(profile, key) {
  const up = UPGRADES[key]
  if (!up) return { ok: false, error: 'Unknown upgrade' }
  if (isUpgradeMaxed(profile, key)) return { ok: false, error: 'Maxed out!' }
  const cost = upgradeCost(profile, key)
  if (profile.wins < cost) return { ok: false, error: 'Not enough Coins!' }
  profile.wins -= cost
  profile.upgrades = { ...profile.upgrades, [key]: upgradeLevel(profile, key) + 1 }
  return { ok: true, key, level: profile.upgrades[key] }
}

// --- Multipliers --------------------------------------------------------------------

export const isBoostActive = (profile, kind, now) => (profile.boosts[kind] || 0) > now

/**
 * Days in a row you've played, as of `now`: your streak while it's alive (played today
 * or yesterday), else 0. (engage.applyStreak counts the days.)
 */
export function streakDays(profile, now) {
  const s = profile.streak
  if (!s || s.days <= 0) return 0
  return dayNumber(now) - s.day <= 1 ? s.days : 0
}

/** Your lasting multiplier: rebirths and the Income upgrade. */
export const baseMultiplier = (profile) => rebirthMultiplier(profile.rebirths) * upgradeValue(profile, 'income')

/** Everything that multiplies a ride's Coins: rebirths, Income, the x2 pass and potion, the streak. */
export function winsMultiplier(profile, now) {
  return baseMultiplier(profile) * (profile.passes.winsX2 ? 2 : 1) * (isBoostActive(profile, 'wins', now) ? 2 : 1) * streakMultiplier(streakDays(profile, now))
}

/** Seconds of boost a ride starts with. */
export function boostSeconds(profile, now) {
  return upgradeValue(profile, 'boost') + (profile.passes.bigTank ? BIG_TANK_SECONDS : 0) + (isBoostActive(profile, 'turbo', now) ? TURBO_SECONDS : 0)
}

/** How close a coin has to be to be picked up (m). */
export const pickupRadius = (profile) => (profile.passes.magnet ? PHYSICS.magnetPickup : PHYSICS.pickup)

// --- Rides --------------------------------------------------------------------------

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const int = (v) => Math.max(0, Math.floor(Number(v) || 0))

/** The zone of world `world` at metre `m`. */
export const zoneAt = (world, m) => WORLDS[world].zones[zoneIndexIn(WORLDS[world], m)]

/** Coins for riding `distance` metres in `world`, before multipliers: every metre at its zone's rate, plus milestones. */
export function distanceCoins(world, distance) {
  const zones = WORLDS[world].zones
  let coins = 0
  for (const zone of zones) {
    const metres = Math.max(0, Math.min(distance, zone.start + zone.length) - zone.start)
    coins += metres * zone.coinsPerMeter
  }
  return coins
}

export function milestoneCoins(world, distance) {
  let coins = 0
  for (let m = MILESTONE; m <= distance; m += MILESTONE) coins += zoneAt(world, m).coinsPerMeter * MILESTONE_METERS
  return coins
}

/**
 * How far your best bike gets you in your world: the start of the first zone whose hill
 * it can't crest (or the whole road).
 */
export function reachFor(profile, world = profile.world) {
  const best = bestBikeIndex(profile)
  const zones = WORLDS[world].zones
  for (const zone of zones) if (zone.gate > best) return zone.start + 30
  return WORLDS[world].length
}

/**
 * A full ride's worth of Coins for you now (to your best bike's reach, with a fair share of
 * pickups, at your lasting multiplier): what reward packs are counted in, so they grow
 * with you.
 */
export function rideWorth(profile) {
  const world = profile.world || 0
  const reach = reachFor(profile, world)
  return (distanceCoins(world, reach) * 1.6 + milestoneCoins(world, reach)) * baseMultiplier(profile)
}

/** `rides` full rides' worth of Coins: rewards that grow with you. */
export const winsForRides = (profile, rides) => niceRound(Math.max(20, rideWorth(profile) * rides))

/**
 * A finished ride, as the client reports it, checked and paid. `ctx`:
 *   now      server time
 *   elapsed  seconds since the ride started, as the authority measured them
 *   world    the world it was ridden in
 *   bikeId   the bike it was ridden on
 *   bonus    the session's own multiplier (friends in the server)
 *
 * The report: { distance, time, finished, crashed, reason, coins: [coin indices],
 * flips, smashed, pads, flew, bounces, topSpeed }. Everything is clamped to what the
 * road and the bike make possible: no further than the bike could have gone in the time,
 * only coins that exist within that distance (each once), a sane number of flips.
 */
export function applyRide(profile, report, ctx) {
  const world = WORLDS[ctx.world] ? ctx.world : 0
  const W = WORLDS[world]
  const track = getTrack(world)
  const bike = bikeById(ctx.bikeId ?? profile.bike)
  const r = report && typeof report === 'object' ? report : {}
  const elapsed = Math.max(0, num(ctx.elapsed))
  const top = bikeStats(profile, bike.id).top
  const reachable = Math.min(track.length, elapsed * maxRideSpeed(top) + 25)
  let distance = clamp(num(r.distance), 0, reachable)
  const minTime = track.length / maxRideSpeed(top)
  const finished = r.finished === true && distance >= track.length - 8 && elapsed >= minTime
  if (finished) distance = track.length
  distance = Math.round(distance * 10) / 10

  // Coins picked up: each once, only ones within the distance ridden.
  const seen = new Set()
  let pickup = 0
  const list = Array.isArray(r.coins) ? r.coins.slice(0, track.coinCount) : []
  for (const raw of list) {
    const i = Math.floor(Number(raw))
    if (!(i >= 0 && i < track.coinCount) || seen.has(i)) continue
    const m = track.coins[i * 3]
    if (m > distance + 4) continue
    seen.add(i)
    pickup += zoneAt(world, m).coin
  }
  const picked = seen.size
  const perMeter = zoneAt(world, distance).coinsPerMeter
  const flips = clamp(int(r.flips), 0, Math.floor(distance / 25) + 2)
  const smashed = clamp(int(r.smashed), 0, track.obstacles.length)
  const pads = clamp(int(r.pads), 0, track.pads.length)
  const crashed = !finished && r.crashed === true
  const flew = crashed ? clamp(num(r.flew), 0, 150) : 0
  const bounces = crashed ? clamp(int(r.bounces), 0, 30) : 0

  const parts = {
    distance: distanceCoins(world, distance),
    pickup,
    milestones: milestoneCoins(world, distance),
    flips: flips * FLIP_METERS * perMeter,
    smash: smashed * SMASH_METERS * perMeter,
    bail: flew * BAIL_METERS * perMeter,
    finish: finished ? W.finishBonus : 0,
  }
  const base = Object.values(parts).reduce((a, b) => a + b, 0)
  const multiplier = winsMultiplier(profile, ctx.now) * Math.max(1, num(ctx.bonus, 1))
  const total = Math.max(1, Math.round(base * multiplier))

  // Records.
  const s = profile.stats
  const bestBefore = s.best[world] || 0
  const zone = zoneIndexIn(W, Math.max(0, distance - 0.5))
  const newZones = []
  for (let z = (s.bestZone[world] || 0) + 1; z <= zone; z += 1) newZones.push(z)
  let time = 0
  let bestTime = false
  if (finished) {
    time = Math.round(clamp(num(r.time) * 1000, minTime * 1000, (elapsed + 1) * 1000))
    if (!s.bestTime[world] || time < s.bestTime[world]) {
      s.bestTime[world] = time
      bestTime = true
    }
    s.finishes += 1
  }
  if (crashed) s.crashes += 1
  s.best[world] = Math.max(bestBefore, distance)
  s.bestZone[world] = Math.max(s.bestZone[world] || 0, zone)
  s.bestDistance = Math.max(s.bestDistance, distance)
  s.rides += 1
  s.coins += picked
  s.flips += flips
  s.topSpeed = Math.max(s.topSpeed, clamp(num(r.topSpeed), 0, top * 1.4 + PHYSICS.padSpeed))
  profile.wins += total
  s.totalWins += total

  return {
    ok: true,
    world,
    distance,
    finished,
    crashed,
    reason: typeof r.reason === 'string' ? r.reason.slice(0, 16) : finished ? 'finish' : 'end',
    picked,
    flips,
    smashed,
    pads,
    flew: Math.round(flew * 10) / 10,
    bounces,
    parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])),
    base: Math.round(base),
    multiplier,
    total,
    best: distance > bestBefore,
    time,
    bestTime,
    zone,
    newZones,
  }
}

// --- Bikes --------------------------------------------------------------------------

export function buyBike(profile, bikeId) {
  const bike = BIKES.find((b) => b.id === bikeId)
  if (!bike) return { ok: false, error: 'Unknown bike' }
  if (profile.bikes.includes(bikeId)) return equipBike(profile, bikeId)
  const previous = BIKES[bikeIndex(bikeId) - 1]
  if (previous && !profile.bikes.includes(previous.id)) return { ok: false, error: `Buy the ${previous.name} first!` }
  if (profile.wins < bike.cost) return { ok: false, error: 'Not enough Coins!' }
  profile.wins -= bike.cost
  profile.bikes.push(bikeId)
  profile.bike = bikeId
  return { ok: true, bought: true, bikeId }
}

export function equipBike(profile, bikeId) {
  if (!profile.bikes.includes(bikeId)) return { ok: false, error: 'You don’t own that bike' }
  profile.bike = bikeId
  return { ok: true, equipped: true, bikeId }
}

// --- Rebirth ------------------------------------------------------------------------

export const canRebirth = (profile) => profile.wins >= rebirthPrice(profile.rebirths)
/** 0..1 progress towards being able to rebirth. */
export const rebirthProgress = (profile) => Math.max(0, Math.min(1, profile.wins / rebirthPrice(profile.rebirths)))

/** Rebirth: +1 rebirth (another x1 on every Coin); Coins, bikes and upgrades reset. */
export function applyRebirth(profile) {
  const price = rebirthPrice(profile.rebirths)
  if (profile.wins < price) return { ok: false, error: 'Not enough Coins!' }
  profile.rebirths += 1
  profile.tutorialStep = TUTORIAL.length
  profile.wins = 0
  profile.bikes = [STARTER]
  profile.bike = STARTER
  profile.parts = {}
  profile.upgrades = { boost: 0, income: 0 }
  return { ok: true, rebirths: profile.rebirths }
}

// --- Worlds -------------------------------------------------------------------------

/** Whether you've reached the bottom of world `world` at least once. */
export const hasFinished = (profile, world) => (profile.stats.bestTime?.[world] || 0) > 0

/** Whether world `world` is open to you (Frost Ridge: once you've finished Pine Peak). */
export const isWorldOpen = (profile, world) => world === 0 || profile.world2Unlocked || hasFinished(profile, WORLD_PORTALS.world2.finish)

/**
 * Goes to world `world` (the WORLDS menu, or the portal): Frost Ridge opens for good the
 * first time, once you've reached the bottom of Pine Peak; home is always open.
 */
export function travel(profile, world) {
  if (!WORLDS[world]) return { ok: false, error: 'Unknown world' }
  if (!isWorldOpen(profile, world)) return { ok: false, error: `Reach the bottom of ${WORLDS[WORLD_PORTALS.world2.finish].name} first!` }
  if (profile.world === world) return { ok: true, world, same: true }
  const first = world === 1 && !profile.world2Unlocked
  if (world === 1) profile.world2Unlocked = true
  profile.world = world
  return { ok: true, world, first }
}

/** Steps through the world portal: from Pine Peak to Frost Ridge, or back. */
export const usePortal = (profile) => travel(profile, profile.world === 1 ? 0 : 1)

// --- Items, grants, rewards ---------------------------------------------------------

export function addItem(profile, itemId, amount = 1) {
  if (!ITEMS[itemId]) return
  profile.items[itemId] = (profile.items[itemId] || 0) + amount
}

export function usePotion(profile, itemId, now) {
  const item = ITEMS[itemId]
  if (!item || item.kind !== 'potion') return { ok: false, error: 'Not a potion' }
  if ((profile.items[itemId] || 0) <= 0) return { ok: false, error: 'None left' }
  profile.items[itemId] -= 1
  if (profile.items[itemId] <= 0) delete profile.items[itemId]
  // Stacks: a second potion extends the timer instead of wasting it.
  profile.boosts[item.boost] = Math.max(profile.boosts[item.boost] || 0, now) + item.durationMs
  return { ok: true, boost: item.boost, endsAt: profile.boosts[item.boost] }
}

/**
 * Pays a reward grant: { wins?, winsRides?, item?, amount? }. Returns what was given:
 * { ok, wins, items: [itemId...] }.
 */
export function applyGrant(profile, grant = {}) {
  const out = { ok: true, wins: 0, items: [] }
  let wins = 0
  if (grant.wins) wins += grant.wins
  if (grant.winsRides) wins += winsForRides(profile, grant.winsRides)
  if (wins > 0) {
    profile.wins += wins
    profile.stats.totalWins += wins
    out.wins = wins
  }
  if (grant.item) {
    const amount = grant.amount || 1
    addItem(profile, grant.item, amount)
    for (let i = 0; i < amount; i += 1) out.items.push(grant.item)
  }
  return out
}

/** The engage.js name for applyGrant. */
export const payReward = applyGrant

/**
 * State of each daily reward: 'claimed' | 'ready' | 'next' (with `unlocksIn` ms) |
 * 'locked'. A new 7-day cycle starts on first claim after the last one finishes.
 */
export function dailyStatus(profile, now) {
  const { start, claimed } = profile.daily
  const fresh = !start || claimed.length >= DAILY_REWARDS.length
  const cycleStart = fresh ? now : start
  let nextShown = false
  return DAILY_REWARDS.map((reward, day) => {
    if (!fresh && claimed.includes(day)) return { day, state: 'claimed' }
    const unlockAt = cycleStart + day * DAILY_INTERVAL_MS
    if (now >= unlockAt) return { day, state: 'ready' }
    if (!nextShown) {
      nextShown = true
      return { day, state: 'next', unlocksIn: unlockAt - now }
    }
    return { day, state: 'locked' }
  })
}

export function claimDaily(profile, day, now) {
  const status = dailyStatus(profile, now)[day]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  if (!profile.daily.start || profile.daily.claimed.length >= DAILY_REWARDS.length) profile.daily = { start: now, claimed: [] }
  profile.daily.claimed.push(day)
  return { ...applyGrant(profile, DAILY_REWARDS[day].grant), day, label: DAILY_REWARDS[day].label }
}

export function playtimeStatus(session, now) {
  const minutes = (now - session.start) / 60000
  return PLAYTIME_REWARDS.map((reward, index) => {
    if (session.playtimeClaimed.includes(index)) return { index, state: 'claimed' }
    if (minutes >= reward.minutes) return { index, state: 'ready' }
    return { index, state: 'locked', unlocksIn: (reward.minutes - minutes) * 60000 }
  })
}

export function claimPlaytime(profile, session, index, now) {
  const status = playtimeStatus(session, now)[index]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  session.playtimeClaimed.push(index)
  return { ...applyGrant(profile, PLAYTIME_REWARDS[index].grant), index, label: PLAYTIME_REWARDS[index].label }
}

export function claimFreeReward(profile, session) {
  if (session.freeRewardTaken) return { ok: false, error: 'Already claimed this session' }
  session.freeRewardTaken = true
  const grant = profile.freeRewardClaimed ? FREE_REWARD.repeat : FREE_REWARD.firstTime
  profile.freeRewardClaimed = true
  const result = applyGrant(profile, grant)
  return { ...result, grant, label: result.wins ? 'Free Coins' : ITEMS[grant.item]?.name || 'Free gift' }
}

// --- Shop ---------------------------------------------------------------------------

/** Buys a SHOP pass with Coins. */
export function buyShopItem(profile, productId) {
  const item = SHOP[productId]
  if (!item) return { ok: false, error: 'Unknown item' }
  if (profile.passes[productId]) return { ok: false, error: 'Already owned' }
  if (profile.wins < item.price) return { ok: false, error: 'Not enough Coins!' }
  profile.wins -= item.price
  profile.passes[productId] = true
  return { ok: true, productId, pass: true }
}

// --- Boxity Gems and rewarded ads ------------------------------------------------

/**
 * Grants Gems product `sku`, already paid for in Boxity. A pass you own already turns into
 * a Coin pack of the same worth, so nothing bought is ever wasted.
 */
export function applyGemProduct(profile, sku) {
  const product = GEM_PRODUCTS[sku]
  if (!product) return { ok: false, error: 'Unknown product' }
  const { grant } = product
  const result = { ok: true, sku, name: product.name, wins: 0 }
  if (grant.pass) {
    if (profile.passes[grant.pass]) result.wins += winsForRides(profile, 20)
    else {
      profile.passes[grant.pass] = true
      result.pass = grant.pass
    }
  }
  if (grant.winsRides) result.wins += winsForRides(profile, grant.winsRides)
  if (result.wins) {
    profile.wins += result.wins
    profile.stats.totalWins += result.wins
  }
  for (const [itemId, amount] of Object.entries(grant.items || {})) addItem(profile, itemId, amount)
  return result
}

/** A rewarded ad's prize for `placement`, if it's off cooldown (`session.adAt`). */
export function applyAdReward(profile, session, placement, now) {
  const reward = AD_REWARDS[placement]
  if (!reward) return { ok: false, error: 'Unknown reward' }
  session.adAt = session.adAt || {}
  if (now - (session.adAt[placement] || 0) < reward.cooldownMs) return { ok: false, error: 'Not ready yet' }
  session.adAt[placement] = now
  return { ...applyGrant(profile, reward.grant), placement, label: reward.label }
}

// --- Tutorial & badges ------------------------------------------------------------

/** Advances the tutorial if `event` completes the current step. */
export function advanceTutorial(profile, event) {
  const step = TUTORIAL[profile.tutorialStep]
  if (!step || step.event !== event) return false
  profile.tutorialStep += 1
  return true
}

/** Awards a badge once. Returns the badge if newly awarded. */
export function awardBadge(profile, id) {
  if (!BADGES[id] || profile.badges.includes(id)) return null
  profile.badges.push(id)
  return { id, ...BADGES[id] }
}
