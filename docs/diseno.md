# Sistema visual de BM27 para PC

Referencia: capturas aportadas por el propietario el 17-11-2026. Implementación del armazón y portal:
Issue #52. **Solo PC**; las ventanas verificadas son 1280 × 800 y 1920 × 1080. El panel puede tener
desplazamiento vertical y las tablas anchas, desplazamiento propio. No hay una variante móvil.

[Portal oscuro](screenshots/portal-desktop-dark.png) · [Portal claro](screenshots/portal-desktop-light.png) ·
[Capturas y verificación](revisiones/portal-52.md).

## Colores y tipografía

Usar variables de `apps/web/src/styles.css`, no fijar colores de fondo o texto dentro de los paneles.
El tema se selecciona con `data-theme` en el elemento raíz del documento.

| Variable        | Oscuro    | Claro     | Uso                                      |
| --------------- | --------- | --------- | ---------------------------------------- |
| `--bg`          | `#090c18` | `#edf1f6` | Fondo del espacio de trabajo             |
| `--surface`     | `#12151f` | `#ffffff` | Panel y tabla                            |
| `--raised`      | `#1d222e` | `#f3f6fa` | Control, fila alterna o tarjeta interior |
| `--text`        | `#edf2f7` | `#172337` | Texto principal                          |
| `--muted`       | `#aebed0` | `#4e6178` | Ayuda, metadatos y cabeceras de tabla    |
| `--line`        | `#38384d` | `#c1cddd` | Bordes y separadores                     |
| `--accent`      | `#f4a0ff` | `#83268f` | Títulos, enlaces y selección             |
| `--accent-text` | `#210b28` | `#ffffff` | Texto sobre fondo de acento              |
| `--danger`      | `#ff9aab` | `#a51d36` | Restricción o error                      |
| `--good`        | `#88dfb3` | `#176342` | Estado favorable                         |
| `--soft-good`   | `#18392d` | `#e1f2e8` | Fondo favorable                          |
| `--soft-bad`    | `#412735` | `#fbe8ed` | Fondo de advertencia negativa            |
| `--soft-blue`   | `#20324e` | `#e7efff` | Titular o selección deportiva            |
| `--soft-warn`   | `#30203c` | `#f6e8fa` | Hover y aviso informativo                |

La cabecera usa azul (`#075b99` → `#143b74`), texto blanco, barra secundaria azul muy oscuro y
acción de avance rosa (`#cc005d`). Son comunes a los dos temas. Los filtros seleccionados usan morado
(`#6e15ad`) y texto blanco.

Fuente del sistema, sin descarga externa. Texto general de 16 px; interfaz de gestión de 11–13 px;
título de club de 24 px. Foco visible de 3 px con `--accent`. Separación habitual de 6, 8, 12, 16 y
20 px; paneles con borde de 1 px y radio de 5 px. No se depende solo del color para comunicar estados.

## Armazón y componentes

| Clase                                                   | Aspecto y responsabilidad                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `.manager-header`, `.manager-topbar`                    | Cabecera fija al desplazar, marca, navegación principal y avance real de jornada           |
| `.primary-nav`, `.secondary-nav`                        | Dos niveles de navegación; botones seleccionados con `aria-pressed`                        |
| `.workspace-content`                                    | Contenido, máximo 1920 px, margen interior de 18 px                                        |
| `.workspace-actions`, `.game-tools`, `.team-management` | Utilidades de partida y cambio de club en desplegables nativos                             |
| `.club-ribbon`, `.club-monogram`, `.ribbon-stat`        | Identidad y resumen del club en sus pantallas; iniciales, no escudo oficial                |
| `.portal-grid`                                          | Cuatro columnas de escritorio: actividad, club/resultados, clasificación y resumen lateral |
| `.portal-panel`, `.panel-heading`                       | Panel oscuro/claro con título de acento, borde fino y relleno de 12 px                     |
| `.cards`, `.card`, `.big`                               | Tarjetas interiores y cifras destacadas de los paneles existentes                          |
| `.scroll`                                               | Desplazamiento horizontal de tablas; añadir `tabIndex={0}`, `role="region"` y `aria-label` |
| `.compact-table`, `.portal-results`                     | Tablas densas del portal; cabeceras y filas alternas                                       |
| `.note`, `.metric-label`, `.panel-season`               | Ayuda y metadatos con color secundario                                                     |
| `.warn`, `.error`                                       | Avisos con borde y texto `--danger`; el error de la app tiene `role="alert"`               |
| `.up`, `.down`, `.playoff`, `.starter`                  | Fondos deportivos positivos, negativos y de selección                                      |
| `.text-action`                                          | Acción pequeña de texto, etiqueta explícita y fondo transparente                           |
| `.score-button.win`, `.score-button.loss`               | Resultado pulsable; el marcador sigue legible sin distinguir colores                       |
| `.salary-meter`                                         | Uso del límite salarial, con semántica de progreso y porcentaje acotado                    |
| `.appearance-menu`, `.appearance-panel`                 | Preferencias de tema y densidad, sin cambiar la simulación                                 |

`data-density="compact"` reduce el relleno vertical de las celdas; el valor normal es `comfortable`.
Tema y densidad se guardan por separado en localStorage. Los controles generales conservan los
estilos de botón, campo y select; no usar botones sin acción para imitar una captura.

## Trabajo de paneles de Claude

Codex mantiene `App.tsx`, `ManagerHeader.tsx`, `PortalView.tsx`, `navigation.ts` y `styles.css`.
Claude puede adaptar `TeamView.tsx`, `MatchView.tsx`, `MarketView.tsx`, `FinanceView.tsx` y
`CompetitionView.tsx`, con reglas propias en **`apps/web/src/panels.css`**, según el reparto acordado
en #52. Importar ese archivo desde los paneles o desde la entrada web; no duplicar el armazón.
Mantener los tokens y foco de los contenedores `.scroll`. Las clases de panel pueden extender estos
componentes, con nombres descriptivos en inglés.

Cada cifra debe proceder del estado del juego. La actividad del portal no sustituye una futura bandeja
de prensa/personal. Los mapas deportivos deberán derivarse de eventos; la pista de cabecera actual
es decorativa y tiene `aria-hidden`. No reutilizar logos o retratos de las referencias.

## Paneles de gestión (T-033, Claude)

Reglas propias en [`panels.css`](../apps/web/src/panels.css); solo usa las variables de arriba.

| Elemento                                                | Cómo funciona                                                                                                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabeceras ordenables (`.th-sort`)                       | Un botón dentro de cada `<th>`; `aria-sort` indica la columna activa. La primera pulsación ordena de mayor a menor (el nombre y la posición, alfabético); la segunda invierte. Hoy: plantilla. |
| Nivel de atributo (`.attr-t1` … `.attr-t5`)             | Fondo según el valor (bajo < 45, justo 45–59, bueno 60–74, muy bueno 75–84, élite 85+). **El número siempre se imprime**: el color solo ayuda. La leyenda está bajo la tabla.                  |
| Insignias (`.badge`, `.badge-injury`, `.badge-expired`) | Estado junto a un nombre o fecha: «Lesión · N partidos», «Cumplido».                                                                                                                           |
| Búsqueda de agentes libres                              | Campo con etiqueta accesible y contador de resultados (`role="status"`). Solo busca entre los 150 que envía el Worker.                                                                         |

**Comprobación en navegador:** [`tools/qa/panels_browser.mjs`](../tools/qa/panels_browser.mjs) (1280 × 800, solo PC)
juega una jornada y verifica la ordenación, la búsqueda y que axe (WCAG 2 A/AA) no encuentra nada en los cinco
paneles, en tema oscuro y claro. Capturas: [oscuro](screenshots/plantilla-ordenable-oscuro.png),
[claro](screenshots/plantilla-ordenable-claro.png).

### Competición (T-038)

| Elemento                      | Cómo funciona                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clasificación ordenable       | Mismas cabeceras `.th-sort` que la plantilla. «#» es el orden oficial; al ordenar por otra columna, los empates conservan el orden oficial. Lógica en [`competitionData.ts`](../apps/web/src/competitionData.ts) con tests. |
| Forma (`.form`, `.form-chip`) | Últimos 5 resultados del equipo en esa competición, el más reciente a la derecha, con letra **G/P** además del color y texto para lectores de pantalla (`.sr-only`). Se calcula con los partidos jugados, no se inventa.    |
| «Solo mis partidos»           | Filtra la lista de la jornada elegida por el club del usuario (desactivado si no diriges ningún equipo).                                                                                                                    |
| Filas de partido              | Se abren con ratón o con Intro/Espacio (`tabIndex`, `aria-label` con el marcador).                                                                                                                                          |

`tools/qa/panels_browser.mjs` comprueba además la ordenación de la clasificación, que **la forma coincide con el estado real de la partida**, el filtro y la apertura con teclado.
