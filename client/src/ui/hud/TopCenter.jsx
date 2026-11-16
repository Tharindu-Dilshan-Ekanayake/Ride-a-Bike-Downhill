import { TUTORIAL, WORLDS } from '@shared/balance'
import { formatClock, formatDistance } from '@shared/format'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { GRADIENTS, u } from './style'

const BANNER_GRADIENT = 'linear-gradient(180deg, #fff6a8 0%, #ffd52a 45%, #ffa000 100%)'
const PANEL_GRADIENT = 'linear-gradient(180deg, #ffe45c 0%, #ffc21f 55%, #ff9a12 100%)'
const PILL = {
  borderRadius: u(30),
  border: `${u(4)} solid #111`,
  boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.3), inset 0 ${u(4)} 0 rgba(255,255,255,0.45)`,
}

/**
 * The tutorial for brand-new players: ride down, buy a bike - then it's gone for good
 * (after that, only five-second nudges: net/events.js). A small strip, "1/2" and the step, so the world stays in view; the 3D arrows
 * (TutorialArrows) show where to go.
 */
function TutorialBanner({ step }) {
  const current = TUTORIAL[step]
  return (
    <div className="flex items-center" style={{ ...PILL, gap: u(14), padding: `${u(6)} ${u(22)} ${u(6)} ${u(8)}`, background: PANEL_GRADIENT }}>
      <span className="flex items-center justify-center" style={{ minWidth: u(64), height: u(44), borderRadius: u(22), background: '#111', fontSize: u(26) }}>
        <StrokeText stroke={u(5)} gradient={BANNER_GRADIENT}>
          {step + 1}/{TUTORIAL.length}
        </StrokeText>
      </span>
      <span style={{ fontSize: u(34) }}>
        <StrokeText stroke={u(7)} style={{ whiteSpace: 'normal' }}>
          {current.text}
        </StrokeText>
      </span>
    </div>
  )
}

/** Running potions (x2 Coins, Turbo) with their time left. */
function Boosts() {
  const boosts = useGame((s) => s.profile.boosts)
  const now = useNow(1000)
  const active = [
    ['potionWins', 'x2 Coins', boosts.wins],
    ['potionBoost', 'Turbo', boosts.turbo],
  ].filter(([, , end]) => end > now)
  if (active.length === 0) return null
  return (
    <div className="flex" style={{ gap: u(14) }}>
      {active.map(([icon, label, end]) => (
        <div key={icon} className="flex items-center" style={{ fontSize: u(28), gap: u(4) }}>
          <Icon name={icon} size={u(50)} />
          <StrokeText stroke={u(6)}>{label}</StrokeText>
          <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
            {formatClock(end - now)}
          </StrokeText>
        </div>
      ))}
    </div>
  )
}

/** Your best ride on this mountain (and best time, once you've reached the bottom). */
function BestRow() {
  const world = useGame((s) => s.profile.world || 0)
  const best = useGame((s) => s.profile.stats.best?.[s.profile.world || 0] || 0)
  const bestTime = useGame((s) => s.profile.stats.bestTime?.[s.profile.world || 0] || 0)
  if (best <= 0) return null
  return (
    <div className="flex items-center" style={{ fontSize: u(30), gap: u(8) }}>
      <Icon name="flag" size={u(44)} />
      <StrokeText stroke={u(6)}>{WORLDS[world].name.toUpperCase()} BEST</StrokeText>
      <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
        {formatDistance(best)}
      </StrokeText>
      {bestTime > 0 && (
        <StrokeText stroke={u(6)} fill="#7fe2ff">
          · {formatClock(bestTime)}
        </StrokeText>
      )}
    </div>
  )
}

/** Top centre: the tutorial while there is one; potions and your best ride under it. */
export function TopCenter() {
  const step = useGame((s) => s.profile.tutorialStep)
  return (
    <div
      className="hud-topcenter pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
      style={{ width: 'max-content', maxWidth: '90vw', gap: u(8) }}
    >
      {TUTORIAL[step] && <TutorialBanner step={step} />}
      <BestRow />
      <Boosts />
    </div>
  )
}

export default TopCenter
