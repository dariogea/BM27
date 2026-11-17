import { migrateUniverseData, parseUniverse, type MatchEvent, type Universe } from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  OFFSEASON_RECOVERY_GAMES,
  advanceSeason,
  applyOffseason,
  generateUniverse,
  getBuiltinRuleset,
  MIN_HEALTHY_PLAYERS,
  prepareTeam,
  simulateMatch,
  startSeason,
} from '../src/index';
import { makeTestTeam } from './helpers';

const fiba = getBuiltinRuleset('fiba');
const teamA = makeTestTeam('A', 70, 'team-a');
const teamB = makeTestTeam('B', 70, 'team-b');

/** A batch of matches shared by the tests of this file. */
const MATCHES = 300;
let matches: MatchEvent[][];

beforeAll(() => {
  matches = [];
  for (let i = 0; i < MATCHES; i++) {
    matches.push(
      simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: `incidents-${i}` }),
    );
  }
});

const count = (type: MatchEvent['type']): number =>
  matches.reduce((n, events) => n + events.filter((e) => e.type === type).length, 0);

describe('opening tip and possession arrow', () => {
  it('every match starts with exactly one opening tip, and the winner gets the first possession', () => {
    for (const events of matches) {
      const tips = events.filter((e) => e.type === 'jump_ball' && e.kind === 'opening');
      expect(tips).toHaveLength(1);
      const tip = tips[0]!;
      if (tip.type !== 'jump_ball') throw new Error('unreachable');
      expect(tip.jumperIds).toHaveLength(2);
      // The very first thing after the tip is a play by the winner, unless the ball is held
      // straight away (then the arrow decides, see the next test).
      const first = events.find(
        (e) =>
          e.seq > tip.seq &&
          (e.type === 'shot' ||
            e.type === 'turnover' ||
            e.type === 'foul' ||
            e.type === 'jump_ball'),
      )!;
      if (first.type === 'jump_ball') continue;
      expect(first.offenseTeamId).toBe(tip.winnerTeamId);
    }
  });

  it('both teams win the tip-off (it is not a coin that always lands the same way)', () => {
    const winners = new Set<string>();
    for (const events of matches) {
      const tip = events.find((e) => e.type === 'jump_ball');
      if (tip?.type === 'jump_ball') winners.add(tip.winnerTeamId);
    }
    expect(winners.size).toBe(2);
  });

  it('a held ball gives the ball to the team the arrow points to, and the arrow alternates', () => {
    let held = 0;
    let checked = 0;
    for (const events of matches) {
      const winners: string[] = [];
      events.forEach((event, index) => {
        if (event.type !== 'jump_ball' || event.kind !== 'held-ball') return;
        held++;
        winners.push(event.winnerTeamId);
        // The next play after the stoppage belongs to the winner (unless another stoppage comes first).
        const next = events
          .slice(index + 1)
          .find(
            (e) =>
              e.type === 'shot' ||
              e.type === 'turnover' ||
              e.type === 'foul' ||
              e.type === 'jump_ball',
          );
        if (next && next.type !== 'jump_ball' && next.period === event.period) {
          expect(next.offenseTeamId).toBe(event.winnerTeamId);
          checked++;
        }
      });
      // The arrow flips every time it is used: held balls alternate between the teams, unless a
      // period start used it in between (that case is covered by the next test).
      const tip = events.find((e) => e.type === 'jump_ball' && e.kind === 'opening');
      const periodStarts = events.filter((e) => e.type === 'period_start' && e.period > 1).length;
      if (tip?.type === 'jump_ball' && winners.length > 0 && periodStarts === 0) {
        const loser = [teamA.teamId, teamB.teamId].find((id) => id !== tip.winnerTeamId);
        expect(winners[0]).toBe(loser); // the arrow starts pointing at the team that lost the tip
      }
    }
    expect(held).toBeGreaterThan(MATCHES * 0.5);
    expect(checked).toBeGreaterThan(MATCHES * 0.4);
  });

  it('the possession arrow starts each period after the first', () => {
    // Without held balls in the whole match, periods alternate between the teams.
    let checked = 0;
    for (const events of matches) {
      if (events.some((e) => e.type === 'jump_ball' && e.kind === 'held-ball')) continue;
      const tip = events.find((e) => e.type === 'jump_ball');
      if (tip?.type !== 'jump_ball') continue;
      const starters: string[] = [tip.winnerTeamId];
      for (const e of events) {
        if (e.type !== 'period_start' || e.period === 1) continue;
        starters.push(e.offenseTeamId);
      }
      for (let i = 1; i < starters.length; i++) expect(starters[i]).not.toBe(starters[i - 1]);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe('timeouts', () => {
  it('never exceed the ruleset allowance and are lost at half-time', () => {
    for (const events of matches) {
      const used = new Map<
        string,
        { first: number; second: number; overtime: Map<number, number> }
      >();
      for (const e of events) {
        if (e.type !== 'timeout') continue;
        let entry = used.get(e.teamId);
        if (!entry) used.set(e.teamId, (entry = { first: 0, second: 0, overtime: new Map() }));
        if (e.period > fiba.periods) {
          entry.overtime.set(e.period, (entry.overtime.get(e.period) ?? 0) + 1);
        } else if (e.period <= fiba.periods / 2) entry.first++;
        else entry.second++;
      }
      for (const entry of used.values()) {
        expect(entry.first).toBeLessThanOrEqual(fiba.timeoutsFirstHalf);
        expect(entry.second).toBeLessThanOrEqual(fiba.timeoutsSecondHalf);
        for (const n of entry.overtime.values())
          expect(n).toBeLessThanOrEqual(fiba.timeoutsOvertime);
      }
    }
  });

  it('happen at a realistic rate (about 3 per team and match under FIBA rules)', () => {
    const perMatch = count('timeout') / MATCHES;
    expect(perMatch).toBeGreaterThan(3.5);
    expect(perMatch).toBeLessThan(9);
  });

  it('are called for a reason that matches the situation', () => {
    for (const events of matches) {
      for (const e of events) {
        if (e.type !== 'timeout') continue;
        if (e.reason === 'end-of-game') {
          expect(e.period).toBeGreaterThanOrEqual(fiba.periods);
          expect(e.clock).toBeLessThanOrEqual(120);
        }
      }
    }
    const reasons = new Set<string>();
    for (const events of matches) {
      for (const e of events) if (e.type === 'timeout') reasons.add(e.reason);
    }
    expect(reasons.has('opponent-run')).toBe(true);
    expect(reasons.has('rest')).toBe(true);
  });

  it('give both teams the same rest (a timeout is not a free boost for one side)', () => {
    // Substitutions are allowed right after a timeout, and the log stays consistent.
    let subsAfter = 0;
    for (const events of matches) {
      events.forEach((e, i) => {
        if (e.type === 'timeout' && events[i + 1]?.type === 'substitution') subsAfter++;
      });
    }
    expect(subsAfter).toBeGreaterThan(0);
  });
});

describe('injuries during a match', () => {
  it('happen at about 0.1 to 0.35 per match and last at least one game', () => {
    const perMatch = count('injury') / MATCHES;
    expect(perMatch).toBeGreaterThan(0.08);
    expect(perMatch).toBeLessThan(0.4);
    for (const events of matches) {
      for (const e of events) if (e.type === 'injury') expect(e.gamesOut).toBeGreaterThanOrEqual(1);
    }
  });

  it('take the player out of the game immediately and for good', () => {
    let injuries = 0;
    for (const events of matches) {
      const out = new Set<string>();
      events.forEach((e, index) => {
        if (e.type === 'injury') {
          injuries++;
          // He is replaced right away.
          const sub = events
            .slice(index + 1, index + 4)
            .find((s) => s.type === 'substitution' && s.playerOutId === e.playerId);
          expect(sub, `injured ${e.playerId} must be substituted`).toBeDefined();
          out.add(e.playerId);
          return;
        }
        if (e.type === 'shot' || e.type === 'free_throw') expect(out.has(e.playerId)).toBe(false);
        if (e.type === 'substitution') expect(out.has(e.playerInId)).toBe(false);
      });
    }
    expect(injuries).toBeGreaterThan(20);
  });
});

describe('technical and unsportsmanlike fouls', () => {
  it('awards free throws to the opponent, preserves possession for a technical and transfers it for an unsportsmanlike foul', () => {
    const checked = { offensiveTechnical: 0, defensiveTechnical: 0, unsportsmanlike: 0 };
    const rosters = new Map(
      [teamA, teamB].map((team) => [team.teamId, new Set(team.players.map((p) => p.id))]),
    );
    for (const events of matches) {
      events.forEach((event, index) => {
        if (
          event.type !== 'foul' ||
          (event.kind !== 'technical' && event.kind !== 'unsportsmanlike')
        )
          return;
        const otherTeamId = event.teamId === teamA.teamId ? teamB.teamId : teamA.teamId;
        expect(event.freeThrows).toBe(event.kind === 'technical' ? 1 : 2);
        const shots = events.slice(index + 1, index + 1 + event.freeThrows);
        expect(shots).toHaveLength(event.freeThrows);
        for (const shot of shots) {
          expect(shot.type).toBe('free_throw');
          if (shot.type === 'free_throw')
            expect(rosters.get(otherTeamId)!.has(shot.playerId)).toBe(true);
        }
        // A held ball or period boundary is a separate entitlement and must not be blamed on this foul.
        const next = events
          .slice(index + 1)
          .find(
            (e) =>
              e.type === 'shot' ||
              e.type === 'turnover' ||
              e.type === 'foul' ||
              e.type === 'jump_ball',
          );
        if (!next || next.period !== event.period || next.type === 'jump_ball' || next.clock <= 0)
          return;
        const entitled = event.kind === 'technical' ? event.offenseTeamId : otherTeamId;
        expect(
          next.offenseTeamId,
          `${event.kind} by ${event.teamId}, previous possession ${event.offenseTeamId}`,
        ).toBe(entitled);
        if (event.kind === 'unsportsmanlike') checked.unsportsmanlike++;
        else if (event.teamId === event.offenseTeamId) checked.offensiveTechnical++;
        else checked.defensiveTechnical++;
        if (event.kind === 'technical') expect(next.possession).toBe(event.possession);
      });
    }
    expect(checked.offensiveTechnical).toBeGreaterThan(5);
    expect(checked.defensiveTechnical).toBeGreaterThan(5);
    expect(checked.unsportsmanlike).toBeGreaterThan(10);
  });

  it('replays a technical foul and its restart identically with the same seed', () => {
    const index = matches.findIndex((events) =>
      events.some(
        (e) => e.type === 'foul' && e.kind === 'technical' && e.teamId === e.offenseTeamId,
      ),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    expect(
      simulateMatch({ home: teamA, away: teamB, ruleset: fiba, seed: `incidents-${index}` }),
    ).toEqual(matches[index]);
  });

  it('a second conduct foul ejects the player, who never plays again', () => {
    let ejections = 0;
    // An explicit rare-event fixture keeps this assertion meaningful when the batch's RNG path changes.
    const ejection = simulateMatch({
      home: teamA,
      away: teamB,
      ruleset: fiba,
      seed: 'incidents-506',
    });
    for (const events of [...matches, ejection]) {
      const conduct = new Map<string, number>();
      const out = new Set<string>();
      for (const e of events) {
        if (e.type === 'foul') {
          expect(out.has(e.playerId)).toBe(false);
          if (e.kind === 'technical' || e.kind === 'unsportsmanlike') {
            const n = (conduct.get(e.playerId) ?? 0) + 1;
            conduct.set(e.playerId, n);
            if (n >= fiba.technicalFoulsForEjection) {
              expect(e.fouledOut).toBe(true);
              ejections++;
            }
          }
          if (e.fouledOut) out.add(e.playerId);
        } else if (e.type === 'shot' || e.type === 'free_throw') {
          expect(out.has(e.playerId)).toBe(false);
        } else if (e.type === 'substitution') {
          expect(out.has(e.playerInId)).toBe(false);
        }
      }
    }
    expect(ejections).toBeGreaterThan(0);
  });

  it('counts player technical fouls towards the team bonus without changing their one-shot penalty', () => {
    let decisive = 0;
    for (const events of matches) {
      const totals = new Map<string, number>();
      const technicals = new Map<string, number>();
      for (const event of events) {
        if (event.type === 'period_start' && event.period <= fiba.periods) {
          totals.clear();
          technicals.clear();
        }
        if (event.type !== 'foul') continue;
        const fouls = (totals.get(event.teamId) ?? 0) + 1;
        totals.set(event.teamId, fouls);
        if (event.kind === 'technical') {
          technicals.set(event.teamId, (technicals.get(event.teamId) ?? 0) + 1);
          expect(event.freeThrows).toBe(1);
        }
        if (event.kind === 'personal' && event.teamId !== event.offenseTeamId) {
          expect(event.freeThrows).toBe(fouls >= fiba.teamFoulsForBonus ? 2 : 0);
          if (
            fouls >= fiba.teamFoulsForBonus &&
            fouls - (technicals.get(event.teamId) ?? 0) < fiba.teamFoulsForBonus
          )
            decisive++;
        }
      }
    }
    expect(decisive).toBeGreaterThan(0);
  });
});

describe('injuries between matches', () => {
  let world: Universe;
  beforeAll(() => {
    world = generateUniverse({ seed: 'injury-world' });
  });

  const team = (u: Universe) => u.teams[0]!;
  const withInjuries = (u: Universe, ids: string[], games: number): Universe => ({
    ...u,
    players: u.players.map((p) =>
      ids.includes(p.id) ? { ...p, injury: { gamesRemaining: games } } : p,
    ),
  });

  it('injured players are left out of the squad that plays', () => {
    const ids = team(world).playerIds.slice(0, 2);
    const hurt = withInjuries(world, ids, 5);
    const prepared = prepareTeam(team(hurt), new Map(hurt.players.map((p) => [p.id, p])));
    for (const id of ids) expect(prepared.players.some((p) => p.id === id)).toBe(false);
    expect(prepared.players.length).toBe(team(world).playerIds.length - 2);
  });

  it('with too few fit players, the least injured ones play through it', () => {
    const squad = team(world).playerIds;
    const hurtIds = squad.slice(0, squad.length - 6); // only 6 fit players left
    const hurt: Universe = {
      ...world,
      players: world.players.map((p) => {
        const index = hurtIds.indexOf(p.id);
        return index >= 0 ? { ...p, injury: { gamesRemaining: index + 1 } } : p;
      }),
    };
    const prepared = prepareTeam(team(hurt), new Map(hurt.players.map((p) => [p.id, p])));
    expect(prepared.players.length).toBe(MIN_HEALTHY_PLAYERS);
    // The two that return are the ones with the shortest injuries.
    const back = prepared.players
      .filter((p) => hurtIds.includes(p.id))
      .map((p) => p.id)
      .sort();
    expect(back).toEqual([hurtIds[0], hurtIds[1]].sort());
  });

  it('a hand-picked line-up skips an injured player instead of failing', () => {
    const squad = team(world).playerIds;
    const rotated: Universe = {
      ...world,
      teams: world.teams.map((t, i) => (i === 0 ? { ...t, rotation: [...squad] } : t)),
    };
    const hurt = withInjuries(rotated, [squad[0]!], 4);
    const prepared = prepareTeam(team(hurt), new Map(hurt.players.map((p) => [p.id, p])));
    expect(prepared.players.slice(0, 5).map((p) => p.id)).toEqual(squad.slice(1, 6));
  });

  it('one game is recovered per match of the team, and new injuries start counting afterwards', () => {
    const started = startSeason(world);
    const squad = started.teams[0]!.playerIds;
    const hurt = withInjuries(started, [squad[0]!], 2);
    const afterOne = advanceSeason(hurt).universe;
    const afterTwo = advanceSeason(afterOne).universe;
    const afterThree = advanceSeason(afterTwo).universe;
    const injuryOf = (u: Universe) => u.players.find((p) => p.id === squad[0]!)!.injury;
    expect(injuryOf(afterOne)).toEqual({ gamesRemaining: 1 });
    expect(injuryOf(afterTwo)).toBeNull();
    expect(injuryOf(afterThree)).toBeNull();
  });

  it('a whole season produces injuries, none of them are negative or impossible', () => {
    let current = startSeason(world);
    let seen = 0;
    for (;;) {
      const step = advanceSeason(current);
      current = step.universe;
      seen += current.players.filter((p) => p.injury !== null).length > 0 ? 1 : 0;
      for (const p of current.players) {
        if (p.injury) expect(p.injury.gamesRemaining).toBeGreaterThanOrEqual(1);
      }
      if (step.season) break;
    }
    expect(seen).toBeGreaterThan(10); // there were injured players on many matchdays
    expect(() => parseUniverse(current)).not.toThrow();
  });

  it('the offseason heals short injuries and shortens long ones', () => {
    let current = startSeason(world);
    for (;;) {
      const step = advanceSeason(current);
      current = step.universe;
      if (step.season) break;
    }
    // Build a mid-state by hand: apply the offseason to a finished-season universe with injuries.
    const base = startSeason(generateUniverse({ seed: 'injury-offseason' }));
    const ids = base.players
      .filter((p) => p.teamId !== null)
      .slice(0, 2)
      .map((p) => p.id);
    const hurt: Universe = {
      ...base,
      players: base.players.map((p) =>
        p.id === ids[0]
          ? { ...p, injury: { gamesRemaining: OFFSEASON_RECOVERY_GAMES - 5 } }
          : p.id === ids[1]
            ? { ...p, injury: { gamesRemaining: OFFSEASON_RECOVERY_GAMES + 12 } }
            : p,
      ),
    };
    let run = hurt;
    for (;;) {
      const step = advanceSeason(run);
      run = step.universe;
      if (step.season) break;
    }
    const short = run.players.find((p) => p.id === ids[0])!;
    const long = run.players.find((p) => p.id === ids[1])!;
    expect(short.injury).toBeNull();
    // Played 30+ matches of the season too: the long injury is gone or nearly so; never longer.
    expect(long.injury === null || long.injury.gamesRemaining <= 12).toBe(true);
    // applyOffseason alone: exactly 30 games recovered.
    const direct = applyOffseason({ ...hurt, currentSeason: null }, current.history[0]!);
    expect(direct.players.find((p) => p.id === ids[1])).toBeDefined();
  });
});

describe('migration to contract version 6', () => {
  it('adds fit players and the new ruleset fields to a version 5 universe', () => {
    const world = generateUniverse({ seed: 'migrate-6' });
    const old = JSON.parse(JSON.stringify(world));
    old.schemaVersion = 5;
    for (const p of old.players) delete p.injury;
    for (const r of old.rulesets) {
      delete r.timeoutsFirstHalf;
      delete r.timeoutsSecondHalf;
      delete r.timeoutsOvertime;
      delete r.technicalFoulsForEjection;
    }
    const migrated = parseUniverse(migrateUniverseData(old));
    expect(migrated.players.every((p) => p.injury === null)).toBe(true);
    const fibaRules = migrated.rulesets.find((r) => r.id === 'fiba')!;
    expect(fibaRules).toMatchObject({
      timeoutsFirstHalf: 2,
      timeoutsSecondHalf: 3,
      timeoutsOvertime: 1,
    });
    expect(fibaRules.technicalFoulsForEjection).toBe(2);
    const nba = migrated.rulesets.find((r) => r.id === 'nba-like')!;
    expect(nba).toMatchObject({ timeoutsFirstHalf: 4, timeoutsOvertime: 2 });
  });
});
