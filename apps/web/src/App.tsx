import { ManagerHeader } from './ManagerHeader';
import { PortalView } from './PortalView';
import type { Tab } from './navigation';
import { SavesPanel } from './SavesPanel';
import type { SlotSummary } from './slotStore';
import type { MatchDetail, TeamTactics } from '@bm27/schema';
import { useEffect, useRef, useState } from 'react';
import { CompetitionView } from './CompetitionView';
import { BoxScoreView } from './MatchView';
import { isDesktop, pickTextFile, saveTextFile } from './platform';
import type { Command, GameView, Reply } from './protocol';
import { FinancePanel } from './FinanceView';
import { MarketPanel } from './MarketView';
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

interface ShownMatch {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  tactics: Record<string, TeamTactics>;
}

export function App() {
  const send = useSimulation();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('bm27-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('bm27-theme', theme);
    } catch {
      /* Settings persistence is optional. */
    }
  }, [theme]);
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem('bm27-compact') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
    try {
      localStorage.setItem('bm27-compact', String(compact));
    } catch {
      /* Optional preference. */
    }
  }, [compact]);
  const [seed, setSeed] = useState('bm27');
  const [view, setView] = useState<GameView | null>(null);
  const [tab, setTab] = useState<Tab>('portal');
  const [competitionId, setCompetitionId] = useState('');
  const [teamChoice, setTeamChoice] = useState('');
  const [match, setMatch] = useState<ShownMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState<SlotSummary[] | null>(null);
  const [autosave, setAutosave] = useState(true);
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
      case 'slots':
        setSlots(reply.slots);
        setAutosave(reply.autosave);
        setStatus(reply.message);
        break;
      case 'error':
        setError(reply.message);
        setStatus('');
        break;
      case 'state': {
        setView(reply.view);
        setStatus(reply.message);
        setRevision((n) => n + 1);
        const mine = reply.view.myTeam;
        if (
          command.type === 'generate' ||
          command.type === 'importSave' ||
          command.type === 'loadSlot'
        ) {
          setMatch(null);
          setCompetitionId(mine?.competitionId ?? reply.view.competitions[0]?.id ?? '');
          setTeamChoice(reply.view.userTeamId ?? reply.view.competitions[0]?.teamIds[0] ?? '');
          setTab('portal');
        }
        if (command.type === 'chooseTeam' && mine) {
          setCompetitionId(mine.competitionId);
          setTab('portal');
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
        const size = `${(reply.json.length / 1024 / 1024).toFixed(1)} MB`;
        try {
          const result = await saveTextFile(reply.fileName, reply.json);
          setStatus(
            result.kind === 'saved'
              ? `Partida guardada en ${result.where} (${size}).`
              : 'Guardado cancelado.',
          );
        } catch (error) {
          setError(
            `No se pudo guardar el archivo: ${error instanceof Error ? error.message : String(error)}`,
          );
          setStatus('');
        }
        break;
      }
    }
  };

  const navigate = (next: Tab): void => {
    setTab(next);
    if (next === 'saves') void run({ type: 'listSlots' }, 'Abriendo partidas…');
  };

  const name = (teamId: string): string => view?.teamNames[teamId] ?? teamId;
  const table = view?.tables.find((c) => c.competitionId === competitionId);
  const mine = view?.myTeam ?? null;
  const openMatch = (matchId: string): Promise<void> =>
    run({ type: 'matchDetail', matchId }, 'Abriendo partido…');

  return (
    <main className="app-shell">
      <ManagerHeader
        view={view}
        active={tab}
        busy={busy}
        theme={theme}
        compact={compact}
        onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onCompact={setCompact}
        onNavigate={navigate}
        onAdvance={() => {
          void run({ type: 'advance' }, 'Jugando jornada…');
        }}
      />
      <div className="workspace-content" id="workspace">
        {!view && (
          <section className="welcome">
            <div>
              <span className="eyebrow">Tu próximo proyecto deportivo</span>
              <h1>El club empieza por tus decisiones.</h1>
              <p>
                Prepara tu quinteto, encuentra refuerzos y avanza una temporada en la que cada
                partido deja huella.
              </p>
              <ol className="welcome-steps">
                <li>Genera una partida o recupera un guardado del dispositivo.</li>
                <li>Elige un equipo y ajusta su quinteto y sus tácticas.</li>
                <li>Juega jornadas, consulta resultados y construye tu plantilla.</li>
              </ol>
            </div>
            <div className="welcome-court" aria-hidden="true" />
          </section>
        )}
        <p className="data-note">
          Base de demostración: clubes y jugadores generados. El objetivo es representar el
          baloncesto español con datos contrastados; estas plantillas aún no son las oficiales.
        </p>
        <div className={`workspace-actions ${view ? 'playing' : ''}`}>
          <details className="game-tools" open={!view}>
            <summary>Gestión de partida · crear, importar y exportar</summary>
            <div className="bar command-bar">
              <label>
                Semilla{' '}
                <input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  aria-label="Semilla"
                />
              </label>
              <button disabled={busy} onClick={() => run({ type: 'generate', seed }, 'Generando…')}>
                Generar universo
              </button>
              <button
                disabled={busy || !view}
                onClick={() => run({ type: 'exportSave' }, 'Guardando…')}
              >
                Guardar partida
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (!isDesktop()) {
                    fileInput.current?.click();
                    return;
                  }
                  try {
                    const json = await pickTextFile();
                    if (json !== null) await run({ type: 'importSave', json }, 'Cargando…');
                  } catch (error) {
                    setError(
                      `No se pudo abrir el archivo: ${error instanceof Error ? error.message : String(error)}`,
                    );
                  }
                }}
              >
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
          </details>

          {view && tab !== 'portal' && (
            <section className="club-ribbon" aria-label="Resumen de la partida">
              <div className="club-monogram" aria-hidden="true">
                {mine?.name
                  .split(' ')
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('') ?? 'BM'}
              </div>
              <div className="club-ribbon-title">
                <span className="eyebrow">Tu centro de gestión</span>
                <h1>{mine?.name ?? 'Elige tu próximo club'}</h1>
                <p>{mine?.competitionName ?? 'España · Base de demostración'}</p>
              </div>
              <div className="ribbon-stat">
                <span>Temporada</span>
                <strong>{view.seasonNumber}</strong>
              </div>
              <div className="ribbon-stat">
                <span>Balance deportivo</span>
                <strong>{mine ? `${mine.wins} V · ${mine.losses} D` : 'Sin equipo'}</strong>
              </div>
              <div className="ribbon-stat">
                <span>Mundo de la partida</span>
                <strong>{view.teamCount} clubes</strong>
                <small>{view.playerCount} jugadores</small>
              </div>
            </section>
          )}
          {view && (
            <details className="team-management" open={!mine}>
              <summary>Cambiar de club · simular temporada</summary>
              <div className="bar team-toolbar">
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
                  onClick={() =>
                    run({ type: 'chooseTeam', teamId: teamChoice }, 'Cambiando de equipo…')
                  }
                >
                  Dirigir este equipo
                </button>
                <button
                  disabled={busy}
                  onClick={() => run({ type: 'finishSeason' }, 'Simulando hasta el final…')}
                >
                  Simular hasta el final de la temporada
                </button>
              </div>
            </details>
          )}

          <button
            disabled={busy}
            onClick={() => {
              setTab('saves');
              void run({ type: 'listSlots' }, 'Abriendo partidas…');
            }}
          >
            Partidas de este dispositivo
          </button>
          <p className="status-line" role="status" aria-live="polite" data-testid="status">
            {status}
          </p>
        </div>
        {error && (
          <p className="error" role="alert">
            Error: {error}
          </p>
        )}

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
          </>
        )}

        {view && tab === 'portal' && (
          <PortalView
            view={view}
            competitionId={competitionId}
            onCompetition={setCompetitionId}
            onNavigate={navigate}
            onMatch={openMatch}
            busy={busy}
          />
        )}
        {tab === 'saves' && (
          <SavesPanel
            slots={slots}
            busy={busy}
            canSave={view !== null}
            autosave={autosave}
            onRefresh={() => {
              void run({ type: 'listSlots' }, 'Actualizando partidas…');
            }}
            onSave={(name) => {
              if (
                !slots?.some((s) => s.name === name.trim()) ||
                window.confirm(
                  'Ya existe ese guardado. ¿Quieres sobrescribirlo con la partida abierta?',
                )
              )
                void run({ type: 'saveSlot', name }, 'Guardando en este dispositivo…');
            }}
            onLoad={(name) => {
              if (
                !view ||
                window.confirm(
                  'Cargar sustituirá la partida abierta. Guarda antes los cambios que quieras conservar. ¿Continuar?',
                )
              )
                void run({ type: 'loadSlot', name }, 'Cargando del dispositivo…');
            }}
            onDelete={(name) => {
              if (
                window.confirm(
                  '¿Eliminar este guardado del dispositivo? Los archivos exportados no se modifican.',
                )
              )
                void run({ type: 'deleteSlot', name }, 'Eliminando guardado…');
            }}
            onRename={(name, newName) => {
              void run({ type: 'renameSlot', name, newName }, 'Renombrando…');
            }}
            onAutosave={(enabled) => {
              void run({ type: 'setAutosave', enabled }, 'Actualizando preferencia…');
            }}
          />
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

        {view && tab === 'market' && mine && view.market && (
          <section>
            <h2>Mercado de {mine.name}</h2>
            <MarketPanel
              team={mine}
              market={view.market}
              seasonNumber={view.seasonNumber}
              busy={busy}
              onSign={(playerId, years) =>
                run({ type: 'signFreeAgent', playerId, years }, 'Fichando…')
              }
              onRenew={(playerId, years) =>
                run({ type: 'renewContract', playerId, years }, 'Renovando…')
              }
              onRelease={(playerId) => run({ type: 'releasePlayer', playerId }, 'Liberando…')}
            />
          </section>
        )}

        {view && tab === 'finance' && mine && view.finance && (
          <section>
            <h2>Finanzas de {mine.name}</h2>
            <FinancePanel finance={view.finance} seasonNumber={view.seasonNumber} />
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
      </div>
    </main>
  );
}
