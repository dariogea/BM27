import {
  DEFAULT_TACTICS,
  SCHEMA_VERSION,
  SchemaValidationError,
  migrateUniverseData,
  parseUniverse,
  type Universe,
} from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  JsonSaveStore,
  MemorySaveStore,
  SaveError,
  exportSave,
  generateUniverse,
  hashValue,
  importSave,
  playerAbility,
  sha256Hex,
  simulateSeason,
  type SaveStore,
} from '../src/index';

let fresh: Universe;
let afterTwo: Universe;

beforeAll(() => {
  fresh = generateUniverse({ seed: 'save-test' });
  afterTwo = simulateSeason(simulateSeason(fresh).universe).universe;
});

describe('schema validation of universes', () => {
  it('loads a valid universe', () => {
    expect(() => parseUniverse(JSON.parse(JSON.stringify(afterTwo)))).not.toThrow();
  });

  it('rejects a corrupt universe with a readable error', () => {
    const broken = JSON.parse(JSON.stringify(fresh));
    broken.players[3].age = 'veinte';
    broken.players[5].attributes.offensive.threePoint = 250;
    delete broken.teams[0].name;

    let error: unknown;
    try {
      parseUniverse(broken);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(SchemaValidationError);
    const message = (error as Error).message;
    expect(message).toContain('Invalid universe');
    expect(message).toContain('players[3].age');
    expect(message).toContain('players[5].attributes.offensive.threePoint');
    expect(message).toContain('teams[0].name');
  });

  it('rejects broken references between entities', () => {
    const broken = JSON.parse(JSON.stringify(fresh));
    broken.competitions[1].rulesetId = 'does-not-exist';
    broken.teams[2].playerIds[0] = 'ghost';
    expect(() => parseUniverse(broken)).toThrow(/unknown ruleset "does-not-exist"/);
    expect(() => parseUniverse(broken)).toThrow(/teams\[2\].playerIds: unknown player "ghost"/);
  });

  it('rejects data that is not a universe at all', () => {
    expect(() => parseUniverse(null)).toThrow(SchemaValidationError);
    expect(() => parseUniverse({ schemaVersion: 99 })).toThrow(/schemaVersion/);
  });
});

describe('JSON export / import with checksum', () => {
  it('round-trips without changing anything', () => {
    const json = exportSave(afterTwo);
    expect(hashValue(importSave(json))).toBe(hashValue(afterTwo));
    expect(JSON.parse(json).checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('detects a modified save file', () => {
    const json = exportSave(fresh);
    const name = fresh.teams[0]!.name;
    const tampered = json.replace(name, `${name}X`);
    expect(tampered).not.toBe(json);
    expect(() => importSave(tampered)).toThrow(SaveError);
    expect(() => importSave(tampered)).toThrow(/corrupt/);
  });

  it('gives readable errors for garbage or other versions', () => {
    expect(() => importSave('not json {')).toThrow(/not valid JSON/);
    expect(() => importSave('{"hello":1}')).toThrow(/Invalid save file/);
    const newer = exportSave(fresh).replace(/"schemaVersion":\d+/, '"schemaVersion":99');
    expect(() => importSave(newer)).toThrow(/newer version of the game \(data version 99/);
  });
});

describe('migration of old saves', () => {
  /**
   * Rebuilds what a T-001 (contract v0) save looked like: no tactics, no
   * line-ups, no user team, no season in progress and no player potential.
   */
  function asVersion0(universe: Universe): string {
    const old = JSON.parse(JSON.stringify(universe));
    old.schemaVersion = 0;
    delete old.currentSeason;
    delete old.userTeamId;
    for (const team of old.teams) {
      delete team.tactics;
      delete team.rotation;
    }
    for (const player of old.players) {
      delete player.potential;
      delete player.contract;
    }
    for (const competition of old.competitions) {
      delete competition.salaryCap;
      delete competition.minSalary;
      delete competition.rosterMin;
      delete competition.rosterMax;
    }
    delete old.transactions;
    // v4 → v5: money.
    for (const team of old.teams) {
      delete team.reputation;
      delete team.finance;
    }
    for (const competition of old.competitions) delete competition.economy;
    for (const season of old.history) delete season.finance;
    const payload = JSON.stringify(old);
    return `{"format":"bm27-save","schemaVersion":0,"checksum":"sha256:${sha256Hex(payload)}","payload":${payload}}`;
  }

  it('opens a version-0 save, upgrades it step by step and keeps everything else', () => {
    const loaded = importSave(asVersion0(afterTwo));
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.teams.length).toBe(afterTwo.teams.length);
    for (const team of loaded.teams) {
      expect(team.tactics).toEqual(DEFAULT_TACTICS);
      expect(team.rotation).toBeNull();
    }
    expect(loaded.currentSeason).toBeNull();
    expect(loaded.userTeamId).toBeNull();
    // v3 → v4: contracts for everybody with a club, caps and roster limits for competitions.
    expect(loaded.transactions).toEqual([]);
    // v4 → v5: every club gets a reputation and some cash; every competition an economy.
    for (const team of loaded.teams) {
      expect(team.reputation).toBeGreaterThanOrEqual(0);
      expect(team.finance.lastRevenue).toBeGreaterThan(0);
    }
    for (const competition of loaded.competitions) {
      expect(competition.economy.tvRevenue).toBeGreaterThan(0);
    }
    for (const season of loaded.history) expect(season.finance).toEqual([]);
    for (const competition of loaded.competitions) {
      expect(competition.salaryCap).toBeGreaterThan(0);
      expect(competition.rosterMin).toBe(12);
      expect(competition.rosterMax).toBe(15);
    }
    for (const player of loaded.players) {
      if (player.teamId === null) expect(player.contract).toBeNull();
      else expect(player.contract!.salary).toBeGreaterThanOrEqual(12_000);
    }
    // Potential is estimated from ability and age: never below ability, with a gap for the young.
    const original = new Map(afterTwo.players.map((p) => [p.id, p]));
    let youngGap = 0;
    let youngCount = 0;
    for (const player of loaded.players) {
      const ability = playerAbility(player);
      expect(player.potential).toBeGreaterThanOrEqual(Math.round(ability) - 1);
      if (player.age <= 21) {
        youngGap += player.potential - ability;
        youngCount++;
      }
      // Everything except the new field is untouched.
      const { potential: _ignored, contract: _c1, ...rest } = original.get(player.id)!;
      const { potential: _also, contract: _c2, ...restLoaded } = player;
      expect(restLoaded).toEqual(rest);
    }
    expect(youngGap / youngCount).toBeGreaterThan(2);
    // Seasons played before money existed have no books.
    const withoutBooks = (u: Universe) => u.history.map(({ finance: _books, ...rest }) => rest);
    expect(hashValue(withoutBooks(loaded))).toBe(hashValue(withoutBooks(afterTwo)));
    // And the migrated universe can keep being simulated.
    expect(simulateSeason(loaded).universe.seasonNumber).toBe(afterTwo.seasonNumber + 1);
  });

  it('still verifies the checksum of old saves', () => {
    const tampered = asVersion0(fresh).replace(fresh.teams[0]!.name, 'Hacked');
    expect(() => importSave(tampered)).toThrow(/corrupt/);
  });

  it('migrateUniverseData leaves current data untouched and rejects the future', () => {
    expect(migrateUniverseData(fresh)).toBe(fresh);
    expect(() => migrateUniverseData({ schemaVersion: 42 })).toThrow(/newer than this build/);
  });
});

describe.each<[string, () => SaveStore]>([
  ['MemorySaveStore', () => new MemorySaveStore()],
  ['JsonSaveStore', () => new JsonSaveStore()],
])('%s', (_name, create) => {
  it('saves, lists, loads and deletes', async () => {
    const store = create();
    await store.save('slot-a', fresh);
    await store.save('slot-b', afterTwo);
    expect(await store.list()).toEqual(['slot-a', 'slot-b']);
    expect(hashValue(await store.load('slot-b'))).toBe(hashValue(afterTwo));
    await store.delete('slot-a');
    expect(await store.list()).toEqual(['slot-b']);
    await expect(store.load('slot-a')).rejects.toThrow(/does not exist/);
  });

  it('save → load → keep simulating equals simulating without saving', async () => {
    // Without saving: 2 seasons already played + 2 more.
    let straight = afterTwo;
    for (let i = 0; i < 2; i++) straight = simulateSeason(straight).universe;

    const store = create();
    await store.save('mid', afterTwo);
    let resumed = await store.load('mid');
    for (let i = 0; i < 2; i++) resumed = simulateSeason(resumed).universe;

    expect(resumed.seasonNumber).toBe(5);
    expect(hashValue(resumed)).toBe(hashValue(straight));
  });
});
