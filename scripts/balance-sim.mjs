/**
 * Plays Bike Hill Rush with the real rules (shared/logic.js, shared/track.js) as a
 * sensible free player and prints the pacing: when each bike, rebirth and Frost Ridge
 * arrive, and how long a ride takes. Run it after any change to shared/balance.js:
 *
 *   node scripts/balance-sim.mjs [hours=4]
 *
 * The player: rides until the first hill its bike (and boost) can't crest - a decent
 * rider, crashing somewhere between halfway and the hill on most rides - picking up most
 * of the coins on the way and landing the odd flip; then spends: the next bike first,
 * then whichever of Boost / Income is cheaper if it's well under the next bike's price;
 * rebirths as soon as it can; goes to Frost Ridge (open once Pine Peak is finished)
 * whenever it pays better. (Garage parts aren't bought: they don't change how far you get.)
 * No potions, passes, daily rewards or ads: a free player's floor.
 */
import { BIKES, rebirthPrice, WORLDS } from '../shared/balance.js'
import { formatDistance, formatNumber } from '../shared/format.js'
import { applyRebirth, applyRide, boostSeconds, bikeById, buyBike, buyUpgrade, createProfile, isWorldOpen, nextBike, travel, upgradeCost } from '../shared/logic.js'
import { mulberry32 } from '../shared/rng.js'
import { getTrack, ghostReach } from '../shared/track.js'

const HOURS = Number(process.argv[2]) || 4
/** Countdown, results screen and the walk back to the gate, per ride (s). */
const OVERHEAD = 12
/** Share of the coins in reach picked up, and how often a flip is landed (per metre). */
const PICKUP = 0.6
const FLIP_EVERY = 450

const rand = mulberry32(42)
const p = createProfile('sim', 'Sim')
let t = 0
let rides = 0
const log = []
const note = (text) => log.push(`${(t / 60).toFixed(1).padStart(6)} min  ${text}`)

/** How far a ride gets: up to the first hill out of reach, crashing on the way most times. */
function rideDistance(world) {
  const track = getTrack(world)
  const reach = ghostReach(track, bikeById(p.bike).top, boostSeconds(p, 0))
  const crash = rand() < 0.75
  return { distance: crash ? reach * (0.5 + 0.5 * rand()) : reach, crashed: crash, finished: !crash && reach >= track.length, reach }
}

/** Which world pays better per minute for this profile right now. */
function bestWorld() {
  if (!p.world2Unlocked) return 0
  let best = 0
  let bestRate = -1
  for (let w = 0; w < WORLDS.length; w += 1) {
    const reach = ghostReach(getTrack(w), bikeById(p.bike).top, boostSeconds(p, 0))
    const probe = applyRide(structuredClone(p), { distance: reach * 0.75 }, { now: 0, elapsed: 9999, world: w })
    const rate = probe.total / (reach / (bikeById(p.bike).top * 0.75) + OVERHEAD)
    if (rate > bestRate) {
      bestRate = rate
      best = w
    }
  }
  return best
}

let lastRide = null
while (t < HOURS * 3600) {
  const world = p.world
  const track = getTrack(world)
  const { distance, crashed, finished } = rideDistance(world)
  const time = distance / (bikeById(p.bike).top * 0.78)
  const coins = []
  for (let i = 0; i < track.coinCount; i += 1) if (track.coins[i * 3] <= distance && rand() < PICKUP) coins.push(i)
  const result = applyRide(p, { distance, crashed, finished, coins, flips: Math.floor(distance / FLIP_EVERY), flew: crashed ? 8 : 0, time }, { now: 0, elapsed: time + 3, world })
  t += time + OVERHEAD
  rides += 1
  lastRide = { distance: result.distance, total: result.total, time }
  if (result.newZones.length) note(`reached ${WORLDS[world].zones[result.zone].name} (${formatDistance(result.distance)}) in ${WORLDS[world].name}`)
  if (result.finished && result.bestTime) note(`FINISHED ${WORLDS[world].name} in ${(result.time / 1000).toFixed(1)} s`)

  // Spend.
  for (;;) {
    const next = nextBike(p)
    if (next && p.wins >= next.cost) {
      buyBike(p, next.id)
      note(`bike ${BIKES.indexOf(next) + 1}: ${next.name} (${formatNumber(next.cost)})  [ride ${rides}, ${formatNumber(lastRide.total)}/ride]`)
      continue
    }
    const key = upgradeCost(p, 'boost') <= upgradeCost(p, 'income') ? 'boost' : 'income'
    const budget = next ? next.cost * 0.3 : Infinity
    if (upgradeCost(p, key) <= Math.min(p.wins, budget) && buyUpgrade(p, key).ok) continue
    break
  }
  if (p.wins >= rebirthPrice(p.rebirths)) {
    applyRebirth(p)
    note(`REBIRTH ${p.rebirths} (now x${p.rebirths + 1})  [ride ${rides}]`)
    p.world = 0
  }
  if (!p.world2Unlocked && isWorldOpen(p, 1)) {
    travel(p, 1)
    note(`FROST RIDGE opens`)
  }
  p.world = bestWorld()
}

console.log(log.join('\n'))
console.log(`\nafter ${HOURS} h: ${rides} rides (${(HOURS * 60 / rides * 60).toFixed(0)} s each), ${p.rebirths} rebirths, best bike ${bikeById(p.bike).name}, ${formatNumber(p.wins)} coins`)
console.log(`last ride: ${formatDistance(lastRide.distance)} in ${lastRide.time.toFixed(0)} s, ${formatNumber(lastRide.total)} coins`)
