import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { BIKES, RARITIES } from '@shared/balance'
import { BIKE_STANDS, STAND_SIZE } from '@shared/world'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import { asToyInstance, BlockSet, disposeBlocks } from '../blocks'
import { createGlowInstances, disposeGlow } from '../glow'
import { standLabelSpec, standState } from '../labels/lobbyLabels'
import { updateWorldLabel } from '../labels/registry'
import { sharedMaterials, STYLE } from '../materials'
import { bikeGeometry } from '../ride/bikeModels'
import { runtime } from '../runtime'

/** Stand colours by state: green equipped, blue owned, gold buyable now, red not yet. */
const STAND_COLORS = {
  equipped: new Color('#3fdc4a'),
  owned: new Color('#38c8ff'),
  buy: new Color('#ffc21a'),
  locked: new Color('#d8343c'),
}

/** The plinth each bike stands on: its top, over the stand's top. */
const PLINTH_TOP = 0.88
/** Showroom bikes are shown a little bigger than life, turned a little towards the plaza. */
const SHOWN = 1.3
const SHOWN_YAW = 0.45
/** Where a bike's halo sits: about the middle of the bike. */
const HALO_Y = PLINTH_TOP + 0.75 * SHOWN

const _m = new Matrix4()
const _e = new Euler()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _halo = new Vector3()
const _haloQ = new Quaternion()
const _haloS = new Vector3()

/**
 * The stands, in one block set. The first BIKE_STANDS.length blocks are the stands' tops
 * themselves (recoloured by state, so their instance index is the stand index); the
 * trimmings follow: a grey frame, a glowing ring in the bike's colour and a white plinth.
 */
function buildStands() {
  const set = new BlockSet()
  const slab = STAND_SIZE - 0.4
  for (const stand of BIKE_STANDS) set.addOn(stand.x, stand.y - 0.1, stand.z, slab, 0.3, slab, '#ffffff', STYLE.STUDS)
  for (const stand of BIKE_STANDS) {
    const bike = BIKES[stand.index]
    const { x, y, z } = stand
    const e = slab / 2 + 0.1
    for (const side of [-1, 1]) {
      set.addOn(x, y - 0.1, z + side * e, slab + 0.5, 0.45, 0.3, '#c4ccd8', STYLE.SMOOTH)
      set.addOn(x + side * e, y - 0.1, z, 0.3, 0.45, slab + 0.2, '#c4ccd8', STYLE.SMOOTH)
    }
    for (const side of [-1, 1]) {
      set.addOn(x, y + 0.2, z + side * 1.45, 3.1, 0.06, 0.18, bike.color, STYLE.GLOW)
      set.addOn(x + side * 1.45, y + 0.2, z, 0.18, 0.06, 2.72, bike.color, STYLE.GLOW)
    }
    set.addOn(x, y + 0.2, z, 1.5, PLINTH_TOP - y - 0.2, 2.6, '#f4f7fb', STYLE.SMOOTH, SHOWN_YAW)
  }
  return set.build(sharedMaterials().blocks)
}

/** Every showroom bike, placed on its stand, merged into one mesh: one draw call. */
function buildBikes() {
  const parts = BIKE_STANDS.map((stand) => {
    const g = bikeGeometry(BIKES[stand.index]).clone()
    _q.setFromEuler(_e.set(0, SHOWN_YAW, 0))
    g.applyMatrix4(_m.compose(_p.set(stand.x, PLINTH_TOP, stand.z), _q, _s.setScalar(SHOWN)))
    return g
  })
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  merged.computeBoundingSphere()
  return asToyInstance(merged, sharedMaterials().toy)
}

/**
 * The bike shop: a stand for every bike in the yard on the west side of the plaza, the
 * bike itself on a plinth on top, a soft halo behind it in its rarity's colour. Stands
 * recolour and their labels rewrite as you buy and equip. Three draw calls: stands,
 * bikes, halos.
 */
export function BikeShop() {
  // As a string: the profile is a fresh copy after every update.
  const ownedKey = useGame((s) => s.profile.bikes.join(','))
  const equipped = useGame((s) => s.profile.bike)
  const shadows = useQuality((s) => s.settings.shadows === 'realtime')
  const standsRef = useRef(null)
  const halosRef = useRef(null)

  const playable = useGame((s) => s.playable)

  const assets = useMemo(() => {
    const stands = buildStands()
    const halos = createGlowInstances(BIKES.length, 0.4)
    BIKE_STANDS.forEach((stand) => halos.setColorAt(stand.index, new Color(RARITIES[BIKES[stand.index].rarity]?.color ?? '#ffffff')))
    halos.count = BIKES.length
    return { stands, halos }
  }, [])

  useEffect(
    () => () => {
      disposeBlocks(assets.stands)
      disposeGlow(assets.halos)
    },
    [assets],
  )

  // The twelve bikes are built once the game is on screen, at the first idle moment:
  // modelling them was a good part of a slow phone's start-up, for something you walk to.
  const [bikes, setBikes] = useState(null)
  useEffect(() => {
    if (!playable) return undefined
    let made = null
    const build = () => {
      made = buildBikes()
      setBikes(made)
    }
    const id = 'requestIdleCallback' in window ? requestIdleCallback(build, { timeout: 1500 }) : setTimeout(build, 300)
    return () => {
      if ('cancelIdleCallback' in window) cancelIdleCallback(id)
      else clearTimeout(id)
      if (made) {
        made.geometry.dispose()
        made.dispose()
      }
    }
  }, [playable])

  // Recolour stands and rewrite their labels whenever ownership changes.
  useEffect(() => {
    const stands = standsRef.current
    const profile = { bikes: ownedKey.split(','), bike: equipped }
    for (const stand of BIKE_STANDS) {
      const state = standState(profile, stand.index)
      stands?.setColorAt(stand.index, STAND_COLORS[state])
      updateWorldLabel(`stand-${stand.index}`, standLabelSpec(stand.index, state))
    }
    if (stands?.instanceColor) stands.instanceColor.needsUpdate = true
  }, [ownedKey, equipped])

  useFrame((state) => {
    const halos = halosRef.current
    // Out on a ride the shop is kilometres behind: leave the halos be.
    if (!halos || runtime.camera.mode !== 'follow') return
    for (const stand of BIKE_STANDS) {
      _p.set(stand.x, HALO_Y, stand.z)
      // Set back behind the bike as seen from the camera, so it glows round it, not over it.
      _halo.copy(_p).sub(state.camera.position).normalize().multiplyScalar(1.4).add(_p)
      halos.setMatrixAt(stand.index, _m.compose(_halo, _haloQ, _haloS.setScalar(SHOWN * 3.2)))
    }
    halos.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive ref={standsRef} object={assets.stands} receiveShadow={shadows} />
      {bikes && <primitive object={bikes} castShadow={shadows} />}
      <primitive ref={halosRef} object={assets.halos} />
    </>
  )
}

export default BikeShop
