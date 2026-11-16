import type { Player, PlayerAttributes } from '@bm27/schema';
import type { Rng } from '../rng';

/**
 * PLAYER DEVELOPMENT MODEL (T-004).
 *
 * Every year a player moves towards his `potential` while he is young and
 * loses ability when he gets old. Body, skills and mind age differently:
 * athleticism goes first, shooting touch lasts, and reading the game keeps
 * improving into the thirties.
 *
 * The numbers are a reasonable first model, tuned so that the world stays
 * stable over decades (see docs/benchmarks/T-004-estabilidad.md). They are not
 * fitted to real career data.
 */
export const DEVELOPMENT = {
  /** Age at which generated careers begin. */
  startAge: 18,
  /** How far below his potential an 18-year-old starts (mean, spread). */
  youthGap: 10,
  youthGapSpread: 1.5,
  /** Share of the remaining gap to potential closed each year, by age reached. */
  growthRate: (age: number): number => (age <= 21 ? 0.25 : age <= 25 ? 0.22 : age <= 29 ? 0.12 : 0),
  /** Points lost per year once decline starts, by attribute group. */
  physicalDeclineFrom: 29,
  physicalDeclinePerYear: 0.35,
  skillDeclineFrom: 32,
  skillDeclinePerYear: 0.4,
  /** Shooting touch (three-point and free-throw) lasts longer. */
  touchDeclineFrom: 34,
  mentalGrowthUntil: 33,
  mentalGrowthPerYear: 0,
  /** Year-to-year randomness of each attribute. */
  noise: 0.9,
  retirementFrom: 34,
  retirementBase: 0.12,
  retirementPerYear: 0.14,
  retirementCertainAt: 40,
} as const;

const D = DEVELOPMENT;

/** Ability: the plain average of all attributes (the scale `potential` uses). */
export function playerAbility(player: Pick<Player, 'attributes'>): number {
  let sum = 0;
  let count = 0;
  for (const group of Object.values(player.attributes)) {
    for (const value of Object.values(group)) {
      sum += value;
      count++;
    }
  }
  return sum / count;
}

const clampAttr = (value: number): number => Math.max(1, Math.min(99, value));

/**
 * Returns the player one year older, with his attributes developed or
 * declined accordingly. Does not modify the input.
 */
export function developPlayer(player: Player, rng: Rng): Player {
  const age = player.age + 1;
  const gap = Math.max(0, player.potential - playerAbility(player));
  const growth = gap * D.growthRate(age);
  const physicalDecline = Math.max(0, age - (D.physicalDeclineFrom - 1)) * D.physicalDeclinePerYear;
  const skillDecline = Math.max(0, age - (D.skillDeclineFrom - 1)) * D.skillDeclinePerYear;
  const touchDecline = Math.max(0, age - (D.touchDeclineFrom - 1)) * D.skillDeclinePerYear;
  const mentalGrowth = age <= D.mentalGrowthUntil ? D.mentalGrowthPerYear : 0;

  const change = (value: number, decline: number, bonus = 0): number => {
    // Each attribute grows at its own pace around the common growth.
    const delta =
      growth * Math.max(0, rng.normal(1, 0.5)) - decline + bonus + rng.normal(0, D.noise);
    // Probabilistic rounding keeps small yearly changes from vanishing.
    const whole = Math.floor(delta);
    return clampAttr(value + whole + (rng.next() < delta - whole ? 1 : 0));
  };

  const o = player.attributes.offensive;
  const d = player.attributes.defensive;
  const p = player.attributes.physical;
  const m = player.attributes.mental;
  const attributes: PlayerAttributes = {
    offensive: {
      closeShot: change(o.closeShot, skillDecline),
      midRange: change(o.midRange, skillDecline),
      threePoint: change(o.threePoint, touchDecline),
      freeThrow: change(o.freeThrow, touchDecline),
      passing: change(o.passing, skillDecline),
      ballHandling: change(o.ballHandling, skillDecline),
      offensiveRebound: change(o.offensiveRebound, skillDecline),
    },
    defensive: {
      perimeterDefense: change(d.perimeterDefense, skillDecline),
      interiorDefense: change(d.interiorDefense, skillDecline),
      steal: change(d.steal, skillDecline),
      block: change(d.block, skillDecline),
      defensiveRebound: change(d.defensiveRebound, skillDecline),
    },
    physical: {
      speed: change(p.speed, physicalDecline),
      strength: change(p.strength, physicalDecline * 0.6),
      stamina: change(p.stamina, physicalDecline),
      jumping: change(p.jumping, physicalDecline),
    },
    mental: {
      decisions: change(m.decisions, 0, mentalGrowth),
      composure: change(m.composure, 0, mentalGrowth),
      workRate: change(m.workRate, 0),
      discipline: change(m.discipline, 0, mentalGrowth),
    },
  };
  return { ...player, age, attributes };
}

/** Chance that a player of this age (already one year older) retires now. */
export function retirementChance(age: number): number {
  if (age >= D.retirementCertainAt) return 1;
  if (age < D.retirementFrom) return 0;
  return Math.min(1, D.retirementBase + (age - D.retirementFrom) * D.retirementPerYear);
}

/**
 * Probability that a player who entered the league at 18–20 is still playing
 * at each age. Index 0 is age 18.
 */
const CAREER_SURVIVAL: readonly number[] = (() => {
  const out: number[] = [];
  let alive = 1;
  for (let age = D.startAge; age <= D.retirementCertainAt; age++) {
    // Entry ages 18, 19 and 20 are equally likely, so they ramp up 1/3, 2/3, 1.
    const entered = age >= D.startAge + 2 ? 1 : (age - D.startAge + 1) / 3;
    if (age > D.startAge + 2) alive *= 1 - retirementChance(age);
    out.push(entered * alive);
  }
  return out;
})();

/**
 * Samples an age from the steady-state age mix of a world where careers start
 * at 18–20 and end through `retirementChance`. A new universe built with these
 * ages does not drift in age during its first decades.
 */
export function sampleCareerAge(rng: Rng): number {
  const total = CAREER_SURVIVAL.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < CAREER_SURVIVAL.length; i++) {
    roll -= CAREER_SURVIVAL[i] as number;
    if (roll < 0) return D.startAge + i;
  }
  return D.retirementCertainAt - 1;
}
