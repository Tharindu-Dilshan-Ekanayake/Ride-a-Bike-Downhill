import assert from 'node:assert/strict'
import { test } from 'node:test'

import { AD_REWARDS, BIKES, GEM_PRODUCTS, PART_LEVELS, PARTS, rebirthMultiplier, rebirthPrice, TUTORIAL, UPGRADES, WORLDS } from '../../shared/balance.js'
import { formatDistance, formatNumber } from '../../shared/format.js'
import {
  applyAdReward,
  applyGemProduct,
  applyRebirth,
  applyRide,
  bikeStats,
  boostSeconds,
  buyBike,
  buyPart,
  buyShopItem,
  buyUpgrade,
  claimDaily,
  createProfile,
  createSession,
  distanceCoins,
  equipBike,
  normalizeProfile,
  partCost,
  travel,
  upgradeCost,
  usePortal,
  usePotion,
  winsMultiplier,
} from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { getTrack, ghostReach, hillLength, HILL_SHARE, roadY, TRACK_START, worldPoint } from '../../shared/track.js'
import { BIKE_STANDS, clampToWalkable, PLAZA, RIDE_ZONE, standAt, STATIC_COLLIDERS } from '../../shared/world.js'

const NOW = 1_700_000_000_000
const rich = (wins = 1e12) => Object.assign(createProfile('r', 'R'), { wins })

test('the road is the same every time, starts at the gate and runs downhill', () => {
  for (let w = 0; w < WORLDS.length; w += 1) {
    const a = getTrack(w)
    assert.equal(a.length, WORLDS[w].length)
    assert.equal(a.px[0], TRACK_START.x)
    assert.equal(a.pz[0], TRACK_START.z)
    assert.ok(roadY(a, a.length) < roadY(a, 0) - 100, 'it drops a long way')
    assert.ok(a.coinCount > 100 && a.obstacles.length > 20 && a.ramps.length > 0)
    // Coins sorted by metre (rides report their indices).
    for (let i = 1; i < a.coinCount; i += 1) assert.ok(a.coins[i * 3] >= a.coins[(i - 1) * 3])
    const p = worldPoint(a, 100, 3, 1, {})
    assert.ok(Number.isFinite(p.x + p.y + p.z))
  }
})

test('every bike crests exactly one more hill than the bike before it', () => {
  for (let w = 0; w < WORLDS.length; w += 1) {
    const track = getTrack(w)
    for (const hill of track.hills) {
      const gate = BIKES[hill.gate]
      const slower = BIKES[hill.gate - 1]
      assert.ok(Math.abs(hill.crest - hill.m - hillLength(HILL_SHARE * gate.top, hill.grade)) < 1)
      // The gate bike gets past this hill; the one before it rolls back on it, even with
      // a full tank of boost (boost only gets you back to your bike's top speed).
      assert.ok(ghostReach(track, gate.top) > hill.crest, `${WORLDS[w].name}: ${gate.name} crests the hill at ${hill.m}`)
      const stopped = ghostReach(track, slower.top, 6)
      assert.ok(stopped <= hill.crest, `${WORLDS[w].name}: ${slower.name} stops at ${stopped}, before the hill at ${hill.m}`)
    }
  }
})

test('a ride pays for metres, coins, flips and the finish, multiplied', () => {
  const p = createProfile('a', 'A')
  const track = getTrack(0)
  const coins = []
  for (let i = 0; i < track.coinCount; i += 1) if (track.coins[i * 3] < 300) coins.push(i)
  const r = applyRide(p, { distance: 300, coins, flips: 1, crashed: true, flew: 10 }, { now: NOW, elapsed: 40, world: 0 })
  assert.equal(r.distance, 300)
  assert.equal(r.picked, coins.length)
  assert.equal(r.parts.distance, Math.round(distanceCoins(0, 300)))
  assert.ok(r.parts.flips > 0 && r.parts.bail > 0 && r.parts.pickup > 0)
  assert.equal(p.wins, r.total)
  assert.equal(p.stats.best[0], 300)
  // Doubled by the pass.
  const q = createProfile('b', 'B')
  q.passes.winsX2 = true
  const r2 = applyRide(q, { distance: 300, coins, flips: 1, crashed: true, flew: 10 }, { now: NOW, elapsed: 40, world: 0 })
  assert.ok(Math.abs(r2.total - r.total * 2) <= 1)
})

test('a ride is held to what the bike could do in the time: no teleports, no fake coins', () => {
  const p = createProfile('c', 'C')
  const track = getTrack(0)
  const r = applyRide(p, { distance: 3000, finished: true, coins: [0, 0, 0, 1, 2, track.coinCount - 1, -4, 1e9] }, { now: NOW, elapsed: 2, world: 0 })
  assert.equal(r.finished, false)
  assert.ok(r.distance < 120, `distance clamped to ${r.distance}`)
  assert.ok(r.picked <= 3, 'each coin once, and only ones within the distance')
  // A real finish.
  const f = applyRide(createProfile('d', 'D'), { distance: track.length, finished: true, time: 200 }, { now: NOW, elapsed: 205, world: 0, bikeId: BIKES[7].id })
  assert.equal(f.finished, true)
  assert.equal(f.parts.finish, WORLDS[0].finishBonus)
  assert.equal(f.time, 200000)
  assert.equal(f.bestTime, true)
})

test('bikes are bought in order, with Coins, and equipped', () => {
  const p = rich(1000)
  assert.equal(buyBike(p, BIKES[2].id).ok, false, 'not before the one before it')
  assert.equal(buyBike(p, BIKES[1].id).ok, true)
  assert.equal(p.bike, BIKES[1].id)
  assert.equal(p.wins, 1000 - BIKES[1].cost)
  assert.equal(equipBike(p, BIKES[0].id).ok, true)
  assert.equal(equipBike(p, BIKES[5].id).ok, false)
  assert.equal(buyBike(rich(10), BIKES[1].id).ok, false, 'not without the Coins')
})

test('upgrades level up, cost more each time and change the ride', () => {
  const p = rich()
  const before = boostSeconds(p, NOW)
  const cost = upgradeCost(p, 'boost')
  assert.equal(buyUpgrade(p, 'boost').ok, true)
  assert.ok(upgradeCost(p, 'boost') > cost)
  assert.ok(boostSeconds(p, NOW) > before)
  const m = winsMultiplier(p, NOW)
  buyUpgrade(p, 'income')
  assert.ok(winsMultiplier(p, NOW) > m)
  p.upgrades.boost = UPGRADES.boost.max
  assert.equal(buyUpgrade(p, 'boost').ok, false, 'maxed out')
})

test('rebirth costs Coins, resets the run and multiplies every Coin after', () => {
  const p = rich(rebirthPrice(0) - 1)
  assert.equal(applyRebirth(p).ok, false)
  p.wins = rebirthPrice(0)
  buyBike(Object.assign(p, { wins: p.wins + 500 }), BIKES[1].id)
  buyUpgrade(p, 'income')
  assert.equal(applyRebirth(p).ok, true)
  assert.deepEqual([p.rebirths, p.wins, p.bikes, p.upgrades.income], [1, 0, [BIKES[0].id], 0])
  assert.equal(winsMultiplier(p, NOW), rebirthMultiplier(1))
  assert.ok(rebirthPrice(1) > rebirthPrice(0))
  assert.equal(p.tutorialStep, TUTORIAL.length)
})

test('Frost Ridge opens once you reach the bottom of Pine Peak, then stays open', () => {
  const p = rich()
  assert.equal(usePortal(p).ok, false)
  assert.equal(travel(p, 1).ok, false)
  // A finish of Pine Peak (the ride records its best time).
  applyRide(p, { distance: getTrack(0).length, finished: true, time: 300 }, { now: NOW, elapsed: 305, world: 0, bikeId: BIKES[23].id })
  assert.deepEqual(travel(p, 1), { ok: true, world: 1, first: true })
  assert.equal(usePortal(p).world, 0, 'home through the portal')
  assert.equal(travel(p, 1).first, false, 'open for good')
  assert.equal(travel(p, 7).ok, false)
})

test('garage parts: bought a level at a time on bikes you own, never enough for the next hill', () => {
  const p = rich()
  const bike = BIKES[3].id
  assert.equal(buyPart(p, bike, 'gears').ok, false, 'not on a bike you don’t own')
  for (let i = 1; i <= 3; i += 1) buyBike(p, BIKES[i].id)
  const stock = bikeStats(p, bike)
  const first = partCost(p, bike, 'tires')
  assert.equal(buyPart(p, bike, 'tires').ok, true)
  assert.ok(partCost(p, bike, 'tires') > first, 'each level costs more')
  assert.ok(bikeStats(p, bike).handling > stock.handling)
  for (const part of Object.keys(PARTS)) while (buyPart(p, bike, part).ok);
  assert.equal(partCost(p, bike, 'gears'), null, 'maxed')
  const tuned = bikeStats(p, bike)
  assert.ok(tuned.top > stock.top && tuned.landing > stock.landing && tuned.accel > 1 && tuned.smashKeep > stock.smashKeep)
  assert.equal(p.parts[bike].suspension, PART_LEVELS)
  // A fully tuned bike still rolls back on the next bike's hill.
  for (let w = 0; w < WORLDS.length; w += 1) {
    const track = getTrack(w)
    for (const hill of track.hills) {
      const slower = BIKES[hill.gate - 1]
      const maxed = slower.top * (1 + PARTS.gears.top * PART_LEVELS)
      assert.ok(ghostReach(track, maxed, 6) <= hill.crest, `${WORLDS[w].name}: a tuned ${slower.name} crests the hill at ${hill.m}`)
    }
  }
  // Parts survive a save, and go with the bikes at a rebirth.
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(p)), 'r', 'R').parts, p.parts)
  p.wins = rebirthPrice(0)
  applyRebirth(p)
  assert.deepEqual(p.parts, {})
})

test('passes, potions, daily rewards, ads and Gems', () => {
  const p = rich(1e9)
  assert.equal(buyShopItem(p, 'winsX2').ok, true)
  assert.equal(buyShopItem(p, 'winsX2').ok, false)
  p.items.potionWins = 1
  assert.equal(usePotion(p, 'potionWins', NOW).ok, true)
  assert.equal(usePotion(p, 'potionWins', NOW).ok, false)
  assert.equal(claimDaily(p, 0, NOW).ok, true)
  assert.equal(claimDaily(p, 1, NOW).ok, false)
  const session = createSession(NOW)
  const placement = Object.keys(AD_REWARDS)[0]
  assert.equal(applyAdReward(p, session, placement, NOW).ok, true)
  assert.equal(applyAdReward(p, session, placement, NOW + 1000).ok, false, 'cooldown')
  for (const sku of Object.keys(GEM_PRODUCTS)) assert.equal(applyGemProduct(p, sku).ok, true, sku)
  assert.equal(p.passes.magnet && p.passes.bigTank, true)
})

test('saves survive a round trip; saves from another game start fresh', () => {
  const p = rich(1234)
  buyBike(p, BIKES[1].id)
  const back = normalizeProfile(JSON.parse(JSON.stringify(p)), 'r', 'R')
  assert.deepEqual(back.bikes, p.bikes)
  assert.equal(back.wins, p.wins)
  const old = normalizeProfile({ v: 1, wins: 5e9, ownedTires: ['bicycle'] }, 'o', 'O')
  assert.equal(old.wins, 0)
})

test('the lobby: stands for every bike, the gate at the road, walls hold', () => {
  assert.equal(BIKE_STANDS.length, BIKES.length)
  for (const s of BIKE_STANDS) assert.equal(standAt(s.x, s.z), s.index)
  assert.ok(RIDE_ZONE.minZ === TRACK_START.z)
  const c = clampToWalkable(999, -999)
  assert.deepEqual([c.x, c.z], [PLAZA.maxX, PLAZA.minZ])
  assert.ok(STATIC_COLLIDERS.length > 5)
})

test('a session runs a ride end to end', () => {
  const events = []
  const p = createProfile('s', 'S')
  const s = new PlayerSession(p, { now: NOW, emit: (t, x) => events.push([t, x]), getPosition: () => ({ x: 0, y: 0, z: 40 }) })
  s.handle('rideEnd', { distance: 100 }, NOW)
  assert.equal(events.filter(([t]) => t === 'ride').length, 0, 'no ride without a start')
  s.handle('rideStart', {}, NOW)
  assert.ok(events.some(([t, x]) => t === 'rideGo' && x.boost >= 1))
  s.handle('rideEnd', { distance: 250, crashed: true }, NOW + 30000)
  const ride = events.find(([t]) => t === 'ride')[1]
  assert.equal(ride.distance, 250)
  assert.ok(p.wins > 0 && p.tutorialStep === 1 && p.badges.includes('firstRide'))
})

test('numbers read like the HUD', () => {
  assert.equal(formatNumber(1234), '1.2K')
  assert.equal(formatDistance(1050.7), '1,050 m')
})
