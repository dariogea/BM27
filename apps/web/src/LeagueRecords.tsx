import { useState } from 'react';
import type { GameView } from './protocol';
import type { WorldPayload, WorldQuery } from './worldTypes';
import {
  LEADER_METRICS,
  type LeaderMetric,
  type LeaderMode,
  type LeagueRecordsPayload,
} from './leagueRecordsTypes';

export function LeagueRecords(props: {
  view: GameView;
  request: (query: WorldQuery) => Promise<WorldPayload>;
  onPlayer: (id: string) => void;
  onClub: (id: string) => void;
}) {
  const [competitionId, setCompetition] = useState(props.view.competitions[0]?.id ?? '');
  const [season, setSeason] = useState(0);
  const [metric, setMetric] = useState<LeaderMetric>('points');
  const [mode, setMode] = useState<LeaderMode>('average');
  const [minGames, setMinGames] = useState(1);
  const [minMinutes, setMinMinutes] = useState(0);
  const [minAttempts, setMinAttempts] = useState(10);
  const [data, setData] = useState<LeagueRecordsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = () => setData(null);
  const percentage = metric.endsWith('Percent');
  return (
    <section className="league-records" aria-label="Líderes y palmarés">
      <h2>Líderes y palmarés</h2>
      <p className="note">
        Estadísticas de esta partida: liga regular y playoffs juntos. El club es el registrado en
        esa temporada.
      </p>
      <form
        className="world-search"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const result = await props.request({
              type: 'worldRecords',
              competitionId,
              season,
              metric,
              mode,
              minGames,
              minAttempts,
              minMinutes,
            });
            if (result.kind !== 'records') throw new Error('Respuesta de estadísticas no válida.');
            setData(result);
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Competición de los líderes
          <select
            value={competitionId}
            disabled={busy}
            onChange={(e) => {
              setCompetition(e.target.value);
              setSeason(0);
              changed();
            }}
          >
            {props.view.competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Temporada de los líderes
          <select
            value={season}
            disabled={busy}
            onChange={(e) => {
              setSeason(Number(e.target.value));
              changed();
            }}
          >
            <option value={0}>Última registrada</option>
            {Array.from({ length: props.view.seasonNumber }, (_, i) => i + 1)
              .reverse()
              .map((n) => (
                <option key={n} value={n}>
                  Temporada {n}
                </option>
              ))}
          </select>
        </label>
        <label>
          Estadística
          <select
            value={metric}
            disabled={busy}
            onChange={(e) => {
              setMetric(e.target.value as LeaderMetric);
              changed();
            }}
          >
            {Object.entries(LEADER_METRICS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cálculo
          <select
            value={mode}
            disabled={busy || percentage}
            onChange={(e) => {
              setMode(e.target.value as LeaderMode);
              changed();
            }}
          >
            <option value="average">Por partido</option>
            <option value="total">Total</option>
            <option value="per40">Por 40 minutos</option>
          </select>
        </label>
        <label>
          Mínimo de partidos
          <input
            type="number"
            min={0}
            step={1}
            required
            value={minGames}
            disabled={busy}
            onChange={(e) => {
              setMinGames(e.target.valueAsNumber);
              changed();
            }}
          />
        </label>
        <label>
          Mínimo de minutos
          <input
            type="number"
            min={0}
            step={1}
            required
            value={minMinutes}
            disabled={busy}
            onChange={(e) => {
              setMinMinutes(e.target.valueAsNumber);
              changed();
            }}
          />
        </label>
        <label>
          Mínimo de intentos
          <input
            type="number"
            min={0}
            step={1}
            required
            value={minAttempts}
            disabled={busy || !percentage}
            onChange={(e) => {
              setMinAttempts(e.target.valueAsNumber);
              changed();
            }}
          />
        </label>
        <button disabled={busy} type="submit">
          Consultar líderes
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p role="status" className="note">
        {busy
          ? 'Consultando estadísticas…'
          : data
            ? `Temporada ${data.season} · ${data.completed ? 'Cerrada' : 'En curso'} · ${data.total} jugadores clasificados`
            : ''}
      </p>
      {data && (
        <>
          <h3>
            {data.competitionName} · temporada {data.season}
          </h3>
          <p className="note">
            {data.metric.endsWith('Percent')
              ? `Porcentaje de aciertos sobre intentos; mínimo ${data.minAttempts} intentos.`
              : data.mode === 'average'
                ? 'Media por partido jugado.'
                : data.mode === 'per40'
                  ? 'Rendimiento por 40 minutos en pista.'
                  : 'Total acumulado.'}{' '}
            Mínimo {data.minGames} partidos y {data.minMinutes ?? 0} minutos. Hasta 50 registros;
            empates con la misma posición.
          </p>
          {data.rows.length === 0 ? (
            <p>No hay jugadores que cumplan estos filtros.</p>
          ) : (
            <div className="scroll" role="region" tabIndex={0} aria-label="Tabla de líderes">
              <table>
                <caption>{LEADER_METRICS[data.metric]}</caption>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th className="name">Jugador</th>
                    <th className="name">Club registrado</th>
                    <th>PJ</th>
                    <th>
                      {data.mode === 'per40' && !data.metric.endsWith('Percent')
                        ? 'Por 40 min'
                        : 'Valor'}
                    </th>
                    <th>Base del cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={`${row.playerId}-${row.teamId}`}>
                      <td>{row.rank}</td>
                      <td className="name">
                        <button
                          className="text-action"
                          onClick={() => props.onPlayer(row.playerId)}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="name">
                        <button className="text-action" onClick={() => props.onClub(row.teamId)}>
                          {row.teamName}
                        </button>
                      </td>
                      <td>{row.games}</td>
                      <td>
                        {row.value.toLocaleString('es-ES', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        {data.metric.endsWith('Percent') ? '%' : ''}
                      </td>
                      <td>
                        {row.numerator} /{' '}
                        {data.mode === 'per40' && !data.metric.endsWith('Percent')
                          ? `${(row.denominator / 60).toLocaleString('es-ES', { maximumFractionDigits: 2 })} min × 40`
                          : row.denominator}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3>Palmarés registrado · {data.competitionName}</h3>
          <p className="note">
            Solo temporadas cerradas conservadas. No incluye títulos anteriores al inicio de la
            partida.
          </p>
          {data.honours.length === 0 ? (
            <p>Aún no hay temporadas cerradas.</p>
          ) : (
            <div
              className="scroll"
              role="region"
              tabIndex={0}
              aria-label="Palmarés de la competición"
            >
              <table>
                <thead>
                  <tr>
                    <th>Temp.</th>
                    <th className="name">Campeón</th>
                    <th className="name">Ascensos</th>
                    <th className="name">Descensos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.honours.map((h) => (
                    <tr key={h.season}>
                      <td>{h.season}</td>
                      {[[h.champion], h.promoted, h.relegated].map((list, i) => (
                        <td key={i} className="name">
                          {list.length
                            ? list.map((t) => (
                                <button
                                  key={t.id}
                                  className="text-action honour-club"
                                  onClick={() => props.onClub(t.id)}
                                >
                                  {t.name}
                                </button>
                              ))
                            : 'Ninguno'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
