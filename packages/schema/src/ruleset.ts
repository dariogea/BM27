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
  /** Timeouts each team may call in the first half (periods 1 to half), in the second half, and in each overtime. */
  timeoutsFirstHalf: z.number().int().min(0).max(10),
  timeoutsSecondHalf: z.number().int().min(0).max(10),
  timeoutsOvertime: z.number().int().min(0).max(5),
  /** A player is ejected on reaching this many technical (or unsportsmanlike) fouls. */
  technicalFoulsForEjection: z.number().int().min(1).max(5),
  shotClockSeconds: z.number().int().min(10).max(60),
  /** Shot clock value after an offensive rebound. */
  shotClockOffensiveReboundSeconds: z.number().int().min(5).max(60),
});
export type Ruleset = z.infer<typeof RulesetSchema>;
