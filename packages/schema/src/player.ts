import { z } from 'zod';

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export const PositionSchema = z.enum(POSITIONS);
export type Position = z.infer<typeof PositionSchema>;

/** Every attribute is an integer on a 1–99 scale. */
const Attr = z.number().int().min(1).max(99);

export const OffensiveAttributesSchema = z.object({
  closeShot: Attr,
  midRange: Attr,
  threePoint: Attr,
  freeThrow: Attr,
  passing: Attr,
  ballHandling: Attr,
  offensiveRebound: Attr,
});

export const DefensiveAttributesSchema = z.object({
  perimeterDefense: Attr,
  interiorDefense: Attr,
  steal: Attr,
  block: Attr,
  defensiveRebound: Attr,
});

export const PhysicalAttributesSchema = z.object({
  speed: Attr,
  strength: Attr,
  stamina: Attr,
  jumping: Attr,
});

export const MentalAttributesSchema = z.object({
  decisions: Attr,
  composure: Attr,
  workRate: Attr,
  discipline: Attr,
});

export const PlayerAttributesSchema = z.object({
  offensive: OffensiveAttributesSchema,
  defensive: DefensiveAttributesSchema,
  physical: PhysicalAttributesSchema,
  mental: MentalAttributesSchema,
});
export type PlayerAttributes = z.infer<typeof PlayerAttributesSchema>;

export const PlayerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  age: z.number().int().min(15).max(50),
  heightCm: z.number().int().min(150).max(240),
  /** First entry is the primary position. */
  positions: z.array(PositionSchema).min(1).max(3),
  attributes: PlayerAttributesSchema,
  /** Null when the player has no club (e.g. retired). */
  teamId: z.string().min(1).nullable(),
  retired: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;
