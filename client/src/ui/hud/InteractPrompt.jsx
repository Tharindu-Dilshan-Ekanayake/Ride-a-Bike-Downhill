import { useEffect, useMemo } from 'react'

import { BIKES, KMH, RARITIES, WORLD_PORTALS, WORLDS } from '@shared/balance'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from './parts'
import { GRADIENTS, u } from './style'

/** 'equipped' | 'owned' | 'buy' | 'locked' (the bike before it isn't owned yet). */
function bikeState(profile, index) {
  const bike = BIKES[index]
  if (profile.bike === bike.id) return 'equipped'
  if (profile.bikes.includes(bike.id)) return 'owned'
  if (index > 0 && !profile.bikes.includes(BIKES[index - 1].id)) return 'locked'
  return 'buy'
}

function StatLine({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between" style={{ fontSize: u(26), gap: u(12) }}>
      <span className="flex items-center" style={{ gap: u(6) }}>
        <Icon name={icon} size={u(36)} />
        <StrokeText stroke={u(5)}>{label}</StrokeText>
      </span>
      <StrokeText stroke={u(5)} gradient={GRADIENTS.gold}>
        {value}
      </StrokeText>
    </div>
  )
}

/**
 * The card for the bike on the stand you're standing on: its paint, name, rarity and
 * stats, and BUY / EQUIP (E on a keyboard).
 */
function BikeCard({ index }) {
  const profile = useGame((s) => s.profile)
  const bike = BIKES[index]
  const state = bikeState(profile, index)
  const rarity = RARITIES[bike.rarity]
  const afford = profile.wins >= bike.cost
  const run = useMemo(() => {
    if (state === 'owned') return () => actions.equipBike(bike.id)
    if (state === 'buy' && afford) return () => actions.buyBike(bike.id)
    return null
  }, [state, afford, bike.id])

  useEffect(() => {
    if (!run) return undefined
    const onKey = (e) => {
      if (e.code === 'KeyE' && !e.repeat) run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  let button
  if (state === 'equipped') button = <StrokeText stroke={u(7)}>EQUIPPED</StrokeText>
  else if (state === 'owned') button = <StrokeText stroke={u(7)}>EQUIP (E)</StrokeText>
  else if (state === 'locked') button = <StrokeText stroke={u(6)}>Buy the {BIKES[index - 1].name} first</StrokeText>
  else button = <Price amount={bike.cost} size={34} afford={afford} />

  return (
    <div
      className="pointer-events-auto absolute flex flex-col"
      style={{
        left: '56%',
        top: '22%',
        width: u(380),
        gap: u(6),
        padding: u(14),
        borderRadius: u(14),
        border: `${u(5)} solid #111`,
        background: 'linear-gradient(180deg, rgba(30,33,38,0.94), rgba(18,20,24,0.94))',
        boxShadow: `0 ${u(6)} 0 rgba(0,0,0,0.35)`,
      }}
    >
      <div className="flex items-center" style={{ gap: u(10) }}>
        <Icon name={`bike:${bike.color}:${bike.accent}`} size={u(96)} />
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <span style={{ fontSize: u(36) }}>
            <StrokeText stroke={u(7)}>{bike.name}</StrokeText>
          </span>
          <span style={{ fontSize: u(24) }}>
            <StrokeText stroke={u(5)} fill={rarity.color}>
              {rarity.name.toUpperCase()} · #{index + 1}
            </StrokeText>
          </span>
        </div>
      </div>
      <StatLine icon="speed" label="Top speed" value={`${Math.round(bike.top * KMH)} km/h`} />
      <StatLine icon="bike" label="Handling" value={bike.handling.toFixed(2)} />
      <StatLine icon="check" label="Landing" value={`${bike.landing} m/s`} />
      <ChunkyButton
        onClick={run || undefined}
        disabled={!run}
        gradient={state === 'equipped' || state === 'locked' ? GRADIENTS.greyButton : state === 'owned' ? GRADIENTS.blueButton : afford ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        style={{ height: u(64), marginTop: u(6), fontSize: u(30) }}
        title={bike.name}
      >
        {button}
      </ChunkyButton>
    </div>
  )
}

/** What standing on the current spot lets you do, other than a bike stand: { title, action, run }. */
function usePrompt() {
  const atFreeReward = useGame((s) => s.zone.freeReward)
  const freeTaken = useGame((s) => s.session.freeRewardTaken)
  const atPortal = useGame((s) => s.zone.portal)
  const finished = useGame((s) => (s.profile.stats.bestTime?.[0] || 0) > 0)
  const inWorld = useGame((s) => s.profile.world)
  const unlocked = useGame((s) => s.profile.world2Unlocked)

  // Walking into the portal takes you through (ticker.js); this says where to.
  if (atPortal) {
    const world = WORLD_PORTALS[atPortal]
    if (!world) return null
    if (inWorld === 1) return { title: WORLDS[0].name, action: 'Step out and back in to go home', run: null }
    if (unlocked || finished) return { title: world.name, action: `Bigger Coins on its mountain!`, run: null }
    return { title: world.name, action: `Reach the bottom of ${WORLDS[world.finish].name} to open it`, run: null }
  }

  if (atFreeReward) {
    return freeTaken ? { title: 'Free Gift', action: 'Come back next time!', run: null } : { title: 'Free Gift', action: 'Claim', run: () => actions.claimFreeReward() }
  }
  return null
}

/** Proximity prompt, styled like the platform's own: a dark box with the key to press. */
function Prompt({ prompt }) {
  const run = prompt.run
  useEffect(() => {
    if (!run) return undefined
    const onKey = (e) => {
      if (e.code === 'KeyE' && !e.repeat) run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  return (
    <button
      type="button"
      onClick={() => run?.()}
      className="pp-btn pointer-events-auto absolute flex items-center text-left text-white"
      style={{
        left: '53%',
        top: '50%',
        gap: u(14),
        padding: `${u(12)} ${u(20)} ${u(12)} ${u(12)}`,
        borderRadius: u(10),
        background: 'rgba(24, 26, 30, 0.78)',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 600,
      }}
    >
      {run && (
        <span className="flex items-center justify-center rounded-full" style={{ width: u(54), height: u(54), border: `${u(3)} solid #fff`, fontSize: u(26) }}>
          E
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span style={{ fontSize: u(20), opacity: 0.75 }}>{prompt.title}</span>
        <span style={{ fontSize: u(28) }}>{prompt.action}</span>
      </span>
    </button>
  )
}

/** Whatever the spot you're standing on offers: a bike stand's card, the portal, the gift stand. */
export function InteractPrompt() {
  const stand = useGame((s) => s.zone.stand)
  const prompt = usePrompt()
  const busy = useGame((s) => Boolean(s.ride || s.rideResult || s.panel))
  if (busy) return null
  if (stand >= 0 && BIKES[stand]) return <BikeCard index={stand} />
  if (!prompt) return null
  return <Prompt prompt={prompt} />
}

export default InteractPrompt
