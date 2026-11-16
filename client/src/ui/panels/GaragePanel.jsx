import { useState } from 'react'

import { BIKES, KMH, PART_LEVELS, PARTS } from '@shared/balance'
import { bikeStats, partCost, partLevel } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const BLURB = { color: '#d7deea', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }

/** What a part does at `level`, in words, for the line under its name. */
function effect(part, level) {
  if (part === 'tires') return `Turning +${Math.round(PARTS.tires.handling * 100 * level)}% · Grip +${Math.round(PARTS.tires.grip * 100 * level)}%`
  if (part === 'suspension') return `Landing +${(PARTS.suspension.landing * level).toFixed(1)} m/s · Smash ${Math.round((0.84 + PARTS.suspension.smash * level) * 100)}% speed kept`
  return `Pick-up +${Math.round(PARTS.gears.accel * 100 * level)}% · Top speed +${(PARTS.gears.top * 100 * level).toFixed(1)}%`
}

function Pips({ level }) {
  return (
    <div className="flex" style={{ gap: u(6) }}>
      {Array.from({ length: PART_LEVELS }, (_, i) => (
        <span key={i} style={{ width: u(30), height: u(18), borderRadius: u(5), border: `${u(3)} solid #111`, background: i < level ? GRADIENTS.barFill : '#2a2f3a' }} />
      ))}
    </div>
  )
}

function PartRow({ bikeId, part }) {
  const profile = useGame((s) => s.profile)
  const level = partLevel(profile, bikeId, part)
  const cost = partCost(profile, bikeId, part)
  const afford = cost !== null && profile.wins >= cost
  const info = PARTS[part]
  const buy = () => {
    const c = partCost(getGame().profile, bikeId, part)
    if (c === null || getGame().profile.wins < c) {
      sfx.error()
      return
    }
    sfx.buy()
    actions.upgradePart(bikeId, part)
  }
  return (
    <div className="flex items-center" style={{ gap: u(14), padding: u(12), borderRadius: u(10), border: `${u(4)} solid #111`, background: 'linear-gradient(180deg, #3a3f4a, #2a2e36)' }}>
      <Icon name={info.icon} size={u(84)} />
      <div className="flex flex-1 flex-col" style={{ gap: u(4), minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: u(12) }}>
          <span style={{ fontSize: u(34) }}>
            <StrokeText stroke={u(6)}>{info.name}</StrokeText>
          </span>
          <Pips level={level} />
        </div>
        <span className="whitespace-normal" style={{ ...BLURB, fontSize: u(19) }}>
          {info.blurb}
        </span>
        <span className="whitespace-normal" style={{ ...BLURB, fontSize: u(19), color: '#ffd23f' }}>
          {level > 0 ? effect(part, level) : 'Stock'}
          {cost !== null && <span style={{ color: '#7dff6a' }}>{`  →  ${effect(part, level + 1)}`}</span>}
        </span>
      </div>
      {cost === null ? (
        <div className="flex items-center justify-center" style={{ width: u(200), height: u(70), borderRadius: u(10), background: GRADIENTS.greyButton, border: `${u(4)} solid #111`, fontSize: u(30) }}>
          <StrokeText stroke={u(6)}>MAX</StrokeText>
        </div>
      ) : (
        <ChunkyButton gradient={afford ? GRADIENTS.greenButton : GRADIENTS.greyButton} onClick={buy} style={{ width: u(200), height: u(70) }} className="flex-col" title={`Upgrade ${info.name}`}>
          <span style={{ fontSize: u(24) }}>
            <StrokeText stroke={u(5)}>UPGRADE</StrokeText>
          </span>
          <Price amount={cost} size={24} afford={afford} />
        </ChunkyButton>
      )}
    </div>
  )
}

/**
 * The GARAGE: tune any bike you own, part by part - tires, suspension, gears - five levels
 * each, each level a little dearer. Opens on walking into the garage in the lobby, from
 * the Garage tile, or a bike's UPGRADE button (which picks that bike).
 */
export function GaragePanel() {
  const profile = useGame((s) => s.profile)
  const panelData = useGame((s) => s.panelData)
  const [picked, setPicked] = useState(panelData?.bikeId || profile.bike)
  const bikeId = profile.bikes.includes(picked) ? picked : profile.bike
  const bike = BIKES.find((b) => b.id === bikeId) || BIKES[0]
  const stats = bikeStats(profile, bikeId)
  const owned = BIKES.filter((b) => profile.bikes.includes(b.id))
  const tuned = Object.keys(PARTS).reduce((sum, part) => sum + partLevel(profile, bikeId, part), 0)

  return (
    <Panel title="GARAGE" icon="wrench" width={980}>
      <div className="flex flex-col" style={{ gap: u(14) }}>
        <div className="flex overflow-x-auto" style={{ gap: u(10), paddingBottom: u(6) }}>
          {owned.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setPicked(b.id)}
              className="pp-btn pointer-events-auto flex shrink-0 flex-col items-center"
              style={{ padding: u(6), borderRadius: u(10), border: `${u(4)} solid ${b.id === bikeId ? '#ffd23f' : '#111'}`, background: b.id === bikeId ? 'linear-gradient(180deg,#4a5060,#353a46)' : '#2a2e36' }}
            >
              <Icon name={`bike:${b.color}:${b.accent}`} size={u(70)} />
              <span style={{ fontSize: u(16), ...BLURB, color: '#fff' }}>{b.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center" style={{ gap: u(16) }}>
          <Icon name={`bike:${bike.color}:${bike.accent}`} size={u(130)} />
          <div className="flex flex-col" style={{ gap: u(4) }}>
            <span style={{ fontSize: u(44) }}>
              <StrokeText stroke={u(8)}>{bike.name}</StrokeText>
            </span>
            <span style={{ fontSize: u(24) }}>
              <StrokeText stroke={u(5)} gradient={GRADIENTS.gold}>{`TUNED ${tuned}/${PART_LEVELS * 3}`}</StrokeText>
            </span>
            <span style={{ ...BLURB, fontSize: u(21) }}>
              {`${Math.round(stats.top * KMH)} km/h · Handling ${stats.handling.toFixed(2)} · Landing ${stats.landing.toFixed(1)} m/s`}
            </span>
          </div>
        </div>

        {Object.keys(PARTS).map((part) => (
          <PartRow key={part} bikeId={bikeId} part={part} />
        ))}
        <span className="text-center" style={{ ...BLURB, fontSize: u(19) }}>
          Each new bike still climbs one more hill - tuning makes the one you ride faster to pick up, sharper and tougher.
        </span>
      </div>
    </Panel>
  )
}

export default GaragePanel
