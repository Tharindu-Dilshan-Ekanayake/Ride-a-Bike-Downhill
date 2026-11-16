/**
 * Every tunable number in Bike Hill Rush. Rules live in logic.js and the track in
 * track.js; this file is only data, so balancing never means touching code.
 * `scripts/balance-sim.mjs` plays the game with these numbers and prints the pacing.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 *
 * The loop: ride down the mountain (steer, boost, jump, dodge) -> Coins for every metre,
 * every coin picked up, flips and smashes -> faster bikes (24 of them: each one carries
 * enough speed to crest one more hill) and Boost / Income upgrades -> rebirth for a bigger
 * Coin multiplier -> Frost Ridge, the second mountain.
 *
 * Inside the code the currency is still called `wins` (the platform's leaderboard id);
 * players only ever see "Coins".
 */

// --- Physics (shared so the server can bound what a ride could possibly do) ---------

export const PHYSICS = {
  /** Gravity along climbs and in the air (m/s^2). Snappier than Earth's. */
  gravity: 18,
  /** Rolling resistance on climbs (m/s^2). */
  roll: 0.15,
  /** Downhill: speed chases slope target at this share of top speed per second. */
  accelShare: 0.28,
  /** Above the target speed (after a steep drop or a boost pad) it decays this fast (1/s). */
  decay: 0.55,
  /** Grade (down) at which a bike reaches its top speed. ~7 degrees. */
  refGrade: 0.12,
  /** On the flat a bike cruises at this share of its top speed. */
  flatShare: 0.64,
  /** Steep drops push past top speed, up to this share. */
  steepShare: 1.12,
  /** Climbs steeper than this grade use climb physics (momentum only). */
  climbGrade: 0.035,
  /** Pedalling up a climb below this speed (m/s): no help - hills are crested on momentum. */
  pedalSpeed: 4,
  pedal: 0,
  /** Brake deceleration (m/s^2). */
  brake: 11,
  /**
   * Boost gets you back to your bike's top speed fast, on any slope - after a crate, the
   * grass, a corner - but never past it, and it can't push you up a hill: only a faster
   * bike carries you over one.
   */
  boostShare: 1,
  boostRate: 3,
  /** Grass shoulder: target speed share. */
  grassShare: 0.62,
  /** Below this speed on a climb you roll back: OUT OF SPEED. */
  stallSpeed: 0.9,
  /** Bunny hop: vertical speed added (m/s). */
  hop: 6.2,
  /** Boost pad: speed added (m/s), the most it takes you to (share of top speed), boost refilled (s). */
  padSpeed: 6,
  padCap: 1.2,
  padRefill: 0.35,
  /** Coin pickup radius (m), and with the Coin Magnet. */
  pickup: 1.5,
  magnetPickup: 3.4,
}

/** Two significant figures: prices read cleanly (2,300, not 2,317). */
export function niceRound(n) {
  if (n < 100) return Math.max(1, Math.round(n))
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / step) * step
}

/** Two significant figures, small values too (0.38, 1.4, 27). */
const sig2 = (n) => (n >= 100 ? niceRound(n) : Number(n.toPrecision(2)))

// --- Bikes ------------------------------------------------------------------------

/** Each bike is this much faster than the one before it. */
export const BIKE_SPEED_STEP = 1.075
/** The first bike's top speed (m/s), and how much more each bike costs than the last. */
const FIRST_TOP = 12
const FIRST_COST = 60
const COST_STEP = 2.7

/** [id, name, look (bikeModels.js), paint, accent] - cheapest first. */
const BIKE_LIST = [
  ['hand-me-down', 'Hand-Me-Down', 'cruiser', '#7cc4ff', '#f6e7c8'],
  ['paper-route', 'Paper Route', 'city', '#ff7a59', '#ffe3b0'],
  ['puddle-jumper', 'Puddle Jumper', 'bmx', '#facc15', '#1f2937'],
  ['trail-pup', 'Trail Pup', 'bmx', '#4ade80', '#1f2937'],
  ['gravel-grinder', 'Gravel Grinder', 'road', '#fb923c', '#1f2937'],
  ['sunset-cruiser', 'Sunset Cruiser', 'cruiser', '#f472b6', '#fde68a'],
  ['ridge-runner', 'Ridge Runner', 'mtb', '#38bdf8', '#0f172a'],
  ['pine-shredder', 'Pine Shredder', 'mtb', '#16a34a', '#fef08a'],
  ['mud-monster', 'Mud Monster', 'fat', '#b7791f', '#1c1917'],
  ['rock-hopper', 'Rock Hopper', 'fat', '#64748b', '#f97316'],
  ['storm-chaser', 'Storm Chaser', 'dh', '#6366f1', '#e0e7ff'],
  ['thunder-fork', 'Thunder Fork', 'dh', '#eab308', '#1e1b4b'],
  ['volt-glider', 'Volt Glider', 'ebike', '#22d3ee', '#083344'],
  ['neon-rider', 'Neon Rider', 'ebike', '#a3e635', '#3b0764'],
  ['blaze-fork', 'Blaze Fork', 'dh', '#ef4444', '#fde047'],
  ['glacier-ghost', 'Glacier Ghost', 'mtb', '#e0f2fe', '#0ea5e9'],
  ['comet-carbon', 'Comet Carbon', 'road', '#1f2937', '#f97316'],
  ['solar-flare', 'Solar Flare', 'road', '#f59e0b', '#7c2d12'],
  ['aurora-x', 'Aurora X', 'ebike', '#c084fc', '#fdf4ff'],
  ['meteor-mk2', 'Meteor Mk II', 'dh', '#dc2626', '#111827'],
  ['nebula-drift', 'Nebula Drift', 'ebike', '#7c3aed', '#f0abfc'],
  ['quantum-spoke', 'Quantum Spoke', 'road', '#0f766e', '#5eead4'],
  ['starfall', 'Starfall', 'jet', '#1e3a8a', '#fde047'],
  ['hyperdrive', 'Hyperdrive', 'jet', '#f472b6', '#38bdf8'],
]
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

/**
 * The bikes, bought in order at the bike shop. `top` is top speed in m/s (shown in km/h):
 * each bike carries just enough speed to crest one more of the mountains' hills than the
 * bike before it. `handling` is how fast it turns (rad/s), `landing` the hardest landing
 * (m/s into the ground) it survives. `cost` is in Coins.
 */
export const BIKES = BIKE_LIST.map(([id, name, model, color, accent], i) => ({
  id,
  name,
  model,
  color,
  accent,
  top: Math.round(FIRST_TOP * BIKE_SPEED_STEP ** i * 10) / 10,
  handling: Math.round((1.5 + 0.04 * i) * 100) / 100,
  landing: 9 + 0.5 * i,
  cost: i === 0 ? 0 : niceRound(FIRST_COST * COST_STEP ** (i - 1)),
  rarity: RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, Math.floor(i / 4))],
}))

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
}

/** m/s to the km/h the HUD shows. */
export const KMH = 3.6

// --- Upgrades -------------------------------------------------------------------

/**
 * Bought with Coins from the cards under the PLAY button, a level at a time.
 *  boost  - seconds of boost per ride (Shift / the BOOST button): back to full speed
 *  income - multiplies every Coin a ride pays
 */
export const UPGRADES = {
  boost: { name: 'Boost', max: 20, base: 120, growth: 1.6, value: (level) => 1 + 0.25 * level, unit: 's' },
  income: { name: 'Income', max: 40, base: 100, growth: 1.55, value: (level) => 1 + 0.1 * level, unit: 'x' },
}

// --- Rebirth ----------------------------------------------------------------------

/**
 * Rebirthing costs Coins (held, then spent) and resets your Coins, bikes and upgrades;
 * every rebirth adds x1 to every Coin you earn, for good.
 */
export const REBIRTH_BASE = 1500000
export const REBIRTH_GROWTH = 3
export const rebirthPrice = (rebirths) => niceRound(REBIRTH_BASE * REBIRTH_GROWTH ** Math.max(0, rebirths))
export const rebirthMultiplier = (rebirths) => 1 + Math.max(0, rebirths)

// --- The hills ----------------------------------------------------------------------

/**
 * Every zone after a world's first opens with a HILL. Its `gate` bike, arriving at its
 * own top speed, carries `share` of that speed's momentum: just enough to crest it; the
 * bike before it (BIKE_SPEED_STEP slower) rolls back near the top. Over the crest a short
 * plateau, then a steep drop.
 */
export const HILL = { share: 0.97, crest: 14, drop: 30, dropGrade: -0.32, finishRun: 90 }
/** How steep the hill for bike `gate` is (steeper for faster bikes, so it stays short). */
export const hillGrade = (gate) => 0.18 + 0.006 * gate

/** Horizontal length of a hill of `grade` that a bike arriving at `speed` m/s just crests. */
export function hillLength(speed, grade) {
  const sin = grade / Math.sqrt(1 + grade * grade)
  const decel = PHYSICS.gravity * sin + PHYSICS.roll
  return (speed * speed) / (2 * decel) / Math.sqrt(1 + grade * grade)
}

/** The hill for bike `gate`, in whole metres (its foot and crest are exact: run-up and hill aren't smoothed). */
export const hillSpan = (gate) => Math.round(hillLength(HILL.share * BIKES[gate].top, hillGrade(gate)))

/**
 * The straight, steady run-up into a hill: long enough that any extra speed from a drop
 * or a boost pad before it has died away, so every bike meets the hill at its own top
 * speed.
 */
export const runUpLength = (top) => Math.round(60 + 5 * top)

// --- Worlds and their mountains ---------------------------------------------------

/**
 * Each world is one long mountain road, split into zones. A zone after the first starts
 * with its gate bike's hill; then the zone's own stretch (`body` metres of bends, drops,
 * rollers, ramps and obstacles - busier with `density`); then the run-up into the next
 * zone's hill (or the finish straight). `coinsPerMeter` pays for every metre ridden in the
 * zone, `coin` is what each coin picked up there is worth.
 *
 * `start` and `length` (metres along the road) are worked out from the hills, so the
 * client, the server and the track generator always agree.
 */
function buildWorld({ id, name, theme, seed, pay, names, firstGate, zeroLevel, payBase, payGrowth, firstBody, body, density }) {
  const gateOf = (z) => (z === 0 ? -1 : firstGate + z - 1)
  let start = 0
  const zones = names.map(([zoneId, zoneName], z) => {
    const gate = gateOf(z)
    const next = z + 1 < names.length ? gateOf(z + 1) : null
    const hill = gate >= 0 ? hillSpan(gate) + HILL.crest + HILL.drop : 0
    const stretch = z === 0 ? firstBody : body(z)
    const tail = next === null ? HILL.finishRun : runUpLength(BIKES[next].top)
    const coinsPerMeter = sig2(payBase * payGrowth ** (gate >= 0 ? gate : zeroLevel))
    const zone = {
      id: zoneId,
      name: zoneName,
      start,
      length: hill + stretch + tail,
      gate,
      coinsPerMeter,
      coin: Math.max(1, niceRound(coinsPerMeter * 5)),
      density: Math.min(0.95, density(z)),
    }
    start += zone.length
    return zone
  })
  const last = zones[zones.length - 1]
  return { id, name, theme, seed, pay, zones, length: start, finishBonus: niceRound(last.coinsPerMeter * 2500) }
}

export const WORLDS = [
  buildWorld({
    id: 'pine',
    name: 'Pine Peak',
    theme: 'pine',
    seed: 1337,
    pay: 1,
    firstGate: 1,
    zeroLevel: 0,
    payBase: 0.2,
    payGrowth: 1.9,
    firstBody: 70,
    body: (z) => 170 + 6 * z,
    density: (z) => 0.38 + 0.045 * z,
    names: [
      ['summit', 'Summit Run'],
      ['pines', 'Pine Forest'],
      ['meadow', 'Hay Meadows'],
      ['rocky', 'Rocky Bend'],
      ['cabin', 'Log Cabin Lane'],
      ['mud', 'Mudslide'],
      ['waterfall', 'Waterfall Way'],
      ['thunder', 'Thunder Drop'],
      ['eagle', 'Eagle Ridge'],
      ['fox', 'Fox Hollow'],
      ['mill', 'Old Mill'],
      ['canyon', 'Canyon Rim'],
      ['valley', 'Valley Bottom'],
    ],
  }),
  buildWorld({
    id: 'frost',
    name: 'Frost Ridge',
    theme: 'frost',
    seed: 9001,
    pay: 2,
    firstGate: 9,
    zeroLevel: 4,
    payBase: 0.6,
    payGrowth: 1.78,
    firstBody: 120,
    body: (z) => 160 + 5 * z,
    density: (z) => 0.5 + 0.03 * z,
    names: [
      ['glacier', 'Glacier Gate'],
      ['snowpines', 'Snowy Pines'],
      ['icefall', 'Icefall'],
      ['yeti', 'Yeti Hollow'],
      ['blizzard', 'Blizzard Pass'],
      ['lake', 'Frozen Lake'],
      ['crystal', 'Crystal Caves'],
      ['penguin', 'Penguin Point'],
      ['aurora', 'Aurora Slope'],
      ['palace', 'Ice Palace'],
      ['avalanche', 'Avalanche Run'],
      ['polar', 'Polar Peak'],
      ['frostbite', 'Frostbite Falls'],
      ['snowstorm', 'Snowstorm Alley'],
      ['dust', 'Diamond Dust'],
      ['summit2', 'Sky Summit'],
    ],
  }),
]

/**
 * What opens Frost Ridge the first time: reaching the bottom of world `finish` (Pine
 * Peak). After that it's open for good, through the portal or the WORLDS menu.
 */
export const WORLD_PORTALS = {
  world2: { name: 'Frost Ridge', finish: 0 },
}

// --- Bike parts (the GARAGE) ------------------------------------------------------------

/**
 * Every bike can be tuned at the GARAGE, part by part, up to PART_LEVELS levels each.
 * Per level:
 *  tires      - turning +6%, and grip on the grass and on ice
 *  suspension - +1.2 m/s of landing it survives, and crates slow you less
 *  gears      - +15% pick-up (back to full speed sooner) and +0.5% top speed - never
 *               enough to crest the next bike's hill: that still takes the next bike
 * Parts belong to the bike (a new bike starts stock) and go with your bikes at a rebirth.
 */
export const PART_LEVELS = 5
export const PARTS = {
  tires: { name: 'Tires', blurb: 'Sharper turns, more grip on grass and ice', icon: 'tires', handling: 0.06, grip: 0.07 },
  suspension: { name: 'Suspension', blurb: 'Survive harder landings, smash crates without slowing', icon: 'suspension', landing: 1.2, smash: 0.016 },
  gears: { name: 'Gears', blurb: 'Faster pick-up and a little more top speed', icon: 'gears', accel: 0.15, top: 0.005 },
}
/** Level `level` (1..PART_LEVELS) of a part, on a bike that cost `bikeCost`. */
export const partPrice = (bikeCost, level) => niceRound(Math.max(25, Math.max(40, bikeCost) * 0.08 * 1.8 ** (level - 1)))

/** Bonus Coins every MILESTONE metres ridden, worth this many metres of the zone's pay. */
export const MILESTONE = 250
export const MILESTONE_METERS = 60

/** A flip landed is worth this many metres of the zone's pay; a smashed crate or cone this many. */
export const FLIP_METERS = 40
export const SMASH_METERS = 4
/** A bail pays a little for how far you fly: this many metres of pay per metre flown. */
export const BAIL_METERS = 2

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionWins: { name: 'x2 Coins Potion', kind: 'potion', boost: 'wins', durationMs: POTION_DURATION_MS },
  potionBoost: { name: 'Turbo Potion', kind: 'potion', boost: 'turbo', durationMs: POTION_DURATION_MS },
}
/** A Turbo Potion adds this many seconds of boost to every ride while it lasts. */
export const TURBO_SECONDS = 1.5

/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'Coins', icon: 'coin', sub: '3 rides', grant: { winsRides: 3 } },
  { label: 'x2 Coins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Turbo', icon: 'potionBoost', sub: '5m', grant: { item: 'potionBoost' } },
  { label: 'Coins', icon: 'coin', sub: '6 rides', grant: { winsRides: 6 } },
  { label: 'x2 Coins', icon: 'potionWins', sub: 'x2', grant: { item: 'potionWins', amount: 2 } },
  { label: 'Turbo', icon: 'potionBoost', sub: 'x2', grant: { item: 'potionBoost', amount: 2 } },
  { label: 'Big Coins', icon: 'coin', sub: '15 rides', grant: { winsRides: 15 } },
]

/** Claimable once each per session, after this many minutes played. */
export const PLAYTIME_REWARDS = [
  { minutes: 3, label: 'Coins', icon: 'coin', grant: { winsRides: 1 } },
  { minutes: 8, label: 'Turbo', icon: 'potionBoost', grant: { item: 'potionBoost' } },
  { minutes: 15, label: 'Coins', icon: 'coin', grant: { winsRides: 3 } },
  { minutes: 25, label: 'x2 Coins', icon: 'potionWins', grant: { item: 'potionWins' } },
  { minutes: 35, label: 'Coins', icon: 'coin', grant: { winsRides: 5 } },
  { minutes: 45, label: 'Turbo', icon: 'potionBoost', grant: { item: 'potionBoost' } },
  { minutes: 60, label: 'x2 Coins', icon: 'potionWins', grant: { item: 'potionWins' } },
  { minutes: 90, label: 'Big Coins', icon: 'coin', grant: { winsRides: 12 } },
]

/** The gift stand by spawn: Coins the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { winsRides: 2 }, repeat: { item: 'potionWins' } }

// --- Shop -------------------------------------------------------------------------

/**
 * Passes bought with Coins. `pass` = permanent unlock.
 *  winsX2   - double every ride's Coins
 *  magnet   - pick up coins from much further away
 *  bigTank  - +1 s of boost on every ride
 */
export const SHOP = {
  magnet: { name: 'Coin Magnet', price: 6000, kind: 'pass' },
  bigTank: { name: 'Big Boost Tank', price: 40000, kind: 'pass' },
  winsX2: { name: 'x2 Coins', price: 120000, kind: 'pass' },
}
export const BIG_TANK_SECONDS = 1

/**
 * Boxity Gems products, by sku. Prices live in Boxity's catalog, never here: the game
 * only names the sku and, once Boxity confirms the sale, grants what it says. Coin packs
 * grow with you: `winsRides` full rides' worth of Coins.
 */
export const GEM_PRODUCTS = {
  coins_small: { name: 'Bag of Coins', blurb: '10 full rides of Coins', icon: 'coin', grant: { winsRides: 10 } },
  coins_big: { name: 'Mountain of Coins', blurb: '60 full rides of Coins', icon: 'coin', grant: { winsRides: 60 } },
  potion_bundle: { name: 'Potion Bundle', blurb: '3 x2 Coins + 3 Turbo potions', icon: 'potionWins', grant: { items: { potionWins: 3, potionBoost: 3 } } },
  wins_x2: { name: 'x2 Coins', blurb: 'Double every ride’s Coins, forever', icon: 'coin', grant: { pass: 'winsX2' } },
  magnet: { name: 'Coin Magnet', blurb: 'Grab coins from far away, forever', icon: 'magnet', grant: { pass: 'magnet' } },
  big_tank: { name: 'Big Boost Tank', blurb: '+1 s of boost on every ride, forever', icon: 'boost', grant: { pass: 'bigTank' } },
}

/**
 * Rewarded ads (Boxity): watch one to earn this. Placement names are lowercase, digits
 * and hyphens. `cooldownMs` keeps a player from chaining them.
 */
export const AD_REWARDS = {
  'wins-potion': { label: 'x2 Coins Potion', icon: 'potionWins', grant: { item: 'potionWins' }, cooldownMs: 3 * 60 * 1000 },
  'turbo-potion': { label: 'Turbo Potion', icon: 'potionBoost', grant: { item: 'potionBoost' }, cooldownMs: 3 * 60 * 1000 },
}

/** Kept for the save database's stock table (unused by this game). */
export const SPHINX_STOCK_DEFAULT = 0

// --- Coming back for more: streaks, quests, lucky gifts, friends ---------------------

/** A game day, in UTC: quests reset and login streaks count by it. */
export const DAY_MS = 24 * 60 * 60 * 1000
export const dayNumber = (now) => Math.floor(now / DAY_MS)

/**
 * Login streak: play on consecutive days and every ride pays STREAK_STEP more Coins per
 * day in a row (day 1 x1, day 2 x1.1 ... day 11 and on x2). Miss a day and it restarts.
 */
export const STREAK_STEP = 0.1
export const STREAK_MAX_DAYS = 11
export const streakMultiplier = (days) => 1 + STREAK_STEP * (Math.min(STREAK_MAX_DAYS, Math.max(1, days)) - 1)

/** Every other player in your server (and world) adds CROWD_STEP to your rides, up to CROWD_MAX. */
export const CROWD_STEP = 0.1
export const CROWD_MAX = 0.3
export const crowdBonus = (others) => 1 + Math.min(CROWD_MAX, CROWD_STEP * Math.max(0, others))

/** Lucky gifts: each ride has LUCKY_CHANCE of landing a surprise. `weight`s are relative. */
export const LUCKY_CHANCE = 0.08
export const LUCKY_GIFTS = [
  { weight: 50, label: 'Bag of Coins', icon: 'coin', grant: { winsRides: 2 } },
  { weight: 25, label: 'x2 Coins Potion', icon: 'potionWins', grant: { item: 'potionWins' } },
  { weight: 25, label: 'Turbo Potion', icon: 'potionBoost', grant: { item: 'potionBoost' } },
]

/**
 * Daily quests: an EASY, a MEDIUM and a HARD one of different kinds, picked fresh each
 * day for each player, and a bonus chest for finishing all three. Rewards grow with you
 * (`winsRides` full rides' worth of Coins).
 *
 * Each kind counts one thing (`counter`, fed by the session as you play) up to its
 * target; `mode: 'best'` keeps the best single value instead of adding up. `scale`
 * scales targets with your best ride ('total': that many of it in metres, 'best': that
 * share of it). `{n}` in `text` is the target.
 */
export const QUESTS_PER_DAY = 3
export const QUEST_TIERS = [
  { id: 'easy', label: 'EASY', winsRides: 2 },
  { id: 'medium', label: 'MEDIUM', winsRides: 4 },
  { id: 'hard', label: 'HARD', winsRides: 8, item: 'potionWins' },
]
export const QUEST_BONUS = { winsRides: 10, item: 'potionBoost' }
export const QUEST_TYPES = {
  rides: { counter: 'ride', text: 'Ride down {n} times', targets: [3, 8, 15] },
  meters: { counter: 'meters', text: 'Ride {n} m in total', scale: 'total', targets: [3, 8, 20] },
  far: { counter: 'far', mode: 'best', text: 'Ride {n} m in one go', scale: 'best', targets: [0.6, 0.85, 1] },
  coins: { counter: 'coin', text: 'Pick up {n} coins', targets: [40, 120, 300] },
  flips: { counter: 'flip', text: 'Land {n} flips', targets: [1, 4, 10] },
  smash: { counter: 'smash', text: 'Smash {n} crates or cones', targets: [5, 15, 40] },
  boostPads: { counter: 'pad', text: 'Hit {n} boost pads', targets: [5, 15, 35] },
  minutes: { counter: 'minute', text: 'Play for {n} minutes', targets: [5, 15, 30] },
}

// --- Tutorial & badges ------------------------------------------------------------

/** The guide for new players. Each step completes when its event fires. */
export const TUTORIAL = [
  { text: 'Walk into the START gate (or press PLAY) to ride down!', event: 'ride', target: 'start' },
  { text: 'Buy a faster bike at the Bike Shop - it climbs the next hill!', event: 'buyBike', target: 'bikes' },
]

export const BADGES = {
  firstRide: { name: 'First Ride' },
  firstRebirth: { name: 'Reborn Rider' },
  firstFinish: { name: 'Valley Bottom' },
  kilometer: { name: '1 Kilometre Club' },
  flipper: { name: 'Flip Master' },
  speedDemon: { name: 'Speed Demon' },
  world2: { name: 'Frost Rider' },
}
/** Speed (m/s) that earns Speed Demon: 100 km/h. */
export const SPEED_DEMON = 100 / KMH
