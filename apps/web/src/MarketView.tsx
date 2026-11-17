import type { Position } from '@bm27/schema';
import { useState } from 'react';
import type { MarketView as MarketData, MyTeamView } from './protocol';

const euros = (n: number): string => `${n.toLocaleString('es-ES')} €`;
const MOVE_LABELS = {
  signed: 'Fichaje',
  renewed: 'Renovación',
  released: 'Liberado',
  expired: 'Contrato cumplido',
  retired: 'Se retira',
} as const;

/** How many seasons are left on a contract, counting the one about to be played. */
const seasonsLeft = (endSeason: number, seasonNumber: number): number =>
  Math.max(0, endSeason - seasonNumber + 1);

function CapBar({ market }: { market: MarketData }) {
  const share = Math.min(100, (100 * market.payrollNextSeason) / Math.max(1, market.salaryLimit));
  const over = market.payrollNextSeason > market.salaryLimit;
  return (
    <div>
      <div className="bar-outer" title="Masa salarial de los contratos que siguen vigentes">
        <div className={`bar-inner ${over ? 'over' : ''}`} style={{ width: `${share}%` }} />
      </div>
      <p className="note">
        Masa salarial que sigue vigente la próxima temporada:{' '}
        <strong>{euros(market.payrollNextSeason)}</strong> de un límite de{' '}
        <strong>{euros(market.salaryLimit)}</strong> ({share.toFixed(0)} %). El límite es el menor
        de dos: el tope de la liga ({euros(market.salaryCap)}) y tu presupuesto salarial (
        {market.wageSharePercent} % de tus ingresos: {euros(market.wageBudget)}).
        {market.payroll !== market.payrollNextSeason &&
          ` Con los contratos ya cumplidos serían ${euros(market.payroll)}.`}{' '}
        El tope limita fichajes y renovaciones; solo un contrato de {euros(market.minSalary)} (el
        mínimo) puede superarlo, y solo para llegar al mínimo de plantilla.
      </p>
    </div>
  );
}

export function MarketPanel(props: {
  team: MyTeamView;
  market: MarketData;
  seasonNumber: number;
  busy: boolean;
  onSign: (playerId: string, years: number) => void;
  onRenew: (playerId: string, years: number) => void;
  onRelease: (playerId: string) => void;
}) {
  const { market, team, seasonNumber } = props;
  const [position, setPosition] = useState<Position | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'rating' | 'potential' | 'age' | 'salary'>('rating');
  const [years, setYears] = useState<Record<string, number>>({});
  const yearsFor = (id: string, fallback: number): number => years[id] ?? fallback;
  const full = market.rosterSize >= market.rosterMax;

  const agents = market.freeAgents
    .filter((a) => position === 'all' || a.player.positions.includes(position))
    .filter((a) =>
      `${a.player.firstName} ${a.player.lastName}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'potential'
        ? b.player.potential - a.player.potential
        : sort === 'age'
          ? a.player.age - b.player.age
          : sort === 'salary'
            ? a.askingSalary - b.askingSalary
            : b.overall - a.overall,
    );
  const yearOptions = [1, 2, 3, 4];

  return (
    <div>
      {!market.open && (
        <p className="warn">
          El mercado está cerrado mientras se juega la temporada. Se vuelve a abrir cuando termine.
        </p>
      )}
      {market.problem && <p className="warn">⚠ {market.problem}</p>}
      <p>
        Plantilla: <strong>{market.rosterSize}</strong> jugadores (entre {market.rosterMin} y{' '}
        {market.rosterMax}).
      </p>
      <CapBar market={market} />

      <h3>Mi plantilla y sus contratos</h3>
      <div className="scroll" tabIndex={0} role="region" aria-label="Mercado y contratos">
        <table data-testid="contracts">
          <thead>
            <tr>
              <th className="name">Jugador</th>
              <th>Edad</th>
              <th>VAL</th>
              <th>POT</th>
              <th>Salario</th>
              <th>Contrato</th>
              <th className="name">Renovar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {team.squad.map(
              ({ player: p, overall, contract, expired, renewalSalary, releaseCost }) => {
                // Only players with a year or less left can be renewed.
                const renewable = !!contract && contract.endSeason <= seasonNumber;
                return (
                  <tr key={p.id} className={expired ? 'down' : ''}>
                    <td className="name">
                      {p.firstName} {p.lastName}
                    </td>
                    <td>{p.age}</td>
                    <td>{overall.toFixed(0)}</td>
                    <td>{p.potential}</td>
                    <td>{contract ? euros(contract.salary) : '–'}</td>
                    <td>
                      {contract
                        ? expired
                          ? 'CUMPLIDO'
                          : `hasta ${contract.endSeason} (${seasonsLeft(contract.endSeason, seasonNumber)} temp.)`
                        : '–'}
                    </td>
                    <td className="name">
                      <select
                        aria-label={`Años de renovación de ${p.lastName}`}
                        value={yearsFor(p.id, 2)}
                        disabled={!market.open || !renewable}
                        onChange={(e) => setYears({ ...years, [p.id]: Number(e.target.value) })}
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y} {y === 1 ? 'temporada' : 'temporadas'}
                          </option>
                        ))}
                      </select>{' '}
                      <button
                        disabled={props.busy || !market.open || !renewable}
                        title={
                          renewable
                            ? ''
                            : 'Solo se renueva a quien tiene un año de contrato o menos'
                        }
                        onClick={() => props.onRenew(p.id, yearsFor(p.id, 2))}
                      >
                        Renovar a {euros(renewalSalary)}
                      </button>
                    </td>
                    <td>
                      <button
                        disabled={props.busy || !market.open}
                        onClick={() => props.onRelease(p.id)}
                      >
                        Liberar{releaseCost > 0 ? ` (${euros(releaseCost)})` : ''}
                      </button>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
      <p className="note">
        En rojo: contratos cumplidos. Si no los renuevas antes de empezar la temporada, el jugador
        se marcha. Liberar a un jugador con contrato en vigor cuesta una indemnización: la mitad del
        salario de los años que le quedan (se paga al momento de la caja).
      </p>

      <h3>Agentes libres ({market.freeAgentCount} en el mercado)</h3>
      <div className="bar">
        <label>
          Posición{' '}
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as Position | 'all')}
            aria-label="Filtrar por posición"
          >
            <option value="all">Todas</option>
            <option value="PG">Base</option>
            <option value="SG">Escolta</option>
            <option value="SF">Alero</option>
            <option value="PF">Ala-pívot</option>
            <option value="C">Pívot</option>
          </select>
        </label>
        <label>
          Buscar{' '}
          <input
            type="search"
            value={query}
            placeholder="Nombre o apellido"
            aria-label="Buscar agente libre por nombre"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Ordenar por{' '}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Ordenar agentes libres"
          >
            <option value="rating">Valoración</option>
            <option value="potential">Potencial</option>
            <option value="age">Edad (más jóvenes)</option>
            <option value="salary">Salario (más baratos)</option>
          </select>
        </label>
        <span className="note" role="status">
          {agents.length} {agents.length === 1 ? 'resultado' : 'resultados'}
          {agents.length > 60 ? ' (se muestran los 60 primeros)' : ''}. De los{' '}
          {market.freeAgentCount} agentes libres, el juego envía hasta 150 (los más valorados).
        </span>
      </div>
      <div className="scroll" tabIndex={0} role="region" aria-label="Mercado y contratos">
        <table data-testid="freeagents">
          <thead>
            <tr>
              <th className="name">Jugador</th>
              <th>Pos</th>
              <th>Edad</th>
              <th>Alt</th>
              <th>VAL</th>
              <th>POT</th>
              <th>Aro</th>
              <th>Tri</th>
              <th>Pas</th>
              <th>DEx</th>
              <th>DIn</th>
              <th>Pide</th>
              <th className="name">Fichar</th>
            </tr>
          </thead>
          <tbody>
            {agents.slice(0, 60).map(({ player: p, overall, askingSalary }) => (
              <tr key={p.id}>
                <td className="name">
                  {p.firstName} {p.lastName}
                </td>
                <td>{p.positions.join('/')}</td>
                <td>{p.age}</td>
                <td>{p.heightCm}</td>
                <td>
                  <strong>{overall.toFixed(0)}</strong>
                </td>
                <td>{p.potential}</td>
                <td>{p.attributes.offensive.closeShot}</td>
                <td>{p.attributes.offensive.threePoint}</td>
                <td>{p.attributes.offensive.passing}</td>
                <td>{p.attributes.defensive.perimeterDefense}</td>
                <td>{p.attributes.defensive.interiorDefense}</td>
                <td>{euros(askingSalary)}</td>
                <td className="name">
                  <select
                    aria-label={`Años de contrato de ${p.lastName}`}
                    value={yearsFor(p.id, p.age <= 29 ? 3 : p.age <= 32 ? 2 : 1)}
                    onChange={(e) => setYears({ ...years, [p.id]: Number(e.target.value) })}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y} {y === 1 ? 'temporada' : 'temporadas'}
                      </option>
                    ))}
                  </select>{' '}
                  <button
                    disabled={props.busy || !market.open || full}
                    onClick={() =>
                      props.onSign(p.id, yearsFor(p.id, p.age <= 29 ? 3 : p.age <= 32 ? 2 : 1))
                    }
                  >
                    Fichar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {agents.length > 60 && (
        <p className="note">Hay {agents.length - 60} más con este filtro: acota por posición.</p>
      )}

      <h3>Movimientos recientes de tu equipo</h3>
      {market.moves.length === 0 ? (
        <p className="note">Todavía no hay movimientos.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Temporada</th>
              <th className="name">Movimiento</th>
              <th className="name">Jugador</th>
              <th>Salario</th>
              <th>Hasta</th>
              <th>Coste</th>
            </tr>
          </thead>
          <tbody>
            {market.moves.map((m, i) => (
              <tr key={i}>
                <td>{m.seasonNumber}</td>
                <td className="name">{MOVE_LABELS[m.type]}</td>
                <td className="name">{m.playerName}</td>
                <td>{m.salary === null ? '–' : euros(m.salary)}</td>
                <td>{m.endSeason ?? '–'}</td>
                <td>{m.cost ? euros(m.cost) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
