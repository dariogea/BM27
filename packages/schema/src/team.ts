import { ClubIdentitySchema } from './clubIdentity';
import { z } from 'zod';

/**
 * Team tactics. Every option has a real, tested effect in the match engine
 * (see packages/core/test/tactics.test.ts). Nothing here is decorative.
 */
export const TeamTacticsSchema = z.object({
  /** How quickly the team looks for a shot and how much it runs. */
  pace: z.enum(['slow', 'normal', 'fast']),
  /** Where the offense tries to get its shots. */
  offenseFocus: z.enum(['inside', 'balanced', 'perimeter']),
  /** Man-to-man or zone defense. */
  defenseScheme: z.enum(['man', 'zone']),
  /** How the defense plays the pick and roll (only used in man-to-man). */
  pickAndRollCoverage: z.enum(['drop', 'switch', 'hedge', 'blitz']),
  /** Defensive pressure on the ball. */
  pressure: z.enum(['low', 'normal', 'high']),
  /** Send players to the offensive glass, or get back on defense. */
  offensiveRebounding: z.enum(['get-back', 'normal', 'crash']),
  /** How many players are in the regular rotation. */
  rotationDepth: z.number().int().min(7).max(12),
});
export type TeamTactics = z.infer<typeof TeamTacticsSchema>;

export const DEFAULT_TACTICS: TeamTactics = {
  pace: 'normal',
  offenseFocus: 'balanced',
  defenseScheme: 'man',
  pickAndRollCoverage: 'hedge',
  pressure: 'normal',
  offensiveRebounding: 'normal',
  rotationDepth: 10,
};

/** Money of a club. */
export const TeamFinanceSchema = z.object({
  /** Cash in euros. May be negative (the club is in debt). */
  balance: z.number().int(),
  /** Revenue of the last season played; the next wage budget is based on it. */
  lastRevenue: z.number().int().min(0),
});
export type TeamFinance = z.infer<typeof TeamFinanceSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Null for generated identities; defined clubs retain their original name and source claims. */
  identity: ClubIdentitySchema.nullable(),
  city: z.string().min(1),
  /** Geographic region, used to build regional groups. */
  region: z.string().min(1),
  playerIds: z.array(z.string().min(1)),
  tactics: TeamTacticsSchema,
  /**
   * Line-up chosen by hand: player ids in order. The first five are the
   * starters at PG, SG, SF, PF and C; the rest is the bench, most used first.
   * Null means "let the coach decide".
   */
  rotation: z.array(z.string().min(1)).min(5).nullable(),
  /** How well known and loved the club is (0–100). Drives crowds and sponsors. */
  reputation: z.number().int().min(0).max(100),
  finance: TeamFinanceSchema,
});
export type Team = z.infer<typeof TeamSchema>;
