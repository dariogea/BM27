/**
 * Calibration report for the match engine. Run with:  pnpm calibrate
 * Simulates the regular season of each level and prints (and optionally
 * writes) league averages next to their reference targets.
 *
 *   pnpm calibrate            → prints the report
 *   pnpm calibrate --write    → also writes docs/benchmarks/T-004-calibracion.md
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateUniverse, simulateCompetitionSeason } from '@bm27/core';
import type { MatchDetail, PlayType, ShotZone } from '@bm27/schema';
import { PLAY_TYPES, SHOT_ZONES } from '@bm27/schema';

const SEED = 'calibration-t002'; // same universe seed as in T-002, to compare

/**
 * Reference values per team per 40 minutes for top-level FIBA-rules leagues.
 * APPROXIMATE: from general knowledge of recent European top-league averages,
 * not from a verified dataset. [low, high] is the band considered acceptable.
 */
export const TARGETS: Record<string, [number, number]> = {
  Posesiones: [69, 75],
  Puntos: [77, 87],
  '% tiros de campo': [44, 49],
  '% triples': [33.5, 38.5],
  '% de tiros que son triples': [36, 46],
  'Tiros libres intentados': [15, 21],
  '% tiros libres': [72, 80],
  '% rebote ofensivo': [26, 32],
  Asistencias: [16, 21],
  Robos: [5.5, 8],
  Tapones: [2, 3.6],
  Pérdidas: [11.5, 14.5],
  'Faltas personales': [17.5, 22],
  '% victorias locales': [55, 64],
};

interface Totals {
  games: number;
  homeWins: number;
  overtime: number;
  possessions: number;
  points: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  playUses: Record<PlayType, number>;
  playPoints: Record<PlayType, number>;
  zoneAttempts: Record<ShotZone, number>;
  zoneMade: Record<ShotZone, number>;
  minutesByRank: number[];
  playersUsed: number;
}

function emptyTotals(): Totals {
  const zero = <K extends string>(keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  return {
    games: 0,
    homeWins: 0,
    overtime: 0,
    possessions: 0,
    points: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    orb: 0,
    drb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    playUses: zero(PLAY_TYPES),
    playPoints: zero(PLAY_TYPES),
    zoneAttempts: zero(SHOT_ZONES),
    zoneMade: zero(SHOT_ZONES),
    minutesByRank: new Array<number>(15).fill(0),
    playersUsed: 0,
  };
}

function collect(t: Totals, d: MatchDetail): void {
  if (d.result.stage !== 'regular') return;
  t.games++;
  if (d.result.homeScore > d.result.awayScore) t.homeWins++;
  if (d.result.overtimePeriods > 0) t.overtime++;
  for (const team of [d.boxScore.home, d.boxScore.away]) {
    const s = team.totals;
    t.possessions += team.possessions;
    t.points += s.points;
    t.fgm += s.fieldGoalsMade;
    t.fga += s.fieldGoalsAttempted;
    t.tpm += s.threePointersMade;
    t.tpa += s.threePointersAttempted;
    t.ftm += s.freeThrowsMade;
    t.fta += s.freeThrowsAttempted;
    t.orb += s.offensiveRebounds;
    t.drb += s.defensiveRebounds;
    t.ast += s.assists;
    t.stl += s.steals;
    t.blk += s.blocks;
    t.tov += s.turnovers;
    t.pf += s.fouls;
    const minutes = team.players.map((p) => p.seconds / 60).sort((a, b) => b - a);
    minutes.forEach((m, i) => {
      if (i < 15) t.minutesByRank[i] = (t.minutesByRank[i] as number) + m;
    });
    t.playersUsed += minutes.filter((m) => m > 0).length;
  }
  // Play-type usage: a possession-ending action (shot, turnover) per play type.
  let lastShot: { playType: PlayType; possession: number } | null = null;
  for (const e of d.events) {
    if (e.type === 'shot') {
      t.playUses[e.playType]++;
      t.playPoints[e.playType] += e.points;
      t.zoneAttempts[e.zone]++;
      if (e.made) t.zoneMade[e.zone]++;
      lastShot = { playType: e.playType, possession: e.possession };
    } else if (e.type === 'turnover') {
      t.playUses[e.playType]++;
    } else if (e.type === 'free_throw' && e.made && lastShot?.possession === e.possession) {
      t.playPoints[lastShot.playType]++;
    }
  }
}

const f1 = (n: number): string => n.toFixed(1);

function report(levelName: string, t: Totals, withTargets: boolean): string[] {
  const g = t.games * 2;
  const rows: [string, number][] = [
    ['Posesiones', t.possessions / g],
    ['Puntos', t.points / g],
    ['% tiros de campo', (100 * t.fgm) / t.fga],
    ['% triples', (100 * t.tpm) / t.tpa],
    ['% de tiros que son triples', (100 * t.tpa) / t.fga],
    ['Tiros libres intentados', t.fta / g],
    ['% tiros libres', (100 * t.ftm) / t.fta],
    ['% rebote ofensivo', (100 * t.orb) / (t.orb + t.drb)],
    ['Asistencias', t.ast / g],
    ['Robos', t.stl / g],
    ['Tapones', t.blk / g],
    ['Pérdidas', t.tov / g],
    ['Faltas personales', t.pf / g],
    ['% victorias locales', (100 * t.homeWins) / t.games],
  ];
  const lines = [`### ${levelName} (${t.games} partidos de liga regular)`, ''];
  if (withTargets) {
    lines.push(
      '| Magnitud (por equipo y partido) | Medido | Banda de referencia | ¿Dentro? |',
      '| --- | --- | --- | --- |',
    );
    for (const [name, value] of rows) {
      const [lo, hi] = TARGETS[name] as [number, number];
      lines.push(
        `| ${name} | ${f1(value)} | ${lo} – ${hi} | ${value >= lo && value <= hi ? 'sí' : '**NO**'} |`,
      );
    }
  } else {
    lines.push('| Magnitud (por equipo y partido) | Medido |', '| --- | --- |');
    for (const [name, value] of rows) lines.push(`| ${name} | ${f1(value)} |`);
  }
  lines.push(
    '',
    `Partidos con prórroga: ${f1((100 * t.overtime) / t.games)} %. Jugadores utilizados por equipo y partido: ${f1(t.playersUsed / g)}.`,
    '',
  );
  lines.push(
    `Minutos por puesto en la rotación (del que más juega al que menos): ${t.minutesByRank
      .slice(0, 12)
      .map((m) => f1(m / g))
      .join(' · ')}`,
    '',
  );

  const uses = PLAY_TYPES.reduce((n, p) => n + t.playUses[p], 0);
  lines.push('| Tipo de jugada | % de uso | Puntos por jugada |', '| --- | --- | --- |');
  for (const p of PLAY_TYPES) {
    lines.push(
      `| ${p} | ${f1((100 * t.playUses[p]) / uses)} | ${(t.playPoints[p] / t.playUses[p]).toFixed(2)} |`,
    );
  }
  const shots = SHOT_ZONES.reduce((n, z) => n + t.zoneAttempts[z], 0);
  lines.push('', '| Zona de tiro | % de los tiros | % de acierto |', '| --- | --- | --- |');
  for (const z of SHOT_ZONES) {
    lines.push(
      `| ${z} | ${f1((100 * t.zoneAttempts[z]) / shots)} | ${f1((100 * t.zoneMade[z]) / t.zoneAttempts[z])} |`,
    );
  }
  lines.push('');
  return lines;
}

const universe = generateUniverse({ seed: SEED });
const out: string[] = [
  '# Calibración del motor de partido v1 con jugadores que se desarrollan (T-004)',
  '',
  '> Archivo generado por `pnpm calibrate --write`. Cifras medidas simulando la liga regular de',
  `> cada nivel del universo con semilla \`${SEED}\`. Las bandas de referencia son **aproximadas**:`,
  '> proceden de conocimiento general de las medias de las grandes ligas europeas con reglas FIBA,',
  '> no de un conjunto de datos verificado. Solo se exigen al nivel 1.',
  '',
];
for (const competition of [...universe.competitions].sort((a, b) => a.level - b.level)) {
  const totals = emptyTotals();
  simulateCompetitionSeason(universe, competition.id, { onMatch: (d) => collect(totals, d) });
  out.push(
    ...report(`Nivel ${competition.level} · ${competition.name}`, totals, competition.level === 1),
  );
}
console.log(out.join('\n'));
if (process.argv.includes('--write')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = join(here, '..', '..', '..', 'docs', 'benchmarks', 'T-004-calibracion.md');
  writeFileSync(file, out.join('\n'));
  console.log(`Escrito en ${file}`);
}
