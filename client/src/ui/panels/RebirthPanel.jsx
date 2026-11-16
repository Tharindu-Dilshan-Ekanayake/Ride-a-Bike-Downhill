import { rebirthMultiplier, rebirthPrice } from '@shared/balance'
import { formatMultiplier, formatNumber } from '@shared/format'
import { canRebirth, rebirthProgress } from '@shared/logic'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const CARD_GRADIENTS = {
  now: 'linear-gradient(180deg, #8ff0ff 0%, #2fb8ff 50%, #1677ff 100%)',
  after: 'linear-gradient(180deg, #c6ff7a 0%, #6fe04a 50%, #26ad3c 100%)',
}
const PURPLE = 'linear-gradient(180deg, #ffd6ff 0%, #e27bff 50%, #a93cf0 100%)'
const FILL = 'linear-gradient(180deg, #fff27a 0%, #ffc61e 50%, #ff9a12 100%)'

function StatCard({ kind, text }) {
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{
        height: u(104),
        borderRadius: u(22),
        background: CARD_GRADIENTS[kind],
        border: `${u(5)} solid #111`,
        boxShadow: `inset 0 ${u(5)} 0 rgba(255,255,255,0.45), inset 0 -${u(6)} 0 rgba(0,0,0,0.18)`,
      }}
    >
      <span className="relative" style={{ fontSize: u(text.length > 11 ? 50 : 60) }}>
        <StrokeText stroke={u(11)}>{text}</StrokeText>
      </span>
    </div>
  )
}

/**
 * Rebirth: your Coin multiplier now against after the next rebirth, how close your Coins
 * are to its price, what it resets (Coins, bikes, upgrades) and the button once you can.
 */
export function RebirthPanel() {
  const rebirths = useGame((s) => s.profile.rebirths)
  const wins = useGame((s) => s.profile.wins)
  const progress = useGame((s) => rebirthProgress(s.profile))
  const ready = useGame((s) => canRebirth(s.profile))
  const price = rebirthPrice(rebirths)

  return (
    <Panel title="Rebirth" icon="rebirth" width={920}>
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', columnGap: u(20), rowGap: u(16) }}>
        <div className="text-center" style={{ fontSize: u(58) }}>
          <StrokeText stroke={u(11)}>Now</StrokeText>
        </div>
        <div />
        <div className="text-center" style={{ fontSize: u(58) }}>
          <StrokeText stroke={u(11)}>After Rebirth</StrokeText>
        </div>
        <StatCard kind="now" text={`${formatMultiplier(rebirthMultiplier(rebirths))} Coins`} />
        <Icon name="fastForward" size={u(80)} />
        <StatCard kind="after" text={`${formatMultiplier(rebirthMultiplier(rebirths + 1))} Coins`} />
      </div>

      <p className="m-0 text-center" style={{ fontSize: u(42), marginTop: u(18) }}>
        <StrokeText stroke={u(9)} gradient={PURPLE} style={{ whiteSpace: 'normal' }}>
          Rebirth resets your Coins, bikes and upgrades!
        </StrokeText>
      </p>
      <p className="m-0 text-center" style={{ fontSize: u(30), marginTop: u(6) }}>
        <StrokeText stroke={u(6)} style={{ whiteSpace: 'normal' }}>
          Every Coin you earn after is multiplied - for good.
        </StrokeText>
      </p>

      <div
        className="relative mx-auto overflow-hidden"
        style={{ width: '88%', marginTop: u(16), height: u(76), borderRadius: u(38), border: `${u(5)} solid #111`, background: '#eef6ff' }}
      >
        <div className="absolute inset-y-0 left-0" style={{ width: `${progress * 100}%`, background: FILL, borderRadius: u(32) }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(44), gap: u(8) }}>
          <Icon name="coin" size={u(54)} />
          <StrokeText stroke={u(9)}>
            {formatNumber(Math.min(wins, price))} / {formatNumber(price)}
          </StrokeText>
        </div>
      </div>

      <ChunkyButton
        disabled={!ready}
        onClick={() => actions.rebirth()}
        gradient={ready ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        className="w-full"
        style={{ height: u(108), marginTop: u(26) }}
        radius={22}
        border={5}
        title="Rebirth"
      >
        <span style={{ fontSize: u(56) }}>
          <StrokeText stroke={u(12)}>{ready ? 'REBIRTH!' : `Need ${formatNumber(price)} Coins`}</StrokeText>
        </span>
      </ChunkyButton>
    </Panel>
  )
}

export default RebirthPanel
