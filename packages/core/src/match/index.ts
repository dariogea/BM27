import type { BoxScore, MatchEvent, Ruleset } from '@bm27/schema';
import { deriveBoxScore } from './boxscore';
import { simulateMatch } from './engine';
import type { PreparedTeam } from './prepare';

export * from './boxscore';
export * from './engine';
export * from './prepare';

export interface PlayedMatch {
  events: MatchEvent[];
  boxScore: BoxScore;
  /** Periods played beyond the regular ones. */
  overtimePeriods: number;
}

/** Simulates a match and derives its box score from the event log. */
export function playMatch(
  home: PreparedTeam,
  away: PreparedTeam,
  ruleset: Ruleset,
  seed: string,
): PlayedMatch {
  const events = simulateMatch({ home, away, ruleset, seed });
  return summarizeMatch(events, home, away, ruleset);
}

/** Derives the box score and overtime count from the recorded events. */
export function summarizeMatch(
  events: MatchEvent[],
  home: PreparedTeam,
  away: PreparedTeam,
  ruleset: Ruleset,
): PlayedMatch {
  const boxScore = deriveBoxScore(
    events,
    { teamId: home.teamId, playerIds: home.players.map((p) => p.id) },
    { teamId: away.teamId, playerIds: away.players.map((p) => p.id) },
  );
  const lastPeriod = events[events.length - 1]?.period ?? ruleset.periods;
  return { events, boxScore, overtimePeriods: Math.max(0, lastPeriod - ruleset.periods) };
}
