import type { MatchResult, StandingRow } from '@bm27/schema';

interface Tally {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

function tally(teamIds: readonly string[], matches: readonly MatchResult[]): Map<string, Tally> {
  const table = new Map<string, Tally>();
  for (const teamId of teamIds) {
    table.set(teamId, { teamId, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }
  for (const m of matches) {
    const home = table.get(m.homeTeamId);
    const away = table.get(m.awayTeamId);
    if (!home || !away) continue; // match involving a team outside this set
    home.played++;
    away.played++;
    home.pointsFor += m.homeScore;
    home.pointsAgainst += m.awayScore;
    away.pointsFor += m.awayScore;
    away.pointsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }
  }
  return table;
}

/**
 * League table with basic tie-breakers:
 *   1. wins,
 *   2. wins in the games played among the tied teams (head-to-head),
 *   3. overall point difference,
 *   4. overall points scored,
 *   5. team id (so the order is always deterministic).
 */
export function computeStandings(
  teamIds: readonly string[],
  matches: readonly MatchResult[],
): StandingRow[] {
  const overall = tally(teamIds, matches);
  const byWins = new Map<number, Tally[]>();
  for (const row of overall.values()) {
    const bucket = byWins.get(row.wins);
    if (bucket) bucket.push(row);
    else byWins.set(row.wins, [row]);
  }

  const ordered: Tally[] = [];
  for (const wins of [...byWins.keys()].sort((a, b) => b - a)) {
    const tied = byWins.get(wins) as Tally[];
    if (tied.length > 1) {
      const headToHead = tally(
        tied.map((t) => t.teamId),
        matches,
      );
      tied.sort((a, b) => {
        const h2h =
          (headToHead.get(b.teamId) as Tally).wins - (headToHead.get(a.teamId) as Tally).wins;
        if (h2h !== 0) return h2h;
        const diff = b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
        if (diff !== 0) return diff;
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        return a.teamId < b.teamId ? -1 : 1;
      });
    }
    ordered.push(...tied);
  }
  return ordered.map((row, index) => ({ position: index + 1, ...row }));
}
