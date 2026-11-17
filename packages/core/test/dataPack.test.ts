import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  MAX_DATA_PACK_BYTES,
  migrateUniverseData,
  parseUniverse,
} from '@bm27/schema';
import sample from '../../../data/packs/example-eight-clubs.json';
import {
  BUILTIN_RULESETS,
  DEFAULT_NAME_POOL,
  DEFAULT_UNIVERSE_CONFIG,
  exportSave,
  generateUniverse,
  generateUniverseFromDataPack,
  importSave,
  parseDataPack,
  simulateSeason,
  sha256Hex,
} from '../src/index';

const clone = () => structuredClone(sample);
describe('versioned data packs', () => {
  it('simulates an eight-club league using the supplied rules and carries its names through saving and youth generation', () => {
    const world = generateUniverseFromDataPack(JSON.stringify(sample), 'pack-acceptance');
    expect(world.teams).toHaveLength(8);
    expect(world.competitions[0]!.rulesetId).toBe('example-2x15');
    expect(world.rulesets[0]).toMatchObject({
      periods: 2,
      periodMinutes: 15,
      shotClockSeconds: 20,
    });
    expect(world.dataPackId).toBe(sample.id);
    expect(world.namePool).toEqual(sample.names);
    const forced = {
      ...world,
      players: world.players.map((p, i) => (i === 0 ? { ...p, age: 40 } : p)),
    };
    const loaded = importSave(exportSave(forced));
    expect(loaded).toEqual(forced);
    const outcome = simulateSeason(loaded);
    expect(
      outcome.season.competitions[0]!.matches.filter((m) => m.stage === 'regular'),
    ).toHaveLength(56);
    expect(outcome.season.competitions[0]!.championTeamId).not.toBe('');
    const oldIds = new Set(loaded.players.map((p) => p.id));
    const arrivals = outcome.universe.players.filter((p) => !oldIds.has(p.id));
    expect(arrivals.length).toBeGreaterThan(0);
    for (const player of arrivals) expect(sample.names.firstNames).toContain(player.firstName);
    expect(outcome.universe.namePool).toEqual(sample.names);
    expect(outcome.universe.dataPackId).toBe(sample.id);
  });
  it('is deterministic and agrees with direct generation using the same validated data', () => {
    const a = generateUniverseFromDataPack(sample, 'same-pack');
    const b = generateUniverseFromDataPack(JSON.stringify(sample), 'same-pack');
    expect(a).toEqual(b);
    expect(a).toEqual(
      generateUniverse({
        seed: 'same-pack',
        config: sample.config,
        names: sample.names,
        rulesets: sample.rulesets,
        dataPackId: sample.id,
      }),
    );
    expect(simulateSeason(a)).toEqual(simulateSeason(b));
  });
  it('accepts the built-in configuration as an external pack and isolates generated names from caller mutations', () => {
    const pack = {
      formatVersion: 1,
      schemaVersion: SCHEMA_VERSION,
      id: 'built-in-test',
      name: 'Built-in test',
      config: DEFAULT_UNIVERSE_CONFIG,
      names: DEFAULT_NAME_POOL,
      rulesets: BUILTIN_RULESETS,
    };
    expect(parseDataPack(pack).config).toEqual(DEFAULT_UNIVERSE_CONFIG);
    const input = clone();
    const world = generateUniverseFromDataPack(input, 'isolated');
    input.names.firstNames[0] = 'Changed';
    expect(world.namePool!.firstNames).toEqual(sample.names.firstNames);
  });
  it('migrates version-6 saves to built-in names without changing their sporting content', () => {
    const current = generateUniverse({ seed: 'legacy-pack' });
    const legacy: Record<string, unknown> = { ...current, schemaVersion: 6 };
    delete legacy.namePool;
    delete legacy.dataPackId;
    const migrated = parseUniverse(migrateUniverseData(legacy));
    expect(migrated).toEqual({ ...current, namePool: null, dataPackId: null });
    const payload = JSON.stringify(legacy);
    const oldSave = JSON.stringify({
      format: 'bm27-save',
      schemaVersion: 6,
      checksum: `sha256:${sha256Hex(payload)}`,
      payload: legacy,
    });
    expect(importSave(oldSave)).toEqual(migrated);
    expect(parseUniverse(migrateUniverseData(migrated))).toEqual(migrated);
  });
  it('rejects invalid JSON, oversized UTF-8 data, unsupported versions and script-bearing root fields', () => {
    expect(() => parseDataPack('{')).toThrow(/JSON válido/);
    expect(() => parseDataPack('é'.repeat(MAX_DATA_PACK_BYTES / 2 + 1))).toThrow(/supera/);
    expect(() => parseDataPack({ ...sample, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(
      /schemaVersion/,
    );
    expect(() => parseDataPack({ ...sample, formatVersion: 2 })).toThrow(/formatVersion/);
    expect(() => parseDataPack({ ...sample, script: 'doNotExecute()' })).toThrow();
  });
  it('reports the exact field for bad rules, missing references and incompatible movement between levels', () => {
    const bad = clone();
    bad.rulesets[0]!.periodMinutes = -1;
    expect(() => parseDataPack(bad)).toThrow(/rulesets\[0\]\.periodMinutes/);
    const unknown = clone();
    unknown.config.levels[0]!.rulesetId = 'missing';
    expect(() => parseDataPack(unknown)).toThrow(/config\.levels\[0\]\.rulesetId/);
    const unbalanced = clone();
    unbalanced.config.levels[0]!.relegationSlots = 2;
    expect(() => parseDataPack(unbalanced)).toThrow(/relegationSlots/);
  });
  it('rejects duplicate identities, impossible group/roster sizes and uncovered minimum salaries', () => {
    const rules = clone();
    rules.rulesets.push({ ...rules.rulesets[0]! });
    expect(() => parseDataPack(rules)).toThrow(/duplicado/);
    const groups = clone();
    groups.config.levels[0]!.format.groupCount = 5;
    expect(() => parseDataPack(groups)).toThrow(/groupCount/);
    const roster = clone();
    roster.config.rosterSize.min = 11;
    expect(() => parseDataPack(roster)).toThrow(/rosterSize/);
    const cap = clone();
    cap.config.levels[0]!.salaryCap = 1;
    expect(() => parseDataPack(cap)).toThrow(/salaryCap/);
  });
  it('rejects exhausted or ambiguous name pools and unknown city regions before generation', () => {
    const small = clone();
    small.names.cities = small.names.cities.slice(0, 1);
    expect(() => generateUniverseFromDataPack(small, 'no-loop')).toThrow(/faltan nombres/);
    const duplicate = clone();
    duplicate.names.cities[1]!.name = duplicate.names.cities[0]!.name;
    expect(() => parseDataPack(duplicate)).toThrow(/duplicado/);
    const ambiguous = clone();
    ambiguous.names.cities[0]!.name = 'A';
    ambiguous.names.cities[1]!.name = 'A B';
    ambiguous.names.teamNicknames = ['B C', 'C', 'D', 'E'];
    expect(() => parseDataPack(ambiguous)).toThrow(/ambigua/);
    const region = clone();
    region.names.cities[0]!.region = 'Missing';
    expect(() => parseDataPack(region)).toThrow(/region/);
  });
});
