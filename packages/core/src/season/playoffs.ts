/** Smallest power of two ≥ n. */
export function bracketSize(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard bracket order for a power-of-two size, e.g. 8 → [1,8,4,5,2,7,3,6]:
 * seeds 1 and 2 can only meet in the final.
 */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const seed of order) next.push(seed, total - seed);
    order = next;
  }
  return order;
}

/** Best-of length for a 0-based round; the last configured value is reused. */
export function bestOfForRound(seriesBestOf: readonly number[], roundIndex: number): number {
  return seriesBestOf[Math.min(roundIndex, seriesBestOf.length - 1)] as number;
}
