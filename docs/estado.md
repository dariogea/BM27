# Estado de las tareas

Leyenda: IDEA · PROPUESTA · APROBADA · DISEÑADA · IMPLEMENTADA · PROBADA · FINALIZADA

| Tarea | Título                                                                                                         | Estado     | Rama                         | Notas                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| T-001 | Fundación del repositorio y prueba técnica del núcleo                                                          | FINALIZADA | `t-001-fundacion`            | Aprobada y fusionada en `main` (PR 1).                                                                                                    |
| T-002 | Motor de partido v1: tipos de jugada, tácticas con efecto comprobable y rotación                               | PROBADA    | `t-002-motor-partido`        | 58 tests en verde en local. Pasa a FINALIZADA cuando el propietario apruebe el Pull Request. El entrenador sigue siendo un `PLACEHOLDER`. |
| T-003 | Partida jugable: equipo propio, tácticas, quinteto, jornada a jornada y guardado a mitad de temporada          | PROBADA    | `t-003-partida-jugable`      | 72 tests en verde en local. Construida sobre T-002.                                                                                       |
| T-004 | Progresión de jugadores: potencial, desarrollo, declive físico y técnico, retirada y estabilidad a largo plazo | PROBADA    | `t-004-progresion-jugadores` | 83 tests en verde en local. Construida sobre T-003.                                                                                       |

## Pendiente conocido (para futuras tareas)

- Tras cerrar y volver a cargar una partida, el detalle (box score) de los partidos ya jugados por el equipo del usuario puede no estar disponible si cambió tácticas después.
- Mercado, contratos y cantera real (hoy cada retirado se sustituye por una promesa generada, `PLACEHOLDER`).
- Entrenamiento y lesiones como factores de desarrollo; el desarrollo actual solo depende de la edad y el potencial.
- Contrastar la curva de carrera con datos reales cuando exista una fuente verificada.
- Entrenador con criterio propio (quinteto, minutos, tiempos muertos, cambios tácticos en partido).
- Lesiones, técnicas, tiempos muertos y saltos entre dos en el motor de partido.
- Comprobar que las medias de la liga se mantienen tras muchas temporadas de envejecimiento.
- Política de conservación del historial y formato definitivo de guardado (base de datos).
- Calibrar rangos de plausibilidad con datos reales verificados.
