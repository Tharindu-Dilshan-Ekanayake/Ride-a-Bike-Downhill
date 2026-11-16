import assert from 'node:assert/strict'
import { test } from 'node:test'

import { crowdBonus, DAY_MS, LUCKY_CHANCE, QUEST_TYPES, QUESTS_PER_DAY, streakMultiplier } from '../../shared/balance.js'
import { applyStreak, claimQuest, claimQuestBonus, createQuestDay, ensureQuests, progressQuests, questsReady, rollLuckyGift } from '../../shared/engage.js'
import { createProfile, normalizeProfile, winsForRides, winsMultiplier } from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { SPAWN } from '../../shared/world.js'

const DAY = DAY_MS

/** A session (no lucky gifts unless `rand` says so), recording every event it emits. */
function makeSession({ profile = createProfile('p', 'P'), now = 10 * DAY, rand = () => 0.99, others = 0 } = {}) {
  const events = []
  const session = new PlayerSession(profile, { now, rand, getOthers: () => others, emit: (type, payload) => events.push({ type, payload }), getPosition: () => ({ x: SPAWN.x, y: 0, z: SPAWN.z }) })
  return { session, profile, events, of: (type) => events.filter((e) => e.type === type) }
}

/** Starts and ends a ride `seconds` long, reporting `report`. */
function ride(session, now, seconds, report) {
  session.handle('rideStart', {}, now)
  session.handle('rideEnd', report, now + seconds * 1000)
}

test('each day deals three quests: easy, medium, hard, all different, the same on every call', () => {
  const p = createProfile('player-1', 'P')
  const a = createQuestDay(p, 100)
  const b = createQuestDay(p, 100)
  assert.deepEqual(a, b)
  assert.equal(a.list.length, QUESTS_PER_DAY)
  assert.deepEqual(a.list.map((q) => q.tier), [0, 1, 2])
  assert.equal(new Set(a.list.map((q) => q.type)).size, QUESTS_PER_DAY)
  for (const q of a.list) assert.ok(QUEST_TYPES[q.type] && q.target > 0)
  const days = Array.from({ length: 6 }, (_, i) => createQuestDay(p, 101 + i).list.map((q) => q.type).join())
  assert.ok(days.some((d) => d !== a.list.map((q) => q.type).join()))
})

test('quests count what you do, finish once, and pay a reward that grows with you', () => {
  const p = createProfile('q', 'Q')
  const now = 50 * DAY
  ensureQuests(p, now)
  p.quests.list = [
    { type: 'rides', tier: 0, target: 3, progress: 0, claimed: false },
    { type: 'far', tier: 1, target: 100, progress: 0, claimed: false },
    { type: 'flips', tier: 2, target: 2, progress: 0, claimed: false },
  ]
  assert.deepEqual(progressQuests(p, 'ride', 2, now), [])
  assert.deepEqual(progressQuests(p, 'ride', 1, now), [0])
  assert.deepEqual(progressQuests(p, 'ride', 1, now), [], 'a finished quest stops counting')
  progressQuests(p, 'far', 60, now)
  progressQuests(p, 'far', 40, now)
  assert.equal(p.quests.list[1].progress, 60, '"best" quests keep the best single value')
  assert.equal(questsReady(p, now), true)
  const wins = p.wins
  assert.equal(claimQuest(p, 0, now).ok, true)
  assert.equal(p.wins - wins, winsForRides(p, 2))
  assert.equal(claimQuest(p, 0, now).ok, false, 'never twice')
  assert.equal(claimQuest(p, 1, now).ok, false, 'not before it is finished')
  progressQuests(p, 'flip', 2, now)
  assert.equal(claimQuestBonus(p, now).ok, false)
  progressQuests(p, 'far', 100, now)
  claimQuest(p, 1, now)
  assert.deepEqual(claimQuest(p, 2, now).items, ['potionWins'], 'the HARD one pays a potion too')
  const chest = claimQuestBonus(p, now)
  assert.equal(chest.ok, true)
  assert.deepEqual(chest.items, ['potionBoost'])
  assert.equal(claimQuestBonus(p, now).ok, false)
  assert.equal(ensureQuests(p, now + DAY), true)
  assert.ok(p.quests.list.every((q) => q.progress === 0 && !q.claimed) && !p.quests.bonus)
})

test('the login streak grows day by day, survives a refresh and resets after a missed day', () => {
  const p = createProfile('s', 'S')
  assert.deepEqual([applyStreak(p, 10 * DAY).days, applyStreak(p, 10 * DAY + 5000).days], [1, 1])
  assert.equal(applyStreak(p, 11 * DAY).days, 2)
  assert.equal(applyStreak(p, 12 * DAY + 100).days, 3)
  assert.ok(Math.abs(winsMultiplier(p, 12 * DAY) - streakMultiplier(3)) < 1e-9)
  assert.equal(streakMultiplier(50), 2, 'capped at x2')
  const broken = applyStreak(p, 14 * DAY)
  assert.deepEqual([broken.days, broken.broke], [1, true])
  assert.equal(p.streak.best, 3)
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(p)), 's', 'S').streak, p.streak)
})

test('friends in the server pay a bonus on every ride', () => {
  assert.ok(Math.abs(crowdBonus(2) - 1.2) < 1e-9)
  assert.equal(crowdBonus(10), 1.3)
  const report = { distance: 300, crashed: true }
  const solo = makeSession()
  const crowd = makeSession({ others: 2 })
  ride(solo.session, 10 * DAY, 40, report)
  ride(crowd.session, 10 * DAY, 40, report)
  const a = solo.of('ride')[0].payload.total
  const b = crowd.of('ride')[0].payload.total
  assert.ok(Math.abs(b - a * 1.2) <= 1, `${b} vs ${a} x1.2`)
  assert.equal(crowd.of('ride')[0].payload.others, 2)
})

test('lucky gifts land LUCKY_CHANCE of the time and pay out', () => {
  const p = createProfile('l', 'L')
  assert.equal(rollLuckyGift(p, () => LUCKY_CHANCE + 0.01), null)
  const rolls = [LUCKY_CHANCE / 2, 0]
  const gift = rollLuckyGift(p, () => rolls.shift())
  assert.ok(gift && gift.label)
  assert.ok(gift.wins > 0 || gift.items.length > 0)
  const { session, of } = makeSession({ rand: () => 0 })
  ride(session, 10 * DAY, 30, { distance: 200 })
  assert.ok(of('ride')[0].payload.gift, 'the ride event carries the gift')
})

test('the session feeds quests from rides and tells the client when one is done', () => {
  const profile = createProfile('feed', 'F')
  const { session, of } = makeSession({ profile })
  profile.quests.list[0] = { type: 'rides', tier: 0, target: 2, progress: 0, claimed: false }
  ride(session, 10 * DAY, 30, { distance: 200 })
  ride(session, 10 * DAY + 60000, 30, { distance: 250 })
  assert.equal(of('quest').length, 1)
  assert.equal(of('quest')[0].payload.index, 0)
  const wins = profile.wins
  session.handle('claimQuest', { index: 0 }, 10 * DAY + 200000)
  assert.ok(profile.wins > wins)
  assert.equal(of('reward').length, 1)
  assert.equal(session.session.streak.days, 1)
})
