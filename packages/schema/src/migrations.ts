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
  // v1 → v2 (T-003): hand-picked rotations, user team and season in progress.
  1: (data) => ({
    ...data,
    schemaVersion: 2,
    currentSeason: 'currentSeason' in data ? data.currentSeason : null,
    userTeamId: 'userTeamId' in data ? data.userTeamId : null,
    teams: Array.isArray(data.teams)
      ? data.teams.map((team: unknown) =>
          team !== null && typeof team === 'object' && !('rotation' in team)
            ? { ...team, rotation: null }
            : team,
        )
      : data.teams,
  }),
  // v2 → v3 (T-004): players get a potential, estimated from ability and age.
  2: (data) => ({
    ...data,
    schemaVersion: 3,
    players: Array.isArray(data.players)
      ? data.players.map((player: unknown) => {
          if (player === null || typeof player !== 'object' || 'potential' in player) return player;
          const p = player as { age?: unknown; attributes?: unknown };
          let sum = 0;
          let count = 0;
          if (p.attributes !== null && typeof p.attributes === 'object') {
            for (const group of Object.values(p.attributes)) {
              if (group === null || typeof group !== 'object') continue;
              for (const value of Object.values(group)) {
                if (typeof value === 'number') {
                  sum += value;
                  count++;
                }
              }
            }
          }
          const ability = count > 0 ? sum / count : 50;
          const age = typeof p.age === 'number' ? p.age : 27;
          const headroom = Math.max(0, 26 - age) * 0.9;
          return {
            ...player,
            potential: Math.max(1, Math.min(99, Math.round(ability + headroom))),
          };
        })
      : data.players,
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
