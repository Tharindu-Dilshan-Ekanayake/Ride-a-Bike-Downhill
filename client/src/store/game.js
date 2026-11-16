import { create } from 'zustand'

import { createProfile, createSession } from '@shared/logic'

/**
 * Everything the UI renders from. Written by the network layer (profile, events), the
 * 10 Hz game ticker (zones) and the ride's state changes (rideControl) - never from a
 * frame loop.
 *
 * Components must select narrowly (`useGame((s) => s.profile.wins)`), so a Coins change
 * re-renders the Coins label and nothing else.
 */
export const useGame = create((set) => ({
  /** Authoritative copy of the player's save, as last sent by the server. */
  profile: createProfile('local', 'Player'),
  /** Per-connection state: session start, claimed playtime rewards, streak news. */
  session: createSession(Date.now()),
  /** True once the first real profile has arrived. */
  profileLoaded: false,
  /** True once the game is on screen; non-essential start-up work waits for it. */
  playable: false,

  net: {
    /** 'connecting' | 'online' | 'offline' */
    mode: 'connecting',
    lobbyId: null,
    /** Short code friends join with, for private lobbies. */
    code: null,
    isPrivate: false,
    players: 1,
    maxPlayers: 8,
    message: null,
  },
  leaderboards: null,

  /**
   * Where the player is standing, from the ticker: the bike stand under them (index, -1
   * if none), whether they're in the START gate, the portal, the gift stand.
   */
  zone: { stand: -1, rideZone: false, portal: null, freeReward: false, garage: false },

  /** Which modal panel is open: 'bikes' | 'rebirth' | 'daily' | 'items' | 'store' | ... */
  panel: null,
  /** Extra data for the open panel. */
  panelData: null,

  /**
   * The ride as the UI needs to know it (the frame-by-frame state is ride/rideControl's
   * `ride` object, never React state): null in the lobby, else
   * { phase: 'countdown' | 'riding' | 'over', world }.
   */
  ride: null,
  /** The checked, paid result of the last ride (session 'ride' event), shown until claimed. */
  rideResult: null,
  /** A short celebration banner: { text, id } (new bike, ad reward, Gems purchase). */
  toast: null,

  // --- Actions -----------------------------------------------------------------------

  setProfile: (profile, session) => set((s) => ({ profile, session: session || s.session, profileLoaded: true })),
  patchProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  setZone: (zone) => set({ zone }),
  setPlayable: () => set({ playable: true }),
  setLeaderboards: (leaderboards) => set({ leaderboards }),

  openPanel: (panel, panelData = null) => set({ panel, panelData }),
  closePanel: () => set({ panel: null, panelData: null }),
  togglePanel: (panel) => set((s) => (s.panel === panel ? { panel: null, panelData: null } : { panel, panelData: null })),

  setRide: (ride) => set({ ride }),
  setRideResult: (rideResult) => set({ rideResult }),
  showToast: (text) => set({ toast: { text, id: Date.now() } }),
}))

/** Non-reactive snapshot for timers and non-React code. */
export const getGame = () => useGame.getState()
