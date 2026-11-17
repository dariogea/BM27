# Base española: objetivo y procedencia

## Dirección fijada por el propietario (17-11-2026)

BM27 quiere representar el baloncesto español reconocible, con competiciones, clubes y jugadores
basados en el mundo real. Esto sustituye la decisión inicial de que el producto fuese enteramente
ficticio. La **demo actual sigue usando clubes y jugadores generados**: no se presenta como una base
oficial ni como plantillas reales.

La temporada de referencia propuesta es 2026-27. Deben verificarse sus participantes y reglamentos
antes de incorporarlos; no se ha certificado aún esa temporada. Cambiar algunos nombres es una
herramienta de presentación, no una garantía de derechos de uso sobre datos, marcas o imágenes.

## Primer catálogo preparado

[`catalog-plan.json`](../../data/reference/es/catalog-plan.json) registra fuentes, niveles, campos de
identidad y el ejemplo de alias dado por el propietario. Está marcado como **research** y contiene
cero clubes y jugadores importados. Todavía no modifica la partida ni se carga como paquete del motor.

Cada registro deberá separar:

- Identidad estable, referencia contrastada y alias visible: renombrar no debe romper contratos, historial ni partidas.
- Temporada y club de pertenencia: una plantilla no es válida indefinidamente.
- Hechos deportivos publicados y atributos estimados: una valoración del juego no se presenta como un dato oficial.
- Fuente, URL, fecha de consulta y situación de uso: no se copian bases privadas ni valoraciones de otro videojuego.
- Datos deportivos y activos gráficos: escudos, fotografías y equipaciones necesitan su propia procedencia y condiciones de uso.

No se recopilan datos privados de contacto ni información no pública de jugadores.

## Qué hay que contrastar

| Nivel | Fuentes de referencia | Configuración de la demo actual   | Estado de contraste oficial |
| ----- | --------------------- | --------------------------------- | --------------------------- |
| 1     | ACB                   | 18 clubes, un grupo, ida y vuelta | Pendiente                   |
| 2     | FEB                   | 18 clubes, un grupo, ida y vuelta | Pendiente                   |
| 3     | FEB                   | 28 clubes, dos grupos             | Pendiente                   |
| 4     | FEB                   | 138 clubes, diez grupos           | Pendiente                   |

Estas cifras describen `universe-es.json`; **no se declaran como el formato real de 2026-27**. Faltan
contrastar cruces, ascensos, descensos, desempates, licencias, cupos y calendarios, además de los
participantes y sus plantillas.

Las consultas HTTPS de esta tarea a ACB/FEB no completaron la conexión desde este entorno. No se
ha sustituido esa comprobación por nombres, plantillas o estadísticas inventadas. El manifiesto
conserva explícitamente los valores no verificados como `null`.

## Orden de incorporación

1. Confirmar temporada y reglamentos; guardar las referencias usadas.
2. Incorporar clubes con identidad estable, ubicación y alias de demostración cuando corresponda.
3. Cargar plantillas y hechos deportivos públicos con trazabilidad por temporada.
4. Estimar atributos y economía con metodología propia; calibrar y distinguirlos de las fuentes.
5. Validar el paquete con esquemas, simular temporadas y comprobar guardados/migraciones antes de sustituir la demo.

El cargador de paquetes (#21) y las identidades explícitas de clubes (#79) ya están implementados. La
siguiente integración necesita aún grupos y datos contrastados. Si cambia el
contrato o la API pública del núcleo, se abrirá el aviso `contrato` antes de implementarlo. No hace falta
bloquear las mejoras visuales o los guardados mientras se prepara el catálogo.

## Base semilla 2026-27 aportada por el propietario (17-11-2026)

[`seed.json`](../../data/reference/es/season-2026-27/seed.json) contiene **4 competiciones, 202 equipos con su
grupo o conferencia, 34 reglas operativas y 30 fuentes** (estado `seed-unverified`). Procede de una base
de investigación del propietario con fecha de corte 17-11-2026.

- **Qué incluye y qué no:** no incluye personas (29 jugadores de dos equipos y 18 cargos de la base original)
  hasta revisar derechos de uso y protección de datos. Tampoco escudos, fotografías ni valoraciones.
- **Qué NO es:** ni un censo exhaustivo, ni una licencia de redistribución, ni una validación de las
  condiciones de uso de cada fuente. Los identificadores son internos de la semilla.
- **Precauciones heredadas:** `nombre_publico` no es razón social; Tercera FEB tiene 138 equipos (no 140);
  se conserva un literal con posible errata; los cupos de Primera FEB no se han inventado.
- **Todavía no se usa en la partida.** El cargador #21 y las identidades #79 ya permiten clubes
  definidos; integrarla exige aún grupos explícitos y contraste de sus datos. Un test (`seed-data.test.ts`) vigila las cifras.

## Mapeo e integración

El [adaptador del catálogo (#61)](catalogo-semilla.md) valida identidades, alias, fuentes y agrupaciones sin modificar la partida. Conserva separadas las conferencias de los grupos de calendario y documenta los obstáculos del cargador.
