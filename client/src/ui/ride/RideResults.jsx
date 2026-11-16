import { useEffect, useRef } from 'react'

import { BIKES, WORLDS } from '@shared/balance'
import { formatDistance, formatMultiplier, formatNumber } from '@shared/format'
import { nextBike } from '@shared/logic'
import { zoneIndexIn } from '@shared/track'

import { sfx } from '../../audio/sfx'
import { claimRide } from '../../game/ride/rideControl'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import StrokeText from '../StrokeText'
import './ride.css'

const TITLES = {
  crash: 'CRASHED!',
  stall: 'OUT OF SPEED!',
  finish: 'FINISHED!',
  end: 'RIDE OVER',
}

/** "2:41.33" */
function formatTime(ms) {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

function Row({ label, value, color = '#ffffff' }) {
  return (
    <div className="ride-row">
      <StrokeText stroke={u(6)}>{label}</StrokeText>
      <StrokeText stroke={u(6)} fill={color}>
        {value}
      </StrokeText>
    </div>
  )
}

/**
 * The results screen over the scene once a ride is over: how far you got and why it
 * ended, where that is on the mountain (this zone, the next, your best), the Coins it
 * paid line by line, the total, and a nudge towards the next bike. CLAIM (or Space /
 * Enter) takes you back to the lobby.
 */
export function RideResults() {
  const result = useGame((s) => s.rideResult)
  const profile = useGame((s) => s.profile)
  const claimRef = useRef(null)

  useEffect(() => {
    if (!result) return undefined
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault()
        claimRide()
      }
    }
    // A beat before keys work, so a held Space from the ride doesn't skip it.
    const id = setTimeout(() => window.addEventListener('keydown', onKey), 700)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [result])

  if (!result) return null
  const world = WORLDS[result.world] ? result.world : 0
  const W = WORLDS[world]
  const distance = result.distance || 0
  const zi = zoneIndexIn(W, Math.max(0, distance - 0.5))
  const zone = W.zones[zi]
  const next = W.zones[zi + 1]
  const zoneEnd = zone.start + zone.length
  const inZone = Math.min(1, Math.max(0, (distance - zone.start) / zone.length))
  const best = profile.stats.best?.[world] || 0
  const parts = result.parts || {}
  const bonus = (parts.milestones || 0) + (parts.flips || 0) + (parts.smash || 0)
  const reason = result.reason || (result.finished ? 'finish' : result.crashed ? 'crash' : 'end')
  const title = TITLES[reason] || TITLES.end
  const upcoming = nextBike(profile)
  const canBuy = upcoming && profile.wins >= upcoming.cost

  let sub = null
  if (reason === 'crash') sub = `FLEW ${Math.round(result.flew || 0)} m · ${result.bounces || 0} BOUNCE${result.bounces === 1 ? '' : 'S'}`
  else if (reason === 'stall') sub = zone.gate >= 0 ? `THAT HILL NEEDS THE ${BIKES[zone.gate].name.toUpperCase()}` : 'THAT HILL NEEDS A FASTER BIKE'
  else if (result.finished) sub = `TIME ${formatTime(result.time)}${result.bestTime ? ' · NEW BEST!' : ''}`

  return (
    <div className="ride-results pp-font">
      <div className="ride-card">
        <span style={{ fontSize: u(60) }}>
          <StrokeText stroke={u(9)} gradient={reason === 'finish' ? GRADIENTS.gold : undefined}>
            {title}
          </StrokeText>
        </span>
        <span style={{ fontSize: u(78), lineHeight: 1 }}>
          <StrokeText stroke={u(10)}>{formatDistance(distance)}</StrokeText>
        </span>
        {sub && (
          <span style={{ fontSize: u(28) }}>
            <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
              {sub}
            </StrokeText>
          </span>
        )}
        {result.best && (
          <span style={{ fontSize: u(28) }}>
            <StrokeText stroke={u(6)} fill="#7dff6a">
              NEW BEST RIDE!
            </StrokeText>
          </span>
        )}

        <div className="ride-zonebar" style={{ marginTop: u(8) }}>
          <div className="ride-zonebar-fill" style={{ width: `${inZone * 100}%` }} />
          {best > zone.start && best < zoneEnd && (
            <div className="absolute" style={{ left: `${((best - zone.start) / zone.length) * 100}%`, top: u(-12), bottom: u(-12), width: u(6), background: '#ffd23f', border: `${u(2)} solid #111` }} />
          )}
        </div>
        <div className="ride-row" style={{ fontSize: u(24), marginBottom: u(4) }}>
          <StrokeText stroke={u(5)} fill="#7dff6a">
            {zone.name.toUpperCase()}
          </StrokeText>
          <StrokeText stroke={u(5)}>{next ? `NEXT: ${next.name.toUpperCase()}` : 'THE BOTTOM!'}</StrokeText>
        </div>

        <Row label="DISTANCE" value={`+${formatNumber(parts.distance || 0)}`} />
        <Row label={`COINS (${result.picked || 0})`} value={`+${formatNumber(parts.pickup || 0)}`} />
        <Row label={`BONUS${result.flips ? ` · ${result.flips} FLIP${result.flips === 1 ? '' : 'S'}` : ''}`} value={`+${formatNumber(bonus)}`} />
        {parts.bail > 0 && <Row label="BAIL" value={`+${formatNumber(parts.bail)}`} />}
        {parts.finish > 0 && <Row label="FINISH" value={`+${formatNumber(parts.finish)}`} color="#ffd23f" />}
        <Row label="MULTIPLIER" value={formatMultiplier(result.multiplier || 1)} color="#8ff0ff" />

        <div className="ride-total" style={{ marginTop: u(6) }}>
          <Icon name="coin" size={u(48)} />
          <StrokeText stroke={u(8)}>{result.ok === false ? 'NOT SAVED' : `+${formatNumber(result.total || 0)}`}</StrokeText>
        </div>
        {result.ok === false && (
          <span style={{ fontSize: u(26) }}>
            <StrokeText stroke={u(5)} fill="#ff8a7a">
              Lost connection: this ride wasn&apos;t counted
            </StrokeText>
          </span>
        )}
        {result.gift && (
          <span style={{ fontSize: u(26) }}>
            <StrokeText stroke={u(6)} gradient={GRADIENTS.rainbow}>
              {`LUCKY GIFT! ${result.gift.wins ? `+${formatNumber(result.gift.wins)} COINS` : result.gift.label}`}
            </StrokeText>
          </span>
        )}
        {upcoming && (
          <span style={{ fontSize: u(26) }}>
            <StrokeText stroke={u(6)} fill={canBuy ? '#7dff6a' : '#c9d3e6'}>
              {`${canBuy ? 'BUY NOW: ' : 'NEXT BIKE: '}${upcoming.name.toUpperCase()} · ${formatNumber(upcoming.cost)}`}
            </StrokeText>
          </span>
        )}

        <div className="ride-claim">
          <ChunkyButton
            gradient={GRADIENTS.greenButton}
            onClick={() => {
              sfx.click()
              claimRide()
            }}
            title="Claim"
            style={{ width: u(280), height: u(84) }}
          >
            <span ref={claimRef} style={{ fontSize: u(50) }}>
              <StrokeText stroke={u(9)}>CLAIM</StrokeText>
            </span>
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

export default RideResults
