# BM27 — Basketball Manager 2027 (título provisional)

Simulador de gestión de baloncesto para PC: mundo persistente, simulación por posesiones y soporte
de mods. Proyecto **privado y comercial** (ver `LICENSE`). Todos los clubes y jugadores son
ficticios.

> **Estado actual:** tarea T-001, prueba técnica del núcleo. El motor de partido es provisional
> (`PLACEHOLDER`) y se reescribirá.

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
2. Pulsa **Simular temporada**.
3. Elige una competición en el desplegable para ver su clasificación y sus playoffs.
4. Pulsa cualquier partido de la lista para ver su **box score**.

La misma semilla produce siempre el mismo universo y los mismos resultados. Para cerrar la página,
pulsa `Ctrl + C` en la terminal.

## Ejecutar los tests

```bash
pnpm test
```

Deben salir todos en verde (tarda unos 15 segundos). Otras comprobaciones, las mismas que hace
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

Ejecuta las pruebas B1–B4 (tarda en torno a medio minuto) y escribe el resultado en
[`docs/benchmarks/T-001.md`](docs/benchmarks/T-001.md).

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
