import { queryWorld } from './worldData';
import { AUTO_SAVE, IndexedDbSaveStore } from './slotStore';
/// <reference lib="webworker" />
import {
  advanceSeason,
  askingSalary,
  clubRating,
  competitionOfTeam,
  effectiveSalaryLimit,
  expectedRevenue,
  isFinanciallyRestricted,
  overdraftLimit,
  severanceCost,
  wageBudget,
  freeAgents,
  isExpired,
  isMarketOpen,
  marketProblem,
  releasePlayer,
  renewContract,
  signFreeAgent,
  teamPayroll,
  exportSave,
  generateUniverse,
  generateUniverseFromDataPack,
  parseDataPack,
  importSave,
  playerAbility,
  playerOverall,
  prepareTeam,
  replayMatch,
  setTeamRotation,
  setTeamTactics,
  setUserTeam,
  standingsOf,
} from '@bm27/core';
import type {
  DataPack,
  MatchDetail,
  MatchResult,
  Season,
  TeamTactics,
  Universe,
} from '@bm27/schema';
import type {
  Command,
  CompetitionViewData,
  FinanceView,
  GameView,
  MarketMove,
  MarketView,
  MyTeamView,
  OffseasonReport,
  Reply,
} from './protocol';

import { ReplayProofs } from './replayProof';

// The whole game state lives here, off the UI thread.
let universe: Universe | null = null;
let selectedDataPack: DataPack | null = null;
const slotStore = new IndexedDbSaveStore();
/** Universe from which the matches shown on screen can be re-simulated. */
let replayUniverse: Universe | null = null;
const replayProofs = new ReplayProofs();
/**
 * Full detail of the user team's matches. They are kept because the user can
 * change tactics or line-up afterwards, which would make a replay differ.
 */
/** What happened to the user's squad when the last season ended. */
let offseasonReport: OffseasonReport | null = null;
const myMatches = new Map<string, { detail: MatchDetail; tactics: Record<string, TeamTactics> }>();

function tablesOf(u: Universe): CompetitionViewData[] {
  if (u.currentSeason) {
    return u.currentSeason.competitions.map((c) => ({
      competitionId: c.competitionId,
      seasonNumber: u.seasonNumber,
      phase: c.phase,
      groups: standingsOf(c),
      playoffSeries: c.playoffSeries,
      matches: c.matches,
      championTeamId: null,
      promotedTeamIds: [],
      relegatedTeamIds: [],
    }));
  }
  const last: Season | undefined = u.history[u.history.length - 1];
  if (!last) return [];
  return last.competitions.map((c) => ({
    competitionId: c.competitionId,
    seasonNumber: last.seasonNumber,
    phase: 'done' as const,
    groups: c.groups,
    playoffSeries: c.playoffSeries,
    matches: c.matches,
    championTeamId: c.championTeamId,
    promotedTeamIds: c.promotedTeamIds,
    relegatedTeamIds: c.relegatedTeamIds,
  }));
}

function myTeamOf(u: Universe): MyTeamView | null {
  const team = u.teams.find((t) => t.id === u.userTeamId);
  if (!team) return null;
  const competition = u.competitions.find((c) => c.teamIds.includes(team.id));
  if (!competition) return null;
  const playersById = new Map(u.players.map((p) => [p.id, p]));
  const progress = u.currentSeason?.competitions.find((c) => c.competitionId === competition.id);
  const statsById = new Map((progress?.playerStats ?? []).map((s) => [s.playerId, s]));
  const order = prepareTeam(team, playersById).players.map((p) => p.id);

  let position: number | null = null;
  let wins = 0;
  let losses = 0;
  let nextMatch: MyTeamView['nextMatch'] = null;
  let lastMatch: MatchResult | null = null;
  if (progress) {
    for (const group of standingsOf(progress)) {
      const row = group.standings.find((r) => r.teamId === team.id);
      if (row) {
        position = row.position;
        wins = row.wins;
        losses = row.losses;
      }
    }
    const mine = (m: { homeTeamId: string; awayTeamId: string }): boolean =>
      m.homeTeamId === team.id || m.awayTeamId === team.id;
    lastMatch = [...progress.matches].reverse().find(mine) ?? null;
    if (progress.phase === 'regular') {
      const fixture = progress.fixtures
        .filter((f) => f.round >= progress.nextRound && mine(f))
        .sort((a, b) => a.round - b.round)[0];
      if (fixture) {
        const home = fixture.homeTeamId === team.id;
        nextMatch = {
          round: fixture.round,
          opponentId: home ? fixture.awayTeamId : fixture.homeTeamId,
          home,
        };
      }
    } else if (progress.phase === 'playoffs') {
      const series = progress.playoffSeries.find(
        (s) =>
          s.winnerTeamId === null && (s.highSeedTeamId === team.id || s.lowSeedTeamId === team.id),
      );
      if (series && series.lowSeedTeamId) {
        const isHigh = series.highSeedTeamId === team.id;
        const highHome = (series.matchIds.length + 1) % 2 === 1;
        nextMatch = {
          round: series.round,
          opponentId: isHigh ? series.lowSeedTeamId : series.highSeedTeamId,
          home: isHigh === highHome,
        };
      }
    }
  }

  return {
    teamId: team.id,
    name: team.name,
    competitionId: competition.id,
    competitionName: competition.name,
    level: competition.level,
    tactics: team.tactics,
    rotation: team.rotation,
    squad: order.map((id) => {
      const player = playersById.get(id)!;
      return {
        player,
        overall: playerOverall(player),
        stats: statsById.get(id) ?? null,
        contract: player.contract,
        expired: isExpired(u, player),
        renewalSalary: askingSalary(player, competition, true),
        releaseCost: isExpired(u, player) ? 0 : severanceCost(player, u.seasonNumber),
      };
    }),
    position,
    wins,
    losses,
    nextMatch,
    lastMatch,
  };
}

function marketOf(u: Universe): MarketView | null {
  const team = u.teams.find((t) => t.id === u.userTeamId);
  if (!team) return null;
  const competition = competitionOfTeam(u, team.id);
  const byId = new Map(u.players.map((p) => [p.id, p]));
  const name = (id: string): string => {
    const p = byId.get(id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };
  const roster = team.playerIds.map((id) => byId.get(id)!);
  const pool = freeAgents(u)
    .map((player) => ({ player, rating: clubRating(player) }))
    .sort((a, b) => b.rating - a.rating || (a.player.id < b.player.id ? -1 : 1));
  const moves: MarketMove[] = u.transactions
    .filter((t) => t.teamId === team.id)
    .slice(-40)
    .reverse()
    .map((t) => ({
      seasonNumber: t.seasonNumber,
      type: t.type,
      playerName: name(t.playerId),
      salary: t.salary,
      endSeason: t.endSeason,
      cost: t.cost,
    }));
  return {
    open: isMarketOpen(u),
    payroll: teamPayroll(u, team.id),
    payrollNextSeason: roster
      .filter((p) => !isExpired(u, p))
      .reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0),
    salaryLimit: effectiveSalaryLimit(team, competition),
    salaryCap: competition.salaryCap,
    wageBudget: wageBudget(team, competition),
    wageSharePercent: Math.round(100 * competition.economy.wageShare),
    minSalary: competition.minSalary,
    rosterMin: competition.rosterMin,
    rosterMax: competition.rosterMax,
    rosterSize: roster.length,
    problem: isMarketOpen(u) ? marketProblem(u) : null,
    freeAgents: pool.slice(0, 150).map(({ player }) => ({
      player,
      overall: playerOverall(player),
      askingSalary: askingSalary(player, competition),
    })),
    freeAgentCount: pool.length,
    moves,
  };
}

function financeOf(u: Universe): FinanceView | null {
  const team = u.teams.find((t) => t.id === u.userTeamId);
  if (!team) return null;
  const competition = competitionOfTeam(u, team.id);
  return {
    balance: team.finance.balance,
    overdraftLimit: overdraftLimit(team),
    restricted: isFinanciallyRestricted(team),
    reputation: team.reputation,
    typicalReputation: competition.economy.baseReputation,
    lastRevenue: team.finance.lastRevenue,
    wageBudget: wageBudget(team, competition),
    payroll: teamPayroll(u, team.id),
    fixedCosts: competition.economy.fixedCosts,
    expectedRevenue: expectedRevenue(competition, team.reputation),
    history: u.history.flatMap((s) => s.finance.filter((r) => r.teamId === team.id)).reverse(),
  };
}

function viewOf(u: Universe): GameView {
  return {
    seed: u.seed,
    seasonNumber: u.seasonNumber,
    seasonInProgress: u.currentSeason !== null,
    step: u.currentSeason?.step ?? 0,
    userTeamId: u.userTeamId,
    teamCount: u.teams.length,
    clubData: u.teams.every((team) => team.identity !== null)
      ? 'defined'
      : u.teams.some((team) => team.identity !== null)
        ? 'mixed'
        : 'generated',
    playerCount: u.players.filter((p) => !p.retired).length,
    competitions: [...u.competitions]
      .sort((a, b) => a.level - b.level)
      .map((c) => ({ id: c.id, name: c.name, level: c.level, teamIds: c.teamIds })),
    teamNames: Object.fromEntries(u.teams.map((t) => [t.id, t.name])),
    tables: tablesOf(u),
    myTeam: myTeamOf(u),
    offseason: offseasonReport,
    market: marketOf(u),
    finance: financeOf(u),
  };
}

function need(): Universe {
  if (!universe) throw new Error('Primero hay que generar un universo o cargar una partida.');
  return universe;
}

/** Plays one step, remembering the user team's matches in full. */
function step(): { season: Season | null; played: MatchResult[] } {
  const before = need();
  const userTeamId = before.userTeamId;
  // Older seasons cannot be reconstructed from this season's universe.
  if (!before.currentSeason) replayProofs.clear();
  const outcome = advanceSeason(before, {
    onMatch: (detail) => {
      const { homeTeamId, awayTeamId } = detail.result;
      if (homeTeamId !== userTeamId && awayTeamId !== userTeamId) return;
      const tactics: Record<string, TeamTactics> = {};
      for (const t of before.teams) {
        if (t.id === homeTeamId || t.id === awayTeamId) tactics[t.id] = t.tactics;
      }
      myMatches.set(detail.result.id, { detail, tactics });
    },
  });
  // After the last step the universe has aged; keep the pre-offseason one for replays.
  replayUniverse = outcome.season ? before : outcome.universe;
  for (const result of outcome.played) replayProofs.remember(replayUniverse, result);
  universe = outcome.universe;
  offseasonReport = null;
  if (outcome.season && userTeamId) {
    offseasonReport = buildOffseasonReport(
      before,
      outcome.universe,
      userTeamId,
      before.seasonNumber,
    );
  }
  return { season: outcome.season, played: outcome.played };
}

function buildOffseasonReport(
  before: Universe,
  after: Universe,
  teamId: string,
  seasonNumber: number,
): OffseasonReport {
  const team = before.teams.find((t) => t.id === teamId);
  const newTeam = after.teams.find((t) => t.id === teamId);
  const was = new Map(before.players.map((p) => [p.id, p]));
  const now = new Map(after.players.map((p) => [p.id, p]));
  const fullName = (p: { firstName: string; lastName: string }): string =>
    `${p.firstName} ${p.lastName}`;
  const rows = (team?.playerIds ?? []).flatMap((id) => {
    const a = was.get(id);
    const b = now.get(id);
    if (!a || !b) return [];
    return [
      {
        playerId: id,
        name: fullName(a),
        age: a.age,
        abilityBefore: playerAbility(a),
        abilityAfter: playerAbility(b),
        potential: b.potential,
        retired: b.retired,
      },
    ];
  });
  const arrivals = (newTeam?.playerIds ?? [])
    .filter((id) => !was.has(id) || !(team?.playerIds ?? []).includes(id))
    .flatMap((id) => {
      const p = now.get(id);
      return p
        ? [
            {
              playerId: id,
              name: fullName(p),
              age: p.age,
              ability: playerAbility(p),
              potential: p.potential,
            },
          ]
        : [];
    });
  return { seasonNumber, rows, arrivals };
}

function describeMine(played: MatchResult[], u: Universe, before: string | null): string {
  if (!before) return '';
  const mine = played.find((m) => m.homeTeamId === before || m.awayTeamId === before);
  if (!mine) return ' Tu equipo descansó.';
  const name = (id: string): string => u.teams.find((t) => t.id === id)?.name ?? id;
  const myScore = mine.homeTeamId === before ? mine.homeScore : mine.awayScore;
  const theirScore = mine.homeTeamId === before ? mine.awayScore : mine.homeScore;
  return ` Tu partido: ${name(mine.homeTeamId)} ${mine.homeScore} – ${mine.awayScore} ${name(mine.awayTeamId)} (${myScore > theirScore ? 'victoria' : 'derrota'}).`;
}

async function handle(command: Command): Promise<Reply> {
  const start = performance.now();
  const ms = (): number => Math.round(performance.now() - start);
  const state = (message: string): Extract<Reply, { type: 'state' }> => ({
    id: command.id,
    type: 'state',
    view: viewOf(need()),
    message,
  });

  const slots = async (message: string): Promise<Reply> => ({
    id: command.id,
    type: 'slots',
    slots: await slotStore.summaries(),
    autosave: await slotStore.autosaveEnabled(),
    message,
  });
  const automatic = async (): Promise<string> => {
    try {
      if (await slotStore.autosaveEnabled()) {
        await slotStore.save(AUTO_SAVE, need());
        return ' Guardado automático completado.';
      }
      return '';
    } catch (error) {
      return ` No se pudo completar el guardado automático: ${error instanceof Error ? error.message : String(error)} La partida sigue abierta; guarda una copia en archivo.`;
    }
  };
  switch (command.type) {
    case 'listSlots':
      return slots('Partidas guardadas en este dispositivo.');
    case 'saveSlot': {
      if (command.name.trim() === AUTO_SAVE)
        throw new Error('Ese nombre está reservado para el guardado automático.');
      await slotStore.save(command.name, need());
      return slots('Partida guardada en el dispositivo.');
    }
    case 'deleteSlot':
      await slotStore.delete(command.name);
      return slots('Partida eliminada.');
    case 'renameSlot':
      await slotStore.rename(command.name, command.newName);
      return slots('Nombre actualizado.');
    case 'setAutosave':
      await slotStore.setAutosave(command.enabled);
      return slots(
        command.enabled ? 'Guardado automático activado.' : 'Guardado automático desactivado.',
      );
    case 'loadSlot': {
      const loaded = await slotStore.load(command.name);
      universe = loaded;
      offseasonReport = null;
      replayUniverse = loaded;
      myMatches.clear();
      replayProofs.clear();
      return state(`Partida cargada del dispositivo: temporada ${loaded.seasonNumber}.`);
    }
    case 'setDataPack': {
      const pack = command.json === null ? null : parseDataPack(command.json);
      selectedDataPack = pack;
      return {
        id: command.id,
        type: 'dataPack',
        summary: pack
          ? {
              id: pack.id,
              name: pack.name,
              description: pack.description,
              definedClubs: pack.clubs?.length ?? 0,
              competitions: pack.config.levels.map((level) => ({
                id: level.competitionId,
                name: level.name,
                teams: level.teamCount,
              })),
            }
          : null,
        message: pack
          ? 'Paquete validado para la próxima partida.'
          : 'Datos predeterminados seleccionados para la próxima partida.',
      };
    }
    case 'generate': {
      universe = selectedDataPack
        ? generateUniverseFromDataPack(selectedDataPack, command.seed)
        : generateUniverse({ seed: command.seed });
      offseasonReport = null;
      replayUniverse = universe;
      myMatches.clear();
      replayProofs.clear();
      return state(`Partida creada · ${universe.teams.length} clubes.`);
    }
    case 'chooseTeam': {
      universe = setUserTeam(need(), command.teamId);
      const name = universe.teams.find((t) => t.id === command.teamId)?.name;
      return state(name ? `Ahora diriges a ${name}.` : 'Ya no diriges ningún equipo.');
    }
    case 'setTactics': {
      const u = need();
      if (!u.userTeamId) throw new Error('Primero elige un equipo.');
      universe = setTeamTactics(u, u.userTeamId, command.tactics);
      return state('Tácticas guardadas. Se aplican desde el próximo partido.');
    }
    case 'setRotation': {
      const u = need();
      if (!u.userTeamId) throw new Error('Primero elige un equipo.');
      universe = setTeamRotation(u, u.userTeamId, command.playerIds);
      return state(
        command.playerIds
          ? 'Quinteto y rotación guardados. Se aplican desde el próximo partido.'
          : 'El entrenador vuelve a decidir el quinteto.',
      );
    }
    case 'signFreeAgent': {
      universe = signFreeAgent(need(), command.playerId, command.years);
      const p = universe.players.find((x) => x.id === command.playerId)!;
      return state(
        `Fichado ${p.firstName} ${p.lastName} por ${command.years} ${command.years === 1 ? 'temporada' : 'temporadas'} a ${p.contract!.salary.toLocaleString('es-ES')} € al año.`,
      );
    }
    case 'renewContract': {
      universe = renewContract(need(), command.playerId, command.years);
      const p = universe.players.find((x) => x.id === command.playerId)!;
      return state(
        `Renovado ${p.firstName} ${p.lastName} hasta la temporada ${p.contract!.endSeason} a ${p.contract!.salary.toLocaleString('es-ES')} € al año.`,
      );
    }
    case 'releasePlayer': {
      const p = need().players.find((x) => x.id === command.playerId);
      universe = releasePlayer(need(), command.playerId);
      return state(`${p ? `${p.firstName} ${p.lastName}` : 'El jugador'} queda libre.`);
    }
    case 'advance': {
      offseasonReport = null;
      const userTeamId = need().userTeamId;
      const seasonNumber = need().seasonNumber;
      const { season, played } = step();
      const mine = describeMine(played, need(), userTeamId);
      const saved = season ? await automatic() : '';
      const reply = state(
        season
          ? `Temporada ${seasonNumber} terminada.${mine}${saved}`
          : `Jornada jugada: ${played.length} partidos.${mine}`,
      );
      if (command.watch && userTeamId) {
        reply.watchedMatchId = played.find((match) => myMatches.has(match.id))?.id;
      }
      return reply;
    }
    case 'finishSeason': {
      offseasonReport = null;
      const seasonNumber = need().seasonNumber;
      let matches = 0;
      for (;;) {
        const { season, played } = step();
        matches += played.length;
        if (season) break;
      }
      const saved = await automatic();
      return state(`Temporada ${seasonNumber} terminada: ${matches} partidos disputados.${saved}`);
    }
    case 'matchDetail': {
      const u = need();
      const stored = myMatches.get(command.matchId);
      const names = (detail: MatchDetail, source: Universe): Record<string, string> => {
        const ids = new Set(
          [...detail.boxScore.home.players, ...detail.boxScore.away.players].map((l) => l.playerId),
        );
        const out: Record<string, string> = {};
        for (const p of source.players) {
          if (ids.has(p.id)) out[p.id] = `${p.firstName} ${p.lastName}`;
        }
        return out;
      };
      if (stored) {
        return {
          id: command.id,
          type: 'matchDetail',
          detail: stored.detail,
          playerNames: names(stored.detail, u),
          tactics: stored.tactics,
          ms: ms(),
        };
      }
      const result = tablesOf(u)
        .flatMap((c) => c.matches)
        .find((m) => m.id === command.matchId);
      if (!result) throw new Error(`Partido ${command.matchId} no encontrado.`);
      const source = replayUniverse;
      if (
        !source ||
        source.seasonNumber !== result.seasonNumber ||
        !replayProofs.allows(source, result)
      ) {
        throw new Error(
          'El detalle de este partido no está disponible: solo se guarda el resultado y no se pueden verificar las tácticas, el quinteto y los datos originales.',
        );
      }
      // The box score is not stored: the match is re-simulated from its seed.
      const detail = replayMatch(source, result);
      if (
        detail.boxScore.home.points !== result.homeScore ||
        detail.boxScore.away.points !== result.awayScore
      ) {
        throw new Error(
          'El detalle de este partido ya no se puede reconstruir: las tácticas o el quinteto de uno de los equipos cambiaron después de jugarlo.',
        );
      }
      const tactics: Record<string, TeamTactics> = {};
      for (const t of source.teams) {
        if (t.id === result.homeTeamId || t.id === result.awayTeamId) tactics[t.id] = t.tactics;
      }
      return {
        id: command.id,
        type: 'matchDetail',
        detail,
        playerNames: names(detail, source),
        tactics,
        ms: ms(),
      };
    }
    case 'worldRecords':
    case 'worldSearch':
    case 'worldPlayer':
    case 'worldClub':
      return { id: command.id, type: 'world', result: queryWorld(need(), command) };
    case 'exportSave': {
      const u = need();
      return {
        id: command.id,
        type: 'save',
        json: exportSave(u),
        fileName: `bm27-${u.seed.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'partida'}-t${u.seasonNumber}.json`,
      };
    }
    case 'importSave': {
      universe = importSave(command.json);
      offseasonReport = null;
      replayUniverse = universe;
      myMatches.clear();
      replayProofs.clear();
      return state(
        `Partida cargada: temporada ${universe.seasonNumber}${universe.currentSeason ? ' (en curso)' : ''}.`,
      );
    }
  }
}

// Commands are serialized: saving/loading cannot race a simulation or another write.
let commands: Promise<void> = Promise.resolve();
self.onmessage = (message: MessageEvent<Command>) => {
  commands = commands.then(async () => {
    let reply: Reply;
    try {
      reply = await handle(message.data);
    } catch (error) {
      reply = {
        id: message.data.id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
    self.postMessage(reply);
  });
};
