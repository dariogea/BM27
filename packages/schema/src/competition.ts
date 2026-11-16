import { z } from 'zod';

export const PlayoffFormatSchema = z.object({
  /** Teams per group that qualify for the playoff bracket. */
  qualifiersPerGroup: z.number().int().min(1),
  /**
   * Best-of length for each round, first round first. If the bracket has more
   * rounds than entries, the last entry is reused. Values must be odd.
   */
  seriesBestOf: z
    .array(
      z
        .number()
        .int()
        .min(1)
        .refine((n) => n % 2 === 1, 'best-of must be odd'),
    )
    .min(1),
});
export type PlayoffFormat = z.infer<typeof PlayoffFormatSchema>;

export const CompetitionFormatSchema = z.object({
  /** 1 = single league; more = conferences / regional groups. */
  groupCount: z.number().int().min(1),
  /** 2 = home and away (double round robin). */
  roundRobinLegs: z.number().int().min(1).max(4),
  playoffs: PlayoffFormatSchema.nullable(),
});
export type CompetitionFormat = z.infer<typeof CompetitionFormatSchema>;

/**
 * How money works in a competition. Every amount is in euros per season for one club
 * of average reputation (50).
 */
export const EconomySchema = z.object({
  /** Television and league income shared by every club. */
  tvRevenue: z.number().int().min(0),
  /** Sponsorship income of a club with reputation 50. */
  sponsorRevenue: z.number().int().min(0),
  /** Price of a ticket. */
  ticketPrice: z.number().min(0),
  /** Average crowd of a home game for a club with reputation 50. */
  averageAttendance: z.number().int().min(0),
  /** Running costs that do not depend on the squad (arena, staff, travel). */
  fixedCosts: z.number().int().min(0),
  /** Share of its revenue a club is willing to spend on salaries (0–1). */
  wageShare: z.number().min(0).max(1),
  /** Reputation (0–100) of a typical club of this level; reputation drifts towards it. */
  baseReputation: z.number().min(0).max(100),
});
export type Economy = z.infer<typeof EconomySchema>;

export const CompetitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 1 is the top tier. */
  level: z.number().int().min(1),
  rulesetId: z.string().min(1),
  format: CompetitionFormatSchema,
  /** Teams promoted to the level above at season end (top of final ranking). */
  promotionSlots: z.number().int().min(0),
  /** Teams relegated to the level below at season end (bottom of final ranking). */
  relegationSlots: z.number().int().min(0),
  /** Current members. Changes every season with promotion/relegation. */
  teamIds: z.array(z.string().min(1)).min(2),
  /** Maximum total salaries a club may have under contract, in euros per season. */
  salaryCap: z.number().int().min(0),
  /** Lowest salary a player can be paid, in euros per season. */
  minSalary: z.number().int().min(0),
  /** A club needs at least this many players when the season starts. */
  rosterMin: z.number().int().min(5),
  /** A club cannot have more players than this. */
  rosterMax: z.number().int().min(5),
  economy: EconomySchema,
});
export type Competition = z.infer<typeof CompetitionSchema>;
