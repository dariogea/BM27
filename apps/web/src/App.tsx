import type { MatchDetail, TeamTactics } from '@bm27/schema';
import { useEffect, useRef, useState } from 'react';
import { CompetitionView } from './CompetitionView';
import { BoxScoreView } from './MatchView';
import type { Command, GameView, Reply } from './protocol';
import { LineupEditor, OffseasonPanel, SquadTable, TacticsEditor } from './TeamView';

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

type Tab = 'team' | 'tactics' | 'lineup' | 'competition' | 'match';
const TABS: [Tab, string][] = [
  ['team', 'Mi equipo'],
  ['tactics', 'Tácticas'],
  ['lineup', 'Quinteto'],
  ['competition', 'Competición'],
  ['match', 'Partido'],
];

interface ShownMatch {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  tactics: Record<string, TeamTactics>;
}

export function App() {
  const send = useSimulation();
  const [seed, setSeed] = useState('bm27');
  const [view, setView] = useState<GameView | null>(null);
  const [tab, setTab] = useState<Tab>('competition');
  const [competitionId, setCompetitionId] = useState('');
  const [teamChoice, setTeamChoice] = useState('');
  const [match, setMatch] = useState<ShownMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Elige una semilla y pulsa «Generar universo».');
  const [error, setError] = useState('');
  /** Bumped whenever the team's saved settings change, to reset the editors. */
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

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
      case 'state': {
        setView(reply.view);
        setStatus(reply.message);
        setRevision((n) => n + 1);
        const mine = reply.view.myTeam;
        if (command.type === 'generate' || command.type === 'importSave') {
          setMatch(null);
          setCompetitionId(mine?.competitionId ?? reply.view.competitions[0]?.id ?? '');
          setTeamChoice(reply.view.userTeamId ?? reply.view.competitions[0]?.teamIds[0] ?? '');
          setTab(mine ? 'team' : 'competition');
        }
        if (command.type === 'chooseTeam' && mine) {
          setCompetitionId(mine.competitionId);
          setTab('team');
        }
        if (command.type === 'finishSeason' || command.type === 'advance') {
          // After promotion or relegation the team may have changed competition.
          if (mine && !reply.view.seasonInProgress) setCompetitionId(mine.competitionId);
        }
        break;
      }
      case 'matchDetail':
        setMatch({ detail: reply.detail, playerNames: reply.playerNames, tactics: reply.tactics });
        setTab('match');
        setStatus('');
        break;
      case 'save': {
        const url = URL.createObjectURL(new Blob([reply.json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = reply.fileName;
        link.click();
        URL.revokeObjectURL(url);
        setStatus(
          `Partida guardada en el archivo ${reply.fileName} (${(reply.json.length / 1024 / 1024).toFixed(1)} MB).`,
        );
        break;
      }
    }
  };

  const name = (teamId: string): string => view?.teamNames[teamId] ?? teamId;
  const table = view?.tables.find((c) => c.competitionId === competitionId);
  const mine = view?.myTeam ?? null;
  const openMatch = (matchId: string): Promise<void> =>
    run({ type: 'matchDetail', matchId }, 'Abriendo partido…');

  return (
    <main>
      <h1>
        BM27 <span className="tag">motor de partido v1 · entrenador rival PLACEHOLDER</span>
      </h1>

      <div className="bar">
        <label>
          Semilla{' '}
          <input value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Semilla" />
        </label>
        <button disabled={busy} onClick={() => run({ type: 'generate', seed }, 'Generando…')}>
          Generar universo
        </button>
        <button disabled={busy || !view} onClick={() => run({ type: 'exportSave' }, 'Guardando…')}>
          Guardar partida
        </button>
        <button disabled={busy} onClick={() => fileInput.current?.click()}>
          Cargar partida
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="load-file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) await run({ type: 'importSave', json: await file.text() }, 'Cargando…');
          }}
        />
      </div>

      {view && (
        <div className="bar">
          <label>
            Equipo{' '}
            <select
              value={teamChoice}
              onChange={(e) => setTeamChoice(e.target.value)}
              aria-label="Equipo"
            >
              {view.competitions.map((c) => (
                <optgroup key={c.id} label={`Nivel ${c.level} · ${c.name}`}>
                  {[...c.teamIds]
                    .sort((a, b) => name(a).localeCompare(name(b), 'es'))
                    .map((teamId) => (
                      <option key={teamId} value={teamId}>
                        {name(teamId)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !teamChoice || teamChoice === view.userTeamId}
            onClick={() => run({ type: 'chooseTeam', teamId: teamChoice }, 'Cambiando de equipo…')}
          >
            Dirigir este equipo
          </button>
          <button disabled={busy} onClick={() => run({ type: 'advance' }, 'Jugando jornada…')}>
            Jugar jornada
          </button>
          <button
            disabled={busy}
            onClick={() => run({ type: 'finishSeason' }, 'Simulando hasta el final…')}
          >
            Simular hasta el final de la temporada
          </button>
        </div>
      )}

      <p data-testid="status">{status}</p>
      {error && <p className="error">Error: {error}</p>}

      {view && (
        <>
          <p className="note" data-testid="summary">
            Temporada {view.seasonNumber}
            {view.seasonInProgress
              ? ` · en curso (${view.step} jornadas jugadas)`
              : ' · sin empezar'}
            {mine
              ? ` · Diriges a ${mine.name} (nivel ${mine.level})${mine.position ? ` · ${mine.position}º, ${mine.wins} victorias y ${mine.losses} derrotas` : ''}`
              : ' · No diriges ningún equipo'}
          </p>
          <div className="tabs">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
                disabled={(id === 'team' || id === 'tactics' || id === 'lineup') && !mine}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {view && tab === 'team' && mine && (
        <section>
          <h2>
            {mine.name} · {mine.competitionName}
          </h2>
          <p>
            {mine.nextMatch ? (
              <>
                <strong>Próximo partido:</strong>{' '}
                {mine.nextMatch.home ? 'en casa contra' : 'fuera contra'}{' '}
                {name(mine.nextMatch.opponentId)}.{' '}
              </>
            ) : view.seasonInProgress ? (
              <>Tu equipo no tiene más partidos esta temporada. </>
            ) : (
              <>La temporada aún no ha empezado: pulsa «Jugar jornada». </>
            )}
            {mine.lastMatch && (
              <>
                <strong>Último:</strong> {name(mine.lastMatch.homeTeamId)}{' '}
                {mine.lastMatch.homeScore} – {mine.lastMatch.awayScore}{' '}
                {name(mine.lastMatch.awayTeamId)}{' '}
                <button disabled={busy} onClick={() => openMatch(mine.lastMatch!.id)}>
                  Ver partido
                </button>
              </>
            )}
          </p>
          {view.offseason && <OffseasonPanel report={view.offseason} />}
          <SquadTable squad={mine.squad} />
        </section>
      )}

      {view && tab === 'tactics' && mine && (
        <section>
          <h2>Tácticas de {mine.name}</h2>
          <TacticsEditor
            key={revision}
            team={mine}
            busy={busy}
            onSave={(tactics) => run({ type: 'setTactics', tactics }, 'Guardando tácticas…')}
          />
        </section>
      )}

      {view && tab === 'lineup' && mine && (
        <section>
          <h2>Quinteto y rotación de {mine.name}</h2>
          <LineupEditor
            key={revision}
            team={mine}
            busy={busy}
            onSave={(playerIds) => run({ type: 'setRotation', playerIds }, 'Guardando quinteto…')}
          />
        </section>
      )}

      {view && tab === 'competition' && (
        <section>
          <div className="bar">
            <label>
              Competición{' '}
              <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                aria-label="Competición"
              >
                {view.competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    Nivel {c.level} · {c.name} ({c.teamIds.length} equipos)
                  </option>
                ))}
              </select>
            </label>
          </div>
          {table ? (
            <CompetitionView
              key={`${table.seasonNumber}-${table.competitionId}`}
              competition={table}
              userTeamId={view.userTeamId}
              name={name}
              selectedMatchId={match?.detail.result.id ?? ''}
              onMatch={openMatch}
            />
          ) : (
            <p className="note">Todavía no se ha jugado ningún partido. Pulsa «Jugar jornada».</p>
          )}
        </section>
      )}

      {view &&
        tab === 'match' &&
        (match ? (
          <BoxScoreView
            detail={match.detail}
            playerNames={match.playerNames}
            tactics={match.tactics}
            name={name}
          />
        ) : (
          <p className="note">
            Elige un partido en la pestaña «Competición» o pulsa «Ver partido» en «Mi equipo».
          </p>
        ))}
    </main>
  );
}
