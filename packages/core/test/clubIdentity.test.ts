import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Universe } from '@bm27/schema';
import sample from '../../../data/packs/example-eight-defined-clubs.json';
import legacySample from '../../../data/packs/example-eight-clubs.json';
import {
  exportSave,
  generateUniverse,
  generateUniverseFromDataPack,
  importSave,
  parseDataPack,
  sha256Hex,
  simulateSeason,
} from '../src/index';

const clone = () => structuredClone(sample);
const sporting = (world: Universe) => ({
  ...world,
  teams: world.teams.map((team) => ({ ...team, name: '' })),
});

describe('stable club definitions in data packs', () => {
  it('preserves every explicit ID, alias, location, reference and roster relation through two seasons and saving', () => {
    let world = generateUniverseFromDataPack(sample, 'defined-clubs');
    expect(world.teams.map((team) => team.id)).toEqual(sample.clubs.map((club) => club.id));
    for (let season = 0; season < 3; season++) {
      world = importSave(exportSave(world));
      for (const club of sample.clubs) {
        const team = world.teams.find((team) => team.id === club.id)!;
        expect(team).toMatchObject({
          id: club.id,
          name: club.name,
          city: club.city,
          region: club.region,
          identity: club.identity,
        });
        for (const playerId of team.playerIds)
          expect(world.players.find((p) => p.id === playerId)?.teamId).toBe(team.id);
      }
      expect(world.competitions[0]!.teamIds.slice().sort()).toEqual(
        sample.clubs.map((club) => club.id).sort(),
      );
      if (season < 2) world = simulateSeason(world).universe;
    }
    expect(world.history).toHaveLength(2);
    expect(
      world.history.every((s) =>
        s.competitions[0]!.matches.every((m) => sample.clubs.some((c) => c.id === m.homeTeamId)),
      ),
    ).toBe(true);
  });
  it('keeps player generation and sporting results identical when the input order or displayed alias changes', () => {
    const reordered = clone();
    reordered.clubs.reverse();
    expect(generateUniverseFromDataPack(reordered, 'stable-alias')).toEqual(
      generateUniverseFromDataPack(sample, 'stable-alias'),
    );
    const alias = clone();
    alias.clubs[0]!.name = 'Otro patrocinador de ejemplo';
    const a = generateUniverseFromDataPack(sample, 'stable-alias');
    const b = generateUniverseFromDataPack(alias, 'stable-alias');
    expect(sporting(a)).toEqual(sporting(b));
    const first = simulateSeason(a),
      second = simulateSeason(b);
    expect(first.season).toEqual(second.season);
    expect(sporting(first.universe)).toEqual(sporting(second.universe));
    expect(a.teams[0]!.identity?.referenceName).toBe(b.teams[0]!.identity?.referenceName);
  });
  it('maps definitions by competition and keeps identities after promotion and relegation', () => {
    const pack = clone();
    const upper = pack.config.levels[0]!;
    upper.teamCount = 4;
    upper.relegationSlots = 1;
    pack.config.levels.push({
      ...structuredClone(upper),
      competitionId: 'example-lower',
      name: 'Liga de ejemplo inferior',
      level: 2,
      promotionSlots: 1,
      relegationSlots: 0,
    });
    pack.clubs.forEach((club, index) => {
      club.competitionId = index < 4 ? upper.competitionId : 'example-lower';
    });
    pack.clubs.reverse();
    const world = generateUniverseFromDataPack(pack, 'defined-movement');
    for (const competition of world.competitions)
      expect(competition.teamIds.slice().sort()).toEqual(
        pack.clubs
          .filter((c) => c.competitionId === competition.id)
          .map((c) => c.id)
          .sort(),
      );
    const next = simulateSeason(world);
    expect(next.season.competitions[0]!.relegatedTeamIds).toHaveLength(1);
    expect(next.season.competitions[1]!.promotedTeamIds).toHaveLength(1);
    expect(next.universe.teams.map((t) => [t.id, t.identity])).toEqual(
      world.teams.map((t) => [t.id, t.identity]),
    );
  });
  it('rejects missing clubs, duplicate IDs and source identities, and unknown competitions or regions with exact fields', () => {
    const missing = clone();
    missing.clubs.pop();
    expect(() => parseDataPack(missing)).toThrow(/clubs/);
    const ids = clone();
    ids.clubs[1]!.id = ids.clubs[0]!.id;
    expect(() => parseDataPack(ids)).toThrow(/clubs\[1\]/);
    const duplicate = clone();
    duplicate.clubs[1]!.identity.source = structuredClone(duplicate.clubs[0]!.identity.source);
    expect(() => parseDataPack(duplicate)).toThrow(/clubs\[1\]\.identity\.source/);
    const competition = clone();
    competition.clubs[0]!.competitionId = 'absent';
    expect(() => parseDataPack(competition)).toThrow(/clubs\[0\]\.competitionId/);
    const region = clone();
    region.clubs[0]!.region = 'absent';
    expect(() => parseDataPack(region)).toThrow(/clubs\[0\]\.region/);
    const id = clone();
    id.clubs[0]!.id = 'invalid id';
    expect(() => parseDataPack(id)).toThrow(/clubs\[0\]\.id/);
  });
  it('validates source dates and URLs without elevating unverified claims', () => {
    const pack = clone();
    expect(
      generateUniverseFromDataPack(pack, 'source-claim').teams[0]!.identity?.source?.verification,
    ).toBe('unverified');
    const badDate = clone();
    badDate.clubs[0]!.identity.source!.capturedOn = '2026-02-30';
    expect(() => parseDataPack(badDate)).toThrow(/capturedOn/);
    for (const url of ['javascript:alert(1)', 'https://user:password@example.org/source']) {
      const invalid = clone();
      invalid.clubs[0]!.identity.source!.url = url;
      expect(() => parseDataPack(invalid)).toThrow(/\.url/);
    }
    pack.clubs[0]!.identity.source!.verification = 'declared-verified';
    expect(
      generateUniverseFromDataPack(pack, 'declared-source').teams[0]!.identity?.source
        ?.verification,
    ).toBe('declared-verified');
  });
  it('upgrades a format-1 contract-7 pack without explicit clubs but never accepts new fields under an old or future version', () => {
    const old = { ...legacySample, schemaVersion: 7 };
    expect(parseDataPack(old).schemaVersion).toBe(SCHEMA_VERSION);
    expect(generateUniverseFromDataPack(old, 'compatible-pack')).toEqual(
      generateUniverseFromDataPack(legacySample, 'compatible-pack'),
    );
    expect(() => parseDataPack({ ...sample, schemaVersion: 7 })).toThrow(/schemaVersion/);
    expect(() => parseDataPack({ ...sample, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(
      /schemaVersion/,
    );
  });
  it('imports an actual checksum envelope for version 7 with null identities and no changed sporting data', () => {
    const current = generateUniverse({ seed: 'club-migration' });
    const legacy = {
      ...current,
      schemaVersion: 7,
      teams: current.teams.map(({ identity: _identity, ...team }) => team),
    };
    const checksum = `sha256:${sha256Hex(JSON.stringify(legacy))}`;
    expect(
      importSave(
        JSON.stringify({ format: 'bm27-save', schemaVersion: 7, checksum, payload: legacy }),
      ),
    ).toEqual(current);
  });
  it('does not retain mutable references to the caller’s club metadata', () => {
    const input = clone();
    const world = generateUniverseFromDataPack(input, 'immutable-club');
    input.clubs[0]!.name = 'Changed';
    input.clubs[0]!.identity.referenceName = 'Changed';
    input.clubs[0]!.identity.source!.url = 'https://example.org/changed';
    expect(world.teams[0]!.name).toBe(sample.clubs[0]!.name);
    expect(world.teams[0]!.identity).toEqual(sample.clubs[0]!.identity);
  });
});
