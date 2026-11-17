import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import seed from '../../../data/reference/es/season-2026-27/seed.json';
import aliases from '../../../data/reference/es/season-2026-27/aliases.json';
import { buildSeedCatalog } from '../seedCatalog';

const clone = () => structuredClone(seed);
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function temporary(): string {
  const path = mkdtempSync(join(tmpdir(), 'bm27-seed-'));
  directories.push(path);
  return path;
}

describe('Spanish reference catalog', () => {
  it('keeps the complete reference, including evidence that lacks a source-directory entry', () => {
    const result = buildSeedCatalog(seed, aliases);
    expect(result.status).toBe('research-only');
    expect(result.competitions.map((c) => c.teamCount)).toEqual([18, 18, 28, 138]);
    expect(result.clubs).toHaveLength(202);
    expect(result.rules).toHaveLength(34);
    expect(result.sources).toHaveLength(30);
    expect(result.rules.find((r) => r.id === 'RL-013')).toMatchObject({
      sourceUrl: 'https://www.feb.es/primerafeb/',
      sourceIds: [],
    });
    expect(result.blockers.find((b) => b.code === 'unindexed-rule-source')?.detail).toContain(
      'RL-013',
    );
    expect(result.sources[0]).toMatchObject({
      documentDate: '2026-11-17',
      claimedVerification: 'consultado',
    });
  });

  it('does not invent calendar subgroups from the five conferences', () => {
    const result = buildSeedCatalog(seed);
    const p3 = result.clubs.filter((c) => c.sourceId.startsWith('P3-'));
    expect(p3).toHaveLength(138);
    expect(
      p3.every((c) => c.calendarGroupId === null && c.publishedGrouping.kind === 'conference'),
    ).toBe(true);
    expect(p3.filter((c) => c.publishedGrouping.code === 'D')).toHaveLength(26);
    const p2 = result.clubs.filter((c) => c.sourceId.startsWith('P2-'));
    expect(p2.filter((c) => c.publishedGrouping.code === 'A')).toHaveLength(14);
    expect(new Set(p2.map((c) => c.calendarGroupId)).size).toBe(2);
    expect(p2.every((c) => c.publishedGrouping.kind === 'regular-season-group')).toBe(true);
  });

  it('keeps IDs and evidence independent of alias, public-name changes and source order', () => {
    const initial = buildSeedCatalog(seed);
    const changed = clone();
    changed.teams.find((t) => t.id === 'ACB-X-012')!.publicName = 'New public sponsor name';
    const renamed = buildSeedCatalog(changed, aliases);
    const before = initial.clubs.find((c) => c.sourceId === 'ACB-X-012')!;
    const after = renamed.clubs.find((c) => c.sourceId === 'ACB-X-012')!;
    expect(after.id).toBe(before.id);
    expect(after.displayName).toBe('Real Chamartín Baloncesto');
    expect(after.referenceName).toBe('New public sponsor name');
    expect(after.sourceIds).toEqual(before.sourceIds);
    const reordered = clone();
    reordered.teams.reverse();
    reordered.rules.reverse();
    reordered.competitions.reverse();
    reordered.sources.reverse();
    reordered.cautions.reverse();
    expect(buildSeedCatalog(reordered)).toEqual(initial);
    expect(seed.teams.find((t) => t.id === 'ACB-X-012')!.publicName).toBe('REAL MADRID');
  });

  it('rejects duplicate IDs even when display aliases differ', () => {
    const changed = clone();
    changed.teams[1]!.id = changed.teams[0]!.id;
    expect(() => buildSeedCatalog(changed)).toThrow(/duplicate identifier/);
  });

  it('rejects dangling references, wrong counts and contradictory rule evidence', () => {
    const unknown = clone();
    unknown.teams[0]!.competitionId = 'unknown';
    expect(() => buildSeedCatalog(unknown)).toThrow(/unknown competition/);
    const missing = clone();
    missing.teams.pop();
    expect(() => buildSeedCatalog(missing)).toThrow(/declared 138 clubs/);
    const rule = clone();
    rule.rules[0]!.value = '20';
    expect(() => buildSeedCatalog(rule)).toThrow(/evidence contradicts/);
    const groups = clone();
    groups.rules.find((r) => r.key === 'conferencias')!.value = '10';
    expect(() => buildSeedCatalog(groups)).toThrow(/grouping evidence contradicts/);
  });

  it('rejects invalid, future or unmapped reference data', () => {
    const invalid = clone();
    invalid.teams[0]!.capturedOn = '2026-02-30';
    expect(() => buildSeedCatalog(invalid)).toThrow(/invalid ISO date/);
    const future = clone();
    future.teams[0]!.capturedOn = '2027-01-01';
    expect(() => buildSeedCatalog(future)).toThrow(/later than seed cutoff/);
    const url = clone();
    url.teams[0]!.sourceUrl = 'file:///private';
    expect(() => buildSeedCatalog(url)).toThrow(/HTTP/);
    const missing = clone();
    missing.teams[0]!.sourceUrl = 'https://example.test/unlisted';
    expect(() => buildSeedCatalog(missing)).toThrow(/absent from source catalog/);
  });

  it('rejects missing-person safeguards, unknown aliases, empty aliases and ambiguous display names', () => {
    expect(() => buildSeedCatalog({ ...seed, players: [] })).toThrow(/person records/);
    expect(() => buildSeedCatalog(seed, { version: 1, clubs: { unknown: 'Name' } })).toThrow(
      /unknown club/,
    );
    expect(() => buildSeedCatalog(seed, { version: 1, clubs: { 'ACB-X-012': ' ' } })).toThrow(
      /nonempty text/,
    );
    expect(() => buildSeedCatalog(seed, { version: 1, clubs: { 'ACB-X-012': 'BARÇA' } })).toThrow(
      /duplicate identifier/,
    );
  });

  it('validates before writing and refuses to overwrite existing work through the CLI', () => {
    const dir = temporary();
    const path = join(dir, 'catalog.json');
    const command = ['--import', 'tsx', 'tools/data/build-seed-catalog.ts', '--out', path];
    execFileSync(process.execPath, command, { encoding: 'utf8' });
    const saved = readFileSync(path, 'utf8');
    expect(JSON.parse(saved).clubs).toHaveLength(202);
    expect(spawnSync(process.execPath, command).status).toBe(1);
    expect(readFileSync(path, 'utf8')).toBe(saved);
    const bad = join(dir, 'invalid.json');
    writeFileSync(bad, JSON.stringify({ ...seed, teams: [] }));
    const output = join(dir, 'not-created.json');
    expect(
      spawnSync(process.execPath, [
        '--import',
        'tsx',
        'tools/data/build-seed-catalog.ts',
        '--seed',
        bad,
        '--out',
        output,
      ]).status,
    ).toBe(1);
    expect(existsSync(output)).toBe(false);
  });
});
