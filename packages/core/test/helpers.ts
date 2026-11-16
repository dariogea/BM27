import type { Player, Position, Team } from '@bm27/schema';
import { POSITIONS } from '@bm27/schema';
import {
  DEFAULT_NAME_POOL,
  createRng,
  generatePlayer,
  prepareTeam,
  type PreparedTeam,
} from '../src/index';

/** Builds a 12-player team of the given average quality for engine tests. */
export function makeTestTeam(teamId: string, quality: number, seed: string): PreparedTeam {
  const rng = createRng(seed);
  const players: Player[] = [];
  for (let i = 0; i < 12; i++) {
    players.push(
      generatePlayer(rng, DEFAULT_NAME_POOL, {
        id: `${teamId}-p${i}`,
        teamId,
        quality,
        position: POSITIONS[i % 5] as Position,
        minAge: 22,
        maxAge: 30,
      }),
    );
  }
  const team: Team = {
    id: teamId,
    name: teamId,
    city: 'Test',
    region: 'Test',
    playerIds: players.map((p) => p.id),
  };
  return prepareTeam(team, new Map(players.map((p) => [p.id, p])));
}
