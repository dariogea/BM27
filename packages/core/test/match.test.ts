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

  it('shots carry a play type, a zone and a location inside the half court', () => {
    const playTypes = new Set<string>();
    const zones = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (const event of simulateMatch({
        home: teamA,
        away: teamB,
        ruleset: fiba,
        seed: `loc-${i}`,
      })) {
        if (event.type !== 'shot') continue;
        playTypes.add(event.playType);
        zones.add(event.zone);
        expect(event.x).toBeGreaterThanOrEqual(0);
        expect(event.x).toBeLessThanOrEqual(15);
        expect(event.y).toBeGreaterThanOrEqual(0);
        expect(event.y).toBeLessThanOrEqual(14);
        const distance = Math.hypot(event.x - 7.5, event.y - 1.575);
        if (event.zone === 'restricted') expect(distance).toBeLessThanOrEqual(1.3);
        if (event.zone === 'above-break3') expect(distance).toBeGreaterThanOrEqual(6.75);
        expect(event.shotType === 'three').toBe(event.zone.endsWith('3'));
        expect(event.points).toBe(event.made ? (event.shotType === 'three' ? 3 : 2) : 0);
      }
    }
    expect(playTypes.size).toBe(8); // every play type appears
    expect(zones.size).toBe(5);
  });

  it('substitutions only happen while the ball is dead', () => {
    const events = simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: 'subs' });
    let subs = 0;
    events.forEach((event, index) => {
      if (event.type !== 'substitution') return;
      subs++;
      // Walk back over other substitutions to the event that stopped play.
      let k = index - 1;
      while (events[k]?.type === 'substitution') k--;
      const before = events[k]!;
      const dead =
        before.type === 'foul' ||
        before.type === 'period_start' ||
        (before.type === 'turnover' && before.stealPlayerId === undefined);
      expect(dead, `substitution after a live "${before.type}"`).toBe(true);
    });
    expect(subs).toBeGreaterThan(10);
  });

  it('trailing teams foul on purpose at the end of close games', () => {
    let intentional = 0;
    for (let i = 0; i < 200; i++) {
      for (const event of simulateMatch({
        home: teamA,
        away: teamB,
        ruleset: fiba,
        seed: `late-${i}`,
      })) {
        if (event.type !== 'foul' || !event.intentional) continue;
        intentional++;
        expect(event.period).toBeGreaterThanOrEqual(fiba.periods);
        expect(event.clock).toBeLessThanOrEqual(35);
        expect(event.teamId).not.toBe(event.offenseTeamId); // the defense fouls
      }
    }
    expect(intentional).toBeGreaterThan(20);
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
      expect(home.totals.blocks).toBeLessThanOrEqual(
        away.totals.fieldGoalsAttempted - away.totals.fieldGoalsMade,
      );
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
 * Plausibility bands. Reference: APPROXIMATE averages of top European
 * FIBA-rules leagues in recent seasons (per team, per 40 minutes). They come
 * from general knowledge, not from a verified dataset; see
 * docs/benchmarks/T-002-calibracion.md for the full calibration report.
 */
describe('plausibility (FIBA rules, top-level quality)', () => {
  it('averages fall inside professional reference bands', () => {
    const games = 600;
    const t = {
      pts: 0,
      poss: 0,
      fga: 0,
      fgm: 0,
      tpa: 0,
      tpm: 0,
      fta: 0,
      ftm: 0,
      tov: 0,
      orb: 0,
      drb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      pf: 0,
    };
    for (let i = 0; i < games; i++) {
      const { boxScore } = playMatch(teamA, teamB, fiba, `plaus-${i}`);
      for (const team of [boxScore.home, boxScore.away]) {
        const s = team.totals;
        t.pts += team.points;
        t.poss += team.possessions;
        t.fga += s.fieldGoalsAttempted;
        t.fgm += s.fieldGoalsMade;
        t.tpa += s.threePointersAttempted;
        t.tpm += s.threePointersMade;
        t.fta += s.freeThrowsAttempted;
        t.ftm += s.freeThrowsMade;
        t.tov += s.turnovers;
        t.orb += s.offensiveRebounds;
        t.drb += s.defensiveRebounds;
        t.ast += s.assists;
        t.stl += s.steals;
        t.blk += s.blocks;
        t.pf += s.fouls;
      }
    }
    const perTeam = (value: number): number => value / (games * 2);
    const within = (value: number, low: number, high: number): void => {
      expect(value).toBeGreaterThanOrEqual(low);
      expect(value).toBeLessThanOrEqual(high);
    };
    within(perTeam(t.poss), 69, 75);
    within(perTeam(t.pts), 75, 88);
    within(t.fgm / t.fga, 0.44, 0.49);
    within(t.tpm / t.tpa, 0.335, 0.385);
    within(t.tpa / t.fga, 0.36, 0.46);
    within(perTeam(t.fta), 15, 21);
    within(t.ftm / t.fta, 0.72, 0.8);
    within(t.orb / (t.orb + t.drb), 0.26, 0.32);
    within(perTeam(t.ast), 15.5, 21);
    within(perTeam(t.stl), 5.5, 8);
    within(perTeam(t.blk), 2, 3.6);
    within(perTeam(t.tov), 11.5, 14.5);
    within(perTeam(t.pf), 17.5, 22);
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
