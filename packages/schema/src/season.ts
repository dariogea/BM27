import { z } from 'zod';
import { MatchResultSchema, StatLineSchema } from './match';

const id = z.string().min(1);
const count = z.number().int().min(0);

export const StandingRowSchema = z.object({
  position: z.number().int().min(1),
  teamId: id,
  played: count,
  wins: count,
  losses: count,
  pointsFor: count,
  pointsAgainst: count,
});
export type StandingRow = z.infer<typeof StandingRowSchema>;

export const GroupSeasonSchema = z.object({
  name: z.string().min(1),
  teamIds: z.array(id),
  standings: z.array(StandingRowSchema),
});
export type GroupSeason = z.infer<typeof GroupSeasonSchema>;

export const PlayoffSeriesSchema = z.object({
  round: z.number().int().min(1),
  bestOf: z.number().int().min(1),
  highSeed: z.number().int().min(1),
  highSeedTeamId: id,
  /** Null when the high seed had a bye. */
  lowSeedTeamId: id.nullable(),
  highSeedWins: count,
  lowSeedWins: count,
  winnerTeamId: id,
  matchIds: z.array(id),
});
export type PlayoffSeries = z.infer<typeof PlayoffSeriesSchema>;

export const PlayerSeasonStatsSchema = StatLineSchema.extend({
  playerId: id,
  teamId: id,
  games: count,
});
export type PlayerSeasonStats = z.infer<typeof PlayerSeasonStatsSchema>;

export const CompetitionSeasonSchema = z.object({
  competitionId: id,
  groups: z.array(GroupSeasonSchema),
  matches: z.array(MatchResultSchema),
  playoffSeries: z.array(PlayoffSeriesSchema),
  /** All teams, best to worst. Drives promotion and relegation. */
  finalRanking: z.array(id),
  championTeamId: id,
  promotedTeamIds: z.array(id),
  relegatedTeamIds: z.array(id),
  playerStats: z.array(PlayerSeasonStatsSchema),
});
export type CompetitionSeason = z.infer<typeof CompetitionSeasonSchema>;

export const SeasonSchema = z.object({
  seasonNumber: z.number().int().min(1),
  competitions: z.array(CompetitionSeasonSchema),
});
export type Season = z.infer<typeof SeasonSchema>;
