# Guardar partidas en BM27

## Dentro de esta aplicación

Abre **Partidas de este dispositivo**, incluso antes de generar un universo. Desde ahí puedes cargar
una partida existente. Para guardar una nueva, genera o carga una partida, escribe su nombre y pulsa
**Guardar / sobrescribir**. Si el nombre ya existe, se pide confirmación antes de sustituirlo.

Cada ranura muestra equipo, temporada, semilla, fecha y tamaño. Puedes renombrarla sin cambiar la
partida, cargarla o eliminarla. Renombrar con un nombre ya usado se rechaza sin borrar ninguna.
Cargar reemplaza la partida abierta: conserva antes los cambios que quieras guardar. Eliminar una
ranura también pide confirmación.

## Guardado automático

Está activado inicialmente y se puede desactivar desde el panel. Al terminar una temporada, tanto
jugando la última jornada como simulando hasta el final, se guarda el estado posterior al cierre.
La ranura **Guardado automático** se sobrescribe a sí misma; las ranuras manuales no cambian. La
preferencia se conserva al cerrar y volver a abrir la aplicación.

Si falla el autoguardado por falta de espacio, la temporada no se pierde de la memoria: aparece un
aviso y puedes exportarla inmediatamente con **Guardar partida**.

## Copias portables

Los botones **Guardar partida** y **Cargar partida** siguen utilizando archivos JSON. En Windows de
escritorio abren los diálogos nativos; en el navegador permiten descargar o seleccionar el archivo.
Son la forma de transferir una partida a otro equipo y de guardar una copia independiente.

Los guardados internos no se sincronizan con la nube. Cada dirección de la web o instalación dispone
de su propio almacenamiento. Borrar los datos del navegador o de la aplicación elimina estas
ranuras: conserva archivos externos para los guardados importantes. No se promete que sobrevivan a
una limpieza del sistema o un cambio de dirección de la aplicación.

## Si aparece un error

- **Sin espacio:** exporta primero las partidas que quieras conservar y elimina ranuras prescindibles.
- **Partida dañada:** no se sustituye la partida abierta ni se modifican las otras ranuras. Prueba una copia de seguridad.
- **Almacenamiento no disponible:** utiliza archivos; no se desactiva esa vía de guardado.
- **Otra ventana impide actualizar el almacenamiento:** cierra las otras ventanas de BM27 y vuelve a intentarlo.

La instalación y el guardado nativo en un Windows real siguen pendientes de validación; las pruebas
de esta entrega cubren el adaptador y el Worker, además del recorrido de navegador indicado en el PR.

## Acceso desde el portal

«Partidas» en la navegación superior o «Partidas de este dispositivo» abre las ranuras internas. Los botones para importar/exportar archivos están en «Gestión de partida», bajo la cabecera.
