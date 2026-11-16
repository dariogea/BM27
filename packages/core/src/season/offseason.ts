import {
  POSITIONS,
  type Competition,
  type Player,
  type PlayerAttributes,
  type Position,
  type Season,
  type Team,
  type Universe,
} from '@bm27/schema';
import { DEFAULT_NAME_POOL } from '../data';
import { generatePlayer, playerId } from '../generator/player';
import { createRng, type Rng } from '../rng';

/**
 * PLACEHOLDER offseason (T-001): just enough to chain seasons together.
 * - Promotion / relegation from each competition's final ranking.
 * - Trivial ageing: +1 year, small attribute drift by age.
 * - Retirement at 36+ (always at 39), replaced by a generated youngster so that
 *   rosters keep their size. There is no market, contracts or youth system yet.
 */
export function applyOffseason(universe: Universe, season: Season): Universe {
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

  // --- Ageing, retirement and replacement -----------------------------------
  let nextPlayerSeq = universe.nextPlayerSeq;
  const players: Player[] = [];
  const replacements = new Map<string, Map<string, string>>(); // team → retired → new
  for (const player of universe.players) {
    if (player.retired) {
      players.push(player);
      continue;
    }
    const aged = agePlayer(player, rng);
    const retires = aged.age >= 39 || (aged.age >= 36 && rng.chance(0.4));
    if (!retires || aged.teamId === null) {
      players.push(aged);
      continue;
    }
    const teamId = aged.teamId;
    players.push({ ...aged, teamId: null, retired: true });
    const level = levelByTeam.get(teamId) ?? 1;
    const quality = universe.qualityByLevel[String(level)] ?? 50;
    const youngster = generatePlayer(rng, DEFAULT_NAME_POOL, {
      id: playerId(nextPlayerSeq++),
      teamId,
      quality: quality - 4,
      position: aged.positions[0] ?? (POSITIONS[2] as Position),
      minAge: 18,
      maxAge: 21,
    });
    players.push(youngster);
    let forTeam = replacements.get(teamId);
    if (!forTeam) replacements.set(teamId, (forTeam = new Map()));
    forTeam.set(aged.id, youngster.id);
  }

  const teams: Team[] = universe.teams.map((team) => {
    const forTeam = replacements.get(team.id);
    if (!forTeam) return team;
    return {
      ...team,
      playerIds: team.playerIds.map((id) => forTeam.get(id) ?? id),
      // A hand-picked line-up keeps its shape: the newcomer takes the retiree's spot.
      rotation: team.rotation ? team.rotation.map((id) => forTeam.get(id) ?? id) : null,
    };
  });

  return {
    ...universe,
    seasonNumber: universe.seasonNumber + 1,
    nextPlayerSeq,
    competitions,
    teams,
    players,
    history: [...universe.history, season],
  };
}

function agePlayer(player: Player, rng: Rng): Player {
  const age = player.age + 1;
  // Young players improve, veterans decline, the rest barely move.
  const drift = (): number => {
    if (age <= 23) return rng.int(0, 2);
    if (age <= 29) return rng.int(-1, 1);
    if (age <= 32) return rng.int(-1, 0);
    return rng.int(-3, 0);
  };
  const shift = <T extends Record<string, number>>(group: T): T => {
    const out: Record<string, number> = {};
    for (const key of Object.keys(group)) {
      out[key] = Math.max(1, Math.min(99, (group[key] as number) + drift()));
    }
    return out as T;
  };
  const attributes: PlayerAttributes = {
    offensive: shift(player.attributes.offensive),
    defensive: shift(player.attributes.defensive),
    physical: shift(player.attributes.physical),
    mental: shift(player.attributes.mental),
  };
  return { ...player, age, attributes };
}
