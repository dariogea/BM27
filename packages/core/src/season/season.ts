import type {
  Competition,
  CompetitionSeason,
  GroupSeason,
  MatchDetail,
  MatchResult,
  Player,
  PlayerSeasonStats,
  PlayoffSeries,
  Ruleset,
  Season,
  StandingRow,
  Team,
  Universe,
} from '@bm27/schema';
import { addStatLine, emptyStatLine, playMatch, prepareTeam, type PreparedTeam } from '../match';
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
}

function makeContext(universe: Universe): SeasonContext {
  const teamsById = new Map(universe.teams.map((t) => [t.id, t]));
  const playersById = new Map(universe.players.map((p) => [p.id, p]));
  return {
    universe,
    seasonNumber: universe.seasonNumber,
    teamsById,
    playersById,
    prepared: new Map(),
  };
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

function simulateCompetition(
  ctx: SeasonContext,
  competition: Competition,
  options: CompetitionSeasonOptions,
): CompetitionSeason {
  const { universe, seasonNumber } = ctx;
  const ruleset = rulesetOf(universe, competition);
  const matches: MatchResult[] = [];
  const statsByPlayer = new Map<string, PlayerSeasonStats>();

  const play = (
    id: string,
    stage: MatchResult['stage'],
    round: number,
    homeTeamId: string,
    awayTeamId: string,
  ): MatchResult => {
    const played = playMatch(
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
      homeScore: played.boxScore.home.points,
      awayScore: played.boxScore.away.points,
      overtimePeriods: played.overtimePeriods,
    };
    matches.push(result);
    for (const side of [played.boxScore.home, played.boxScore.away]) {
      for (const line of side.players) {
        if (line.seconds === 0) continue;
        let stats = statsByPlayer.get(line.playerId);
        if (!stats) {
          stats = { playerId: line.playerId, teamId: side.teamId, games: 0, ...emptyStatLine() };
          statsByPlayer.set(line.playerId, stats);
        }
        stats.games++;
        addStatLine(stats, line);
      }
    }
    options.onMatch?.({ result, boxScore: played.boxScore, events: played.events });
    return result;
  };

  // --- Regular season -------------------------------------------------------
  const prefix = `s${seasonNumber}-${competition.id}`;
  const groups: GroupSeason[] = [];
  let regularCounter = 0;
  for (const group of assignGroups(universe, competition, ctx.teamsById)) {
    const fixtures = buildRoundRobin(group.teamIds, competition.format.roundRobinLegs);
    const groupMatches: MatchResult[] = [];
    for (const f of fixtures) {
      regularCounter++;
      const id = `${prefix}-r${String(regularCounter).padStart(4, '0')}`;
      groupMatches.push(play(id, 'regular', f.round, f.homeTeamId, f.awayTeamId));
    }
    groups.push({
      name: group.name,
      teamIds: group.teamIds,
      standings: computeStandings(group.teamIds, groupMatches),
    });
  }

  const ranked: Ranked[] = groups
    .flatMap((g) => g.standings.map((row) => ({ teamId: row.teamId, row })))
    .sort(compareAcrossGroups);

  // --- Playoffs -------------------------------------------------------------
  const playoffSeries: PlayoffSeries[] = [];
  const playoffOrder: string[] = []; // best to worst among playoff teams
  const playoffs = competition.format.playoffs;
  if (playoffs) {
    const seeds = ranked
      .filter((r) => r.row.position <= playoffs.qualifiersPerGroup)
      .map((r) => r.teamId);
    const seedOf = new Map(seeds.map((teamId, i) => [teamId, i + 1]));
    const size = bracketSize(seeds.length);
    let alive: (string | null)[] = bracketOrder(size).map((seed) => seeds[seed - 1] ?? null);
    const eliminatedByRound: string[][] = [];
    let playoffCounter = 0;

    for (let round = 0; alive.length > 1; round++) {
      const bestOf = bestOfForRound(playoffs.seriesBestOf, round);
      const winners: (string | null)[] = [];
      const eliminated: string[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        const a = alive[i] ?? null;
        const b = alive[i + 1] ?? null;
        if (a === null || b === null) {
          const through = a ?? b;
          winners.push(through);
          if (through !== null) {
            playoffSeries.push({
              round: round + 1,
              bestOf,
              highSeed: seedOf.get(through) as number,
              highSeedTeamId: through,
              lowSeedTeamId: null,
              highSeedWins: 0,
              lowSeedWins: 0,
              winnerTeamId: through,
              matchIds: [],
            });
          }
          continue;
        }
        const aIsHigh = (seedOf.get(a) as number) < (seedOf.get(b) as number);
        const high = aIsHigh ? a : b;
        const low = aIsHigh ? b : a;
        const needed = Math.floor(bestOf / 2) + 1;
        let highWins = 0;
        let lowWins = 0;
        const matchIds: string[] = [];
        for (let game = 1; highWins < needed && lowWins < needed; game++) {
          playoffCounter++;
          const id = `${prefix}-p${String(playoffCounter).padStart(4, '0')}`;
          // The higher seed hosts the odd games (1, 3, 5...).
          const highHome = game % 2 === 1;
          const result = play(
            id,
            'playoff',
            round + 1,
            highHome ? high : low,
            highHome ? low : high,
          );
          const homeWon = result.homeScore > result.awayScore;
          if (homeWon === highHome) highWins++;
          else lowWins++;
          matchIds.push(id);
        }
        const winner = highWins > lowWins ? high : low;
        winners.push(winner);
        eliminated.push(winner === high ? low : high);
        playoffSeries.push({
          round: round + 1,
          bestOf,
          highSeed: seedOf.get(high) as number,
          highSeedTeamId: high,
          lowSeedTeamId: low,
          highSeedWins: highWins,
          lowSeedWins: lowWins,
          winnerTeamId: winner,
          matchIds,
        });
      }
      eliminated.sort((x, y) => (seedOf.get(x) as number) - (seedOf.get(y) as number));
      eliminatedByRound.push(eliminated);
      alive = winners;
    }
    const champion = alive[0];
    if (champion) playoffOrder.push(champion);
    for (let r = eliminatedByRound.length - 1; r >= 0; r--) {
      playoffOrder.push(...(eliminatedByRound[r] as string[]));
    }
  }

  // --- Final ranking, promotion and relegation ------------------------------
  const inPlayoffs = new Set(playoffOrder);
  const finalRanking = [
    ...playoffOrder,
    ...ranked.filter((r) => !inPlayoffs.has(r.teamId)).map((r) => r.teamId),
  ];
  const promotedTeamIds = finalRanking.slice(0, competition.promotionSlots);
  const relegatedTeamIds =
    competition.relegationSlots > 0 ? finalRanking.slice(-competition.relegationSlots) : [];

  return {
    competitionId: competition.id,
    groups,
    matches,
    playoffSeries,
    finalRanking,
    championTeamId: finalRanking[0] as string,
    promotedTeamIds,
    relegatedTeamIds,
    playerStats: [...statsByPlayer.values()],
  };
}

/** Simulates one competition of the universe's current season (no offseason). */
export function simulateCompetitionSeason(
  universe: Universe,
  competitionId: string,
  options: CompetitionSeasonOptions = {},
): CompetitionSeason {
  const competition = universe.competitions.find((c) => c.id === competitionId);
  if (!competition) throw new Error(`Unknown competition ${competitionId}`);
  return simulateCompetition(makeContext(universe), competition, options);
}

export interface SeasonOutcome {
  /** New universe, ready for the next season. The input universe is not modified. */
  universe: Universe;
  /** The season just played (also appended to `universe.history`). */
  season: Season;
}

/**
 * Simulates the current season of every competition, then applies promotion,
 * relegation and ageing. Pure function: returns a new universe.
 */
export function simulateSeason(
  universe: Universe,
  options: CompetitionSeasonOptions = {},
): SeasonOutcome {
  const ctx = makeContext(universe);
  const competitions = [...universe.competitions].sort((a, b) => a.level - b.level);
  const season: Season = {
    seasonNumber: universe.seasonNumber,
    competitions: competitions.map((c) => simulateCompetition(ctx, c, options)),
  };
  return { universe: applyOffseason(universe, season), season };
}

/**
 * Re-simulates a single match of the season about to be (or just) played from
 * the universe as it was BEFORE that season. Because every match has its own
 * seed, the replay is identical to the original, including the event log.
 */
export function replayMatch(universeBeforeSeason: Universe, result: MatchResult): MatchDetail {
  if (result.seasonNumber !== universeBeforeSeason.seasonNumber) {
    throw new Error(
      `Match ${result.id} belongs to season ${result.seasonNumber}, but the universe is at season ${universeBeforeSeason.seasonNumber}`,
    );
  }
  const ctx = makeContext(universeBeforeSeason);
  const competition = universeBeforeSeason.competitions.find((c) => c.id === result.competitionId);
  if (!competition) throw new Error(`Unknown competition ${result.competitionId}`);
  const played = playMatch(
    preparedTeam(ctx, result.homeTeamId),
    preparedTeam(ctx, result.awayTeamId),
    rulesetOf(universeBeforeSeason, competition),
    matchSeed(universeBeforeSeason.seed, result.id),
  );
  return { result, boxScore: played.boxScore, events: played.events };
}
