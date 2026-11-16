import { Vector3 } from 'three'

import { runtime } from '../game/runtime'
import { getGame } from '../store/game'

/**
 * Other players, as the network last described them. Network callbacks write here;
 * the renderer reads it each frame and interpolates between snapshots, drawing
 * everyone ~110 ms in the past so 10 Hz updates still move smoothly.
 *
 * In the lobby a player is a world position; out on the road (`riding`) they're a road
 * point - metre along, metres across, height above the road - which the renderer turns
 * into a world position on the shared road (track.js), so they ride down it with you.
 */

/** sessionId -> remote player */
export const remotePlayers = new Map()

const MAX_SNAPSHOTS = 24

/** Everyone's synced state, whichever world they're in, so a change of world can redraw them. */
const latest = new Map()

export function upsertRemotePlayer(sessionId, state) {
  latest.set(sessionId, state)
  // Only players in your world are drawn: each world feels like its own place.
  if ((state.world || 0) !== (getGame().profile.world || 0)) {
    dropRemotePlayer(sessionId)
    return
  }
  let r = remotePlayers.get(sessionId)
  if (!r) {
    r = {
      sessionId,
      name: '',
      /** Their verified Boxity user id ('' for guests): matches Boxity chat to them. */
      uid: '',
      snaps: [],
      position: new Vector3(state.x, state.y, state.z),
      yaw: state.rotY,
      speed: 0,
      anim: 'idle',
      bikeId: '',
      world: 0,
      /** Their avatar's outfit, parsed from `look`; `lookKey` is the raw string. */
      look: null,
      lookKey: '',
      walkPhase: 0,
      /** On the road: snapshots of their road point, and where they are now (interpolated). */
      riding: false,
      rideSnaps: [],
      ride: { m: 0, x: 0, h: 0, yaw: 0, state: 'ride', speed: 0, pedal: 0 },
      /** Their bike's world position and turn this frame, worked out by RemotePlayers. */
      bikePosition: new Vector3(),
      bikeHeading: 0,
    }
    r.shadow = { position: r.position.clone(), size: 1.1, visible: true }
    runtime.shadowCasters.add(r.shadow)
    remotePlayers.set(sessionId, r)
  }
  r.name = state.name
  r.uid = state.uid || ''
  r.anim = state.anim
  r.bikeId = state.bikeId
  r.world = state.world || 0
  r.rebirths = state.rebirths
  if (state.look !== r.lookKey) {
    r.lookKey = state.look
    try {
      r.look = state.look ? JSON.parse(state.look) : null
    } catch {
      r.look = null
    }
  }
  const now = performance.now()
  if (state.riding) {
    if (!r.riding) r.rideSnaps.length = 0
    const last = r.rideSnaps[r.rideSnaps.length - 1]
    if (!last || last.m !== state.rm || last.x !== state.rx || last.h !== state.rh || last.s !== state.rstate) {
      r.rideSnaps.push({ t: now, m: state.rm, x: state.rx, h: state.rh, r: state.ryaw, s: state.rstate })
      if (r.rideSnaps.length > MAX_SNAPSHOTS) r.rideSnaps.shift()
    }
  }
  r.riding = Boolean(state.riding)
  const last = r.snaps[r.snaps.length - 1]
  if (!last || last.x !== state.x || last.y !== state.y || last.z !== state.z || last.r !== state.rotY) {
    r.snaps.push({ t: now, x: state.x, y: state.y, z: state.z, r: state.rotY })
    if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift()
  }
}

/** You changed world: shows the players in the new one, hides the rest. */
export function refreshRemoteWorlds() {
  for (const [sessionId, state] of latest) upsertRemotePlayer(sessionId, state)
}

export function removeRemotePlayer(sessionId) {
  latest.delete(sessionId)
  dropRemotePlayer(sessionId)
}

function dropRemotePlayer(sessionId) {
  const r = remotePlayers.get(sessionId)
  if (!r) return
  runtime.shadowCasters.delete(r.shadow)
  remotePlayers.delete(sessionId)
}

export function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
  latest.clear()
}
