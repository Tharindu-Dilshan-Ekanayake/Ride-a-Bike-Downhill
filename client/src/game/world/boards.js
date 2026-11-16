import { formatDuration, formatNumber } from '@shared/format'

/** The four leaderboards: titles, colours and value formatting. */
export const BOARD_INFO = {
  rebirths: { title: 'Top Rebirths', color: '#c45cff', format: (v) => formatNumber(v) },
  wins: { title: 'Total Coins', color: '#ffd21f', format: (v) => formatNumber(v) },
  distance: { title: 'Longest Ride', color: '#3fdc4a', format: (v) => `${formatNumber(v)} m` },
  playtime: { title: 'Minutes Played', color: '#4fc3ff', format: (v) => formatDuration(v * 1000) },
}

/** Your own value on each board, for offline play. */
const OWN_VALUE = {
  rebirths: (p) => p.rebirths,
  wins: (p) => p.stats.totalWins,
  distance: (p) => p.stats.bestDistance,
  playtime: (p) => p.stats.playtime,
}

/** Rows for a board: the server's top 10, or just you when offline. */
export function boardRows(leaderboards, profile, id) {
  if (leaderboards?.[id]?.length) return leaderboards[id]
  return [{ name: profile.name, value: OWN_VALUE[id](profile) }]
}
