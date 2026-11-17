import {
  POSITIONS,
  type Competition,
  type Player,
  type Position,
  type Season,
  type Team,
  type Transaction,
  type Universe,
} from '@bm27/schema';
import { DEFAULT_NAME_POOL } from '../data';
import { developPlayer, retirementChance } from '../generator/development';
import { generatePlayer, playerId } from '../generator/player';
import { settleSeason } from '../finance/economy';
import { resolveContracts, withoutPlayer } from '../market/market';
import { MARKET } from '../market/value';
import { createRng } from '../rng';

/**
 * Offseason:
 * - Promotion / relegation from each competition's final ranking.
 * - Every player gets a year older and develops or declines (see
 *   `generator/development.ts`).
 * - Veterans retire with growing probability from 34; unsigned players of 29
 *   or more retire too.
 * - Each retirement is matched by a young free agent of the same level.
 *   PLACEHOLDER: there is no youth academy yet.
 * - Clubs renew or release the players whose contract ends (the user's club
 *   decides by itself before the season starts).
 */
/** Games of recovery that the offseason is worth: short injuries heal, long ones carry over. */
export const OFFSEASON_RECOVERY_GAMES = 30;

function recover(player: Player): Player {
  if (!player.injury) return player;
  const left = player.injury.gamesRemaining - OFFSEASON_RECOVERY_GAMES;
  return { ...player, injury: left > 0 ? { gamesRemaining: left } : null };
}

export function applyOffseason(universe: Universe, playedSeason: Season): Universe {
  // Close the books of the season that has just been played.
  const books = settleSeason(universe, playedSeason);
  const season: Season = { ...playedSeason, finance: books.records };
  universe = { ...universe, teams: books.teams };
  const rng = createRng(`${universe.seed}/offseason/${season.seasonNumber}`);

  // --- Promotion and relegation --------------------------------------------
  const seasonByCompetition = new Map(season.competitions.map((c) => [c.competitionId, c]));
  const sorted = [...universe.competitions].sort((a, b) => a.level - b.level);
  const members = new Map(sorted.map((c) => [c.id, new Set(c.teamIds)]));
  for (let i = 0; i < sorted.length - 1; i++) {
    const upper = sorted[i] as Competition;
    const lower = sorted[i + 1] as Competition;
    const down = seasonByCompetition.get(upper.id)?.relegatedTeamIds ?? [];
    const up = seasonByCompetition.get(lower.id)?.promotedTeamIds ?? [];
    if (down.length !== up.length) {
      throw new Error(
        `${upper.id} relegates ${down.length} team(s) but ${lower.id} promotes ${up.length}`,
      );
    }
    for (const teamId of down) {
      members.get(upper.id)?.delete(teamId);
      members.get(lower.id)?.add(teamId);
    }
    for (const teamId of up) {
      members.get(lower.id)?.delete(teamId);
      members.get(upper.id)?.add(teamId);
    }
  }
  const competitions = universe.competitions.map((c) => ({
    ...c,
    teamIds: [...(members.get(c.id) as Set<string>)].sort(),
  }));
  const levelByTeam = new Map<string, number>();
  for (const c of competitions) for (const teamId of c.teamIds) levelByTeam.set(teamId, c.level);

  // --- Ageing, retirement and new talent ------------------------------------
  const seasonNumber = season.seasonNumber + 1;
  let nextPlayerSeq = universe.nextPlayerSeq;
  const players: Player[] = [];
  const log: Transaction[] = [];
  const teamLoses = new Map<string, Set<string>>(); // team → retired players
  const prospects: Player[] = [];
  let retiredFreeAgents = 0;
  for (const player of universe.players) {
    if (player.retired) {
      players.push(player);
      continue;
    }
    const aged = recover(developPlayer(player, rng));
    // Unsigned players who are no longer young give up; the others keep waiting for an offer.
    const retires =
      aged.teamId === null
        ? aged.age >= MARKET.freeAgentRetirementAge
        : rng.chance(retirementChance(aged.age));
    if (!retires) {
      players.push(aged);
      continue;
    }
    players.push({ ...aged, teamId: null, contract: null, retired: true });
    log.push({
      seasonNumber,
      type: 'retired',
      playerId: aged.id,
      teamId: aged.teamId,
      salary: null,
      endSeason: null,
      cost: null,
    });
    if (aged.teamId === null) {
      retiredFreeAgents++;
      continue;
    }
    let lost = teamLoses.get(aged.teamId);
    if (!lost) teamLoses.set(aged.teamId, (lost = new Set()));
    lost.add(aged.id);
  }

  // Every retirement is matched by a young free agent of the level the veteran played at, so
  // the supply of talent of each level stays the same. PLACEHOLDER: there is no academy yet.
  const lowestLevel = Math.max(...competitions.map((c) => c.level));
  const retirements: { teamId: string | null; position: Position }[] = [];
  for (const [teamId, lost] of teamLoses) {
    for (const id of lost) {
      const retiree = players.find((p) => p.id === id) as Player;
      retirements.push({ teamId, position: retiree.positions[0] ?? (POSITIONS[2] as Position) });
    }
  }
  for (let i = 0; i < retiredFreeAgents; i++)
    retirements.push({ teamId: null, position: POSITIONS[rng.int(0, 4)] as Position });
  for (const { teamId, position } of retirements) {
    const level = teamId === null ? lowestLevel : (levelByTeam.get(teamId) ?? lowestLevel);
    prospects.push(
      generatePlayer(rng, DEFAULT_NAME_POOL, {
        id: playerId(nextPlayerSeq++),
        teamId: null,
        quality: (universe.qualityByLevel[String(level)] ?? 50) + MARKET.prospectQualityOffset,
        position,
        minAge: 18,
        maxAge: 20,
      }),
    );
  }

  const teams: Team[] = universe.teams.map((team) => {
    const lost = teamLoses.get(team.id);
    if (!lost) return team;
    let updated = team;
    for (const id of lost) updated = withoutPlayer(updated, id);
    return updated;
  });

  // --- The clubs deal with expiring contracts ---------------------------------
  const aged: Universe = {
    ...universe,
    seasonNumber,
    nextPlayerSeq,
    competitions,
    teams,
    players: [...players, ...prospects],
    history: [...universe.history, season],
  };
  const contracts = resolveContracts(aged, seasonNumber, rng);
  return {
    ...aged,
    players: contracts.players,
    teams: contracts.teams,
    transactions: [...universe.transactions, ...log, ...contracts.log].filter(
      (t) => t.seasonNumber > seasonNumber - 3,
    ),
  };
}
