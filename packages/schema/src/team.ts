import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  /** Geographic region, used to build regional groups. */
  region: z.string().min(1),
  playerIds: z.array(z.string().min(1)),
});
export type Team = z.infer<typeof TeamSchema>;
