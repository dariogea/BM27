import { useState } from 'react';
import type { PlayerSeasonStats } from '@bm27/schema';
import type { WorldPlayer } from './worldTypes';

const metrics = {
  points: ['Puntos', (stats) => stats.points],
  rebounds: ['Rebotes', (stats) => stats.offensiveRebounds + stats.defensiveRebounds],
  assists: ['Asistencias', (stats) => stats.assists],
  minutes: ['Minutos', (stats) => stats.seconds / 60],
} satisfies Record<string, [string, (stats: PlayerSeasonStats) => number]>;
type Metric = keyof typeof metrics;

const decimal = new Intl.NumberFormat('es', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function PlayerTrend({ seasons }: { seasons: WorldPlayer['seasons'] }) {
  const [metric, setMetric] = useState<Metric>('points');
  const [label, total] = metrics[metric];
  const rows = seasons
    .filter((row) => row.stats.games > 0)
    .map((row) => ({ ...row, value: total(row.stats) / row.stats.games }))
    .sort((a, b) => a.season - b.season);
  if (rows.length < 2) return null;
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <figure className="player-trend" aria-label="Evolución por temporada">
      <figcaption>{label} por partido</figcaption>
      <label>
        Estadística de evolución
        <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>
          {Object.entries(metrics).map(([id, [name]]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <ol>
        {rows.map((row) => (
          <li key={`${row.season}-${row.stats.teamId}-${row.competitionName}`}>
            <span>
              Temporada {row.season} · {row.teamName} · {row.competitionName}
            </span>
            <span className="player-trend-track" aria-hidden="true">
              <span style={{ width: `${(100 * row.value) / maximum}%` }} />
            </span>
            <strong>{decimal.format(row.value)}</strong>
            <small>
              {row.stats.games} {row.stats.games === 1 ? 'partido' : 'partidos'}
            </small>
          </li>
        ))}
      </ol>
    </figure>
  );
}
