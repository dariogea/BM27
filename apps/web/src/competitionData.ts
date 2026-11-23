import type { GroupSeason, MatchResult } from '@bm27/schema';

import type { CompetitionViewData } from './protocol';

export type StandingRow = GroupSeason['standings'][number];

export type StandingKey =
  | 'position'
  | 'name'
  | 'played'
  | 'wins'
  | 'losses'
  | 'pointsFor'
  | 'pointsAgainst'
  | 'difference'
  | 'percentage';

/** Share of games won (0 when nothing has been played). */
export const winShare = (row: StandingRow): number => (row.played > 0 ? row.wins / row.played : 0);

function value(
  row: StandingRow,
  key: StandingKey,
  name: (teamId: string) => string,
): number | string {
  switch (key) {
    case 'position':
      return row.position;
    case 'name':
      return name(row.teamId);
    case 'played':
      return row.played;
    case 'wins':
      return row.wins;
    case 'losses':
      return row.losses;
    case 'pointsFor':
      return row.pointsFor;
    case 'pointsAgainst':
      return row.pointsAgainst;
    case 'difference':
      return row.pointsFor - row.pointsAgainst;
    case 'percentage':
      return winShare(row);
  }
}

/**
 * Rows ordered by a column. Ties keep the league order (position), so sorting never hides
 * the official tie-break. Returns a new array.
 */
export function sortStandings(
  rows: readonly StandingRow[],
  key: StandingKey,
  descending: boolean,
  name: (teamId: string) => string,
): StandingRow[] {
  return [...rows].sort((x, y) => {
    const a = value(x, key, name);
    const b = value(y, key, name);
    const order =
      typeof a === 'string' || typeof b === 'string'
        ? String(a).localeCompare(String(b), 'es')
        : a - b;
    return (descending ? -order : order) || x.position - y.position;
  });
}

export type FormResult = 'W' | 'L';

/**
 * Last results of a team in this competition, oldest first, from the matches played so far.
 * Regular-season games come before playoff games; inside a stage the round decides, and games of
 * the same round keep the order they were received in.
 */
export function formOf(matches: readonly MatchResult[], teamId: string, count = 5): FormResult[] {
  // Array.prototype.sort is stable: inside a stage and round, games keep the order in which the
  // game delivered them, which is the order they were played (ids are text and sort wrongly once
  // a series reaches its 10th game).
  return matches
    .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .sort((a, b) => (a.stage === b.stage ? 0 : a.stage === 'regular' ? -1 : 1) || a.round - b.round)
    .slice(-count)
    .map((m): FormResult => {
      const own = m.homeTeamId === teamId ? m.homeScore : m.awayScore;
      const other = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
      return own > other ? 'W' : 'L';
    });
}

export interface ScheduledGame {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  result: MatchResult | null;
}

/** Merge recorded results and generated fixtures without treating a scheduled game as played. */
export function competitionSchedule(
  competition: CompetitionViewData,
  stage: 'regular' | 'playoff',
): ScheduledGame[] {
  const results = competition.matches.filter((match) => match.stage === stage);
  const played = new Set(results.map((match) => match.id));
  const pending =
    stage === 'regular'
      ? (competition.fixtures ?? []).filter((fixture) => !played.has(fixture.id))
      : [];
  return [
    ...results.map((match) => ({ ...match, result: match })),
    ...pending.map((fixture) => ({ ...fixture, result: null })),
  ].sort((a, b) => a.round - b.round);
}
