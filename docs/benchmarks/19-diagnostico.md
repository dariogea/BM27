# T-020 · Estabilidad de las plantillas de primera división

En las cuatro simulaciones de referencia bajó la habilidad de los diez mejores jugadores de cada equipo de primera división. La caída tras 30 temporadas va de 1,1 a 3,2 puntos en una escala de 1 a 99. Las tres variantes probadas se descartaron. El Issue #19 sigue abierto y el modelo publicado conserva sus reglas.

## Método

Se ejecutó `pnpm stability --seasons 30 --seed SEMILLA` con las cuatro semillas de la tabla sobre la base `16b84c6` y con cada variante por separado. El informe mide la plantilla disponible al principio de cada temporada. Las tres columnas de cambio comparan la temporada 0 con la 30. Las dos de caja promedian los recuentos al inicio de las temporadas 1 a 30, sobre 202 clubes. Se muestran cifras redondeadas tal como las devuelve el comando.

- **Más calidad.** Suma 2,5 puntos al valor de generación de los jóvenes que reemplazan retiradas de clubes de primera división.
- **Más renovaciones.** Los equipos de la IA en primera división renuevan a sus cinco mejores jugadores si cumplen los límites de edad y presupuesto vigentes. Al resto se aplica la probabilidad habitual.
- **Más dispersión.** Los jóvenes que reemplazan retiradas en primera división reciben una variación normal adicional de media cero y desviación de seis puntos en la calidad de generación. La variación usa un generador por semilla y temporada separado del resto.

| Modelo | Semilla | Cambio en los diez mejores (N1) | Cambio en habilidad media (N1) | Cambio en edad media (años) | Clubes con caja negativa | Clubes con descubierto superado |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Base | `stability-t004` | -3,2 | -2,4 | 0,1 | 12,8 | 1,4 |
| Base | `stability-t020-b` | -1,4 | -0,8 | -0,1 | 35,0 | 3,4 |
| Base | `stability-t020-c` | -2,4 | -1,4 | -0,2 | 33,2 | 3,5 |
| Base | `stability-t020-d` | -1,1 | -0,5 | -0,7 | 119,5 | 25,4 |
| Más calidad | `stability-t004` | -0,9 | -0,9 | -1,1 | 91,7 | 21,9 |
| Más calidad | `stability-t020-b` | -1,2 | -2,0 | -1,6 | 112,5 | 26,3 |
| Más calidad | `stability-t020-c` | -1,5 | -3,0 | -1,6 | 117,1 | 29,1 |
| Más calidad | `stability-t020-d` | -0,5 | -0,3 | -0,9 | 123,4 | 30,6 |
| Más renovaciones | `stability-t004` | -3,0 | -2,3 | 0,0 | 11,1 | 1,3 |
| Más renovaciones | `stability-t020-b` | -2,7 | -2,0 | 0,0 | 35,0 | 3,1 |
| Más renovaciones | `stability-t020-c` | -1,9 | -1,1 | -0,1 | 56,4 | 4,9 |
| Más renovaciones | `stability-t020-d` | -2,6 | -1,6 | -0,2 | 91,3 | 13,7 |
| Más dispersión | `stability-t004` | -2,3 | -3,1 | -1,4 | 67,8 | 15,7 |
| Más dispersión | `stability-t020-b` | -2,4 | -2,6 | -0,5 | 115,2 | 27,8 |
| Más dispersión | `stability-t020-c` | -1,4 | -1,0 | -0,6 | 113,5 | 25,4 |
| Más dispersión | `stability-t020-d` | -1,5 | -1,5 | -1,5 | 105,4 | 22,2 |

## Qué muestran las pruebas

- Aumentar la calidad del relevo redujo la caída en las cuatro semillas, pero aumentó el número medio de clubes con caja negativa entre 77,5 y 83,9 en tres de ellas.
- Renovar siempre a los cinco mejores dentro del presupuesto dejó las cuatro semillas fuera de la tolerancia de 1,5 puntos.
- Aumentar la dispersión dio una caída de más de dos puntos en dos semillas y elevó el número medio de clubes con caja negativa en tres.
- El escenario base con la semilla `stability-t020-d` ya parte de una trayectoria financiera distinta. Su media de 119,5 clubes con caja negativa contrasta con el intervalo de 12,8 a 35,0 de las otras semillas. La tabla permite separar ese efecto de los cambios de plantilla, que se miden siempre dentro de la misma semilla.

`pnpm calibrate` pasó las 14 bandas aproximadas de primera división en 918 partidos de liga regular de tres universos. Este comando mide temporadas iniciales. La sostenibilidad de plantillas y finanzas se midió con las simulaciones de 30 temporadas.
