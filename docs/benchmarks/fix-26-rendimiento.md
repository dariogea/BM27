# Rendimiento tras la corrección #26

> Ejecutado por Claude con `pnpm bench` sobre la rama de la corrección. La herramienta escribe siempre `T-006.md`; se ha restaurado ese archivo para no sobrescribir el informe de T-006 y el resultado se guarda aquí. Codex repitió la prueba por su lado (Node 24, otra CPU) y confirmó por comentario en el PR que corre sin errores; sus cifras absolutas difieren por el entorno, y las del tamaño de guardado (16,77 MB) coinciden.

## Entorno de la medición

- Fecha: 2026-11-16T19:31:06.242Z
- CPU: Intel(R) Xeon(R) Processor @ 2.10GHz · 4 núcleos lógicos (la simulación usa 1 solo hilo)
- Memoria RAM total: 15.7 GB
- Sistema: linux 6.18.44-fc-v470 (x64), contenedor en la nube (máquina virtual compartida)
- Node.js v22.23.4 · ejecutado con `tsx` (TypeScript sin compilar previamente)
- Semilla: `bench-t001` · Universo: 202 equipos, 2781 jugadores (generado en 126 ms)
- Motor de partido: v1 con jugadores que se desarrollan (T-004) mercado (T-005) y finanzas (T-006), entrenador PLACEHOLDER. Misma semilla y mismas pruebas que en T-001 para poder comparar.

## Resultados

| Prueba | Qué mide | Resultado |
| --- | --- | --- |
| B1 | Temporada completa del nivel 1 (328 partidos, liga + playoffs) | **223 ms** (mediana de 5; mín 209, máx 260) |
| B2 | Temporada completa de todo el universo (2820 partidos) + ascensos/descensos y envejecimiento | **2160 ms** (mediana de 5; mín 2037, máx 2275) |
| B3 | 10 temporadas seguidas de todo el universo (28206 partidos) | **21.48 s** en total · media 2148 ms por temporada |
| B3 | Memoria (heap de JavaScript tras recolección de basura) | inicio **18.2 MB** → final **32.2 MB** |
| B4 | Tamaño del guardado JSON tras 10 temporadas | **16.77 MB** (17.583.081 bytes) |

Velocidad media en B2: 1305 partidos por segundo en un solo hilo (cada partido genera su registro completo de eventos y de él se deriva el box score).

### B3 · Detalle por temporada

| Temporada | Tiempo (ms) | Heap tras la temporada (MB) |
| --- | --- | --- |
| 1 | 1998 | 20.9 |
| 2 | 2072 | 22.1 |
| 3 | 2264 | 23.5 |
| 4 | 1866 | 24.9 |
| 5 | 2087 | 26.1 |
| 6 | 2208 | 27.4 |
| 7 | 2156 | 28.7 |
| 8 | 2195 | 29.8 |
| 9 | 2376 | 31.0 |
| 10 | 2261 | 32.2 |

- Tiempo: la temporada más lenta fue 2376 ms y la más rápida 1866 ms. La temporada 10 tardó 2261 ms frente a 1998 ms de la primera.
- Memoria: crece 1.4 MB por temporada de media. Ese crecimiento es el historial que se conserva a propósito (resultados de todos los partidos, clasificaciones y estadísticas de temporada por jugador), no una fuga: es proporcional al tamaño del guardado.
- Memoria total del proceso (RSS, incluye Node y el compilador): 162 MB al inicio de B3 → 160 MB al final.

### B4 · Detalle del guardado

- Universo recién generado (0 temporadas): 1.63 MB.
- Tras 10 temporadas: 16.77 MB → unas 1.51 MB por temporada.
- Exportar (serializar + checksum SHA-256): 453 ms. Importar (leer + verificar checksum + validar esquema): 696 ms.
- Qué contiene: equipos, jugadores (incluidos los retirados), competiciones y, por cada temporada, clasificaciones, resultado de cada partido, series de playoff y estadísticas acumuladas por jugador.
- Qué NO contiene: el registro de eventos ni el box score de cada partido. Se pueden reconstruir de forma idéntica re-simulando el partido con su semilla mientras la temporada esté en curso, pero no se guardan. JSON sin comprimir ni sangrado.

## Comparación con tareas anteriores

| Prueba | T-001 | T-002 | T-004 | T-005 | Ahora |
| --- | --- | --- | --- | --- | --- |
| B1 · temporada del nivel 1 | 143 ms | 209 ms | 215 ms | 208 ms | 223 ms |
| B2 · temporada de todo el universo | 1260 ms | 1732 ms | 2003 ms | 2000 ms | 2160 ms |
| B3 · 10 temporadas | 12,14 s | 19,32 s | 20,92 s | 21,68 s | 21.48 s |
| B3 · memoria al final | 28,2 MB | 29,7 MB | 32,8 MB | 31,7 MB | 32.2 MB |
| B4 · guardado tras 10 temporadas | 13,89 MB | 15,60 MB | 15,87 MB | 16,29 MB | 16.77 MB |

Las cifras anteriores son las registradas en `T-001.md`, `T-002.md`, `T-004.md` y `T-005.md`, medidas en un contenedor equivalente pero en otra ejecución; la comparación es orientativa. T-002 es anterior a la temporada paso a paso (T-003) y a la progresión de jugadores (T-004).

La calibración del motor (medias de liga frente a bandas de referencia) está en `T-006-calibracion.md`, y la estabilidad a largo plazo del mundo en `T-006-estabilidad.md`.
