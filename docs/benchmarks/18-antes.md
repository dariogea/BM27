# Benchmarks 18-antes

> Archivo generado automáticamente por `pnpm bench`. Las cifras son mediciones reales de la
> ejecución indicada abajo, no estimaciones. Para repetirlas: `pnpm install && pnpm bench`.

## Entorno de la medición

- Fecha: 2026-11-17T13:24:13.846Z
- CPU: AMD EPYC 9V74 80-Core Processor · 5 núcleos lógicos (la simulación usa 1 solo hilo)
- Memoria RAM total: 33.3 GB
- Sistema: linux 6.18.57 (x64), contenedor en la nube (máquina virtual compartida)
- Node.js v24.22.1 · ejecutado con `tsx` (TypeScript sin compilar previamente)
- Semilla: `bench-t001` · Universo: 202 equipos, 2781 jugadores (generado en 168 ms)
- Motor de partido: v1 con jugadores que se desarrollan (T-004), mercado (T-005), finanzas (T-006) y sucesos del partido (T-028: tiempos muertos, lesiones, técnicas y salto), entrenador PLACEHOLDER. Misma semilla y mismas pruebas que en T-001 para poder comparar.

## Resultados

| Prueba | Qué mide | Resultado |
| --- | --- | --- |
| B1 | Temporada completa del nivel 1 (325 partidos, liga + playoffs) | **252 ms** (mediana de 5; mín 245, máx 266) |
| B2 | Temporada completa de todo el universo (2819 partidos) + ascensos/descensos y envejecimiento | **2527 ms** (mediana de 5; mín 2332, máx 2728) |
| B3 | 10 temporadas seguidas de todo el universo (28207 partidos) | **26.11 s** en total · media 2611 ms por temporada |
| B3 | Memoria (heap de JavaScript tras recolección de basura) | inicio **23.1 MB** → final **37.3 MB** |
| B4 | Tamaño del guardado JSON tras 10 temporadas | **16.86 MB** (17.680.345 bytes) |

Velocidad media en B2: 1115 partidos por segundo en un solo hilo (cada partido genera su registro completo de eventos y de él se deriva el box score).

### B3 · Detalle por temporada

| Temporada | Tiempo (ms) | Heap tras la temporada (MB) |
| --- | --- | --- |
| 1 | 2638 | 25.6 |
| 2 | 2502 | 27.1 |
| 3 | 2628 | 28.4 |
| 4 | 2703 | 29.8 |
| 5 | 2606 | 31.0 |
| 6 | 2601 | 32.4 |
| 7 | 2697 | 33.5 |
| 8 | 2593 | 34.9 |
| 9 | 2589 | 36.0 |
| 10 | 2557 | 37.3 |

- Tiempo: la temporada más lenta fue 2703 ms y la más rápida 2502 ms. La temporada 10 tardó 2557 ms frente a 2638 ms de la primera.
- Memoria: crece 1.4 MB por temporada de media. Ese crecimiento es el historial que se conserva a propósito (resultados de todos los partidos, clasificaciones y estadísticas de temporada por jugador), no una fuga: es proporcional al tamaño del guardado.
- Memoria total del proceso (RSS, incluye Node y el compilador): 257 MB al inicio de B3 → 258 MB al final.

### B4 · Detalle del guardado

- Universo recién generado (0 temporadas): 1.67 MB.
- Tras 10 temporadas: 16.86 MB → unas 1.52 MB por temporada.
- Exportar (serializar + checksum SHA-256): 440 ms. Importar (leer + verificar checksum + validar esquema): 764 ms.
- Qué contiene: equipos, jugadores (incluidos los retirados), competiciones y, por cada temporada, clasificaciones, resultado de cada partido, series de playoff y estadísticas acumuladas por jugador.
- Qué NO contiene: el registro de eventos ni el box score de cada partido. Una repetición fiel requiere conservar o verificar el estado original del encuentro; la semilla y el marcador no bastan. JSON sin comprimir ni sangrado.

## Comparación con tareas anteriores

| Prueba | T-001 | T-002 | T-004 | T-005 | Ahora |
| --- | --- | --- | --- | --- | --- |
| B1 · temporada del nivel 1 | 143 ms | 209 ms | 215 ms | 208 ms | 252 ms |
| B2 · temporada de todo el universo | 1260 ms | 1732 ms | 2003 ms | 2000 ms | 2527 ms |
| B3 · 10 temporadas | 12,14 s | 19,32 s | 20,92 s | 21,68 s | 26.11 s |
| B3 · memoria al final | 28,2 MB | 29,7 MB | 32,8 MB | 31,7 MB | 37.3 MB |
| B4 · guardado tras 10 temporadas | 13,89 MB | 15,60 MB | 15,87 MB | 16,29 MB | 16.86 MB |

Las cifras anteriores son las registradas en `T-001.md`, `T-002.md`, `T-004.md` y `T-005.md`, medidas en un contenedor equivalente pero en otra ejecución; la comparación es orientativa. T-002 es anterior a la temporada paso a paso (T-003) y a la progresión de jugadores (T-004).

La calibración del motor (medias de liga frente a bandas de referencia) está en `18-despues-calibracion.md`, y la estabilidad a largo plazo del mundo en `18-despues-estabilidad.md`.

Esta línea base se midió antes de optimizar #18. Las referencias finales enlazadas se ejecutan después del cambio; no se afirma que se haya ejecutado una segunda calibración o estabilidad anterior.
