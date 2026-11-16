/**
 * Performance benchmarks. Run with:  pnpm bench
 * Writes real measurements to docs/benchmarks/<TASK>.md. Older files are kept
 * as a historical record of each task.
 */
import { writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exportSave,
  generateUniverse,
  importSave,
  simulateCompetitionSeason,
  simulateSeason,
} from '@bm27/core';

const TASK = 'T-006';
const ENGINE_LABEL =
  'v1 con jugadores que se desarrollan (T-004) mercado (T-005) y finanzas (T-006), entrenador PLACEHOLDER';
const SEED = 'bench-t001';
const SEASONS = 10;
const REPEATS = 5;

const gc = (globalThis as { gc?: () => void }).gc;
function heapMb(): number {
  gc?.();
  gc?.();
  return process.memoryUsage().heapUsed / 1024 / 1024;
}
function time<T>(fn: () => T): { ms: number; value: T } {
  const start = performance.now();
  const value = fn();
  return { ms: performance.now() - start, value };
}
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
};
const f0 = (n: number): string => n.toFixed(0);
const f1 = (n: number): string => n.toFixed(1);
const f2 = (n: number): string => n.toFixed(2);

console.log('Generando universo...');
const generation = time(() => generateUniverse({ seed: SEED }));
const universe0 = generation.value;

// Warm-up so that the JIT compiler does not distort the first measurement.
simulateCompetitionSeason(universe0, 'es-l1');

// --- B1: one full season of level 1 ----------------------------------------
console.log('B1...');
const b1Runs: number[] = [];
let b1Matches = 0;
for (let i = 0; i < REPEATS; i++) {
  const run = time(() => simulateCompetitionSeason(universe0, 'es-l1'));
  b1Runs.push(run.ms);
  b1Matches = run.value.matches.length;
}

// --- B2: one full season of the whole universe -------------------------------
console.log('B2...');
const b2Runs: number[] = [];
let b2Matches = 0;
for (let i = 0; i < REPEATS; i++) {
  const run = time(() => simulateSeason(universe0));
  b2Runs.push(run.ms);
  b2Matches = run.value.season.competitions.reduce((n, c) => n + c.matches.length, 0);
}

// --- B3: ten consecutive seasons ---------------------------------------------
console.log('B3...');
const heapStart = heapMb();
const rssStart = process.memoryUsage().rss / 1024 / 1024;
let universe = universe0;
const seasonMs: number[] = [];
const heapAfter: number[] = [];
for (let i = 0; i < SEASONS; i++) {
  const run = time(() => simulateSeason(universe));
  universe = run.value.universe;
  seasonMs.push(run.ms);
  heapAfter.push(heapMb());
}
const heapEnd = heapAfter[heapAfter.length - 1] as number;
const rssEnd = process.memoryUsage().rss / 1024 / 1024;
const totalMatches = universe.history.reduce(
  (n, s) => n + s.competitions.reduce((m, c) => m + c.matches.length, 0),
  0,
);

// --- B4: save size after ten seasons -----------------------------------------
console.log('B4...');
const exported = time(() => exportSave(universe));
const saveBytes = Buffer.byteLength(exported.value, 'utf8');
const imported = time(() => importSave(exported.value));
const freshBytes = Buffer.byteLength(exportSave(universe0), 'utf8');
if (imported.value.seasonNumber !== universe.seasonNumber) throw new Error('import mismatch');

const cpu = cpus();
const lines = [
  `# Benchmarks ${TASK}`,
  '',
  '> Archivo generado automáticamente por `pnpm bench`. Las cifras son mediciones reales de la',
  '> ejecución indicada abajo, no estimaciones. Para repetirlas: `pnpm install && pnpm bench`.',
  '',
  '## Entorno de la medición',
  '',
  `- Fecha: ${new Date().toISOString()}`,
  `- CPU: ${cpu[0]?.model ?? 'desconocida'} · ${cpu.length} núcleos lógicos (la simulación usa 1 solo hilo)`,
  `- Memoria RAM total: ${f1(totalmem() / 1024 ** 3)} GB`,
  `- Sistema: ${platform()} ${release()} (${arch()}), contenedor en la nube (máquina virtual compartida)`,
  `- Node.js ${process.version} · ejecutado con \`tsx\` (TypeScript sin compilar previamente)`,
  `- Semilla: \`${SEED}\` · Universo: ${universe0.teams.length} equipos, ${universe0.players.length} jugadores (generado en ${f0(generation.ms)} ms)`,
  `- Motor de partido: ${ENGINE_LABEL}. Misma semilla y mismas pruebas que en T-001 para poder comparar.`,
  '',
  '## Resultados',
  '',
  '| Prueba | Qué mide | Resultado |',
  '| --- | --- | --- |',
  `| B1 | Temporada completa del nivel 1 (${b1Matches} partidos, liga + playoffs) | **${f0(median(b1Runs))} ms** (mediana de ${REPEATS}; mín ${f0(Math.min(...b1Runs))}, máx ${f0(Math.max(...b1Runs))}) |`,
  `| B2 | Temporada completa de todo el universo (${b2Matches} partidos) + ascensos/descensos y envejecimiento | **${f0(median(b2Runs))} ms** (mediana de ${REPEATS}; mín ${f0(Math.min(...b2Runs))}, máx ${f0(Math.max(...b2Runs))}) |`,
  `| B3 | ${SEASONS} temporadas seguidas de todo el universo (${totalMatches} partidos) | **${f2(seasonMs.reduce((a, b) => a + b, 0) / 1000)} s** en total · media ${f0(seasonMs.reduce((a, b) => a + b, 0) / SEASONS)} ms por temporada |`,
  `| B3 | Memoria (heap de JavaScript tras recolección de basura) | inicio **${f1(heapStart)} MB** → final **${f1(heapEnd)} MB** |`,
  `| B4 | Tamaño del guardado JSON tras ${SEASONS} temporadas | **${f2(saveBytes / 1024 / 1024)} MB** (${saveBytes.toLocaleString('es-ES')} bytes) |`,
  '',
  `Velocidad media en B2: ${f0(b2Matches / (median(b2Runs) / 1000))} partidos por segundo en un solo hilo (cada partido genera su registro completo de eventos y de él se deriva el box score).`,
  '',
  '### B3 · Detalle por temporada',
  '',
  '| Temporada | Tiempo (ms) | Heap tras la temporada (MB) |',
  '| --- | --- | --- |',
  ...seasonMs.map((ms, i) => `| ${i + 1} | ${f0(ms)} | ${f1(heapAfter[i] as number)} |`),
  '',
  `- Tiempo: la temporada más lenta fue ${f0(Math.max(...seasonMs))} ms y la más rápida ${f0(Math.min(...seasonMs))} ms. La temporada 10 tardó ${f0(seasonMs[SEASONS - 1] as number)} ms frente a ${f0(seasonMs[0] as number)} ms de la primera.`,
  `- Memoria: crece ${f1((heapEnd - heapStart) / SEASONS)} MB por temporada de media. Ese crecimiento es el historial que se conserva a propósito (resultados de todos los partidos, clasificaciones y estadísticas de temporada por jugador), no una fuga: es proporcional al tamaño del guardado.`,
  `- Memoria total del proceso (RSS, incluye Node y el compilador): ${f0(rssStart)} MB al inicio de B3 → ${f0(rssEnd)} MB al final.`,
  '',
  '### B4 · Detalle del guardado',
  '',
  `- Universo recién generado (0 temporadas): ${f2(freshBytes / 1024 / 1024)} MB.`,
  `- Tras ${SEASONS} temporadas: ${f2(saveBytes / 1024 / 1024)} MB → unas ${f2((saveBytes - freshBytes) / SEASONS / 1024 / 1024)} MB por temporada.`,
  `- Exportar (serializar + checksum SHA-256): ${f0(exported.ms)} ms. Importar (leer + verificar checksum + validar esquema): ${f0(imported.ms)} ms.`,
  '- Qué contiene: equipos, jugadores (incluidos los retirados), competiciones y, por cada temporada, clasificaciones, resultado de cada partido, series de playoff y estadísticas acumuladas por jugador.',
  '- Qué NO contiene: el registro de eventos ni el box score de cada partido. Se pueden reconstruir de forma idéntica re-simulando el partido con su semilla mientras la temporada esté en curso, pero no se guardan. JSON sin comprimir ni sangrado.',
  '',
  '## Comparación con tareas anteriores',
  '',
  '| Prueba | T-001 | T-002 | T-004 | T-005 | Ahora |',
  '| --- | --- | --- | --- | --- | --- |',
  `| B1 · temporada del nivel 1 | 143 ms | 209 ms | 215 ms | 208 ms | ${f0(median(b1Runs))} ms |`,
  `| B2 · temporada de todo el universo | 1260 ms | 1732 ms | 2003 ms | 2000 ms | ${f0(median(b2Runs))} ms |`,
  `| B3 · 10 temporadas | 12,14 s | 19,32 s | 20,92 s | 21,68 s | ${f2(seasonMs.reduce((a, b) => a + b, 0) / 1000)} s |`,
  `| B3 · memoria al final | 28,2 MB | 29,7 MB | 32,8 MB | 31,7 MB | ${f1(heapEnd)} MB |`,
  `| B4 · guardado tras 10 temporadas | 13,89 MB | 15,60 MB | 15,87 MB | 16,29 MB | ${f2(saveBytes / 1024 / 1024)} MB |`,
  '',
  'Las cifras anteriores son las registradas en `T-001.md`, `T-002.md`, `T-004.md` y `T-005.md`, medidas en un contenedor equivalente pero en otra ejecución; la comparación es orientativa. T-002 es anterior a la temporada paso a paso (T-003) y a la progresión de jugadores (T-004).',
  '',
  'La calibración del motor (medias de liga frente a bandas de referencia) está en `T-006-calibracion.md`, y la estabilidad a largo plazo del mundo en `T-006-estabilidad.md`.',
  '',
];

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', '..', '..', 'docs', 'benchmarks', `${TASK}.md`);
writeFileSync(outFile, lines.join('\n'));
console.log(`\n${lines.join('\n')}\nEscrito en ${outFile}`);
