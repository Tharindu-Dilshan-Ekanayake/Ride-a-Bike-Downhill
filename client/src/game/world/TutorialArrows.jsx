import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { BIKES, TUTORIAL } from '@shared/balance'
import { BIKE_STANDS, groundHeightAt, RIDE_ZONE } from '@shared/world'

import { getGame } from '../../store/game'
import { createToyInstances, PropBuilder } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'

const MAX_CHEVRONS = 14
const SPACING = 2.4
/** Stop drawing arrows this close to the goal. */
const ARRIVED = 3.5

/** The START gate: the middle of the ride zone. */
const GATE = { x: (RIDE_ZONE.minX + RIDE_ZONE.maxX) / 2, z: (RIDE_ZONE.minZ + RIDE_ZONE.maxZ) / 2, reach: 3 }
/** Scratch target for the bike shop step (the next bike's stand), reused every frame. */
const nextStand = { x: 0, z: 0, reach: 2.6 }

/**
 * Ground point the current tutorial step leads to, or null: the START gate, or the stand
 * of the next bike you don't own yet. (The upgrades step is the HUD's cards: no arrow.)
 */
function targetFor(step, profile) {
  if (!step) return null
  if (step.target === 'start') return GATE
  if (step.target === 'bikes') {
    for (let i = 0; i < BIKES.length; i += 1) {
      if (profile.bikes.includes(BIKES[i].id)) continue
      nextStand.x = BIKE_STANDS[i].x
      nextStand.z = BIKE_STANDS[i].z
      return nextStand
    }
  }
  return null
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)
const _up = new Vector3(0, 1, 0)

/** A flat ">"-shaped chevron lying on the ground, pointing along +Z. */
function chevronGeometry() {
  const p = new PropBuilder()
  for (const side of [-1, 1]) {
    p.box(side * 0.42, 0.05, -0.05, 1.15, 0.08, 0.38, '#ff9a1f', STYLE.GLOW, [0, side * 0.75, 0])
  }
  return p.build()
}

/**
 * Orange chevrons on the ground leading to the current tutorial goal: the START gate,
 * then the next bike in the shop. They march towards the target and disappear once you
 * get there (and while you're out on a ride).
 */
export function TutorialArrows() {
  const ref = useRef(null)
  const { mesh } = useMemo(() => {
    const m = createToyInstances(chevronGeometry(), sharedMaterials().toy, MAX_CHEVRONS)
    return { mesh: m }
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  useFrame((state) => {
    const instanced = ref.current
    if (!instanced) return
    const { profile, ride } = getGame()
    const target = targetFor(TUTORIAL[profile.tutorialStep], profile)
    const player = runtime.player.position
    if (!target || ride || runtime.camera.mode !== 'follow') {
      instanced.count = 0
      return
    }
    const dx = target.x - player.x
    const dz = target.z - player.z
    const dist = Math.hypot(dx, dz)
    if (dist < (target.reach ?? ARRIVED)) {
      instanced.count = 0
      return
    }
    const ux = dx / dist
    const uz = dz / dist
    _q.setFromAxisAngle(_up, Math.atan2(ux, uz))
    // March towards the goal.
    const offset = (state.clock.elapsedTime * 3) % SPACING
    let count = 0
    for (let d = 1.6 + offset; d < dist - 1 && count < MAX_CHEVRONS; d += SPACING) {
      const x = player.x + ux * d
      const z = player.z + uz * d
      // Over the bike stands, not under them, and well clear of everything lying on the
      // floor (painted decals 0.04 up, the start line and chevrons up to 0.1).
      _p.set(x, groundHeightAt(x, z) + 0.15, z)
      // Fade in near the player, shrink near the goal - in plan only, so their height
      // above the floor never changes.
      const scale = Math.max(0.01, Math.min(1, (d - 1.2) / 1.5) * Math.min(1, (dist - d) / 2))
      _s.set(scale, 1, scale)
      instanced.setMatrixAt(count, _m.compose(_p, _q, _s))
      count += 1
    }
    instanced.count = count
    instanced.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}

export default TutorialArrows
