/** Pure helpers of the finance panel (T-039). Everything derives from the numbers on screen. */

export interface ProjectionInput {
  balance: number;
  overdraftLimit: number;
  /** Expected revenue minus current payroll and fixed costs for one season. */
  projectedResult: number;
}

/** Share of the wage budget used by the payroll, as a percentage (may exceed 100). */
export function wageUse(payroll: number, wageBudget: number): number {
  return wageBudget > 0 ? (100 * payroll) / wageBudget : payroll > 0 ? Infinity : 0;
}

/**
 * Whole seasons the club can keep losing money at the projected rate before its cash reaches the
 * overdraft limit. Null when the projection is not a loss. 0 means it would cross the limit within
 * the next season; a club already past the limit also gets 0.
 *
 * It is a straight-line projection of the numbers shown ("if nothing changes"), not a forecast.
 */
export function seasonsUntilOverdraft(input: ProjectionInput): number | null {
  if (input.projectedResult >= 0) return null;
  const room = input.balance + input.overdraftLimit;
  if (room <= 0) return 0;
  return Math.floor(room / -input.projectedResult);
}

export interface ChartBar {
  /** Label of the season (oldest on the left). */
  season: number;
  value: number;
  /** Height of the bar as a share of the largest absolute value (0–1). */
  share: number;
}

/**
 * Bars for a chart of one value per closed season, oldest first. `history` is newest first, as the
 * game sends it, and `currentSeason` is the season about to be played.
 */
export function chartBars(
  history: readonly { result: number }[],
  currentSeason: number,
  pick: (record: { result: number }) => number = (r) => r.result,
): ChartBar[] {
  const bars = history.map((record, index) => ({
    season: currentSeason - 1 - index,
    value: pick(record),
  }));
  const peak = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  return bars.reverse().map((b) => ({ ...b, share: Math.abs(b.value) / peak }));
}
