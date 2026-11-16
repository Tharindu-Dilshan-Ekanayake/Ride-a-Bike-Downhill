import { schema, t } from '@colyseus/schema'

/**
 * Synced state, kept deliberately small: only what other players need to draw you.
 * Everything private (inventory, items, boosts...) goes to its owner alone as
 * 'profile' messages, never through the shared state.
 */
export const PlayerState = schema(
  {
    name: t.string(),
    /** Their verified Boxity account id ('' for guests), so chat can be matched to them. */
    uid: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    rotY: t.float32(),
    /** 'idle' | 'walk' | 'run' | 'jump' | 'emote:<Boxity emote id>' (in the lobby) */
    anim: t.string(),
    /** What their Bloxity avatar wears, as JSON `{ equipped, proportions }` ('' = base). */
    look: t.string(),
    /** The bike they ride (balance BIKES id). */
    bikeId: t.string(),
    wins: t.float64(),
    rebirths: t.uint16(),
    /** The world they're in (balance WORLDS): players only see others in theirs. */
    world: t.uint8(),
    /**
     * Out on the road: where (track.js road point - metre along, metres across, height
     * above the road), which way they face, and 'ride' | 'air' | 'bail'.
     */
    riding: t.boolean(),
    rm: t.float32(),
    rx: t.float32(),
    rh: t.float32(),
    ryaw: t.float32(),
    rstate: t.string(),
  },
  'PlayerState',
)

export const GameState = schema(
  {
    /** sessionId -> player */
    players: t.map(PlayerState),
    /** Short code for private lobbies ('' for public ones). */
    code: t.string(),
    isPrivate: t.boolean(),
  },
  'GameState',
)
