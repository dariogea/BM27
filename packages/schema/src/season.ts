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

/** What a club earned and spent in one season. */
export const TeamFinanceRecordSchema = z.object({
  teamId: id,
  competitionId: id,
  tv: z.number().int().min(0),
  sponsors: z.number().int().min(0),
  tickets: z.number().int().min(0),
  homeGames: count,
  averageCrowd: count,
  /** Salaries paid. */
  wages: z.number().int().min(0),
  fixedCosts: z.number().int().min(0),
  /** Revenue minus costs. */
  result: z.number().int(),
  balanceEnd: z.number().int(),
  reputationEnd: z.number().int().min(0).max(100),
});
export type TeamFinanceRecord = z.infer<typeof TeamFinanceRecordSchema>;

export const SeasonSchema = z.object({
  seasonNumber: z.number().int().min(1),
  competitions: z.array(CompetitionSeasonSchema),
  /** One record per club that played. */
  finance: z.array(TeamFinanceRecordSchema),
});
export type Season = z.infer<typeof SeasonSchema>;

// ---------------------------------------------------------------------------
// Season in progress (saved mid-season)
// ---------------------------------------------------------------------------

export const FixtureSchema = z.object({
  /** Becomes the id of the match result once played. */
  id,
  /** Matchday, 1-based. */
  round: z.number().int().min(1),
  /** Index into the competition's groups. */
  group: count,
  homeTeamId: id,
  awayTeamId: id,
});
export type Fixture = z.infer<typeof FixtureSchema>;

/** Like PlayoffSeries, but possibly still being played. */
export const PlayoffSeriesStateSchema = PlayoffSeriesSchema.extend({
  /** Null while the series is undecided. */
  winnerTeamId: id.nullable(),
});
export type PlayoffSeriesState = z.infer<typeof PlayoffSeriesStateSchema>;

export const CompetitionProgressSchema = z.object({
  competitionId: id,
  phase: z.enum(['regular', 'playoffs', 'done']),
  groups: z.array(z.object({ name: z.string().min(1), teamIds: z.array(id) })),
  fixtures: z.array(FixtureSchema),
  /** Next regular-season matchday to play (1-based). */
  nextRound: z.number().int().min(1),
  totalRounds: count,
  /** Every match played so far, regular season and playoffs. */
  matches: z.array(MatchResultSchema),
  /** Playoff seeds, best first. Empty until the regular season ends. */
  playoffSeeds: z.array(id),
  /** Current playoff round (1-based); 0 before the playoffs. */
  playoffRound: count,
  /** Bracket slots of the current round, in bracket order (null = empty slot). */
  playoffAlive: z.array(id.nullable()),
  /** Teams knocked out in each finished round, best seed first. */
  playoffEliminated: z.array(z.array(id)),
  playoffSeries: z.array(PlayoffSeriesStateSchema),
  playerStats: z.array(PlayerSeasonStatsSchema),
});
export type CompetitionProgress = z.infer<typeof CompetitionProgressSchema>;

export const SeasonProgressSchema = z.object({
  seasonNumber: z.number().int().min(1),
  /** Number of steps (matchdays / playoff games) already played. */
  step: count,
  competitions: z.array(CompetitionProgressSchema),
});
export type SeasonProgress = z.infer<typeof SeasonProgressSchema>;

// ---------------------------------------------------------------------------
// Market log
// ---------------------------------------------------------------------------

export const TRANSACTION_TYPES = ['signed', 'renewed', 'released', 'expired', 'retired'] as const;

/** One move in the transfer market, kept for a few seasons so clubs can show their history. */
export const TransactionSchema = z.object({
  /** Season in which the move happened (the season being played or about to be played). */
  seasonNumber: z.number().int().min(1),
  type: z.enum(TRANSACTION_TYPES),
  playerId: id,
  /** Club involved; null when a free agent retires. */
  teamId: id.nullable(),
  salary: z.number().int().min(0).nullable(),
  endSeason: z.number().int().min(1).nullable(),
  /** Money paid by the club for this move (e.g. severance for releasing a player). */
  cost: z.number().int().min(0).nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;
