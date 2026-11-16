import {
  POSITIONS,
  type Competition,
  type Player,
  type Position,
  type Team,
  type Transaction,
  type Universe,
} from '@bm27/schema';
import { DEFAULT_NAME_POOL } from '../data';
import { playerAbility } from '../generator/development';
import { generatePlayer, playerId } from '../generator/player';
import type { Rng } from '../rng';
import { MARKET, clubRating, playerValue, suggestedYears } from './value';

/** Seasons of market history kept in the universe. */
const TRANSACTION_HISTORY_SEASONS = 3;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function competitionOfTeam(universe: Universe, teamId: string): Competition {
  const competition = universe.competitions.find((c) => c.teamIds.includes(teamId));
  if (!competition) throw new Error(`Team "${teamId}" is not in any competition`);
  return competition;
}

/** Players without a club who have not retired. */
export function freeAgents(universe: Universe): Player[] {
  return universe.players.filter((p) => p.teamId === null && !p.retired);
}

/** Total salaries of the players a team has under contract. */
export function teamPayroll(universe: Universe, teamId: string): number {
  const team = universe.teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`Unknown team "${teamId}"`);
  const byId = new Map(universe.players.map((p) => [p.id, p]));
  let total = 0;
  for (const id of team.playerIds) total += byId.get(id)?.contract?.salary ?? 0;
  return total;
}

/** True while the season has not started: signings, renewals and releases are allowed. */
export function isMarketOpen(universe: Universe): boolean {
  return universe.currentSeason === null;
}

/** A contract that has run out: the club must renew it before the season starts or lose the player. */
export function isExpired(universe: Universe, player: Player): boolean {
  return player.contract !== null && player.contract.endSeason < universe.seasonNumber;
}

/** Salary a club must pay to sign or keep `player` (never below the competition minimum). */
export function askingSalary(player: Player, competition: Competition, renewal = false): number {
  const value = playerValue(player) * (renewal ? MARKET.renewalPremium : 1);
  return Math.max(competition.minSalary, Math.round(value / 1000) * 1000);
}

// ---------------------------------------------------------------------------
// Editing helpers (pure)
// ---------------------------------------------------------------------------

/** Applies player and team changes, returning a new universe. */
export function patchUniverse(
  universe: Universe,
  changes: { players?: Map<string, Player>; teams?: Map<string, Team>; log?: Transaction[] },
): Universe {
  return {
    ...universe,
    players: changes.players
      ? universe.players.map((p) => changes.players!.get(p.id) ?? p)
      : universe.players,
    teams: changes.teams
      ? universe.teams.map((t) => changes.teams!.get(t.id) ?? t)
      : universe.teams,
    transactions: changes.log ? [...universe.transactions, ...changes.log] : universe.transactions,
  };
}

/** The team without `playerId`; a hand-picked line-up is dropped if it falls below five players. */
export function withoutPlayer(team: Team, playerId: string): Team {
  const rotation = team.rotation?.filter((id) => id !== playerId) ?? null;
  return {
    ...team,
    playerIds: team.playerIds.filter((id) => id !== playerId),
    rotation: rotation && rotation.length >= 5 ? rotation : null,
  };
}

/** The team with `playerId` added (at the end of the bench). */
export function withPlayer(team: Team, playerId: string): Team {
  return {
    ...team,
    playerIds: [...team.playerIds, playerId],
    rotation: team.rotation ? [...team.rotation, playerId] : null,
  };
}

function trimLog(log: readonly Transaction[], currentSeason: number): Transaction[] {
  return log.filter((t) => t.seasonNumber > currentSeason - TRANSACTION_HISTORY_SEASONS);
}

// ---------------------------------------------------------------------------
// Offseason, step 1: the clubs deal with expiring contracts
// ---------------------------------------------------------------------------

export interface OffseasonContracts {
  players: Player[];
  teams: Team[];
  log: Transaction[];
}

/**
 * For every club except the user's: renews the players it wants to keep and
 * lets the rest go to the free-agent pool.
 *
 * A club keeps a player if he is among its ten best, or is a young player with
 * clear potential, and the club can afford him under its salary cap. Even then
 * it only renews with probability `MARKET.renewalChance`.
 *
 * The user's expiring contracts are left alone: the user decides before the
 * season starts, and whatever is not renewed expires then.
 *
 * `seasonNumber` is the new season (the one about to be played).
 */
export function resolveContracts(
  universe: Universe,
  seasonNumber: number,
  rng: Rng,
): OffseasonContracts {
  const players = new Map(universe.players.map((p) => [p.id, p]));
  const teams: Team[] = [];
  const log: Transaction[] = [];

  for (const team of universe.teams) {
    if (team.id === universe.userTeamId) {
      teams.push(team);
      continue;
    }
    const competition = competitionOfTeam(universe, team.id);
    const roster = team.playerIds.map((id) => players.get(id) as Player);
    const expiring = roster.filter((p) => p.contract && p.contract.endSeason < seasonNumber);
    if (expiring.length === 0) {
      teams.push(team);
      continue;
    }
    const rank = new Map(
      [...roster]
        .sort((a, b) => playerAbility(b) - playerAbility(a) || (a.id < b.id ? -1 : 1))
        .map((p, i) => [p.id, i + 1]),
    );
    let payroll = roster
      .filter((p) => p.contract && p.contract.endSeason >= seasonNumber)
      .reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0);

    const keep = new Set<string>();
    for (const player of expiring.sort((a, b) => playerAbility(b) - playerAbility(a))) {
      const wanted =
        (rank.get(player.id) as number) <= 10 ||
        (player.age <= 23 && player.potential - playerAbility(player) >= 6);
      const salary = askingSalary(player, competition, true);
      if (
        wanted &&
        player.age <= 35 &&
        rng.chance(MARKET.renewalChance) &&
        payroll + salary <= competition.salaryCap
      ) {
        payroll += salary;
        keep.add(player.id);
        const years = suggestedYears(player.age);
        const endSeason = seasonNumber + years - 1;
        players.set(player.id, { ...player, contract: { salary, endSeason } });
        log.push({
          seasonNumber,
          type: 'renewed',
          playerId: player.id,
          teamId: team.id,
          salary,
          endSeason,
        });
      }
    }
    let updated = team;
    for (const player of expiring) {
      if (keep.has(player.id)) continue;
      players.set(player.id, { ...player, teamId: null, contract: null });
      log.push({
        seasonNumber,
        type: 'expired',
        playerId: player.id,
        teamId: team.id,
        salary: null,
        endSeason: null,
      });
      updated = withoutPlayer(updated, player.id);
    }
    teams.push(updated);
  }
  return { players: [...players.values()], teams, log };
}

// ---------------------------------------------------------------------------
// Season start: the market closes
// ---------------------------------------------------------------------------

/** Position (index into POSITIONS) of the first natural position of a player. */
const primary = (p: Player): number => POSITIONS.indexOf(p.positions[0] as Position);

/** How much a team needs another player at `position`: lower when it has many there. */
function positionNeed(roster: readonly Player[], position: number): number {
  const group = position <= 1 ? [0, 1] : position === 2 ? [2] : [3, 4];
  const have = roster.filter((p) => group.includes(primary(p))).length;
  const wanted = group.length === 2 ? 5 : 3;
  return have >= wanted ? -3 : have <= wanted - 2 ? 2 : 0;
}

/** Why the user cannot start the season yet, or null if everything is in order. */
export function marketProblem(universe: Universe): string | null {
  if (!universe.userTeamId) return null;
  const team = universe.teams.find((t) => t.id === universe.userTeamId);
  if (!team) return null;
  const competition = competitionOfTeam(universe, team.id);
  const byId = new Map(universe.players.map((p) => [p.id, p]));
  const roster = team.playerIds.map((id) => byId.get(id) as Player);
  const staying = roster.filter((p) => !isExpired(universe, p));
  const expiring = roster.length - staying.length;
  if (staying.length < competition.rosterMin) {
    return expiring > 0
      ? `Tu plantilla se queda con ${staying.length} jugadores cuando se cumplan ${expiring} contrato(s) y necesitas al menos ${competition.rosterMin}. Renueva o ficha antes de empezar.`
      : `Tu plantilla tiene ${staying.length} jugadores y necesitas al menos ${competition.rosterMin}. Ficha agentes libres antes de empezar.`;
  }
  if (roster.length > competition.rosterMax) {
    return `Tu plantilla tiene ${roster.length} jugadores y el máximo es ${competition.rosterMax}. Libera a alguno antes de empezar.`;
  }
  // The salary cap limits signings and renewals, not contracts already signed: a relegated
  // club may start the season above the cap of its new level.
  return null;
}

/**
 * Closes the market when a new season starts:
 *  1. Contracts that have run out end (every club, the user's included).
 *  2. Clubs short of players sign free agents, best first, as long as they
 *     fit under the cap (a minimum-wage signing is always allowed).
 *  3. Clubs with room and a better player available upgrade their squad.
 *
 * The user's team is never touched except for expiring contracts, and must
 * satisfy `marketProblem` beforehand.
 */
export function closeMarket(universe: Universe, rng: Rng): Universe {
  const problem = marketProblem(universe);
  if (problem) throw new Error(problem);
  const seasonNumber = universe.seasonNumber;
  const players = new Map(universe.players.map((p) => [p.id, p]));
  const teams = new Map(universe.teams.map((t) => [t.id, t]));
  const log: Transaction[] = [];
  let nextPlayerSeq = universe.nextPlayerSeq;

  // 1. Expiring contracts.
  for (const team of universe.teams) {
    let current = team;
    for (const id of team.playerIds) {
      const player = players.get(id) as Player;
      if (!isExpired(universe, player)) continue;
      players.set(id, { ...player, teamId: null, contract: null });
      log.push({
        seasonNumber,
        type: 'expired',
        playerId: id,
        teamId: team.id,
        salary: null,
        endSeason: null,
      });
      current = withoutPlayer(current, id);
    }
    if (current !== team) teams.set(team.id, current);
  }

  // The pool of free agents, best first. Ratings are computed once.
  const rating = new Map<string, number>();
  const rateOf = (p: Player): number => {
    let r = rating.get(p.id);
    if (r === undefined) rating.set(p.id, (r = clubRating(p)));
    return r;
  };
  const pool = [...players.values()]
    .filter((p) => p.teamId === null && !p.retired)
    .sort((a, b) => rateOf(b) - rateOf(a) || (a.id < b.id ? -1 : 1));
  const taken = new Set<string>();
  const salaryCache = new Map<string, number>();
  const salaryOf = (p: Player, competition: Competition): number => {
    const key = `${p.id}/${competition.minSalary}`;
    let v = salaryCache.get(key);
    if (v === undefined) salaryCache.set(key, (v = askingSalary(p, competition)));
    return v;
  };

  const sign = (team: Team, player: Player, salary: number): void => {
    const endSeason = seasonNumber + suggestedYears(player.age) - 1;
    players.set(player.id, { ...player, teamId: team.id, contract: { salary, endSeason } });
    teams.set(team.id, withPlayer(teams.get(team.id) as Team, player.id));
    taken.add(player.id);
    log.push({
      seasonNumber,
      type: 'signed',
      playerId: player.id,
      teamId: team.id,
      salary,
      endSeason,
    });
  };

  const rosterOf = (team: Team): Player[] =>
    (teams.get(team.id) as Team).playerIds.map((id) => players.get(id) as Player);
  const payrollOf = (team: Team): number =>
    rosterOf(team).reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0);

  // Top-level clubs choose first; inside a level the order is random but seeded.
  const order: { team: Team; competition: Competition }[] = [];
  for (const competition of [...universe.competitions].sort((a, b) => a.level - b.level)) {
    for (const teamId of rng.shuffle(competition.teamIds)) {
      if (teamId === universe.userTeamId) continue;
      order.push({ team: teams.get(teamId) as Team, competition });
    }
  }

  /** Best free agent a club can afford, weighing what its squad lacks. */
  const bestAffordable = (
    team: Team,
    competition: Competition,
    mandatory: boolean,
  ): Player | null => {
    const roster = rosterOf(team);
    const payroll = payrollOf(team);
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const candidate of pool) {
      if (taken.has(candidate.id)) continue;
      const salary = salaryOf(candidate, competition);
      // Only a minimum-wage contract needed to reach the minimum squad may go over the cap.
      const exception = mandatory && salary <= competition.minSalary;
      if (payroll + salary > competition.salaryCap && !exception) continue;
      const score = rateOf(candidate) + positionNeed(roster, primary(candidate));
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  };

  // 2. Fill to the minimum roster (mandatory), then to the usual size.
  for (const { team, competition } of order) {
    const target = Math.min(
      competition.rosterMax,
      Math.max(competition.rosterMin, MARKET.aiTargetRoster),
    );
    while (rosterOf(team).length < target) {
      const mandatory = rosterOf(team).length < competition.rosterMin;
      let best = bestAffordable(team, competition, mandatory);
      if (!best) {
        if (!mandatory) break;
        // PLACEHOLDER: nobody affordable is left, so the club promotes a youth player.
        const quality = universe.qualityByLevel[String(competition.level)] ?? 45;
        const youth = generatePlayer(rng, DEFAULT_NAME_POOL, {
          id: playerId(nextPlayerSeq++),
          teamId: null,
          quality: quality + MARKET.prospectQualityOffset,
          position: POSITIONS[rng.int(0, 4)] as Position,
          minAge: 18,
          maxAge: 20,
        });
        players.set(youth.id, youth);
        pool.push(youth);
        best = youth;
      }
      sign(team, best, salaryOf(best, competition));
    }
  }

  // 3. Upgrades: a free agent clearly better than the club's ninth man.
  for (const { team, competition } of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const roster = rosterOf(team);
      if (roster.length >= competition.rosterMax) break;
      const ratings = roster.map(rateOf).sort((a, b) => b - a);
      const bar = (ratings[8] ?? 0) + 1.5;
      const payroll = payrollOf(team);
      const candidate = pool.find((c) => {
        if (taken.has(c.id) || rateOf(c) <= bar) return false;
        return payroll + salaryOf(c, competition) <= competition.salaryCap;
      });
      if (!candidate) break;
      sign(team, candidate, salaryOf(candidate, competition));
    }
  }

  return {
    ...universe,
    nextPlayerSeq,
    players: [...players.values()],
    teams: universe.teams.map((t) => teams.get(t.id) ?? t),
    transactions: trimLog([...universe.transactions, ...log], seasonNumber),
  };
}
