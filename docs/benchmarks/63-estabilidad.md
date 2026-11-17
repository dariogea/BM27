# Estabilidad del mundo: desarrollo, mercado, finanzas y lesiones (63)

> Generado por `pnpm stability --write`. Universo con semilla `stability-t004`, 30 temporadas
> seguidas (con ascensos, descensos, retiradas y sustitución por jóvenes). Entorno: AMD EPYC 9V74 80-Core Processor, Node v24.22.1.

## Qué se mide

La «habilidad» de un jugador es la media de sus 20 atributos (escala 1–99). Un modelo sano mantiene
estables la habilidad media de cada nivel, la edad media y el reparto de edades; si se inflan o se
hunden, las estadísticas de la liga se desvían con los años.

## Resumen

| Magnitud | Temporada 0 | Temporada 30 | Cambio |
| --- | --- | --- | --- |
| Habilidad media N1 | 73.6 | 71.2 | -2.4 |
| Habilidad media N2 | 62.6 | 63.1 | 0.5 |
| Habilidad media N3 | 55.0 | 54.6 | -0.4 |
| Habilidad media N4 | 46.0 | 45.9 | -0.1 |
| Habilidad media de los 10 mejores por equipo N1 | 75.9 | 72.8 | -3.2 |
| Habilidad media de los 10 mejores por equipo N2 | 64.9 | 64.7 | -0.2 |
| Habilidad media de los 10 mejores por equipo N3 | 57.4 | 56.2 | -1.2 |
| Habilidad media de los 10 mejores por equipo N4 | 48.3 | 47.4 | -0.9 |
| Edad media | 27.2 | 27.2 | 0.1 |
| % menores de 22 | 18.0 | 16.5 | -1.5 |
| % mayores de 32 | 18.6 | 17.8 | -0.8 |
| Potencial medio | 54.2 | 53.7 | -0.5 |

Mercado (media de las temporadas 1–30): 323.7 contratos cumplidos y no renovados, 676.1 renovaciones y 453.3 fichajes de agentes libres por temporada.
Agentes libres al final de cada temporada: media 155.1 (mínimo 95, máximo 206).
Masa salarial media respecto al tope, temporada 0 → 30: N1 69 % → 60 %, N2 67 % → 64 %, N3 67 % → 65 %, N4 64 % → 62 %.
Reputación mediana, temporada 0 → 30: N1 70 → 69, N2 51 → 56, N3 39 → 38, N4 25 → 24.
Caja mediana (miles de €), temporada 0 → 30: N1 252 → 5100, N2 142 → 2487, N3 73 → 1596, N4 32 → 1346.
Beneficio mediano sobre ingresos (media de las temporadas 1–30): N1 3.3 %, N2 1.2 %, N3 5.9 %, N4 6.4 %.
Clubes con caja negativa al empezar cada temporada: media 12.8 de 202 (máximo 28); clubes que han superado el descubierto permitido y no pueden asumir salarios: media 1.4 (máximo 4).
Retiradas por temporada (media de las temporadas 1–30): 166.8 jugadores de 202 equipos.
Edad en la que la habilidad media es máxima (mundo final, edades con 15 o más jugadores): 30 años.

## Curva de carrera (mundo final)

Habilidad de los jugadores de cada edad **respecto a la media de su nivel** (0 = media del nivel).

| Edad | Jugadores | Habilidad relativa |
| --- | --- | --- |
| 19 | 38 | -6.8 |
| 20 | 115 | -3.2 |
| 21 | 121 | -2.5 |
| 22 | 112 | -1.3 |
| 23 | 135 | -0.3 |
| 24 | 129 | -0.1 |
| 25 | 142 | 0.4 |
| 26 | 147 | 0.7 |
| 27 | 149 | 0.8 |
| 28 | 151 | 1.0 |
| 29 | 168 | 1.3 |
| 30 | 172 | 1.5 |
| 31 | 157 | 1.0 |
| 32 | 120 | 0.5 |
| 33 | 151 | 0.3 |
| 34 | 105 | 0.2 |
| 35 | 61 | -1.1 |

## Evolución temporada a temporada

| Temp. | Hab. N1 | Hab. N2 | Hab. N3 | Hab. N4 | Edad | <22 % | >32 % | Retiros | Agentes libres | Masa/tope N1 % | Tiempo (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 73.6 | 62.6 | 55.0 | 46.0 | 27.2 | 18.0 | 18.6 | – | 0 | 69 | – |
| 1 | 73.8 | 63.2 | 56.5 | 46.5 | 27.3 | 16.8 | 19.3 | 158 | 95 | 69 | 2688 |
| 2 | 73.7 | 63.6 | 55.7 | 46.9 | 27.3 | 16.7 | 20.5 | 191 | 153 | 71 | 2481 |
| 3 | 73.2 | 64.2 | 56.0 | 47.0 | 27.1 | 17.5 | 19.0 | 201 | 182 | 69 | 2581 |
| 4 | 72.9 | 63.9 | 56.0 | 47.3 | 26.9 | 19.0 | 17.2 | 185 | 206 | 68 | 2485 |
| 5 | 73.1 | 63.7 | 56.2 | 47.1 | 26.8 | 18.6 | 16.3 | 189 | 188 | 70 | 2568 |
| 6 | 72.9 | 63.8 | 56.3 | 47.1 | 26.7 | 18.1 | 16.0 | 158 | 177 | 69 | 2572 |
| 7 | 73.0 | 64.0 | 55.9 | 47.1 | 26.8 | 17.3 | 16.0 | 177 | 178 | 70 | 2464 |
| 8 | 72.6 | 63.9 | 56.1 | 47.0 | 26.8 | 17.4 | 15.9 | 152 | 176 | 68 | 2578 |
| 9 | 73.3 | 63.4 | 55.8 | 47.0 | 27.0 | 16.2 | 16.5 | 145 | 176 | 70 | 2389 |
| 10 | 72.9 | 63.9 | 55.8 | 46.9 | 27.2 | 15.0 | 17.3 | 135 | 166 | 69 | 2300 |
| 11 | 72.9 | 64.1 | 55.7 | 46.8 | 27.2 | 14.9 | 17.1 | 160 | 162 | 68 | 2448 |
| 12 | 73.1 | 63.6 | 55.8 | 46.6 | 27.1 | 16.3 | 15.8 | 195 | 158 | 69 | 2567 |
| 13 | 73.1 | 63.3 | 55.2 | 46.6 | 27.2 | 15.8 | 16.5 | 145 | 154 | 70 | 2444 |
| 14 | 72.8 | 63.2 | 56.2 | 46.4 | 27.3 | 15.2 | 17.6 | 147 | 157 | 67 | 2452 |
| 15 | 72.6 | 63.6 | 55.7 | 46.3 | 27.2 | 16.6 | 16.9 | 181 | 154 | 66 | 2431 |
| 16 | 72.3 | 63.5 | 56.0 | 46.2 | 27.2 | 17.6 | 17.9 | 175 | 153 | 64 | 2390 |
| 17 | 72.1 | 63.8 | 55.6 | 46.1 | 27.2 | 17.4 | 18.9 | 149 | 146 | 64 | 2340 |
| 18 | 72.2 | 63.4 | 55.5 | 46.0 | 27.1 | 17.7 | 18.6 | 181 | 142 | 64 | 2479 |
| 19 | 71.8 | 63.1 | 56.0 | 45.9 | 26.9 | 18.3 | 17.3 | 193 | 147 | 63 | 2401 |
| 20 | 71.8 | 63.5 | 55.6 | 45.9 | 26.9 | 19.1 | 17.4 | 178 | 144 | 64 | 2556 |
| 21 | 71.7 | 63.6 | 56.0 | 45.9 | 26.9 | 18.8 | 17.2 | 178 | 148 | 62 | 2352 |
| 22 | 72.1 | 63.4 | 55.2 | 46.0 | 26.8 | 18.0 | 16.5 | 176 | 144 | 63 | 2549 |
| 23 | 71.8 | 63.5 | 55.9 | 45.9 | 26.9 | 16.8 | 16.6 | 147 | 142 | 62 | 2450 |
| 24 | 71.7 | 63.2 | 54.7 | 46.0 | 26.9 | 16.6 | 16.4 | 161 | 147 | 61 | 2408 |
| 25 | 71.4 | 63.5 | 55.6 | 45.8 | 26.9 | 16.9 | 16.4 | 173 | 142 | 61 | 2422 |
| 26 | 71.9 | 63.0 | 55.1 | 46.0 | 27.0 | 15.9 | 16.3 | 139 | 141 | 62 | 2394 |
| 27 | 71.4 | 63.2 | 55.3 | 46.0 | 27.1 | 15.5 | 16.1 | 149 | 144 | 60 | 2622 |
| 28 | 71.2 | 62.7 | 55.5 | 45.9 | 27.1 | 16.3 | 16.0 | 170 | 141 | 60 | 2540 |
| 29 | 71.2 | 62.9 | 55.3 | 45.9 | 27.1 | 16.0 | 16.7 | 162 | 145 | 59 | 2458 |
| 30 | 71.2 | 63.1 | 54.6 | 45.9 | 27.2 | 16.5 | 17.8 | 153 | 144 | 60 | 2592 |
