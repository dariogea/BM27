import type { MatchDetail, Season } from '@bm27/schema';

/** Commands the UI sends to the simulation worker. The UI never runs the core itself. */
export type Command =
  | { id: number; type: 'generate'; seed: string }
  | { id: number; type: 'simulateSeason' }
  | { id: number; type: 'matchDetail'; matchId: string };

export interface UniverseSummary {
  seed: string;
  /** Next season to simulate. */
  seasonNumber: number;
  teamCount: number;
  playerCount: number;
  competitions: { id: string; name: string; level: number; teamCount: number }[];
  teamNames: Record<string, string>;
}

export type Reply =
  | { id: number; type: 'universe'; summary: UniverseSummary; ms: number }
  | { id: number; type: 'season'; summary: UniverseSummary; season: Season; ms: number }
  | {
      id: number;
      type: 'matchDetail';
      detail: MatchDetail;
      playerNames: Record<string, string>;
      ms: number;
    }
  | { id: number; type: 'error'; message: string };
