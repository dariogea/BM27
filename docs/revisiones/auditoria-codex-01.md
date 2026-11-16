# Auditoría Codex 01 de main

## Resumen para el propietario (5 líneas)

El juego supera las 104 pruebas automáticas actuales.
La separación entre el motor y la pantalla está bien planteada.
El mercado permite un fichaje que debería rechazar por exceso de salarios.
La repetición de un partido puede mostrar estadísticas distintas aunque coincida el resultado.
Conviene corregir ambos fallos antes de dar por fiables esas dos funciones.

**Veredicto: SANO CON RIESGOS.** Revisión dirigida, no certificación exhaustiva.

## Base, alcance y coordinación

- Fecha: 16 de noviembre de 2026.
- Commit local auditado: `a84633257e35f78fce0e951839761eb0d05541d1`.
- `git ls-remote origin HEAD` devolvió ese mismo commit durante la auditoría.
- Leídos CLAUDE.md, README.md y los documentos de docs, incluidos informes históricos.
- No se encontraron AGENTS.md ni docs/coordinacion.md en el checkout inspeccionado.
- Revisión estática del motor, preparación de plantillas, estadísticas derivadas de eventos, repetición en el Worker, acciones del mercado y guardado; apoyo en los tests existentes de determinismo, tácticas, temporadas, mercado y persistencia.
- La primera ejecución se hizo sin modificar el checkout porque GitHub devolvía `Forbidden`. Tras publicar el entorno, el acceso quedó operativo: se revisaron Issues y comentarios, se reservó #28 y se avisó a Claude en #7. Claude trabaja en la fusión automática; su PR de finanzas #6 solapa con futuras correcciones, no con este informe. Este PR solo añade el informe y su fila de estado.

## Comandos y resultados reales

Entorno: Node v24.22.1 (el proyecto admite >=22), pnpm 10.28.0, Linux. Desde `/workspace/BM27`, con `COREPACK_HOME=/workspace/.cache/corepack` y `/workspace/.bin` al principio de PATH:

| Comando                                                                                                 | Resultado de esta auditoría                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm lint`                                                                                             | Código de salida 0                                           |
| `pnpm typecheck`                                                                                        | Código de salida 0; los cuatro paquetes comprobados          |
| `pnpm test`                                                                                             | Código de salida 0; 9 archivos, 104 tests aprobados; 59,06 s |
| `node --import /workspace/BM27/node_modules/tsx/dist/loader.mjs /workspace/bm27-audit-pending/repro.ts` | Código de salida 0; reproduce los dos casos descritos abajo  |
| `git status --short`                                                                                    | Vacío antes y después de las comprobaciones                  |
| `gh issue list --repo dariogea/BM27 --state open --limit 100`                                           | Fallo: GraphQL Forbidden                                     |
| `gh api repos/dariogea/BM27/issues?state=open`                                                          | Fallo: REST Forbidden                                        |

Logs originales de esta ejecución: `/tmp/codex001-lint.log`, `/tmp/codex001-typecheck.log`, `/tmp/codex001-test.log`. `pnpm build` y `pnpm format:check` también pasaron en la ejecución posterior a la publicación del entorno. No se repitieron benchmarks históricos, estabilidad de 30 temporadas, calibración ni una prueba interactiva del navegador. No se atribuyen a esta auditoría los resultados de la preparación previa del entorno.

## Hallazgos para Issues sin asignar

### A01 · Issue #26 · Prioridad alta: el mínimo salarial elude el tope con la plantilla completa

**Ubicación:** `packages/core/src/market/actions.ts:89`; condición análoga en `packages/core/src/market/actions.ts:133`.

`signFreeAgent` permite superar el tope siempre que el salario sea el mínimo. Falta exigir que el fichaje sea necesario para alcanzar el mínimo de plantilla. Contradice D-030 de docs/decisiones.md. La renovación contiene la misma exención amplia, que también debe revisarse.

**Prueba ejecutada:** universo con semilla `audit-cap`, primer club y escenario controlado en memoria: se asigna un salario alto a un contrato vigente y se convierte un jugador propio en un agente de salario mínimo mediante releasePlayer. Antes del fichaje hay 14 jugadores, mínimo 12, masa salarial de 7.078.000 €, tope 4.400.000 € y salario solicitado de 40.000 € (el mínimo). `signFreeAgent` acepta y deja 15 jugadores y 7.118.000 €. Los datos del escenario se construyen deliberadamente; no son una medición de frecuencia en partidas normales. La variante de renovación se identificó por inspección, no mediante una reproducción específica.

**Corrección propuesta:** calcular la plantilla que conserva contrato para la nueva temporada y permitir la excepción salarial únicamente mientras no se alcance rosterMin; aplicar una política coherente a renovaciones. Añadir regresiones para fichaje y renovación por encima del tope con plantilla suficiente, y conservar el caso permitido cuando falta personal.

**Criterio de aceptación:** el caso de 14 jugadores se rechaza; la excepción para completar hasta 12 funciona; contratos vigentes de clubes descendidos se respetan.

### A02 · Issue #27 · Prioridad alta: el marcador no acredita la fidelidad de la repetición

**Ubicación:** `apps/web/src/worker.ts:440` (comparación en las líneas 441–448); actualización de replayUniverse en `step()` e importación de guardados en el mismo archivo.

Si no existe detalle en myMatches, el Worker re-simula con replayUniverse y acepta el detalle cuando coinciden los puntos. Después de cambios de tácticas y avance de jornada, o tras cargar un guardado, ese universo puede no representar la configuración original. Dos simulaciones distintas pueden terminar con el mismo marcador; se mostraría una narración y estadísticas distintas como si correspondieran al encuentro jugado. Contradice el compromiso de honestidad de D-020.

**Prueba ejecutada:** universo `audit-replay`, sus dos primeros clubes, semilla de partido `audit-replay/2346`, mismos jugadores y rival. Cambiar solo el ritmo local de fast a slow produce en ambos casos 81–83; el registro pasa de 429 a 357 eventos y los box scores no son iguales. El control actual del Worker aceptaría ambas puntuaciones. Es una reproducción del fallo del criterio de validación mediante el motor; no se ejecutó el recorrido completo de guardar/cargar en un navegador.

**Corrección propuesta:** rechazar la reconstrucción cuando no pueda acreditarse la configuración original, incluso si coincide el resultado. Una solución duradera es conservar entradas originales o una huella verificable de la simulación; si requiere modificar el contrato de guardado o la API pública del núcleo, avisar primero en un Issue con etiqueta contrato y prever migración. Añadir una regresión con igual marcador y distinto detalle.

**Criterio de aceptación:** un detalle reconstruido con entradas distintas nunca se presenta como el original solo porque los puntos coincidan; los detalles conservados en memoria siguen funcionando.

## Arquitectura, honestidad y baloncesto

- El motor emite eventos y deriveBoxScore calcula puntos, minutos y estadísticas desde ellos; no se encontró una segunda fuente de estadísticas en la ruta inspeccionada.
- packages/core no importa React, DOM ni Node en el código revisado. TypeScript limita sus bibliotecas a ES2022 y ESLint restringe APIs de navegador, Math.random y Date.now. Los tests de determinismo y guardado pasan; esto no demuestra todos los casos posibles.
- Las siete opciones tácticas aparecen en el motor y cuentan con tests de efecto, incluidos costes de presión, ritmo y rebote. Pasan los tests actuales de plausibilidad, reglas FIBA y nba-like, coherencia del box score y sensibilidad a atributos.
- Entrenador, cantera y liberaciones gratuitas se identifican como PLACEHOLDER; no se presentan aquí como nuevas incidencias, pues son limitaciones declaradas.
- La calibración histórica declara que sus bandas son aproximadas y no proceden de una fuente oficial verificada. No se certifica fidelidad estadística al baloncesto real ni exactitud de todos los desempates y reglas especiales.
- No se identificaron nombres de personas reales en los archivos revisados; no se hizo una comprobación externa de identidad del catálogo entero.

## Reproducción portable

El script usa únicamente el motor del repositorio. Guardar el siguiente bloque como `/tmp/bm27-audit-repro.ts` en un entorno cuyo checkout esté en `/workspace/BM27`, y ejecutar el comando indicado en la tabla. Ajustar la ruta de importación si el checkout está en otra carpeta. Los datos sintéticos se modifican solo en memoria.

```typescript
import {
  generateUniverse,
  setUserTeam,
  releasePlayer,
  signFreeAgent,
  teamPayroll,
  competitionOfTeam,
  askingSalary,
  prepareTeam,
  playMatch,
  getBuiltinRuleset,
} from '/workspace/BM27/packages/core/src/index.ts';
let u = generateUniverse({ seed: 'audit-cap' });
const team = u.teams[0]!;
u = setUserTeam(u, team.id);
const id = team.playerIds[0]!;
const expensiveId = team.playerIds[1]!;
const comp = competitionOfTeam(u, team.id);
u = {
  ...u,
  players: u.players.map((p) =>
    p.id === id
      ? {
          ...p,
          age: 35,
          potential: 1,
          attributes: Object.fromEntries(
            Object.entries(p.attributes).map(([k, v]) => [
              k,
              Object.fromEntries(Object.keys(v).map((a) => [a, 1])),
            ]),
          ),
        }
      : p.id === expensiveId
        ? { ...p, contract: { ...p.contract!, salary: comp.salaryCap + 100000 } }
        : p,
  ),
};
u = releasePlayer(u, id);
const roster = u.teams.find((t) => t.id === team.id)!.playerIds.length;
const salary = askingSalary(
  u.players.find((p) => p.id === id)!,
  comp,
);
console.log(
  'CAP before',
  JSON.stringify({
    roster,
    min: comp.rosterMin,
    payroll: teamPayroll(u, team.id),
    cap: comp.salaryCap,
    salary,
    minSalary: comp.minSalary,
  }),
);
u = signFreeAgent(u, id, 1);
console.log(
  'CAP signing accepted, roster',
  u.teams.find((t) => t.id === team.id)!.playerIds.length,
  'payroll',
  teamPayroll(u, team.id),
);
const world = generateUniverse({ seed: 'audit-replay' });
const byId = new Map(world.players.map((p) => [p.id, p]));
const h = world.teams[0]!,
  a = world.teams[1]!;
const base = prepareTeam(h, byId),
  away = prepareTeam(a, byId),
  changed = prepareTeam(
    { ...h, tactics: { ...h.tactics, pace: h.tactics.pace === 'fast' ? 'slow' : 'fast' } },
    byId,
  );
for (let i = 0; i < 3000; i++) {
  const seed = `audit-replay/${i}`;
  const x = playMatch(base, away, getBuiltinRuleset('fiba'), seed),
    y = playMatch(changed, away, getBuiltinRuleset('fiba'), seed);
  if (
    x.boxScore.home.points === y.boxScore.home.points &&
    x.boxScore.away.points === y.boxScore.away.points &&
    JSON.stringify(x.events) !== JSON.stringify(y.events)
  ) {
    console.log(
      'REPLAY collision',
      JSON.stringify({
        seed,
        score: [x.boxScore.home.points, x.boxScore.away.points],
        paceBefore: base.tactics.pace,
        paceAfter: changed.tactics.pace,
        eventsBefore: x.events.length,
        eventsAfter: y.events.length,
        boxScoreEqual: JSON.stringify(x.boxScore) === JSON.stringify(y.boxScore),
      }),
    );
    break;
  }
  if (i === 2999) throw Error('No collision found');
}
```

## Entrega

Tarea #28. Incidencias inicialmente sin asignar: #26 y #27. El PR de auditoría no corrige lógica del juego ni cambia contratos. Revisión cruzada solicitada a Claude mediante Issue al abrir el PR. Las correcciones llevan sus propias ramas, pruebas y PR. La aprobación de CI y la revisión cruzada deben consultarse en GitHub; no se consideran realizadas por este informe.
