import type {
  CompetitionSeason,
  MatchDetail,
  MatchEvent,
  Season,
  TeamBoxScore,
  TeamTactics,
} from '@bm27/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Command, Reply, UniverseSummary } from './protocol';

type Pending = Command extends infer C ? (C extends { id: number } ? Omit<C, 'id'> : never) : never;

/** Thin client for the simulation worker: send a command, await its reply. */
function useSimulation() {
  const workerRef = useRef<Worker | null>(null);
  const waiting = useRef(new Map<number, (reply: Reply) => void>());
  const nextId = useRef(1);

  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const pending = waiting.current;
    worker.onmessage = (event: MessageEvent<Reply>) => {
      pending.get(event.data.id)?.(event.data);
      pending.delete(event.data.id);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      pending.clear();
    };
  }, []);

  return (command: Pending): Promise<Reply> =>
    new Promise((resolve) => {
      const id = nextId.current++;
      waiting.current.set(id, resolve);
      workerRef.current?.postMessage({ ...command, id });
    });
}

export function App() {
  const send = useSimulation();
  const [seed, setSeed] = useState('bm27');
  const [summary, setSummary] = useState<UniverseSummary | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [competitionId, setCompetitionId] = useState('');
  const [detail, setDetail] = useState<{
    detail: MatchDetail;
    playerNames: Record<string, string>;
    tactics: Record<string, TeamTactics>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Elige una semilla y pulsa «Generar universo».');
  const [error, setError] = useState('');

  const run = async (command: Pending, working: string): Promise<void> => {
    setBusy(true);
    setError('');
    setStatus(working);
    const reply = await send(command);
    setBusy(false);
    switch (reply.type) {
      case 'error':
        setError(reply.message);
        setStatus('');
        break;
      case 'universe':
        setSummary(reply.summary);
        setSeason(null);
        setDetail(null);
        setCompetitionId(reply.summary.competitions[0]?.id ?? '');
        setStatus(
          `Universo generado en ${reply.ms} ms: ${reply.summary.teamCount} equipos y ${reply.summary.playerCount} jugadores.`,
        );
        break;
      case 'season': {
        setSummary(reply.summary);
        setSeason(reply.season);
        setDetail(null);
        const matches = reply.season.competitions.reduce((n, c) => n + c.matches.length, 0);
        setStatus(
          `Temporada ${reply.season.seasonNumber} simulada en ${reply.ms} ms (${matches} partidos).`,
        );
        break;
      }
      case 'matchDetail':
        setDetail({
          detail: reply.detail,
          playerNames: reply.playerNames,
          tactics: reply.tactics,
        });
        setStatus(`Partido reconstruido desde su semilla en ${reply.ms} ms.`);
        break;
    }
  };

  const competition = season?.competitions.find((c) => c.competitionId === competitionId);
  const name = (teamId: string): string => summary?.teamNames[teamId] ?? teamId;

  return (
    <main>
      <h1>
        BM27 · Prototipo técnico{' '}
        <span className="tag">motor de partido v1 · entrenador PLACEHOLDER</span>
      </h1>
      <p className="note">
        Página sin diseño. La simulación se ejecuta en un Web Worker; esta página solo envía órdenes
        y muestra resultados.
      </p>

      <div className="bar">
        <label>
          Semilla{' '}
          <input value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Semilla" />
        </label>
        <button disabled={busy} onClick={() => run({ type: 'generate', seed }, 'Generando…')}>
          Generar universo
        </button>
        <button
          disabled={busy || !summary}
          onClick={() => run({ type: 'simulateSeason' }, 'Simulando temporada…')}
        >
          Simular temporada{summary ? ` ${summary.seasonNumber}` : ''}
        </button>
      </div>
      <p data-testid="status">{status}</p>
      {error && <p className="error">Error: {error}</p>}

      {summary && (
        <div className="bar">
          <label>
            Competición{' '}
            <select
              value={competitionId}
              onChange={(e) => {
                setCompetitionId(e.target.value);
                setDetail(null);
              }}
            >
              {summary.competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  Nivel {c.level} · {c.name} ({c.teamCount} equipos)
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {summary && !season && (
        <p className="note">Pulsa «Simular temporada» para ver clasificaciones y partidos.</p>
      )}

      {competition && (
        <CompetitionView
          key={`${season?.seasonNumber}-${competition.competitionId}`}
          competition={competition}
          seasonNumber={season?.seasonNumber ?? 0}
          name={name}
          selectedMatchId={detail?.detail.result.id ?? ''}
          onMatch={(matchId) => run({ type: 'matchDetail', matchId }, 'Reconstruyendo partido…')}
        />
      )}

      {detail && (
        <BoxScoreView
          detail={detail.detail}
          playerNames={detail.playerNames}
          tactics={detail.tactics}
          name={name}
        />
      )}
    </main>
  );
}

function CompetitionView(props: {
  competition: CompetitionSeason;
  seasonNumber: number;
  name: (teamId: string) => string;
  selectedMatchId: string;
  onMatch: (matchId: string) => void;
}) {
  const { competition, name } = props;
  const [stage, setStage] = useState<'regular' | 'playoff'>('regular');
  const [round, setRound] = useState(1);
  const promoted = new Set(competition.promotedTeamIds);
  const relegated = new Set(competition.relegatedTeamIds);
  const inPlayoffs = new Set(
    competition.playoffSeries.flatMap((s) => [s.highSeedTeamId, s.lowSeedTeamId ?? '']),
  );

  const rounds = useMemo(() => {
    const set = new Set(competition.matches.filter((m) => m.stage === stage).map((m) => m.round));
    return [...set].sort((a, b) => a - b);
  }, [competition, stage]);
  const matches = competition.matches.filter((m) => m.stage === stage && m.round === round);

  return (
    <section>
      <h2>
        Temporada {props.seasonNumber} · Campeón: {name(competition.championTeamId)}
      </h2>
      <p className="note">
        <span className="up">Verde</span>: asciende · <span className="down">Rojo</span>: desciende
        · <span className="playoff">Azul</span>: juega playoffs. Desempates: victorias,
        enfrentamientos directos, diferencia de puntos.
      </p>
      <div className="columns">
        {competition.groups.map((group) => (
          <div key={group.name} className="scroll">
            <h3>Clasificación · {group.name}</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="name">Equipo</th>
                  <th>PJ</th>
                  <th>G</th>
                  <th>P</th>
                  <th>PF</th>
                  <th>PC</th>
                  <th>Dif</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((row) => (
                  <tr
                    key={row.teamId}
                    className={
                      promoted.has(row.teamId)
                        ? 'up'
                        : relegated.has(row.teamId)
                          ? 'down'
                          : inPlayoffs.has(row.teamId)
                            ? 'playoff'
                            : ''
                    }
                  >
                    <td>{row.position}</td>
                    <td className="name">{name(row.teamId)}</td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{row.pointsFor}</td>
                    <td>{row.pointsAgainst}</td>
                    <td>{row.pointsFor - row.pointsAgainst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {competition.playoffSeries.length > 0 && (
        <>
          <h3>Playoffs</h3>
          <table>
            <thead>
              <tr>
                <th>Ronda</th>
                <th className="name">Mejor clasificado</th>
                <th>Resultado</th>
                <th className="name">Rival</th>
                <th className="name">Pasa</th>
              </tr>
            </thead>
            <tbody>
              {competition.playoffSeries.map((s, i) => (
                <tr key={i}>
                  <td>{s.round}</td>
                  <td className="name">
                    ({s.highSeed}) {name(s.highSeedTeamId)}
                  </td>
                  <td>{s.lowSeedTeamId ? `${s.highSeedWins}–${s.lowSeedWins}` : 'exento'}</td>
                  <td className="name">{s.lowSeedTeamId ? name(s.lowSeedTeamId) : '—'}</td>
                  <td className="name">{name(s.winnerTeamId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3>Partidos</h3>
      <div className="bar">
        <select
          value={stage}
          onChange={(e) => {
            setStage(e.target.value as 'regular' | 'playoff');
            setRound(1);
          }}
          aria-label="Fase"
        >
          <option value="regular">Liga regular</option>
          <option value="playoff">Playoffs</option>
        </select>
        <select
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
          aria-label="Jornada"
        >
          {rounds.map((r) => (
            <option key={r} value={r}>
              {stage === 'regular' ? 'Jornada' : 'Ronda'} {r}
            </option>
          ))}
        </select>
        <span className="note">Pulsa un partido para ver su box score.</span>
      </div>
      <table>
        <thead>
          <tr>
            <th className="name">Local</th>
            <th>Pts</th>
            <th>Pts</th>
            <th className="name">Visitante</th>
            <th>Prórrogas</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr
              key={m.id}
              className={`clickable ${m.id === props.selectedMatchId ? 'selected' : ''}`}
              onClick={() => props.onMatch(m.id)}
            >
              <td className="name">{name(m.homeTeamId)}</td>
              <td>{m.homeScore}</td>
              <td>{m.awayScore}</td>
              <td className="name">{name(m.awayTeamId)}</td>
              <td>{m.overtimePeriods || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const minutes = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const TACTIC_LABELS: { [K in keyof TeamTactics]: [string, Record<string, string>] } = {
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

function describeTactics(tactics: TeamTactics | undefined): string {
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

function BoxScoreView(props: {
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
