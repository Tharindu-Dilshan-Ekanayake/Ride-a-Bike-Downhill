import { useEffect, useRef, useState } from 'react'

import { runtime } from '../game/runtime'
import { useGame } from '../store/game'
import { GRADIENTS } from './hud/style'

/** Joystick travel radius, in CSS pixels. */
const RADIUS = 56

function detectTouch() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
}

/** The chunky round look of the HUD's buttons, sized in CSS pixels. */
const roundButton = (size, background) => ({
  width: size,
  height: size,
  background,
  border: '4px solid #111',
})

/** Pointer handlers that hold `set(true)` while a finger is down on the button. */
const hold = (set) => ({
  onPointerDown: (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    set(true)
  },
  onPointerUp: () => set(false),
  onPointerCancel: () => set(false),
  onLostPointerCapture: () => set(false),
  onContextMenu: (e) => e.preventDefault(),
})

function RoundButton({ label, size, gradient, className = '', style, children, set }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`pp-btn pp-chunky pointer-events-auto absolute z-20 flex touch-none select-none items-center justify-center rounded-full text-white ${className}`}
      style={{ ...roundButton(size, gradient), ...style }}
      {...hold(set)}
    >
      <span className="pp-gloss" style={{ borderRadius: `${size / 2}px ${size / 2}px ${size / 3}px ${size / 3}px` }} />
      {children}
    </button>
  )
}

const Arrow = ({ d, size = 40 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3.5">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Label = ({ children }) => (
  <span className="pp-font relative" style={{ fontSize: 15, textShadow: '0 2px 0 #000, 0 0 3px #000' }}>
    {children}
  </span>
)

/**
 * On-screen controls for touch devices.
 *
 * In the lobby: a floating joystick wherever the left side of the screen is touched, and
 * a jump button; everything else is walking onto things (the START gate, a bike stand).
 * On the bike: hold-to-steer arrows bottom-left, and BOOST, JUMP and BRAKE bottom-right
 * (in the air BRAKE leans back: hold it to backflip).
 *
 * Writes straight into `runtime.input` and moves the knob through refs, so dragging
 * never re-renders React.
 */
export function TouchControls() {
  const [isTouch, setIsTouch] = useState(detectTouch)
  const riding = useGame((s) => Boolean(s.ride) && !s.rideResult)

  // A touchscreen laptop can start with a mouse; show the controls on first touch.
  useEffect(() => {
    if (isTouch) return undefined
    const onTouch = (e) => {
      if (e.pointerType === 'touch') setIsTouch(true)
    }
    window.addEventListener('pointerdown', onTouch)
    return () => window.removeEventListener('pointerdown', onTouch)
  }, [isTouch])

  // Nothing stays held across a switch between walking and riding.
  useEffect(() => {
    held.left = false
    held.right = false
    Object.assign(runtime.input, { joyX: 0, joyY: 0, jump: false, steer: 0, brake: false, boost: false, leanFwd: false })
  }, [riding])

  if (!isTouch) return null
  return riding ? <RideButtons /> : <Joystick />
}

// What each button does, held or let go. Module-level: they write runtime.input, which
// lives outside React.
const held = { left: false, right: false }
const steerFor = (side) => (on) => {
  held[side] = on
  runtime.input.steer = (held.right ? 1 : 0) - (held.left ? 1 : 0)
}
const steerLeft = steerFor('left')
const steerRight = steerFor('right')
const setBoost = (on) => {
  runtime.input.boost = on
}
const setRideJump = (on) => {
  runtime.input.jump = on
}
const setBrake = (on) => {
  runtime.input.brake = on
}
const setJump = (on) => {
  runtime.input.jump = on
}

/** Steering arrows and the ride's three buttons. */
function RideButtons() {
  return (
    <>
      <RoundButton label="Steer left" size={92} gradient={GRADIENTS.slate} className="tb tb-left" set={steerLeft}>
        <Arrow d="M15 5l-7 7 7 7" size={48} />
      </RoundButton>
      <RoundButton label="Steer right" size={92} gradient={GRADIENTS.slate} className="tb tb-right" set={steerRight}>
        <Arrow d="M9 5l7 7-7 7" size={48} />
      </RoundButton>

      <RoundButton
        label="Boost"
        size={88}
        gradient={GRADIENTS.goldButton}
        className="tb tb-boost"
        set={setBoost}
      >
        <Label>BOOST</Label>
      </RoundButton>
      <RoundButton
        label="Jump"
        size={88}
        gradient={GRADIENTS.greenButton}
        className="tb tb-jump"
        set={setRideJump}
      >
        <Label>JUMP</Label>
      </RoundButton>
      <RoundButton
        label="Brake"
        size={72}
        gradient={GRADIENTS.redButton}
        className="tb tb-brake"
        set={setBrake}
      >
        <Label>BRAKE</Label>
      </RoundButton>
    </>
  )
}

/** The lobby's floating joystick and jump button. */
function Joystick() {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const active = useRef({ id: null, x: 0, y: 0 })

  const show = (x, y) => {
    const base = baseRef.current
    if (!base) return
    base.style.opacity = '1'
    base.style.left = `${x - RADIUS}px`
    base.style.top = `${y - RADIUS}px`
  }

  const onDown = (e) => {
    if (active.current.id !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    active.current = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top }
    show(active.current.x, active.current.y)
  }

  const onMove = (e) => {
    const a = active.current
    if (a.id !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    let dx = e.clientX - rect.left - a.x
    let dy = e.clientY - rect.top - a.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    // Unit direction times strength, with a small dead zone so a resting thumb doesn't creep.
    const strength = Math.max(0, Math.min(len, RADIUS) / RADIUS - 0.08) / 0.92
    runtime.input.joyX = len > 0 ? (dx / Math.min(len, RADIUS)) * strength : 0
    runtime.input.joyY = len > 0 ? (-dy / Math.min(len, RADIUS)) * strength : 0
  }

  const onUp = (e) => {
    if (active.current.id !== e.pointerId) return
    active.current.id = null
    runtime.input.joyX = 0
    runtime.input.joyY = 0
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
    if (baseRef.current) baseRef.current.style.opacity = '0.35'
  }

  return (
    <>
      <div className="absolute bottom-0 left-0 z-10 h-[62%] w-[42%] touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div
          ref={baseRef}
          // Resting low in the corner, clear of the menu tiles above it: .touch-joy-rest in index.css.
          className="touch-joy-rest pointer-events-none absolute rounded-full border-4 border-white/70 bg-black/25"
          style={{ width: RADIUS * 2, height: RADIUS * 2, opacity: 0.35, left: RADIUS }}
        >
          <div ref={knobRef} className="absolute rounded-full border-4 border-black/40 bg-white/90 shadow-lg" style={{ width: RADIUS, height: RADIUS, left: RADIUS / 2, top: RADIUS / 2 }} />
        </div>
      </div>

      <button
        type="button"
        aria-label="Jump"
        className="touch-jump pp-btn pp-chunky absolute z-20 flex touch-none items-center justify-center rounded-full text-white"
        style={roundButton(70, GRADIENTS.slate)}
        {...hold(setJump)}
      >
        <span className="pp-gloss" style={{ borderRadius: '35px 35px 20px 20px' }} />
        <Arrow d="M5 15l7-7 7 7" size={36} />
      </button>
    </>
  )
}

export default TouchControls
