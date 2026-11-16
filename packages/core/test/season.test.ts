import type { Universe } from '@bm27/schema';
import { parseUniverse } from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildRoundRobin,
  bracketOrder,
  computeStandings,
  generateUniverse,
  hashValue,
  replayMatch,
  simulateSeason,
  startSeason,
  type SeasonOutcome,
} from '../src/index';

let universe: Universe;
let outcome: SeasonOutcome;

beforeAll(() => {
  universe = generateUniverse({ seed: 'season-test' });
  outcome = simulateSeason(universe);
});

describe('universe generator', () => {
  it('is deterministic for a seed and different across seeds', () => {
    expect(hashValue(generateUniverse({ seed: 'season-test' }))).toBe(hashValue(universe));
    expect(hashValue(generateUniverse({ seed: 'other' }))).not.toBe(hashValue(universe));
  });

  it('builds the 4-level pyramid (18 / 18 / 28 / 138 = 202 teams)', () => {
    const sizes = [...universe.competitions]
      .sort((a, b) => a.level - b.level)
      .map((c) => c.teamIds.length);
    expect(sizes).toEqual([18, 18, 28, 138]);
    expect(universe.teams.length).toBe(202);
    expect(new Set(universe.teams.map((t) => t.name)).size).toBe(202);
  });

  it('gives every team 12–15 players and lower levels worse squads', () => {
    const playersById = new Map(universe.players.map((p) => [p.id, p]));
    const teamsById = new Map(universe.teams.map((t) => [t.id, t]));
    const averages: number[] = [];
    for (const competition of [...universe.competitions].sort((a, b) => a.level - b.level)) {
      let sum = 0;
      let count = 0;
      for (const teamId of competition.teamIds) {
        const team = teamsById.get(teamId)!;
        expect(team.playerIds.length).toBeGreaterThanOrEqual(12);
        expect(team.playerIds.length).toBeLessThanOrEqual(15);
        for (const id of team.playerIds) {
          const a = playersById.get(id)!.attributes;
          for (const group of Object.values(a)) {
            for (const value of Object.values(group)) {
              sum += value;
              count++;
            }
          }
        }
      }
      averages.push(sum / count);
    }
    expect(averages[0]!).toBeGreaterThan(averages[1]! + 4);
    expect(averages[1]!).toBeGreaterThan(averages[2]! + 4);
    expect(averages[2]!).toBeGreaterThan(averages[3]! + 4);
  });

  it('passes schema validation', () => {
    expect(() => parseUniverse(universe)).not.toThrow();
  });
});

describe('calendar and standings', () => {
  it('double round robin: everyone plays everyone home and away', () => {
    for (const size of [13, 14, 18]) {
      const ids = Array.from({ length: size }, (_, i) => `t${i}`);
      const fixtures = buildRoundRobin(ids, 2);
      expect(fixtures.length).toBe(size * (size - 1));
      const pairs = new Set(fixtures.map((f) => `${f.homeTeamId}>${f.awayTeamId}`));
      expect(pairs.size).toBe(size * (size - 1));
      // Nobody plays twice on the same matchday.
      const seen = new Set<string>();
      for (const f of fixtures) {
        for (const id of [f.homeTeamId, f.awayTeamId]) {
          const key = `${f.round}:${id}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it('breaks ties by head-to-head, then point difference', () => {
    const match = (id: string, home: string, away: string, hs: number, as: number) => ({
      id,
      seasonNumber: 1,
      competitionId: 'c',
      stage: 'regular' as const,
      round: 1,
      homeTeamId: home,
      awayTeamId: away,
      homeScore: hs,
      awayScore: as,
      overtimePeriods: 0,
    });
    // A and B both finish 3-1; B beat A twice, so B is first despite a worse difference.
    const table = computeStandings(
      ['A', 'B', 'C'],
      [
        match('1', 'A', 'B', 70, 71),
        match('2', 'B', 'A', 80, 79),
        match('3', 'A', 'C', 100, 60),
        match('4', 'C', 'A', 60, 100),
        match('5', 'B', 'C', 70, 69),
        match('6', 'C', 'B', 90, 60),
      ],
    );
    expect(table.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
    expect(table[0]).toMatchObject({ position: 1, wins: 3, losses: 1 });
  });

  it('seeds brackets so 1 and 2 can only meet in the final', () => {
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('season simulation', () => {
  it('same seed ⇒ identical season (same hash)', () => {
    const again = simulateSeason(generateUniverse({ seed: 'season-test' }));
    expect(hashValue(again.season)).toBe(hashValue(outcome.season));
    expect(hashValue(again.universe)).toBe(hashValue(outcome.universe));
  });

  it('does not modify the input universe', () => {
    expect(hashValue(universe)).toBe(hashValue(generateUniverse({ seed: 'season-test' })));
  });

  it('has the expected group structure', () => {
    const [l1, l2, l3, l4] = outcome.season.competitions;
    expect(l1!.groups.map((g) => g.teamIds.length)).toEqual([18]);
    expect(l2!.groups.map((g) => g.teamIds.length)).toEqual([18]);
    expect(l3!.groups.map((g) => g.teamIds.length)).toEqual([14, 14]);
    expect(l4!.groups.length).toBe(10);
    for (const g of l4!.groups) expect([13, 14]).toContain(g.teamIds.length);
    // Level 1: 18 teams × 34 games / 2 = 306 regular matches, 8-team playoff (7 series).
    expect(l1!.matches.filter((m) => m.stage === 'regular').length).toBe(306);
    expect(l1!.playoffSeries.length).toBe(7);
    for (const row of l1!.groups[0]!.standings) expect(row.played).toBe(34);
  });

  it('playoff series are won by whoever reaches the required wins', () => {
    for (const competition of outcome.season.competitions) {
      for (const series of competition.playoffSeries) {
        if (series.lowSeedTeamId === null) continue;
        const needed = Math.floor(series.bestOf / 2) + 1;
        expect(Math.max(series.highSeedWins, series.lowSeedWins)).toBe(needed);
        expect(series.matchIds.length).toBe(series.highSeedWins + series.lowSeedWins);
      }
      expect(new Set(competition.finalRanking).size).toBe(competition.finalRanking.length);
    }
  });

  it('applies promotion and relegation and keeps competition sizes', () => {
    const before = [...universe.competitions].sort((a, b) => a.level - b.level);
    const after = [...outcome.universe.competitions].sort((a, b) => a.level - b.level);
    expect(after.map((c) => c.teamIds.length)).toEqual(before.map((c) => c.teamIds.length));
    const seasons = outcome.season.competitions;
    expect(seasons.map((c) => [c.promotedTeamIds.length, c.relegatedTeamIds.length])).toEqual([
      [0, 2],
      [2, 3],
      [3, 6],
      [6, 0],
    ]);
    for (let i = 0; i < seasons.length; i++) {
      for (const teamId of seasons[i]!.relegatedTeamIds) {
        expect(after[i + 1]!.teamIds).toContain(teamId);
        expect(after[i]!.teamIds).not.toContain(teamId);
      }
      for (const teamId of seasons[i]!.promotedTeamIds) {
        expect(after[i - 1]!.teamIds).toContain(teamId);
      }
    }
    const all = after.flatMap((c) => c.teamIds);
    expect(new Set(all).size).toBe(202);
  });

  it('ages players and stays valid over several seasons', () => {
    let current = outcome.universe;
    for (let i = 0; i < 3; i++) current = simulateSeason(current).universe;
    expect(current.seasonNumber).toBe(5);
    expect(current.history.length).toBe(4);
    expect(() => parseUniverse(current)).not.toThrow();
    // Squads are completed when the market closes, at the start of the next season.
    for (const team of startSeason(current).teams) {
      expect(team.playerIds.length).toBeGreaterThanOrEqual(12);
      expect(team.playerIds.length).toBeLessThanOrEqual(15);
    }
    const original = new Map(universe.players.map((p) => [p.id, p]));
    const survivor = current.players.find((p) => !p.retired && original.has(p.id))!;
    expect(survivor.age).toBe(original.get(survivor.id)!.age + 4);
  });

  it('any match can be replayed from its seed with the same result', () => {
    for (const competition of outcome.season.competitions) {
      const sample = [
        competition.matches[0]!,
        competition.matches[competition.matches.length - 1]!,
      ];
      for (const result of sample) {
        const detail = replayMatch(universe, result);
        expect(detail.boxScore.home.points).toBe(result.homeScore);
        expect(detail.boxScore.away.points).toBe(result.awayScore);
        expect(detail.events.length).toBeGreaterThan(100);
      }
    }
  });
});
