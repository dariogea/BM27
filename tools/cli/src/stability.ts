/**
 * Long-run stability check of the player development model and the transfer market. Run with:
 *   pnpm stability [--seasons 30] [--write]
 * Simulates many consecutive seasons and reports, per season, how the quality
 * and age of the world evolve. A healthy model keeps all of them flat.
 */
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  freeAgents,
  generateUniverse,
  playerAbility,
  simulateSeason,
  startSeason,
  teamPayroll,
} from '@bm27/core';
import type { Universe } from '@bm27/schema';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}
const SEASONS = Number(arg('seasons', '30'));
const SEED = arg('seed', 'stability-t004');

interface Row {
  season: number;
  abilityByLevel: number[];
  topByLevel: number[];
  age: number;
  under22: number;
  over32: number;
  retirements: number;
  potential: number;
  ms: number;
  freeAgents: number;
  /** Average payroll as a share of the cap, by level. */
  payrollShare: number[];
  signed: number;
  expired: number;
  renewed: number;
}

function measure(universe: Universe, season: number, retirements: number, ms: number): Row {
  const payrollShare = [...universe.competitions]
    .sort((a, b) => a.level - b.level)
    .map(
      (c) =>
        c.teamIds.reduce((sum, id) => sum + teamPayroll(universe, id) / c.salaryCap, 0) /
        c.teamIds.length,
    );
  const moves = (type: string): number =>
    universe.transactions.filter((t) => t.seasonNumber === universe.seasonNumber && t.type === type)
      .length;
  const players = new Map(universe.players.map((p) => [p.id, p]));
  const teams = new Map(universe.teams.map((t) => [t.id, t]));
  const levels = [...universe.competitions].sort((a, b) => a.level - b.level);
  const abilityByLevel: number[] = [];
  const topByLevel: number[] = [];
  let ageSum = 0;
  let potentialSum = 0;
  let count = 0;
  let young = 0;
  let old = 0;
  for (const competition of levels) {
    let sum = 0;
    let n = 0;
    let top = 0;
    let topN = 0;
    for (const teamId of competition.teamIds) {
      const squad = (teams.get(teamId) as { playerIds: string[] }).playerIds
        .map((id) => players.get(id)!)
        .map((p) => ({ p, a: playerAbility(p) }))
        .sort((x, y) => y.a - x.a);
      squad.forEach(({ p, a }, i) => {
        sum += a;
        n++;
        ageSum += p.age;
        potentialSum += p.potential;
        count++;
        if (p.age < 22) young++;
        if (p.age > 32) old++;
        if (i < 10) {
          top += a;
          topN++;
        }
      });
    }
    abilityByLevel.push(sum / n);
    topByLevel.push(top / topN);
  }
  return {
    season,
    abilityByLevel,
    topByLevel,
    age: ageSum / count,
    under22: (100 * young) / count,
    over32: (100 * old) / count,
    retirements,
    potential: potentialSum / count,
    ms,
    freeAgents: freeAgents(universe).length,
    payrollShare,
    signed: moves('signed'),
    expired: moves('expired'),
    renewed: moves('renewed'),
  };
}

let universe = generateUniverse({ seed: SEED });
// Everything is measured with the market closed (rosters as they are when the season starts).
const rows: Row[] = [measure(startSeason(universe), 0, 0, 0)];
let careerPeak = { age: 0, ability: 0 };
/** Ability relative to the average of the player's own level, by age. */
const byAge = new Map<number, { sum: number; n: number }>();
for (let i = 1; i <= SEASONS; i++) {
  const before = new Set(universe.players.filter((p) => !p.retired).map((p) => p.id));
  const start = performance.now();
  universe = simulateSeason(universe).universe;
  const ms = performance.now() - start;
  const retired = universe.players.filter((p) => p.retired && before.has(p.id)).length;
  rows.push(measure(startSeason(universe), i, retired, ms));
  process.stdout.write(`\rTemporada ${i}/${SEASONS}`);
}
process.stdout.write('\n');
// Career curve of the final world: ability relative to the player's own level.
{
  const teamLevel = new Map<string, number>();
  for (const c of universe.competitions) for (const id of c.teamIds) teamLevel.set(id, c.level);
  const levelMean = new Map<number, { sum: number; n: number }>();
  const active = universe.players.filter((p) => !p.retired && p.teamId);
  for (const p of active) {
    const level = teamLevel.get(p.teamId as string) as number;
    const entry = levelMean.get(level) ?? { sum: 0, n: 0 };
    entry.sum += playerAbility(p);
    entry.n++;
    levelMean.set(level, entry);
  }
  for (const p of active) {
    const level = teamLevel.get(p.teamId as string) as number;
    const mean = levelMean.get(level) as { sum: number; n: number };
    const entry = byAge.get(p.age) ?? { sum: 0, n: 0 };
    entry.sum += playerAbility(p) - mean.sum / mean.n;
    entry.n++;
    byAge.set(p.age, entry);
  }
  for (const [age, { sum, n }] of byAge) {
    if (n >= 15 && sum / n > careerPeak.ability) careerPeak = { age, ability: sum / n };
  }
}

const f1 = (n: number): string => n.toFixed(1);
const names = [...universe.competitions]
  .sort((a, b) => a.level - b.level)
  .map((c) => `N${c.level}`);
const first = rows[0] as Row;
const last = rows[rows.length - 1] as Row;
const lines: string[] = [
  '# Estabilidad del mundo: desarrollo de jugadores y mercado (T-005)',
  '',
  `> Generado por \`pnpm stability --write\`. Universo con semilla \`${SEED}\`, ${SEASONS} temporadas`,
  `> seguidas (con ascensos, descensos, retiradas y sustitución por jóvenes). Entorno: ${cpus()[0]?.model ?? 'desconocida'}, Node ${process.version}.`,
  '',
  '## Qué se mide',
  '',
  'La «habilidad» de un jugador es la media de sus 20 atributos (escala 1–99). Un modelo sano mantiene',
  'estables la habilidad media de cada nivel, la edad media y el reparto de edades; si se inflan o se',
  'hunden, las estadísticas de la liga se desvían con los años.',
  '',
  '## Resumen',
  '',
  '| Magnitud | Temporada 0 | Temporada ' + SEASONS + ' | Cambio |',
  '| --- | --- | --- | --- |',
  ...names.map(
    (n, i) =>
      `| Habilidad media ${n} | ${f1(first.abilityByLevel[i] as number)} | ${f1(last.abilityByLevel[i] as number)} | ${((last.abilityByLevel[i] as number) - (first.abilityByLevel[i] as number)).toFixed(1)} |`,
  ),
  ...names.map(
    (n, i) =>
      `| Habilidad media de los 10 mejores por equipo ${n} | ${f1(first.topByLevel[i] as number)} | ${f1(last.topByLevel[i] as number)} | ${((last.topByLevel[i] as number) - (first.topByLevel[i] as number)).toFixed(1)} |`,
  ),
  `| Edad media | ${f1(first.age)} | ${f1(last.age)} | ${(last.age - first.age).toFixed(1)} |`,
  `| % menores de 22 | ${f1(first.under22)} | ${f1(last.under22)} | ${(last.under22 - first.under22).toFixed(1)} |`,
  `| % mayores de 32 | ${f1(first.over32)} | ${f1(last.over32)} | ${(last.over32 - first.over32).toFixed(1)} |`,
  `| Potencial medio | ${f1(first.potential)} | ${f1(last.potential)} | ${(last.potential - first.potential).toFixed(1)} |`,
  '',
  `Mercado (media de las temporadas 1–${SEASONS}): ${f1(rows.slice(1).reduce((s, r) => s + r.expired, 0) / SEASONS)} contratos cumplidos y no renovados, ${f1(rows.slice(1).reduce((s, r) => s + r.renewed, 0) / SEASONS)} renovaciones y ${f1(rows.slice(1).reduce((s, r) => s + r.signed, 0) / SEASONS)} fichajes de agentes libres por temporada.`,
  `Agentes libres al final de cada temporada: media ${f1(rows.slice(1).reduce((s, r) => s + r.freeAgents, 0) / SEASONS)} (mínimo ${Math.min(...rows.slice(1).map((r) => r.freeAgents))}, máximo ${Math.max(...rows.slice(1).map((r) => r.freeAgents))}).`,
  `Masa salarial media respecto al tope, temporada 0 → ${SEASONS}: ${names.map((n, i) => `${n} ${(100 * (first.payrollShare[i] as number)).toFixed(0)} % → ${(100 * (last.payrollShare[i] as number)).toFixed(0)} %`).join(', ')}.`,
  `Retiradas por temporada (media de las temporadas 1–${SEASONS}): ${f1(rows.slice(1).reduce((s, r) => s + r.retirements, 0) / SEASONS)} jugadores de ${universe.teams.length} equipos.`,
  `Edad en la que la habilidad media es máxima (mundo final, edades con 15 o más jugadores): ${careerPeak.age} años.`,
  '',
  '## Curva de carrera (mundo final)',
  '',
  'Habilidad de los jugadores de cada edad **respecto a la media de su nivel** (0 = media del nivel).',
  '',
  '| Edad | Jugadores | Habilidad relativa |',
  '| --- | --- | --- |',
  ...[...byAge.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([age, { sum, n }]) => `| ${age} | ${n} | ${(sum / n).toFixed(1)} |`),
  '',
  '## Evolución temporada a temporada',
  '',
  `| Temp. | ${names.map((n) => `Hab. ${n}`).join(' | ')} | Edad | <22 % | >32 % | Retiros | Agentes libres | Masa/tope N1 % | Tiempo (ms) |`,
  `| --- | ${names.map(() => '---').join(' | ')} | --- | --- | --- | --- | --- | --- | --- |`,
  ...rows.map(
    (r) =>
      `| ${r.season} | ${r.abilityByLevel.map(f1).join(' | ')} | ${f1(r.age)} | ${f1(r.under22)} | ${f1(r.over32)} | ${r.season ? r.retirements : '–'} | ${r.freeAgents} | ${(100 * (r.payrollShare[0] as number)).toFixed(0)} | ${r.season ? Math.round(r.ms) : '–'} |`,
  ),
  '',
];
console.log(lines.slice(0, 40).join('\n'));
if (process.argv.includes('--write')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = join(here, '..', '..', '..', 'docs', 'benchmarks', 'T-005-estabilidad.md');
  writeFileSync(file, lines.join('\n'));
  console.log(`\nEscrito en ${file}`);
}
