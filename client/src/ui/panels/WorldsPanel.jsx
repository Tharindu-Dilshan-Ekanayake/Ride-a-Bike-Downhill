import { WORLD_PORTALS, WORLDS } from '@shared/balance'
import { formatClock, formatDistance, formatNumber } from '@shared/format'
import { isWorldOpen } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const BLURB = { color: '#d7deea', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }
/** A pay rate: 0.2, 1.4, 27, 1.2K. */
const rate = (n) => (n < 10 ? String(n) : formatNumber(n))
const LOOKS = [
  { face: 'linear-gradient(180deg, #8ff07a 0%, #2fae4f 55%, #1d7a3a 100%)', icon: 'flag', tag: 'Pines, hay bales and logs' },
  { face: 'linear-gradient(180deg, #e0f6ff 0%, #8fd3ff 55%, #3d8fd6 100%)', icon: 'globe', tag: 'Snow, ice patches and snowmen' },
]

function WorldCard({ index }) {
  const world = WORLDS[index]
  const profile = useGame((s) => s.profile)
  const closePanel = useGame((s) => s.closePanel)
  const here = (profile.world || 0) === index
  const open = isWorldOpen(profile, index)
  const best = profile.stats.best?.[index] || 0
  const bestTime = profile.stats.bestTime?.[index] || 0
  const needWorld = WORLDS[WORLD_PORTALS.world2.finish]
  const needBest = profile.stats.best?.[WORLD_PORTALS.world2.finish] || 0
  const go = () => {
    if (!open) {
      sfx.error()
      return
    }
    actions.travel(index)
    closePanel()
  }
  const firstPay = world.zones[0].coinsPerMeter
  const lastPay = world.zones[world.zones.length - 1].coinsPerMeter
  return (
    <div className="flex flex-1 flex-col" style={{ gap: u(10), padding: u(14), borderRadius: u(12), border: `${u(5)} solid ${here ? '#ffd23f' : '#111'}`, background: LOOKS[index].face, minWidth: 0 }}>
      <div className="flex items-center" style={{ gap: u(10) }}>
        <Icon name={LOOKS[index].icon} size={u(70)} />
        <span style={{ fontSize: u(46) }}>
          <StrokeText stroke={u(8)}>{world.name}</StrokeText>
        </span>
      </div>
      <div className="flex flex-col" style={{ gap: u(4), padding: u(10), borderRadius: u(8), background: 'rgba(10,16,30,0.55)' }}>
        <span style={{ ...BLURB, fontSize: u(21) }}>{LOOKS[index].tag}</span>
        <span style={{ ...BLURB, fontSize: u(21) }}>{`${formatDistance(world.length)} down · ${world.zones.length} zones · ${world.zones.length - 1} hills`}</span>
        <span style={{ ...BLURB, fontSize: u(21), color: '#ffd23f' }}>{`${rate(firstPay)} - ${rate(lastPay)} Coins per metre`}</span>
        <span style={{ ...BLURB, fontSize: u(21), color: '#9ff0ff' }}>
          {best > 0 ? `Your best: ${formatDistance(best)}${bestTime ? ` · finished in ${formatClock(bestTime)}` : ''}` : 'Not ridden yet'}
        </span>
      </div>
      {here ? (
        <div className="flex items-center justify-center" style={{ height: u(70), borderRadius: u(10), background: GRADIENTS.greyButton, border: `${u(4)} solid #111`, fontSize: u(32) }}>
          <StrokeText stroke={u(6)}>YOU ARE HERE</StrokeText>
        </div>
      ) : open ? (
        <ChunkyButton gradient={GRADIENTS.greenButton} onClick={go} style={{ height: u(70) }} title={`Travel to ${world.name}`}>
          <span style={{ fontSize: u(34) }}>
            <StrokeText stroke={u(7)}>TRAVEL</StrokeText>
          </span>
        </ChunkyButton>
      ) : (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: u(70), borderRadius: u(10), background: GRADIENTS.slate, border: `${u(4)} solid #111`, padding: u(6) }}>
          <span style={{ fontSize: u(26) }}>
            <StrokeText stroke={u(5)}>{`LOCKED: reach the bottom of ${needWorld.name}`}</StrokeText>
          </span>
          <span style={{ ...BLURB, fontSize: u(19) }}>{`Your best there: ${formatDistance(needBest)} of ${formatDistance(needWorld.length)}`}</span>
        </div>
      )}
    </div>
  )
}

/** The WORLDS menu: both mountains, what they're like, your best on each, and travel. */
export function WorldsPanel() {
  return (
    <Panel title="WORLDS" icon="globe" width={1040}>
      <div className="flex flex-wrap" style={{ gap: u(16) }}>
        {WORLDS.map((_, i) => (
          <WorldCard key={i} index={i} />
        ))}
      </div>
    </Panel>
  )
}

export default WorldsPanel
