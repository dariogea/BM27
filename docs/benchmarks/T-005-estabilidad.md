# Estabilidad del mundo: desarrollo de jugadores y mercado (T-005)

> Generado por `pnpm stability --write`. Universo con semilla `stability-t004`, 30 temporadas
> seguidas (con ascensos, descensos, retiradas y sustitución por jóvenes). Entorno: Intel(R) Xeon(R) Processor @ 2.10GHz, Node v22.23.4.

## Qué se mide

La «habilidad» de un jugador es la media de sus 20 atributos (escala 1–99). Un modelo sano mantiene
estables la habilidad media de cada nivel, la edad media y el reparto de edades; si se inflan o se
hunden, las estadísticas de la liga se desvían con los años.

## Resumen

| Magnitud | Temporada 0 | Temporada 30 | Cambio |
| --- | --- | --- | --- |
| Habilidad media N1 | 73.1 | 71.2 | -1.9 |
| Habilidad media N2 | 64.2 | 62.0 | -2.2 |
| Habilidad media N3 | 54.7 | 53.6 | -1.1 |
| Habilidad media N4 | 46.4 | 45.3 | -1.1 |
| Habilidad media de los 10 mejores por equipo N1 | 75.8 | 72.8 | -3.0 |
| Habilidad media de los 10 mejores por equipo N2 | 66.4 | 63.7 | -2.8 |
| Habilidad media de los 10 mejores por equipo N3 | 57.1 | 55.1 | -2.0 |
| Habilidad media de los 10 mejores por equipo N4 | 48.8 | 46.8 | -2.0 |
| Edad media | 27.0 | 26.9 | -0.1 |
| % menores de 22 | 18.1 | 18.6 | 0.5 |
| % mayores de 32 | 18.0 | 16.4 | -1.6 |
| Potencial medio | 54.5 | 53.1 | -1.3 |

Mercado (media de las temporadas 1–30): 316.1 contratos cumplidos y no renovados, 698.0 renovaciones y 447.5 fichajes de agentes libres por temporada.
Agentes libres al final de cada temporada: media 122.6 (mínimo 86, máximo 134).
Masa salarial media respecto al tope, temporada 0 → 30: N1 74 % → 61 %, N2 76 % → 61 %, N3 69 % → 61 %, N4 71 % → 60 %.
Retiradas por temporada (media de las temporadas 1–30): 165.1 jugadores de 202 equipos.
Edad en la que la habilidad media es máxima (mundo final, edades con 15 o más jugadores): 27 años.

## Curva de carrera (mundo final)

Habilidad de los jugadores de cada edad **respecto a la media de su nivel** (0 = media del nivel).

| Edad | Jugadores | Habilidad relativa |
| --- | --- | --- |
| 19 | 50 | -4.9 |
| 20 | 112 | -3.0 |
| 21 | 141 | -2.3 |
| 22 | 133 | -1.2 |
| 23 | 140 | 0.2 |
| 24 | 132 | 0.6 |
| 25 | 147 | 1.1 |
| 26 | 140 | 1.1 |
| 27 | 156 | 1.2 |
| 28 | 140 | 0.7 |
| 29 | 146 | 0.8 |
| 30 | 147 | 1.1 |
| 31 | 157 | 0.5 |
| 32 | 136 | 0.1 |
| 33 | 141 | 0.4 |
| 34 | 81 | -0.9 |
| 35 | 59 | 0.2 |

## Evolución temporada a temporada

| Temp. | Hab. N1 | Hab. N2 | Hab. N3 | Hab. N4 | Edad | <22 % | >32 % | Retiros | Agentes libres | Masa/tope N1 % | Tiempo (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 73.1 | 64.2 | 54.7 | 46.4 | 27.0 | 18.1 | 18.0 | – | 0 | 74 | – |
| 1 | 73.6 | 64.6 | 56.1 | 46.7 | 27.1 | 16.5 | 17.8 | 158 | 86 | 75 | 1891 |
| 2 | 73.6 | 64.6 | 55.8 | 47.0 | 27.0 | 16.9 | 16.7 | 197 | 123 | 75 | 2206 |
| 3 | 73.2 | 64.8 | 55.8 | 47.2 | 27.0 | 17.7 | 18.4 | 146 | 132 | 75 | 2034 |
| 4 | 73.2 | 64.7 | 56.2 | 47.1 | 27.0 | 17.7 | 17.5 | 176 | 133 | 73 | 2022 |
| 5 | 73.1 | 65.0 | 55.5 | 47.0 | 26.9 | 18.3 | 16.0 | 181 | 134 | 73 | 2174 |
| 6 | 73.0 | 64.9 | 55.6 | 46.9 | 26.9 | 17.5 | 16.3 | 159 | 130 | 71 | 2118 |
| 7 | 73.1 | 64.9 | 55.8 | 46.8 | 27.1 | 16.2 | 16.7 | 138 | 128 | 71 | 2125 |
| 8 | 73.0 | 64.4 | 55.2 | 46.7 | 27.1 | 16.1 | 16.8 | 164 | 127 | 70 | 1990 |
| 9 | 72.5 | 64.8 | 55.2 | 46.5 | 27.2 | 15.3 | 18.0 | 146 | 123 | 67 | 2032 |
| 10 | 72.8 | 64.5 | 55.1 | 46.4 | 27.2 | 15.7 | 17.9 | 156 | 124 | 67 | 1937 |
| 11 | 72.5 | 64.2 | 55.5 | 46.2 | 27.2 | 16.4 | 17.9 | 168 | 127 | 65 | 2118 |
| 12 | 72.3 | 63.5 | 55.1 | 46.1 | 27.1 | 17.7 | 17.9 | 184 | 123 | 65 | 2103 |
| 13 | 72.2 | 63.3 | 55.2 | 45.9 | 27.0 | 18.4 | 17.5 | 177 | 122 | 64 | 2001 |
| 14 | 71.8 | 64.0 | 54.7 | 45.9 | 27.1 | 18.2 | 17.0 | 148 | 127 | 63 | 2005 |
| 15 | 71.9 | 63.5 | 54.9 | 45.8 | 27.1 | 16.8 | 17.8 | 165 | 126 | 64 | 2210 |
| 16 | 72.0 | 63.4 | 54.9 | 45.6 | 27.2 | 16.1 | 18.2 | 153 | 122 | 64 | 2089 |
| 17 | 72.0 | 63.3 | 54.7 | 45.5 | 27.1 | 16.6 | 18.3 | 175 | 124 | 63 | 2276 |
| 18 | 71.6 | 63.6 | 54.7 | 45.4 | 27.0 | 17.8 | 18.5 | 175 | 122 | 63 | 2075 |
| 19 | 72.0 | 63.0 | 55.1 | 45.2 | 27.0 | 17.9 | 17.8 | 173 | 120 | 63 | 2009 |
| 20 | 71.7 | 63.4 | 54.6 | 45.2 | 26.9 | 18.3 | 17.7 | 173 | 121 | 63 | 2154 |
| 21 | 72.0 | 63.2 | 54.5 | 45.2 | 26.9 | 18.0 | 17.0 | 165 | 120 | 63 | 2224 |
| 22 | 71.8 | 63.3 | 54.7 | 45.2 | 26.9 | 18.1 | 16.3 | 164 | 119 | 62 | 2146 |
| 23 | 71.9 | 62.7 | 54.4 | 45.2 | 26.9 | 17.9 | 15.7 | 161 | 124 | 63 | 2196 |
| 24 | 71.7 | 62.7 | 54.5 | 45.3 | 26.9 | 17.7 | 15.9 | 162 | 122 | 63 | 2124 |
| 25 | 71.6 | 63.1 | 53.8 | 45.4 | 27.1 | 16.7 | 16.4 | 143 | 120 | 63 | 2116 |
| 26 | 71.4 | 63.1 | 53.9 | 45.4 | 27.1 | 16.4 | 18.1 | 154 | 119 | 61 | 2065 |
| 27 | 71.5 | 62.4 | 54.1 | 45.3 | 27.1 | 16.7 | 17.9 | 172 | 120 | 61 | 2136 |
| 28 | 71.1 | 62.4 | 53.7 | 45.3 | 27.0 | 17.7 | 17.7 | 174 | 120 | 60 | 2157 |
| 29 | 70.8 | 62.8 | 53.6 | 45.3 | 27.0 | 18.0 | 16.6 | 167 | 119 | 58 | 2387 |
| 30 | 71.2 | 62.0 | 53.6 | 45.3 | 26.9 | 18.6 | 16.4 | 178 | 120 | 61 | 2358 |
