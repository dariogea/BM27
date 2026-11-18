import { chartBars, seasonsUntilOverdraft, wageUse } from './financeData';
import './panels.css';
import type { FinanceView as FinanceData } from './protocol';

const euros = (n: number): string => `${Math.round(n).toLocaleString('es-ES')} €`;

export function FinancePanel(props: { finance: FinanceData; seasonNumber: number }) {
  const f = props.finance;
  const projectedCosts = f.payroll + f.fixedCosts;
  const projectedResult = f.expectedRevenue - projectedCosts;
  const overdraftShare = f.balance < 0 ? Math.min(100, (100 * -f.balance) / f.overdraftLimit) : 0;
  const seasonsAgo = (index: number): number => props.seasonNumber - 1 - index;
  const use = wageUse(f.payroll, f.wageBudget);
  const untilLimit = seasonsUntilOverdraft({
    balance: f.balance,
    overdraftLimit: f.overdraftLimit,
    projectedResult,
  });
  const bars = chartBars(f.history, props.seasonNumber);

  return (
    <div data-testid="finance">
      {f.restricted && (
        <p className="warn">
          ⚠ Tu club está en números rojos más allá del descubierto permitido: no puede asumir nuevos
          salarios (solo contratos de salario mínimo) ni renovar a quien le caduque el contrato.
        </p>
      )}
      <div className="cards">
        <div className="card">
          <div className="note">Caja</div>
          <div className={`big ${f.balance < 0 ? 'bad' : ''}`}>{euros(f.balance)}</div>
          <div className="note">
            Descubierto permitido: {euros(f.overdraftLimit)}
            {f.balance < 0 && ` · usado ${overdraftShare.toFixed(0)} %`}
          </div>
        </div>
        <div className="card">
          <div className="note">Reputación</div>
          <div className="big">{f.reputation}</div>
          <div className="note">Un club típico de tu liga tiene {f.typicalReputation}.</div>
        </div>
        <div className="card">
          <div className="note">Presupuesto salarial</div>
          <div className="big">{euros(f.wageBudget)}</div>
          <div className="note">Masa salarial actual: {euros(f.payroll)}</div>
        </div>
      </div>

      <div className="fin-meter">
        <div className="note" id="wage-use-label">
          Uso del presupuesto salarial:{' '}
          <strong>{Number.isFinite(use) ? `${use.toFixed(0)} %` : '—'}</strong> ({euros(f.payroll)}{' '}
          de {euros(f.wageBudget)})
        </div>
        <div
          className="salary-meter"
          role="meter"
          aria-labelledby="wage-use-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(Number.isFinite(use) ? use : 100))}
        >
          <span
            style={{ width: `${Math.min(100, Number.isFinite(use) ? use : 100)}%` }}
            className={use > 100 ? 'meter-over' : ''}
          />
        </div>
        {use > 100 && (
          <p className="note">
            La masa salarial supera el presupuesto salarial: solo podrás fichar contratos de salario
            mínimo.
          </p>
        )}
      </div>

      <h3>Previsión de la próxima temporada</h3>
      <div className="scroll" tabIndex={0} role="region" aria-label="Previsión económica">
        <table>
          <tbody>
            <tr>
              <td className="name">Ingresos esperados (con tu reputación actual)</td>
              <td>{euros(f.expectedRevenue)}</td>
            </tr>
            <tr>
              <td className="name">Salarios (contratos actuales)</td>
              <td>−{euros(f.payroll)}</td>
            </tr>
            <tr>
              <td className="name">Costes fijos (pabellón, personal, viajes)</td>
              <td>−{euros(f.fixedCosts)}</td>
            </tr>
            <tr>
              <td className="name">
                <strong>Resultado previsto</strong>
              </td>
              <td className={projectedResult < 0 ? 'bad' : ''}>
                <strong>
                  {projectedResult >= 0 ? '+' : ''}
                  {euros(projectedResult)}
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {untilLimit !== null && (
        <p className="warn" role="status">
          Con estos números la temporada que viene pierde {euros(-projectedResult)}.{' '}
          {untilLimit === 0
            ? 'La caja llegaría al límite del descubierto en la próxima temporada.'
            : `Si nada cambia, la caja llegaría al límite del descubierto en ${untilLimit} ${untilLimit === 1 ? 'temporada' : 'temporadas'}.`}{' '}
          (Proyección en línea recta con los datos de arriba, no una predicción.)
        </p>
      )}
      <p className="note">
        Los ingresos suben con la reputación (más público y más patrocinio) y con los partidos en
        casa y los playoffs. La reputación sube o baja cada año según tu posición final, pero tiende
        a la que corresponde a tu liga: ganar una vez no basta para hacerse rico. Los clubes solo
        dedican a salarios una parte de sus ingresos.
      </p>

      <h3>Temporadas anteriores</h3>
      {f.history.length === 0 ? (
        <p className="note">Todavía no hay ninguna temporada cerrada.</p>
      ) : (
        <>
          <figure className="fin-chart">
            <svg
              viewBox={`0 0 ${Math.max(1, bars.length) * 48} 100`}
              role="img"
              aria-label={`Resultado por temporada: ${bars
                .map(
                  (b) =>
                    `temporada ${b.season}, ${b.value >= 0 ? '+' : '−'}${euros(Math.abs(b.value))}`,
                )
                .join('; ')}`}
              preserveAspectRatio="none"
            >
              <line x1="0" x2={bars.length * 48} y1="50" y2="50" className="fin-zero" />
              {bars.map((b, i) => (
                <rect
                  key={b.season}
                  x={i * 48 + 8}
                  width="32"
                  y={b.value >= 0 ? 50 - 46 * b.share : 50}
                  height={Math.max(1, 46 * b.share)}
                  className={b.value >= 0 ? 'fin-bar-good' : 'fin-bar-bad'}
                />
              ))}
            </svg>
            <figcaption className="note">
              Resultado de cada temporada cerrada (verde: beneficio, rojo: pérdida), de la más
              antigua a la más reciente: {bars.map((b) => `T${b.season}`).join(' · ')}. Las cifras
              exactas están en la tabla.
            </figcaption>
          </figure>
          <div className="scroll" tabIndex={0} role="region" aria-label="Historial económico">
            <table data-testid="finance-history" className="fin-table">
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Televisión</th>
                  <th>Patrocinio</th>
                  <th>Entradas</th>
                  <th>Público medio</th>
                  <th>Salarios</th>
                  <th>Costes fijos</th>
                  <th>Resultado</th>
                  <th>Caja final</th>
                  <th>Rep.</th>
                </tr>
              </thead>
              <tbody>
                {f.history.map((r, index) => (
                  <tr key={r.competitionId + index}>
                    <td>{seasonsAgo(index)}</td>
                    <td>{euros(r.tv)}</td>
                    <td>{euros(r.sponsors)}</td>
                    <td>{euros(r.tickets)}</td>
                    <td>{r.averageCrowd.toLocaleString('es-ES')}</td>
                    <td>{euros(r.wages)}</td>
                    <td>{euros(r.fixedCosts)}</td>
                    <td className={r.result < 0 ? 'bad' : ''}>
                      <strong>
                        {r.result >= 0 ? '+' : ''}
                        {euros(r.result)}
                      </strong>
                    </td>
                    <td className={r.balanceEnd < 0 ? 'bad' : ''}>{euros(r.balanceEnd)}</td>
                    <td>{r.reputationEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
