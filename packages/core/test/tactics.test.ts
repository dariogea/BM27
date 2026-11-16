import type { TeamBoxScore, TeamTactics } from '@bm27/schema';
import { describe, expect, it } from 'vitest';
import { getBuiltinRuleset, playMatch } from '../src/index';
import { makeTestTeam } from './helpers';

/**
 * Pillar 1 — "tactics with verifiable effect". Every tactical option must move
 * the statistics it is supposed to move. Each experiment plays the same two
 * squads many times; only team A's tactics change between experiments.
 */
const fiba = getBuiltinRuleset('fiba');
const GAMES = 500;

interface Experiment {
  /** Averages per game for the team whose tactics we change. */
  own: Record<string, number>;
  /** Averages per game for its opponent (always default tactics). */
  opp: Record<string, number>;
}

function experiment(tactics: Partial<TeamTactics>): Experiment {
  const a = makeTestTeam('A', 70, 'tactics-squad', tactics);
  const b = makeTestTeam('B', 70, 'tactics-squad');
  const own: Record<string, number> = {};
  const opp: Record<string, number> = {};
  const add = (target: Record<string, number>, key: string, value: number): void => {
    target[key] = (target[key] ?? 0) + value / GAMES;
  };
  const addBox = (target: Record<string, number>, box: TeamBoxScore): void => {
    const s = box.totals;
    add(target, 'possessions', box.possessions);
    add(target, 'points', box.points);
    add(target, 'fga', s.fieldGoalsAttempted);
    add(target, 'tpa', s.threePointersAttempted);
    add(target, 'fta', s.freeThrowsAttempted);
    add(target, 'orb', s.offensiveRebounds);
    add(target, 'turnovers', s.turnovers);
    add(target, 'fouls', s.fouls);
    add(target, 'steals', s.steals);
    add(target, 'playersUsed', box.players.filter((p) => p.seconds > 0).length);
  };
  for (let i = 0; i < GAMES; i++) {
    const aHome = i % 2 === 0;
    const match = aHome ? playMatch(a, b, fiba, `tac-${i}`) : playMatch(b, a, fiba, `tac-${i}`);
    addBox(own, aHome ? match.boxScore.home : match.boxScore.away);
    addBox(opp, aHome ? match.boxScore.away : match.boxScore.home);
    for (const event of match.events) {
      if (event.type !== 'shot') continue;
      const target = event.offenseTeamId === 'A' ? own : opp;
      if (event.zone === 'midrange') add(target, 'midrangeShots', 1);
      if (event.zone === 'restricted' || event.zone === 'paint') add(target, 'insideShots', 1);
      if (event.playType === 'transition') add(target, 'transitionPoints', event.points);
      if (event.playType === 'post-up') add(target, 'postUpShots', 1);
    }
  }
  return { own, opp };
}

const threeRate = (r: Record<string, number>): number => r.tpa! / r.fga!;

describe('tactics have a verifiable effect', () => {
  it('pace: fast teams play more possessions than slow teams', () => {
    const fast = experiment({ pace: 'fast' });
    const slow = experiment({ pace: 'slow' });
    expect(fast.own.possessions!).toBeGreaterThan(slow.own.possessions! + 5);
    expect(fast.own.transitionPoints!).toBeGreaterThan(slow.own.transitionPoints! + 1);
  });

  it('offensive focus: perimeter shoots more threes; inside posts up and draws more fouls', () => {
    const inside = experiment({ offenseFocus: 'inside' });
    const perimeter = experiment({ offenseFocus: 'perimeter' });
    expect(threeRate(perimeter.own)).toBeGreaterThan(threeRate(inside.own) + 0.15);
    expect(inside.own.postUpShots!).toBeGreaterThan(perimeter.own.postUpShots! * 2);
    expect(inside.own.fta!).toBeGreaterThan(perimeter.own.fta! + 2);
  });

  it('zone defense: protects the paint and fouls less, but gives up threes', () => {
    const man = experiment({ defenseScheme: 'man' });
    const zone = experiment({ defenseScheme: 'zone' });
    expect(threeRate(zone.opp)).toBeGreaterThan(threeRate(man.opp) + 0.025);
    expect(zone.opp.insideShots!).toBeLessThan(man.opp.insideShots! - 1);
    expect(zone.own.fouls!).toBeLessThan(man.own.fouls! - 1.5);
    expect(zone.opp.fta!).toBeLessThan(man.opp.fta! - 2);
  });

  it('pick-and-roll coverage: drop concedes mid-range shots; blitz forces turnovers', () => {
    const drop = experiment({ pickAndRollCoverage: 'drop' });
    const blitz = experiment({ pickAndRollCoverage: 'blitz' });
    expect(drop.opp.midrangeShots!).toBeGreaterThan(blitz.opp.midrangeShots! + 1.2);
    expect(blitz.opp.turnovers!).toBeGreaterThan(drop.opp.turnovers! + 0.5);
    expect(threeRate(blitz.opp)).toBeGreaterThan(threeRate(drop.opp));
  });

  it('pressure: high pressure forces turnovers at the price of fouls', () => {
    const high = experiment({ pressure: 'high' });
    const low = experiment({ pressure: 'low' });
    expect(high.opp.turnovers!).toBeGreaterThan(low.opp.turnovers! + 2);
    expect(high.own.steals!).toBeGreaterThan(low.own.steals! + 1);
    expect(high.own.fouls!).toBeGreaterThan(low.own.fouls! + 3);
    expect(high.opp.fta!).toBeGreaterThan(low.opp.fta! + 3);
  });

  it('offensive rebounding: crashing wins boards but concedes fast breaks', () => {
    const crash = experiment({ offensiveRebounding: 'crash' });
    const back = experiment({ offensiveRebounding: 'get-back' });
    expect(crash.own.orb!).toBeGreaterThan(back.own.orb! + 2);
    expect(crash.opp.transitionPoints!).toBeGreaterThan(back.opp.transitionPoints! + 2);
  });

  it('rotation depth: a short rotation uses fewer players', () => {
    const short = experiment({ rotationDepth: 8 });
    const deep = experiment({ rotationDepth: 11 });
    expect(deep.own.playersUsed!).toBeGreaterThan(short.own.playersUsed! + 1.5);
  });

  it('no single tactic is overpowered for an average squad', () => {
    // Guards against a "dominant strategy": each option must stay within a
    // small margin of the default when both squads are identical.
    const options: Partial<TeamTactics>[] = [
      { pace: 'fast' },
      { offenseFocus: 'perimeter' },
      { defenseScheme: 'zone' },
      { pickAndRollCoverage: 'switch' },
      { pressure: 'high' },
      { offensiveRebounding: 'crash' },
    ];
    for (const tactics of options) {
      const result = experiment(tactics);
      const margin = result.own.points! - result.opp.points!;
      expect(Math.abs(margin), JSON.stringify(tactics)).toBeLessThan(3);
    }
  });
});
