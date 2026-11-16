import { ITEMS, TURBO_SECONDS } from '@shared/balance'
import { formatClock } from '@shared/format'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

/** What each potion does, for its card. */
const BLURBS = {
  potionWins: 'Double every Coin for 5 minutes',
  potionBoost: `+${TURBO_SECONDS}s of Boost on every ride for 5 minutes`,
}
const BOOST_OF = { potionWins: 'wins', potionBoost: 'turbo' }
const BLURB_STYLE = { color: '#3a2a10', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }

/** Backpack: potions to drink, plus running potion timers. A second potion adds its time on. */
export function ItemsPanel() {
  const items = useGame((s) => s.profile.items)
  const boosts = useGame((s) => s.profile.boosts)
  const now = useNow(1000)
  const owned = Object.keys(ITEMS).filter((id) => (items[id] || 0) > 0)
  const active = Object.keys(ITEMS)
    .map((id) => [id, ITEMS[id].name, boosts[BOOST_OF[id]] || 0])
    .filter(([, , end]) => end > now)

  return (
    <Panel title="ITEMS" icon="items" width={900}>
      {active.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: u(16), marginBottom: u(14) }}>
          {active.map(([icon, label, end]) => (
            <div key={icon} className="flex items-center" style={{ gap: u(8), padding: `${u(6)} ${u(14)}`, borderRadius: u(30), background: 'rgba(255,255,255,0.08)', fontSize: u(32) }}>
              <Icon name={icon} size={u(48)} />
              <StrokeText stroke={u(6)}>
                {label} · {formatClock(end - now)}
              </StrokeText>
            </div>
          ))}
        </div>
      )}
      {owned.length === 0 ? (
        <div className="flex flex-col items-center" style={{ padding: u(40), gap: u(10) }}>
          <Icon name="items" size={u(120)} />
          <span className="text-center" style={{ fontSize: u(34) }}>
            <StrokeText stroke={u(7)} style={{ whiteSpace: 'normal' }}>
              No items yet - Daily Rewards, Quests and Gifts give you potions!
            </StrokeText>
          </span>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(240)}, 1fr))`, gap: u(14) }}>
          {owned.map((id) => (
            <div key={id} className="relative flex flex-col items-center" style={{ padding: u(10), borderRadius: u(8), border: `${u(5)} solid #111`, background: GRADIENTS.rewardCard }}>
              <span className="absolute" style={{ top: u(4), right: u(10), fontSize: u(36) }}>
                <StrokeText stroke={u(7)}>x{items[id]}</StrokeText>
              </span>
              <Icon name={id} size={u(110)} />
              <span className="text-center" style={{ fontSize: u(28), marginTop: u(4) }}>
                <StrokeText stroke={u(6)}>{ITEMS[id].name}</StrokeText>
              </span>
              <span className="whitespace-normal text-center" style={{ fontSize: u(18), minHeight: u(44), margin: `${u(4)} 0 ${u(8)}` }}>
                <span style={BLURB_STYLE}>{BLURBS[id]}</span>
              </span>
              <ChunkyButton gradient={GRADIENTS.greenButton} onClick={() => actions.usePotion(id)} className="w-full" style={{ height: u(58) }} title={`Use ${ITEMS[id].name}`}>
                <span style={{ fontSize: u(34) }}>
                  <StrokeText stroke={u(7)}>Use</StrokeText>
                </span>
              </ChunkyButton>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

export default ItemsPanel
