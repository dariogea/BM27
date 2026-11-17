# BM27 — Instrucciones para Codex

Este archivo es para **Codex** (agente de OpenAI). Trabajas en este repositorio **en paralelo con
Claude Code** (agente de Anthropic). Los dos sois autónomos, podéis hacer cualquier tarea en
cualquier parte del proyecto y os coordináis por GitHub. **Entre vosotros no manda nadie: el
propietario fija las prioridades.**

## Antes de tocar nada

1. Lee [`CLAUDE.md`](CLAUDE.md): contiene los pilares y las reglas del proyecto. Valen igual para ti.
   Si algo de este archivo contradice a `CLAUDE.md`, avisa en un Issue; mientras tanto, manda lo que
   sea más restrictivo.
2. Lee [`docs/README.md`](docs/README.md) (índice), [`docs/estado.md`](docs/estado.md),
   [`docs/decisiones.md`](docs/decisiones.md), [`docs/arquitectura.md`](docs/arquitectura.md) y
   [`docs/coordinacion.md`](docs/coordinacion.md).
3. El propietario **no es programador**: todo lo que entregues debe poder verificarse con tests y
   explicarse en español sencillo.

## Reglas de coordinación (vistas desde tu lado)

Son las mismas para los dos. Tu etiqueta es **`agente:codex`**; la de Claude es **`agente:claude`**.

1. **Las tareas son Issues de GitHub.** Para coger una: asígnatela con la etiqueta `agente:codex`,
   márcala con `en-curso` y escribe en ella **qué archivos vas a tocar**.
2. **Antes de empezar**, revisa los Issues `en-curso` de Claude. Si tu tarea toca alguno de sus
   archivos, elige otra, espera o pacta en un comentario quién hace qué.
3. **Contrato.** Si vas a cambiar `packages/schema` o la API pública del núcleo (`packages/core/src/index.ts`
   y lo que exporta), avisa **primero** en un Issue con la etiqueta `contrato`, porque Claude depende de
   ello. Mientras haya un Issue `contrato` + `en-curso`, nadie más cambia el contrato.
4. **Una tarea = una rama = un PR pequeño con parte.** Nunca hagas push ni merge a `main` a mano.
   Los PR se fusionan solos cuando la CI está en verde (10 minutos después, con tu rama al día con
   `main`, y sin las etiquetas `contrato`, `manual` ni `bloqueado`). **Los fusiona el propietario**
   los que cambian `packages/schema/src/`, `packages/core/src/index.ts`, `.github/`, `CLAUDE.md`, `AGENTS.md` o `tools/ci/` (la propia política de fusión). Como revisor puedes frenar una fusión con la etiqueta `bloqueado` o pidiendo cambios.
   Detalle en `docs/coordinacion.md`.
5. **Revisión cruzada.** Cada PR lo revisa el otro agente. Tus PR los revisa Claude: pon la
   etiqueta `agente:claude` al PR y comenta `@claude review`. Para pedirle algo a Claude: Issue con la
   etiqueta `agente:claude`. Claude **no escucha en tiempo real**: lee los Issues y PR nuevos al
   empezar y al terminar cada tarea, así que puede tardar.
6. **Para encargar algo a Claude:** Issue con la etiqueta `agente:claude`, con el objetivo, los
   archivos probables y los criterios de aceptación. Para que lo haga Codex te lo encargan a ti con
   `agente:codex` y el comentario `@codex implementa este issue siguiendo AGENTS.md y CLAUDE.md`.
7. **Al empezar y al terminar cada tarea**, lee los Issues y comentarios nuevos dirigidos a ti y
   respóndelos.
8. **Máximo 2 rondas de ida y vuelta por tema.** Si no hay acuerdo, decide el propietario: deja un
   comentario que lo explique con claridad y pásale la pregunta.

## Trabajo bajo autorización

El propietario autoriza cada tarea. Al terminar una, **para**: entrega el PR con su parte, informa de lo
hecho y de lo pendiente, y **no coges otra tarea ni abres Issues o PR nuevos hasta que el propietario
diga «continúa»** (o te asigne algo concreto). Así no se gasta crédito sin permiso. Dentro de una tarea
autorizada vale lo necesario para cerrarla (CI, revisiones de tu propio PR). Las órdenes del propietario
pasan siempre por delante.

## Cómo se trabaja en el código

```bash
pnpm install          # una sola vez
pnpm lint             # ESLint
pnpm format           # Prettier (corrige); pnpm format:check solo comprueba
pnpm typecheck        # TypeScript estricto
pnpm test             # Vitest (tarda en torno a un minuto)
pnpm build            # compila la web
```

La CI ejecuta exactamente eso en cada PR. **Un PR solo está listo si todo eso pasa.**

- **Idioma:** código, identificadores y comentarios en inglés. Documentación, PR y partes en español.
- **Provisional:** lo que no sea definitivo se marca `PLACEHOLDER` en el código y en el parte.
- **Núcleo headless:** `packages/core` nunca importa UI, DOM ni APIs del navegador, y no usa
  `Math.random` (todo azar sale del RNG con semilla). Lo comprueban ESLint, TypeScript y un test.
- **Contrato de datos:** `packages/schema` es el contrato. Un cambio incluye: subir `schemaVersion`,
  una migración en `packages/schema/src/migrations.ts` que lo cubra un test, y exportar los JSON Schema
  con `pnpm schema:export`.
- **Medir, no suponer:** si cambias el motor o la economía, comprueba con `pnpm calibrate`,
  `pnpm stability` y `pnpm bench` y guarda los informes en `docs/benchmarks/` con el número de tu tarea.
  **No sobrescribas los informes de tareas anteriores.**
- **Datos y nombres:** la orden del propietario de 17-11-2026 sustituye la ficción total por una base española real de referencia. Separar hechos contrastados, estimaciones y alias; identificar la demo generada y documentar procedencia/uso. Ver `docs/datos/espana.md`. Sin secretos ni datos privados.

## Puntos donde es fácil estorbarse

- **Hoja de ruta:** si cambia el estado de algo, actualiza `docs/roadmap/roadmap.json` y ejecuta
  `pnpm roadmap` (nunca edites `docs/roadmap.md` a mano; un test lo comprueba).
- **`docs/estado.md`:** lo actualiza cada PR. Edita **solo las filas de tus tareas** y, si hay
  conflicto al fusionar, resuélvelo fusionando `main` en tu rama (nunca reescribas el historial).
- **`packages/schema`:** ver la regla 3. Solo un cambio de contrato en vuelo a la vez.
- **`package.json` y `pnpm-lock.yaml`:** si añades una dependencia, dilo en el Issue; un lockfile
  en conflicto se regenera con `pnpm install` sobre la rama ya fusionada con `main`.
- **Números de tarea `T-###`:** los reparte quien crea el Issue; mira primero cuál es el último.

## Límites

No borrar el repositorio, no hacerlo público, no reescribir el historial (`force push`), no
contratar servicios de pago, no crear cuentas externas, no subir secretos ni datos personales
reales, no borrar ramas ajenas. Si algo solo puede hacerlo el propietario, termina todo lo demás y
explícalo en el parte con pasos sencillos.
