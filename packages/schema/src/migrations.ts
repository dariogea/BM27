import { DEFAULT_TACTICS } from './team';
import { SCHEMA_VERSION } from './version';

type Json = Record<string, unknown>;

/**
 * One step per version: `MIGRATIONS[n]` upgrades data from version n to n + 1.
 * Steps receive plain parsed JSON and must not assume it is valid.
 */
const MIGRATIONS: Record<number, (data: Json) => Json> = {
  // v0 → v1 (T-002): every team gets default tactics.
  0: (data) => ({
    ...data,
    schemaVersion: 1,
    teams: Array.isArray(data.teams)
      ? data.teams.map((team: unknown) =>
          team !== null && typeof team === 'object' && !('tactics' in team)
            ? { ...team, tactics: { ...DEFAULT_TACTICS } }
            : team,
        )
      : data.teams,
  }),
};

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Upgrades raw universe data from any older contract version to the current
 * one. Data already at the current version is returned untouched. The result
 * still has to be validated with `parseUniverse`.
 */
export function migrateUniverseData(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return raw;
  let data = raw as Json;
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) return raw;
  if (version > SCHEMA_VERSION) {
    throw new MigrationError(
      `The data uses contract version ${version}, newer than this build (version ${SCHEMA_VERSION}). Update the game to open it.`,
    );
  }
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new MigrationError(`No migration available from contract version ${v}.`);
    data = step(data);
  }
  return data;
}
