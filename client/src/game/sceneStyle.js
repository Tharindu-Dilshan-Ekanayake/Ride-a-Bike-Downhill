/**
 * The scene's whole look in one place: a mountain-top lobby under a clear alpine sky -
 * Pine Peak's green plaza ringed by grassy terraces climbing to snowy peaks, and Frost
 * Ridge, the same summit deep in snow.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The cool sky fill plus the warm
 * high sun add up to just over that on the ground, which keeps the grass vivid; shadowed
 * ground only gets the cool fill, so shadows read blue and the lit side warm.
 */

/** Style ids (materials STYLE; numbers here so this file stays import-free). */
const STYLE_HILL = 14
const STYLE_MESA = 15

/** The game's own colours: signage, the start gate, the shop. */
export const TEAM = {
  blue: '#1f6fe0',
  navy: '#14234f',
  white: '#f4f7fb',
  gold: '#ffc21a',
}

export const SKY = {
  /** Straight up: deep alpine blue. */
  top: '#2f7bff',
  /** At eye level: pale haze. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#d4ecff',
  /** Lower = the deep colour reaches further down towards the horizon. */
  exponent: 0.55,
  /** The sun's glow round its direction, and how strong it is. */
  sun: '#fff4d6',
  glow: 0.55,
  /** High clouds (0 none, 1 plenty), and stars. */
  clouds: 0.7,
  stars: 0,
}

export const FOG = {
  color: SKY.horizon,
}

/** Surface colours shared by both worlds. */
export const PALETTE = {
  asphalt: '#4a5160',
  asphaltLight: '#5a6272',
  line: '#f4f7fb',
  checker: ['#ffffff', '#1d2333'],
  wood: '#9a6a3a',
  woodDark: '#6f4a26',
  rail: '#ffffff',
  steel: '#c9d2de',
  gift: '#ff4a6a',
  ribbon: '#ffd21f',
}

/**
 * Each world's venue: the colours everything built for it uses. World 0 is Pine Peak
 * (green grass, grey rock, dark pines, snow only on the highest peaks); World 1 is Frost
 * Ridge (snow everywhere, ice-blue rock, frosted pines). The lobby (World.jsx) is built
 * from the one for the world you're in, and rebuilt when you step through the portal.
 */
export const VENUES = [
  {
    id: 'pine',
    snow: false,
    primary: TEAM.blue,
    dark: TEAM.navy,
    light: TEAM.white,
    accent: TEAM.gold,
    /** The plaza floor in 4 m bands, the path to the gate, the shop's yard, the portal's rings. */
    ground: { grass: ['#57c84a', '#62d454'], path: ['#d8dde5', '#c9cfd9'], edge: '#ffffff', yard: '#f2e3c4', ring: '#9fd8ff', portal: '#5fb8ff' },
    /** The mountain round the plaza: rock by terrace (low to high) and the style of each. */
    mountain: {
      rock: ['#8a6f55', '#7d6a5c', '#6f6a66', '#7a7e86', '#8f949c'],
      styles: [STYLE_HILL, STYLE_HILL, STYLE_HILL, STYLE_MESA, STYLE_MESA],
    },
    trees: { trunk: '#7a5230', leaves: ['#1f7a3a', '#2a8f45', '#36a552'], snowTop: false },
    /** The start gate and the bike shop's sign. */
    arch: { pillar: '#ff4a3b', base: TEAM.navy, glow: '#fff1a8', crest: '#ffd21f' },
    shop: { band: '#1f6fe0', strip: '#9fe0ff', post: '#ffd21f', panel: TEAM.navy },
    flags: ['#ff4a3b', '#ffd21f', '#1f6fe0', '#3fdc4a'],
  },
  {
    id: 'frost',
    snow: true,
    primary: '#2fa8ff',
    dark: '#0b3f72',
    light: '#ffffff',
    accent: '#7fe8ff',
    ground: { grass: ['#eef4fb', '#e3ecf7'], path: ['#b9d6ee', '#a9cae6'], edge: '#ffffff', yard: '#dfeaf7', ring: '#bfe8ff', portal: '#7fd0ff' },
    mountain: {
      rock: ['#c9d8ea', '#b2c6de', '#9fb4d0', '#8ea4c4', '#a8bcd8'],
      styles: [STYLE_MESA, STYLE_MESA, STYLE_MESA, STYLE_MESA, STYLE_MESA],
    },
    trees: { trunk: '#6a4a30', leaves: ['#1d5f4a', '#25705a', '#2f8068'], snowTop: true },
    arch: { pillar: '#2fa8ff', base: '#0b3f72', glow: '#dff8ff', crest: '#7fe8ff' },
    shop: { band: '#2fa8ff', strip: '#dff8ff', post: '#7fe8ff', panel: '#0b3f72' },
    flags: ['#2fa8ff', '#ffffff', '#7fe8ff', '#ff6f9a'],
  },
]
export const venueOf = (world) => VENUES[world] ?? VENUES[0]

export const LIGHTS = {
  /** Cool blue fill from the sky, a warm green-gold bounce off the grass. */
  hemiSky: '#d6e8ff',
  hemiGround: '#c8d8a8',
  hemiIntensity: 2.0,

  /** A bright, high midday sun. */
  sunColor: '#fff3e0',
  sunIntensity: 1.9,
  /**
   * Direction *towards* the sun: high in the north-west, over the mountain road (the sky's
   * glow sits there too), so shadows fall short and back towards you.
   */
  sunDirection: [-0.4, 0.78, -0.48],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.6,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}
