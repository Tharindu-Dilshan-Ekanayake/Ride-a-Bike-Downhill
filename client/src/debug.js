import { runtime } from './game/runtime'
import { claimRide, endRide, requestRide, ride } from './game/ride/rideControl'
import { actions } from './net/actions'
import { remotePlayers } from './net/remotePlayers'
import { useGame } from './store/game'
import { useQuality } from './store/quality'

/**
 * `?debug` in the URL exposes game internals on `window.__pp` for the automated
 * perf/screenshot checks and console poking. Off by default; changes nothing else.
 *
 * `__pp.renderer` is filled in by PerfProbe (draw calls, triangles, textures), and
 * `__pp.autopilot = true` steers the bike down the middle of the road by itself (for
 * the automated perf run).
 */
export function installDebugHooks() {
  if (typeof window === 'undefined') return
  if (!new URLSearchParams(window.location.search).has('debug')) return
  window.__pp = { runtime, useGame, useQuality, actions, remotePlayers, ride, requestRide, endRide, claimRide, autopilot: false }
}
