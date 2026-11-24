import type { MatchDetail, PlayType, ShotZone } from '@bm27/schema';

export interface ShotTotals {
  made: number;
  attempts: number;
  points: number;
}
export const EMPTY_SHOT_TOTALS: Readonly<ShotTotals> = { made: 0, attempts: 0, points: 0 };

export function shotBreakdown({ events, boxScore }: MatchDetail) {
  const teams = new Map(
    [boxScore.home, boxScore.away].map(({ teamId }) => [
      teamId,
      {
        zones: new Map<ShotZone, ShotTotals>(),
        plays: new Map<PlayType, ShotTotals>(),
        turnovers: new Map<PlayType, number>(),
      },
    ]),
  );
  function record<K>(group: Map<K, ShotTotals>, key: K, made: boolean, points: number): void {
    const totals = group.get(key) ?? { ...EMPTY_SHOT_TOTALS };
    totals.attempts++;
    if (made) {
      totals.made++;
      totals.points += points;
    }
    group.set(key, totals);
  }
  for (const event of events) {
    if (event.type !== 'shot' && event.type !== 'turnover') continue;
    const team = teams.get(event.offenseTeamId);
    if (!team) continue;
    if (event.type === 'turnover') {
      team.turnovers.set(event.playType, (team.turnovers.get(event.playType) ?? 0) + 1);
      continue;
    }
    record(team.zones, event.zone, event.made, event.points);
    record(team.plays, event.playType, event.made, event.points);
  }
  return teams;
}
