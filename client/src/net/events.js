import { BIKES, rebirthMultiplier, TUTORIAL, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { canRebirth, nextBike } from '@shared/logic'

import { sfx } from '../audio/sfx'
import { burst } from '../game/fx/fxQueue'
import { onRideGo, onRideResult } from '../game/ride/rideControl'
import { runtime } from '../game/runtime'
import { getGame } from '../store/game'
import { fadeThrough } from '../ui/fade'
import { refreshRemoteWorlds } from './remotePlayers'

/** A point above you in the lobby, for celebration bursts. */
const atPlayer = (dy = 1.2) => {
  const p = runtime.player.position
  return { x: p.x, y: p.y + dy, z: p.z }
}

/** "+1.2K Coins" for a reward that paid Coins, else nothing. */
const coinsText = (wins) => (wins > 0 ? ` +${formatNumber(wins)} Coins` : '')

/** The next bike, if you can buy it now (its id), else null. */
const affordable = (profile) => {
  const next = nextBike(profile)
  return next && profile.wins >= next.cost ? next.id : null
}

/**
 * Applies one authority event to the client: updates the store and kicks off any
 * visual effect. The same handler serves the Colyseus connection and offline mode.
 */
export function handleServerEvent(type, payload) {
  const game = getGame()
  switch (type) {
    case 'profile': {
      const before = game.profile
      game.setProfile(payload.profile, payload.session)
      if ((payload.profile.world || 0) !== (before.world || 0)) refreshRemoteWorlds()
      // Celebrate the big moments, whatever caused them.
      if (game.profileLoaded && payload.profile.rebirths > before.rebirths) {
        sfx.rebirth()
        burst({ ...atPlayer(), count: 60, speed: 9 })
        game.showToast(`REBIRTH ${payload.profile.rebirths}! x${payload.profile.rebirths + 1} Coins on every ride!`)
      } else if (game.profileLoaded && payload.profile.bikes.length > before.bikes.length) {
        // A new bike: a shower of confetti and its name up in lights.
        sfx.buy()
        sfx.wins()
        burst({ ...atPlayer(2.5), count: 60, palette: 'confetti', speed: 9 })
        const bike = BIKES.find((b) => b.id === payload.profile.bike)
        // The first bike bought moves the tutorial on: say what's next.
        const done = before.tutorialStep < TUTORIAL.length && payload.profile.tutorialStep >= TUTORIAL.length
        if (bike) game.showToast(`NEW BIKE: ${bike.name}!${done ? ' Tutorial complete - have fun!' : ''}`)
      } else if (game.profileLoaded && payload.profile.bike !== before.bike) {
        sfx.buy()
      } else if (game.profileLoaded && before.tutorialStep >= TUTORIAL.length) {
        // No guide any more once the tutorial's done: just a five-second nudge the moment
        // something new comes within reach.
        const can = affordable(payload.profile)
        if (can && can !== affordable(before)) game.showToast(`You can buy the ${BIKES.find((b) => b.id === can).name}! Open BIKES`)
        else if (canRebirth(payload.profile) && !canRebirth(before)) game.showToast(`REBIRTH READY! x${rebirthMultiplier(payload.profile.rebirths + 1)} Coins forever`)
      }
      break
    }

    case 'rideGo':
      onRideGo(payload)
      break

    case 'ride':
      onRideResult(payload)
      break

    case 'quest':
      // One of today's quests finished: a chime and a nudge to claim it.
      sfx.levelUp()
      game.showToast(`QUEST COMPLETE: ${payload.text}! Claim it in Quests`)
      break

    case 'streak':
      // Played past midnight: the streak's next day starts now.
      sfx.wins()
      game.showToast(`DAY ${payload.days} STREAK! x${payload.multiplier.toFixed(1)} Coins on every ride`)
      break

    case 'badge':
      // After the moment it was earned in (usually a ride's end), so that frame stays light.
      setTimeout(() => sfx.wins(), 1200)
      break

    case 'world': {
      // Through the portal: a flash of white while the new world's sky and road go in
      // (GameScene follows profile.world), and a fanfare.
      fadeThrough(() => {})
      sfx.rebirth()
      burst({ ...atPlayer(2), count: 60, palette: 'confetti', speed: 9 })
      const world = WORLDS[payload.world]
      game.showToast(payload.world === 1 ? `WELCOME TO ${world.name.toUpperCase()}! x${world.pay} Coins on this mountain!` : `Back on ${world.name}!`)
      break
    }

    case 'reward':
      // A rewarded ad, a Gems purchase, a gift or a quest landed.
      sfx.buy()
      burst({ ...atPlayer(2), count: 40, palette: 'gold', speed: 8 })
      game.showToast(`${payload.label}${coinsText(payload.wins)}!`)
      break

    default:
      break
  }
}
