import { SHOP } from '@shared/balance'

import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from './parts'
import { u } from './style'

const PASSES = [
  { product: 'winsX2', label: 'x2 Coins', icon: 'coin', gradient: 'linear-gradient(180deg, #fff27a 0%, #ffcb1f 48%, #ff9a0a 100%)' },
  { product: 'bigTank', label: '+1s Boost', icon: 'boost', gradient: 'linear-gradient(180deg, #c9f6ff 0%, #4cc8ff 50%, #1f7ae8 100%)' },
  { product: 'magnet', label: 'Magnet', icon: 'magnet', gradient: 'linear-gradient(135deg, #ff5fd2 0%, #8a5cff 35%, #2fb8ff 70%, #5cff9a 100%)' },
]

/** One pass: its name over a big icon, and the price (or OWNED) underneath. */
function PassButton({ product, label, icon, gradient }) {
  const item = SHOP[product]
  const owned = useGame((s) => Boolean(s.profile.passes[product]))
  const afford = useGame((s) => s.profile.wins >= item.price)
  return (
    <div className="flex flex-col items-center">
      <ChunkyButton gradient={gradient} onClick={() => buy(product)} disabled={owned} title={item.name} radius={20} border={5} style={{ width: u(250), height: u(84) }}>
        <Icon name={icon} size={u(96)} className="absolute" style={{ opacity: 0.85 }} />
        <span className="relative" style={{ fontSize: u(48) }}>
          <StrokeText stroke={u(10)}>{label}</StrokeText>
        </span>
      </ChunkyButton>
      <span style={{ marginTop: u(8) }}>
        {owned ? (
          <span style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(7)} fill="#7dff4a">
              OWNED
            </StrokeText>
          </span>
        ) : (
          <Price amount={item.price} size={32} afford={afford} />
        )}
      </span>
    </div>
  )
}

/** The Coin passes down the right-hand side: x2 Coins, a bigger Boost tank, the Coin Magnet. */
export function PassButtons() {
  return (
    <div className="hud-passes pointer-events-none absolute flex flex-col" style={{ gap: u(26) }}>
      {PASSES.map((pass) => (
        <PassButton key={pass.product} {...pass} />
      ))}
    </div>
  )
}

export default PassButtons
