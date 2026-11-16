import { crowdBonus, dayNumber, SHOP, SPEED_DEMON } from './balance.js'
import { applyStreak, claimQuest, claimQuestBonus, ensureQuests, progressQuests, questText, rollLuckyGift } from './engage.js'
import {
  advanceTutorial,
  applyAdReward,
  applyGemProduct,
  applyRebirth,
  applyRide,
  awardBadge,
  boostSeconds,
  buyBike,
  buyPart,
  buyShopItem,
  buyUpgrade,
  claimDaily,
  claimFreeReward,
  claimPlaytime,
  createSession,
  equipBike,
  pickupRadius,
  travel,
  usePortal,
  usePotion,
} from './logic.js'
import { FREE_REWARD, portalAt } from './world.js'

/** Quest progress is sent at least this often (seconds) while it's changing. */
const QUEST_SYNC = 5
/** A ride nobody ended after this long is forgotten (ms). */
const RIDE_TIMEOUT_MS = 20 * 60 * 1000

/**
 * One player's authoritative session: validates intents, runs the slow tick and reports
 * what happened through `emit`.
 *
 * Transport-agnostic on purpose. The Colyseus room wraps one of these per client; the
 * offline mode wraps one for the local player. Either way the rules that run are
 * byte-for-byte the same.
 *
 * Events emitted (type, payload):
 * - 'profile'  { profile, session }  full state, after anything structural
 * - 'rideGo'   { world, boost, pickup }  a ride may start: its boost seconds and pickup radius
 * - 'ride'     the checked, paid result of a ride (logic.applyRide) + { gift, others }
 * - 'badge'    { id, name }
 * - 'reward'   { label, wins? }  an ad reward, Gems purchase or quest landed
 * - 'world'    { world, first }  stepped through the portal into `world`
 * - 'quest'    { index, text }  one of today's quests just finished (claim it in Quests)
 * - 'streak'   { days, broke, multiplier }  a new day of the login streak while playing
 *
 * `onRide(result)` lets the host tell other players about a ride.
 */
export class PlayerSession {
  /**
   * @param {object} profile normalized profile (see logic.normalizeProfile)
   * @param {{ now: number, emit: (type: string, payload?: object) => void,
   *           getPosition: () => {x: number, y: number, z: number},
   *           onRide?: (result: object) => void, getOthers?: () => number,
   *           rand?: () => number }} options
   *   `getOthers` says how many other players share your server and world (the friends bonus).
   */
  constructor(profile, { now, emit, getPosition, onRide, getOthers, rand = Math.random }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.getPosition = getPosition
    this.onRide = onRide
    this.getOthers = getOthers
    this.rand = rand

    // Coming back: today counts into the login streak (the client shows the news from
    // the session state) and today's quests are dealt.
    this.session.streak = applyStreak(profile, now)
    ensureQuests(profile, now)
    this.day = dayNumber(now)
    /** Seconds played towards the next "play for N minutes" quest minute. */
    this.minuteTimer = 0
    /** Quest progress not yet sent, and seconds since it last was. */
    this.questsChanged = false
    this.questSync = 0
    /** The ride in progress: { world, start, bikeId }, or null. */
    this.ride = null
    this.dirty = false
  }

  // --- Plumbing --------------------------------------------------------------------

  sendProfile() {
    this.dirty = false
    this.questsChanged = false
    this.questSync = 0
    this.emit('profile', { profile: this.profile, session: this.session })
  }

  badge(id) {
    const badge = awardBadge(this.profile, id)
    if (badge) {
      this.dirty = true
      this.emit('badge', badge)
    }
  }

  tutorial(event) {
    if (advanceTutorial(this.profile, event)) this.dirty = true
  }

  /** Counts towards today's quests, and tells the client about any just finished. */
  quest(counter, amount, now) {
    if (!(amount > 0)) return
    const finished = progressQuests(this.profile, counter, amount, now)
    this.questsChanged = true
    if (finished.length) this.dirty = true
    for (const index of finished) this.emit('quest', { index, text: questText(this.profile.quests.list[index]) })
  }

  /** Whether a ride is under way (the host shows the player on the road meanwhile). */
  get riding() {
    return this.ride !== null
  }

  // --- Intents ---------------------------------------------------------------------

  /** Dispatches one client message. Unknown types are ignored. */
  handle(type, payload = {}, now) {
    const handler = this.handlers[type]
    if (!handler) return
    handler.call(this, payload || {}, now)
    if (this.dirty) this.sendProfile()
  }

  handlers = {
    /** Off down the mountain: from now on the clock runs on what a ride can earn. */
    rideStart(_payload, now) {
      const world = this.profile.world || 0
      this.ride = { world, start: now, bikeId: this.profile.bike }
      this.emit('rideGo', { world, boost: boostSeconds(this.profile, now), pickup: pickupRadius(this.profile) })
    },

    /** The ride is over (crashed, rolled back, finished or ended): check it and pay. */
    rideEnd(report, now) {
      const ride = this.ride
      if (!ride) return
      this.ride = null
      const others = Math.max(0, Math.floor(this.getOthers?.() || 0))
      const result = applyRide(this.profile, report, {
        now,
        elapsed: (now - ride.start) / 1000,
        world: ride.world,
        bikeId: ride.bikeId,
        bonus: crowdBonus(others),
      })
      const gift = rollLuckyGift(this.profile, this.rand)
      this.emit('ride', { ...result, gift, others })
      this.onRide?.(result)
      this.quest('ride', 1, now)
      this.quest('meters', result.distance, now)
      this.quest('far', result.distance, now)
      this.quest('coin', result.picked, now)
      this.quest('flip', result.flips, now)
      this.quest('smash', result.smashed, now)
      this.quest('pad', result.pads, now)
      this.dirty = true
      this.tutorial('ride')
      this.badge('firstRide')
      if (result.distance >= 1000) this.badge('kilometer')
      if (result.finished) this.badge('firstFinish')
      if (result.flips > 0) this.badge('flipper')
      if (this.profile.stats.topSpeed >= SPEED_DEMON) this.badge('speedDemon')
    },

    buyBike({ id }) {
      const result = buyBike(this.profile, id)
      if (!result.ok) return
      this.dirty = true
      if (result.bought) this.tutorial('buyBike')
    },

    equipBike({ id }) {
      if (equipBike(this.profile, id).ok) this.dirty = true
    },

    /** One level of a GARAGE part (tires, suspension, gears) on a bike you own. */
    upgradePart({ bikeId, part }) {
      if (buyPart(this.profile, String(bikeId), String(part)).ok) this.dirty = true
    },

    /** The WORLDS menu: off to another mountain (Frost Ridge once Pine Peak is finished). */
    travel({ world }) {
      if (this.ride) return
      const result = travel(this.profile, Number(world))
      if (!result.ok || result.same) return
      this.dirty = true
      if (result.world === 1) this.badge('world2')
      this.emit('world', { world: result.world, first: Boolean(result.first) })
    },

    upgrade({ key }) {
      if (!buyUpgrade(this.profile, key).ok) return
      this.dirty = true
      this.tutorial('upgrade')
    },

    rebirth() {
      const result = applyRebirth(this.profile)
      if (!result.ok) return
      this.dirty = true
      if (this.profile.rebirths === 1) this.badge('firstRebirth')
    },

    usePotion({ itemId }, now) {
      if (usePotion(this.profile, itemId, now).ok) this.dirty = true
    },

    claimDaily({ day }, now) {
      this.afterReward(claimDaily(this.profile, Number(day), now))
    },

    claimPlaytime({ index }, now) {
      this.afterReward(claimPlaytime(this.profile, this.session, Number(index), now))
    },

    claimFreeReward() {
      const p = this.getPosition()
      if (Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) > FREE_REWARD.radius + 1.5) return
      this.afterReward(claimFreeReward(this.profile, this.session))
    },

    portal() {
      const p = this.getPosition()
      const portal = portalAt(p.x, p.z, 2)
      if (!portal) return
      if (this.ride) return
      const result = usePortal(this.profile)
      if (!result.ok || result.same) return
      this.dirty = true
      if (result.world === 1) this.badge(portal.id)
      this.emit('world', { world: result.world, first: Boolean(result.first) })
    },

    claimQuest({ index }, now) {
      const result = claimQuest(this.profile, Number(index), now)
      if (!result.ok) return
      this.dirty = true
      this.emit('reward', { label: result.label, wins: result.wins, items: result.items })
    },

    claimQuestBonus(_payload, now) {
      const result = claimQuestBonus(this.profile, now)
      if (!result.ok) return
      this.dirty = true
      this.emit('reward', { label: result.label, wins: result.wins, items: result.items })
    },

    /** Buys a SHOP pass with Coins. */
    purchase({ productId }) {
      if (!SHOP[productId]) return
      if (buyShopItem(this.profile, productId).ok) this.dirty = true
    },
  }

  // --- Granted by the host, never by a client message --------------------------------

  /** A rewarded ad the host has verified with Boxity (or, offline, that Boxity reported watched). */
  grantAdReward(placement, now) {
    const result = applyAdReward(this.profile, this.session, placement, now)
    if (!result.ok) return result
    this.dirty = true
    this.emit('reward', { label: result.label, wins: result.wins })
    this.sendProfile()
    return result
  }

  /** A Gems purchase Boxity has confirmed (its webhook, recorded by the host). */
  grantGemProduct(sku) {
    const result = applyGemProduct(this.profile, sku)
    if (!result.ok) return result
    this.dirty = true
    this.emit('reward', { label: result.name, wins: result.wins || 0 })
    this.sendProfile()
    return result
  }

  afterReward(result) {
    if (!result?.ok) return
    this.dirty = true
    this.emit('reward', { label: result.label, wins: result.wins || 0, items: result.items })
  }

  // --- Simulation ------------------------------------------------------------------

  /** Advances the slow clock. Call at a steady rate (the room's simulation interval). */
  tick(dt, now) {
    this.profile.stats.playtime += dt
    if (this.ride && now - this.ride.start > RIDE_TIMEOUT_MS) this.ride = null
    // A minute played towards today's quests; and past midnight, a new day: fresh
    // quests and the next day of the streak.
    this.minuteTimer += dt
    if (this.minuteTimer >= 60) {
      this.minuteTimer -= 60
      this.quest('minute', 1, now)
    }
    this.questSync += dt
    if (this.questsChanged && this.questSync >= QUEST_SYNC) this.dirty = true
    const day = dayNumber(now)
    if (day !== this.day) {
      this.day = day
      if (ensureQuests(this.profile, now)) this.dirty = true
      const streak = applyStreak(this.profile, now)
      if (streak.changed) {
        this.session.streak = streak
        this.dirty = true
        this.emit('streak', streak)
      }
    }
    if (this.dirty) this.sendProfile()
  }
}
