import type { MatchDetail, MatchEvent, TeamBoxScore, TeamTactics } from '@bm27/schema';
import { useMemo, useState } from 'react';

export const minutes = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const TACTIC_LABELS: { [K in keyof TeamTactics]: [string, Record<string, string>] } = {
  pace: ['Ritmo', { slow: 'lento', normal: 'normal', fast: 'rápido' }],
  offenseFocus: ['Ataque', { inside: 'interior', balanced: 'equilibrado', perimeter: 'exterior' }],
  defenseScheme: ['Defensa', { man: 'individual', zone: 'zona' }],
  pickAndRollCoverage: [
    'Bloqueo directo',
    { drop: 'hundirse', switch: 'cambiar', hedge: 'salto y recuperar', blitz: 'dos contra uno' },
  ],
  pressure: ['Presión', { low: 'baja', normal: 'normal', high: 'alta' }],
  offensiveRebounding: [
    'Rebote ofensivo',
    { 'get-back': 'replegar', normal: 'normal', crash: 'cargar' },
  ],
  rotationDepth: ['Rotación', {}],
};

export function describeTactics(tactics: TeamTactics | undefined): string {
  if (!tactics) return '';
  return (Object.keys(TACTIC_LABELS) as (keyof TeamTactics)[])
    .map((key) => {
      const [label, values] = TACTIC_LABELS[key];
      const value = tactics[key];
      return `${label}: ${typeof value === 'number' ? `${value} jugadores` : (values[value] ?? value)}`;
    })
    .join(' · ');
}

const PLAY_LABELS: Record<string, string> = {
  'pick-and-roll': 'bloqueo directo',
  isolation: 'aislamiento',
  'post-up': 'poste',
  'spot-up': 'tiro tras pase',
  cut: 'corte',
  'off-screen': 'salida de bloqueo',
  transition: 'contraataque',
  putback: 'palmeo',
};
const ZONE_LABELS: Record<string, string> = {
  restricted: 'bajo el aro',
  paint: 'en la zona',
  midrange: 'de media distancia',
  corner3: 'triple desde la esquina',
  'above-break3': 'triple frontal',
};
const TURNOVER_LABELS: Record<string, string> = {
  'bad-pass': 'mal pase',
  'lost-ball': 'balón perdido',
  travel: 'pasos',
  'offensive-foul': 'falta en ataque',
  'shot-clock': 'se agota la posesión',
};

/** One line of play-by-play in plain Spanish, built only from the event. */
function describeEvent(event: MatchEvent, who: (id: string) => string): string | null {
  switch (event.type) {
    case 'shot': {
      const extra = event.assistPlayerId
        ? ` (asistencia de ${who(event.assistPlayerId)})`
        : event.blockPlayerId
          ? ` (tapón de ${who(event.blockPlayerId)})`
          : '';
      return `${who(event.playerId)} ${event.made ? `ANOTA ${event.points}` : 'falla'} ${ZONE_LABELS[event.zone]} · ${PLAY_LABELS[event.playType]}${extra}`;
    }
    case 'free_throw':
      return `${who(event.playerId)} ${event.made ? 'anota' : 'falla'} el tiro libre`;
    case 'rebound':
      return `Rebote ${event.kind === 'offensive' ? 'ofensivo' : 'defensivo'} de ${who(event.playerId)}`;
    case 'turnover':
      return `Pérdida de ${who(event.playerId)}: ${TURNOVER_LABELS[event.kind]}${event.stealPlayerId ? ` (robo de ${who(event.stealPlayerId)})` : ''}`;
    case 'foul':
      return `Falta ${event.kind === 'offensive' ? 'en ataque ' : event.intentional ? 'intencionada ' : ''}de ${who(event.playerId)}${event.freeThrows ? ` · ${event.freeThrows} tiros libres` : ''}${event.fouledOut ? ' · ELIMINADO' : ''}`;
    case 'substitution':
      return `Cambio: entra ${who(event.playerInId)} por ${who(event.playerOutId)}`;
    default:
      return null;
  }
}

function PlayByPlay(props: {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  name: (teamId: string) => string;
}) {
  const { detail } = props;
  const periods = detail.boxScore.home.periodPoints.length;
  const [period, setPeriod] = useState(1);
  const who = (id: string): string => props.playerNames[id] ?? id;
  const homeId = detail.boxScore.home.teamId;

  // Running score, rebuilt from the events themselves.
  const rows = useMemo(() => {
    let home = 0;
    let away = 0;
    const out: { key: number; period: number; clock: number; text: string; score: string }[] = [];
    const teamOfPlayer = new Map<string, string>();
    for (const side of [detail.boxScore.home, detail.boxScore.away]) {
      for (const line of side.players) teamOfPlayer.set(line.playerId, side.teamId);
    }
    for (const event of detail.events) {
      const points =
        event.type === 'shot' ? event.points : event.type === 'free_throw' && event.made ? 1 : 0;
      if (points > 0 && 'playerId' in event) {
        if (teamOfPlayer.get(event.playerId) === homeId) home += points;
        else away += points;
      }
      const text = describeEvent(event, who);
      if (text) {
        out.push({
          key: event.seq,
          period: event.period,
          clock: event.clock,
          text,
          score: `${home}–${away}`,
        });
      }
    }
    return out;
  }, [detail]);

  return (
    <div>
      <h3>Jugada a jugada</h3>
      <div className="bar">
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          aria-label="Periodo"
        >
          {Array.from({ length: periods }, (_, i) => (
            <option key={i} value={i + 1}>
              {i < 4 ? `Cuarto ${i + 1}` : `Prórroga ${i - 3}`}
            </option>
          ))}
        </select>
        <span className="note">Texto generado a partir del registro de eventos del partido.</span>
      </div>
      <table data-testid="playbyplay">
        <thead>
          <tr>
            <th>Reloj</th>
            <th>Marcador</th>
            <th className="name">Qué pasa</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.period === period)
            .map((r) => (
              <tr key={r.key}>
                <td>{minutes(r.clock)}</td>
                <td>{r.score}</td>
                <td className="name">{r.text}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoxScoreView(props: {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  tactics: Record<string, TeamTactics>;
  name: (teamId: string) => string;
}) {
  const { detail, name } = props;
  const { home, away } = detail.boxScore;
  return (
    <section data-testid="boxscore">
      <h2>
        Box score · {name(home.teamId)} {home.points} – {away.points} {name(away.teamId)}
      </h2>
      <table>
        <thead>
          <tr>
            <th className="name">Equipo</th>
            {home.periodPoints.map((_, i) => (
              <th key={i}>{i < 4 ? `C${i + 1}` : `PR${i - 3}`}</th>
            ))}
            <th>Total</th>
            <th>Posesiones</th>
          </tr>
        </thead>
        <tbody>
          {[home, away].map((team) => (
            <tr key={team.teamId}>
              <td className="name">{name(team.teamId)}</td>
              {team.periodPoints.map((p, i) => (
                <td key={i}>{p}</td>
              ))}
              <td>
                <strong>{team.points}</strong>
              </td>
              <td>{team.possessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        Estadísticas derivadas de {detail.events.length} eventos del registro del partido.
      </p>
      <p className="note">
        <strong>Tácticas de {name(home.teamId)}:</strong>{' '}
        {describeTactics(props.tactics[home.teamId])}
        <br />
        <strong>Tácticas de {name(away.teamId)}:</strong>{' '}
        {describeTactics(props.tactics[away.teamId])}
      </p>
      <TeamBox team={home} title={name(home.teamId)} playerNames={props.playerNames} />
      <TeamBox team={away} title={name(away.teamId)} playerNames={props.playerNames} />
      <PlayByPlay
        key={detail.result.id}
        detail={detail}
        playerNames={props.playerNames}
        name={name}
      />
    </section>
  );
}

function TeamBox(props: {
  team: TeamBoxScore;
  title: string;
  playerNames: Record<string, string>;
}) {
  const { team } = props;
  const headers = ['MIN', 'PTS', 'TC', 'T3', 'TL', 'RO', 'RD', 'AS', 'ROB', 'TAP', 'PER', 'FP'];
  const cells = (l: TeamBoxScore['totals']): (string | number)[] => [
    minutes(l.seconds),
    l.points,
    `${l.fieldGoalsMade}/${l.fieldGoalsAttempted}`,
    `${l.threePointersMade}/${l.threePointersAttempted}`,
    `${l.freeThrowsMade}/${l.freeThrowsAttempted}`,
    l.offensiveRebounds,
    l.defensiveRebounds,
    l.assists,
    l.steals,
    l.blocks,
    l.turnovers,
    l.fouls,
  ];
  const played = team.players
    .filter((l) => l.seconds > 0)
    .sort((a, b) => Number(b.starter) - Number(a.starter) || b.seconds - a.seconds);
  return (
    <div className="scroll">
      <h3>{props.title}</h3>
      <table>
        <thead>
          <tr>
            <th className="name">Jugador</th>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {played.map((l) => (
            <tr key={l.playerId}>
              <td className="name">
                {props.playerNames[l.playerId] ?? l.playerId}
                {l.starter ? ' *' : ''}
              </td>
              {cells(l).map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="name">
              <strong>Total</strong>
            </td>
            {cells(team.totals).map((c, i) => (
              <td key={i}>
                <strong>{c}</strong>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="note">* titular · no jugaron: {team.players.length - played.length}</p>
    </div>
  );
}
