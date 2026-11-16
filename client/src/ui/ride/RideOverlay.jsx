import { useEffect, useMemo, useRef } from 'react'

import { BIKES, KMH, WORLDS } from '@shared/balance'
import { formatDistance, formatNumber } from '@shared/format'
import { distanceCoins, milestoneCoins, winsMultiplier, zoneAt } from '@shared/logic'
import { getTrack } from '@shared/track'

import { setText } from '../../game/fx/domText'
import { endRide, ride, toggleRideCamera, COUNTDOWN_MS } from '../../game/ride/rideControl'
import { getGame, useGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import Icon from '../Icon'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import StrokeText from '../StrokeText'
import './ride.css'

/** Text and bars are rewritten at most this often (they're DOM, not React state). */
const UPDATE_MS = 1000 / 20
/** How long a hill's note stays up (ms). */
const HINT_MS = 3500

const isTouch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

/** A run of outlined text whose words the frame loop rewrites (`data-live` = its key). */
function Live({ k, size, gradient, fill, stroke = 7, initial = '' }) {
  return (
    <span style={{ fontSize: u(size) }}>
      <StrokeText stroke={u(stroke)} gradient={gradient} fill={fill}>
        <span data-live={k}>{initial}</span>
      </StrokeText>
    </span>
  )
}

/**
 * The ride's HUD: distance and time up top, the Coins this ride is worth top-left, END
 * and CAM top-right, the road to the finish down the right side, speed and boost at the
 * bottom, the controls on the left (keyboard players), and the big moments in the middle
 * - the countdown, a new zone, a hill ahead (and the speed it needs), BAIL! / OUT OF
 * SPEED! / FINISH!.
 *
 * Everything that changes during the ride is written straight to the DOM from its own
 * animation-frame loop, reading ride/rideControl's `ride` - never React state.
 */
export function RideOverlay() {
  const rideState = useGame((s) => s.ride)
  const hasResult = useGame((s) => Boolean(s.rideResult))
  if (!rideState) return null
  return <RideHud world={rideState.world} hidden={hasResult} />
}

function RideHud({ world, hidden }) {
  const root = useRef(null)
  const touch = useMemo(() => isTouch(), [])
  const track = getTrack(world)
  const W = WORLDS[world]
  const best = useGame((s) => s.profile.stats.best?.[world] || 0)

  useEffect(() => {
    const el = root.current
    if (!el) return undefined
    const live = {}
    for (const node of el.querySelectorAll('[data-live]')) (live[node.dataset.live] ??= []).push(node)
    const write = (k, text) => {
      for (const node of live[k] || []) setText(node, text)
    }
    const q = (sel) => el.querySelector(sel)
    const you = q('.ride-progress-you')
    const fill = q('.ride-progress-fill')
    const boostFill = q('.ride-boost-fill')
    const boostBox = q('.ride-boost')
    const lines = q('.ride-speedlines')
    const banner = q('.ride-banner')
    const count = q('.ride-count')
    const shown = {}
    const set = (k, text) => {
      if (shown[k] === text) return
      shown[k] = text
      write(k, text)
    }
    let pickup = 0
    let picked = 0
    let last = 0
    let raf = 0
    const multiplier = winsMultiplier(getGame().profile, Date.now())
    const bikeTop = (BIKES.find((b) => b.id === getGame().profile.bike) || BIKES[0]).top

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (now - last < UPDATE_MS) return
      last = now
      const length = track.length
      // Coins picked up so far, at their zones' worth.
      while (picked < ride.coinList.length) {
        pickup += zoneAt(world, track.coins[ride.coinList[picked] * 3]).coin
        picked += 1
      }
      const worth = (distanceCoins(world, ride.distance) + milestoneCoins(world, ride.distance) + pickup) * multiplier
      set('coins', `+${formatNumber(worth)}`)
      set('dist', formatDistance(ride.distance))
      set('time', ride.time.toFixed(2))
      set('speed', String(Math.round(Math.max(0, ride.grounded ? ride.v : ride.vh) * KMH)))
      set('boost', `${ride.boost.toFixed(1)}s`)
      boostFill.style.transform = `scaleX(${ride.boostMax > 0 ? ride.boost / ride.boostMax : 0})`
      boostBox.classList.toggle('is-on', ride.boosting)
      const k = Math.min(1, ride.m / length)
      you.style.top = `${(1 - k) * 100}%`
      fill.style.height = `${k * 100}%`
      // Speed lines past three-quarters of the bike's top speed (not on LOW).
      if (lines) {
        const settings = getQuality()
        const v = ride.grounded ? ride.v : ride.vh
        const amount = settings.particles ? Math.max(0, Math.min(1, (v - 14) / 20)) * (ride.phase === 'riding' ? 1 : 0) : 0
        const o = (Math.round(amount * 10) / 10).toString()
        if (lines.style.opacity !== o) lines.style.opacity = o
      }

      // The countdown, then GO!
      let countText = ''
      if (ride.phase === 'countdown') countText = String(Math.max(1, 3 - Math.floor(((now - ride.countdownAt) / COUNTDOWN_MS) * 3)))
      else if (ride.phase === 'riding' && now - ride.goAt < 700) countText = 'GO!'
      set('count', countText)
      count.style.visibility = countText ? 'visible' : 'hidden'

      // The banner: what's happening now, most important first.
      let text = ''
      let sub = ''
      let color = '#ffffff'
      if (ride.phase === 'bail') {
        text = 'BAIL!'
        sub = `${Math.round(ride.bail.flew)} m · ${ride.bail.bounces} BOUNCE${ride.bail.bounces === 1 ? '' : 'S'}`
        color = '#ff6a55'
      } else if (ride.phase === 'stall') {
        const hill = track.hills.find((h) => h.m <= ride.m + 1 && ride.m <= h.crest + 1)
        text = 'OUT OF SPEED!'
        sub = hill ? `THIS HILL NEEDS THE ${BIKES[hill.gate].name.toUpperCase()}` : 'GET A FASTER BIKE'
        color = '#ff6a55'
      } else if (ride.phase === 'finish') {
        text = 'FINISH!'
        sub = `${ride.time.toFixed(2)} s`
        color = '#ffd23f'
      } else if (ride.phase === 'riding') {
        const hill = track.hills.find((h) => h.m > ride.m - 2 && h.m - ride.m < 140)
        // A hill's note shows for a few seconds as it comes into range, then gets out of
        // your view (the road ahead matters more than the text).
        if (hill && shown.hillM !== hill.m) {
          shown.hillM = hill.m
          shown.hillAt = now
        }
        if (hill && ride.m < hill.crest && now - shown.hillAt < HINT_MS) {
          const need = Math.round(hill.need * KMH)
          const v = Math.round(ride.v * KMH)
          const able = bikeTop >= hill.need
          text = !able ? 'TOO STEEP!' : ride.m >= hill.m ? 'CLIMB!' : 'HILL AHEAD!'
          sub = !able ? `THIS HILL NEEDS THE ${BIKES[hill.gate].name.toUpperCase()}` : `NEED ${need} KM/H${v < need && ride.boost > 0 ? ' · BOOST BACK TO FULL SPEED!' : ''}`
          color = !able ? '#ff6a55' : v >= need ? '#7dff6a' : '#ffb020'
        } else if (now - ride.zoneAt < 2400 && ride.zone > 0) {
          text = W.zones[ride.zone].name.toUpperCase()
          sub = `${W.zones[ride.zone].coinsPerMeter} COINS PER METRE`
          color = '#8ff0ff'
        }
      }
      set('banner', text)
      set('bannerSub', sub)
      if (shown.bannerColor !== color) {
        shown.bannerColor = color
        for (const node of live.banner || []) if (node.parentElement?.classList.contains('pp-text-fill')) node.parentElement.style.color = color
      }
      banner.classList.toggle('is-on', Boolean(text))
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [track, world, W])

  const hills = track.hills
  return (
    <div ref={root} className={`ride-hud${touch ? ' is-touch' : ''}`} style={{ display: hidden ? 'none' : 'block' }}>
      <div className="ride-speedlines" />

      <div className="ride-top">
        <Live k="dist" size={84} initial="0 m" stroke={9} />
        <div className="ride-pill">
          <Live k="time" size={44} initial="0.00" />
        </div>
      </div>

      <div className="ride-coins">
        <Icon name="coin" size={u(64)} />
        <Live k="coins" size={48} initial="+0" gradient={GRADIENTS.gold} />
      </div>

      <div className="ride-buttons">
        <ChunkyButton gradient={GRADIENTS.redButton} onClick={() => endRide('end')} title="End ride" style={{ width: u(150), height: u(70) }}>
          <span style={{ fontSize: u(40) }}>
            <StrokeText stroke={u(7)}>END</StrokeText>
          </span>
        </ChunkyButton>
        <ChunkyButton gradient={GRADIENTS.blueButton} onClick={toggleRideCamera} title="Camera (C)" style={{ width: u(150), height: u(70) }}>
          <span style={{ fontSize: u(40) }}>
            <StrokeText stroke={u(7)}>CAM</StrokeText>
          </span>
        </ChunkyButton>
      </div>

      <div className="ride-progress">
        <div className="ride-progress-fill" />
        {hills.map((h) => (
          <div key={h.m} className="ride-progress-tick" style={{ top: `${(1 - h.m / track.length) * 100}%` }} />
        ))}
        {best > 0 && <div className="ride-progress-best" style={{ top: `${(1 - Math.min(1, best / track.length)) * 100}%` }} />}
        <div className="ride-progress-you" />
        <span className="absolute whitespace-nowrap" style={{ top: u(-58), left: '50%', transform: 'translateX(-50%)', fontSize: u(34) }}>
          <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
            FINISH
          </StrokeText>
        </span>
      </div>

      <div className="ride-bottom">
        <div className="ride-boost">
          <span style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(6)}>BOOST</StrokeText>
          </span>
          <div className="ride-boost-bar">
            <div className="ride-boost-fill" />
            <span className="absolute inset-0 flex items-center justify-center">
              <Live k="boost" size={26} initial="1.0s" stroke={5} />
            </span>
          </div>
        </div>
        <div className="ride-speedo">
          <Live k="speed" size={72} initial="0" stroke={8} />
          <span style={{ fontSize: u(28) }}>
            <StrokeText stroke={u(5)} fill="#8ff0ff">
              KM/H
            </StrokeText>
          </span>
        </div>
        <div style={{ width: u(210) }} />
      </div>

      {!touch && (
        <div className="ride-hints">
          {[
            [['A', 'D'], 'STEER'],
            [['SHIFT'], 'BOOST'],
            [['S'], 'BRAKE'],
            [['SPACE'], 'JUMP'],
            [['S'], 'BACKFLIP (AIR)'],
            [['C'], 'CAMERA'],
          ].map(([keys, label]) => (
            <div key={label} className="flex items-center">
              {keys.map((key) => (
                <span key={key} className="ride-key">
                  {key}
                </span>
              ))}
              <span style={{ fontSize: u(26), marginLeft: u(4) }}>
                <StrokeText stroke={u(5)}>{label}</StrokeText>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="ride-banner">
        <div>
          <Live k="banner" size={52} stroke={7} />
        </div>
        <div>
          <Live k="bannerSub" size={26} stroke={5} gradient={GRADIENTS.gold} />
        </div>
      </div>

      <div className="ride-count" style={{ visibility: 'hidden' }}>
        <Live k="count" size={190} stroke={14} gradient={GRADIENTS.gold} />
      </div>
    </div>
  )
}

export default RideOverlay
