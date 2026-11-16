# Estabilidad del modelo de desarrollo de jugadores (T-004)

> Generado por `pnpm stability --write`. Universo con semilla `stability-t004`, 30 temporadas
> seguidas (con ascensos, descensos, retiradas y sustitución por jóvenes). Entorno: Intel(R) Xeon(R) Processor @ 2.10GHz, Node v22.23.4.

## Qué se mide

La «habilidad» de un jugador es la media de sus 20 atributos (escala 1–99). Un modelo sano mantiene
estables la habilidad media de cada nivel, la edad media y el reparto de edades; si se inflan o se
hunden, las estadísticas de la liga se desvían con los años.

## Resumen

| Magnitud | Temporada 0 | Temporada 30 | Cambio |
| --- | --- | --- | --- |
| Habilidad media N1 | 70.8 | 71.5 | 0.7 |
| Habilidad media N2 | 63.6 | 64.2 | 0.6 |
| Habilidad media N3 | 55.0 | 54.3 | -0.7 |
| Habilidad media N4 | 46.4 | 46.5 | 0.1 |
| Habilidad media de los 10 mejores por equipo N1 | 72.9 | 73.9 | 1.0 |
| Habilidad media de los 10 mejores por equipo N2 | 66.1 | 66.7 | 0.6 |
| Habilidad media de los 10 mejores por equipo N3 | 57.2 | 56.9 | -0.3 |
| Habilidad media de los 10 mejores por equipo N4 | 48.5 | 48.7 | 0.2 |
| Edad media | 26.9 | 27.1 | 0.1 |
| % menores de 22 | 18.4 | 19.0 | 0.7 |
| % mayores de 32 | 18.2 | 18.7 | 0.5 |
| Potencial medio | 54.3 | 54.5 | 0.2 |

Retiradas por temporada (media de las temporadas 1–30): 157.5 jugadores de 202 equipos.
Edad en la que la habilidad media es máxima (mundo final, edades con 15 o más jugadores): 28 años.

## Curva de carrera (mundo final)

Habilidad de los jugadores de cada edad **respecto a la media de su nivel** (0 = media del nivel).

| Edad | Jugadores | Habilidad relativa |
| --- | --- | --- |
| 18 | 53 | -7.3 |
| 19 | 134 | -4.7 |
| 20 | 172 | -2.3 |
| 21 | 157 | -0.9 |
| 22 | 148 | -1.0 |
| 23 | 159 | 0.2 |
| 24 | 149 | 1.1 |
| 25 | 155 | 0.9 |
| 26 | 156 | 1.5 |
| 27 | 138 | 1.7 |
| 28 | 157 | 2.4 |
| 29 | 148 | 2.3 |
| 30 | 137 | 2.0 |
| 31 | 153 | 1.7 |
| 32 | 188 | 0.6 |
| 33 | 161 | 1.1 |
| 34 | 152 | -0.4 |
| 35 | 85 | -1.6 |
| 36 | 68 | -3.4 |
| 37 | 30 | -5.0 |
| 38 | 9 | -5.1 |
| 39 | 1 | -14.8 |

## Evolución temporada a temporada

| Temp. | Hab. N1 | Hab. N2 | Hab. N3 | Hab. N4 | Edad | <22 % | >32 % | Retiros | Tiempo (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 70.8 | 63.6 | 55.0 | 46.4 | 26.9 | 18.4 | 18.2 | – | – |
| 1 | 71.2 | 64.4 | 55.6 | 46.2 | 27.0 | 17.9 | 17.8 | 147 | 2055 |
| 2 | 71.5 | 64.2 | 55.6 | 46.2 | 27.2 | 16.4 | 18.7 | 132 | 2107 |
| 3 | 71.7 | 64.0 | 55.6 | 46.2 | 27.1 | 16.3 | 18.1 | 167 | 1987 |
| 4 | 72.1 | 64.0 | 55.7 | 46.2 | 27.1 | 16.9 | 17.7 | 157 | 1933 |
| 5 | 72.4 | 63.8 | 54.8 | 46.3 | 27.1 | 17.1 | 17.8 | 157 | 1981 |
| 6 | 72.1 | 63.7 | 55.8 | 46.2 | 27.1 | 17.9 | 17.3 | 163 | 2140 |
| 7 | 72.2 | 63.5 | 55.4 | 46.3 | 27.3 | 17.1 | 18.8 | 132 | 2210 |
| 8 | 72.0 | 64.0 | 55.4 | 46.3 | 27.3 | 16.6 | 19.1 | 155 | 2001 |
| 9 | 72.1 | 63.3 | 55.7 | 46.2 | 27.3 | 16.6 | 19.6 | 149 | 2233 |
| 10 | 72.1 | 64.0 | 54.9 | 46.3 | 27.2 | 17.5 | 19.0 | 178 | 2202 |
| 11 | 71.9 | 63.7 | 55.4 | 46.2 | 27.1 | 18.2 | 18.8 | 165 | 2212 |
| 12 | 72.0 | 63.7 | 54.8 | 46.4 | 27.1 | 18.4 | 18.7 | 163 | 2343 |
| 13 | 72.0 | 63.9 | 54.7 | 46.5 | 27.1 | 18.2 | 19.1 | 163 | 2327 |
| 14 | 71.8 | 63.8 | 55.2 | 46.4 | 27.1 | 18.0 | 19.3 | 164 | 2226 |
| 15 | 72.1 | 63.6 | 54.7 | 46.5 | 27.0 | 18.0 | 18.5 | 160 | 2461 |
| 16 | 72.0 | 63.5 | 55.1 | 46.5 | 27.0 | 17.8 | 18.0 | 167 | 2286 |
| 17 | 72.2 | 63.9 | 54.9 | 46.6 | 26.9 | 18.5 | 17.0 | 168 | 2149 |
| 18 | 71.7 | 64.3 | 54.6 | 46.6 | 26.9 | 18.1 | 16.7 | 163 | 2161 |
| 19 | 72.1 | 63.8 | 54.9 | 46.6 | 26.9 | 17.9 | 17.1 | 156 | 1992 |
| 20 | 72.1 | 64.5 | 54.4 | 46.8 | 27.0 | 16.1 | 17.4 | 140 | 2249 |
| 21 | 72.3 | 64.0 | 54.4 | 46.8 | 27.1 | 16.1 | 17.5 | 153 | 2299 |
| 22 | 72.3 | 64.0 | 54.4 | 46.8 | 27.2 | 16.4 | 17.5 | 145 | 2120 |
| 23 | 72.3 | 64.0 | 54.6 | 46.7 | 27.3 | 16.0 | 18.3 | 136 | 2196 |
| 24 | 72.3 | 63.8 | 54.5 | 46.7 | 27.3 | 15.9 | 18.7 | 156 | 2137 |
| 25 | 72.1 | 64.5 | 54.6 | 46.6 | 27.3 | 16.8 | 19.1 | 160 | 2127 |
| 26 | 71.9 | 64.4 | 54.6 | 46.7 | 27.3 | 17.1 | 18.9 | 165 | 2202 |
| 27 | 72.1 | 63.9 | 54.6 | 46.6 | 27.3 | 17.1 | 19.5 | 156 | 2208 |
| 28 | 71.5 | 64.5 | 54.5 | 46.5 | 27.4 | 16.9 | 19.7 | 144 | 2094 |
| 29 | 71.4 | 64.8 | 54.4 | 46.5 | 27.2 | 17.6 | 19.6 | 178 | 2413 |
| 30 | 71.5 | 64.2 | 54.3 | 46.5 | 27.1 | 19.0 | 18.7 | 186 | 2106 |
