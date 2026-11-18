import { useState } from 'react';
import type { ReactNode } from 'react';
import type { GameView } from './protocol';
import type { Tab } from './navigation';

const money = (value: number): string => `${Math.round(value).toLocaleString('es-ES')} €`;
const MOVE_LABELS = {
  signed: 'Fichaje',
  renewed: 'Renovación',
  released: 'Baja',
  expired: 'Fin de contrato',
  retired: 'Retirada',
};

function Panel(props: {
  title: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`portal-panel ${props.className ?? ''}`}>
      <header className="panel-heading">
        <h2>{props.title}</h2>
        {props.action}
      </header>
      {props.children}
    </section>
  );
}

export function PortalView(props: {
  view: GameView;
  competitionId: string;
  onCompetition: (id: string) => void;
  onNavigate: (tab: Tab) => void;
  onClub: (id: string) => void;
  onMatch: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const { view } = props;
  const mine = view.myTeam;
  const [filter, setFilter] = useState<'all' | 'sport' | 'market'>('all');
  const name = (id: string): string => view.teamNames[id] ?? id;
  const clubButton = (id: string, className = '') => (
    <button
      type="button"
      className={`text-action portal-club-link ${className}`}
      onClick={() => props.onClub(id)}
      disabled={props.busy}
    >
      {name(id)}
    </button>
  );
  const competition = view.competitions.find((c) => c.id === props.competitionId);
  const table = view.tables.find((c) => c.competitionId === props.competitionId);
  // A table can belong to the previous season after promotion; retain its actual season label.
  const recentMatches = view.tables
    .flatMap((c) => c.matches.map((match) => ({ match, season: c.seasonNumber })))
    .filter(
      ({ match }) => mine && (match.homeTeamId === mine.teamId || match.awayTeamId === mine.teamId),
    )
    .slice(-8)
    .reverse();
  const last = recentMatches[0];
  const leaders =
    mine?.squad
      .filter((row) => row.stats && row.stats.games > 0)
      .sort((a, b) => b.stats!.points / b.stats!.games - a.stats!.points / a.stats!.games)
      .slice(0, 3) ?? [];
  const market = view.market;
  const salaryShare =
    market && market.salaryLimit > 0
      ? Math.min(100, Math.max(0, (100 * market.payroll) / market.salaryLimit))
      : 0;
  const activities: {
    id: string;
    category: 'sport' | 'market';
    title: string;
    detail: string;
    tab: Tab;
  }[] = [];
  if (mine) {
    if (market?.problem)
      activities.push({
        id: 'roster',
        category: 'sport',
        title: 'Revisa la plantilla antes de jugar',
        detail: market.problem,
        tab: 'market',
      });
    if (view.finance?.restricted)
      activities.push({
        id: 'finance',
        category: 'market',
        title: 'Restricción económica activa',
        detail:
          'El club ha superado su descubierto permitido. Consulta las cuentas antes de asumir salarios.',
        tab: 'finance',
      });
    if (last)
      activities.push({
        id: 'result',
        category: 'sport',
        title: `${name(last.match.homeTeamId)} ${last.match.homeScore}–${last.match.awayScore} ${name(last.match.awayTeamId)}`,
        detail: `Temporada ${last.season} · ${last.match.stage === 'regular' ? 'Jornada' : 'Playoffs, ronda'} ${last.match.round}`,
        tab: 'team',
      });
    if (mine.nextMatch)
      activities.push({
        id: 'next',
        category: 'sport',
        title: `Prepara el partido contra ${name(mine.nextMatch.opponentId)}`,
        detail: `Jornada ${mine.nextMatch.round} · ${mine.nextMatch.home ? 'En casa' : 'A domicilio'}`,
        tab: 'tactics',
      });
    for (const [index, move] of (market?.moves.slice(-5).reverse() ?? []).entries()) {
      activities.push({
        id: `move-${index}`,
        category: 'market',
        title: `${MOVE_LABELS[move.type]} · ${move.playerName}`,
        detail: `Temporada ${move.seasonNumber}${move.salary !== null ? ` · Salario anual ${money(move.salary)}` : ''}${move.cost !== null ? ` · Coste ${money(move.cost)}` : ''}`,
        tab: 'market',
      });
    }
    activities.push({
      id: 'management',
      category: 'sport',
      title: 'Rotación de la plantilla',
      detail: mine.rotation ? 'Quinteto elegido por el mánager' : 'Quinteto a cargo del entrenador',
      tab: 'lineup',
    });
  }
  const shownActivities = activities.filter((item) => filter === 'all' || item.category === filter);
  return (
    <div className="portal-grid" data-testid="manager-portal">
      <h1 className="sr-only">Portal {mine ? `de ${mine.name}` : 'de BM27'}</h1>
      <Panel
        title="Actividad del club"
        className="activity-column"
        action={<span className="panel-counter">{activities.length}</span>}
      >
        <div className="feed-filters" role="group" aria-label="Filtrar actividad">
          {(
            [
              ['all', 'Todo'],
              ['sport', 'Deportivo'],
              ['market', 'Mercado'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? 'active' : ''}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="feed-period">
          Temporada {view.seasonNumber} ·{' '}
          {view.seasonInProgress ? `Jornada ${view.step}` : 'Preparación'}
        </p>
        <ul className="activity-feed">
          {shownActivities.map((item) => (
            <li key={item.id}>
              <span className={`activity-category ${item.category}`}>
                {item.category === 'sport' ? 'Deportivo' : 'Mercado'}
              </span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <button className="text-action" onClick={() => props.onNavigate(item.tab)}>
                Abrir{' '}
                {item.tab === 'market'
                  ? 'mercado'
                  : item.tab === 'finance'
                    ? 'finanzas'
                    : item.tab === 'tactics'
                      ? 'tácticas'
                      : item.tab === 'lineup'
                        ? 'quinteto'
                        : 'plantilla'}{' '}
                <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
        {shownActivities.length === 0 && (
          <p className="empty-state">
            {mine ? 'No hay actividad de esta categoría.' : 'Sin club asignado.'}
          </p>
        )}
      </Panel>

      <div className="portal-main-column">
        <Panel title="Centro del club" className="club-feature-panel">
          <div className="club-feature">
            <div className="feature-court" aria-hidden="true">
              <i />
              <span>BM27</span>
            </div>
            <div className="feature-content">
              <span className="eyebrow">{mine?.competitionName ?? 'Tu próxima carrera'}</span>
              <h2>{mine?.name ?? 'Sin club'}</h2>
              <p>
                {mine
                  ? `${mine.squad.length} jugadores · ${mine.position ? `${mine.position}º en la clasificación` : 'Preparando la temporada'}`
                  : 'Pretemporada'}
              </p>
              {mine && (
                <button onClick={() => props.onNavigate('team')}>
                  Ver mi plantilla <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
          <div className="portal-shortcuts" aria-label="Accesos rápidos">
            <button disabled={!mine} onClick={() => props.onNavigate('lineup')}>
              <span aria-hidden="true">▦</span> Quinteto y rotación
            </button>
            <button disabled={!mine} onClick={() => props.onNavigate('tactics')}>
              <span aria-hidden="true">◎</span> Plan de partido
            </button>
          </div>
        </Panel>
        <Panel
          title="Últimos partidos"
          action={
            <button className="text-action" onClick={() => props.onNavigate('competition')}>
              Competición →
            </button>
          }
        >
          {recentMatches.length ? (
            <div
              className="scroll"
              tabIndex={0}
              role="region"
              aria-label="Resultados recientes del club"
            >
              <table className="portal-results">
                <thead>
                  <tr>
                    <th>Temp.</th>
                    <th>Ronda</th>
                    <th className="name">Rival</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMatches.map(({ match, season }) => {
                    const home = match.homeTeamId === mine?.teamId;
                    const ownScore = home ? match.homeScore : match.awayScore;
                    const opponentScore = home ? match.awayScore : match.homeScore;
                    return (
                      <tr key={match.id}>
                        <td>{season}</td>
                        <td>
                          {match.stage === 'playoff' ? 'PO ' : ''}
                          {match.round}
                        </td>
                        <td className="name">
                          {name(home ? match.awayTeamId : match.homeTeamId)}{' '}
                          <small>{home ? '(C)' : '(F)'}</small>
                        </td>
                        <td>
                          <button
                            disabled={props.busy}
                            className={`score-button ${ownScore > opponentScore ? 'win' : 'loss'}`}
                            onClick={() => {
                              void props.onMatch(match.id);
                            }}
                            aria-label={`Ver partido ${name(match.homeTeamId)} ${match.homeScore} a ${match.awayScore} ${name(match.awayTeamId)}`}
                          >
                            {ownScore}–{opponentScore}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">Sin partidos disputados.</p>
          )}
          {last && (
            <button
              disabled={props.busy}
              className="text-action last-match-action"
              onClick={() => {
                void props.onMatch(last.match.id);
              }}
            >
              Ver partido
            </button>
          )}
        </Panel>
        <Panel title="Rendimiento de tu plantilla">
          {leaders.length ? (
            <ul className="player-leaders">
              {leaders.map((row, index) => (
                <li key={row.player.id}>
                  <span className="player-avatar" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <strong>
                      {row.player.firstName} {row.player.lastName}
                    </strong>
                    <small>
                      {row.stats!.games} {row.stats!.games === 1 ? 'partido' : 'partidos'} · Puntos
                      por partido
                    </small>
                  </div>
                  <strong className="rating-value">
                    {(row.stats!.points / row.stats!.games).toFixed(1)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              Las medias aparecerán cuando tus jugadores disputen partidos.
            </p>
          )}
        </Panel>
      </div>

      <Panel
        title={table ? 'Clasificación' : 'Clubes de la competición'}
        className="standings-column"
      >
        <label className="portal-competition-label">
          Competición del portal
          <select value={props.competitionId} onChange={(e) => props.onCompetition(e.target.value)}>
            {view.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {table ? (
          <>
            <p className="panel-season">
              Temporada {table.seasonNumber} ·{' '}
              {table.phase === 'playoffs'
                ? 'Playoffs'
                : table.phase === 'done'
                  ? 'Finalizada'
                  : 'Liga regular'}
            </p>
            <div
              className="portal-standings-scroll"
              tabIndex={0}
              role="region"
              aria-label="Clasificación del portal"
            >
              {table.groups.map((group) => (
                <table key={group.name} className="compact-table">
                  <caption>{group.name}</caption>
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th className="name">Equipo</th>
                      <th>PJ</th>
                      <th>V</th>
                      <th>D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.standings.map((row) => (
                      <tr key={row.teamId} className={row.teamId === mine?.teamId ? 'mine' : ''}>
                        <td>{row.position}</td>
                        <td className="name">{clubButton(row.teamId)}</td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="empty-state">Pretemporada · Clubes inscritos</p>
            <ul
              className="competition-clubs"
              tabIndex={0}
              aria-label="Clubes inscritos en la competición"
            >
              {competition?.teamIds.map((id) => (
                <li key={id} className={id === mine?.teamId ? 'my-club' : ''}>
                  <span className="mini-badge" aria-hidden="true">
                    {name(id).slice(0, 1)}
                  </span>
                  {clubButton(id)}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <aside className="portal-sidebar" aria-label="Información deportiva y económica">
        <Panel title="Próximo rival">
          {mine?.nextMatch ? (
            <>
              {clubButton(mine.nextMatch.opponentId, 'opponent-name')}
              <p>
                Jornada {mine.nextMatch.round} · {mine.nextMatch.home ? 'En casa' : 'A domicilio'}
              </p>
              <button className="text-action" onClick={() => props.onNavigate('tactics')}>
                Preparar partido →
              </button>
            </>
          ) : (
            <p className="empty-state">
              {view.seasonInProgress
                ? 'No hay próximo partido programado para tu equipo.'
                : 'El calendario se inicia al jugar la primera jornada.'}
            </p>
          )}
        </Panel>
        <Panel title="Caja del club">
          {view.finance ? (
            <>
              <span className="metric-label">Saldo disponible</span>
              <strong className={`portal-metric ${view.finance.balance < 0 ? 'negative' : ''}`}>
                {money(view.finance.balance)}
              </strong>
              <p className="note">Reputación {view.finance.reputation}/100</p>
              <button className="text-action" onClick={() => props.onNavigate('finance')}>
                Ver cuentas →
              </button>
            </>
          ) : (
            <p className="empty-state">Sin club asignado.</p>
          )}
        </Panel>
        <Panel title="Presupuesto salarial">
          {market ? (
            <>
              <span className="metric-label">Límite anual del club</span>
              <strong className="portal-metric">{money(market.salaryLimit)}</strong>
              <p className="metric-detail">
                Salarios comprometidos <strong>{money(market.payroll)}</strong>
              </p>
              <div
                className="salary-meter"
                role="progressbar"
                aria-label="Uso del límite salarial"
                aria-valuenow={Math.round(salaryShare)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${salaryShare}%` }} />
              </div>
              <p className="note">
                {market.payroll > market.salaryLimit
                  ? `Exceso: ${money(market.payroll - market.salaryLimit)}`
                  : `Margen: ${money(market.salaryLimit - market.payroll)}`}
              </p>
            </>
          ) : (
            <p className="empty-state">Disponible cuando dirijas un club.</p>
          )}
        </Panel>
        <Panel title="Mercado y plantilla">
          {market ? (
            <>
              <span className={`market-state ${market.open ? 'open' : ''}`}>
                {market.open ? 'Mercado abierto' : 'Mercado cerrado'}
              </span>
              <p>
                {market.rosterSize} jugadores · Mín. {market.rosterMin} / Máx. {market.rosterMax}
              </p>
              <p className="note">{market.freeAgentCount} agentes libres en el mundo</p>
              <button className="text-action" onClick={() => props.onNavigate('market')}>
                Abrir mercado →
              </button>
            </>
          ) : (
            <p className="empty-state">Sin club asignado.</p>
          )}
        </Panel>
        <button className="portal-save-link" onClick={() => props.onNavigate('saves')}>
          Mis partidas guardadas <span aria-hidden="true">→</span>
        </button>
      </aside>
    </div>
  );
}
