# Estado de las tareas

Leyenda: IDEA · PROPUESTA · APROBADA · DISEÑADA · PROBADA · PROBADA · FINALIZADA

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

| Tarea | Título                                                                                                                        | Estado     | Rama                       | Notas                                                                                                                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-007 | Coordinación con Codex: AGENTS.md, reglas, etiquetas e Issues                                                                 | PROBADA    | `t-007-coordinacion-codex` | Solo documentación y configuración de GitHub. No he podido comprobar que Codex esté conectado al repositorio.                                                                                                                                       |
| T-008 | Fusión automática de PR cuando la CI está en verde (opción A del propietario)                                                 | PROBADA    | `t-008-fusion-automatica`  | La lógica de decisión tiene 29 tests; el flujo de GitHub no se ha podido probar hasta que se fusione.                                                                                                                                               |
| T-023 | Aplicación de escritorio: instalador .exe para Windows publicado en Releases (fase 1)                                         | PROBADA    | `t-023-escritorio`         | Fase 1 (descarga manual). La actualización automática (fase 2) espera la decisión del propietario sobre el canal público. El instalador se compila y se genera en el Windows de GitHub (1,4 MB), pero nadie lo ha ejecutado aún en un Windows real. |
| #26   | Corrección: la excepción del salario mínimo solo vale para llegar al mínimo de plantilla                                      | PROBADA    | `fix-26-limpio`            | 172 tests; estabilidad a 30 temporadas idéntica a T-006 (`docs/benchmarks/fix-26.md`). Solo afecta al mercado del usuario.                                                                                                                          |
| T-026 | Hoja de ruta completa, visual y generada desde datos (`docs/roadmap.md`)                                                      | FINALIZADA | `t-026-roadmap`            | 295 elementos; avance global y porcentajes por fase y área. Los porcentajes «en curso» son estimaciones. Vista en GitHub con gráficos Mermaid (no comprobada la apariencia dentro de GitHub; solo la sintaxis).                                     |
| T-027 | Publicación fiable del instalador: la etiqueta de una Release corresponde al commit compilado (#39) y versión `0.1.0-alpha.1` | PROBADA    | `t-027-release-fiable`     | Validador `tools/ci/release-check.mjs` con 8 tests y prueba con un repositorio temporal. **No publicado:** falta fusionar y etiquetar. La compilación con versión alfa en Windows se comprueba en CI antes de fusionar.                             |
| T-029 | Base semilla española 2026-27 convertida a datos del repositorio (competiciones, 202 equipos con grupo, reglas, fuentes)      | PROBADA    | `t-029-datos-semilla`      | Solo datos y un test de cifras. **Sin personas** (pendiente de revisar derechos). Todavía no se carga en la partida.                                                                                                                                |

## Correcciones de Codex

| Tarea | Título                                               | Estado  | Rama                            | Notas                                                                              |
| ----- | ---------------------------------------------------- | ------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| #27   | Repeticiones verificadas con las entradas originales | PROBADA | `codex-027-repeticiones-fieles` | 126 tests aprobados; revisión cruzada pendiente. No cambia el formato de guardado. |

## Revisiones de Codex

| Tarea     | Título                  | Estado     | Rama                  | Notas                                                                                                     |
| --------- | ----------------------- | ---------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| Codex 001 | Auditoría de main (#28) | FINALIZADA | `codex-001-auditoria` | Lint, tipos y 104 tests aprobados. Hallazgos #26 y #27; Fusionada en #30; correcciones #32 y #38 en main. |

## Roadmap en la portada

| Tarea | Estado  | Entrega                                                                                               |
| ----- | ------- | ----------------------------------------------------------------------------------------------------- |
| #42   | PROBADA | Resumen visual del roadmap en README, generado desde los mismos datos y comprobado por roadmap:check. |

## Planificación y portada

| Tarea | Estado  | Entrega                                                                                                                                                                                     |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #44   | PROBADA | Roadmap ampliado conservando fases y tareas existentes; landing de GitHub con identidad visual, navegación y acceso a guías. Nuevas tareas pendientes, sin implementar funciones del juego. |

| #46 | PROBADA | Título definitivo, About y preparación comercial ponderada con criterios de salida y gráfico generado. |

| #16 | PROBADA | Ranuras internas en IndexedDB, metadatos, renombrado, borrado y autoguardado configurable; archivos portables conservados. |

| #23 | PROBADA | Demo con inicio guiado, jerarquía visual, temas claro/oscuro y adaptación móvil. Base española real como objetivo; catálogo oficial pendiente de contraste. |

| #52 | PROBADA | Portal inspirado en las capturas del propietario, navegación doble, actividad real, clasificación y preferencias persistentes. Solo PC, sin variante móvil. |

| T-031 | PROBADA | Launcher: la aplicación de escritorio muestra su versión y busca al abrir una versión nueva en GitHub (token opcional para el repositorio privado); enlace de descarga copiable. Probado con respuestas simuladas y 9 tests; sin probar dentro de un Windows real. No descarga ni instala sola. |

| #61 | PROBADA | Adaptador de la semilla española: 202 identidades estables dentro de la semilla, alias, fuentes, validaciones y obstáculos explícitos para la integración. No cambia la demo ni contrato. |

| #63 | PROBADA | Técnicas de jugador con tiro libre al rival, posesión previa y acumulación de falta de equipo correctas; antideportivas intactas. Regresión demostrada antes de corregir y mediciones propias de calibración, estabilidad y rendimiento. |

| #67 | PROBADA | Mundo: buscador paginado y fichas enlazadas de jugadores/clubes, estadísticas conservadas y potencial rival excluido de la respuesta. Primera parte de #14; líderes y palmarés pendientes. |

| #21 | PROBADA | Paquetes JSON de competiciones, reglas, economía y nombres en web y CLI; ejemplo jugable de ocho clubes. Contrato 7 con migración y nombres conservados en guardados. Identidades españolas explícitas pendientes. |

| #72 | PROBADA | Líderes por competición/temporada con medias, totales y porcentajes, mínimos explícitos y fichas enlazadas; palmarés real conservado de campeones/ascensos/descensos. Segunda parte de #14, sin contrato ni motor. |

| #18 (parte 1) | PROBADA | Menos objetos temporales al emitir eventos: B2 2527→2167 ms en el mismo entorno; 317 huellas idénticas. Informes antes/después propios. Meta del 30 % y paralelismo pendientes; #18 sigue abierta. |

| #15 (parte 1) | PROBADA | Reproductor del registro con marcador, quintetos activos, pausa/velocidad/periodos y mapa de tiros exactos con filtros. Sin posiciones inventadas. Modo directo y visualizador posicional pendientes; #15 sigue abierta. |

| #79 | PROBADA | Clubes explícitos en paquetes con IDs estables, alias y referencias conservadas; contrato 8/migración 7, paquetes v7 compatibles y etiquetas de procedencia veraces. Ejemplo ficticio; semilla española y grupos explícitos pendientes. |
| T-033 | PROBADA | Paneles de gestión: plantilla ordenable por cualquier columna con mapa de color por nivel e insignias de lesión y contrato cumplido; búsqueda de agentes libres; comprobación en navegador con axe (0 violaciones en 5 paneles × 2 temas). Finanzas, competición y partido se revisaron pero no se han rediseñado. |

| T-036 | PROBADA | Versión 0.1.0-alpha.2 preparada (sin publicar): versión en `package.json` y `tauri.conf.json`, notas en `docs/versiones/0.1.0-alpha.2.md` y el flujo de publicación usa esas notas. **Publicada el 17-11-2026** (Release `v0.1.0-alpha.2`, pre-lanzamiento, 1.460.875 bytes); el enlace del README apunta a ella. Sin probar en un Windows real. |

| #83 | PROBADA | Fichas de clubes desde la clasificación, inscritos y próximo rival del Portal. Teclado, retorno al Portal y datos de paquetes verificados en navegador para PC. |

| #15 (parte 2) | PROBADA | Jugar y ver abre la retransmisión de la jornada con el plan táctico aplicado y el acta al terminar. Órdenes durante el partido y posiciones de jugadores pendientes. |

| #15 (parte 3) | PROBADA | Diez estadísticas de equipo durante la retransmisión y la repetición, con cifras hasta la jugada seleccionada y cotejadas con el acta. |

| #15 (parte 4) | PROBADA | Desglose por jugador durante la retransmisión y la repetición, selección de equipo y jugadores en pista según la jugada. Totales cotejados con el acta. |
| #15 (parte 5) | PROBADA | Minutos y segundos por jugador hasta la jugada seleccionada, con cambios de quinteto y de periodo. |
