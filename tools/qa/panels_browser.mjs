/* global axe, document, window */
/**
 * Browser check of the management panels (T-033). PC only: 1280 × 800.
 *
 *   pnpm build && pnpm --filter @bm27/web exec vite preview --port 4174 &
 *   BM27_AXE_PATH=/path/to/axe.min.js node tools/qa/panels_browser.mjs
 *
 * Plays a matchday, then checks: the squad table sorts both ways with `aria-sort`, the free-agent
 * search filters, and axe (WCAG 2 A/AA) finds nothing in the five panels, in both themes.
 * Optional: BM27_SHOTS=/some/dir saves a screenshot of each panel.
 */
import { createRequire } from 'node:module';

// Playwright is not a dependency of the project: it is found like a global module.
const { chromium } = createRequire(import.meta.url)('playwright');

const URL = process.env.BM27_URL || 'http://localhost:4174/';
const AXE = process.env.BM27_AXE_PATH;
const SHOTS = process.env.BM27_SHOTS;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const check = (ok, what) => {
    console.log(`${ok ? 'OK  ' : 'FALLA'} ${what}`);
    if (!ok) process.exitCode = 1;
  };

  await page.goto(URL);
  await page.getByRole('button', { name: 'Generar universo', exact: true }).click();
  await page.getByTestId('summary').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Dirigir este equipo', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Secciones de la partida' });
  await nav.getByRole('button', { name: 'Mi equipo', exact: true }).waitFor();

  // --- Market: free-agent search (the market is open before the first matchday).
  await nav.getByRole('button', { name: 'Mercado', exact: true }).click();
  const before = await page.locator('[data-testid="freeagents"] tbody tr').count();
  const surname = (
    await page.locator('[data-testid="freeagents"] tbody tr td.name').first().textContent()
  )
    .trim()
    .split(' ')
    .pop();
  await page.getByLabel('Buscar agente libre por nombre').fill(surname);
  const after = await page.locator('[data-testid="freeagents"] tbody tr').count();
  check(
    after >= 1 && after <= before,
    `buscar «${surname}» filtra la lista (${before} → ${after})`,
  );
  await page.getByLabel('Buscar agente libre por nombre').fill('zzzz-no-existe');
  check(
    (await page.locator('[data-testid="freeagents"] tbody tr').count()) === 0,
    'una búsqueda sin resultados vacía la tabla',
  );
  await page.getByLabel('Buscar agente libre por nombre').fill('');

  await page.getByRole('button', { name: 'Jugar jornada', exact: true }).click();
  await nav.getByRole('button', { name: 'Mi equipo', exact: true }).click();
  await page.getByRole('button', { name: 'Ver partido', exact: true }).waitFor({ timeout: 90000 });

  // --- Squad table: sorting.
  await nav.getByRole('button', { name: 'Mi equipo', exact: true }).click();
  const column = (index) =>
    page
      .locator('.squad-table tbody tr')
      .evaluateAll(
        (trs, i) => trs.map((tr) => Number(tr.querySelectorAll('td')[i].textContent)),
        index,
      );
  await page.getByRole('button', { name: 'VAL', exact: true }).click();
  const desc = await column(4);
  check(
    desc.every((v, i) => i === 0 || desc[i - 1] >= v),
    'VAL ordena de mayor a menor',
  );
  check(
    (await page.locator('th[aria-sort="descending"]').count()) === 1,
    'aria-sort="descending" en la columna activa',
  );
  await page.getByRole('button', { name: 'VAL', exact: true }).click();
  const asc = await column(4);
  check(
    asc.every((v, i) => i === 0 || asc[i - 1] <= v),
    'segunda pulsación ordena de menor a mayor',
  );
  check(
    (await page.locator('.squad-table tbody tr').count()) >= 12,
    'la plantilla conserva todas las filas',
  );

  // --- axe on the five panels, both themes.
  if (AXE) {
    for (const theme of ['dark', 'light']) {
      if ((await page.evaluate('document.documentElement.dataset.theme')) !== theme) {
        await page.getByText('Apariencia', { exact: true }).click();
        await page
          .getByRole('button', {
            name: theme === 'light' ? '☀ Modo claro' : '☾ Modo oscuro',
            exact: true,
          })
          .click();
        await page.getByText('Apariencia', { exact: true }).click();
      }
      for (const label of ['Mi equipo', 'Mercado', 'Finanzas', 'Competición', 'Partido']) {
        if (label === 'Partido') {
          // Audit the real box score, not the empty message: open the match first.
          await nav.getByRole('button', { name: 'Mi equipo', exact: true }).click();
          await page.getByRole('button', { name: 'Ver partido', exact: true }).first().click();
          await page.getByTestId('boxscore').first().waitFor({ timeout: 30000 });
          check(
            (await page.getByTestId('boxscore').count()) >= 1,
            'el panel Partido muestra el box score',
          );
        } else {
          await nav.getByRole('button', { name: label, exact: true }).click();
        }
        await page.waitForTimeout(300);
        await page.addScriptTag({ path: AXE });
        const violations = await page.evaluate(async () =>
          (
            await axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
            })
          ).violations.map((v) => `${v.id} (${v.nodes.length})`),
        );
        check(
          violations.length === 0,
          `axe ${label} · ${theme}${violations.length ? ': ' + violations.join(', ') : ''}`,
        );
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label.toLowerCase()}-${theme}.png` });
      }
    }
  } else {
    console.log('(sin BM27_AXE_PATH: se omite la comprobación de accesibilidad)');
  }

  // --- Finance panel with history, on its own fresh game: finish one season (a second one
  // needs the user to renew contracts first, which the game rightly demands).
  {
    const fp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    fp.on('pageerror', (e) => errors.push(String(e)));
    await fp.addInitScript(() => {
      const RealWorker = window.Worker;
      window.Worker = class extends RealWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', (event) => {
            if (event.data.type === 'state') window.bm27ObservedState = event.data.view;
          });
        }
      };
    });
    await fp.goto(URL);
    await fp.getByRole('button', { name: 'Generar universo', exact: true }).click();
    await fp.getByTestId('summary').waitFor({ timeout: 90000 });
    await fp.getByRole('button', { name: 'Dirigir este equipo', exact: true }).click();
    const fnav = fp.getByRole('navigation', { name: 'Secciones de la partida' });
    await fnav.getByRole('button', { name: 'Mi equipo', exact: true }).waitFor();
    await fp.getByText('Cambiar de club · simular temporada', { exact: true }).click();
    await fp
      .getByRole('button', { name: 'Simular hasta el final de la temporada', exact: true })
      .click();
    await fp.waitForFunction(() => window.bm27ObservedState?.finance?.history?.length >= 1, null, {
      timeout: 120000,
    });
    await fnav.getByRole('button', { name: 'Finanzas', exact: true }).click();
    await fp.getByTestId('finance-history').waitFor();
    const finance = await fp.evaluate(() => {
      const view = window.bm27ObservedState.finance;
      const chart = document.querySelector('.fin-chart svg');
      return {
        history: view.history.length,
        rows: document.querySelectorAll('[data-testid="finance-history"] tbody tr').length,
        bars: chart ? chart.querySelectorAll('rect').length : -1,
        label: chart ? chart.getAttribute('aria-label') : '',
        results: view.history.map((r) => r.result),
        goodBars: chart ? chart.querySelectorAll('.fin-bar-good').length : -1,
        meterNow: Number(document.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')),
        payroll: view.payroll,
        budget: view.wageBudget,
      };
    });
    check(finance.history >= 1, `hay ${finance.history} temporada cerrada en el historial`);
    check(
      finance.rows === finance.history && finance.bars === finance.history,
      `tabla (${finance.rows}) y gráfico (${finance.bars}) tienen una fila/barra por temporada`,
    );
    check(
      finance.goodBars === finance.results.filter((r) => r >= 0).length,
      'las barras verdes son exactamente las temporadas con beneficio',
    );
    check(
      finance.label.includes('temporada'),
      'el gráfico tiene descripción accesible con las cifras',
    );
    const expectedUse = Math.min(100, Math.round((100 * finance.payroll) / finance.budget));
    check(
      finance.meterNow === expectedUse,
      `el medidor del presupuesto salarial marca ${finance.meterNow} % (esperado ${expectedUse} %)`,
    );
    if (AXE) {
      await fp.addScriptTag({ path: AXE });
      const violations = await fp.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })
        ).violations.map((v) => `${v.id} (${v.nodes.length})`),
      );
      check(
        violations.length === 0,
        `axe Finanzas con historial${violations.length ? ': ' + violations.join(', ') : ''}`,
      );
    }
    if (SHOTS) await fp.screenshot({ path: `${SHOTS}/finanzas-historial.png` });
    await fp.close();
  }

  check(
    errors.length === 0,
    `sin errores de consola${errors.length ? ': ' + errors.join(' | ') : ''}`,
  );
  await browser.close();
})();
