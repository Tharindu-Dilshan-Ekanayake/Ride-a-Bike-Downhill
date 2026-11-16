import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import { FREE_REWARD, PATH_HALF, PLAZA, PORTALS, RIDE_ZONE, SHOP, SPAWN, TRACK_START } from '@shared/world'

import { PALETTE, venueOf } from '../sceneStyle'

/**
 * The plaza floor: one big plane whose colours come from a tiny "ground map" texture
 * painted at one texel per world unit - the grass (or snow) in 4 m bands, the paved path
 * from spawn to the START gate, the asphalt apron under the gate, the bike shop's yard and
 * the portal's rings - so every edge is crisp and falls on the stud-tile seams, and the
 * whole floor is a single draw call however many regions it has.
 */

const MAP = { minX: -64, maxX: 64, minZ: TRACK_START.z, maxZ: PLAZA.maxZ + 12 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the mountain drops away down the road there. */
export const GROUND_NORTH_EDGE = TRACK_START.z

/** The asphalt under the start gate, from the plaza's edge back past the gate. */
export const APRON = { minX: RIDE_ZONE.minX - 1, maxX: RIDE_ZONE.maxX + 1, minZ: TRACK_START.z, maxZ: RIDE_ZONE.maxZ + 3 }

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(r.minX - MAP.minX), Math.round(r.minZ - MAP.minZ), Math.round(r.maxX - r.minX), Math.round(r.maxZ - r.minZ))
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    for (let dz = -radius; dz < radius; dz += 1) {
      for (let dx = -radius; dx < radius; dx += 1) {
        if ((dx + 0.5) ** 2 + (dz + 0.5) ** 2 <= radius * radius) ctx.fillRect(Math.floor(x + dx - MAP.minX), Math.floor(z + dz - MAP.minZ), 1, 1)
      }
    }
  }
  return { rect, disc }
}

/** The ground map for `world`'s venue (grass or snow). */
export function createGroundMap(maxTexture, world = 0) {
  const g = venueOf(world).ground
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, disc } = painter(ctx)

  // Grass (or snow) all round, in 4 m bands like big studded tiles.
  rect(MAP, g.grass[0])
  for (let z = MAP.minZ, k = 0; z < MAP.maxZ; z += 4, k += 1) rect({ minX: MAP.minX, maxX: MAP.maxX, minZ: z, maxZ: z + 4 }, g.grass[k % 2])
  // The bike shop's yard.
  rect(SHOP, g.yard)
  // A ring round the portal, and round the gift stand.
  for (const p of PORTALS) {
    disc(p.x, p.z, 6, g.ring)
    disc(p.x, p.z, 5, g.portal)
  }
  disc(FREE_REWARD.x, FREE_REWARD.z, 3, g.ring)
  // The paved path from spawn to the gate, white-edged, in light and dark 4 m bands.
  rect({ minX: -PATH_HALF - 1, maxX: PATH_HALF + 1, minZ: APRON.maxZ, maxZ: SPAWN.z + 6 }, g.edge)
  for (let z = APRON.maxZ, k = 0; z < SPAWN.z + 5; z += 4, k += 1) {
    rect({ minX: -PATH_HALF, maxX: PATH_HALF, minZ: z, maxZ: Math.min(SPAWN.z + 5, z + 4) }, g.path[k % 2])
  }
  // A round spawn plaza at the path's south end.
  disc(SPAWN.x, SPAWN.z + 2, 8, g.edge)
  disc(SPAWN.x, SPAWN.z + 2, 7, g.path[0])
  // The asphalt apron under the gate, kerbed white.
  rect({ minX: APRON.minX - 0.5, maxX: APRON.maxX + 0.5, minZ: APRON.minZ, maxZ: APRON.maxZ + 0.5 }, g.edge)
  rect(APRON, PALETTE.asphalt)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/**
 * The ground plane, with UVs computed from world position so the map lands exactly on the
 * world grid. Outside the map, clamp-to-edge repeats the grass (or snow) colour. It stops
 * at the plaza's north edge: beyond is the road down the mountain (the ride's own chunk).
 */
export function createGroundGeometry() {
  const reach = 280
  const minX = -reach
  const maxX = reach
  const minZ = GROUND_NORTH_EDGE
  const maxZ = reach
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
