# BM27 — Basketball Manager 2027 (título provisional)

Simulador de gestión de baloncesto para PC: mundo persistente, simulación por posesiones y soporte
de mods. Proyecto **privado y comercial** (ver `LICENSE`). Todos los clubes y jugadores son
ficticios.

> **Estado actual:** ya se puede jugar una partida sencilla: dirigir un equipo, elegir tácticas y
> quinteto, avanzar jornada a jornada y guardar. Los clubes rivales y los cambios durante el
> partido los lleva todavía un entrenador provisional (`PLACEHOLDER`). No hay fichajes ni dinero.

## Qué hay en cada carpeta

| Carpeta           | Qué es                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/schema` | El **contrato de datos**: qué forma tienen un jugador, un equipo, un reglamento, un partido… Valida los datos al cargarlos y los exporta a JSON Schema (`packages/schema/json-schema/`). |
| `packages/core`   | El **núcleo de simulación**: genera el universo, simula partidos y temporadas, guarda y carga. No tiene interfaz; funciona en Node y en un Web Worker.                                   |
| `apps/web`        | La **página web** mínima. Solo envía órdenes al núcleo (que se ejecuta en un Web Worker) y muestra resultados.                                                                           |
| `tools/cli`       | **Comandos de terminal** para simular y medir rendimiento sin página.                                                                                                                    |
| `docs`            | Documentación: decisiones, estado de las tareas, arquitectura y mediciones.                                                                                                              |
| `.github`         | Automatismos de GitHub: comprobación automática (CI) y plantillas de Pull Request e incidencias.                                                                                         |

## Qué necesitas instalar (una sola vez)

1. **Node.js 22 o superior**: descárgalo de <https://nodejs.org> (botón «LTS») e instálalo.
2. **pnpm**: abre una terminal y escribe:

```bash
npm install -g pnpm
```

3. Descarga las dependencias del proyecto. En la terminal, dentro de la carpeta del proyecto:

```bash
pnpm install
```

## Ver la página

```bash
pnpm web
```

Abre en el navegador la dirección que aparece (normalmente <http://localhost:5173>). Después:

1. Escribe una semilla (cualquier texto) y pulsa **Generar universo**.
2. Elige un equipo en el desplegable y pulsa **Dirigir este equipo**.
3. En las pestañas **Tácticas** y **Quinteto** puedes cambiar cómo juega tu equipo y quién sale de
   titular. Los cambios se aplican desde el siguiente partido.
4. Pulsa **Jugar jornada** para avanzar un partido, o **Simular hasta el final de la temporada**.
5. En **Mi equipo** verás tu plantilla, tu próximo rival y tu último resultado; **Ver partido**
   abre el box score y la narración jugada a jugada.
6. En **Competición** están las clasificaciones, los playoffs y todos los partidos.
7. **Guardar partida** descarga un archivo; **Cargar partida** lo recupera, también a mitad de
   temporada.

La misma semilla produce siempre el mismo universo. Para cerrar la página, pulsa `Ctrl + C` en la
terminal.

## Ejecutar los tests

```bash
pnpm test
```

Deben salir todos en verde (tarda en torno a medio minuto). Otras comprobaciones, las mismas que hace
GitHub automáticamente en cada Pull Request:

```bash
pnpm lint
```

```bash
pnpm format:check
```

```bash
pnpm typecheck
```

## Simular desde la terminal

Simula 3 temporadas con la semilla `demo` y exporta el guardado a un archivo:

```bash
pnpm sim --seed demo --seasons 3 --out saves/demo.json
```

## Medir el rendimiento (benchmarks)

```bash
pnpm bench
```

Ejecuta las pruebas B1–B4 (tarda en torno a un minuto) y escribe el resultado en
[`docs/benchmarks/T-002.md`](docs/benchmarks/T-002.md).

## Comprobar la calibración del motor

```bash
pnpm calibrate
```

Simula la liga regular de cada nivel y compara las medias (puntos, posesiones, porcentajes,
faltas…) con bandas de referencia. Con `pnpm calibrate --write` guarda el informe en
[`docs/benchmarks/T-002-calibracion.md`](docs/benchmarks/T-002-calibracion.md).

## Otros comandos

| Comando              | Para qué                                                             |
| -------------------- | -------------------------------------------------------------------- |
| `pnpm format`        | Ordena el formato del código automáticamente.                        |
| `pnpm build`         | Compila la página web para comprobar que no hay errores.             |
| `pnpm schema:export` | Regenera los archivos JSON Schema tras cambiar el contrato de datos. |

## Cómo se trabaja

Las reglas del proyecto están en [`CLAUDE.md`](CLAUDE.md) y el estado de las tareas en
[`docs/estado.md`](docs/estado.md). Cada tarea va en su propia rama y entra mediante Pull Request;
nunca se sube nada directamente a `main`.
