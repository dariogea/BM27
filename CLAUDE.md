# BM27 — Reglas para Claude Code

## Proyecto
Basketball Manager 2027 (título provisional): simulador de gestión de baloncesto para PC, inspirado en la profundidad de Football Manager pero con identidad propia. Mundo persistente, simulación por posesiones, tácticas con efecto verificable, soporte de mods. Universo inicial: pirámide masculina española (4 niveles, ~200 equipos) con clubes y jugadores ficticios.

## Roles
- Propietario: no es programador. Lanza tareas, prueba y aprueba los PR. Explícale todo en español sencillo.
- Dirección General (chat de claude.ai): define las tareas T-###, revisa cada PR y mantiene las decisiones.
- Claude Code (tú): implementa una tarea por sesión y entrega un PR con parte.

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
- Una tarea = una rama `t-###-nombre-corto` = un Pull Request. Nunca push ni merge a `main`.
- Código, identificadores y comentarios en inglés. Documentación, PR y partes en español.
- Cambios en `packages/schema` = cambios de contrato: justifícalos en el parte e incluye migración si afectan a datos guardados.
- Una tarea solo está terminada si cumple sus criterios de aceptación y la CI está en verde.
- Actualiza `docs/estado.md` en cada PR.
- Si algo te bloquea, no inventes: termina lo posible y explícalo en el parte.

## Límites
No borrar el repositorio, no hacerlo público, no reescribir el historial, no contratar servicios de pago, no subir secretos ni datos personales reales.

## Leyenda de estados
IDEA · PROPUESTA · APROBADA · DISEÑADA · IMPLEMENTADA · PROBADA · FINALIZADA

## Decisiones vigentes (resumen)
- Stack TypeScript web primero; app de escritorio (Tauri) más adelante.
- Universo inicial España masculina niveles 1–4, estructura real como datos, contenido ficticio.
- Motor de partido por posesiones; sin 3D en el alcance inicial.
- Una sesión de Claude Code por tarea; reglas permanentes en este archivo.
