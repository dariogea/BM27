# Documentación de BM27

| Documento                                    | Para qué sirve                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [`../CLAUDE.md`](../CLAUDE.md)               | Reglas permanentes de trabajo (pilares, stack, límites).                      |
| [`decisiones.md`](decisiones.md)             | Decisiones vigentes del proyecto y decisiones técnicas tomadas en cada tarea. |
| [`estado.md`](estado.md)                     | Tabla de tareas T-### con su estado. Se actualiza en cada Pull Request.       |
| [`arquitectura.md`](arquitectura.md)         | Cómo está organizado el código y cómo fluyen los datos, en lenguaje sencillo. |
| [`benchmarks/`](benchmarks/)                 | Mediciones reales de rendimiento, un archivo por tarea.                       |
| [`benchmarks/T-001.md`](benchmarks/T-001.md) | Mediciones de la prueba técnica del núcleo (B1–B4).                           |

El contrato de datos en formato JSON Schema (útil para mods y herramientas externas) está en
[`../packages/schema/json-schema/`](../packages/schema/json-schema/).

La [guía de desarrollo](desarrollo.md) reúne instalación, arranque, pruebas y comandos.
La [portada del proyecto](../README.md) presenta el juego y el resumen visual de avance.

[Partidas y copias de seguridad](partidas.md): ranuras internas, autoguardado y archivos portables.

[Base española y procedencia de los datos](datos/espana.md): dirección del producto, fuentes y catálogo pendiente de contrastar.

- [Verificación visual de la demo y capturas reales (#23)](revisiones/demo-visual-23.md).

- [Portal de gestión basado en las capturas del propietario (#52)](revisiones/portal-52.md).

- [Adaptador y validación de la semilla española (#61)](datos/catalogo-semilla.md).

- [Buscador y fichas del mundo de la partida (#67)](consultas.md).

- [Cargar y crear paquetes de datos (#21)](datos/paquetes.md).

- [Repetición del registro y mapa de tiros (#15)](repeticion.md).

- [Clubes definidos, identidad estable y procedencia (#79)](datos/identidades-clubes.md).
