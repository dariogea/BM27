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

La temporada avanza **paso a paso**. Al empezar se reparten los equipos en grupos (por regiones) y
se crea todo el calendario de ida y vuelta. Cada paso juega una jornada de cada liga; cuando una
liga termina se calcula la clasificación y arrancan sus playoffs, que avanzan un partido por paso.
Cuando todas las competiciones han terminado se ordena a los equipos en una clasificación final y
se aplican ascensos, descensos y un año más de edad para cada jugador.

«Simular la temporada entera» es simplemente repetir pasos hasta el final, así que jugar jornada a
jornada o de golpe da exactamente el mismo resultado.

## Cómo juega el usuario

El usuario puede elegir un equipo, cambiar sus tácticas y ordenar su quinteto y su banquillo. Cada
una de esas decisiones crea un universo nuevo y solo afecta a los partidos que aún no se han
jugado. Se puede guardar en cualquier momento, también a mitad de temporada.

## Cómo evolucionan los jugadores

Cada jugador tiene 20 atributos y un **potencial** oculto, que es el techo de su habilidad media.
Al terminar cada temporada cumple un año y se desarrolla:

- **Jóvenes:** cierran una parte de la distancia que les separa de su potencial.
- **Entre unos 26 y 28 años:** se mantienen.
- **Veteranos:** pierden primero físico (desde los 29), luego técnica (desde los 32) y por último
  el tiro (desde los 34). La parte mental no baja.
- **Retirada:** desde los 34 años con probabilidad creciente; a los 40 es segura.

Los jugadores del universo inicial se generan con este mismo modelo (como promesas de 18 años a
las que se hace evolucionar hasta su edad) y con el reparto de edades de equilibrio, para que el
mundo no envejezca ni se rejuvenezca solo. La estabilidad se comprueba con `pnpm stability`.

## El mercado

Cada jugador con club tiene un **contrato** (salario anual y última temporada cubierta). Cada
competición tiene su **tope salarial**, su **salario mínimo** y su **tamaño de plantilla**, todo en
`universe-es.json`.

El año funciona así:

1. **Termina la temporada.** Ascensos, descensos, un año más de edad y retiradas. Cada retirada
   genera un agente libre joven. Los clubes rivales renuevan a quien quieren conservar (sus diez
   mejores y las promesas, si caben en el tope) y dejan libre al resto.
2. **Mercado abierto.** El usuario puede fichar agentes libres, renovar contratos y liberar
   jugadores, respetando el tope, el máximo de 15 jugadores y que, al empezar, haya al menos 12.
3. **Empieza la temporada y el mercado se cierra.** Los contratos que el usuario no haya renovado
   se cumplen y el jugador se marcha. Los clubes rivales completan su plantilla con agentes libres
   y mejoran donde pueden. Los de nivel superior eligen primero.

El historial de movimientos (fichajes, renovaciones, bajas, retiradas) se guarda durante tres
temporadas.

## Dónde están los datos

- Reglamentos: `packages/core/src/data/rulesets.json` (`fiba` y `nba-like`).
- Forma de la pirámide (equipos por nivel, playoffs, ascensos): `packages/core/src/data/universe-es.json`.
- Nombres ficticios: `packages/core/src/data/names-es.json`.

Cambiar esos archivos cambia el juego sin tocar el motor.

## Reglas que el propio repositorio vigila

- `Math.random` y las APIs de navegador están prohibidas en `packages/core`: lo impiden una regla
  de ESLint, la configuración de TypeScript y un test.
- Los JSON Schema publicados deben coincidir con el contrato: lo comprueba un test.
