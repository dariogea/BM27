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

1. El motor recibe dos equipos, un reglamento y una **semilla**.
2. Juega posesión a posesión y apunta cada cosa que pasa en un **registro de eventos**
   (tiro, rebote, falta, cambio...), con el periodo y el reloj.
3. El **box score** se calcula después, leyendo únicamente ese registro.

Con la misma semilla, el partido sale idéntico siempre. Por eso se puede "volver a ver" cualquier
partido sin haberlo guardado: basta con re-simularlo.

> El motor actual es un `PLACEHOLDER`: sirve para probar la arquitectura, no es baloncesto fino.

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
