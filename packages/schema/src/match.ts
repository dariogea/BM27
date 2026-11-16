import { z } from 'zod';
import { MatchEventSchema } from './event';

const count = z.number().int().min(0);

export const StatLineSchema = z.object({
  /** Seconds on court (exact; minutes are derived for display). */
  seconds: count,
  points: count,
  fieldGoalsMade: count,
  fieldGoalsAttempted: count,
  threePointersMade: count,
  threePointersAttempted: count,
  freeThrowsMade: count,
  freeThrowsAttempted: count,
  offensiveRebounds: count,
  defensiveRebounds: count,
  assists: count,
  steals: count,
  blocks: count,
  turnovers: count,
  fouls: count,
});
export type StatLine = z.infer<typeof StatLineSchema>;

export const PlayerBoxLineSchema = StatLineSchema.extend({
  playerId: z.string().min(1),
  starter: z.boolean(),
});
export type PlayerBoxLine = z.infer<typeof PlayerBoxLineSchema>;

export const TeamBoxScoreSchema = z.object({
  teamId: z.string().min(1),
  points: count,
  periodPoints: z.array(count),
  possessions: count,
  players: z.array(PlayerBoxLineSchema),
  totals: StatLineSchema,
});
export type TeamBoxScore = z.infer<typeof TeamBoxScoreSchema>;

export const BoxScoreSchema = z.object({
  home: TeamBoxScoreSchema,
  away: TeamBoxScoreSchema,
});
export type BoxScore = z.infer<typeof BoxScoreSchema>;

/** Compact result kept in the save for every match. */
export const MatchResultSchema = z.object({
  id: z.string().min(1),
  seasonNumber: z.number().int().min(1),
  competitionId: z.string().min(1),
  stage: z.enum(['regular', 'playoff']),
  /** Matchday (regular season) or playoff round, 1-based. */
  round: z.number().int().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  homeScore: count,
  awayScore: count,
  overtimePeriods: count,
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

/** Full detail of one match: result + box score + event log. Not stored in saves. */
export const MatchDetailSchema = z.object({
  result: MatchResultSchema,
  boxScore: BoxScoreSchema,
  events: z.array(MatchEventSchema),
});
export type MatchDetail = z.infer<typeof MatchDetailSchema>;
