import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'

import { BIKE_FRAME } from '../ride/bikeModels'
import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { emoteFromAnim } from '../../bloxity/emotes'
import { BODY, SEAT } from '../playerPose'
import { BloxityAvatar } from '../PlayerAvatar'

/** How often the set of fully drawn players is reconsidered. */
const PICK_MS = 500
/** Top walking speed: full stride amplitude, as for your own character. */
const MAX_SPEED = 10.875
const _up = new Vector3(0, 1, 0)
const _shift = new Vector3()

/**
 * One other player as their real Bloxity avatar, dressed as they are and posed by the
 * same playerPose as yours: walking, jumping and emoting in the lobby; out on the road,
 * seated on their bike (RemotePlayers places it: `r.bikePosition`, `r.bikeHeading`),
 * pedalling with their speed - or tumbling, bailed off it.
 */
function RemoteAvatar({ sessionId, look }) {
  const groupRef = useRef(null)
  const innerRef = useRef(null)
  const lastY = useRef(null)
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MAX_SPEED, vy: 0, stride: 0, ride: 0, pedal: 0, tuck: 0, stand: 0, tumble: 0, cheer: 0 })

  useFrame((_state, rawDelta) => {
    const group = groupRef.current
    const inner = innerRef.current
    const r = remotePlayers.get(sessionId)
    if (!group || !inner || !r) return
    const delta = Math.min(rawDelta, 0.05)
    const m = motionRef.current
    m.time += delta
    group.visible = true
    m.emote = null

    if (r.riding) {
      const bail = r.ride.state === 'bail'
      m.ride = bail ? 0 : 1
      m.tumble = bail ? 1 : 0
      m.pedal += (r.ride.speed * delta) / (BIKE_FRAME.crank * 6)
      m.tuck = r.ride.state === 'air' ? 0.6 : Math.min(0.5, r.ride.speed / 60)
      m.speed = 0
      m.grounded = true
      group.position.copy(r.bikePosition)
      group.quaternion.setFromAxisAngle(_up, Math.PI - r.bikeHeading)
      if (bail) {
        inner.quaternion.setFromAxisAngle(_shift.set(1, 0, 0), m.time * 6)
        _shift.set(0, -BODY.pivot, 0).applyQuaternion(inner.quaternion)
        inner.position.set(_shift.x, BODY.pivot + 0.4 + _shift.y, _shift.z)
      } else {
        inner.quaternion.identity()
        inner.position.set(0, 0, SEAT.z)
      }
      return
    }
    m.ride = 0
    m.tumble = 0
    inner.position.set(0, 0, 0)
    inner.quaternion.identity()
    group.position.copy(r.position)
    group.quaternion.setFromAxisAngle(_up, r.yaw)
    const speed = r.speed
    m.speed = speed
    m.grounded = r.anim !== 'jump'
    // A Boxity emote they're playing (stood still while it lasts).
    m.emote = emoteFromAnim(r.anim)
    if (m.emote) m.speed = 0
    // Vertical speed from the interpolated height, smoothed: rising vs falling.
    const y = r.position.y
    if (lastY.current !== null) m.vy += ((y - lastY.current) / Math.max(delta, 1e-3) - m.vy) * 0.3
    lastY.current = y
    m.stride += delta * (5 + 6 * Math.min(1, speed / MAX_SPEED))
  })

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <BloxityAvatar equipped={look?.equipped} proportions={look?.proportions} motionRef={motionRef} targetHeight={1.8} />
      </group>
    </group>
  )
}

/**
 * The other players nearest the camera, as their real avatars: as many as the quality
 * preset allows (`remoteAvatars`), within `remoteAvatarDistance`. Anyone beyond those
 * limits is the cheap blocky figure RemotePlayers draws (`r.fullAvatar` tells it who's
 * covered). Chosen twice a second, never per frame, so React only re-renders when the
 * set of players (or an outfit) actually changes.
 */
export function RemoteAvatars() {
  const camera = useThree((s) => s.camera)
  const [shown, setShown] = useState([])

  useEffect(() => {
    const pick = () => {
      const settings = getQuality()
      const near = []
      for (const r of remotePlayers.values()) {
        r.fullAvatar = false
        const d = camera.position.distanceTo(r.riding ? r.bikePosition : r.position)
        if (d < settings.remoteAvatarDistance) near.push([d, r])
      }
      near.sort((a, b) => a[0] - b[0])
      const next = near
        .slice(0, settings.remoteAvatars)
        .map(([, r]) => r)
        .sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1))
      for (const r of next) r.fullAvatar = true
      setShown((prev) => {
        const same = prev.length === next.length && prev.every((p, i) => p.sessionId === next[i].sessionId && p.lookKey === next[i].lookKey)
        return same ? prev : next.map((r) => ({ sessionId: r.sessionId, look: r.look, lookKey: r.lookKey }))
      })
    }
    pick()
    const id = setInterval(pick, PICK_MS)
    return () => clearInterval(id)
  }, [camera])

  return (
    <>
      {shown.map((s) => (
        <Suspense key={`${s.sessionId}:${s.lookKey}`} fallback={null}>
          <RemoteAvatar sessionId={s.sessionId} look={s.look} />
        </Suspense>
      ))}
    </>
  )
}

export default RemoteAvatars
