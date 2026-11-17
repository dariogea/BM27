/** Reproducible sporting fingerprints for before/after performance comparisons. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  BUILTIN_RULESETS,
  exportSave,
  generateUniverse,
  generateUniverseFromDataPack,
  playMatch,
  prepareTeam,
  simulateSeason,
} from '@bm27/core';
import type { Universe } from '@bm27/schema';

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rows: { case: string; hash: string }[] = [];
for (const seed of ['bench-t001', 'incidents-506', 'performance-18']) {
  let world = generateUniverse({ seed });
  rows.push({ case: `${seed}/generation`, hash: hash(world) });
  const players = new Map(world.players.map((p) => [p.id, p]));
  const prepared = world.teams.slice(0, 20).map((team) => prepareTeam(team, players));
  for (let index = 0; index < 100; index++) {
    const home = prepared[index % prepared.length]!;
    const away = prepared[(index + 7) % prepared.length]!;
    const rule = BUILTIN_RULESETS[index % BUILTIN_RULESETS.length]!;
    rows.push({
      case: `${seed}/match/${index}`,
      hash: hash(playMatch(home, away, rule, `${seed}/perf/${index}`)),
    });
  }
  for (let season = 1; season <= 2; season++) {
    const outcome = simulateSeason(world);
    rows.push({ case: `${seed}/season/${season}`, hash: hash(outcome) });
    world = outcome.universe;
    rows.push({ case: `${seed}/save/${season}`, hash: hash(exportSave(world)) });
  }
}
const sample = JSON.parse(
  readFileSync(new URL('../../../data/packs/example-eight-clubs.json', import.meta.url), 'utf8'),
) as unknown;
let custom: Universe = generateUniverseFromDataPack(sample, 'performance-18-pack');
for (let season = 1; season <= 2; season++) {
  const outcome = simulateSeason(custom);
  rows.push({ case: `custom/season/${season}`, hash: hash(outcome) });
  custom = outcome.universe;
}
console.log(JSON.stringify(rows, null, 2));
