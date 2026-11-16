import { z } from 'zod';

export const RulesetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Number of regular periods (quarters). */
  periods: z.number().int().min(1).max(8),
  periodMinutes: z.number().int().min(1).max(30),
  overtimeMinutes: z.number().int().min(1).max(15),
  /** A player is disqualified on reaching this many personal fouls. */
  personalFoulLimit: z.number().int().min(1).max(10),
  /**
   * Team foul number in a period from which every defensive foul awards two
   * free throws (5 means: free throws from the 5th team foul onwards).
   */
  teamFoulsForBonus: z.number().int().min(1).max(20),
  shotClockSeconds: z.number().int().min(10).max(60),
  /** Shot clock value after an offensive rebound. */
  shotClockOffensiveReboundSeconds: z.number().int().min(5).max(60),
});
export type Ruleset = z.infer<typeof RulesetSchema>;
