import { z } from 'zod';
import { SCHEMA_VERSION } from './version';

export const SAVE_FORMAT = 'bm27-save' as const;

/** Envelope of an exported save file. `payload` is validated separately as a Universe. */
export const SaveEnvelopeSchema = z.object({
  format: z.literal(SAVE_FORMAT),
  /** Contract version the payload was written with (may be older than the current one). */
  schemaVersion: z.number().int().min(0).max(SCHEMA_VERSION),
  /** "sha256:<hex>" of the JSON text of `payload`. */
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  payload: z.unknown(),
});
export type SaveEnvelope = z.infer<typeof SaveEnvelopeSchema>;
