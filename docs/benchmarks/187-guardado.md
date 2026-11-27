# Guardado de partidas largas

Comparación de las funciones síncronas de guardado con el adaptador que usa SHA-256 nativo. Se generó un universo de 202 clubes con la semilla `save-history-t018` y se simularon 50 temporadas consecutivas. Tras la 10, la 30 y la 50 se exportó e importó el mismo estado tres veces con cada implementación. Las cifras son medianas en milisegundos, medidas en Node con Web Crypto disponible.

| Temporadas | JSON (bytes) | Exportar con el núcleo | Exportar con Web Crypto | Importar con el núcleo | Importar con Web Crypto |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 17.609.514 | 784 | 199 | 997 | 754 |
| 30 | 48.360.870 | 1.144 | 427 | 1.714 | 789 |
| 50 | 79.188.620 | 1.964 | 771 | 2.878 | 1.223 |

Los archivos fueron idénticos byte a byte. La importación incluye el cálculo de la huella, el análisis del JSON, la validación y las migraciones. En Chromium se comprobó el guardado comprimido, el rechazo de un archivo dañado, la recuperación del autoguardado y la continuación tras recargar.

## Tamaño con gzip

La medición de referencia de #17 sobre el mismo universo dio 1.945.619 bytes comprimidos a 10 temporadas, 5.323.547 a 30 y 8.731.881 a 50. Para la partida de 50 temporadas la compresión y la descompresión tardaron 1.201 y 393 ms respectivamente, medidos por separado con zlib de Node. Queda por medir el tiempo completo de guardar y cargar en la aplicación de Windows.

## Apertura completa en Chromium

En el mismo equipo se abrió el JSON de 50 temporadas desde el selector de archivos del juego. Se midió desde la selección hasta que el Worker devolvió la partida cargada. La mediana de tres intentos por versión bajó de **4.140 ms en la alfa 24 a 1.908 ms en la alfa 25**. Se verificaron la semilla y la temporada 51 en las seis cargas. Los tiempos incluyen lectura del archivo y el envío del estado al navegador. El instalador de Windows requiere una medición propia.
