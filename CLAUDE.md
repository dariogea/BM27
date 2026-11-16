# BM27 — Reglas para Claude Code

## Proyecto
Basketball Manager 2027 (título provisional): simulador de gestión de baloncesto para PC, inspirado en la profundidad de Football Manager pero con identidad propia. Mundo persistente, simulación por posesiones, tácticas con efecto verificable, soporte de mods. Universo inicial: pirámide masculina española (4 niveles, ~200 equipos) con clubes y jugadores ficticios.

## Roles
- Propietario: no es programador. Lanza tareas, prueba y aprueba los PR. Explícale todo en español sencillo.
- Dirección General (chat de claude.ai): define las tareas T-###, revisa cada PR y mantiene las decisiones.
- Claude Code (tú): implementa tareas y entrega PR con parte. Trabajas **en paralelo con Codex**
  (agente de OpenAI), con las mismas reglas; ver «Trabajo con Codex».
- Codex: agente de OpenAI que trabaja en el mismo repositorio. Lee `AGENTS.md`.

## Pilares (no negociables)
1. Simulación honesta: nada en la interfaz sin efecto real en el motor. Lo provisional se marca `PLACEHOLDER` en el código y en el parte.
2. Baloncesto real: reglas, rotaciones, play types, coberturas defensivas, mercados distintos según liga.
3. El núcleo (`packages/core`) es headless: nunca importa UI, DOM ni APIs del navegador.
4. Determinismo: todo azar pasa por el RNG con semilla del núcleo. Prohibido `Math.random` en el núcleo.
5. El motor de partido produce un registro de eventos por posesión; las estadísticas y cualquier visualización futura (2D/3D) se derivan de él.
6. Datos, reglamentos y competiciones son datos validados por esquema (`packages/schema`), no código. Añadir una competición no debe requerir tocar el motor.
7. Prohibidos los nombres reales de jugadores, clubes, patrocinadores y competiciones en el repositorio.

## Stack
TypeScript estricto · pnpm workspaces · `packages/core` · `packages/schema` (zod + JSON Schema, campo `schemaVersion`) · `apps/web` (React + Vite, núcleo en Web Worker) · `tools/cli` · Vitest · GitHub Actions.

## Forma de trabajar
- Una tarea = una rama `t-###-nombre-corto` = un Pull Request. Nunca push ni merge a `main` (ver «Trabajo con Codex» para cómo se fusionan).
- Código, identificadores y comentarios en inglés. Documentación, PR y partes en español.
- Cambios en `packages/schema` = cambios de contrato: justifícalos en el parte e incluye migración si afectan a datos guardados.
- Una tarea solo está terminada si cumple sus criterios de aceptación y la CI está en verde.
- Actualiza `docs/estado.md` en cada PR.
- Si algo te bloquea, no inventes: termina lo posible y explícalo en el parte.

## Trabajo con Codex
Desde el 16-11-2026 trabajas en paralelo con **Codex**. Los dos podéis hacer cualquier tarea en
cualquier parte del proyecto, sois autónomos y os coordináis por GitHub. **Entre vosotros no manda
nadie: el propietario fija las prioridades.** Tu etiqueta es `agente:claude`; la de Codex, `agente:codex`.
Explicación para el propietario: `docs/coordinacion.md`. Instrucciones de Codex: `AGENTS.md`.

1. **Las tareas son Issues de GitHub.** Para coger una: asígnatela con la etiqueta `agente:claude`,
   márcala con `en-curso` y escribe en ella qué archivos vas a tocar.
2. **Antes de empezar**, revisa los Issues `en-curso` del otro agente. Si tu tarea toca alguno de sus
   archivos, elige otra, espera o pacta en un comentario quién hace qué.
3. **Contrato.** Si vas a cambiar `packages/schema` o la API pública del núcleo, avisa primero en un
   Issue con la etiqueta `contrato`, porque el otro depende de ello. Solo un cambio de contrato en
   vuelo a la vez.
4. **Cada tarea va en su rama y en un PR pequeño con parte.** Nunca push ni merge a `main`; el merge
   lo hace el propietario (o la fusión automática que él ha autorizado: los PR sin la etiqueta
   `contrato`, cuando la CI está en verde; los `contrato` siguen siendo manuales).
5. **Revisión cruzada:** cada PR lo revisa el otro agente. A Codex se le pide comentando
   `@codex review` en el PR. Tus PR los revisa Codex; los PR de Codex te los pide con la etiqueta
   `agente:claude` y `@claude review`.
6. **Para encargar algo a Codex:** Issue con la etiqueta `agente:codex` y un comentario
   `@codex implementa este issue siguiendo AGENTS.md y CLAUDE.md`.
7. **Al empezar y al terminar cada tarea**, lee los Issues, PR y comentarios nuevos dirigidos a ti
   (etiqueta `agente:claude`) y respóndelos.
8. **Máximo 2 rondas de ida y vuelta por tema.** Si no hay acuerdo, decide el propietario.

**Autonomía:** al terminar una tarea, coge la siguiente de mayor prioridad que esté libre: primero lo
que pida el propietario, después los Issues pendientes, después `docs/estado.md`. Si no queda nada,
crea tú los Issues de lo siguiente que necesita el proyecto. Las órdenes del propietario pasan
siempre por delante.

**Convenciones para no estorbarse:** en `docs/estado.md` edita solo las filas de tus tareas; no
sobrescribas informes de `docs/benchmarks/` de otras tareas; el número `T-###` lo asigna quien crea
el Issue (mira antes cuál es el último); un lockfile en conflicto se regenera tras fusionar `main`.

## Límites
No borrar el repositorio, no hacerlo público, no reescribir el historial, no contratar servicios de pago, no subir secretos ni datos personales reales.

## Leyenda de estados
IDEA · PROPUESTA · APROBADA · DISEÑADA · IMPLEMENTADA · PROBADA · FINALIZADA

## Decisiones vigentes (resumen)
- Stack TypeScript web primero; app de escritorio (Tauri) más adelante.
- Universo inicial España masculina niveles 1–4, estructura real como datos, contenido ficticio.
- Motor de partido por posesiones; sin 3D en el alcance inicial.
- Claude Code y Codex trabajan en paralelo con las mismas reglas; las tareas son Issues de GitHub.
- Reglas permanentes en este archivo.
