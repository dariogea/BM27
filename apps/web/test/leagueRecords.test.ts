import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceSeason,
  generateUniverseFromDataPack,
  simulateSeason,
  startSeason,
} from '@bm27/core';
import type { Universe } from '@bm27/schema';
import sample from '../../../data/packs/example-eight-clubs.json';
import { queryLeagueRecords } from '../src/leagueRecordsData';
import { queryWorld } from '../src/worldData';
import { LEADER_METRICS, type LeagueRecordsQuery } from '../src/leagueRecordsTypes';

let world: Universe;
beforeAll(() => {
  world = simulateSeason(generateUniverseFromDataPack(sample, 'league-records')).universe;
});
const query = (extra: Partial<LeagueRecordsQuery> = {}): LeagueRecordsQuery => ({
  type: 'worldRecords',
  competitionId: sample.config.levels[0]!.competitionId,
  season: 0,
  metric: 'points',
  mode: 'average',
  minGames: 1,
  minAttempts: 0,
  ...extra,
});
describe('recorded league leaders and honours', () => {
  it('calculates every metric from the actual completed season, including shooting denominators', () => {
    const stats = world.history[0]!.competitions[0]!.playerStats;
    for (const metric of Object.keys(LEADER_METRICS) as LeagueRecordsQuery['metric'][]) {
      const result = queryLeagueRecords(world, query({ metric }));
      const expected = stats
        .filter((s) => s.games > 0)
        .flatMap((s) => {
          let numerator: number, denominator: number;
          switch (metric) {
            case 'rebounds':
              numerator = s.offensiveRebounds + s.defensiveRebounds;
              denominator = s.games;
              break;
            case 'fieldGoalPercent':
              numerator = s.fieldGoalsMade;
              denominator = s.fieldGoalsAttempted;
              break;
            case 'threePointPercent':
              numerator = s.threePointersMade;
              denominator = s.threePointersAttempted;
              break;
            case 'freeThrowPercent':
              numerator = s.freeThrowsMade;
              denominator = s.freeThrowsAttempted;
              break;
            default:
              numerator = s[metric];
              denominator = s.games;
          }
          return denominator > 0
            ? [
                {
                  id: s.playerId,
                  club: s.teamId,
                  value: (numerator / denominator) * (metric.endsWith('Percent') ? 100 : 1),
                },
              ]
            : [];
        })
        .sort(
          (a, b) => b.value - a.value || a.id.localeCompare(b.id) || a.club.localeCompare(b.club),
        );
      expect(result.total).toBe(expected.length);
      expect(result.rows.map((r) => ({ id: r.playerId, club: r.teamId, value: r.value }))).toEqual(
        expected.slice(0, 50),
      );
      expect(result.completed).toBe(true);
    }
  });
  it('normalizes counting stats by actual playing seconds and applies the minutes minimum', () => {
    const before = JSON.stringify(world);
    for (const metric of ['points', 'rebounds', 'assists', 'steals', 'blocks'] as const) {
      const result = queryLeagueRecords(world, query({ metric, mode: 'per40', minMinutes: 100 }));
      const stats = world.history[0]!.competitions[0]!.playerStats;
      for (const row of result.rows) {
        const actual = stats.find((s) => s.playerId === row.playerId && s.teamId === row.teamId)!;
        const amount =
          metric === 'rebounds'
            ? actual.offensiveRebounds + actual.defensiveRebounds
            : actual[metric];
        expect(actual.seconds).toBeGreaterThanOrEqual(6000);
        expect(row.value).toBeCloseTo((amount * 2400) / actual.seconds, 10);
        expect(row.denominator).toBe(actual.seconds);
      }
      expect(result.rows.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(world)).toBe(before);
  });
  it('excludes zero playing time and keeps shooting percentage units independent of per40 mode', () => {
    const altered = structuredClone(world);
    const stats = altered.history[0]!.competitions[0]!.playerStats.slice(0, 3);
    stats.forEach((s, i) => {
      s.games = 2;
      s.seconds = i * 600;
      s.points = 10;
      s.freeThrowsMade = 1;
      s.freeThrowsAttempted = 2;
    });
    altered.history[0]!.competitions[0]!.playerStats = stats;
    const result = queryLeagueRecords(altered, query({ mode: 'per40', minMinutes: 11 }));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.value).toBe(20);
    expect(queryLeagueRecords(altered, query({ mode: 'per40' })).rows).toHaveLength(2);
    const percentages = queryLeagueRecords(
      altered,
      query({ metric: 'freeThrowPercent', mode: 'per40' }),
    );
    expect(percentages.rows.every((row) => row.value === 50)).toBe(true);
    expect(() => queryLeagueRecords(altered, query({ minMinutes: -1 }))).toThrow('Filtros');
    expect(() => queryLeagueRecords(altered, query({ minMinutes: NaN }))).toThrow('Filtros');
  });
  it('uses totals when selected and preserves the statistical club after a player changes membership', () => {
    const altered = structuredClone(world);
    const stats = altered.history[0]!.competitions[0]!.playerStats;
    const leader = [...stats].sort((a, b) => b.points - a.points)[0]!;
    altered.players.find((p) => p.id === leader.playerId)!.teamId = null;
    const result = queryLeagueRecords(altered, query({ mode: 'total' }));
    expect(result.rows[0]).toMatchObject({
      playerId: leader.playerId,
      teamId: leader.teamId,
      value: leader.points,
      numerator: leader.points,
      denominator: 1,
    });
  });
  it('filters small samples and zero attempts and gives tied exact values the same rank', () => {
    const altered = structuredClone(world);
    const stats = altered.history[0]!.competitions[0]!.playerStats.slice(0, 4);
    stats.forEach((s, i) => {
      s.games = i === 3 ? 0 : 2;
      s.points = i < 2 ? 20 : 10;
      s.freeThrowsMade = i === 2 ? 0 : 1;
      s.freeThrowsAttempted = i === 2 ? 0 : 2;
    });
    altered.history[0]!.competitions[0]!.playerStats = stats;
    const ties = queryLeagueRecords(altered, query());
    expect(ties.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(queryLeagueRecords(altered, query({ minGames: 3 })).rows).toEqual([]);
    const percentages = queryLeagueRecords(altered, query({ metric: 'freeThrowPercent' }));
    expect(percentages.rows).toHaveLength(2);
    expect(percentages.rows.every((r) => r.value === 50)).toBe(true);
    expect(
      queryLeagueRecords(altered, query({ metric: 'freeThrowPercent', minAttempts: 3 })).rows,
    ).toEqual([]);
  });
  it('keeps current statistics separate from past seasons and never invents a current champion', () => {
    const current = advanceSeason(startSeason(world)).universe;
    const latest = queryLeagueRecords(current, query());
    expect(latest.season).toBe(2);
    expect(latest.completed).toBe(false);
    expect(latest.seasons).toEqual([2, 1]);
    expect(latest.honours.map((h) => h.season)).toEqual([1]);
    const recorded = world.history[0]!.competitions[0]!;
    expect(latest.honours[0]).toMatchObject({
      champion: { id: recorded.championTeamId },
      promoted: recorded.promotedTeamIds.map((id) => expect.objectContaining({ id })),
      relegated: recorded.relegatedTeamIds.map((id) => expect.objectContaining({ id })),
    });
    expect(queryLeagueRecords(current, query({ season: 1 })).rows).toEqual(
      queryLeagueRecords(world, query({ season: 1 })).rows,
    );
  });
  it('handles an unplayed universe without fabricated leaders or honours', () => {
    const initial = generateUniverseFromDataPack(sample, 'empty-leaders');
    expect(queryLeagueRecords(initial, query())).toMatchObject({
      season: 1,
      total: 0,
      rows: [],
      honours: [],
      completed: false,
    });
  });
  it('routes through world queries, rejects malformed filters and never changes the saved state', () => {
    const before = JSON.stringify(world);
    expect(queryWorld(world, query())).toEqual(queryLeagueRecords(world, query()));
    for (const bad of [
      { minGames: -1 },
      { minAttempts: NaN },
      { season: 0.5 },
      { season: 999 },
      { competitionId: 'missing' },
      { metric: '__proto__' },
    ])
      expect(() => queryLeagueRecords(world, query(bad as Partial<LeagueRecordsQuery>))).toThrow();
    expect(JSON.stringify(world)).toBe(before);
  });
});
