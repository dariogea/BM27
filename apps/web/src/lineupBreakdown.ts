import type { ReplayFrame } from './replayData';

export interface LineupTotals {
  players: readonly string[];
  seconds: number;
  pointsFor: number;
  pointsAgainst: number;
}

/** Accumulate scoreboard changes and elapsed clock time for each distinct five. */
export function lineupBreakdown(frames: readonly ReplayFrame[], side: 'home' | 'away') {
  const totals = new Map<string, LineupTotals>();
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1]!;
    const current = frames[index]!;
    const players = side === 'home' ? previous.homePlayers : previous.awayPlayers;
    if (players.length !== 5 || new Set(players).size !== 5) continue;

    const seconds = current.period === previous.period ? previous.clock - current.clock : 0;
    const homePoints = current.homeScore - previous.homeScore;
    const awayPoints = current.awayScore - previous.awayScore;
    if (seconds <= 0 && !homePoints && !awayPoints) continue;
    const key = JSON.stringify([...players].sort());
    const entry = totals.get(key) ?? { players, seconds: 0, pointsFor: 0, pointsAgainst: 0 };
    entry.seconds += Math.max(0, seconds);
    entry.pointsFor += side === 'home' ? homePoints : awayPoints;
    entry.pointsAgainst += side === 'home' ? awayPoints : homePoints;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => b.seconds - a.seconds);
}
