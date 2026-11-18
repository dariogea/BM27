import { describe, expect, it } from 'vitest';
import { chartBars, seasonsUntilOverdraft, wageUse } from '../src/financeData';

describe('wageUse', () => {
  it('is the payroll as a percentage of the wage budget', () => {
    expect(wageUse(2_000_000, 4_000_000)).toBe(50);
    expect(wageUse(5_000_000, 4_000_000)).toBe(125);
  });
  it('does not divide by zero', () => {
    expect(wageUse(0, 0)).toBe(0);
    expect(wageUse(10, 0)).toBe(Infinity);
  });
});

describe('seasonsUntilOverdraft', () => {
  it('is null when the club is not projected to lose money', () => {
    expect(
      seasonsUntilOverdraft({ balance: 100, overdraftLimit: 500, projectedResult: 0 }),
    ).toBeNull();
    expect(
      seasonsUntilOverdraft({ balance: -900, overdraftLimit: 500, projectedResult: 50 }),
    ).toBeNull();
  });

  it('counts the whole seasons of room left before the limit', () => {
    // room = 1.000.000 + 250.000 = 1.250.000; losing 400.000 a season → 3 whole seasons
    expect(
      seasonsUntilOverdraft({
        balance: 1_000_000,
        overdraftLimit: 250_000,
        projectedResult: -400_000,
      }),
    ).toBe(3);
    // already in debt but inside the limit: room = -100.000 + 250.000 = 150.000
    expect(
      seasonsUntilOverdraft({
        balance: -100_000,
        overdraftLimit: 250_000,
        projectedResult: -100_000,
      }),
    ).toBe(1);
  });

  it('is 0 when the next season already crosses the limit or the limit is already crossed', () => {
    expect(
      seasonsUntilOverdraft({ balance: 0, overdraftLimit: 250_000, projectedResult: -300_000 }),
    ).toBe(0);
    expect(
      seasonsUntilOverdraft({ balance: -400_000, overdraftLimit: 250_000, projectedResult: -1 }),
    ).toBe(0);
  });
});

describe('chartBars', () => {
  const history = [{ result: 300 }, { result: -600 }, { result: 150 }]; // newest first
  it('orders seasons from the oldest and labels them from the current season', () => {
    expect(chartBars(history, 4).map((b) => b.season)).toEqual([1, 2, 3]);
    expect(chartBars(history, 4).map((b) => b.value)).toEqual([150, -600, 300]);
  });
  it('scales bars to the largest absolute value', () => {
    expect(chartBars(history, 4).map((b) => b.share)).toEqual([0.25, 1, 0.5]);
  });
  it('handles an empty history and all-zero results', () => {
    expect(chartBars([], 1)).toEqual([]);
    expect(chartBars([{ result: 0 }], 2)[0]!.share).toBe(0);
  });
  it('can chart another field, such as the final cash', () => {
    const bars = chartBars(
      [
        { result: 0, cash: 10 },
        { result: 0, cash: -30 },
      ] as { result: number }[],
      3,
      (r) => (r as unknown as { cash: number }).cash,
    );
    expect(bars.map((b) => b.value)).toEqual([-30, 10]);
  });
});
