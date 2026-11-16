export interface Fixture {
  /** 1-based matchday. */
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Round-robin calendar (circle method). With an odd number of teams one team
 * rests each matchday. Each extra leg mirrors home and away.
 */
export function buildRoundRobin(teamIds: readonly string[], legs: number): Fixture[] {
  const slots: (string | null)[] = [...teamIds];
  if (slots.length % 2 === 1) slots.push(null);
  const n = slots.length;
  const roundsPerLeg = n - 1;
  const firstLeg: Fixture[] = [];

  for (let round = 0; round < roundsPerLeg; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = slots[i];
      const b = slots[n - 1 - i];
      if (a == null || b == null) continue;
      // Alternate home/away so that nobody plays long home or away streaks.
      const aHome = i === 0 ? round % 2 === 0 : i % 2 === 0;
      firstLeg.push({
        round: round + 1,
        homeTeamId: aHome ? a : b,
        awayTeamId: aHome ? b : a,
      });
    }
    // Rotate every slot except the first.
    slots.splice(1, 0, slots.pop() as string | null);
  }

  const fixtures: Fixture[] = [];
  for (let leg = 0; leg < legs; leg++) {
    const mirrored = leg % 2 === 1;
    for (const f of firstLeg) {
      fixtures.push({
        round: f.round + leg * roundsPerLeg,
        homeTeamId: mirrored ? f.awayTeamId : f.homeTeamId,
        awayTeamId: mirrored ? f.homeTeamId : f.awayTeamId,
      });
    }
  }
  return fixtures;
}
