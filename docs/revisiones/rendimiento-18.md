# Rendimiento #18 — primera mejora, objetivo abierto

La simulación completa tarda menos en la medición de este entorno.
Se ha evitado crear y copiar un objeto temporal por cada evento del partido.
Los partidos siguen produciendo su registro completo; las estadísticas siguen saliendo de él.
Las 317 comparaciones antes/después coinciden exactamente, incluidos 300 partidos completos.
La meta del 30 % sigue pendiente; esta entrega no cierra #18.

## Cambio y decisión

`packages/core/src/match/engine.ts` construye directamente `seq`, `period`, `clock`, `possession`
y `offenseTeamId` en los 17 sitios que emiten eventos. Se conserva el orden de las propiedades y de
su evaluación. La función anterior creaba un objeto de sello temporal que se copiaba por expansión
al objeto final. No cambia ninguna fórmula, decisión, semilla ni llamada al RNG. No se eliminan
registros ni se deriva el marcador por una vía alternativa.

Esto duplica cinco campos en los literales de eventos: es un coste de mantenimiento deliberado a
cambio de la mejora medida. Los cambios futuros de campos comunes deberán actualizar todos esos
sitios. No cambia el contrato ni la API pública.

## Perfil previo

Se capturó un perfil de V8 con arranque, generación y cuatro temporadas de `bench-t001` antes del
cambio (base `1eb00b6`). El [resumen](../benchmarks/18-perfil.json) conserva 10 909 muestras:
entre los puntos del motor aparecen tiro, entrenador provisional, posesión, avance del reloj y
pick-and-roll. Es muestreo de CPU, no una medición precisa de asignaciones; la hipótesis del objeto
temporal procede de revisar esos recorridos y se valida con el benchmark posterior.
Las líneas del resumen son las de la versión anterior, resueltas con el mapa de fuentes de tsx.

Para generar un perfil nuevo desde la raíz:

```bash
node --cpu-prof --cpu-prof-dir=/tmp --import tsx --input-type=module -e '
import { generateUniverse, simulateSeason } from "./packages/core/src/index.ts";
let world = generateUniverse({ seed: "bench-t001" });
for (let i = 0; i < 4; i++) world = simulateSeason(world).universe;
'
```

## Mediciones reales en el mismo entorno

Medidas secuenciales, sin otra simulación, prueba o navegador de QA ejecutándose en paralelo.
Node 24.22.1, mismo contenedor compartido, misma semilla y cinco repeticiones para B1/B2.

| Medida                                  | Antes            | Después          | Reducción del tiempo |
| --------------------------------------- | ---------------- | ---------------- | -------------------- |
| B1: temporada del nivel 1, mediana de 5 | 252 ms           | 231 ms           | 8,3 %                |
| B2: universo completo, mediana de 5     | 2527 ms          | 2167 ms          | 14,2 %               |
| B3: diez temporadas seguidas            | 26,11 s          | 22,60 s          | 13,4 %               |
| B4: guardado tras diez temporadas       | 17 680 345 bytes | 17 680 345 bytes | Mismo tamaño         |

Informes completos: [antes](../benchmarks/18-antes.md) y [después](../benchmarks/18-despues.md).
B2 conserva 2819 partidos y B3 28 207. Los extremos de B2 son 2332–2728 ms antes y 2113–2291 ms
después. Son mediciones de una máquina virtual compartida, no una garantía de velocidad en todos
los PC. No se ha medido la mejora en un Windows real.

La comparación válida aquí es antes/después del cambio con el motor actual. El informe T-006
histórico procede de otra ejecución y de un motor anterior a los sucesos de T-028: no se presenta
como una comparación homogénea. Tampoco se da por cumplido el umbral del 30 % de #18.

## Equivalencia reproducible

`tools/cli/src/perfIdentity.ts` calcula SHA-256 del JSON completo, no solo del marcador. El archivo
[18-identidad.json](../benchmarks/18-identidad.json) se obtuvo **antes** del cambio. La ejecución
posterior devuelve las mismas 317 filas y hashes, byte por byte:

- 300 partidos con eventos, box score y prórrogas; tres semillas y reglamentos incluidos.
- Tres universos generados, seis temporadas completas y sus seis exportaciones de guardado.
- Dos temporadas adicionales del paquete de ocho clubes con reglamento alternativo.

```bash
pnpm exec tsx tools/cli/src/perfIdentity.ts > /tmp/bm27-perf-identidad.json
cmp docs/benchmarks/18-identidad.json /tmp/bm27-perf-identidad.json
```

El comando `cmp` devuelve 0 para esta entrega. Esto comprueba esos casos concretos, no demuestra
que toda entrada posible sea equivalente. Los cambios futuros intencionados del motor pueden
cambiar las huellas; esta es una referencia de la optimización #18, no un nuevo modelo deportivo.

## Validación del comportamiento

Los informes finales de [calibración](../benchmarks/18-despues-calibracion.md) y
[estabilidad a 30 temporadas](../benchmarks/18-despues-estabilidad.md) conservan su metodología y
limitaciones. Las bandas de calibración son aproximaciones de diseño, no datos reales contrastados.
El problema de aplanamiento de las estrellas de #19 no se considera resuelto por ejecutar más rápido.

Comandos: `pnpm bench --task 18-antes` antes de editar; después, `pnpm bench --task 18-despues`,
`pnpm calibrate --write --task 18-despues` y `pnpm stability --seasons 30 --write --task 18-despues`.
No se sobrescriben los informes de tareas anteriores.

La calibración final mantiene las 14 magnitudes del nivel 1 dentro de sus bandas de diseño. La estabilidad ejecuta las 30 temporadas completas y conserva el riesgo de #19. Las verificaciones estáticas y la compilación de la web también se ejecutaron en esta entrega.

`pnpm test --maxWorkers=2`: **280/280** pruebas correctas. `pnpm lint`, `pnpm typecheck`,
`pnpm build`, `pnpm format:check` y `pnpm roadmap:check`: correctos. Al no cambiar la interfaz, esta
entrega verifica el motor y sus salidas; no se atribuyen nuevas pruebas visuales a la optimización.
