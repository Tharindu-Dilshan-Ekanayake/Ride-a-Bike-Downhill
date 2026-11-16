/**
 * The game's icon set, hand-drawn as SVG: glossy cartoon style with thick dark outlines,
 * matching the reference HUD. Strings rather than components so the same art feeds
 * both the DOM HUD (<img src>) and the canvas-drawn 3D world labels.
 *
 * Every icon uses a 100x100 viewBox. Gradient ids are prefixed per icon so icons can
 * be inlined side by side without clashing.
 */

import rebirthImage from '../assets/rebirth.webp'

const OUT = '#1b1b1f'

/** Icons that are artwork rather than drawn SVG, by name. */
const IMAGE_ICONS = {
  // The game's own rebirth art: pink and ice-blue chasing arrows (150 px, 5 KB).
  rebirth: rebirthImage,
}

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`

const vgrad = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

const GOLD = [
  [0, '#fff6a3'],
  [0.45, '#ffcf2e'],
  [1, '#f08c00'],
]

const trophy = svg(
  `<g stroke="${OUT}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30" fill="none" stroke-width="13"/>
    <path d="M73 24h16c0 19-9 28-22 30" fill="none" stroke-width="13"/>
  </g>
  <g fill="none" stroke="url(#tr-g)" stroke-width="5" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30"/><path d="M73 24h16c0 19-9 28-22 30"/>
  </g>
  <g stroke="${OUT}" stroke-width="5" stroke-linejoin="round" fill="url(#tr-g)">
    <path d="M42 62h16l3 15H39z"/>
    <rect x="27" y="76" width="46" height="15" rx="5"/>
    <path d="M22 12h56v22c0 19-12 30-28 30S22 53 22 34z"/>
  </g>
  <path d="M50 21l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L50 44.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#fffbd1" stroke="#d98900" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M30 18v16c0 8 3 14 8 18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('tr-g', GOLD),
)

const items = svg(
  `<path d="M34 22c0-14 32-14 32 0" fill="none" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M34 22c0-14 32-14 32 0" fill="none" stroke="#c4192c" stroke-width="5" stroke-linecap="round"/>
  <rect x="14" y="20" width="72" height="72" rx="20" fill="url(#it-r)" stroke="${OUT}" stroke-width="6"/>
  <rect x="26" y="52" width="48" height="32" rx="9" fill="url(#it-p)" stroke="${OUT}" stroke-width="5"/>
  <path d="M26 64h48" stroke="${OUT}" stroke-width="4"/>
  <rect x="40" y="30" width="20" height="16" rx="3" fill="#fff" stroke="${OUT}" stroke-width="4"/>
  <path d="M44 34v8l6-5 6 5v-8" fill="none" stroke="#e0213b" stroke-width="3" stroke-linejoin="round"/>
  <path d="M22 40c0-8 4-12 10-13" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".55"/>`,
  vgrad('it-r', [
    [0, '#ff6b62'],
    [1, '#d6182b'],
  ]) +
    vgrad('it-p', [
      [0, '#ff8a80'],
      [1, '#e42a3b'],
    ]),
)

const store = svg(
  `<path d="M26 44c0-34 48-34 48 0" fill="none" stroke="${OUT}" stroke-width="14" stroke-linecap="round"/>
  <path d="M26 44c0-34 48-34 48 0" fill="none" stroke="#5fc4ff" stroke-width="6" stroke-linecap="round"/>
  <path d="M8 40h84l-9 48c-1 4-4 6-8 6H25c-4 0-7-2-8-6z" fill="url(#st-y)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="5" y="36" width="90" height="13" rx="6" fill="#ffe46b" stroke="${OUT}" stroke-width="5"/>
  <path d="M30 58v26M43 58v26M57 58v26M70 58v26" stroke="#d18a00" stroke-width="5" stroke-linecap="round"/>
  <path d="M18 66h64" stroke="#d18a00" stroke-width="4" stroke-linecap="round"/>`,
  vgrad('st-y', [
    [0, '#ffe25a'],
    [1, '#ffa412'],
  ]),
)

const calendar = svg(
  `<rect x="10" y="16" width="80" height="76" rx="12" fill="#ffffff" stroke="${OUT}" stroke-width="6"/>
  <path d="M10 28c0-7 5-12 12-12h56c7 0 12 5 12 12v12H10z" fill="url(#cl-r)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="26" y="6" width="9" height="20" rx="4" fill="#cfd8e3" stroke="${OUT}" stroke-width="4"/>
  <rect x="65" y="6" width="9" height="20" rx="4" fill="#cfd8e3" stroke="${OUT}" stroke-width="4"/>
  <g fill="#ff9a1f"><rect x="22" y="50" width="12" height="10" rx="2"/><rect x="44" y="50" width="12" height="10" rx="2"/><rect x="66" y="50" width="12" height="10" rx="2"/><rect x="22" y="68" width="12" height="10" rx="2"/><rect x="44" y="68" width="12" height="10" rx="2" fill="#2fd14a"/><rect x="66" y="68" width="12" height="10" rx="2"/></g>`,
  vgrad('cl-r', [
    [0, '#ff6b6b'],
    [1, '#d91c3a'],
  ]),
)

/** A chunky cog for Settings. */
const settingsTeeth = Array.from({ length: 8 }, (_, i) => `<rect x="42" y="6" width="16" height="20" rx="4" transform="rotate(${i * 45} 50 50)"/>`).join('')
const settings = svg(
  `<g fill="url(#se-g)" stroke="${OUT}" stroke-width="5" stroke-linejoin="round">${settingsTeeth}<circle cx="50" cy="50" r="31"/></g>
  <g fill="url(#se-g)">${settingsTeeth}</g>
  <circle cx="50" cy="50" r="27" fill="url(#se-g)"/>
  <circle cx="50" cy="50" r="12" fill="#2c344d" stroke="${OUT}" stroke-width="5"/>
  <path d="M30 40c3-7 9-12 16-13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`,
  vgrad('se-g', [
    [0, '#e8eef6'],
    [1, '#9aa6b8'],
  ]),
)

const star = svg(
  `<path d="M50 8l12 25 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

/** A round potion flask with a cork, filled with `liquid` and a small badge icon. */
function potion(id, liquid, liquidDark, badge) {
  return svg(
    `<rect x="38" y="6" width="24" height="16" rx="4" fill="#c98a4b" stroke="${OUT}" stroke-width="5"/>
    <path d="M40 22h20v12c16 5 26 18 26 32 0 18-16 30-36 30S14 84 14 66c0-14 10-27 26-32z" fill="#e8f6ff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M18 64c10-6 22 4 32 0s22-6 32 0c0 16-14 26-32 26S18 80 18 64z" fill="url(#${id}-l)"/>
    <path d="M24 56c2-8 8-14 16-16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${badge}`,
    vgrad(`${id}-l`, [
      [0, liquid],
      [1, liquidDark],
    ]),
  )
}

const COIN_BADGE = `<circle cx="50" cy="72" r="13" fill="#ffd23a" stroke="${OUT}" stroke-width="3.5"/>
   <path d="M50 64l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#fff6b8" stroke="#d98900" stroke-width="1.5" stroke-linejoin="round"/>`

const potionWins = potion('pw', '#ffe14a', '#f08c00', COIN_BADGE)
const potionBoost = potion(
  'pb',
  '#7ff0ff',
  '#1a7ae0',
  `<path d="M54 58L40 76h9l-3 12 15-19h-9z" fill="#ffe14a" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>`,
)

/** A gold coin with a star struck into it: the game's currency. */
const coin = svg(
  `<circle cx="50" cy="50" r="42" fill="url(#co-g)" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="50" r="31" fill="none" stroke="#d98900" stroke-width="4"/>
  <path d="M50 27l7 14.2 15.6 2.3-11.3 11 2.7 15.5L50 62.7 36 70l2.7-15.5-11.3-11 15.6-2.3z" fill="#fff3a0" stroke="#d98900" stroke-width="3" stroke-linejoin="round"/>
  <path d="M22 40c3-10 10-17 20-20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>`,
  vgrad('co-g', GOLD),
)

/** A bike side-on: two wheels and a frame in `color` (the bike's own paint). */
export function bikeSvg(color = '#38bdf8', accent = '#ffffff') {
  return svg(
    `<g fill="none" stroke="${OUT}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="24" cy="66" r="18" stroke-width="10"/><circle cx="76" cy="66" r="18" stroke-width="10"/>
      <path d="M24 66l16-30h30l6 30M40 36l14 30h-30M54 66l16-30M68 24h10M40 36l-4-10h-8" stroke-width="12"/>
    </g>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="24" cy="66" r="18" stroke="#3a4150" stroke-width="5"/><circle cx="76" cy="66" r="18" stroke="#3a4150" stroke-width="5"/>
      <circle cx="24" cy="66" r="11" stroke="#cfd6df" stroke-width="2"/><circle cx="76" cy="66" r="11" stroke="#cfd6df" stroke-width="2"/>
      <path d="M24 66l16-30h30l6 30M40 36l14 30h-30M54 66l16-30" stroke="${color}" stroke-width="6"/>
      <path d="M68 24h10" stroke="${accent}" stroke-width="6"/>
      <path d="M40 36l-4-10h-8" stroke="${accent}" stroke-width="6"/>
    </g>
    <circle cx="54" cy="66" r="5" fill="#cfd6df" stroke="${OUT}" stroke-width="3"/>`,
  )
}
const bike = bikeSvg()

/** Boost: an electric-blue bolt with speed streaks. */
const boost = svg(
  `<path d="M8 40h18M4 56h16M10 72h14" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>
  <path d="M8 40h18M4 56h16M10 72h14" stroke="#bff6ff" stroke-width="4" stroke-linecap="round"/>
  <path d="M64 4L26 56h22l-8 40 46-56H62z" fill="url(#bo-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M58 14L38 46" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>`,
  vgrad('bo-g', [
    [0, '#e4fdff'],
    [0.45, '#3fd0ff'],
    [1, '#1a62e8'],
  ]),
)

/** Income: a stack of green notes with a coin on top. */
const income = svg(
  `<rect x="8" y="46" width="70" height="38" rx="6" fill="#2fae4a" stroke="${OUT}" stroke-width="6" transform="rotate(-8 43 65)"/>
  <rect x="16" y="34" width="70" height="38" rx="6" fill="url(#in-g)" stroke="${OUT}" stroke-width="6"/>
  <circle cx="51" cy="53" r="10" fill="none" stroke="#1d7a34" stroke-width="4"/>
  <path d="M24 42h10M68 64h10" stroke="#1d7a34" stroke-width="4" stroke-linecap="round"/>
  <circle cx="76" cy="26" r="17" fill="#ffd23a" stroke="${OUT}" stroke-width="5"/>
  <path d="M76 17l3.4 7 7.6 1.1-5.5 5.4 1.3 7.6-6.8-3.6-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z" fill="#fff3a0" stroke="#d98900" stroke-width="2" stroke-linejoin="round"/>`,
  vgrad('in-g', [
    [0, '#9dffa8'],
    [1, '#35c454'],
  ]),
)

/** The Coin Magnet: a red horseshoe with silver tips. */
const magnet = svg(
  `<path d="M18 12h22v36c0 6 4 10 10 10s10-4 10-10V12h22v36c0 18-14 32-32 32S18 66 18 48z" fill="url(#ma-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M18 12h22v14H18zM60 12h22v14H60z" fill="#e8eef6" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M26 54c2 10 8 16 16 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
  <path d="M86 70l8 4M84 84l8 8M70 92l2 6" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`,
  vgrad('ma-g', [
    [0, '#ff7a7a'],
    [1, '#d4142a'],
  ]),
)

/** CAM: a chunky camera. */
const camera = svg(
  `<path d="M34 22h32l6 10h14c4 0 6 2 6 6v42c0 4-2 6-6 6H14c-4 0-6-2-6-6V38c0-4 2-6 6-6h14z" fill="url(#ca-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="50" cy="58" r="20" fill="#2c344d" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="58" r="10" fill="#7fe2ff"/>
  <circle cx="45" cy="53" r="4" fill="#fff"/>
  <rect x="74" y="40" width="10" height="6" rx="2" fill="#ffd23a"/>`,
  vgrad('ca-g', [
    [0, '#e8eef6'],
    [1, '#9aa6b8'],
  ]),
)

/** The finish: a chequered flag on a pole. */
const FLAG_SQUARES = Array.from({ length: 12 }, (_, i) => {
  const col = i % 4
  const row = Math.floor(i / 4)
  return (col + row) % 2 === 0 ? `<rect x="${30 + col * 14}" y="${12 + row * 13}" width="14" height="13" fill="${OUT}"/>` : ''
}).join('')
const flag = svg(
  `<rect x="18" y="8" width="9" height="88" rx="4" fill="#cfd6df" stroke="${OUT}" stroke-width="5"/>
  <path d="M28 10h58v41H28z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  ${FLAG_SQUARES}
  <path d="M28 10h58v41H28z" fill="none" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

/** Speed: a dial with its needle well round. */
const speed = svg(
  `<path d="M10 70a40 40 0 0 1 80 0" fill="url(#sd-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M10 70h80" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>
  <path d="M22 66a28 28 0 0 1 8-20M40 40a28 28 0 0 1 20 0M70 46a28 28 0 0 1 8 20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
  <path d="M50 68L76 40" stroke="${OUT}" stroke-width="10" stroke-linecap="round"/>
  <path d="M50 68L76 40" stroke="#ff3b3b" stroke-width="5" stroke-linecap="round"/>
  <circle cx="50" cy="68" r="8" fill="#ffd23a" stroke="${OUT}" stroke-width="4"/>`,
  vgrad('sd-g', [
    [0, '#4a5778'],
    [1, '#2c344d'],
  ]),
)

const close = svg(
  `<path d="M24 24l52 52M76 24L24 76" stroke="${OUT}" stroke-width="22" stroke-linecap="round"/>
  <path d="M24 24l52 52M76 24L24 76" stroke="#fff" stroke-width="11" stroke-linecap="round"/>`,
)

const arrowDown = svg(
  `<path d="M36 8h28v40h20L50 90 16 48h20z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

const check = svg(
  `<path d="M16 52l22 22 46-48" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 52l22 22 46-48" fill="none" stroke="#5cf064" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
)

const portal = svg(
  `<circle cx="50" cy="50" r="42" fill="url(#po-g)" stroke="${OUT}" stroke-width="6"/>
  <path d="M50 50c0-10 14-10 14 0 0 16-28 16-28 0 0-22 42-22 42 0 0 28-56 28-56 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  `<radialGradient id="po-g"><stop offset="0" stop-color="#b8f3ff"/><stop offset="1" stop-color="#2f7fe6"/></radialGradient>`,
)

const starGold = svg(
  `<path d="M50 6l13 27 29 4-21 20 5 29-26-14-26 14 5-29L8 37l29-4z" fill="url(#sg-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M38 30l7-13" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('sg-g', GOLD),
)

const fastForward = svg(
  `<path d="M8 18l40 32-40 32z" fill="url(#ff-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M50 18l40 32-40 32z" fill="url(#ff-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
  vgrad('ff-g', [
    [0, '#ffffff'],
    [1, '#9fdcff'],
  ]),
)

const SPEAKER = `<path d="M14 38h16l22-18v60L30 62H14z" fill="url(#sp-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M20 44h8" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
const SPEAKER_GRADIENT = vgrad('sp-g', [
  [0, '#ffffff'],
  [1, '#c7d3e3'],
])

const sound = svg(
  `${SPEAKER}
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="${OUT}" stroke-width="12" stroke-linecap="round"/>
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="#7fe2ff" stroke-width="5" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

const soundOff = svg(
  `${SPEAKER}
  <path d="M62 38l22 24M84 38L62 62" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M62 38l22 24M84 38L62 62" stroke="#ff5a5a" stroke-width="6" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

/** A quest scroll: parchment with two ticked lines and a red seal. */
const quest = svg(
  `<path d="M22 12h50c8 0 12 5 12 12v54c0 7-5 12-12 12H28c-7 0-12-5-12-12V18c0-4 2-6 6-6z" fill="url(#qu-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M28 34l6 6 10-12M28 58l6 6 10-12" fill="none" stroke="#2fae4a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M52 36h20M52 60h20" stroke="${OUT}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
  <circle cx="74" cy="80" r="11" fill="#ff4a5a" stroke="${OUT}" stroke-width="5"/>
  <path d="M26 20h40" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
  vgrad('qu-g', [
    [0, '#fff6d6'],
    [1, '#f2cf86'],
  ]),
)

/** A streak flame: orange outside, gold within. */
const flame = svg(
  `<path d="M50 6c6 18 28 26 28 52 0 18-12 34-28 34S22 76 22 58c0-14 8-20 12-30 2 10 8 14 8 14 0-14 2-26 8-36z" fill="url(#fl-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M50 50c4 8 14 12 14 24 0 9-6 14-14 14s-14-5-14-14c0-8 6-12 8-18 2 5 6 6 6 6 0-5-2-8 0-12z" fill="#ffe56b"/>`,
  vgrad('fl-g', [
    [0, '#ffcf3a'],
    [0.6, '#ff7a1e'],
    [1, '#e8350f'],
  ]),
)

/** Two friends side by side. */
const friends = svg(
  `<circle cx="34" cy="34" r="14" fill="#ffd27a" stroke="${OUT}" stroke-width="6"/>
  <circle cx="66" cy="30" r="14" fill="#ffd27a" stroke="${OUT}" stroke-width="6"/>
  <path d="M10 88c0-18 10-30 24-30s24 12 24 30z" fill="#4fb8ff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M44 84c0-18 9-30 22-30s24 12 24 30z" fill="#ff6ab8" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

const wrench = svg(
  `<path d="M70 14a20 20 0 0 0-19 27L16 76a9 9 0 0 0 13 13l35-35a20 20 0 0 0 27-19l-12 7-10-4-4-10z" fill="url(#wr-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="23" cy="82" r="4" fill="${OUT}"/>`,
  vgrad('wr-g', [
    [0, '#f4f7fb'],
    [0.5, '#b9c3cf'],
    [1, '#7d8794'],
  ]),
)

const globe = svg(
  `<circle cx="50" cy="50" r="38" fill="url(#gl-g)" stroke="${OUT}" stroke-width="6"/>
  <path d="M30 26c10 4 8 14 18 14s6 14-4 16-10 10-6 18M66 20c-4 8 6 10 4 18s10 6 14 12M60 66c6-2 12 2 14 8" fill="none" stroke="#2f9e48" stroke-width="7" stroke-linecap="round"/>
  <path d="M30 22c-8 6-14 16-16 26M80 70c-6 8-14 14-24 16" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="4" stroke-linecap="round"/>`,
  vgrad('gl-g', [
    [0, '#9fe6ff'],
    [1, '#2f7fe0'],
  ]),
)

const tires = svg(
  `<circle cx="50" cy="50" r="38" fill="#2b2f3a" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="50" r="22" fill="url(#ti-g)" stroke="${OUT}" stroke-width="5"/>
  <path d="M50 12v10M50 78v10M12 50h10M78 50h10M23 23l7 7M70 70l7 7M77 23l-7 7M30 70l-7 7" stroke="#5b6272" stroke-width="5" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="6" fill="${OUT}"/>`,
  vgrad('ti-g', [
    [0, '#eef2f7'],
    [1, '#9aa4b2'],
  ]),
)

const suspension = svg(
  `<rect x="40" y="8" width="20" height="14" rx="4" fill="#5b6272" stroke="${OUT}" stroke-width="5"/>
  <rect x="40" y="78" width="20" height="14" rx="4" fill="#5b6272" stroke="${OUT}" stroke-width="5"/>
  <path d="M30 26l40 8-40 8 40 8-40 8 40 8-40 8" fill="none" stroke="${OUT}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M30 26l40 8-40 8 40 8-40 8 40 8-40 8" fill="none" stroke="url(#su-g)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`,
  vgrad('su-g', [
    [0, '#fff27a'],
    [1, '#ff9a0a'],
  ]),
)

const gears = svg(
  `<path d="M44 8h12l2 11 8 4 9-7 9 9-7 9 4 8 11 2v12l-11 2-4 8 7 9-9 9-9-7-8 4-2 11H44l-2-11-8-4-9 7-9-9 7-9-4-8-11-2V44l11-2 4-8-7-9 9-9 9 7 8-4z" fill="url(#ge-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="50" cy="50" r="13" fill="#2b2f3a" stroke="${OUT}" stroke-width="5"/>`,
  vgrad('ge-g', [
    [0, '#b4efff'],
    [0.5, '#4cb8ff'],
    [1, '#2477e8'],
  ]),
)

export const ICON_SVGS = {
  wrench,
  globe,
  tires,
  suspension,
  gears,
  quest,
  flame,
  friends,
  sound,
  soundOff,
  starGold,
  fastForward,
  trophy,
  items,
  store,
  calendar,
  star,
  settings,
  potionWins,
  potionBoost,
  coin,
  bike,
  boost,
  income,
  magnet,
  camera,
  flag,
  speed,
  close,
  arrowDown,
  check,
  portal,
}

const urlCache = new Map()

/**
 * `data:` URL for an icon name, or for `bike:<color>[:<accent>]` a bike in that paint.
 * Unknown names give null (Icon draws nothing).
 */
export function iconUrl(name) {
  if (typeof name !== 'string' || !name) return null
  if (IMAGE_ICONS[name]) return IMAGE_ICONS[name]
  let url = urlCache.get(name)
  if (url) return url
  let markup = ICON_SVGS[name]
  if (!markup && name.startsWith('bike:')) {
    const [, color, accent] = name.split(':')
    markup = bikeSvg(color, accent)
  }
  if (!markup) return null
  url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  urlCache.set(name, url)
  return url
}
