import {
  SAVE_FORMAT,
  SCHEMA_VERSION,
  SaveEnvelopeSchema,
  migrateUniverseData,
  parseUniverse,
  parseWith,
  type Universe,
} from '@bm27/schema';
import { sha256Hex } from '../hash';

/**
 * Abstract persistence. The definitive database is NOT decided yet (T-001):
 * anything that can implement these four methods can store saves.
 */
export interface SaveStore {
  save(slot: string, universe: Universe): Promise<void>;
  /** Rejects if the slot does not exist or its content is corrupt. */
  load(slot: string): Promise<Universe>;
  list(): Promise<string[]>;
  delete(slot: string): Promise<void>;
}

export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

/** Serialises a universe into a self-describing JSON document with a checksum. */
export function exportSave(universe: Universe): string {
  const payload = JSON.stringify(universe);
  const head = JSON.stringify({
    format: SAVE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    checksum: `sha256:${sha256Hex(payload)}`,
  });
  // Hand-assembled so the payload is serialised (and hashed) only once.
  return `${head.slice(0, -1)},"payload":${payload}}`;
}

/**
 * Parses and verifies a document produced by `exportSave` (by this or an older
 * version of the game; older data is migrated automatically).
 */
export function importSave(json: string): Universe {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new SaveError(`The save file is not valid JSON: ${(error as Error).message}`);
  }
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version > SCHEMA_VERSION) {
    throw new SaveError(
      `The save file was written by a newer version of the game (data version ${version}; this build understands up to ${SCHEMA_VERSION}).`,
    );
  }
  const envelope = parseWith(SaveEnvelopeSchema, 'save file', raw);
  const actual = `sha256:${sha256Hex(JSON.stringify(envelope.payload))}`;
  if (actual !== envelope.checksum) {
    throw new SaveError(
      'The save file is corrupt: its checksum does not match its content (it was modified or damaged).',
    );
  }
  // Older saves are upgraded step by step to the current contract version.
  let migrated: unknown;
  try {
    migrated = migrateUniverseData(envelope.payload);
  } catch (error) {
    throw new SaveError((error as Error).message);
  }
  return parseUniverse(migrated);
}

/** Keeps saves as live objects in memory (deep-copied on the way in and out). */
export class MemorySaveStore implements SaveStore {
  private readonly slots = new Map<string, Universe>();

  async save(slot: string, universe: Universe): Promise<void> {
    this.slots.set(slot, structuredCloneCompat(universe));
  }

  async load(slot: string): Promise<Universe> {
    const found = this.slots.get(slot);
    if (!found) throw new SaveError(`Save "${slot}" does not exist`);
    return structuredCloneCompat(found);
  }

  async list(): Promise<string[]> {
    return [...this.slots.keys()].sort();
  }

  async delete(slot: string): Promise<void> {
    this.slots.delete(slot);
  }
}

/** Where `JsonSaveStore` puts its text documents (a folder, localStorage, ...). */
export interface TextStorage {
  read(key: string): Promise<string | undefined>;
  write(key: string, text: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryTextStorage implements TextStorage {
  private readonly texts = new Map<string, string>();
  async read(key: string): Promise<string | undefined> {
    return this.texts.get(key);
  }
  async write(key: string, text: string): Promise<void> {
    this.texts.set(key, text);
  }
  async remove(key: string): Promise<void> {
    this.texts.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.texts.keys()].sort();
  }
}

/** Stores every save as an exported JSON document with checksum. */
export class JsonSaveStore implements SaveStore {
  constructor(private readonly storage: TextStorage = new MemoryTextStorage()) {}

  async save(slot: string, universe: Universe): Promise<void> {
    await this.storage.write(slot, exportSave(universe));
  }

  async load(slot: string): Promise<Universe> {
    const text = await this.storage.read(slot);
    if (text === undefined) throw new SaveError(`Save "${slot}" does not exist`);
    return importSave(text);
  }

  async list(): Promise<string[]> {
    return this.storage.keys();
  }

  async delete(slot: string): Promise<void> {
    await this.storage.remove(slot);
  }
}

function structuredCloneCompat<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
