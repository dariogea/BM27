import type { PlayerSeasonStats, Universe } from '@bm27/schema';
import {
  LEADER_METRICS,
  type LeagueRecordsPayload,
  type LeagueRecordsQuery,
} from './leagueRecordsTypes';

/** Recorded facts only. This projection never advances the simulation. */
export function queryLeagueRecords(
  world: Universe,
  query: LeagueRecordsQuery,
): LeagueRecordsPayload {
  if (
    !Object.hasOwn(LEADER_METRICS, query.metric) ||
    !['average', 'total'].includes(query.mode) ||
    ![query.season, query.minGames, query.minAttempts].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    )
  )
    throw new Error('Filtros de líderes no válidos.');
  const competition = world.competitions.find((c) => c.id === query.competitionId);
  if (!competition) throw new Error('La competición no existe.');
  const records = world.history.flatMap((s) =>
    s.competitions
      .filter((c) => c.competitionId === competition.id)
      .map((c) => ({ season: s.seasonNumber, stats: c.playerStats, completed: true })),
  );
  const current = world.currentSeason?.competitions.find((c) => c.competitionId === competition.id);
  if (current)
    records.push({
      season: world.currentSeason!.seasonNumber,
      stats: current.playerStats,
      completed: false,
    });
  const seasons = [...new Set(records.map((r) => r.season))].sort((a, b) => b - a);
  if (!seasons.length) seasons.push(world.seasonNumber);
  const season = query.season || seasons[0]!;
  if (!seasons.includes(season))
    throw new Error('La temporada no está conservada para esta competición.');
  const record = records.find((r) => r.season === season);
  const teams = new Map(world.teams.map((t) => [t.id, t.name]));
  const players = new Map(world.players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const isPercentage = query.metric.endsWith('Percent');
  function fraction(s: PlayerSeasonStats): [number, number] {
    switch (query.metric) {
      case 'fieldGoalPercent':
        return [s.fieldGoalsMade, s.fieldGoalsAttempted];
      case 'threePointPercent':
        return [s.threePointersMade, s.threePointersAttempted];
      case 'freeThrowPercent':
        return [s.freeThrowsMade, s.freeThrowsAttempted];
      case 'rebounds':
        return [s.offensiveRebounds + s.defensiveRebounds, query.mode === 'average' ? s.games : 1];
      default:
        return [s[query.metric], query.mode === 'average' ? s.games : 1];
    }
  }
  const rows = (record?.stats ?? [])
    .filter((s) => s.games > 0 && s.games >= query.minGames)
    .flatMap((s) => {
      const [numerator, denominator] = fraction(s);
      if (denominator <= 0 || (isPercentage && denominator < query.minAttempts)) return [];
      return [
        {
          rank: 0,
          playerId: s.playerId,
          name: players.get(s.playerId) ?? s.playerId,
          teamId: s.teamId,
          teamName: teams.get(s.teamId) ?? s.teamId,
          games: s.games,
          numerator,
          denominator,
          value: (numerator / denominator) * (isPercentage ? 100 : 1),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.playerId.localeCompare(b.playerId) ||
        a.teamId.localeCompare(b.teamId),
    );
  rows.forEach((row, index) => {
    row.rank =
      index > 0 && rows[index - 1]!.value === row.value ? rows[index - 1]!.rank : index + 1;
  });
  const team = (id: string) => ({ id, name: teams.get(id) ?? id });
  return {
    kind: 'records',
    competitionId: competition.id,
    competitionName: competition.name,
    season,
    completed: record?.completed ?? false,
    seasons,
    metric: query.metric,
    mode: query.mode,
    minGames: query.minGames,
    minAttempts: query.minAttempts,
    total: rows.length,
    rows: rows.slice(0, 50),
    honours: [...world.history]
      .sort((a, b) => b.seasonNumber - a.seasonNumber)
      .flatMap((s) =>
        s.competitions
          .filter((c) => c.competitionId === competition.id)
          .map((c) => ({
            season: s.seasonNumber,
            champion: team(c.championTeamId),
            promoted: c.promotedTeamIds.map(team),
            relegated: c.relegatedTeamIds.map(team),
          })),
      ),
  };
}
