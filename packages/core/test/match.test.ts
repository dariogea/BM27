import { MatchEventSchema, type Ruleset } from '@bm27/schema';
import { describe, expect, it } from 'vitest';
import { getBuiltinRuleset, hashValue, playMatch, simulateMatch } from '../src/index';
import { makeTestTeam } from './helpers';

const fiba = getBuiltinRuleset('fiba');
const nbaLike = getBuiltinRuleset('nba-like');
const teamA = makeTestTeam('A', 70, 'team-a');
const teamB = makeTestTeam('B', 70, 'team-b');

describe('match determinism', () => {
  it('same seed ⇒ identical event log (same hash)', () => {
    const first = simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: 'm1' });
    const second = simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: 'm1' });
    expect(hashValue(second)).toBe(hashValue(first));
  });

  it('different seed ⇒ different match', () => {
    const first = simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: 'm1' });
    const second = simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: 'm2' });
    expect(hashValue(second)).not.toBe(hashValue(first));
  });
});

describe('event log', () => {
  it('every event is valid against the schema and ordered', () => {
    const events = simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: 'schema' });
    events.forEach((event, index) => {
      expect(() => MatchEventSchema.parse(event)).not.toThrow();
      expect(event.seq).toBe(index);
    });
    expect(events[0]?.type).toBe('period_start');
    expect(events[events.length - 1]?.type).toBe('game_end');
  });
});

describe.each<[string, Ruleset]>([
  ['fiba', fiba],
  ['nba-like', nbaLike],
])('box score coherence (%s)', (_name, ruleset) => {
  it('holds over 300 matches', () => {
    let overtimeGames = 0;
    for (let i = 0; i < 300; i++) {
      const { boxScore, overtimePeriods, events } = playMatch(teamA, teamB, ruleset, `box-${i}`);
      if (overtimePeriods > 0) overtimeGames++;
      const gameSeconds =
        ruleset.periods * ruleset.periodMinutes * 60 +
        overtimePeriods * ruleset.overtimeMinutes * 60;

      expect(boxScore.home.points).not.toBe(boxScore.away.points); // never a draw

      for (const team of [boxScore.home, boxScore.away]) {
        const sum = (pick: (l: (typeof team.players)[number]) => number): number =>
          team.players.reduce((total, line) => total + pick(line), 0);

        // Player points add up to team points, and to the per-period points.
        expect(sum((l) => l.points)).toBe(team.points);
        expect(team.periodPoints.reduce((a, b) => a + b, 0)).toBe(team.points);
        expect(team.periodPoints.length).toBe(ruleset.periods + overtimePeriods);
        // Minutes: exactly five players on court at all times.
        expect(sum((l) => l.seconds)).toBe(gameSeconds * 5);

        for (const line of team.players) {
          expect(line.fieldGoalsMade).toBeLessThanOrEqual(line.fieldGoalsAttempted);
          expect(line.threePointersMade).toBeLessThanOrEqual(line.threePointersAttempted);
          expect(line.threePointersMade).toBeLessThanOrEqual(line.fieldGoalsMade);
          expect(line.threePointersAttempted).toBeLessThanOrEqual(line.fieldGoalsAttempted);
          expect(line.freeThrowsMade).toBeLessThanOrEqual(line.freeThrowsAttempted);
          expect(line.points).toBe(
            2 * line.fieldGoalsMade + line.threePointersMade + line.freeThrowsMade,
          );
          expect(line.seconds).toBeLessThanOrEqual(gameSeconds);
          expect(line.fouls).toBeLessThanOrEqual(ruleset.personalFoulLimit);
          if (line.seconds === 0) expect(line.points + line.fieldGoalsAttempted).toBe(0);
        }
        expect(team.players.filter((l) => l.starter).length).toBe(5);
      }

      // Cross-team consistency.
      const { home, away } = boxScore;
      expect(home.totals.steals).toBeLessThanOrEqual(away.totals.turnovers);
      expect(away.totals.steals).toBeLessThanOrEqual(home.totals.turnovers);
      expect(home.totals.assists).toBeLessThanOrEqual(home.totals.fieldGoalsMade);
      expect(Math.abs(home.possessions - away.possessions)).toBeLessThanOrEqual(
        2 * (ruleset.periods + overtimePeriods),
      );
      expect(events.filter((e) => e.type === 'period_start').length).toBe(
        ruleset.periods + overtimePeriods,
      );
    }
    // Overtime must actually happen sometimes, otherwise it is not being tested.
    expect(overtimeGames).toBeGreaterThan(0);
  });
});

describe('sensitivity: attributes matter', () => {
  it('a clearly better team wins clearly more over 1,000 matches', () => {
    const strong = makeTestTeam('S', 72, 'strong');
    const weak = makeTestTeam('W', 62, 'weak');
    let strongWins = 0;
    let margin = 0;
    for (let i = 0; i < 1000; i++) {
      // Alternate home court so that home advantage cancels out.
      const strongHome = i % 2 === 0;
      const { boxScore } = strongHome
        ? playMatch(strong, weak, fiba, `sens-${i}`)
        : playMatch(weak, strong, fiba, `sens-${i}`);
      const strongBox = strongHome ? boxScore.home : boxScore.away;
      const weakBox = strongHome ? boxScore.away : boxScore.home;
      if (strongBox.points > weakBox.points) strongWins++;
      margin += strongBox.points - weakBox.points;
    }
    expect(strongWins).toBeGreaterThan(750);
    expect(margin / 1000).toBeGreaterThan(5);
  });

  it('two equal teams split wins roughly evenly', () => {
    const twin = makeTestTeam('A2', 70, 'team-a'); // same seed ⇒ same attributes as teamA
    let wins = 0;
    for (let i = 0; i < 1000; i++) {
      const aHome = i % 2 === 0;
      const { boxScore } = aHome
        ? playMatch(teamA, twin, fiba, `even-${i}`)
        : playMatch(twin, teamA, fiba, `even-${i}`);
      const a = aHome ? boxScore.home : boxScore.away;
      const b = aHome ? boxScore.away : boxScore.home;
      if (a.points > b.points) wins++;
    }
    expect(wins).toBeGreaterThan(430);
    expect(wins).toBeLessThan(570);
  });
});

/**
 * PROVISIONAL plausibility ranges (documented in docs/benchmarks/T-001.md).
 * They are wide on purpose: the engine is a PLACEHOLDER. Reference values are
 * approximate public averages of top European FIBA-rules leagues in recent
 * seasons (about 78–86 points and 70–75 possessions per team per 40 minutes).
 * They come from general knowledge, not from a verified dataset.
 */
describe('provisional plausibility (FIBA rules, top-level quality)', () => {
  it('averages fall inside reasonable professional ranges', () => {
    const games = 500;
    const total = {
      points: 0,
      possessions: 0,
      fga: 0,
      fgm: 0,
      tpa: 0,
      tpm: 0,
      fta: 0,
      tov: 0,
      reb: 0,
    };
    for (let i = 0; i < games; i++) {
      const { boxScore } = playMatch(teamA, teamB, fiba, `plaus-${i}`);
      for (const team of [boxScore.home, boxScore.away]) {
        total.points += team.points;
        total.possessions += team.possessions;
        total.fga += team.totals.fieldGoalsAttempted;
        total.fgm += team.totals.fieldGoalsMade;
        total.tpa += team.totals.threePointersAttempted;
        total.tpm += team.totals.threePointersMade;
        total.fta += team.totals.freeThrowsAttempted;
        total.tov += team.totals.turnovers;
        total.reb += team.totals.offensiveRebounds + team.totals.defensiveRebounds;
      }
    }
    const perTeam = (value: number): number => value / (games * 2);
    expect(perTeam(total.points)).toBeGreaterThan(70);
    expect(perTeam(total.points)).toBeLessThan(92);
    expect(perTeam(total.possessions)).toBeGreaterThan(66);
    expect(perTeam(total.possessions)).toBeLessThan(78);
    expect(total.fgm / total.fga).toBeGreaterThan(0.42);
    expect(total.fgm / total.fga).toBeLessThan(0.52);
    expect(total.tpm / total.tpa).toBeGreaterThan(0.3);
    expect(total.tpm / total.tpa).toBeLessThan(0.42);
    expect(perTeam(total.fta)).toBeGreaterThan(10);
    expect(perTeam(total.fta)).toBeLessThan(26);
    expect(perTeam(total.tov)).toBeGreaterThan(9);
    expect(perTeam(total.tov)).toBeLessThan(17);
    expect(perTeam(total.reb)).toBeGreaterThan(28);
    expect(perTeam(total.reb)).toBeLessThan(42);
  });

  it('a longer game (nba-like, 4x12) produces proportionally more points', () => {
    let fibaPoints = 0;
    let nbaPoints = 0;
    for (let i = 0; i < 200; i++) {
      const f = playMatch(teamA, teamB, fiba, `len-${i}`).boxScore;
      const n = playMatch(teamA, teamB, nbaLike, `len-${i}`).boxScore;
      fibaPoints += f.home.points + f.away.points;
      nbaPoints += n.home.points + n.away.points;
    }
    const ratio = nbaPoints / fibaPoints;
    expect(ratio).toBeGreaterThan(1.12);
    expect(ratio).toBeLessThan(1.28);
  });
});
