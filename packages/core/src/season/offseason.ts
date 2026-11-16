import {
  POSITIONS,
  type Competition,
  type Player,
  type Position,
  type Season,
  type Team,
  type Universe,
} from '@bm27/schema';
import { DEFAULT_NAME_POOL } from '../data';
import { developPlayer, retirementChance } from '../generator/development';
import { generatePlayer, playerId } from '../generator/player';
import { createRng } from '../rng';

/**
 * Offseason:
 * - Promotion / relegation from each competition's final ranking.
 * - Every player gets a year older and develops or declines (see
 *   `generator/development.ts`).
 * - Veterans retire with growing probability from 34.
 *
 * PLACEHOLDER: there is no market, contracts or youth academy yet. Each
 * retiree is simply replaced by a generated 18–20-year-old prospect of his
 * club's level, so squads keep their size.
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
    const aged = developPlayer(player, rng);
    const retires = rng.chance(retirementChance(aged.age));
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
      quality,
      position: aged.positions[0] ?? (POSITIONS[2] as Position),
      minAge: 18,
      maxAge: 20,
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
