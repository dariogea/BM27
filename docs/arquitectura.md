# Arquitectura (explicada en sencillo)

## Las cuatro piezas

```
packages/schema   El "contrato": qué forma tienen los datos (jugador, equipo, partido...).
      ▲           Todo lo demás depende de él. Valida los datos al cargarlos.
      │
packages/core     El "cerebro": genera el universo, simula partidos y temporadas, guarda y carga.
      ▲           No sabe nada de pantallas. Funciona igual en Node y dentro de un Web Worker.
      │
      ├── apps/web    La página. Solo envía órdenes al cerebro (que corre en un Web Worker)
      │               y pinta lo que recibe.
      └── tools/cli   Comandos de terminal para simular y medir sin página.
```

## Cómo se simula un partido

1. El motor recibe dos equipos (con sus tácticas), un reglamento y una **semilla**.
2. En cada posesión el ataque elige una **jugada** (bloqueo directo, aislamiento, poste, tiro tras
   pase, corte, salida de bloqueo o contraataque). La jugada escoge a sus protagonistas entre los
   cinco en pista, los enfrenta a sus defensores según la táctica defensiva y termina en pérdida,
   falta o tiro. Cada tiro tiene una zona de la pista y un grado de libertad del tirador.
3. Todo lo que ocurre se apunta en un **registro de eventos** (tiro, rebote, falta, cambio...), con
   el periodo y el reloj.
4. El **box score** y la narración jugada a jugada se calculan después, leyendo únicamente ese
   registro.

Con la misma semilla, el partido sale idéntico siempre. Por eso se puede «volver a ver» cualquier
partido sin haberlo guardado: basta con re-simularlo.

> El entrenador es todavía un `PLACEHOLDER`: quinteto, minutos y cambios siguen reglas fijas.
> Qué hace cada táctica está explicado en [`tacticas.md`](tacticas.md).

## Cómo se simula una temporada

Para cada competición: se reparten los equipos en grupos (por regiones), se crea el calendario de
ida y vuelta, se juegan los partidos, se calcula la clasificación, se juegan los playoffs y se
ordena a todos los equipos en una clasificación final. Después: ascensos, descensos y un año más
de edad para cada jugador.

## Dónde están los datos

- Reglamentos: `packages/core/src/data/rulesets.json` (`fiba` y `nba-like`).
- Forma de la pirámide (equipos por nivel, playoffs, ascensos): `packages/core/src/data/universe-es.json`.
- Nombres ficticios: `packages/core/src/data/names-es.json`.

Cambiar esos archivos cambia el juego sin tocar el motor.

## Reglas que el propio repositorio vigila

- `Math.random` y las APIs de navegador están prohibidas en `packages/core`: lo impiden una regla
  de ESLint, la configuración de TypeScript y un test.
- Los JSON Schema publicados deben coincidir con el contrato: lo comprueba un test.
