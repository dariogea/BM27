import type {
  GroupSeason,
  MatchDetail,
  MatchResult,
  Player,
  PlayerSeasonStats,
  PlayoffSeriesState,
  TeamTactics,
} from '@bm27/schema';

/** Commands the UI sends to the simulation worker. The UI never runs the core itself. */
export type Command =
  | { id: number; type: 'generate'; seed: string }
  | { id: number; type: 'chooseTeam'; teamId: string | null }
  | { id: number; type: 'setTactics'; tactics: TeamTactics }
  | { id: number; type: 'setRotation'; playerIds: string[] | null }
  | { id: number; type: 'advance' }
  | { id: number; type: 'finishSeason' }
  | { id: number; type: 'matchDetail'; matchId: string }
  | { id: number; type: 'exportSave' }
  | { id: number; type: 'importSave'; json: string };

export interface CompetitionViewData {
  competitionId: string;
  seasonNumber: number;
  phase: 'regular' | 'playoffs' | 'done';
  groups: GroupSeason[];
  playoffSeries: PlayoffSeriesState[];
  matches: MatchResult[];
  championTeamId: string | null;
  promotedTeamIds: string[];
  relegatedTeamIds: string[];
}

export interface SquadPlayer {
  player: Player;
  overall: number;
  /** Season totals so far, if the player has played. */
  stats: PlayerSeasonStats | null;
}

export interface MyTeamView {
  teamId: string;
  name: string;
  competitionId: string;
  competitionName: string;
  level: number;
  tactics: TeamTactics;
  /** Hand-picked line-up, or null when the coach decides. */
  rotation: string[] | null;
  /** Squad in the order the team will use it: five starters, then the bench. */
  squad: SquadPlayer[];
  position: number | null;
  wins: number;
  losses: number;
  nextMatch: { round: number; opponentId: string; home: boolean } | null;
  lastMatch: MatchResult | null;
}

/** How the user's squad changed at the end of a season. */
export interface OffseasonReport {
  /** Season that has just finished. */
  seasonNumber: number;
  rows: {
    playerId: string;
    name: string;
    /** Age during the season that finished. */
    age: number;
    abilityBefore: number;
    abilityAfter: number;
    potential: number;
    retired: boolean;
  }[];
  /** Youngsters who joined to replace retirees. */
  arrivals: { playerId: string; name: string; age: number; ability: number; potential: number }[];
}

/** Everything the UI needs to draw the current state of the game. */
export interface GameView {
  seed: string;
  /** Season being played, or about to be played. */
  seasonNumber: number;
  seasonInProgress: boolean;
  step: number;
  userTeamId: string | null;
  teamCount: number;
  playerCount: number;
  competitions: { id: string; name: string; level: number; teamIds: string[] }[];
  teamNames: Record<string, string>;
  /** Tables of the season in progress, or of the last finished one. */
  tables: CompetitionViewData[];
  myTeam: MyTeamView | null;
  /** Squad changes after the last finished season, until the next step is played. */
  offseason: OffseasonReport | null;
}

export type Reply =
  | { id: number; type: 'state'; view: GameView; message: string }
  | {
      id: number;
      type: 'matchDetail';
      detail: MatchDetail;
      playerNames: Record<string, string>;
      /** Tactics each team used in this match, by team id. */
      tactics: Record<string, TeamTactics>;
      ms: number;
    }
  | { id: number; type: 'save'; json: string; fileName: string }
  | { id: number; type: 'error'; message: string };
