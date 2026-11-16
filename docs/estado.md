# Estado de las tareas

Leyenda: IDEA · PROPUESTA · APROBADA · DISEÑADA · IMPLEMENTADA · PROBADA · FINALIZADA

| Tarea | Título                                                                                                         | Estado     | Rama                         | Notas                                  |
| ----- | -------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------- | -------------------------------------- |
| T-001 | Fundación del repositorio y prueba técnica del núcleo                                                          | FINALIZADA | `t-001-fundacion`            | Aprobada y fusionada en `main` (PR 1). |
| T-002 | Motor de partido v1: tipos de jugada, tácticas con efecto comprobable y rotación                               | FINALIZADA | `t-002-motor-partido`        | Aprobada y fusionada en `main`.        |
| T-003 | Partida jugable: equipo propio, tácticas, quinteto, jornada a jornada y guardado a mitad de temporada          | FINALIZADA | `t-003-partida-jugable`      | Aprobada y fusionada en `main`.        |
| T-004 | Progresión de jugadores: potencial, desarrollo, declive físico y técnico, retirada y estabilidad a largo plazo | FINALIZADA | `t-004-progresion-jugadores` | Aprobada y fusionada en `main`.        |
| T-005 | Mercado básico: contratos, topes salariales, agentes libres, fichajes, renovaciones y bajas                    | FINALIZADA | `t-005-mercado`              | Aprobada y fusionada en `main`.        |
| T-006 | Finanzas: caja, reputación, ingresos y gastos, presupuesto salarial e indemnizaciones                          | PROBADA    | `t-006-finanzas`             | 123 tests en verde en local.           |

## Pendiente conocido (para futuras tareas)

- Tras cerrar y volver a cargar una partida, el detalle (box score) de los partidos ya jugados por el equipo del usuario puede no estar disponible si cambió tácticas después.
- Traspasos entre clubes con dinero (hoy solo hay agentes libres).
- Decisiones económicas del usuario (precio de entradas, patrocinadores, instalaciones) y de la IA; quiebra y reglas de licencia.
- Traspasos entre clubes y negociación (hoy solo hay agentes libres y salario fijado por el jugador).
- Cantera real (hoy cada retirada genera un agente libre joven, `PLACEHOLDER`).
- Entrenamiento y lesiones como factores de desarrollo; el desarrollo actual solo depende de la edad y el potencial.
- Contrastar la curva de carrera con datos reales cuando exista una fuente verificada.
- Entrenador con criterio propio (quinteto, minutos, tiempos muertos, cambios tácticos en partido).
- Lesiones, técnicas, tiempos muertos y saltos entre dos en el motor de partido.
- Comprobar que las medias de la liga se mantienen tras muchas temporadas de envejecimiento.
- Política de conservación del historial y formato definitivo de guardado (base de datos).
- Calibrar rangos de plausibilidad con datos reales verificados.

## Trabajo en paralelo con Codex

Desde el 16-11-2026 trabajan dos agentes (Claude Code y Codex). Las tareas pendientes son **Issues de
GitHub** (<https://github.com/dariogea/BM27/issues>); esta tabla recoge las que ya se han hecho.
Reglas en [`coordinacion.md`](coordinacion.md).

| Tarea | Título                                                                                | Estado  | Rama                       | Notas                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------- | ------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-007 | Coordinación con Codex: AGENTS.md, reglas, etiquetas e Issues                         | PROBADA | `t-007-coordinacion-codex` | Solo documentación y configuración de GitHub. No he podido comprobar que Codex esté conectado al repositorio.                                                                      |
| T-023 | Aplicación de escritorio: instalador .exe para Windows publicado en Releases (fase 1) | PROBADA | `t-023-escritorio`         | Fase 1 (descarga manual). La actualización automática (fase 2) espera la decisión del propietario sobre el canal público. Nadie ha ejecutado aún el instalador en un Windows real. |
