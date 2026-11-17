import { z } from 'zod';

export const NamePoolSchema = z.object({
  cities: z.array(z.object({ name: z.string().min(1), region: z.string().min(1) })).min(1),
  teamNicknames: z.array(z.string().min(1)).min(1),
  firstNames: z.array(z.string().min(1)).min(1),
  lastNames: z.array(z.string().min(1)).min(1),
});
export type NamePool = z.infer<typeof NamePoolSchema>;
