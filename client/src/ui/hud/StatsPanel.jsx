import { useEffect } from 'react'

import { crowdBonus, streakMultiplier } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { streakDays } from '@shared/logic'

import { remotePlayers } from '../../net/remotePlayers'
import { useGame } from '../../store/game'
import useNow from '../useNow'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

function StatRow({ icon, value, gradient }) {
  return (
    <div className="relative flex items-center" style={{ height: u(86) }}>
      <Icon name={icon} size={u(80)} className="relative" />
      {/* Keyed on the value: every change replays a little bump. */}
      <span key={value} className="pp-bump relative" style={{ fontSize: u(64), marginLeft: u(10) }}>
        <StrokeText stroke={u(12)} gradient={gradient}>
          {value}
        </StrokeText>
      </span>
    </div>
  )
}

/** A small badge under the stats: an icon, a line and a bonus. */
function Chip({ icon, text, bonus }) {
  return (
    <div className="flex items-center" style={{ fontSize: u(26), gap: u(4), marginTop: u(4) }}>
      <Icon name={icon} size={u(48)} />
      <StrokeText stroke={u(6)}>{text}</StrokeText>
      <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
        {bonus}
      </StrokeText>
    </div>
  )
}

/** Shown once per session: today's streak news. */
let streakToastShown = false

/**
 * The login streak (days in a row and the Coins it adds), and the friends bonus while
 * others share your server. Says today's streak news once, a moment after the game is up.
 */
function Bonuses() {
  const days = useGame((s) => streakDays(s.profile, Date.now()))
  const news = useGame((s) => (s.profileLoaded && s.playable ? s.session.streak : null))
  const showToast = useGame((s) => s.showToast)
  // Other players here (the ones drawn: your world's), counted every couple of seconds.
  useNow(2000)
  const others = remotePlayers.size

  useEffect(() => {
    if (!news || streakToastShown) return undefined
    streakToastShown = true
    const id = setTimeout(() => {
      if (news.broke) showToast('Your streak ended... DAY 1 again - play tomorrow for x1.1 Coins!')
      else if (news.days >= 2) showToast(`DAY ${news.days} STREAK! x${news.multiplier.toFixed(1)} Coins on every ride today!`)
      // Day 1 says nothing: the tutorial has the floor on a first visit.
    }, 2500)
    return () => clearTimeout(id)
  }, [news, showToast])

  return (
    <>
      {days > 0 && <Chip icon="flame" text={`Day ${days}`} bonus={`x${streakMultiplier(days).toFixed(1)}`} />}
      {others > 0 && <Chip icon="friends" text={`${others} here`} bonus={`+${Math.round((crowdBonus(others) - 1) * 100)}%`} />}
    </>
  )
}

/** Top-left: Rebirths, then Coins, with your streak and friends bonuses under them. */
export function StatsPanel() {
  const wins = useGame((s) => s.profile.wins)
  const rebirths = useGame((s) => s.profile.rebirths)

  return (
    <div className="hud-stats pointer-events-none absolute flex flex-col" style={{ contain: 'layout style' }}>
      <StatRow icon="rebirth" value={formatNumber(rebirths)} />
      <StatRow icon="coin" value={formatNumber(wins)} gradient={GRADIENTS.gold} />
      <Bonuses />
    </div>
  )
}

export default StatsPanel
