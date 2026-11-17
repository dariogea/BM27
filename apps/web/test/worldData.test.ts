import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceSeason,
  generateUniverse,
  setUserTeam,
  simulateSeason,
  startSeason,
} from '@bm27/core';
import type { Universe } from '@bm27/schema';
import { queryWorld } from '../src/worldData';
import type { WorldQuery } from '../src/worldTypes';

let world: Universe;
beforeAll(() => {
  const initial = generateUniverse({ seed: 'world-consultation' });
  const completed = simulateSeason(initial).universe;
  world = advanceSeason(startSeason(setUserTeam(completed, completed.teams[0]!.id))).universe;
});
const search = (extra: Partial<Extract<WorldQuery, { type: 'worldSearch' }>> = {}): WorldQuery => ({
  type: 'worldSearch',
  entity: 'players',
  query: '',
  competitionId: '',
  page: 0,
  includeRetired: false,
  ...extra,
});

describe('read-only world projections', () => {
  it('paginates the full active-player set with no duplicates or missing players', () => {
    const first = queryWorld(world, search());
    if (first.kind !== 'search') throw new Error('Wrong reply');
    const ids: string[] = [];
    for (let page = 0; page < Math.ceil(first.total / first.pageSize); page++) {
      const result = queryWorld(world, search({ page }));
      if (result.kind !== 'search') throw new Error('Wrong reply');
      expect(result.rows.length).toBeLessThanOrEqual(40);
      ids.push(...result.rows.map((r) => r.id));
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(
      world.players
        .filter((p) => !p.retired)
        .map((p) => p.id)
        .sort(),
    );
    expect(queryWorld(world, search({ page: 99999 }))).toEqual(
      queryWorld(world, search({ page: Math.ceil(first.total / first.pageSize) - 1 })),
    );
  });
  it('finds accent-insensitive names, filters current competitions and explicitly includes retired players', () => {
    const person = world.players.find((p) => !p.retired && p.teamId)!;
    const query = `${person.firstName} ${person.lastName}`
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase();
    const found = queryWorld(world, search({ query }));
    if (found.kind !== 'search') throw new Error('Wrong reply');
    expect(found.rows.some((r) => r.id === person.id)).toBe(true);
    const competition = world.competitions[0]!;
    const filtered = queryWorld(world, search({ competitionId: competition.id }));
    if (filtered.kind !== 'search') throw new Error('Wrong reply');
    expect(filtered.total).toBe(
      world.players.filter((p) => !p.retired && p.teamId && competition.teamIds.includes(p.teamId))
        .length,
    );
    const all = queryWorld(world, search({ includeRetired: true }));
    if (all.kind !== 'search') throw new Error('Wrong reply');
    expect(world.players.some((p) => p.retired)).toBe(true);
    expect(all.total).toBe(world.players.length);
  });
  it('never sends a rival or free agent potential, but preserves the manager’s own potential', () => {
    const own = world.players.find((p) => p.teamId === world.userTeamId)!;
    const rival = world.players.find((p) => p.teamId !== null && p.teamId !== world.userTeamId)!;
    const free = world.players.find((p) => p.teamId === null && !p.retired)!;
    for (const player of [own, rival, free]) {
      const profile = queryWorld(world, { type: 'worldPlayer', playerId: player.id });
      if (profile.kind !== 'player') throw new Error('Wrong reply');
      expect(profile.potential).toBe(player === own ? player.potential : null);
      expect(profile.attributes).toEqual(player.attributes);
      expect(profile.contract).toEqual(player.contract);
      expect(profile.injuryGames).toBe(player.injury?.gamesRemaining ?? 0);
    }
    const noManager = queryWorld(
      { ...world, userTeamId: null },
      { type: 'worldPlayer', playerId: own.id },
    );
    expect(noManager.kind === 'player' && noManager.potential).toBeNull();
  });
  it('uses actual season statistics, including the stored previous team rather than the current club', () => {
    const past = world.history[0]!;
    const competition = past.competitions.find((c) => c.playerStats.length)!;
    const stats = competition.playerStats[0]!;
    const profile = queryWorld(world, { type: 'worldPlayer', playerId: stats.playerId });
    if (profile.kind !== 'player') throw new Error('Wrong reply');
    const record = profile.seasons.find(
      (r) => r.season === past.seasonNumber && r.stats.teamId === stats.teamId,
    )!;
    expect(record.stats).toEqual(stats);
    expect(record.teamName).toBe(world.teams.find((t) => t.id === stats.teamId)!.name);
    expect(profile.seasons.every((r) => r.season >= 1)).toBe(true);
  });
  it('lists the exact club roster and latest results without sending private club cash', () => {
    const team = world.teams[0]!;
    const profile = queryWorld(world, { type: 'worldClub', teamId: team.id });
    if (profile.kind !== 'club') throw new Error('Wrong reply');
    expect(profile.players.map((p) => p.id).sort()).toEqual(
      world.players
        .filter((p) => p.teamId === team.id && !p.retired)
        .map((p) => p.id)
        .sort(),
    );
    expect(profile).not.toHaveProperty('finance');
    expect(profile).not.toHaveProperty('balance');
    expect(profile.players.every((p) => !('potential' in p))).toBe(true);
    const recent = profile.results[0]!;
    const result = world
      .currentSeason!.competitions.flatMap((c) => c.matches)
      .find((m) => m.id === recent.id)!;
    expect(recent.season).toBe(world.seasonNumber);
    expect(recent.ownScore).toBe(recent.home ? result.homeScore : result.awayScore);
    expect(recent.opponentScore).toBe(recent.home ? result.awayScore : result.homeScore);
  });
  it('rejects invalid queries and unknown IDs while leaving the universe unchanged', () => {
    const before = JSON.stringify(world);
    expect(() => queryWorld(world, search({ page: -1 }))).toThrow(/no válida/);
    expect(() => queryWorld(world, search({ page: NaN }))).toThrow(/no válida/);
    expect(() => queryWorld(world, search({ query: 'x'.repeat(121) }))).toThrow(/no válida/);
    expect(() => queryWorld(world, search({ competitionId: 'missing' }))).toThrow(/no existe/);
    expect(() => queryWorld(world, { type: 'worldPlayer', playerId: 'missing' })).toThrow(
      /no existe/,
    );
    expect(() => queryWorld(world, { type: 'worldClub', teamId: 'missing' })).toThrow(/no existe/);
    queryWorld(world, search());
    queryWorld(world, { type: 'worldPlayer', playerId: world.players[0]!.id });
    expect(JSON.stringify(world)).toBe(before);
    expect(advanceSeason(world).universe).toEqual(advanceSeason(structuredClone(world)).universe);
  });
});
