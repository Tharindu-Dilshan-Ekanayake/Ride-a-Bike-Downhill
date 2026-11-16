import { BIKES, UPGRADES } from '@shared/balance'
import { bikeIndex, isUpgradeMaxed, nextBike, upgradeCost, upgradeLevel, upgradeValue } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { requestRide } from '../../game/ride/rideControl'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from './parts'
import { GRADIENTS, u } from './style'

const CARD_FACE = 'linear-gradient(180deg, #ffffff 0%, #eef3fb 60%, #d7e0ee 100%)'
const TITLE_GRADIENTS = {
  bikes: 'linear-gradient(180deg, #ffd6ff 0%, #e27bff 50%, #a93cf0 100%)',
  boost: 'linear-gradient(180deg, #c9f6ff 0%, #4cc8ff 50%, #1f7ae8 100%)',
  income: 'linear-gradient(180deg, #d4ffb0 0%, #6fe04a 50%, #26ad3c 100%)',
}

/** One upgrade card: title with its level, a big icon, "now > next", and the price button. */
function UpgradeCard({ id, title, level, icon, from, to, price, maxed, onBuy }) {
  const afford = useGame((s) => s.profile.wins >= price)
  const buy = () => {
    if (maxed) return
    if (getGame().profile.wins < price) {
      sfx.error()
      return
    }
    onBuy()
  }
  return (
    <div
      className="pointer-events-auto relative flex flex-col items-center"
      style={{ width: u(196), padding: `${u(8)} ${u(8)} ${u(10)}`, borderRadius: u(16), border: `${u(5)} solid #111`, background: CARD_FACE, boxShadow: `0 ${u(5)} 0 rgba(0,0,0,0.35)` }}
    >
      <div className="flex w-full items-center justify-between" style={{ fontSize: u(32), lineHeight: 1 }}>
        <StrokeText stroke={u(7)} gradient={TITLE_GRADIENTS[id]}>
          {title}
        </StrokeText>
        <span className="flex items-center justify-center" style={{ minWidth: u(40), height: u(36), borderRadius: u(10), background: '#a46bff', border: `${u(3)} solid #111`, fontSize: u(24) }}>
          <StrokeText stroke={u(5)}>{level}</StrokeText>
        </span>
      </div>
      <Icon name={icon} size={u(88)} style={{ margin: `${u(4)} 0` }} />
      <div style={{ fontSize: u(30), marginBottom: u(6) }}>
        <StrokeText stroke={u(6)} fill="#2c344d">
          {maxed ? from : `${from} > ${to}`}
        </StrokeText>
      </div>
      <ChunkyButton
        onClick={buy}
        disabled={maxed}
        gradient={maxed ? GRADIENTS.greyButton : afford ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        className="w-full"
        style={{ height: u(56) }}
        title={maxed ? `${title}: maxed` : `Upgrade ${title}`}
      >
        {maxed ? (
          <span style={{ fontSize: u(32) }}>
            <StrokeText stroke={u(7)}>MAX</StrokeText>
          </span>
        ) : (
          <Price amount={price} size={30} afford={afford} />
        )}
      </ChunkyButton>
    </div>
  )
}

function BikesCard() {
  const profile = useGame((s) => s.profile)
  const next = nextBike(profile)
  const current = bikeIndex(profile.bike) + 1
  const owned = profile.bikes.length
  return (
    <UpgradeCard
      id="bikes"
      title="BIKES"
      level={owned}
      icon={next ? `bike:${next.color}:${next.accent}` : `bike:${BIKES[BIKES.length - 1].color}:${BIKES[BIKES.length - 1].accent}`}
      from={next ? String(current) : `${BIKES.length}/${BIKES.length}`}
      to={next ? String(bikeIndex(next.id) + 1) : ''}
      price={next ? next.cost : 0}
      maxed={!next}
      onBuy={() => actions.buyBike(next.id)}
    />
  )
}

/** A Boost or Income card, from its UPGRADES entry. */
function LevelCard({ id }) {
  const level = useGame((s) => upgradeLevel(s.profile, id))
  const now = useGame((s) => upgradeValue(s.profile, id))
  const next = useGame((s) => upgradeValue(s.profile, id, 1))
  const price = useGame((s) => upgradeCost(s.profile, id))
  const maxed = useGame((s) => isUpgradeMaxed(s.profile, id))
  const up = UPGRADES[id]
  const show = (v) => (up.unit === 's' ? `${v.toFixed(2).replace(/0$/, '')}s` : `x${v.toFixed(1)}`)
  return (
    <UpgradeCard
      id={id}
      title={id === 'boost' ? 'BOOST' : 'INCOME'}
      level={level}
      icon={id === 'boost' ? 'boost' : 'income'}
      from={show(now)}
      to={show(next)}
      price={price}
      maxed={maxed}
      onBuy={() => actions.upgrade(id)}
    />
  )
}

/**
 * Bottom centre, as in the reference: the big PLAY button (you can also walk into the
 * START gate), and under it the three things Coins buy most - the next bike, more Boost
 * and more Income.
 */
export function PlayPanel() {
  return (
    <div className="hud-play pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ gap: u(16) }}>
      <ChunkyButton
        onClick={() => requestRide()}
        gradient={GRADIENTS.greenButton}
        className="pp-play-btn"
        radius={22}
        border={6}
        title="Ride down the mountain"
        style={{ width: u(420), height: u(118), gap: u(18) }}
      >
        <svg viewBox="0 0 100 100" style={{ width: u(70), height: u(70) }} aria-hidden="true">
          <path d="M22 12l66 38-66 38z" fill="#ffffff" stroke="#111" strokeWidth="10" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: u(80), lineHeight: 1 }}>
          <StrokeText stroke={u(14)}>PLAY</StrokeText>
        </span>
      </ChunkyButton>
      <div className="flex" style={{ gap: u(14) }}>
        <BikesCard />
        <LevelCard id="boost" />
        <LevelCard id="income" />
      </div>
    </div>
  )
}

export default PlayPanel
