import { parseUniverse, type Player } from '@bm27/schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_NAME_POOL,
  createRng,
  developPlayer,
  generatePlayer,
  generateUniverse,
  playerAbility,
  retirementChance,
  sampleCareerAge,
  simulateSeason,
  type Rng,
} from '../src/index';

/** A prospect with a clear gap between ability and potential. */
function prospect(rng: Rng, age: number, quality = 60): Player {
  return generatePlayer(rng, DEFAULT_NAME_POOL, {
    id: `p-${age}-${rng.int(0, 1e9)}`,
    teamId: 't',
    quality,
    position: 'SF',
    minAge: age,
    maxAge: age,
    age,
  });
}

/** Average ability change over `years` seasons for many players starting at `age`. */
function averageChange(age: number, years: number, group?: 'physical' | 'offensive'): number {
  const rng = createRng(`curve-${age}-${years}-${group ?? 'all'}`);
  let total = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const start = prospect(rng, age);
    let player = start;
    for (let y = 0; y < years; y++) player = developPlayer(player, rng);
    const level = (p: Player): number =>
      group
        ? Object.values(p.attributes[group]).reduce((a, b) => a + b, 0) /
          Object.values(p.attributes[group]).length
        : playerAbility(p);
    total += level(player) - level(start);
  }
  return total / N;
}

describe('player development', () => {
  it('young players improve towards their potential', () => {
    expect(averageChange(19, 4)).toBeGreaterThan(5);
    expect(averageChange(22, 3)).toBeGreaterThan(1.5);
  });

  it('players do not grow much beyond their potential', () => {
    const rng = createRng('ceiling');
    for (let i = 0; i < 200; i++) {
      let player = prospect(rng, 18);
      for (let y = 0; y < 8; y++) player = developPlayer(player, rng);
      expect(playerAbility(player)).toBeLessThan(player.potential + 4);
    }
  });

  it('players stop improving in their late twenties and decline as veterans', () => {
    expect(Math.abs(averageChange(28, 2))).toBeLessThan(2.5);
    expect(averageChange(34, 4)).toBeLessThan(-3);
    expect(averageChange(36, 3)).toBeLessThan(averageChange(31, 3));
  });

  it('athleticism fades before skill', () => {
    // From 30 to 34 the physical group loses clearly more than the skill group.
    const physical = averageChange(30, 4, 'physical');
    const offensive = averageChange(30, 4, 'offensive');
    expect(physical).toBeLessThan(offensive - 0.8);
  });

  it('keeps attributes inside 1–99', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 100; i++) {
      let player = prospect(rng, 18, i % 2 ? 95 : 25);
      for (let y = 0; y < 22; y++) {
        player = developPlayer(player, rng);
        for (const group of Object.values(player.attributes)) {
          for (const value of Object.values(group)) {
            expect(value).toBeGreaterThanOrEqual(1);
            expect(value).toBeLessThanOrEqual(99);
          }
        }
      }
    }
  });

  it('is deterministic and does not modify its input', () => {
    const player = prospect(createRng('det'), 21);
    const snapshot = JSON.stringify(player);
    const a = developPlayer(player, createRng('same'));
    const b = developPlayer(player, createRng('same'));
    expect(a).toEqual(b);
    expect(JSON.stringify(player)).toBe(snapshot);
    expect(a.age).toBe(player.age + 1);
  });

  it('retirement chance is zero for the young, grows with age and is certain at 40', () => {
    expect(retirementChance(25)).toBe(0);
    expect(retirementChance(33)).toBe(0);
    let previous = 0;
    for (let age = 34; age < 40; age++) {
      const chance = retirementChance(age);
      expect(chance).toBeGreaterThan(previous);
      previous = chance;
    }
    expect(retirementChance(40)).toBe(1);
  });
});

describe('career age mix', () => {
  it('samples ages from 18 to 39 with most players in their twenties', () => {
    const rng = createRng('ages');
    let sum = 0;
    let twenties = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const age = sampleCareerAge(rng);
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThan(40);
      sum += age;
      if (age >= 20 && age <= 29) twenties++;
    }
    expect(sum / N).toBeGreaterThan(26);
    expect(sum / N).toBeLessThan(28.2);
    expect(twenties / N).toBeGreaterThan(0.55);
  });
});

describe('players in a new universe', () => {
  let universe: ReturnType<typeof generateUniverse>;
  beforeAll(() => {
    universe = generateUniverse({ seed: 'development-test' });
  });

  it('have a valid potential: never below ability, with a gap for the young', () => {
    expect(() => parseUniverse(universe)).not.toThrow();
    let youngGap = 0;
    let youngCount = 0;
    let vetGap = 0;
    let vetCount = 0;
    for (const p of universe.players) {
      const gap = p.potential - playerAbility(p);
      if (p.age <= 21) {
        youngGap += gap;
        youngCount++;
      } else if (p.age >= 30) {
        vetGap += gap;
        vetCount++;
      }
    }
    expect(youngGap / youngCount).toBeGreaterThan(3);
    expect(vetGap / vetCount).toBeLessThan(youngGap / youngCount - 2);
  });

  it('start with the steady-state age mix', () => {
    const ages = universe.players.map((p) => p.age);
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    expect(mean).toBeGreaterThan(26);
    expect(mean).toBeLessThan(28.2);
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(18);
  });
});

describe('long-run stability', () => {
  it('the world does not age or inflate over several seasons', () => {
    let current = generateUniverse({ seed: 'stability-test' });
    const summary = (u: typeof current): { age: number; level: number[] } => {
      const byId = new Map(u.players.map((p) => [p.id, p]));
      const teams = new Map(u.teams.map((t) => [t.id, t]));
      let ageSum = 0;
      let count = 0;
      const level = [...u.competitions]
        .sort((a, b) => a.level - b.level)
        .map((c) => {
          let sum = 0;
          let n = 0;
          for (const id of c.teamIds) {
            for (const pid of (teams.get(id) as { playerIds: string[] }).playerIds) {
              const p = byId.get(pid) as Player;
              sum += playerAbility(p);
              ageSum += p.age;
              n++;
              count++;
            }
          }
          return sum / n;
        });
      return { age: ageSum / count, level };
    };
    const first = summary(current);
    for (let i = 0; i < 6; i++) current = simulateSeason(current).universe;
    const last = summary(current);
    expect(Math.abs(last.age - first.age)).toBeLessThan(0.8);
    first.level.forEach((value, i) => {
      expect(Math.abs((last.level[i] as number) - value), `level ${i + 1}`).toBeLessThan(2);
    });
    expect(() => parseUniverse(current)).not.toThrow();
  });
});
