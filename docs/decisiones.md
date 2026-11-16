# Decisiones

## Decisiones vigentes (resumen)

- Stack TypeScript web primero; app de escritorio (Tauri) más adelante.
- Universo inicial España masculina niveles 1–4, estructura real como datos, contenido ficticio.
- Motor de partido por posesiones; sin 3D en el alcance inicial.
- Una sesión de Claude Code por tarea; reglas permanentes en `CLAUDE.md`.

## Decisiones técnicas tomadas en T-001

Tomadas por Claude Code dentro del alcance de la tarea. Dirección General puede revocarlas.

| #     | Decisión                                                                                                                                                                      | Motivo                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Generador de azar: **xoshiro128\*\*** con semilla de texto. Cada partido tiene su propia semilla (`semilla/match/idPartido`).                                                 | Rápido en JavaScript y, al no depender del orden de simulación, permitirá simular en paralelo y reconstruir cualquier partido suelto.    |
| D-002 | El motor solo devuelve el **registro de eventos**; el box score se calcula aparte leyendo ese registro.                                                                       | Pilar 5. Garantiza que un visualizador futuro verá exactamente lo mismo que las estadísticas.                                            |
| D-003 | El guardado **no incluye** el registro de eventos ni el box score de cada partido; solo resultado, clasificaciones, playoffs y estadísticas de temporada por jugador.         | Con eventos, cada temporada ocuparía cientos de MB. Ver B4 en `benchmarks/T-001.md`. Pendiente de política definitiva (ver parte T-001). |
| D-004 | `simulateSeason` es una función pura: recibe un universo y devuelve otro nuevo, sin modificar el original.                                                                    | Facilita los tests de determinismo, el guardado y re-simular partidos de la temporada recién jugada.                                     |
| D-005 | Checksum del guardado: **SHA-256 implementado en TypeScript puro**, sin APIs de Node ni del navegador.                                                                        | El núcleo debe funcionar igual en Node y en un Web Worker.                                                                               |
| D-006 | Los paquetes se consumen directamente desde su código fuente TypeScript (sin paso de compilación intermedio).                                                                 | Menos piezas que mantener en esta fase. Habrá que revisarlo al empaquetar para escritorio.                                               |
| D-007 | Ascensos y descensos salen de una única **clasificación final** por competición (playoffs primero, luego liga regular).                                                       | Regla genérica que sirve para ligas de un grupo o de varios sin tocar el motor (pilar 6).                                                |
| D-008 | Formato provisional de la pirámide: N1 baja 2; N2 sube 2 (finalistas del playoff) y baja 3; N3 sube 3 y baja 6; N4 sube 6. Todo en `packages/core/src/data/universe-es.json`. | Números configurables pedidos por la tarea; no pretenden copiar el reglamento real.                                                      |
