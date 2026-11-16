import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { iconUrl } from './icons'
import StrokeText from './StrokeText'

const TIPS = [
  'Hold SHIFT (or BOOST) to boost - save it for the hills!',
  'Too slow for a hill? You roll back. Each new bike crests one more hill.',
  'Hit the yellow boost pads for a free burst of speed.',
  'Smash crates and cones for bonus Coins - but dodge the barrels!',
  'Lean back or forward in the air to flip: every flip pays Coins.',
  'Land on your wheels: a hard or crooked landing means a crash.',
  'Rebirth for x2, x3, x4... Coins on every ride, forever.',
  'Each zone further down the mountain pays more per metre.',
  'Ride with friends: everyone in your server adds +10% Coins.',
]

/**
 * The loading screen's backdrop, a mountain road at sunrise in plain CSS (no image to
 * download): the sun glowing over a warm sky, two ranges of peaks, green slopes and the
 * road winding down between them, its centre line dashed. Layers, top first.
 */
const MOUNTAIN_BACKDROP = [
  'radial-gradient(circle at 72% 30%, rgba(255,250,225,1) 0 3%, rgba(255,226,160,0.55) 6%, transparent 16%)',
  'repeating-linear-gradient(180deg, rgba(255,255,255,0.95) 0 14px, transparent 14px 40px) 50% 100% / 10px 34% no-repeat',
  'linear-gradient(180deg, #4b4f63 0%, #3a3d4d 100%) 50% 100% / 34% 34% no-repeat',
  'linear-gradient(170deg, transparent 0 49%, #3fbf5a 50%) 0 100% / 50% 40% no-repeat',
  'linear-gradient(190deg, transparent 0 49%, #36b04f 50%) 100% 100% / 50% 40% no-repeat',
  'conic-gradient(from 135deg at 30% 46%, transparent 0 0, #6a7bb0 0 90deg, transparent 90deg) 0 0 / 100% 100% no-repeat',
  'conic-gradient(from 140deg at 78% 50%, transparent 0 0, #7d8cc2 0 80deg, transparent 80deg) 0 0 / 100% 100% no-repeat',
  'linear-gradient(180deg, #2c5fc0 0%, #6aa3ee 35%, #ffc98c 62%, #ffe2b0 70%)',
].join(', ')

/**
 * Full-screen loading overlay. Progress is drei's asset loader progress, blended with a
 * time-based creep so a single large download never looks frozen, and it only reaches
 * 100% when the game reports ready (avatar in place, first frame drawn).
 *
 * @param {{ done: boolean }} props
 */
export function LoadingScreen({ done }) {
  const { progress } = useProgress()
  const [creep, setCreep] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  useEffect(() => {
    if (done) return undefined
    const id = setInterval(() => setCreep((c) => Math.min(90, c + (90 - c) * 0.06)), 120)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!done) return undefined
    const id = setTimeout(() => setHidden(true), 450)
    return () => clearTimeout(id)
  }, [done])

  if (hidden) return null
  const shown = done ? 100 : Math.max(creep, Math.min(95, progress * 0.95))

  return (
    <div
      className="pp-font absolute inset-0 z-[100] flex flex-col items-center justify-center gap-8 transition-opacity duration-500"
      style={{
        opacity: done ? 0 : 1,
        background: MOUNTAIN_BACKDROP,
      }}
    >
      <div className="pp-loading-disc" aria-hidden="true">
        <img src={iconUrl('bike')} alt="" width="170" height="170" draggable={false} />
      </div>

      {/* The game's name: RIDE A BIKE over a big rainbow DOWNHILL, tilted like a sticker. */}
      <h1 className="m-0 flex flex-col items-center text-center leading-none" style={{ transform: 'rotate(-3deg)' }}>
        <span style={{ fontSize: 'clamp(36px, 8vw, 84px)' }}>
          <StrokeText stroke="0.16em" gradient="linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #ffe36b 56%, #ffb21e 100%)">
            RIDE A BIKE
          </StrokeText>
        </span>
        <span style={{ fontSize: 'clamp(40px, 9vw, 104px)', marginTop: '-0.08em' }}>
          <StrokeText
            stroke="0.15em"
            gradient="linear-gradient(90deg, #ff4a4a 0%, #ff9a1e 18%, #ffe23a 36%, #4be05a 54%, #2fd0ff 72%, #b05cff 90%, #ff5fd2 100%)"
          >
            DOWNHILL
          </StrokeText>
        </span>
        <span className="text-base md:text-xl" style={{ marginTop: '0.4em' }}>
          <StrokeText stroke={5}>RIDE • DODGE • FLIP • REBIRTH</StrokeText>
        </span>
      </h1>

      <div className="w-[min(560px,80vw)]">
        <div className="relative h-9 overflow-hidden rounded-xl border-4 border-black bg-black/40">
          <div
            // Scaled, not resized: it moves while the game is starting up, and a transform
            // never needs a layout.
            className="h-full origin-left rounded-md transition-transform duration-200"
            style={{ transform: `scaleX(${shown / 100})`, background: 'linear-gradient(180deg, #fff27a 0%, #ffc61e 50%, #ff9a12 100%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-lg">
            <StrokeText stroke={5}>{done ? 'READY!' : `LOADING ${Math.round(shown)}%`}</StrokeText>
          </div>
        </div>
        <p className="mt-4 text-center text-base md:text-lg">
          <StrokeText stroke={4}>{tip}</StrokeText>
        </p>
      </div>
    </div>
  )
}

export default LoadingScreen
