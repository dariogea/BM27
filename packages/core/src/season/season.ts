import type {
  BoxScore,
  Competition,
  CompetitionProgress,
  CompetitionSeason,
  Fixture,
  GroupSeason,
  MatchDetail,
  MatchEvent,
  MatchResult,
  Player,
  Ruleset,
  Season,
  SeasonProgress,
  StandingRow,
  Team,
  Universe,
} from '@bm27/schema';
import { closeMarket } from '../market/market';
import { createRng } from '../rng';
import {
  addStatLine,
  beginHalftimeMatch,
  emptyStatLine,
  playMatch,
  prepareTeam,
  summarizeMatch,
  type HalftimeChanges,
  type HalftimeSettings,
  type PlayedMatch,
  type PreparedTeam,
} from '../match';
import { applyOffseason } from './offseason';
import { bestOfForRound, bracketOrder, bracketSize } from './playoffs';
import { buildRoundRobin } from './schedule';
import { computeStandings } from './standings';

/** Seed of a single match. Independent of simulation order. */
export function matchSeed(universeSeed: string, matchId: string): string {
  return `${universeSeed}/match/${matchId}`;
}

interface SeasonContext {
  universe: Universe;
  seasonNumber: number;
  teamsById: Map<string, Team>;
  playersById: Map<string, Player>;
  prepared: Map<string, PreparedTeam>;
  /** Injuries that happened in the matches played by the current step. */
  injuries: { playerId: string; gamesOut: number }[];
  /** Teams that played a match in the current step (their injured players recover a game). */
  playedTeams: Set<string>;
}

/** Contexts are cached per universe so stepping through a season stays cheap. */
const contextCache = new WeakMap<Universe['teams'], SeasonContext>();

function makeContext(universe: Universe): SeasonContext {
  const cached = contextCache.get(universe.teams);
  if (cached && cached.universe.seed === universe.seed) {
    if (cached.universe.players === universe.players) {
      cached.universe = universe;
      cached.seasonNumber = universe.seasonNumber;
      return cached;
    }
    // Only some players changed (injuries from the last matchday): keep the prepared squads of
    // every team that has none of them, which avoids rebuilding the whole league each matchday.
    if (cached.universe.players.length === universe.players.length) {
      const playersById = new Map(universe.players.map((p) => [p.id, p]));
      const dirty = new Set<string>();
      for (const p of universe.players) {
        const before = cached.playersById.get(p.id);
        if (before === p) continue;
        if (before?.teamId) dirty.add(before.teamId);
        if (p.teamId) dirty.add(p.teamId);
      }
      const context: SeasonContext = {
        ...cached,
        universe,
        seasonNumber: universe.seasonNumber,
        playersById,
        prepared: new Map([...cached.prepared].filter(([teamId]) => !dirty.has(teamId))),
      };
      contextCache.set(universe.teams, context);
      return context;
    }
  }
  const context = buildContext(universe);
  contextCache.set(universe.teams, context);
  return context;
}

function buildContext(universe: Universe): SeasonContext {
  const teamsById = new Map(universe.teams.map((t) => [t.id, t]));
  const playersById = new Map(universe.players.map((p) => [p.id, p]));
  return {
    universe,
    seasonNumber: universe.seasonNumber,
    teamsById,
    playersById,
    prepared: new Map(),
    injuries: [],
    playedTeams: new Set(),
  };
}

/**
 * Recovers one game for every injured player whose team played, then applies the new injuries.
 * Returns the same array when nothing changes, so cached contexts stay valid.
 */
function applyInjuries(
  players: readonly Player[],
  playedTeams: ReadonlySet<string>,
  injuries: readonly { playerId: string; gamesOut: number }[],
): readonly Player[] {
  const fresh = new Map<string, number>();
  for (const injury of injuries) {
    fresh.set(injury.playerId, Math.max(fresh.get(injury.playerId) ?? 0, injury.gamesOut));
  }
  let changed = false;
  const result = players.map((player) => {
    let injury = player.injury;
    if (injury && player.teamId !== null && playedTeams.has(player.teamId)) {
      injury = injury.gamesRemaining > 1 ? { gamesRemaining: injury.gamesRemaining - 1 } : null;
    }
    const gamesOut = fresh.get(player.id);
    if (gamesOut !== undefined) injury = { gamesRemaining: gamesOut };
    if (injury === player.injury) return player;
    changed = true;
    return { ...player, injury };
  });
  return changed ? result : players;
}

function preparedTeam(ctx: SeasonContext, teamId: string): PreparedTeam {
  let team = ctx.prepared.get(teamId);
  if (!team) {
    const data = ctx.teamsById.get(teamId);
    if (!data) throw new Error(`Unknown team ${teamId}`);
    team = prepareTeam(data, ctx.playersById);
    ctx.prepared.set(teamId, team);
  }
  return team;
}

function rulesetOf(universe: Universe, competition: Competition): Ruleset {
  const ruleset = universe.rulesets.find((r) => r.id === competition.rulesetId);
  if (!ruleset) throw new Error(`Competition ${competition.id}: unknown ruleset`);
  return ruleset;
}

/**
 * Splits the teams of a competition into groups of (almost) equal size,
 * following the geographic order of regions so groups are regional.
 */
export function assignGroups(
  universe: Universe,
  competition: Competition,
  teamsById: ReadonlyMap<string, Team>,
): { name: string; teamIds: string[] }[] {
  const groupCount = competition.format.groupCount;
  if (groupCount === 1) return [{ name: 'Liga', teamIds: [...competition.teamIds].sort() }];

  const regionIndex = new Map(universe.regions.map((r, i) => [r, i]));
  const sorted = [...competition.teamIds].sort((a, b) => {
    const ra = regionIndex.get((teamsById.get(a) as Team).region) ?? universe.regions.length;
    const rb = regionIndex.get((teamsById.get(b) as Team).region) ?? universe.regions.length;
    return ra - rb || (a < b ? -1 : a > b ? 1 : 0);
  });
  const groups: { name: string; teamIds: string[] }[] = [];
  const baseSize = Math.floor(sorted.length / groupCount);
  const extra = sorted.length % groupCount;
  let cursor = 0;
  for (let g = 0; g < groupCount; g++) {
    const size = baseSize + (g < extra ? 1 : 0);
    groups.push({
      name: `Grupo ${String.fromCharCode(65 + (g % 26))}${g >= 26 ? Math.floor(g / 26) : ''}`,
      teamIds: sorted.slice(cursor, cursor + size),
    });
    cursor += size;
  }
  return groups;
}

interface Ranked {
  teamId: string;
  row: StandingRow;
}

/** Order used to compare teams from different groups. */
function compareAcrossGroups(a: Ranked, b: Ranked): number {
  if (a.row.position !== b.row.position) return a.row.position - b.row.position;
  const winPctA = a.row.played ? a.row.wins / a.row.played : 0;
  const winPctB = b.row.played ? b.row.wins / b.row.played : 0;
  if (winPctA !== winPctB) return winPctB - winPctA;
  const diffA = a.row.played ? (a.row.pointsFor - a.row.pointsAgainst) / a.row.played : 0;
  const diffB = b.row.played ? (b.row.pointsFor - b.row.pointsAgainst) / b.row.played : 0;
  if (diffA !== diffB) return diffB - diffA;
  return a.teamId < b.teamId ? -1 : 1;
}

export interface CompetitionSeasonOptions {
  /** Called with the full detail (box score + events) of every match. */
  onMatch?: (detail: MatchDetail) => void;
}

// ---------------------------------------------------------------------------
// One competition, step by step
// ---------------------------------------------------------------------------

function createProgress(ctx: SeasonContext, competition: Competition): CompetitionProgress {
  const prefix = `s${ctx.seasonNumber}-${competition.id}`;
  const groups = assignGroups(ctx.universe, competition, ctx.teamsById);
  const fixtures: Fixture[] = [];
  let counter = 0;
  let totalRounds = 0;
  groups.forEach((group, groupIndex) => {
    for (const f of buildRoundRobin(group.teamIds, competition.format.roundRobinLegs)) {
      counter++;
      fixtures.push({
        id: `${prefix}-r${String(counter).padStart(4, '0')}`,
        round: f.round,
        group: groupIndex,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
      });
      if (f.round > totalRounds) totalRounds = f.round;
    }
  });
  return {
    competitionId: competition.id,
    phase: 'regular',
    groups,
    fixtures,
    nextRound: 1,
    totalRounds,
    matches: [],
    playoffSeeds: [],
    playoffRound: 0,
    playoffAlive: [],
    playoffEliminated: [],
    playoffSeries: [],
    playerStats: [],
  };
}

/** League tables of a competition with the matches played so far. */
export function standingsOf(progress: CompetitionProgress): GroupSeason[] {
  const regular = progress.matches.filter((m) => m.stage === 'regular');
  return progress.groups.map((group) => ({
    name: group.name,
    teamIds: group.teamIds,
    standings: computeStandings(group.teamIds, regular),
  }));
}

function rankAcrossGroups(groups: readonly GroupSeason[]): Ranked[] {
  return groups
    .flatMap((g) => g.standings.map((row) => ({ teamId: row.teamId, row })))
    .sort(compareAcrossGroups);
}

/** Creates the series of the current playoff round from the bracket slots. */
function openPlayoffRound(competition: Competition, work: CompetitionProgress): void {
  const playoffs = competition.format.playoffs;
  if (!playoffs) return;
  const seedOf = new Map(work.playoffSeeds.map((teamId, i) => [teamId, i + 1]));
  const bestOf = bestOfForRound(playoffs.seriesBestOf, work.playoffRound - 1);
  for (let i = 0; i < work.playoffAlive.length; i += 2) {
    const a = work.playoffAlive[i] ?? null;
    const b = work.playoffAlive[i + 1] ?? null;
    if (a === null && b === null) continue;
    if (a === null || b === null) {
      const through = (a ?? b) as string;
      work.playoffSeries.push({
        round: work.playoffRound,
        bestOf,
        highSeed: seedOf.get(through) as number,
        highSeedTeamId: through,
        lowSeedTeamId: null,
        highSeedWins: 0,
        lowSeedWins: 0,
        winnerTeamId: through, // bye
        matchIds: [],
      });
      continue;
    }
    const aIsHigh = (seedOf.get(a) as number) < (seedOf.get(b) as number);
    const high = aIsHigh ? a : b;
    work.playoffSeries.push({
      round: work.playoffRound,
      bestOf,
      highSeed: seedOf.get(high) as number,
      highSeedTeamId: high,
      lowSeedTeamId: aIsHigh ? b : a,
      highSeedWins: 0,
      lowSeedWins: 0,
      winnerTeamId: null,
      matchIds: [],
    });
  }
}

/** Closes every finished playoff round and opens the next one. */
function settlePlayoffs(competition: Competition, work: CompetitionProgress): void {
  while (work.phase === 'playoffs') {
    const current = work.playoffSeries.filter((s) => s.round === work.playoffRound);
    if (current.some((s) => s.winnerTeamId === null)) return;
    const seedOf = new Map(work.playoffSeeds.map((teamId, i) => [teamId, i + 1]));
    const winners: (string | null)[] = [];
    const eliminated: string[] = [];
    for (let i = 0; i < work.playoffAlive.length; i += 2) {
      const a = work.playoffAlive[i] ?? null;
      const b = work.playoffAlive[i + 1] ?? null;
      const series = current.find((s) => s.highSeedTeamId === a || s.highSeedTeamId === b);
      winners.push(series ? series.winnerTeamId : null);
      if (series && series.lowSeedTeamId !== null) {
        eliminated.push(
          series.winnerTeamId === series.highSeedTeamId
            ? series.lowSeedTeamId
            : series.highSeedTeamId,
        );
      }
    }
    eliminated.sort((x, y) => (seedOf.get(x) as number) - (seedOf.get(y) as number));
    work.playoffEliminated = [...work.playoffEliminated, eliminated];
    work.playoffAlive = winners;
    if (winners.length <= 1) {
      work.phase = 'done';
      return;
    }
    work.playoffRound++;
    openPlayoffRound(competition, work);
  }
}

function playoffFixtures(progress: CompetitionProgress, prefix: string) {
  return progress.playoffSeries
    .filter((series) => series.round === progress.playoffRound)
    .flatMap((series, index) => {
      if (series.winnerTeamId !== null || series.lowSeedTeamId === null) return [];
      const game = series.matchIds.length + 1;
      const highHome = game % 2 === 1;
      return [
        {
          series,
          highHome,
          id: `${prefix}-p${series.round}-${index + 1}-${game}`,
          homeTeamId: highHome ? series.highSeedTeamId : series.lowSeedTeamId,
          awayTeamId: highHome ? series.lowSeedTeamId : series.highSeedTeamId,
        },
      ];
    });
}

/** Plays the next regular-season matchday or game of each active playoff series. */
function stepCompetition(
  ctx: SeasonContext,
  competition: Competition,
  progress: CompetitionProgress,
  options: CompetitionSeasonOptions,
  played: MatchResult[],
  staged?: { id: string; match: PlayedMatch },
): CompetitionProgress {
  if (progress.phase === 'done') return progress;
  const { universe, seasonNumber } = ctx;
  const ruleset = rulesetOf(universe, competition);
  const work: CompetitionProgress = {
    ...progress,
    matches: progress.matches.slice(),
    playoffSeries: progress.playoffSeries.map((s) => ({ ...s, matchIds: s.matchIds.slice() })),
  };
  const stats = new Map(progress.playerStats.map((s) => [s.playerId, s]));
  const touched = new Set<string>();

  const play = (
    id: string,
    stage: MatchResult['stage'],
    round: number,
    homeTeamId: string,
    awayTeamId: string,
  ): MatchResult => {
    const match =
      staged?.id === id
        ? staged.match
        : playMatch(
            preparedTeam(ctx, homeTeamId),
            preparedTeam(ctx, awayTeamId),
            ruleset,
            matchSeed(universe.seed, id),
          );
    const result: MatchResult = {
      id,
      seasonNumber,
      competitionId: competition.id,
      stage,
      round,
      homeTeamId,
      awayTeamId,
      homeScore: match.boxScore.home.points,
      awayScore: match.boxScore.away.points,
      overtimePeriods: match.overtimePeriods,
    };
    work.matches.push(result);
    played.push(result);
    ctx.playedTeams.add(homeTeamId);
    ctx.playedTeams.add(awayTeamId);
    for (const event of match.events) {
      if (event.type === 'injury') {
        ctx.injuries.push({ playerId: event.playerId, gamesOut: event.gamesOut });
      }
    }
    for (const side of [match.boxScore.home, match.boxScore.away]) {
      for (const line of side.players) {
        if (line.seconds === 0) continue;
        let entry = stats.get(line.playerId);
        if (!entry) {
          entry = { playerId: line.playerId, teamId: side.teamId, games: 0, ...emptyStatLine() };
          stats.set(line.playerId, entry);
          touched.add(line.playerId);
        } else if (!touched.has(line.playerId)) {
          entry = { ...entry }; // never modify the previous step's objects
          stats.set(line.playerId, entry);
          touched.add(line.playerId);
        }
        entry.games++;
        addStatLine(entry, line);
      }
    }
    options.onMatch?.({ result, boxScore: match.boxScore, events: match.events });
    return result;
  };

  if (work.phase === 'regular') {
    for (const f of work.fixtures) {
      if (f.round === work.nextRound) play(f.id, 'regular', f.round, f.homeTeamId, f.awayTeamId);
    }
    work.nextRound++;
    if (work.nextRound > work.totalRounds) {
      const playoffs = competition.format.playoffs;
      if (!playoffs) {
        work.phase = 'done';
      } else {
        const seeds = rankAcrossGroups(standingsOf(work))
          .filter((r) => r.row.position <= playoffs.qualifiersPerGroup)
          .map((r) => r.teamId);
        work.playoffSeeds = seeds;
        work.playoffAlive = bracketOrder(bracketSize(seeds.length)).map(
          (seed) => seeds[seed - 1] ?? null,
        );
        work.playoffRound = 1;
        work.phase = 'playoffs';
        openPlayoffRound(competition, work);
        settlePlayoffs(competition, work);
      }
    }
  } else {
    const prefix = `s${seasonNumber}-${competition.id}`;
    for (const { series, highHome, id, homeTeamId, awayTeamId } of playoffFixtures(work, prefix)) {
      const result = play(id, 'playoff', series.round, homeTeamId, awayTeamId);
      const homeWon = result.homeScore > result.awayScore;
      if (homeWon === highHome) series.highSeedWins++;
      else series.lowSeedWins++;
      series.matchIds.push(id);
      const needed = Math.floor(series.bestOf / 2) + 1;
      if (series.highSeedWins >= needed) series.winnerTeamId = series.highSeedTeamId;
      else if (series.lowSeedWins >= needed) series.winnerTeamId = series.lowSeedTeamId;
    }
    settlePlayoffs(competition, work);
  }

  work.playerStats = [...stats.values()];
  return work;
}

/** Turns a finished competition into its permanent season record. */
function finalizeCompetition(
  competition: Competition,
  progress: CompetitionProgress,
): CompetitionSeason {
  if (progress.phase !== 'done') {
    throw new Error(`Competition ${competition.id} has not finished yet`);
  }
  const groups = standingsOf(progress);
  const ranked = rankAcrossGroups(groups);
  const playoffOrder: string[] = [];
  if (progress.playoffSeeds.length > 0) {
    const champion = progress.playoffAlive[0];
    if (champion) playoffOrder.push(champion);
    for (let r = progress.playoffEliminated.length - 1; r >= 0; r--) {
      playoffOrder.push(...(progress.playoffEliminated[r] as string[]));
    }
  }
  const inPlayoffs = new Set(playoffOrder);
  const finalRanking = [
    ...playoffOrder,
    ...ranked.filter((r) => !inPlayoffs.has(r.teamId)).map((r) => r.teamId),
  ];
  return {
    competitionId: competition.id,
    groups,
    matches: progress.matches,
    playoffSeries: progress.playoffSeries.map((s) => ({
      ...s,
      winnerTeamId: s.winnerTeamId as string,
    })),
    finalRanking,
    championTeamId: finalRanking[0] as string,
    promotedTeamIds: finalRanking.slice(0, competition.promotionSlots),
    relegatedTeamIds:
      competition.relegationSlots > 0 ? finalRanking.slice(-competition.relegationSlots) : [],
    playerStats: progress.playerStats,
  };
}

/** Simulates one whole competition of the universe's current season (no offseason). */
export function simulateCompetitionSeason(
  universe: Universe,
  competitionId: string,
  options: CompetitionSeasonOptions = {},
): CompetitionSeason {
  const competition = universe.competitions.find((c) => c.id === competitionId);
  if (!competition) throw new Error(`Unknown competition ${competitionId}`);
  const ctx = makeContext(universe);
  let progress = createProgress(ctx, competition);
  while (progress.phase !== 'done') {
    progress = stepCompetition(ctx, competition, progress, options, []);
  }
  return finalizeCompetition(competition, progress);
}

// ---------------------------------------------------------------------------
// The whole season, step by step
// ---------------------------------------------------------------------------

/** Creates the calendar of every competition. The universe must be between seasons. */
export function startSeason(input: Universe): Universe {
  if (input.currentSeason) throw new Error('A season is already in progress');
  // Starting the season closes the transfer market: contracts end and clubs sign free agents.
  const universe = closeMarket(input, createRng(`${input.seed}/market/${input.seasonNumber}`));
  const ctx = makeContext(universe);
  const competitions = [...universe.competitions].sort((a, b) => a.level - b.level);
  const currentSeason: SeasonProgress = {
    seasonNumber: universe.seasonNumber,
    step: 0,
    competitions: competitions.map((c) => createProgress(ctx, c)),
  };
  return { ...universe, currentSeason };
}

export interface AdvanceOutcome {
  /** New universe. The input universe is not modified. */
  universe: Universe;
  /** Matches played in this step. */
  played: MatchResult[];
  /**
   * The finished season, if this step was the last one. In that case promotion,
   * relegation and ageing have already been applied to `universe`.
   */
  season: Season | null;
}

/**
 * Plays the next step of the season: one matchday of every league still in
 * its regular season and one game of every open playoff series. Starts the
 * season first if needed. When the last competition finishes, the offseason
 * is applied.
 */
export function advanceSeason(
  universe: Universe,
  options: CompetitionSeasonOptions = {},
): AdvanceOutcome {
  const started = universe.currentSeason ? universe : startSeason(universe);
  return advanceStartedSeason(started, options);
}

export interface ManagedMatchday {
  matchId: string;
  events: MatchEvent[];
  boxScore: BoxScore;
  tactics: HalftimeSettings;
  finish(tactics?: HalftimeChanges, options?: CompetitionSeasonOptions): AdvanceOutcome;
}

/** Starts the user's next fixture without applying any part of the matchday to the universe. */
export function beginManagedMatchday(universe: Universe): ManagedMatchday | null {
  const teamId = universe.userTeamId;
  if (teamId === null) return null;
  const started = universe.currentSeason ? universe : startSeason(universe);
  const competition = started.competitions.find((entry) => entry.teamIds.includes(teamId));
  const progress = started.currentSeason?.competitions.find(
    (entry) => entry.competitionId === competition?.id,
  );
  if (!competition || !progress || progress.phase === 'done') return null;
  const ruleset = rulesetOf(started, competition);
  if (ruleset.periods < 2) return null;
  const fixtures =
    progress.phase === 'regular'
      ? progress.fixtures.filter((fixture) => fixture.round === progress.nextRound)
      : playoffFixtures(progress, `s${started.seasonNumber}-${competition.id}`);
  const fixture = fixtures.find(
    (entry) => entry.homeTeamId === teamId || entry.awayTeamId === teamId,
  );
  if (!fixture) return null;

  const ctx = makeContext(started);
  const { id, homeTeamId, awayTeamId } = fixture;
  const home = preparedTeam(ctx, homeTeamId);
  const away = preparedTeam(ctx, awayTeamId);
  const halftime = beginHalftimeMatch(
    { home, away, ruleset, seed: matchSeed(started.seed, id) },
    teamId,
  );
  const { events, tactics } = halftime;
  const { boxScore } = summarizeMatch(events, home, away, ruleset);
  return {
    matchId: id,
    events,
    boxScore,
    tactics,
    finish(nextTactics, options = {}) {
      const match = summarizeMatch(halftime.finish(nextTactics), home, away, ruleset);
      return advanceStartedSeason(started, options, { id, match });
    },
  };
}

function advanceStartedSeason(
  started: Universe,
  options: CompetitionSeasonOptions,
  staged?: { id: string; match: PlayedMatch },
): AdvanceOutcome {
  const progress = started.currentSeason as SeasonProgress;
  const ctx = makeContext(started);
  ctx.injuries = [];
  ctx.playedTeams = new Set();
  const competitionsById = new Map(started.competitions.map((c) => [c.id, c]));
  const played: MatchResult[] = [];
  const competitions = progress.competitions.map((p) =>
    stepCompetition(
      ctx,
      competitionsById.get(p.competitionId) as Competition,
      p,
      options,
      played,
      staged,
    ),
  );
  // Injured players recover one game per match of their team; new injuries start counting
  // from the team's next match. Done after the whole step so every match saw the same squads.
  const players = applyInjuries(
    started.players,
    ctx.playedTeams,
    ctx.injuries,
  ) as Universe['players'];

  if (competitions.every((c) => c.phase === 'done')) {
    const season: Season = {
      seasonNumber: progress.seasonNumber,
      competitions: competitions.map((c) =>
        finalizeCompetition(competitionsById.get(c.competitionId) as Competition, c),
      ),
      finance: [], // filled in by the offseason, which closes the books
    };
    const after = applyOffseason({ ...started, players, currentSeason: null }, season);
    return { universe: after, played, season: after.history[after.history.length - 1] as Season };
  }
  return {
    universe: {
      ...started,
      players,
      currentSeason: { seasonNumber: progress.seasonNumber, step: progress.step + 1, competitions },
    },
    played,
    season: null,
  };
}

export interface SeasonOutcome {
  /** New universe, ready for the next season. The input universe is not modified. */
  universe: Universe;
  /** The season just played (also appended to `universe.history`). */
  season: Season;
}

/**
 * Plays the current season to its end (starting it, or continuing it if it is
 * already in progress), then applies promotion, relegation and ageing.
 */
export function simulateSeason(
  universe: Universe,
  options: CompetitionSeasonOptions = {},
): SeasonOutcome {
  let current = universe;
  for (;;) {
    const outcome = advanceSeason(current, options);
    current = outcome.universe;
    if (outcome.season) return { universe: current, season: outcome.season };
  }
}

/**
 * Re-simulates a single match from the universe as it was when the match was
 * played (same squads, tactics and line-ups). Because every match has its own
 * seed, the replay is identical to the original, including the event log.
 */
export function replayMatch(universeInput: Universe, result: MatchResult): MatchDetail {
  // A universe still between seasons has not closed its market yet; the match was played after.
  const universeAtTheTime = universeInput.currentSeason
    ? universeInput
    : startSeason(universeInput);
  if (result.seasonNumber !== universeAtTheTime.seasonNumber) {
    throw new Error(
      `Match ${result.id} belongs to season ${result.seasonNumber}, but the universe is at season ${universeAtTheTime.seasonNumber}`,
    );
  }
  const ctx = makeContext(universeAtTheTime);
  const competition = universeAtTheTime.competitions.find((c) => c.id === result.competitionId);
  if (!competition) throw new Error(`Unknown competition ${result.competitionId}`);
  const played = playMatch(
    preparedTeam(ctx, result.homeTeamId),
    preparedTeam(ctx, result.awayTeamId),
    rulesetOf(universeAtTheTime, competition),
    matchSeed(universeAtTheTime.seed, result.id),
  );
  return { result, boxScore: played.boxScore, events: played.events };
}
