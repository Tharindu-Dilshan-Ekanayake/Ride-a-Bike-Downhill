import { Quaternion, Vector3 } from 'three'

import { SPAWN } from '@shared/world'

/**
 * Per-frame mutable state shared between systems.
 *
 * Deliberately outside React and zustand: it changes every frame, nothing should
 * re-render because of it, and every reader lives in a `useFrame` or a timer. UI that
 * needs a slow-changing derivative of it (which zone the player is in, say) gets it
 * from the 10 Hz game ticker, which is the only thing that copies from here into the
 * store.
 */
export const runtime = {
  player: {
    position: new Vector3(SPAWN.x, 0, SPAWN.z),
    /** Facing, radians about +Y. PI faces north (-Z), towards the start gate. */
    yaw: Math.PI,
    speed: 0,
    grounded: true,
    /** 'idle' | 'walk' | 'jump' - what other players see. */
    anim: 'idle',
    /** Set when the controller should ignore input (during a ride). */
    frozen: false,
  },

  /**
   * Touch input, written by the on-screen controls: in the lobby the joystick (-1..1,
   * +y = forward) and jump; on the bike, steer (-1..1, + right), brake, boost, jump and
   * lean forward.
   */
  input: {
    joyX: 0,
    joyY: 0,
    jump: false,
    steer: 0,
    brake: false,
    boost: false,
    leanFwd: false,
  },

  camera: {
    /** 'follow' orbits the player; 'ride' chases your bike (see ride/Ride.jsx). */
    mode: 'follow',
    yaw: 0,
    pitch: 0.36,
    distance: 11,
    /** Set to jump the follow camera straight to its target next frame. */
    snap: false,
  },

  /** What the sun's shadow box centres on while the camera chases your bike. */
  flightFocus: null,

  /**
   * Where your bike and you are during a ride, written by the ride chunk every frame
   * before the player and the camera read it: the bike's origin (ground contact, between
   * the axles) and turn, the pedals' crank angle, how tucked / standing / cheering the
   * rider is, and - bailed off - the rider's own tumble.
   */
  rideView: {
    active: false,
    position: new Vector3(),
    quaternion: new Quaternion(),
    pedal: 0,
    tuck: 0,
    stand: 0,
    cheer: 0,
    bail: false,
    riderPos: new Vector3(),
    riderQuat: new Quaternion(),
    /** Height of the road under you (for your blob shadow). */
    groundY: 0,
    /** Seen from your own eyes (the first-person camera): you aren't drawn. */
    firstPerson: false,
  },

  /** Walls that come and go at runtime. */
  dynamicColliders: [],

  /**
   * Things that get a blob shadow on low presets. Each entry is
   * `{ position: Vector3, size: number, visible?: boolean }`.
   */
  shadowCasters: new Set(),
}

/** Puts the player back at spawn, e.g. after a reconnect into a fresh lobby. */
export function respawn() {
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = Math.PI
}
