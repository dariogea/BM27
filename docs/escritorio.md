# El juego como aplicación de Windows (.exe)

BM27 se puede empaquetar como un **instalador para Windows** (`BM27_x.y.z_x64-setup.exe`). Es la
misma web del juego dentro de una ventana propia (Tauri), con guardado de partidas en archivos reales
de tu disco. Esta página explica cómo se publica y qué se puede esperar.

## Cómo conseguirlo (fase 1: descarga manual)

Cuando se publique una Release, la descarga se hará de esta forma. Mientras no exista, usa la
[compilación de prueba de Actions](#probar-sin-esperar-a-una-versión-publicada).

1. Entra en la pestaña **Releases** del repositorio en GitHub (con tu sesión abierta: el repositorio
   es privado) y elige la versión más reciente.
2. Descarga el archivo **`BM27_…_x64-setup.exe`** y ejecútalo. Se instala solo para tu usuario, sin
   permisos de administrador.
3. Si Windows muestra **«Windows protegió su PC»**: pulsa **«Más información»** y luego **«Ejecutar de
   todos modos»**. Pasa porque el instalador no está firmado con un certificado de pago (cuesta dinero
   cada año). Algún antivirus puede dar un falso positivo.
4. Abre BM27 desde el menú Inicio.

Las partidas se guardan con **«Guardar partida»**: te deja elegir dónde (por ejemplo, en Documentos), y
**«Cargar partida»** abre ese archivo.

## Probar sin esperar a una versión publicada

Cada compilación manual deja el instalador como **artefacto** de la ejecución (14 días): _Actions →
Publicar versión (Windows) → la ejecución → Artifacts → `bm27-windows-instalador`_. Es un `.zip` con el
`.exe` dentro.

## Cómo se publica una versión

Una versión es una **etiqueta** de Git con la forma `v0.1.0-alpha.1`:

- Los nombres con guion (`-alpha`, `-beta`, `-rc`) se publican como **pre-lanzamiento** en Releases.
- Antes de etiquetar hay que poner **la misma versión** en `apps/desktop/package.json` y en
  `apps/desktop/src-tauri/tauri.conf.json` (sin la `v`). El flujo se niega a publicar si no coinciden.
- Además, [`tools/ci/release-check.mjs`](../tools/ci/release-check.mjs) exige que **la etiqueta apunte al
  commit que se compila** (si la etiqueta ya existe y apunta a otro, no se publica), que una etiqueta
  nueva solo se cree desde `main` y que **nunca se reemplace una Release existente** (para
  republicar, bórrala a mano antes).
- Al subir la etiqueta, el flujo [`release.yml`](../.github/workflows/release.yml) ejecuta los tests,
  compila el instalador en un Windows de GitHub y lo adjunta a la Release.
- También se puede lanzar **a mano** desde _Actions → Publicar versión (Windows) → Run workflow_:
  sin etiqueta solo compila y deja el instalador como **artefacto** descargable durante 14 días (útil
  para probar sin publicar).
- Compilar para Windows gasta minutos de GitHub Actions (cuentan el doble): se publica cuando se
  decide, no en cada PR.

## Qué NO está comprobado

- **Nadie ha ejecutado todavía el instalador en un Windows real.** Está comprobado que **se compila y
  se genera en el Windows de GitHub** (los tests pasan allí y el instalador pesa 1,4 MB), y que el
  proyecto Rust compila en Linux, pero no se ha podido probar el instalador instalado ni el guardado
  con los diálogos nativos de Windows hasta que alguien lo abra.
- La ventana usa **WebView2** de Microsoft (viene con Windows 11 y con Windows 10 actualizado). Si falta,
  el instalador lo descarga.

## Launcher: versión y búsqueda de actualizaciones (T-031)

Al abrir la aplicación de escritorio aparece, arriba del todo, una franja con **la versión en uso** y el
resultado de buscar en GitHub una versión nueva (alfas y betas incluidas si usas una versión preliminar):

- «Estás en la última versión.»
- «Hay una versión nueva: …» con el botón **Copiar enlace de descarga**: pegas el enlace en el navegador
  (con tu sesión de GitHub abierta), descargas el instalador y lo ejecutas; tu partida guardada se conserva.
- «No se puede leer el repositorio sin permiso»: el repositorio es **privado**. En «Ajustes de actualización»
  se puede pegar un **token de GitHub de solo lectura** (permiso «Contents: Read-only», limitado a este
  repositorio). Se guarda solo en ese ordenador y solo se envía a GitHub para leer las versiones.

**Qué NO hace todavía:** no descarga ni instala solo (el instalador no está firmado y el repositorio es privado),
y no se ha probado dentro de la aplicación instalada en un Windows real: se ha probado con respuestas de
GitHub simuladas en un navegador automatizado y con 9 tests de la lógica de versiones.

## Siguiente paso: actualización automática (fase 2)

La idea acordada con el propietario: al abrir el juego, la propia aplicación busca una versión nueva en
GitHub, la descarga, la instala y se reinicia, sin tener que entrar en GitHub. No hace falta un
«launcher» aparte: la aplicación se actualiza entera. Se publicarán **alfas y betas** como
pre-lanzamientos y habrá un canal fijo (`canal-alfa`, `canal-beta`) que siempre apunta a la última.

**Está bloqueada por una decisión del propietario:** el repositorio es privado y la aplicación no puede
descargar de él sin una llave. La opción recomendada es publicar los instaladores en un **repositorio
público aparte** (solo binarios; el código fuente sigue privado). Necesita, por parte del propietario,
crear ese repositorio y tres secretos en GitHub (la clave de firma de las actualizaciones, su
contraseña y un token para publicar). Ver el Issue de la tarea T-023.
