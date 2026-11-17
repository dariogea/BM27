# Benchmarks 18-despues

> Archivo generado automáticamente por `pnpm bench`. Las cifras son mediciones reales de la
> ejecución indicada abajo, no estimaciones. Para repetirlas: `pnpm install && pnpm bench`.

## Entorno de la medición

- Fecha: 2026-11-17T13:28:47.776Z
- CPU: AMD EPYC 9V74 80-Core Processor · 5 núcleos lógicos (la simulación usa 1 solo hilo)
- Memoria RAM total: 33.3 GB
- Sistema: linux 6.18.57 (x64), contenedor en la nube (máquina virtual compartida)
- Node.js v24.22.1 · ejecutado con `tsx` (TypeScript sin compilar previamente)
- Semilla: `bench-t001` · Universo: 202 equipos, 2781 jugadores (generado en 116 ms)
- Motor de partido: v1 con jugadores que se desarrollan (T-004), mercado (T-005), finanzas (T-006) y sucesos del partido (T-028: tiempos muertos, lesiones, técnicas y salto), entrenador PLACEHOLDER. Misma semilla y mismas pruebas que en T-001 para poder comparar.

## Resultados

| Prueba | Qué mide | Resultado |
| --- | --- | --- |
| B1 | Temporada completa del nivel 1 (325 partidos, liga + playoffs) | **231 ms** (mediana de 5; mín 213, máx 246) |
| B2 | Temporada completa de todo el universo (2819 partidos) + ascensos/descensos y envejecimiento | **2167 ms** (mediana de 5; mín 2113, máx 2291) |
| B3 | 10 temporadas seguidas de todo el universo (28207 partidos) | **22.60 s** en total · media 2260 ms por temporada |
| B3 | Memoria (heap de JavaScript tras recolección de basura) | inicio **21.6 MB** → final **35.8 MB** |
| B4 | Tamaño del guardado JSON tras 10 temporadas | **16.86 MB** (17.680.345 bytes) |

Velocidad media en B2: 1301 partidos por segundo en un solo hilo (cada partido genera su registro completo de eventos y de él se deriva el box score).

### B3 · Detalle por temporada

| Temporada | Tiempo (ms) | Heap tras la temporada (MB) |
| --- | --- | --- |
| 1 | 2343 | 24.1 |
| 2 | 2158 | 25.6 |
| 3 | 2286 | 26.9 |
| 4 | 2149 | 28.3 |
| 5 | 2296 | 29.5 |
| 6 | 2140 | 30.9 |
| 7 | 2201 | 32.0 |
| 8 | 2353 | 33.3 |
| 9 | 2397 | 34.4 |
| 10 | 2275 | 35.8 |

- Tiempo: la temporada más lenta fue 2397 ms y la más rápida 2140 ms. La temporada 10 tardó 2275 ms frente a 2343 ms de la primera.
- Memoria: crece 1.4 MB por temporada de media. Ese crecimiento es el historial que se conserva a propósito (resultados de todos los partidos, clasificaciones y estadísticas de temporada por jugador), no una fuga: es proporcional al tamaño del guardado.
- Memoria total del proceso (RSS, incluye Node y el compilador): 238 MB al inicio de B3 → 241 MB al final.

### B4 · Detalle del guardado

- Universo recién generado (0 temporadas): 1.67 MB.
- Tras 10 temporadas: 16.86 MB → unas 1.52 MB por temporada.
- Exportar (serializar + checksum SHA-256): 471 ms. Importar (leer + verificar checksum + validar esquema): 768 ms.
- Qué contiene: equipos, jugadores (incluidos los retirados), competiciones y, por cada temporada, clasificaciones, resultado de cada partido, series de playoff y estadísticas acumuladas por jugador.
- Qué NO contiene: el registro de eventos ni el box score de cada partido. Una repetición fiel requiere conservar o verificar el estado original del encuentro; la semilla y el marcador no bastan. JSON sin comprimir ni sangrado.

## Comparación con tareas anteriores

| Prueba | T-001 | T-002 | T-004 | T-005 | Ahora |
| --- | --- | --- | --- | --- | --- |
| B1 · temporada del nivel 1 | 143 ms | 209 ms | 215 ms | 208 ms | 231 ms |
| B2 · temporada de todo el universo | 1260 ms | 1732 ms | 2003 ms | 2000 ms | 2167 ms |
| B3 · 10 temporadas | 12,14 s | 19,32 s | 20,92 s | 21,68 s | 22.60 s |
| B3 · memoria al final | 28,2 MB | 29,7 MB | 32,8 MB | 31,7 MB | 35.8 MB |
| B4 · guardado tras 10 temporadas | 13,89 MB | 15,60 MB | 15,87 MB | 16,29 MB | 16.86 MB |

Las cifras anteriores son las registradas en `T-001.md`, `T-002.md`, `T-004.md` y `T-005.md`, medidas en un contenedor equivalente pero en otra ejecución; la comparación es orientativa. T-002 es anterior a la temporada paso a paso (T-003) y a la progresión de jugadores (T-004).

La calibración del motor (medias de liga frente a bandas de referencia) está en `18-despues-calibracion.md`, y la estabilidad a largo plazo del mundo en `18-despues-estabilidad.md`.
