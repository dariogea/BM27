# Corrección de faltas técnicas — #63

El motor confundía dos sanciones: daba posesión al rival después de una técnica de jugador y la
excluía de las faltas del equipo. Ahora concede un tiro libre al rival, conserva el derecho previo al
balón y cuenta la técnica para el bonus. La antideportiva conserva dos tiros y posesión para el rival.

## Regresiones demostradas

Antes de corregir, el test de reanudación fallaba: una técnica cometida por B con posesión previa B
hacía reanudar a A. Después de corregir la reanudación, una segunda prueba falló porque una falta
personal que debía estar en bonus seguía sin conceder tiros libres: la técnica previa no se contaba.
Ambos casos pasan con la corrección.

La prueba reconstruye las faltas por equipo y periodo, incluyendo las prórrogas, y verifica casos en
que la técnica cambia el momento de entrar en bonus. También comprueba el equipo que lanza cada
penalización, técnicas ofensivas y defensivas, antideportivas, expulsión y determinismo del registro
completo de un partido con técnica ofensiva.

La prueba antigua titulada «no cuenta como falta de equipo» solo exigía que hubiera más de diez
eventos de falta; no comprobaba el bonus. Se ha sustituido por esa comprobación real. La expulsión
usa, además del lote de 300 partidos, una semilla explícita de caso raro, sin rebajar su aserción.

## Alcance reglamentario

Referencia: reglas FIBA, art. 36.3.2. Las técnicas actuales son de **jugador**. No se modelan técnicas
de entrenador/banquillo y no se confunden con aquellas. La página de FIBA no fue accesible desde
la red del entorno (el proxy rechazó la conexión); no se declara una consulta nueva de su contenido.

El motor mantiene una aproximación por fases de la posesión; la técnica ya no la cambia a un reset
como el de un rebote ofensivo. Un balón parado tampoco continúa un contraataque. `nba-like` sigue
siendo una aproximación de tiempos y cupos, no un reglamento NBA completo de sanciones.

No cambia el contrato v6 ni la API pública. Una semilla produce resultados distintos frente al
algoritmo anterior, pero idénticos dentro de esta versión. El guardado continúa siendo legible; la
repetición web mantiene la exigencia de verificar las entradas originales.

## Mediciones y límites

Informes independientes, conservando los anteriores:

- [Rendimiento](../benchmarks/63.md): `pnpm bench --task 63`.
- [Calibración](../benchmarks/63-calibracion.md): `pnpm calibrate --task 63 --write`.
- [Estabilidad a 30 temporadas](../benchmarks/63-estabilidad.md): `pnpm stability --task 63 --write`.

La calibración compara simulación contra bandas de conocimiento general; no constituye validación
con datos oficiales. La estabilidad conserva el problema conocido de pérdida de calidad en la élite
(#19); esta corrección no se presenta como su solución. Las comparaciones de tiempos con informes
antiguos son orientativas porque el entorno y la ejecución son diferentes.

Validación final: **258/258 pruebas** (`pnpm test --maxWorkers=2`), incluidos 21 tests de sucesos.
Lint, formato, TypeScript, build y `roadmap:check` correctos. En nivel 1, las 14 magnitudes de
calibración están en sus bandas de referencia; una temporada de todo el universo tarda 2513 ms
(mediana de cinco, entorno indicado en el informe). La prueba de estabilidad completó las 30
temporadas: los diez mejores jugadores por equipo de nivel 1 bajan de 75,9 a 72,8 de habilidad media
(redondeo del cambio: −3,2), coherente con el problema abierto #19.
