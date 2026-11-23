import { ClubBadge } from './ClubBadge';
import { DEFAULT_PALETTE, isPaletteId, paletteVars, type PaletteId } from './palette';
import { ReplayViewer } from './ReplayViewer';
import { DataPackPanel } from './DataPackPanel';
import { WorldView } from './WorldView';
import type { WorldPayload, WorldQuery } from './worldTypes';
import { ManagerHeader } from './ManagerHeader';
import { UpdateBanner } from './UpdateBanner';
import { PortalView } from './PortalView';
import type { Tab } from './navigation';
import { SavesPanel } from './SavesPanel';
import type { SlotSummary } from './slotStore';
import type { MatchDetail, TeamTactics } from '@bm27/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompetitionView } from './CompetitionView';
import { BoxScoreView, describeTactics } from './MatchView';
import { isDesktop, pickTextFile, saveTextFile } from './platform';
import type { Command, DataPackSummary, GameView, Reply } from './protocol';
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

  return useCallback(
    (command: Pending): Promise<Reply> =>
      new Promise((resolve) => {
        const id = nextId.current++;
        waiting.current.set(id, resolve);
        workerRef.current?.postMessage({ ...command, id });
      }),
    [],
  );
}

interface ShownMatch {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  tactics: Record<string, TeamTactics>;
  broadcast?: boolean;
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
  const [palette, setPalette] = useState<PaletteId>(() => {
    try {
      const stored = localStorage.getItem('bm27-palette');
      return isPaletteId(stored) ? stored : DEFAULT_PALETTE;
    } catch {
      return DEFAULT_PALETTE;
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
    for (const [name, value] of Object.entries(paletteVars(palette, theme))) {
      root.style.setProperty(name, value);
    }
    try {
      localStorage.setItem('bm27-palette', palette);
    } catch {
      /* Settings persistence is optional. */
    }
  }, [palette, theme]);
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
  const [dataPack, setDataPack] = useState<DataPackSummary | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [tab, setTab] = useState<Tab>('portal');
  const [portalClubId, setPortalClubId] = useState<string | null>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [profileOrigin, setProfileOrigin] = useState<Tab>('portal');
  const returnPlayerFocus = useRef<string | null>(null);
  useEffect(() => {
    if (tab === 'world' || !returnPlayerFocus.current) return;
    const button = [...document.querySelectorAll<HTMLButtonElement>('[data-player-id]')].find(
      (element) => element.dataset.playerId === returnPlayerFocus.current,
    );
    button?.focus();
    returnPlayerFocus.current = null;
  }, [tab]);
  const [competitionId, setCompetitionId] = useState('');
  const [teamChoice, setTeamChoice] = useState('');
  const [match, setMatch] = useState<ShownMatch | null>(null);
  const [broadcastFinished, setBroadcastFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState<SlotSummary[] | null>(null);
  const [autosave, setAutosave] = useState(true);
  useEffect(() => {
    let active = true;
    void send({ type: 'listSlots' }).then((reply) => {
      if (active && reply.type === 'slots') {
        setSlots(reply.slots);
        setAutosave(reply.autosave);
      }
    });
    return () => {
      active = false;
    };
  }, [send]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  /** Bumped whenever the team's saved settings change, to reset the editors. */
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (command: Pending, working: string): Promise<void> => {
    setBusy(true);
    setError('');
    setStatus(working);
    const reply = await send(command);
    const watching = command.type === 'advance' && command.watch;
    const broadcast =
      watching && reply.type === 'state' && reply.watchedMatchId
        ? await send({ type: 'matchDetail', matchId: reply.watchedMatchId })
        : null;
    setBusy(false);
    switch (reply.type) {
      case 'dataPack':
        setDataPack(reply.summary);
        setStatus(reply.message);
        break;
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
        setError(reply.storageWarning ?? '');
        setStatus(reply.message);
        if (watching) {
          if (broadcast?.type === 'matchDetail') {
            setMatch({
              detail: broadcast.detail,
              playerNames: broadcast.playerNames,
              tactics: broadcast.tactics,
              broadcast: true,
            });
            setBroadcastFinished(false);
            setTab('match');
            setStatus('');
          } else {
            const notice =
              broadcast?.type === 'error'
                ? `No se pudo abrir la retransmisión. ${broadcast.message}`
                : 'Tu equipo no juega en este turno.';
            setMatch(null);
            setStatus(`${reply.message} ${notice}`);
            setTab('portal');
          }
        }
        if (command.type === 'advance' && !watching && match?.broadcast) {
          setMatch(null);
          if (tab === 'match') setTab('portal');
        }
        setRevision((n) => n + 1);
        const mine = reply.view.myTeam;
        if (
          command.type === 'generate' ||
          command.type === 'importSave' ||
          command.type === 'loadSlot'
        ) {
          setMatch(null);
          setPortalClubId(null);
          setProfilePlayerId(null);
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

  const requestWorld = useCallback(
    async (query: WorldQuery): Promise<WorldPayload> => {
      const reply = await send(query);
      if (reply.type === 'world') return reply.result;
      if (reply.type === 'error') throw new Error(reply.message);
      throw new Error('No se pudo completar la consulta.');
    },
    [send],
  );

  const navigate = (next: Tab): void => {
    setPortalClubId(null);
    setProfilePlayerId(null);
    setTab(next);
    if (next === 'saves') void run({ type: 'listSlots' }, 'Abriendo partidas…');
  };

  const name = (teamId: string): string => view?.teamNames[teamId] ?? teamId;
  const table = view?.tables.find((c) => c.competitionId === competitionId);
  const mine = view?.myTeam ?? null;
  const openMatch = (matchId: string): Promise<void> =>
    run({ type: 'matchDetail', matchId }, 'Abriendo partido…');

  const openPlayer = (playerId: string): void => {
    returnPlayerFocus.current = playerId;
    setProfileOrigin(tab);
    setPortalClubId(null);
    setProfilePlayerId(playerId);
    setTab('world');
  };
  const watchMatch = () =>
    void run({ type: 'advance', watch: true }, 'Preparando la retransmisión…');
  const revealReport = useCallback(() => setBroadcastFinished(true), []);
  const watchingMatch = tab === 'match' && match?.broadcast && !broadcastFinished;

  const newGameButton = (
    <button
      className="new-career"
      disabled={busy}
      onClick={() => {
        if (
          !view ||
          window.confirm('¿Sustituir la partida abierta? Se perderán los cambios sin guardar.')
        )
          void run({ type: 'generate', seed }, 'Preparando temporada…');
      }}
    >
      Nueva partida
    </button>
  );
  const loadGameButton = (
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
  );
  return (
    <main className="app-shell">
      <ManagerHeader
        view={view}
        active={tab}
        busy={busy}
        theme={theme}
        palette={palette}
        onPalette={setPalette}
        compact={compact}
        onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onCompact={setCompact}
        onNavigate={navigate}
        onWatch={watchMatch}
        onAdvance={() => {
          void run({ type: 'advance' }, 'Jugando jornada…');
        }}
      />
      <div className="workspace-content" id="workspace">
        <UpdateBanner />
        {!view && tab !== 'saves' && (
          <section className="welcome">
            <div>
              <h1>
                Basketball Manager <span>2027</span>
              </h1>
              {slots?.[0] && (
                <div className="continue-career">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run({ type: 'loadSlot', name: slots[0]!.name }, 'Continuando partida…')
                    }
                  >
                    Continuar
                  </button>
                  <p>
                    {slots[0].team} · Temporada {slots[0].season}
                  </p>
                </div>
              )}
              <div className="career-menu">
                {newGameButton}
                {loadGameButton}
                <button disabled={busy} onClick={() => navigate('saves')}>
                  Mis partidas
                </button>
              </div>
            </div>
            <div className="welcome-court" aria-hidden="true">
              <i />
              <i />
            </div>
          </section>
        )}
        {view && tab !== 'portal' && tab !== 'world' && !watchingMatch && (
          <section className="club-ribbon" aria-label="Resumen de la partida">
            {mine ? (
              <ClubBadge teamId={mine.teamId} name={mine.name} size="md" />
            ) : (
              <div className="club-monogram" aria-hidden="true">
                BM
              </div>
            )}
            <div className="club-ribbon-title">
              <h1>{mine?.name ?? 'Elige tu próximo club'}</h1>
              <p>{mine?.competitionName ?? 'Sin club'}</p>
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
        <div className={`workspace-actions ${view ? 'playing' : ''}`}>
          <details className="game-tools" hidden={!view && tab === 'saves'}>
            <summary>{view ? 'Opciones de partida' : 'Configurar nueva partida'}</summary>
            {view && (
              <p className="data-note">
                {view.clubData === 'defined'
                  ? 'Clubes definidos por un paquete y jugadores generados.'
                  : view.clubData === 'mixed'
                    ? 'Plantillas generadas · Clubes del paquete y de la partida.'
                    : 'Plantillas de la partida · clubes y jugadores generados.'}
              </p>
            )}
            <DataPackPanel
              selected={dataPack}
              busy={busy}
              onSelect={(json) => run({ type: 'setDataPack', json }, 'Validando paquete…')}
            />
            <div className="bar command-bar">
              <label>
                Semilla{' '}
                <input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  aria-label="Semilla"
                />
              </label>
              {view && newGameButton}
              {view && (
                <button disabled={busy} onClick={() => run({ type: 'exportSave' }, 'Guardando…')}>
                  Guardar partida
                </button>
              )}
              {view && loadGameButton}
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

          {view && (
            <details className="team-management" open={!mine}>
              <summary>{mine ? 'Dirección deportiva' : 'Elegir club'}</summary>
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

          {view && (
            <button
              disabled={busy}
              onClick={() => {
                setTab('saves');
                void run({ type: 'listSlots' }, 'Abriendo partidas…');
              }}
            >
              Partidas de este dispositivo
            </button>
          )}
          <p className="status-line" role="status" aria-live="polite" data-testid="status">
            {status}
          </p>
        </div>
        {error && (
          <p className="error" role="alert">
            Error: {error}
          </p>
        )}

        {view && !watchingMatch && (
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
            onClub={(id) => {
              setPortalClubId(id);
              setProfilePlayerId(null);
              setProfileOrigin('portal');
              setTab('world');
            }}
            busy={busy}
          />
        )}
        {view && tab === 'world' && (
          <WorldView
            key={JSON.stringify([revision, portalClubId, profilePlayerId])}
            view={view}
            request={requestWorld}
            initialClubId={portalClubId}
            initialPlayerId={profilePlayerId}
            backLabel={
              profileOrigin === 'market'
                ? 'Volver al Mercado'
                : profileOrigin === 'team'
                  ? 'Volver a Mi equipo'
                  : 'Volver al Portal'
            }
            onBackToPortal={() => navigate(profileOrigin)}
          />
        )}
        {!view && tab === 'saves' && (
          <button onClick={() => setTab('portal')}>← Menú principal</button>
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
                <>Pretemporada. </>
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
            <SquadTable squad={mine.squad} onPlayer={openPlayer} />
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

            <button type="button" disabled={busy} onClick={watchMatch}>
              Jugar y ver
            </button>
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
              onPlayer={openPlayer}
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
              <p className="note">Temporada sin estrenar.</p>
            )}
          </section>
        )}

        {view &&
          tab === 'match' &&
          (match ? (
            <>
              <ReplayViewer
                key={`${match.detail.result.id}/${match.broadcast ?? false}`}
                detail={match.detail}
                playerNames={match.playerNames}
                name={name}
                managedTeamId={view.userTeamId}
                broadcast={match.broadcast}
                onFinish={match.broadcast ? revealReport : undefined}
                instructions={
                  match.broadcast && view.userTeamId
                    ? describeTactics(match.tactics[view.userTeamId])
                    : undefined
                }
              />
              {!watchingMatch && (
                <BoxScoreView
                  detail={match.detail}
                  playerNames={match.playerNames}
                  tactics={match.tactics}
                  name={name}
                />
              )}
            </>
          ) : (
            <p className="note">
              <button onClick={() => navigate('competition')}>Ver calendario y resultados</button>
            </p>
          ))}
      </div>
    </main>
  );
}
