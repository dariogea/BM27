import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSeedCatalog } from './seedCatalog';

function argument(name: string, fallback: string): string {
  const at = process.argv.indexOf(name);
  if (at < 0) return fallback;
  const value = process.argv[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name}: falta un valor`);
  return value;
}
try {
  const source = argument(
    '--seed',
    fileURLToPath(new URL('../../data/reference/es/season-2026-27/seed.json', import.meta.url)),
  );
  const aliases = argument(
    '--aliases',
    fileURLToPath(new URL('../../data/reference/es/season-2026-27/aliases.json', import.meta.url)),
  );
  const output = argument('--out', '');
  const catalog = buildSeedCatalog(
    JSON.parse(readFileSync(source, 'utf8')),
    JSON.parse(readFileSync(aliases, 'utf8')),
  );
  // Validate everything before opening an output file; never overwrite unrelated work.
  if (output) writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx' });
  console.log(
    `${catalog.competitions.length} competiciones, ${catalog.clubs.length} clubes, ${catalog.rules.length} reglas de referencia y ${catalog.sources.length} fuentes.`,
  );
  console.log(
    `${catalog.clubs.filter((c) => c.aliasApplied).length} alias; ${catalog.clubs.filter((c) => c.calendarGroupId === null).length} clubes sin subgrupo de calendario confirmado.`,
  );
  console.log('Estado: investigación; no cargable como temporada oficial.');
  const explanations: Record<string, string> = {
    'unverified-reference': 'Falta contrastar las fuentes y sus condiciones de uso.',
    'incomplete-format': 'Las reglas son evidencia textual; falta el reglamento ejecutable.',
    'loader-required': 'Pendiente el cargador de paquetes (#21) y el soporte de grupos explícitos.',
    'missing-calendar-groups': 'No están confirmados los subgrupos de calendario de Tercera FEB.',
  };
  for (const blocker of catalog.blockers)
    console.log(`- ${blocker.code}: ${explanations[blocker.code] ?? blocker.detail}`);
  if (output) console.log(`Catálogo escrito en ${output}`);
} catch (error) {
  console.error(
    `No se pudo preparar el catálogo: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
