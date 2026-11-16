import { FREE_REWARD, inGarage, inRideZone, portalAt, standAt } from '@shared/world'

import { actions } from '../net/actions'
import { getGame } from '../store/game'
import { requestRide } from './ride/rideControl'
import { runtime } from './runtime'

const TICK_MS = 100

const sameZone = (a, b) => a.stand === b.stand && a.rideZone === b.rideZone && a.portal === b.portal && a.freeReward === b.freeReward && a.garage === b.garage

/**
 * The 10 Hz bridge between the frame-rate world and the UI: works out where in the lobby
 * the player stands - on a bike stand, in the START gate, in the portal, at the gift
 * stand, in the garage - and writes it into the store, only when something actually changed. Walking
 * into the gate starts a ride; walking into the portal asks to go through it.
 *
 * Out on a ride (the player is frozen at the gate meanwhile) nothing here changes.
 *
 * @returns {() => void} stop
 */
export function startGameTicker() {
  let wasInGate = false
  const tick = () => {
    const game = getGame()
    const player = runtime.player
    const p = player.position
    const zone = {
      stand: standAt(p.x, p.z),
      rideZone: inRideZone(p.x, p.z),
      portal: portalAt(p.x, p.z)?.id ?? null,
      freeReward: Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) < FREE_REWARD.radius,
      garage: inGarage(p.x, p.z),
    }
    // Into the START gate: off down the mountain (not with a panel open, nor mid-ride).
    if (zone.rideZone && !wasInGate && !game.panel && game.ride === null && !player.frozen) requestRide()
    wasInGate = zone.rideZone
    if (!sameZone(zone, game.zone)) {
      if (zone.portal && zone.portal !== game.zone.portal) actions.portal()
      // Into the garage: its upgrades open.
      if (zone.garage && !game.zone.garage && !game.panel && game.ride === null) game.openPanel('garage')
      game.setZone(zone)
    }
  }

  const id = setInterval(tick, TICK_MS)
  return () => clearInterval(id)
}
