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
});
export type Competition = z.infer<typeof CompetitionSchema>;
