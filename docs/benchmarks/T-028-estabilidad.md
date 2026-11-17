# Estabilidad del mundo: desarrollo, mercado, finanzas y lesiones (T-028)

> Generado por `pnpm stability --write`. Universo con semilla `stability-t004`, 30 temporadas
> seguidas (con ascensos, descensos, retiradas y sustitución por jóvenes). Entorno: Intel(R) Xeon(R) Processor @ 2.10GHz, Node v22.23.4.

## Qué se mide

La «habilidad» de un jugador es la media de sus 20 atributos (escala 1–99). Un modelo sano mantiene
estables la habilidad media de cada nivel, la edad media y el reparto de edades; si se inflan o se
hunden, las estadísticas de la liga se desvían con los años.

## Resumen

| Magnitud | Temporada 0 | Temporada 30 | Cambio |
| --- | --- | --- | --- |
| Habilidad media N1 | 73.6 | 71.7 | -1.9 |
| Habilidad media N2 | 62.6 | 63.6 | 1.0 |
| Habilidad media N3 | 55.0 | 55.4 | 0.4 |
| Habilidad media N4 | 46.0 | 46.4 | 0.4 |
| Habilidad media de los 10 mejores por equipo N1 | 75.9 | 73.1 | -2.8 |
| Habilidad media de los 10 mejores por equipo N2 | 64.9 | 65.0 | 0.1 |
| Habilidad media de los 10 mejores por equipo N3 | 57.4 | 56.9 | -0.5 |
| Habilidad media de los 10 mejores por equipo N4 | 48.3 | 48.0 | -0.3 |
| Edad media | 27.2 | 27.1 | -0.1 |
| % menores de 22 | 18.0 | 16.9 | -1.1 |
| % mayores de 32 | 18.6 | 16.6 | -2.1 |
| Potencial medio | 54.2 | 54.2 | 0.1 |

Mercado (media de las temporadas 1–30): 323.8 contratos cumplidos y no renovados, 667.0 renovaciones y 452.7 fichajes de agentes libres por temporada.
Agentes libres al final de cada temporada: media 174.8 (mínimo 97, máximo 208).
Masa salarial media respecto al tope, temporada 0 → 30: N1 69 % → 63 %, N2 67 % → 67 %, N3 67 % → 70 %, N4 64 % → 66 %.
Reputación mediana, temporada 0 → 30: N1 70 → 70, N2 51 → 55, N3 39 → 39, N4 25 → 25.
Caja mediana (miles de €), temporada 0 → 30: N1 252 → 3540, N2 142 → 1098, N3 73 → 779, N4 32 → 818.
Beneficio mediano sobre ingresos (media de las temporadas 1–30): N1 2.5 %, N2 -2.1 %, N3 1.8 %, N4 2.7 %.
Clubes con caja negativa al empezar cada temporada: media 16.8 de 202 (máximo 26); clubes que han superado el descubierto permitido y no pueden asumir salarios: media 2.2 (máximo 6).
Retiradas por temporada (media de las temporadas 1–30): 168.9 jugadores de 202 equipos.
Edad en la que la habilidad media es máxima (mundo final, edades con 15 o más jugadores): 29 años.

## Curva de carrera (mundo final)

Habilidad de los jugadores de cada edad **respecto a la media de su nivel** (0 = media del nivel).

| Edad | Jugadores | Habilidad relativa |
| --- | --- | --- |
| 19 | 45 | -5.5 |
| 20 | 91 | -2.8 |
| 21 | 137 | -1.8 |
| 22 | 117 | -1.3 |
| 23 | 144 | -0.3 |
| 24 | 136 | -0.0 |
| 25 | 146 | 0.6 |
| 26 | 146 | 1.0 |
| 27 | 139 | 0.7 |
| 28 | 154 | 0.5 |
| 29 | 161 | 1.7 |
| 30 | 149 | 1.1 |
| 31 | 160 | 0.0 |
| 32 | 133 | 0.9 |
| 33 | 137 | 0.3 |
| 34 | 88 | 0.3 |
| 35 | 65 | -0.9 |

## Evolución temporada a temporada

| Temp. | Hab. N1 | Hab. N2 | Hab. N3 | Hab. N4 | Edad | <22 % | >32 % | Retiros | Agentes libres | Masa/tope N1 % | Tiempo (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 73.6 | 62.6 | 55.0 | 46.0 | 27.2 | 18.0 | 18.6 | – | 0 | 69 | – |
| 1 | 73.6 | 63.5 | 56.6 | 46.4 | 27.2 | 16.8 | 19.2 | 158 | 97 | 69 | 3076 |
| 2 | 73.7 | 64.0 | 56.3 | 46.9 | 27.3 | 16.7 | 20.5 | 189 | 159 | 71 | 2874 |
| 3 | 73.6 | 64.1 | 56.2 | 47.0 | 27.0 | 17.7 | 18.9 | 209 | 186 | 70 | 3314 |
| 4 | 73.5 | 63.1 | 56.7 | 47.3 | 26.9 | 18.9 | 17.7 | 181 | 208 | 70 | 3300 |
| 5 | 72.8 | 64.1 | 55.8 | 47.3 | 26.7 | 18.9 | 16.0 | 200 | 205 | 69 | 3266 |
| 6 | 72.9 | 63.6 | 56.1 | 47.3 | 26.8 | 17.6 | 16.5 | 140 | 188 | 70 | 3512 |
| 7 | 72.9 | 64.1 | 56.4 | 47.2 | 26.9 | 16.5 | 16.5 | 162 | 189 | 70 | 3226 |
| 8 | 72.5 | 64.7 | 56.3 | 47.2 | 26.9 | 16.8 | 16.2 | 174 | 185 | 68 | 3667 |
| 9 | 73.2 | 64.1 | 55.9 | 47.2 | 26.9 | 16.3 | 16.0 | 153 | 179 | 71 | 3211 |
| 10 | 72.3 | 64.6 | 56.7 | 47.1 | 27.0 | 16.2 | 16.1 | 155 | 189 | 67 | 3081 |
| 11 | 72.6 | 64.4 | 56.4 | 47.0 | 27.1 | 16.0 | 16.2 | 150 | 183 | 68 | 2918 |
| 12 | 73.3 | 61.7 | 57.2 | 47.2 | 27.1 | 15.9 | 16.2 | 169 | 191 | 72 | 3208 |
| 13 | 72.7 | 64.4 | 56.2 | 47.1 | 27.1 | 16.4 | 16.3 | 164 | 192 | 69 | 3424 |
| 14 | 73.3 | 64.2 | 56.1 | 46.9 | 27.1 | 17.0 | 16.8 | 172 | 175 | 69 | 3692 |
| 15 | 72.7 | 63.5 | 56.6 | 47.0 | 27.2 | 16.8 | 17.0 | 168 | 185 | 67 | 3290 |
| 16 | 73.2 | 63.8 | 56.4 | 46.9 | 27.2 | 16.5 | 18.5 | 166 | 185 | 68 | 3590 |
| 17 | 72.0 | 64.5 | 56.3 | 47.0 | 27.2 | 17.0 | 18.5 | 174 | 190 | 63 | 3483 |
| 18 | 72.2 | 64.1 | 56.0 | 46.8 | 27.0 | 18.1 | 18.2 | 188 | 183 | 65 | 3008 |
| 19 | 72.1 | 64.3 | 56.1 | 46.9 | 27.0 | 17.9 | 17.8 | 169 | 188 | 63 | 3016 |
| 20 | 72.1 | 63.9 | 56.5 | 46.7 | 26.8 | 18.9 | 17.1 | 204 | 185 | 64 | 3193 |
| 21 | 72.2 | 63.5 | 56.3 | 46.8 | 26.8 | 18.5 | 16.3 | 161 | 180 | 65 | 3498 |
| 22 | 72.0 | 64.3 | 56.0 | 46.8 | 26.9 | 18.0 | 16.4 | 158 | 167 | 63 | 3063 |
| 23 | 71.9 | 63.7 | 56.7 | 46.7 | 26.8 | 17.5 | 16.4 | 166 | 173 | 62 | 3164 |
| 24 | 71.8 | 63.4 | 56.0 | 46.8 | 26.8 | 17.4 | 15.8 | 170 | 163 | 63 | 3053 |
| 25 | 71.8 | 63.5 | 55.9 | 46.7 | 26.9 | 17.2 | 15.7 | 150 | 159 | 62 | 2826 |
| 26 | 71.5 | 63.5 | 55.9 | 46.7 | 27.0 | 16.6 | 16.2 | 162 | 159 | 61 | 2949 |
| 27 | 71.7 | 63.1 | 56.1 | 46.7 | 27.1 | 16.3 | 16.6 | 150 | 154 | 63 | 2867 |
| 28 | 71.8 | 63.4 | 55.4 | 46.6 | 27.1 | 16.5 | 17.0 | 169 | 147 | 62 | 2737 |
| 29 | 71.8 | 63.0 | 55.8 | 46.5 | 27.1 | 16.0 | 16.7 | 164 | 155 | 63 | 3248 |
| 30 | 71.7 | 63.6 | 55.4 | 46.4 | 27.1 | 16.9 | 16.6 | 173 | 146 | 63 | 3398 |
