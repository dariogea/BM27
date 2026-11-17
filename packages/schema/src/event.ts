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

/** Area of the court a shot is taken from. */
export const SHOT_ZONES = ['restricted', 'paint', 'midrange', 'corner3', 'above-break3'] as const;
export const ShotZoneSchema = z.enum(SHOT_ZONES);
export type ShotZone = z.infer<typeof ShotZoneSchema>;

/** The action the offense ran to create the shot or commit the turnover. */
export const PLAY_TYPES = [
  'pick-and-roll',
  'isolation',
  'post-up',
  'spot-up',
  'cut',
  'off-screen',
  'transition',
  'putback',
] as const;
export const PlayTypeSchema = z.enum(PLAY_TYPES);
export type PlayType = z.infer<typeof PlayTypeSchema>;

export const TURNOVER_KINDS = [
  'bad-pass',
  'lost-ball',
  'travel',
  'offensive-foul',
  'shot-clock',
] as const;
export const TurnoverKindSchema = z.enum(TURNOVER_KINDS);
export type TurnoverKind = z.infer<typeof TurnoverKindSchema>;

/** Kinds of foul. Technical and unsportsmanlike fouls come from conduct, not from a play. */
export const FOUL_KINDS = [
  'personal',
  'shooting',
  'offensive',
  'technical',
  'unsportsmanlike',
] as const;
export const FoulKindSchema = z.enum(FOUL_KINDS);
export type FoulKind = z.infer<typeof FoulKindSchema>;

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
    zone: ShotZoneSchema,
    playType: PlayTypeSchema,
    /**
     * Where the shot was taken, in metres, on a half court: `x` across the
     * court (0–15, basket at 7.5) and `y` away from the baseline (basket at 1.575).
     */
    x: z.number(),
    y: z.number(),
    /** How open the shooter was: -1 smothered … +1 wide open. */
    openness: z.number().min(-1).max(1),
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
  z.object({
    ...base,
    type: z.literal('turnover'),
    playerId: id,
    kind: TurnoverKindSchema,
    playType: PlayTypeSchema,
    stealPlayerId: id.optional(),
  }),
  z.object({
    ...base,
    type: z.literal('foul'),
    /** Player who commits the foul. */
    playerId: id,
    /** Team of the player who commits the foul. */
    teamId: id,
    drawnByPlayerId: id,
    kind: FoulKindSchema,
    /** True for a deliberate foul to stop the clock late in the game. */
    intentional: z.boolean(),
    /** Free throws awarded by this foul. */
    freeThrows: z.number().int().min(0).max(3),
    fouledOut: z.boolean(),
  }),
  z.object({
    ...base,
    type: z.literal('jump_ball'),
    /** `opening` tip-off, or a `held-ball` settled by the alternating-possession arrow. */
    kind: z.enum(['opening', 'held-ball']),
    /** Team that gets the ball. */
    winnerTeamId: id,
    /** Players who jump (opening tip only): home first, then away. */
    jumperIds: z.array(id).length(2).optional(),
  }),
  z.object({
    ...base,
    type: z.literal('timeout'),
    /** Team that calls the timeout. */
    teamId: id,
    reason: z.enum(['opponent-run', 'end-of-game', 'rest']),
  }),
  z.object({
    ...base,
    type: z.literal('injury'),
    playerId: id,
    teamId: id,
    /** Games the player will miss after this one. */
    gamesOut: z.number().int().min(1),
  }),
  z.object({ ...base, type: z.literal('game_end') }),
]);
export type MatchEvent = z.infer<typeof MatchEventSchema>;
export type MatchEventType = MatchEvent['type'];
