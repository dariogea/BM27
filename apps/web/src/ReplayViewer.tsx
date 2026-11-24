import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchDetail } from '@bm27/schema';
import {
  buildReplay,
  replayClock,
  replayEventText,
  replayPlayerTotals,
  type ReplayTotals,
} from './replayData';
import './replay.css';

const STAT_ROWS: [string, (totals: ReplayTotals) => string | number][] = [
  ['Tiros de campo', (s) => `${s.fieldGoalsMade}/${s.fieldGoalsAttempted}`],
  ['Triples', (s) => `${s.threePointersMade}/${s.threePointersAttempted}`],
  ['Tiros libres', (s) => `${s.freeThrowsMade}/${s.freeThrowsAttempted}`],
  ['Rebotes ofensivos', (s) => s.offensiveRebounds],
  ['Rebotes defensivos', (s) => s.defensiveRebounds],
  ['Asistencias', (s) => s.assists],
  ['Robos', (s) => s.steals],
  ['Tapones', (s) => s.blocks],
  ['Pérdidas', (s) => s.turnovers],
  ['Faltas', (s) => s.fouls],
];

export function ReplayViewer(props: {
  managedTeamId: string | null;
  broadcast?: boolean;
  halftime?: boolean;
  startAt?: number;
  instructions?: string;
  onFinish?: () => void;
  detail: Pick<MatchDetail, 'events' | 'boxScore'>;
  playerNames: Record<string, string>;
  name: (id: string) => string;
}) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView({ block: 'start' });
  }, []);
  const [cursor, setCursor] = useState(props.startAt ?? 0);
  const [playing, setPlaying] = useState(props.broadcast ?? false);
  const [clip, setClip] = useState<{ end: number; returnTo: number } | null>(null);
  const [rate, setRate] = useState(5);
  const [selectedRosterSide, setRosterSide] = useState<'home' | 'away' | null>(null);
  const [team, setTeam] = useState('');
  const [outcome, setOutcome] = useState('all');
  const projection = useMemo(() => {
    try {
      return { data: buildReplay(props.detail), error: '' };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [props.detail]);
  const last = (projection.data?.frames.length ?? 1) - 1;
  const position = Math.min(cursor, last);
  const final = projection.data?.frames[last];
  const valid =
    final?.homeScore === props.detail.boxScore.home.points &&
    final?.awayScore === props.detail.boxScore.away.points;
  const { onFinish } = props;
  useEffect(() => {
    if (position === last && last > 0) onFinish?.();
  }, [position, last, onFinish]);
  useEffect(() => {
    if (!playing || !valid) return;
    if (cursor >= (clip?.end ?? last)) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setCursor((index) => Math.min(index + 1, last)),
      1000 / rate,
    );
    return () => window.clearTimeout(timer);
  }, [playing, cursor, last, rate, valid, clip]);
  if (!projection.data)
    return (
      <p className="error" role="alert">
        No se puede reproducir el registro: {projection.error}
      </p>
    );
  const { frames, shots, highlights } = projection.data;
  const frame = frames[position]!;
  const availableHighlights = highlights
    .filter((h) => h.end <= (clip?.returnTo ?? position))
    .reverse();
  const who = (id: string) => props.playerNames[id] ?? id;
  const seek = (at: number) => {
    setPlaying(false);
    setClip(null);
    setCursor(Math.max(0, Math.min(at, last)));
  };
  const togglePlayback = (): void => {
    if (!valid || last === 0) return;
    if (clip && position >= clip.end) setClip(null);
    if (position >= last) setCursor(0);
    setPlaying(!playing);
  };
  const nextPeriod = frames.findIndex(
    (f, index) => index > position && f.event?.type === 'period_start' && f.period > frame.period,
  );
  const visibleShots = shots.filter(
    (s) =>
      s.at <= position &&
      (!team || s.teamId === team) &&
      (outcome === 'all' || s.event.made === (outcome === 'made')),
  );
  const home = props.detail.boxScore.home.teamId;
  const away = props.detail.boxScore.away.teamId;
  const managingThisMatch = props.managedTeamId === home || props.managedTeamId === away;
  const rosterSide = selectedRosterSide ?? (props.managedTeamId === away ? 'away' : 'home');
  const rosterLabel = (id: string): string =>
    managingThisMatch
      ? `${id === props.managedTeamId ? 'Tu equipo' : 'Rival'} · ${props.name(id)}`
      : props.name(id);
  const roster = props.detail.boxScore[rosterSide];
  const onCourt = rosterSide === 'home' ? frame.homePlayers : frame.awayPlayers;
  return (
    <section
      className="replay-viewer"
      ref={region}
      tabIndex={0}
      aria-label="Repetición del registro"
      aria-keyshortcuts="Space ArrowLeft ArrowRight Home End"
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey)
          return;
        switch (event.key) {
          case ' ':
            if (!event.repeat) togglePlayback();
            break;
          case 'ArrowLeft':
            seek(position - 1);
            break;
          case 'ArrowRight':
            seek(position + 1);
            break;
          case 'Home':
            seek(0);
            break;
          case 'End':
            seek(last);
            break;
          default:
            return;
        }
        event.preventDefault();
      }}
      data-testid="replay-viewer"
    >
      <div className="replay-heading">
        <div>
          <h2>
            {props.halftime
              ? 'Primera mitad'
              : props.broadcast
                ? 'Retransmisión del partido'
                : 'Repetición y mapa de tiros'}
          </h2>
        </div>
        <span className="status-pill">{playing ? 'Reproduciendo' : 'En pausa'}</span>
      </div>

      {props.instructions && (
        <p className="note">
          <strong>Tu plan aplicado</strong> · {props.instructions}
        </p>
      )}
      {!valid && (
        <p className="error" role="alert">
          El registro no coincide con el marcador del acta. No se puede verificar esta repetición.
        </p>
      )}
      <div className="replay-scoreboard" aria-label="Marcador de la repetición">
        <div>
          <span>{props.name(home)}</span>
          <strong data-testid="replay-home-score">{frame.homeScore}</strong>
        </div>
        <div className="replay-clock">
          <span>Periodo {frame.period}</span>
          <strong>{replayClock(frame.clock)}</strong>
          <small>
            {position} / {last}
          </small>
        </div>
        <div>
          <span>{props.name(away)}</span>
          <strong data-testid="replay-away-score">{frame.awayScore}</strong>
        </div>
      </div>
      <div className="bar replay-controls">
        <button onClick={() => seek(0)} disabled={position === 0}>
          Inicio
        </button>
        <button onClick={() => seek(position - 1)} disabled={position === 0}>
          Jugada anterior
        </button>
        <button onClick={togglePlayback} disabled={!valid || last === 0}>
          {playing ? 'Pausar' : 'Reproducir'}
        </button>
        <button onClick={() => seek(position + 1)} disabled={position >= last}>
          Jugada siguiente
        </button>
        <button onClick={() => seek(nextPeriod)} disabled={nextPeriod < 0}>
          Siguiente periodo
        </button>
        <button onClick={() => seek(last)} disabled={position >= last}>
          {props.halftime ? 'Saltar al descanso' : 'Saltar al final'}
        </button>
        <label>
          Velocidad
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            <option value={2}>Lenta</option>
            <option value={5}>Normal</option>
            <option value={10}>Rápida</option>
          </select>
        </label>
      </div>
      <label className="replay-progress">
        Secuencia de juego
        <input
          type="range"
          min={0}
          max={last}
          value={position}
          step={1}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </label>
      <p className="replay-current" data-testid="replay-event">
        {replayEventText(frame.event, who)}
      </p>
      <div className="bar">
        <label>
          Repetir jugada destacada
          <select
            value={clip?.end ?? ''}
            disabled={!valid || availableHighlights.length === 0}
            onChange={(e) => {
              const highlight = availableHighlights.find((h) => h.end === Number(e.target.value));
              if (!highlight) return;
              setClip({ end: highlight.end, returnTo: clip?.returnTo ?? position });
              setCursor(highlight.start);
              setPlaying(true);
            }}
          >
            <option value="" disabled>
              Elegir jugada
            </option>
            {availableHighlights.map((h) => (
              <option key={h.end} value={h.end}>
                P{frames[h.end]!.period} · {replayClock(frames[h.end]!.clock)} · {h.label} ·{' '}
                {who(h.playerId)} · {props.name(h.teamId)}
              </option>
            ))}
          </select>
        </label>
        {clip && <button onClick={() => seek(clip.returnTo)}>Volver al punto anterior</button>}
      </div>
      <details className="replay-player-stats">
        <summary>Estadísticas por jugador</summary>
        <label className="bar">
          Consultar estadísticas de
          <select
            value={rosterSide}
            onChange={(e) => setRosterSide(e.target.value === 'away' ? 'away' : 'home')}
          >
            <option value="home">{rosterLabel(home)}</option>
            <option value="away">{rosterLabel(away)}</option>
          </select>
        </label>
        <div className="scroll" tabIndex={0} role="region" aria-label="Tabla de jugadores">
          <table>
            <caption>Jugadores hasta la jugada actual · {props.name(roster.teamId)}</caption>
            <thead>
              <tr>
                <th scope="col" className="name">
                  Jugador
                </th>
                <th scope="col" className="name">
                  En pista
                </th>
                <th scope="col">Minutos</th>
                <th scope="col">Puntos</th>
                {STAT_ROWS.map(([label]) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
                <th scope="col" title="Diferencia de puntos del equipo con el jugador en pista">
                  +/−
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.players.map(({ playerId }) => {
                const line = replayPlayerTotals(frame, playerId);
                return (
                  <tr key={playerId}>
                    <th scope="row" className="name">
                      {who(playerId)}
                    </th>
                    <td className="name">{onCourt.includes(playerId) ? 'Sí' : '—'}</td>
                    <td>{replayClock(line.seconds)}</td>
                    <td>{line.points}</td>
                    {STAT_ROWS.map(([label, format]) => (
                      <td key={label}>{format(line)}</td>
                    ))}
                    <td>
                      {line.plusMinus > 0 ? '+' : ''}
                      {line.plusMinus}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <div className="replay-grid">
        <section className="replay-court-panel" aria-label="Mapa de tiros de campo">
          <h3>Mapa de tiros hasta este evento</h3>
          <div className="bar">
            <label>
              Equipo del mapa
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">Ambos equipos</option>
                <option value={home}>{props.name(home)}</option>
                <option value={away}>{props.name(away)}</option>
              </select>
            </label>
            <label>
              Resultado del tiro
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="all">Todos los tiros</option>
                <option value="made">Anotados</option>
                <option value="missed">Fallados</option>
              </select>
            </label>
          </div>
          <p className="note">● Anotado · × Fallado · {visibleShots.length} tiros de campo</p>
          <svg
            viewBox="0 0 15 14"
            className="replay-court"
            role="group"
            aria-label="Media pista con los tiros registrados"
          >
            <g className="court-lines" aria-hidden="true">
              <rect x="0.1" y="0.1" width="14.8" height="13.8" />
              <rect x="5.05" y="0.1" width="4.9" height="5.7" />
              <circle cx="7.5" cy="5.8" r="1.8" />
              <path d="M 0.9 0.1 L 0.9 3 A 6.75 6.75 0 0 0 14.1 3 L 14.1 0.1" />
              <path d="M 5.7 13.9 A 1.8 1.8 0 0 1 9.3 13.9" />
              <line x1="6.6" x2="8.4" y1="1.2" y2="1.2" />
              <circle cx="7.5" cy="1.575" r="0.225" />
            </g>
            {visibleShots.map((shot) => {
              const e = shot.event;
              const description = `${who(e.playerId)}, periodo ${e.period}, ${replayClock(e.clock)}, ${e.made ? 'anotado' : 'fallado'}`;
              return (
                <g
                  key={shot.at}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ir al tiro: ${description}`}
                  className={`replay-shot ${e.made ? 'made' : 'missed'} ${shot.at === position ? 'current' : ''}`}
                  data-event-index={shot.at}
                  data-x={e.x}
                  data-y={e.y}
                  onClick={() => seek(shot.at)}
                  onKeyDown={(key) => {
                    if (key.key === 'Enter' || key.key === ' ') {
                      key.preventDefault();
                      seek(shot.at);
                    }
                  }}
                >
                  <title>
                    {description} · {e.x}, {e.y} m
                  </title>
                  <circle className="shot-hit" cx={e.x} cy={e.y} r="0.35" />
                  <circle cx={e.x} cy={e.y} r="0.18" />
                  {!e.made && (
                    <path d={`M ${e.x - 0.11} ${e.y - 0.11} l .22 .22 m -.22 0 l .22 -.22`} />
                  )}
                </g>
              );
            })}
          </svg>
        </section>
        <aside className="replay-rosters" aria-label="Estadísticas y quintetos registrados">
          <table className="replay-stats">
            <caption>Estadísticas hasta la jugada actual</caption>
            <thead>
              <tr>
                <th scope="col">Dato</th>
                <th scope="col">{props.name(home)}</th>
                <th scope="col">{props.name(away)}</th>
              </tr>
            </thead>
            <tbody>
              {STAT_ROWS.map(([label, format]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{format(frame.homeTotals)}</td>
                  <td>{format(frame.awayTotals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Quintetos en pista</h3>
          {[
            { id: home, players: frame.homePlayers },
            { id: away, players: frame.awayPlayers },
          ].map(({ id, players }) => (
            <section key={id}>
              <h4>{props.name(id)}</h4>
              {players.length ? (
                <ol>
                  {players.map((player) => (
                    <li key={player}>{who(player)}</li>
                  ))}
                </ol>
              ) : (
                <p className="note">Antes del salto inicial.</p>
              )}
            </section>
          ))}
          <h3>Últimas jugadas</h3>
          <ol className="replay-recent">
            {frames.slice(Math.max(1, position - 4), position + 1).map((f, index) => (
              <li key={index}>
                {replayClock(f.clock)} · {replayEventText(f.event, who)}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
