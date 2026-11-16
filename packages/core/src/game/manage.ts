import {
  TeamTacticsSchema,
  parseWith,
  type Team,
  type TeamTactics,
  type Universe,
} from '@bm27/schema';

/**
 * Decisions a human manager can take. Every function is pure: it returns a new
 * universe and never modifies the one it receives. Changes apply to matches
 * played afterwards; matches already played are never rewritten.
 */

function replaceTeam(universe: Universe, teamId: string, change: (team: Team) => Team): Universe {
  let found = false;
  const teams = universe.teams.map((team) => {
    if (team.id !== teamId) return team;
    found = true;
    return change(team);
  });
  if (!found) throw new Error(`Unknown team "${teamId}"`);
  return { ...universe, teams };
}

/** Chooses the team managed by the human player (null: just watch). */
export function setUserTeam(universe: Universe, teamId: string | null): Universe {
  if (teamId !== null && !universe.teams.some((t) => t.id === teamId)) {
    throw new Error(`Unknown team "${teamId}"`);
  }
  return { ...universe, userTeamId: teamId };
}

/** Changes some or all of a team's tactics. Invalid values are rejected. */
export function setTeamTactics(
  universe: Universe,
  teamId: string,
  tactics: Partial<TeamTactics>,
): Universe {
  return replaceTeam(universe, teamId, (team) => ({
    ...team,
    tactics: parseWith(TeamTacticsSchema, 'tactics', { ...team.tactics, ...tactics }),
  }));
}

/**
 * Sets a hand-picked line-up: player ids in order, the first five being the
 * starters at PG, SG, SF, PF and C. Pass null to let the coach decide again.
 */
export function setTeamRotation(
  universe: Universe,
  teamId: string,
  rotation: readonly string[] | null,
): Universe {
  return replaceTeam(universe, teamId, (team) => {
    if (rotation === null) return { ...team, rotation: null };
    if (rotation.length < 5) throw new Error('A line-up needs at least 5 players');
    if (new Set(rotation).size !== rotation.length) {
      throw new Error('A player appears twice in the line-up');
    }
    const squad = new Set(team.playerIds);
    const stranger = rotation.find((id) => !squad.has(id));
    if (stranger) throw new Error(`Player "${stranger}" is not in this team`);
    return { ...team, rotation: [...rotation] };
  });
}
