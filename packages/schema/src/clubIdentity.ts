import { z } from 'zod';

const label = z
  .string()
  .min(1)
  .max(160)
  .refine((s) => s.trim().length > 0, 'no puede estar vacío');
export const ClubSourceSchema = z
  .object({
    catalogId: label,
    clubId: label,
    url: z
      .url({ protocol: /^https?$/ })
      .refine(
        (url) => !(url.split('/')[2] ?? '').includes('@'),
        'no se admiten credenciales en la URL',
      ),
    capturedOn: z.iso.date(),
    /** A claim from the pack author; the loader never independently verifies a source. */
    verification: z.enum(['unverified', 'declared-verified']),
  })
  .strict();
export const ClubIdentitySchema = z
  .object({
    /** Original name, independent of the currently displayed alias or sponsor. */
    referenceName: label,
    source: ClubSourceSchema.nullable(),
  })
  .strict();
export type ClubIdentity = z.infer<typeof ClubIdentitySchema>;

export const ClubDefinitionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
    name: label,
    city: label,
    region: label,
    competitionId: label,
    identity: ClubIdentitySchema,
  })
  .strict();
export type ClubDefinition = z.infer<typeof ClubDefinitionSchema>;
