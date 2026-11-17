# Demo visual y accesibilidad — #23

Fecha: 17-11-2026. La demo ahora ofrece un inicio guiado, modos claro y oscuro,
resumen de la partida, navegación por secciones y tablas desplazables. Los datos mostrados
son los de la simulación; clubes y jugadores siguen siendo generados.

## Capturas reales

Capturadas con Chromium ejecutando la web, después de generar una partida, elegir un equipo
y jugar una jornada. No son maquetas ni plantillas oficiales.

| Pantalla                        | Oscuro                                             | Claro                                               |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Inicio, escritorio (1280 × 900) | [Captura](../screenshots/welcome-desktop-dark.png) | [Captura](../screenshots/welcome-desktop-light.png) |
| Equipo, escritorio              | [Captura](../screenshots/team-desktop-dark.png)    | [Captura](../screenshots/team-desktop-light.png)    |

## Verificación repetible

Se usaron Python Playwright, Chromium instalado en el entorno y axe-core 4.11.0 como herramientas
externas de comprobación; no se añaden dependencias de producción.

```bash
pnpm web --host 127.0.0.1
# En otra terminal con Playwright para Python y Chromium disponibles:
npm pack axe-core@4.11.0 --ignore-scripts --pack-destination /tmp
mkdir -p /tmp/bm27-axe
tar -xzf /tmp/axe-core-4.11.0.tgz -C /tmp/bm27-axe
BM27_AXE_PATH=/tmp/bm27-axe/package/axe.min.js python tools/qa/demo_visual.py
```

Variables opcionales: `BM27_WEB_URL`, `BM27_CHROMIUM`, `BM27_SCREENSHOT_DIR` y `BM27_REPORT_PATH`.
La prueba crea una partida temporal en un perfil nuevo del navegador; no usa los guardados del usuario.

Resultado real: **36 combinaciones revisadas, cero incidencias de axe** para WCAG 2 A/AA y
2.1 AA, y ningún desbordamiento horizontal de la página. Se revisaron inicio y las ocho
secciones de la partida en ambos tamaños y temas, con un partido ya simulado. También se comprobó
el desplazamiento de la plantilla por teclado, el foco visible y la persistencia del tema al recargar.
No hubo errores JavaScript del navegador. Se corrigió el foco de los contenedores de tablas.

Comprobaciones del proyecto: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`,
`pnpm roadmap:check` y `pnpm test --maxWorkers=2` (**205/205 pruebas**).

## Límites y siguiente paso

La comprobación automática no certifica accesibilidad completa. Quedan la revisión con lectores de
pantalla, todos los estados de error, historiales largos y la instalación nativa en Windows.
Los controles de mercado que cierran al empezar la temporada se revisaron en su estado deshabilitado;
la lógica de fichajes mantiene sus pruebas automatizadas.

La [base española de referencia](../datos/espana.md) tiene una política y un manifiesto de investigación;
no se han importado clubes ni jugadores oficiales. El acceso a las fuentes ACB/FEB no completó la
conexión desde el entorno. No se cambió el formato deportivo con cifras sin verificar.

Actualización posterior del propietario: solo PC. Las capturas vigentes y la comprobación actual están en [portal #52](portal-52.md); se han retirado los artefactos móviles. El resultado de 36 combinaciones descrito arriba pertenece a la entrega anterior, no al alcance actual.
