import { z } from 'zod';

/**
 * Possession-by-possession event log. This is the single source of truth of a
 * match: box scores and any future 2D/3D viewer are derived from it.
 */
const base = {
  /** Sequential index inside the match, starting at 0. */
  seq: z.number().int().min(0),
  /** 1-based period. Periods beyond the ruleset's regular ones are overtime. */
  period: z.number().int().min(1),
  /** Seconds left in the period when the event happens. */
  clock: z.number().int().min(0),
  /** Possession index (increments every time the ball changes hands). */
  possession: z.number().int().min(0),
  /** Team with the ball. */
  offenseTeamId: z.string().min(1),
};

const id = z.string().min(1);

export const SHOT_TYPES = ['rim', 'mid', 'three'] as const;
export const ShotTypeSchema = z.enum(SHOT_TYPES);
export type ShotType = z.infer<typeof ShotTypeSchema>;

export const MatchEventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('lineup'), teamId: id, playerIds: z.array(id).length(5) }),
  z.object({ ...base, type: z.literal('period_start'), periodSeconds: z.number().int().min(1) }),
  z.object({ ...base, type: z.literal('period_end') }),
  z.object({
    ...base,
    type: z.literal('substitution'),
    teamId: id,
    playerInId: id,
    playerOutId: id,
  }),
  z.object({
    ...base,
    type: z.literal('shot'),
    playerId: id,
    shotType: ShotTypeSchema,
    made: z.boolean(),
    points: z.number().int().min(0).max(3),
    assistPlayerId: id.optional(),
    blockPlayerId: id.optional(),
  }),
  z.object({ ...base, type: z.literal('free_throw'), playerId: id, made: z.boolean() }),
  z.object({
    ...base,
    type: z.literal('rebound'),
    playerId: id,
    teamId: id,
    kind: z.enum(['offensive', 'defensive']),
  }),
  z.object({ ...base, type: z.literal('turnover'), playerId: id, stealPlayerId: id.optional() }),
  z.object({
    ...base,
    type: z.literal('foul'),
    /** Player who commits the foul (always a defender in this prototype). */
    playerId: id,
    teamId: id,
    drawnByPlayerId: id,
    kind: z.enum(['personal', 'shooting']),
    /** Free throws awarded by this foul. */
    freeThrows: z.number().int().min(0).max(3),
    fouledOut: z.boolean(),
  }),
  z.object({ ...base, type: z.literal('game_end') }),
]);
export type MatchEvent = z.infer<typeof MatchEventSchema>;
export type MatchEventType = MatchEvent['type'];
