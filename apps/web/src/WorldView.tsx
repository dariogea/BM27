import { useEffect, useRef, useState } from 'react';
import type { GameView } from './protocol';
import { describeTactics } from './MatchView';
import type { WorldPayload, WorldQuery } from './worldTypes';
import './world.css';

const ATTRIBUTE_NAMES: Record<string, string> = {
  closeShot: 'Tiro cerca del aro',
  midRange: 'Media distancia',
  threePoint: 'Triple',
  freeThrow: 'Tiro libre',
  passing: 'Pase',
  ballHandling: 'Bote',
  offensiveRebound: 'Rebote ofensivo',
  perimeterDefense: 'Defensa exterior',
  interiorDefense: 'Defensa interior',
  steal: 'Robo',
  block: 'Tapón',
  defensiveRebound: 'Rebote defensivo',
  speed: 'Velocidad',
  strength: 'Fuerza',
  stamina: 'Resistencia',
  jumping: 'Salto',
  decisions: 'Decisiones',
  composure: 'Serenidad',
  workRate: 'Trabajo',
  discipline: 'Disciplina',
};
const GROUP_NAMES: Record<string, string> = {
  offensive: 'Ataque',
  defensive: 'Defensa',
  physical: 'Físico',
  mental: 'Mental',
};
const money = (value: number): string => `${Math.round(value).toLocaleString('es-ES')} €`;
type SearchQuery = Extract<WorldQuery, { type: 'worldSearch' }>;

export function WorldView(props: {
  view: GameView;
  request: (query: WorldQuery) => Promise<WorldPayload>;
}) {
  const [text, setText] = useState('');
  const [entity, setEntity] = useState<'players' | 'clubs'>('players');
  const [competitionId, setCompetitionId] = useState('');
  const [includeRetired, setIncludeRetired] = useState(false);
  const [data, setData] = useState<WorldPayload | null>(null);
  const [history, setHistory] = useState<WorldPayload[]>([]);
  const [applied, setApplied] = useState<SearchQuery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profile = useRef<HTMLElement>(null);
  useEffect(() => {
    if (data && data.kind !== 'search') {
      profile.current?.focus({ preventScroll: true });
      profile.current?.scrollIntoView({ block: 'start' });
    }
  }, [data]);
  const reset = (): void => {
    setData(null);
    setHistory([]);
    setApplied(null);
  };
  const execute = async (query: WorldQuery, push = false): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const result = await props.request(query);
      if (query.type === 'worldSearch') {
        setApplied(query);
        setHistory([]);
      } else if (push && data) setHistory((stack) => [...stack.slice(-19), data]);
      setData(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const player = (id: string): void => {
    void execute({ type: 'worldPlayer', playerId: id }, true);
  };
  const club = (id: string): void => {
    void execute({ type: 'worldClub', teamId: id }, true);
  };
  return (
    <section className="world-browser" data-testid="world-browser">
      <header className="world-heading">
        <div>
          <span className="eyebrow">Conoce tu competición</span>
          <h1>Mundo del baloncesto</h1>
          <p className="note">
            Consulta los jugadores, los clubes y las estadísticas registradas de esta partida.
          </p>
        </div>
        <span className="status-pill">Temporada {props.view.seasonNumber}</span>
      </header>
      <form
        className="world-search"
        onSubmit={(event) => {
          event.preventDefault();
          void execute({
            type: 'worldSearch',
            entity,
            query: text,
            competitionId,
            page: 0,
            includeRetired,
          });
        }}
      >
        <label>
          Buscar en
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as 'players' | 'clubs');
              reset();
            }}
          >
            <option value="players">Jugadores</option>
            <option value="clubs">Clubes</option>
          </select>
        </label>
        <label>
          Nombre
          <input
            value={text}
            maxLength={120}
            placeholder="Todos, o escribe un nombre"
            onChange={(e) => {
              setText(e.target.value);
              reset();
            }}
          />
        </label>
        <label>
          Competición actual
          <select
            value={competitionId}
            onChange={(e) => {
              setCompetitionId(e.target.value);
              reset();
            }}
          >
            <option value="">Todo el mundo</option>
            {props.view.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {entity === 'players' && (
          <label className="world-checkbox">
            <input
              type="checkbox"
              checked={includeRetired}
              onChange={(e) => {
                setIncludeRetired(e.target.checked);
                reset();
              }}
            />{' '}
            Incluir retirados
          </label>
        )}
        <button type="submit" disabled={busy}>
          Buscar
        </button>
      </form>
      {competitionId && entity === 'players' && (
        <p className="note">Los agentes libres y retirados no tienen competición actual.</p>
      )}
      <p role="status" aria-live="polite" className="note">
        {busy
          ? 'Consultando…'
          : data?.kind === 'search'
            ? `${data.total} resultados · página ${data.page + 1} de ${Math.max(1, Math.ceil(data.total / data.pageSize))}`
            : ''}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {history.length > 0 && (
        <button
          disabled={busy}
          className="world-back"
          onClick={() => {
            setData(history[history.length - 1]!);
            setHistory((stack) => stack.slice(0, -1));
          }}
        >
          ← Volver a la consulta anterior
        </button>
      )}
      {!data && !busy && (
        <p className="empty-state">
          Elige jugadores o clubes y pulsa «Buscar». Puedes dejar el nombre vacío para explorarlos
          todos.
        </p>
      )}
      {data?.kind === 'search' && (
        <>
          <div className="scroll" tabIndex={0} role="region" aria-label="Resultados del buscador">
            <table>
              <caption>
                {data.entity === 'players' ? 'Jugadores de la partida' : 'Clubes de la partida'}
              </caption>
              <thead>
                <tr>
                  <th className="name">Nombre</th>
                  <th className="name">{data.entity === 'players' ? 'Club / estado' : 'Ciudad'}</th>
                  <th className="name">Competición</th>
                  <th className="name">Datos</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="name">
                      <button
                        className="text-action"
                        disabled={busy}
                        onClick={() => (data.entity === 'players' ? player(row.id) : club(row.id))}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="name">{row.context}</td>
                    <td className="name">{row.competition}</td>
                    <td className="name">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total === 0 && <p>No hay resultados con esos filtros.</p>}
          <div className="bar world-pagination">
            <button
              disabled={busy || data.page === 0 || !applied}
              onClick={() => {
                if (applied) void execute({ ...applied, page: data.page - 1 });
              }}
            >
              Página anterior
            </button>
            <span>{data.total} resultados</span>
            <button
              disabled={busy || (data.page + 1) * data.pageSize >= data.total || !applied}
              onClick={() => {
                if (applied) void execute({ ...applied, page: data.page + 1 });
              }}
            >
              Página siguiente
            </button>
          </div>
        </>
      )}
      {data?.kind === 'player' && (
        <article
          className="world-profile"
          ref={profile}
          tabIndex={-1}
          aria-label={data.name}
          data-testid="player-profile"
        >
          <h3>{data.name}</h3>
          <p>
            {data.age} años · {data.heightCm} cm · {data.positions.join(' / ')} ·{' '}
            {data.retired
              ? 'Retirado'
              : data.injuryGames > 0
                ? `Lesionado: ${data.injuryGames} partidos`
                : 'Disponible'}
          </p>
          {data.club ? (
            <button disabled={busy} className="text-action" onClick={() => club(data.club!.id)}>
              {data.club.name} →
            </button>
          ) : (
            <p>{data.retired ? 'Sin club actual' : 'Agente libre'}</p>
          )}
          <dl className="world-facts">
            <div>
              <dt>Contrato anual</dt>
              <dd>
                {data.contract
                  ? `${money(data.contract.salary)} · hasta temporada ${data.contract.endSeason}`
                  : 'Sin contrato'}
              </dd>
            </div>
            <div>
              <dt>Potencial</dt>
              <dd>{data.potential === null ? 'No revelado' : data.potential}</dd>
            </div>
          </dl>
          <div className="world-attributes">
            {Object.entries(data.attributes).map(([group, attributes]) => (
              <section key={group}>
                <h4>{GROUP_NAMES[group]}</h4>
                <dl>
                  {Object.entries(attributes).map(([attribute, value]) => (
                    <div key={attribute}>
                      <dt>{ATTRIBUTE_NAMES[attribute]}</dt>
                      <dd>
                        <meter
                          min={1}
                          max={99}
                          value={value}
                          aria-label={ATTRIBUTE_NAMES[attribute]}
                        />
                        <strong>{value}</strong>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <h4>Estadísticas registradas en esta partida</h4>
          {data.seasons.length === 0 ? (
            <p className="note">Todavía no hay partidos registrados para este jugador.</p>
          ) : (
            <div
              className="scroll"
              tabIndex={0}
              role="region"
              aria-label="Historial estadístico del jugador"
            >
              <table>
                <thead>
                  <tr>
                    <th>Temp.</th>
                    <th className="name">Club</th>
                    <th className="name">Competición</th>
                    <th>PJ</th>
                    <th>MIN</th>
                    <th>PTS</th>
                    <th>REB</th>
                    <th>ASI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.seasons.map((season) => (
                    <tr key={`${season.season}-${season.stats.teamId}-${season.competitionName}`}>
                      <td>{season.season}</td>
                      <td className="name">{season.teamName}</td>
                      <td className="name">{season.competitionName}</td>
                      <td>{season.stats.games}</td>
                      <td>
                        {season.stats.games
                          ? (season.stats.seconds / 60 / season.stats.games).toFixed(1)
                          : '—'}
                      </td>
                      <td>
                        {season.stats.games
                          ? (season.stats.points / season.stats.games).toFixed(1)
                          : '—'}
                      </td>
                      <td>
                        {season.stats.games
                          ? (
                              (season.stats.offensiveRebounds + season.stats.defensiveRebounds) /
                              season.stats.games
                            ).toFixed(1)
                          : '—'}
                      </td>
                      <td>
                        {season.stats.games
                          ? (season.stats.assists / season.stats.games).toFixed(1)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">
                MIN, PTS, REB y ASI son medias por partido. El historial empieza con los datos
                conservados de esta partida.
              </p>
            </div>
          )}
        </article>
      )}
      {data?.kind === 'club' && (
        <article
          className="world-profile"
          ref={profile}
          tabIndex={-1}
          aria-label={data.name}
          data-testid="club-profile"
        >
          <h3>{data.name}</h3>
          <p>
            {data.city} · {data.region} · {data.competition}
          </p>
          <dl className="world-facts">
            <div>
              <dt>Reputación</dt>
              <dd>{data.reputation}/100</dd>
            </div>
            <div>
              <dt>Tope salarial de la competición</dt>
              <dd>{money(data.salaryCap)} / año</dd>
            </div>
          </dl>
          <h4>Plan de juego</h4>
          <p>{describeTactics(data.tactics)}</p>
          <h4>Plantilla</h4>
          <div
            className="scroll"
            tabIndex={0}
            role="region"
            aria-label="Plantilla del club consultado"
          >
            <table>
              <thead>
                <tr>
                  <th className="name">Jugador</th>
                  <th>Edad</th>
                  <th>Posición</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((row) => (
                  <tr key={row.id}>
                    <td className="name">
                      <button
                        className="text-action"
                        disabled={busy}
                        onClick={() => player(row.id)}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td>{row.age}</td>
                    <td>{row.positions.join('/')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>Últimos resultados registrados</h4>
          {data.results.length === 0 ? (
            <p className="note">El club aún no tiene resultados registrados en la partida.</p>
          ) : (
            <div
              className="scroll"
              tabIndex={0}
              role="region"
              aria-label="Resultados del club consultado"
            >
              <table>
                <thead>
                  <tr>
                    <th>Temp.</th>
                    <th>Ronda</th>
                    <th className="name">Rival</th>
                    <th>Campo</th>
                    <th>Marcador del club</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((match) => (
                    <tr key={match.id}>
                      <td>{match.season}</td>
                      <td>
                        {match.playoff ? 'PO ' : ''}
                        {match.round}
                      </td>
                      <td className="name">{match.opponent}</td>
                      <td>{match.home ? 'Casa' : 'Fuera'}</td>
                      <td>
                        {match.ownScore}–{match.opponentScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
