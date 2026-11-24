import { useMemo, useState } from 'react';
import type { MatchDetail } from '@bm27/schema';
import { lineupBreakdown } from './lineupBreakdown';
import { buildReplay, replayClock } from './replayData';

interface Props {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  name: (teamId: string) => string;
}

export function LineupAnalysis(props: Props) {
  const [opened, setOpened] = useState(false);
  return (
    <details onToggle={(event) => setOpened(event.currentTarget.open)}>
      <summary>Rendimiento de los quintetos</summary>
      {opened && <LineupTable {...props} />}
    </details>
  );
}

function LineupTable({ detail, playerNames, name }: Props) {
  const [side, setSide] = useState<'home' | 'away'>('home');
  const frames = useMemo(() => buildReplay(detail).frames, [detail]);
  const rows = useMemo(() => lineupBreakdown(frames, side), [frames, side]);
  return (
    <>
      <div className="bar">
        <label>
          Quintetos de
          <select
            value={side}
            onChange={(event) => setSide(event.target.value === 'away' ? 'away' : 'home')}
          >
            <option value="home">{name(detail.boxScore.home.teamId)}</option>
            <option value="away">{name(detail.boxScore.away.teamId)}</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="note">Sin quintetos registrados.</p>
      ) : (
        <div className="scroll" tabIndex={0} role="region" aria-label="Tabla de quintetos">
          <table>
            <thead>
              <tr>
                <th scope="col" className="name">
                  Jugadores
                </th>
                <th scope="col">Tiempo</th>
                <th scope="col">A favor</th>
                <th scope="col">En contra</th>
                <th scope="col">+/−</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ players, seconds, pointsFor, pointsAgainst }) => {
                const margin = pointsFor - pointsAgainst;
                return (
                  <tr key={JSON.stringify(players)}>
                    <th scope="row" className="name">
                      {players.map((id) => playerNames[id] ?? id).join(' · ')}
                    </th>
                    <td>{replayClock(seconds)}</td>
                    <td>{pointsFor}</td>
                    <td>{pointsAgainst}</td>
                    <td>
                      {margin > 0 ? '+' : ''}
                      {margin}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
