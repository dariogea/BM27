/**
 * Headless simulation from the command line.
 *
 *   pnpm sim --seed demo --seasons 3 --out saves/demo.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { exportSave, generateUniverse, simulateSeason } from '@bm27/core';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const seed = arg('seed', 'bm27');
const seasons = Number(arg('seasons', '1'));
const out = arg('out', '');
if (!Number.isInteger(seasons) || seasons < 1) {
  console.error('--seasons debe ser un número entero mayor que 0');
  process.exit(1);
}

let universe = generateUniverse({ seed });
const teamName = new Map(universe.teams.map((t) => [t.id, t.name]));
console.log(
  `Universo generado con semilla "${seed}": ${universe.teams.length} equipos, ${universe.players.length} jugadores.`,
);

for (let i = 0; i < seasons; i++) {
  const start = performance.now();
  const outcome = simulateSeason(universe);
  universe = outcome.universe;
  const ms = Math.round(performance.now() - start);
  console.log(`\nTemporada ${outcome.season.seasonNumber} (${ms} ms)`);
  for (const competition of outcome.season.competitions) {
    const name = universe.competitions.find((c) => c.id === competition.competitionId)?.name;
    console.log(
      `  ${name}: campeón ${teamName.get(competition.championTeamId)} · ${competition.matches.length} partidos`,
    );
    if (competition.promotedTeamIds.length > 0) {
      console.log(
        `    Ascienden: ${competition.promotedTeamIds.map((t) => teamName.get(t)).join(', ')}`,
      );
    }
    if (competition.relegatedTeamIds.length > 0) {
      console.log(
        `    Descienden: ${competition.relegatedTeamIds.map((t) => teamName.get(t)).join(', ')}`,
      );
    }
  }
}

if (out) {
  // INIT_CWD is the folder where the user typed the command (pnpm changes cwd).
  const path = resolve(process.env.INIT_CWD ?? process.cwd(), out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, exportSave(universe));
  console.log(`\nGuardado exportado en ${path}`);
}
