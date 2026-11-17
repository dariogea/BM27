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
  // v3 → v4 (T-005): contracts, salary caps, roster limits and the market log.
  // The numbers below are frozen: they are what the game used when v4 was introduced.
  3: (data) => {
    const seasonNumber = typeof data.seasonNumber === 'number' ? data.seasonNumber : 1;
    const CAPS: Record<number, number> = { 1: 4_400_000, 2: 2_000_000, 3: 1_000_000 };
    return {
      ...data,
      schemaVersion: 4,
      transactions: 'transactions' in data ? data.transactions : [],
      competitions: Array.isArray(data.competitions)
        ? data.competitions.map((c: unknown) => {
            if (c === null || typeof c !== 'object' || 'salaryCap' in c) return c;
            const level = (c as { level?: unknown }).level;
            return {
              ...c,
              salaryCap: CAPS[level as number] ?? 500_000,
              minSalary: 12_000,
              rosterMin: 12,
              rosterMax: 15,
            };
          })
        : data.competitions,
      players: Array.isArray(data.players)
        ? data.players.map((player: unknown) => {
            if (player === null || typeof player !== 'object' || 'contract' in player)
              return player;
            const p = player as { teamId?: unknown; retired?: unknown; attributes?: unknown };
            if (p.teamId === null || p.teamId === undefined || p.retired === true) {
              return { ...player, contract: null };
            }
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
            return {
              ...player,
              contract: {
                salary: Math.max(12_000, Math.round(20_000 * Math.exp((ability - 45) / 12))),
                endSeason: seasonNumber + 1,
              },
            };
          })
        : data.players,
    };
  },
  // v4 → v5 (T-006): money. Frozen numbers: what the game used when v5 was introduced.
  4: (data) => {
    const ECONOMY: Record<number, Record<string, number>> = {
      1: {
        tvRevenue: 1_400_000,
        sponsorRevenue: 1_900_000,
        ticketPrice: 20,
        averageAttendance: 4_000,
        fixedCosts: 1_100_000,
        wageShare: 0.7,
        baseReputation: 70,
      },
      2: {
        tvRevenue: 650_000,
        sponsorRevenue: 900_000,
        ticketPrice: 15,
        averageAttendance: 2_600,
        fixedCosts: 500_000,
        wageShare: 0.7,
        baseReputation: 55,
      },
      3: {
        tvRevenue: 330_000,
        sponsorRevenue: 450_000,
        ticketPrice: 11,
        averageAttendance: 1_400,
        fixedCosts: 260_000,
        wageShare: 0.7,
        baseReputation: 40,
      },
      4: {
        tvRevenue: 160_000,
        sponsorRevenue: 220_000,
        ticketPrice: 8,
        averageAttendance: 700,
        fixedCosts: 130_000,
        wageShare: 0.7,
        baseReputation: 25,
      },
    };
    const levelOf = new Map<string, number>();
    if (Array.isArray(data.competitions)) {
      for (const c of data.competitions) {
        const comp = c as { level?: unknown; teamIds?: unknown };
        if (Array.isArray(comp.teamIds)) {
          for (const id of comp.teamIds) levelOf.set(String(id), Number(comp.level) || 4);
        }
      }
    }
    return {
      ...data,
      schemaVersion: 5,
      competitions: Array.isArray(data.competitions)
        ? data.competitions.map((c: unknown) =>
            c !== null && typeof c === 'object' && !('economy' in c)
              ? { ...c, economy: ECONOMY[Number((c as { level?: unknown }).level)] ?? ECONOMY[4] }
              : c,
          )
        : data.competitions,
      teams: Array.isArray(data.teams)
        ? data.teams.map((team: unknown) => {
            if (team === null || typeof team !== 'object' || 'finance' in team) return team;
            const level = levelOf.get(String((team as { id?: unknown }).id)) ?? 4;
            const economy = ECONOMY[level] ?? ECONOMY[4];
            const revenue = Math.round(
              (economy?.tvRevenue ?? 0) +
                (economy?.sponsorRevenue ?? 0) +
                15 * (economy?.averageAttendance ?? 0) * (economy?.ticketPrice ?? 0),
            );
            return {
              ...team,
              reputation: economy?.baseReputation ?? 25,
              finance: { balance: Math.round(revenue * 0.05), lastRevenue: revenue },
            };
          })
        : data.teams,
      transactions: Array.isArray(data.transactions)
        ? data.transactions.map((t: unknown) =>
            t !== null && typeof t === 'object' && !('cost' in t) ? { ...t, cost: null } : t,
          )
        : data.transactions,
      history: Array.isArray(data.history)
        ? data.history.map((s: unknown) =>
            s !== null && typeof s === 'object' && !('finance' in s) ? { ...s, finance: [] } : s,
          )
        : data.history,
    };
  },
  // v5 → v6 (T-028): players gain `injury`; rulesets gain timeouts and ejection limit.
  5: (data) => ({
    ...data,
    schemaVersion: 6,
    players: Array.isArray(data.players)
      ? data.players.map((player: unknown) =>
          player !== null && typeof player === 'object' && !('injury' in player)
            ? { ...player, injury: null }
            : player,
        )
      : data.players,
    rulesets: Array.isArray(data.rulesets)
      ? data.rulesets.map((ruleset: unknown) => {
          if (ruleset === null || typeof ruleset !== 'object' || 'timeoutsFirstHalf' in ruleset)
            return ruleset;
          const big = (ruleset as { id?: unknown }).id === 'nba-like';
          return {
            ...ruleset,
            timeoutsFirstHalf: big ? 4 : 2,
            timeoutsSecondHalf: 3,
            timeoutsOvertime: big ? 2 : 1,
            technicalFoulsForEjection: 2,
          };
        })
      : data.rulesets,
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
