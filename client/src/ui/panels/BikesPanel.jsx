import { BIKES, KMH, RARITIES, WORLDS } from '@shared/balance'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const MAX_TOP = BIKES[BIKES.length - 1].top
const MAX_HANDLING = Math.max(...BIKES.map((b) => b.handling))
const MAX_LANDING = Math.max(...BIKES.map((b) => b.landing))
const BLURB = { color: '#d7deea', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }

/** The hills a bike is the first to crest: one line per mountain it opens a zone on. */
const CRESTS = BIKES.map((_, i) =>
  WORLDS.flatMap((world) => world.zones.filter((zone) => zone.gate === i).map((zone) => `${world.name}: ${zone.name}`)),
)

function StatBar({ label, value, fraction, color }) {
  return (
    <div className="flex items-center" style={{ gap: u(8), fontSize: u(20) }}>
      <span style={{ width: u(92), ...BLURB }}>{label}</span>
      <span className="relative flex-1 overflow-hidden" style={{ height: u(16), borderRadius: u(8), background: '#2a2f3a', border: `${u(2)} solid #111` }}>
        <span className="absolute inset-y-0 left-0" style={{ width: `${Math.round(fraction * 100)}%`, background: color }} />
      </span>
      <span style={{ width: u(84), textAlign: 'right', ...BLURB, color: '#fff' }}>{value}</span>
    </div>
  )
}

/** 'equipped' | 'owned' | 'next' (buy it now) | 'locked' (buy the one before first). */
function stateOf(profile, index) {
  const bike = BIKES[index]
  if (profile.bike === bike.id) return 'equipped'
  if (profile.bikes.includes(bike.id)) return 'owned'
  if (index > 0 && !profile.bikes.includes(BIKES[index - 1].id)) return 'locked'
  return 'next'
}

function BikeCard({ index }) {
  const bike = BIKES[index]
  const profile = useGame((s) => s.profile)
  const state = stateOf(profile, index)
  const afford = profile.wins >= bike.cost
  const rarity = RARITIES[bike.rarity]
  const buy = () => {
    if (getGame().profile.wins < bike.cost) {
      sfx.error()
      return
    }
    actions.buyBike(bike.id)
  }

  const openPanel = useGame((s) => s.openPanel)
  const upgrade = (
    <ChunkyButton gradient={GRADIENTS.goldButton} onClick={() => openPanel('garage', { bikeId: bike.id })} style={{ height: u(58), width: u(120) }} title={`Upgrade ${bike.name}`}>
      <Icon name="wrench" size={u(40)} />
    </ChunkyButton>
  )
  let action
  if (state === 'equipped') {
    action = (
      <div className="flex w-full" style={{ gap: u(8) }}>
        <div className="flex flex-1 items-center justify-center" style={{ height: u(58), borderRadius: u(10), background: GRADIENTS.greyButton, border: `${u(4)} solid #111`, fontSize: u(28), gap: u(6) }}>
          <Icon name="check" size={u(36)} />
          <StrokeText stroke={u(6)}>Equipped</StrokeText>
        </div>
        {upgrade}
      </div>
    )
  } else if (state === 'owned') {
    action = (
      <div className="flex w-full" style={{ gap: u(8) }}>
        <ChunkyButton gradient={GRADIENTS.blueButton} onClick={() => actions.equipBike(bike.id)} className="flex-1" style={{ height: u(58) }} title={`Equip ${bike.name}`}>
          <span style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(6)}>Equip</StrokeText>
          </span>
        </ChunkyButton>
        {upgrade}
      </div>
    )
  } else if (state === 'locked') {
    action = (
      <div className="flex w-full items-center justify-center text-center" style={{ minHeight: u(58), borderRadius: u(10), background: GRADIENTS.slate, border: `${u(4)} solid #111`, fontSize: u(20), padding: `0 ${u(6)}` }}>
        <span style={BLURB}>Buy the {BIKES[index - 1].name} first</span>
      </div>
    )
  } else {
    action = (
      <ChunkyButton gradient={afford ? GRADIENTS.greenButton : GRADIENTS.greyButton} onClick={buy} className="w-full" style={{ height: u(58), gap: u(10) }} title={`Buy ${bike.name}`}>
        <span style={{ fontSize: u(28) }}>
          <StrokeText stroke={u(6)}>Buy</StrokeText>
        </span>
        <Price amount={bike.cost} size={28} afford={afford} />
      </ChunkyButton>
    )
  }

  return (
    <div
      className="relative flex flex-col"
      style={{
        gap: u(6),
        padding: u(10),
        borderRadius: u(10),
        border: `${u(5)} solid ${state === 'next' ? '#ffd23f' : '#111'}`,
        background: state === 'locked' ? 'linear-gradient(180deg, #2a2e36, #1f2228)' : 'linear-gradient(180deg, #3a3f4a, #2a2e36)',
        opacity: state === 'locked' ? 0.82 : 1,
      }}
    >
      <span className="absolute" style={{ top: u(6), right: u(10), fontSize: u(24) }}>
        <StrokeText stroke={u(5)} fill="#9aa6b8">
          #{index + 1}
        </StrokeText>
      </span>
      <div className="flex items-center" style={{ gap: u(8) }}>
        <Icon name={`bike:${bike.color}:${bike.accent}`} size={u(104)} />
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <span style={{ fontSize: u(bike.name.length > 12 ? 28 : 32) }}>
            <StrokeText stroke={u(6)}>{bike.name}</StrokeText>
          </span>
          <span style={{ fontSize: u(22) }}>
            <StrokeText stroke={u(5)} fill={rarity.color}>
              {rarity.name.toUpperCase()}
            </StrokeText>
          </span>
        </div>
      </div>
      <StatBar label="Speed" value={`${Math.round(bike.top * KMH)} km/h`} fraction={bike.top / MAX_TOP} color={GRADIENTS.barFill} />
      <StatBar label="Handling" value={bike.handling.toFixed(2)} fraction={bike.handling / MAX_HANDLING} color="linear-gradient(180deg,#9ff0ff,#2fb8ff)" />
      <StatBar label="Landing" value={`${bike.landing} m/s`} fraction={bike.landing / MAX_LANDING} color="linear-gradient(180deg,#c6ff7a,#26ad3c)" />
      <div className="whitespace-normal" style={{ fontSize: u(19), minHeight: u(46) }}>
        {CRESTS[index].length > 0 ? (
          <span style={BLURB}>
            Crests the hill to{' '}
            {CRESTS[index].map((c, i) => (
              <span key={c} style={{ color: '#ffd23f' }}>
                {i > 0 ? ', ' : ''}
                {c}
              </span>
            ))}
          </span>
        ) : (
          <span style={BLURB}>{index === 0 ? 'Your trusty first ride.' : 'Fast enough for every hill - go for a record!'}</span>
        )}
      </div>
      {action}
    </div>
  )
}

/**
 * The bike shop: every bike, in order, with what it does - top speed (each one carries
 * enough speed to crest one more hill), handling and how hard a landing it takes - and
 * which hill it opens. Bought in order with Coins, any owned one can be equipped. The
 * same bikes stand in the shop in the lobby.
 */
export function BikesPanel() {
  return (
    <Panel title="BIKES" icon="bike" width={1180}>
      <p className="m-0 text-center whitespace-normal" style={{ fontSize: u(24), marginBottom: u(12) }}>
        <span style={BLURB}>Every hill needs a faster bike: each one here crests one more. Boost only gets you back to full speed - it can't carry you over!</span>
      </p>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(330)}, 1fr))`, gap: u(14) }}>
        {BIKES.map((bike, i) => (
          <BikeCard key={bike.id} index={i} />
        ))}
      </div>
    </Panel>
  )
}

export default BikesPanel
