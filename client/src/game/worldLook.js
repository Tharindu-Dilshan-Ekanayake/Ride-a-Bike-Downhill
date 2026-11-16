import { WORLDS } from '@shared/balance'
import { Color } from 'three'

import { getGame } from '../store/game'
import { SKY } from './sceneStyle'
import { skyUniforms } from './skyState'

/**
 * The world you're in (index into balance WORLDS) and what it changes on screen: the
 * lobby's venue and sky. GameScene rebuilds what depends on the world when it changes;
 * tables derived from a world's zones are built once per world (`perWorld`) and picked
 * when used.
 */
export const activeWorld = () => getGame().profile.world || 0

/** The current world's zones (its mountain road's named stretches). */
export const zones = () => (WORLDS[activeWorld()] ?? WORLDS[0]).zones

/** `build(zones, world)` for every world, up front; returns a getter for the current one. */
export function perWorld(build) {
  const tables = WORLDS.map((w, world) => build(w.zones, world))
  return () => tables[activeWorld()] ?? tables[0]
}

/** A sky's look, parsed once: `{ top, horizon, sun, glow, clouds, stars }` from hex and numbers. */
export function skyLook({ top, horizon, sun = '#ffffff', glow = 0.5, clouds = 0.4, stars = 0 }) {
  return { top: new Color(top), horizon: new Color(horizon), sun: new Color(sun), glow, clouds, stars }
}

/**
 * The lobby's sky in each world: Pine Peak's clear alpine blue; Frost Ridge's pale, icy
 * sky with a low white sun (its haze, and the fog, the colour of fresh snow).
 */
const LOBBY_SKIES = [skyLook(SKY), skyLook({ top: '#5f9ee8', horizon: '#eef6ff', sun: '#ffffff', glow: 0.75, clouds: 0.85, stars: 0 })]
export const lobbySky = () => LOBBY_SKIES[activeWorld()] ?? LOBBY_SKIES[0]

/**
 * Moves the sky (and the fog, which matches its horizon) towards `look` by `k` (0-1; 1
 * jumps straight there). Allocation-free: safe in a frame loop.
 */
export function blendSky(look, k, fog) {
  const u = skyUniforms
  u.topColor.value.lerp(look.top, k)
  u.horizonColor.value.lerp(look.horizon, k)
  u.sunColor.value.lerp(look.sun, k)
  u.glow.value += (look.glow - u.glow.value) * k
  u.clouds.value += (look.clouds - u.clouds.value) * k
  u.stars.value += (look.stars - u.stars.value) * k
  if (fog) fog.color.copy(u.horizonColor.value)
}

/** Puts the current world's lobby sky back (and the fog, which matches its horizon). */
export function showLobbySky(fog) {
  blendSky(lobbySky(), 1, fog)
}
