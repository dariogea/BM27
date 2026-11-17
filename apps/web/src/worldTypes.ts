import type {
  Contract,
  PlayerAttributes,
  PlayerSeasonStats,
  Position,
  TeamTactics,
} from '@bm27/schema';

export type WorldQuery =
  | {
      type: 'worldSearch';
      entity: 'players' | 'clubs';
      query: string;
      competitionId: string;
      page: number;
      includeRetired: boolean;
    }
  | { type: 'worldPlayer'; playerId: string }
  | { type: 'worldClub'; teamId: string };

export interface WorldHit {
  id: string;
  name: string;
  context: string;
  competition: string;
  detail: string;
}
export interface WorldSearch {
  kind: 'search';
  entity: 'players' | 'clubs';
  page: number;
  pageSize: number;
  total: number;
  rows: WorldHit[];
}
export interface WorldPlayer {
  kind: 'player';
  id: string;
  name: string;
  age: number;
  heightCm: number;
  positions: Position[];
  retired: boolean;
  club: { id: string; name: string } | null;
  attributes: PlayerAttributes;
  potential: number | null;
  contract: Contract | null;
  injuryGames: number;
  seasons: {
    season: number;
    teamName: string;
    competitionName: string;
    stats: PlayerSeasonStats;
  }[];
}
export interface WorldClub {
  kind: 'club';
  id: string;
  name: string;
  city: string;
  region: string;
  reputation: number;
  competition: string;
  salaryCap: number;
  tactics: TeamTactics;
  players: { id: string; name: string; age: number; positions: Position[] }[];
  results: {
    id: string;
    season: number;
    round: number;
    playoff: boolean;
    opponent: string;
    home: boolean;
    ownScore: number;
    opponentScore: number;
  }[];
}
export type WorldPayload = WorldSearch | WorldPlayer | WorldClub;
