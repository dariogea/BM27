export const LEADER_METRICS = {
  points: 'Puntos',
  rebounds: 'Rebotes',
  assists: 'Asistencias',
  steals: 'Robos',
  blocks: 'Tapones',
  fieldGoalPercent: '% tiros de campo',
  threePointPercent: '% triples',
  freeThrowPercent: '% tiros libres',
} as const;
export type LeaderMode = 'average' | 'total' | 'per40';
export type LeaderMetric = keyof typeof LEADER_METRICS;
export interface LeagueRecordsQuery {
  type: 'worldRecords';
  competitionId: string;
  /** Zero chooses the latest recorded season, including a season in progress. */
  season: number;
  metric: LeaderMetric;
  mode: LeaderMode;
  minGames: number;
  minAttempts: number;
  minMinutes?: number;
}
export interface LeagueRecordsPayload {
  kind: 'records';
  competitionId: string;
  competitionName: string;
  season: number;
  completed: boolean;
  seasons: number[];
  metric: LeaderMetric;
  mode: LeaderMode;
  total: number;
  minGames: number;
  minAttempts: number;
  minMinutes?: number;
  rows: {
    rank: number;
    playerId: string;
    name: string;
    teamId: string;
    teamName: string;
    games: number;
    numerator: number;
    denominator: number;
    value: number;
  }[];
  honours: {
    season: number;
    champion: { id: string; name: string };
    promoted: { id: string; name: string }[];
    relegated: { id: string; name: string }[];
  }[];
}
