# Portal de gestión para PC — #52

Fecha: 17-11-2026. El propietario aportó capturas como referencia visual y confirmó después que
BM27 es **solo para PC**. La entrega adopta la cabecera azul, navegación de dos niveles, fondo oscuro
geométrico, acentos morados/rosas y distribución de paneles de esas capturas. No usa sus escudos,
fotografías, textos ni datos deportivos. La pista de cabecera es una ilustración decorativa propia.

## Capturas reales

Obtenidas con Chromium ejecutando BM27: generar una partida, elegir club y jugar una jornada.
Los clubes y jugadores son los datos generados de la demo.

| Resolución de PC       | Oscuro                                             | Claro                                               |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Portal, 1280 × 800     | [Captura](../screenshots/portal-desktop-dark.png)  | [Captura](../screenshots/portal-desktop-light.png)  |
| Portal, 1920 × 1080    | [Captura](../screenshots/portal-wide-dark.png)     | [Captura](../screenshots/portal-wide-light.png)     |
| Plantilla, 1280 × 800  | [Captura](../screenshots/team-desktop-dark.png)    | [Captura](../screenshots/team-desktop-light.png)    |
| Plantilla, 1920 × 1080 | [Captura](../screenshots/team-wide-dark.png)       | [Captura](../screenshots/team-wide-light.png)       |
| Inicio, 1280 × 800     | [Captura](../screenshots/welcome-desktop-dark.png) | [Captura](../screenshots/welcome-desktop-light.png) |
| Inicio, 1920 × 1080    | [Captura](../screenshots/welcome-wide-dark.png)    | [Captura](../screenshots/welcome-wide-light.png)    |

## Funciones y procedencia

- La cabecera abre las funciones existentes y «Jugar jornada» avanza realmente la simulación.
- El portal reúne actividad del club, últimos resultados, clasificación, próximo rival, cuentas,
  margen salarial, estado del mercado y líderes anotadores de la propia plantilla.
- La actividad procede de resultados, movimientos y avisos del estado del juego; no simula prensa
  ni mensajes de empleados inexistentes. Los filtros y accesos a las pantallas funcionan.
- Resultados y clasificación conservan su temporada de origen. Si todavía no hay temporada, se
  muestran los clubes inscritos sin inventar posiciones. No se añaden fechas ni rivales futuros
  que el motor no haya programado.
- Los importes son caja y salarios **anuales**, no presupuestos de traspasos ni salarios semanales.
  Las medias anotadoras solo aparecen con partidos disputados.
- «Apariencia» permite tema claro/oscuro y tablas compactas; ambos ajustes sobreviven a la recarga.
- Crear/importar/exportar sigue en «Gestión de partida». Cambiar equipo o simular la temporada
  está en su desplegable; los guardados internos permanecen accesibles desde la navegación.

No cambia el protocolo con el Worker, el núcleo ni el contrato de datos. No se añaden dependencias.

## Comprobación repetible y resultados

Se reutiliza `tools/qa/demo_visual.py` con Python Playwright, Chromium y axe-core 4.11.0. Estas son
herramientas de verificación externas; no dependencias del juego.

```bash
pnpm web --host 127.0.0.1
# En otra terminal con Playwright para Python y Chromium disponibles:
npm pack axe-core@4.11.0 --ignore-scripts --pack-destination /tmp
mkdir -p /tmp/bm27-axe
tar -xzf /tmp/axe-core-4.11.0.tgz -C /tmp/bm27-axe
BM27_AXE_PATH=/tmp/bm27-axe/package/axe.min.js python tools/qa/demo_visual.py
```

Variables opcionales: `BM27_WEB_URL`, `BM27_CHROMIUM`, `BM27_SCREENSHOT_DIR` y `BM27_REPORT_PATH`.
La prueba usa un perfil temporal del navegador y no accede a los guardados del usuario.

Resultado: **48 combinaciones de pantallas, estados y temas**, a 1280 × 800 y 1920 × 1080, sin
incidencias de axe en WCAG A/AA y sin desbordamiento horizontal global. Incluye inicio, portal sin
club, portal antes de la primera jornada y las nueve secciones tras jugar un partido. Se comprueban
los importes y la fila de clasificación del portal contra la respuesta real del Worker, el filtro de
actividad y el acceso a tácticas. También se verifica el desplazamiento de tabla por teclado, el foco
visible y la persistencia de tema y densidad. Sin errores JavaScript del navegador.

Recorrido de guardados en Chromium: generar, guardar, recargar, recuperar lista persistente, cargar,
renombrar y eliminar, correcto con la nueva interfaz.

`pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm roadmap:check` y `pnpm build`: correctos.
`pnpm test --maxWorkers=2`: **205/205 pruebas**.

## Límites

La prueba automática no certifica accesibilidad completa. Faltan lectores de pantalla, todos los estados
de error y grandes historiales. No se ejecutó el instalador nativo en Windows. No se implementan
prensa, personal, entrenamiento, mapas de calor ni otros sistemas mostrados en las referencias que el
motor aún no soporta. La base oficial española sigue pendiente de contraste/importación.
