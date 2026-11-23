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

Está activado inicialmente y se puede desactivar desde el panel. Se guarda después de cada jornada,
también con **Jugar y ver**, y al simular hasta el final de la temporada. Se conservan dos ranuras,
**Guardado automático** y **Guardado automático anterior**. La rotación de las dos copias se confirma
en una sola transacción. Las ranuras manuales se conservan y la preferencia persiste al reiniciar.

El menú principal ofrece **Continuar** con el club y la temporada del guardado más reciente.
Si falla el autoguardado actual y hay una copia anterior, aparece **Cargar autoguardado anterior** con su club y temporada. El primer autoguardado tras cargar esa copia la conserva. También puedes elegirla en **Mis partidas**. Cargar una copia
no crea un nuevo autoguardado hasta que se juega otra jornada.

Si falla el autoguardado por falta de espacio, la partida sigue abierta en memoria: aparece un
aviso y puedes exportarla inmediatamente con **Guardar partida**.

## Copias portables

Los botones **Guardar partida** y **Cargar partida** siguen utilizando archivos JSON. En Windows de
escritorio abren los diálogos nativos; en el navegador permiten descargar o seleccionar el archivo.
Son la forma de transferir una partida a otro equipo y de guardar una copia independiente.

En **Opciones de partida**, **Guardar partida comprimida** crea un archivo .json.gz. **Cargar partida** acepta ambos formatos y comprueba la integridad del guardado.

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

«Partidas» en la navegación superior o «Partidas de este dispositivo» abre las ranuras internas. Los botones para importar/exportar archivos están en «Opciones de partida», bajo la cabecera.
