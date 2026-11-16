/**
 * Player intents. The UI never changes game state itself: it calls one of these, the
 * authority (the Colyseus room, or the offline stand-in) validates it, and the result
 * comes back as an updated profile or an event.
 *
 * Starting and ending a ride goes through game/ride/rideControl (requestRide, endRide),
 * which sends rideStart / ridePos / rideEnd itself.
 */

let transport = null

/** Installs the active connection: `{ send(type, payload) }`. */
export function setTransport(next) {
  transport = next
}

export function send(type, payload) {
  if (!transport) return
  transport.send(type, payload)
}

export const actions = {
  buyBike: (id) => send('buyBike', { id }),
  equipBike: (id) => send('equipBike', { id }),
  /** Buys the next level of GARAGE part `part` ('tires' | 'suspension' | 'gears') on bike `bikeId`. */
  upgradePart: (bikeId, part) => send('upgradePart', { bikeId, part }),
  /** The WORLDS menu: off to world `world` (0 Pine Peak, 1 Frost Ridge). */
  travel: (world) => send('travel', { world }),
  /** Buys the next level of upgrade `key` ('boost' | 'income'). */
  upgrade: (key) => send('upgrade', { key }),
  rebirth: () => send('rebirth'),
  usePotion: (itemId) => send('usePotion', { itemId }),
  claimDaily: (day) => send('claimDaily', { day }),
  claimPlaytime: (index) => send('claimPlaytime', { index }),
  claimFreeReward: () => send('claimFreeReward'),
  /** Claims today's finished quest `index` (0-2), or the bonus chest once all three are. */
  claimQuest: (index) => send('claimQuest', { index }),
  claimQuestBonus: () => send('claimQuestBonus'),
  portal: () => send('portal'),
  /** Buys a Coins pass from the shop (balance SHOP). */
  purchase: (productId) => send('purchase', { productId }),
  /** A rewarded ad Boxity says was watched; the server verifies the token. */
  adReward: (placement, rewardToken) => send('adReward', { placement, rewardToken }),
  /** Asks the server to apply any Gems purchases Boxity has confirmed. */
  gemsCheck: () => send('gemsCheck'),
}
