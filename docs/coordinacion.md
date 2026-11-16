# Cómo trabajan Claude Code y Codex en paralelo

Desde el 16 de noviembre de 2026 trabajan en este repositorio **dos agentes a la vez**: **Claude Code**
(de Anthropic) y **Codex** (de OpenAI). Los dos pueden hacer cualquier tarea en cualquier parte del
proyecto. **Entre ellos no manda nadie: las prioridades las fijas tú, el propietario.**

Esta página explica cómo se coordinan, qué ves tú y qué puede salir mal.

## En una frase

Las tareas son **Issues de GitHub**. Cada agente coge uno, avisa de qué archivos va a tocar, trabaja
en su rama y entrega un PR pequeño. **El otro agente revisa ese PR.** Tú decides qué es lo más
importante y, si los dos no se ponen de acuerdo, decides tú.

## Las etiquetas

| Etiqueta        | Qué significa                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `agente:claude` | Este Issue (o PR) es de Claude, o se le encarga a Claude.                                                                                   |
| `agente:codex`  | Este Issue (o PR) es de Codex, o se le encarga a Codex.                                                                                     |
| `en-curso`      | Alguien está trabajando en ello ahora mismo. Si no la lleva ninguna etiqueta, está libre.                                                   |
| `contrato`      | Cambia la forma de los datos (`packages/schema`) o la API pública del núcleo. Mientras haya una con `en-curso`, nadie más toca el contrato. |

Un Issue **libre** no tiene etiqueta de agente. Cuando un agente lo coge, le pone su etiqueta y
`en-curso`, y escribe en él **qué archivos va a tocar**.

## Las 8 reglas

1. **Coger una tarea.** Poner la etiqueta del agente y `en-curso`, y escribir qué archivos se van a tocar.
2. **Mirar antes de empezar** los Issues `en-curso` del otro agente. Si se pisan los archivos, se
   elige otra tarea, se espera o se pacta en un comentario quién hace qué.
3. **Contrato.** Antes de cambiar `packages/schema` o la API pública del núcleo se avisa en un Issue
   con la etiqueta `contrato`, porque el otro agente depende de ello.
4. **Un PR pequeño por tarea**, con su parte. Nadie hace push ni merge directo a `main`.
5. **Revisión cruzada.** Cada PR lo revisa el otro agente. A Codex se le pide comentando `@codex review`
   en el PR; a Claude, con la etiqueta `agente:claude` en el PR y el comentario `@claude review`.
6. **Encargar algo al otro.** A Codex: Issue con `agente:codex` y el comentario
   `@codex implementa este issue siguiendo AGENTS.md y CLAUDE.md`. A Claude: Issue con `agente:claude`.
7. **Leer y responder.** Al empezar y al terminar cada tarea, cada agente lee los Issues y comentarios
   nuevos dirigidos a él y los responde.
8. **Máximo 2 rondas de ida y vuelta por tema.** Si no hay acuerdo, decides tú.

## Qué hacen cuando no hay nadie diciéndoles qué hacer

Al terminar una tarea cogen la siguiente de mayor prioridad que esté libre, en este orden:

1. Lo que pidas tú.
2. Los Issues pendientes.
3. Lo que figure en [`estado.md`](estado.md).

Si no queda nada, crean ellos los Issues de lo que necesita el proyecto. **Tus órdenes pasan siempre
por delante.**

## Qué haces tú

- **Fijar prioridades.** Díselo a Claude en el chat, o escribe en un Issue un comentario que empiece
  por **PRIORIDAD:**. Los dos agentes lo tratan como una orden del propietario.
- **Aceptar los PR.** Hoy lo haces tú con el botón **«Merge pull request»**. Está acordado que los PR
  que **no cambian el contrato de datos** se fusionen solos cuando la comprobación automática (CI)
  salga en verde, y que los que **sí lo cambian** (etiqueta `contrato`) los siga aceptando tú. Esa
  fusión automática todavía no está activa: la prepara la tarea T-008.
- **Resolver desacuerdos.** Si dos agentes no se ponen de acuerdo tras 2 rondas, te lo plantean con
  una pregunta clara y decides.

## Qué NO está comprobado (lee esto)

- **No he podido comprobar que Codex esté conectado a este repositorio.** Para que responda a
  `@codex review` y `@codex implementa este issue`, hace falta que **tú** lo actives desde tu cuenta
  de ChatGPT/Codex y le des acceso a este repositorio en GitHub. Si no lo está, esos comentarios no
  hacen nada.
- **Claude no escucha en tiempo real.** Lee los Issues y los PR nuevos **al empezar y al terminar**
  cada tarea (y los PR que él abre, en cuanto hay actividad). Puede haber retrasos de minutos u horas.
- **Los dos agentes pueden entrar a la vez en los mismos archivos.** Las reglas 1–3 lo reducen, no lo
  eliminan. Los puntos más delicados son `docs/estado.md`, `packages/schema`, `package.json` y
  `pnpm-lock.yaml`.
- **La revisión cruzada no sustituye a la tuya** en decisiones de diseño: un agente puede dar por
  bueno algo que a ti no te encaja.

## Cómo se evitan los choques más probables

| Punto delicado                                  | Cómo se evita                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `docs/estado.md`                                | Cada PR edita solo las filas de sus tareas. Un conflicto se resuelve fusionando `main` en la rama; nunca se reescribe el historial. |
| `packages/schema` (contrato)                    | Se avisa antes con un Issue `contrato`. Solo un cambio de contrato en vuelo a la vez.                                               |
| Dependencias (`package.json`, `pnpm-lock.yaml`) | Se anuncian en el Issue; el lockfile en conflicto se regenera con `pnpm install` sobre la rama fusionada con `main`.                |
| Números de tarea `T-###`                        | Los asigna quien crea el Issue, mirando antes cuál es el último.                                                                    |
| Informes de medición (`docs/benchmarks/`)       | Cada tarea escribe los suyos con su número y nunca sobrescribe los anteriores.                                                      |

## Para empezar

Todas las tareas pendientes que se conocen están como Issues en
<https://github.com/dariogea/BM27/issues>, sin asignar. Los Issues con `en-curso` son los que
alguien tiene en marcha ahora mismo.
