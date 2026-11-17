# Tácticas: qué hace cada una (medido)

Cada equipo tiene siete ajustes tácticos. **Todos tienen efecto real en el motor** y ese efecto está
comprobado por tests (`packages/core/test/tactics.test.ts`). Ninguno es decorativo.

## Las opciones

| Ajuste                      | Opciones                                                | Qué cambia en la pista                                                                                                                          |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Ritmo                       | lento · normal · rápido                                 | Cuánto tarda el equipo en tirar y cuánto corre al contraataque. Rápido: más posesiones, más pérdidas y más cansancio.                           |
| Foco ofensivo               | interior · equilibrado · exterior                       | Qué jugadas se usan más. Interior: más poste, cortes y tiros libres. Exterior: más triples y salidas de bloqueo.                                |
| Defensa                     | individual · zona                                       | La zona protege la pintura, comete menos faltas y esconde a malos defensores, pero concede triples y rebotea peor.                              |
| Defensa del bloqueo directo | hundirse · cambiar · salto y recuperar · dos contra uno | Hundirse regala tiros de media distancia. Cambiar crea emparejamientos desiguales. El dos contra uno fuerza pérdidas pero deja tiradores solos. |
| Presión                     | baja · normal · alta                                    | Alta: roba más balones a costa de más faltas, más cansancio y tiros más cómodos del rival cuando la supera.                                     |
| Rebote ofensivo             | replegar · normal · cargar                              | Cargar gana rebotes de ataque pero concede contraataques. Replegar hace lo contrario.                                                           |
| Rotación                    | 7 a 12 jugadores                                        | Cuántos jugadores entran en el reparto de minutos.                                                                                              |

## Efecto medido

Dos plantillas idénticas de nivel 1 juegan 3.000 partidos; solo cambia una táctica del equipo A.
«Diferencia» es la media de puntos a favor menos puntos en contra del equipo A.

| Táctica del equipo A            | % victorias | Diferencia | Efecto principal medido                                                                                               |
| ------------------------------- | ----------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| (todo por defecto)              | 49,7        | +0,1       | —                                                                                                                     |
| Ritmo rápido                    | 48,7        | −0,6       | 77,5 posesiones (frente a 72,2); 13,9 pérdidas (frente a 12,5)                                                        |
| Ritmo lento                     | 51,1        | +0,4       | 67,9 posesiones; 11,4 pérdidas                                                                                        |
| Foco interior                   | 47,9        | −0,5       | 30 % de sus tiros son triples (frente a 43 %); 20,8 tiros libres (frente a 18,4)                                      |
| Foco exterior                   | 53,6        | +1,2       | 56,5 % de sus tiros son triples; 16,3 tiros libres                                                                    |
| Zona                            | 47,1        | −0,7       | Comete 16,2 faltas (frente a 19,0); el rival tira 48 % de triples (frente a 44 %) y 14,1 tiros libres (frente a 18,3) |
| Bloqueo directo: hundirse       | 51,5        | +0,4       | El 18,4 % de los tiros rivales son de media distancia (frente a 15,8 %)                                               |
| Bloqueo directo: cambiar        | 52,6        | +0,8       | El rival tira menos triples (42,8 %)                                                                                  |
| Bloqueo directo: dos contra uno | 49,5        | 0,0        | El rival pierde 13,5 balones (frente a 12,5) pero tira 46 % de triples                                                |
| Presión alta                    | 50,5        | +0,1       | El rival pierde 14,5 balones; el equipo comete 22,0 faltas y concede 21,9 tiros libres                                |
| Presión baja                    | 49,8        | −0,1       | El rival pierde 11,1 balones; el equipo comete 16,9 faltas                                                            |
| Cargar el rebote                | 52,3        | +0,8       | 11,6 rebotes ofensivos (frente a 9,7); concede 11,3 puntos al contraataque (frente a 6,3)                             |
| Replegar                        | 46,7        | −0,9       | 8,3 rebotes ofensivos; concede 3,0 puntos al contraataque                                                             |
| Rotación de 8                   | 52,1        | +0,6       | Los titulares juegan más                                                                                              |
| Rotación de 11                  | 51,0        | +0,2       | Más jugadores reparten minutos                                                                                        |

## Cómo leer la tabla

- **Ninguna táctica gana siempre.** Con plantillas iguales, todas quedan a menos de 1,5 puntos de
  la opción por defecto. Un test impide que alguna supere los 3 puntos.
- **La táctica debe encajar con la plantilla.** Estas cifras son para un equipo medio. Con buenos
  tiradores el foco exterior rinde más; con pívots lentos, «cambiar» en el bloqueo directo rinde
  menos. Eso es lo que hará interesante elegir.
- **Margen de error:** con 3.000 partidos, diferencias de victorias menores de unos 2 puntos
  porcentuales pueden deberse al azar.

## Sucesos del partido (T-028)

Todo sale del registro de eventos, y todo tiene efecto en el partido. Cifras medidas en
[`benchmarks/T-028-calibracion.md`](benchmarks/T-028-calibracion.md) (nivel 1, 3 universos).

| Suceso               | Cómo funciona                                                                                                                                                                                | Medido por partido                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Salto inicial        | Gana más a menudo el equipo con el jugador más alto y que más salta (entre 30 y 70 %). La flecha de posesión apunta al que lo pierde.                                                        | gana el partido el 51–54 % de las veces |
| Balón retenido       | El equipo al que apunta la flecha recibe el balón y la flecha cambia. También decide quién empieza cada periodo.                                                                             | ≈ 1                                     |
| Tiempos muertos      | Cupos del reglamento (FIBA 2 + 3 + 1). Los pide el entrenador para cortar una racha de 8 puntos, al final del partido si va por detrás, o para descansar. Los dos equipos recuperan energía. | 5,6 (los dos equipos)                   |
| Racha                | Más de 5 puntos seguidos dan un pequeño bonus de tiro (máximo 1,2 %); un tiempo muerto la corta.                                                                                             | —                                       |
| Lesión en el partido | Riesgo por posesión que sube con la fatiga. El jugador sale al instante y se pierde de 1 a 80 partidos.                                                                                      | 0,16–0,18                               |
| Falta técnica        | 1 tiro libre y posesión para el rival; cuenta como falta del jugador, no del equipo.                                                                                                         | 0,2                                     |
| Falta antideportiva  | 2 tiros libres y posesión; cuenta como falta de equipo.                                                                                                                                      | 0,13                                    |
| Expulsión            | 2 faltas de conducta (técnica o antideportiva) expulsan al jugador.                                                                                                                          | 0,01–0,02                               |

**Entre partidos:** el jugador lesionado no juega. Recupera un partido por cada partido de su equipo
y 30 en la offseason. Si un equipo tiene menos de 8 jugadores sanos, los menos lesionados juegan
(`PLACEHOLDER`). En la web, la plantilla del usuario muestra «lesionado N partidos».

**Limitaciones:** las cifras de lesiones y faltas son objetivos de diseño de conocimiento general,
no datos verificados; el entrenador que pide los tiempos muertos y hace los cambios sigue siendo un
`PLACEHOLDER`; no hay tipos de lesión ni recaídas, ni falta descalificante directa.

## Limitaciones conocidas

- El foco exterior y «cambiar» salen ligeramente favorecidos y «replegar» ligeramente perjudicado
  para un equipo medio. Está dentro del margen aceptado, pero conviene revisarlo cuando haya datos
  reales.
- Quién elige la táctica de cada club es un `PLACEHOLDER`: una regla simple según la plantilla, con
  algo de azar. No hay entrenadores todavía.
- No hay tácticas por jugador (a quién defender, quién lanza al final) ni cambios de táctica
  durante el partido (los tiempos muertos solo dan descanso y cortan rachas).
