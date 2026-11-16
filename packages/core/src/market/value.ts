import type { Player } from '@bm27/schema';
import { playerAbility } from '../generator/development';

/**
 * MARKET VALUATION (T-005).
 *
 * A player's yearly salary demand follows his ability exponentially: a player
 * 12 points better asks for about 2.7 times more. Young players with room to
 * grow ask for part of their potential; players over 32 ask for less.
 *
 * The numbers are a first model. They are not fitted to real wages; caps and
 * minimum wages are data (see `data/universe-es.json`).
 */
export const MARKET = {
  /** Euros per season for a player of ability `referenceAbility`. */
  baseSalary: 20_000,
  referenceAbility: 45,
  /** Ability points that multiply the salary by e (≈ 2.7). */
  abilityScale: 12,
  /** Share of the gap to potential that counts, by age. */
  potentialShare: (age: number): number =>
    age <= 22 ? 0.6 : age <= 24 ? 0.4 : age <= 26 ? 0.2 : 0,
  /** Yearly drop in demand after this age. */
  discountFromAge: 32,
  discountPerYear: 0.85,
  /** Players never refuse to re-sign at their asking salary; this is the premium to keep them. */
  renewalPremium: 1.04,
  maxYears: 4,
  /** Clubs try to carry this many players, as long as they can afford them. */
  aiTargetRoster: 13,
  /** Quality of the youngsters entering the market, relative to the level they replace. */
  prospectQualityOffset: -1.8,
  /** Probability that a club renews an expiring player it still needs. */
  renewalChance: 0.92,
  /** Unsigned players of this age or more retire when the season ends. */
  freeAgentRetirementAge: 29,
} as const;

/**
 * How good a club thinks a player is, counting part of his potential while he
 * is young. Used by clubs to compare players, and the basis of his salary demand.
 */
export function clubRating(player: Pick<Player, 'attributes' | 'age' | 'potential'>): number {
  const ability = playerAbility(player);
  return ability + MARKET.potentialShare(player.age) * Math.max(0, player.potential - ability);
}

/** Salary a player asks for, in euros per season, rounded to the nearest thousand. */
export function playerValue(player: Pick<Player, 'attributes' | 'age' | 'potential'>): number {
  const effective = clubRating(player);
  let salary =
    MARKET.baseSalary * Math.exp((effective - MARKET.referenceAbility) / MARKET.abilityScale);
  if (player.age > MARKET.discountFromAge) {
    salary *= Math.pow(MARKET.discountPerYear, player.age - MARKET.discountFromAge);
  }
  return Math.round(salary / 1000) * 1000;
}

/** Contract length a club offers by default, in seasons. */
export function suggestedYears(age: number): number {
  return age <= 29 ? 3 : age <= 32 ? 2 : 1;
}
