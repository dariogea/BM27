import type { WorldPayload, WorldQuery } from './worldTypes';
import type { SlotSummary } from './slotStore';
import type { HalftimeTactics } from '@bm27/core';
import type {
  Contract,
  Fixture,
  GroupSeason,
  TeamFinanceRecord,
  MatchDetail,
  MatchResult,
  Player,
  PlayerSeasonStats,
  PlayoffSeriesState,
  TeamTactics,
} from '@bm27/schema';

/** Commands the UI sends to the simulation worker. The UI never runs the core itself. */
export interface DataPackSummary {
  id: string;
  name: string;
  description: string;
  definedClubs: number;
  competitions: { id: string; name: string; teams: number }[];
}

export type Command =
  | { id: number; type: 'setDataPack'; json: string | null }
  | (WorldQuery & { id: number })
  | { id: number; type: 'generate'; seed: string }
  | { id: number; type: 'chooseTeam'; teamId: string | null }
  | { id: number; type: 'setTactics'; tactics: TeamTactics }
  | { id: number; type: 'setRotation'; playerIds: string[] | null }
  | { id: number; type: 'signFreeAgent'; playerId: string; years: number }
  | { id: number; type: 'renewContract'; playerId: string; years: number }
  | { id: number; type: 'releasePlayer'; playerId: string }
  | { id: number; type: 'advance'; watch?: boolean }
  | { id: number; type: 'beginManagedMatch' }
  | { id: number; type: 'finishManagedMatch'; matchId: string; tactics?: HalftimeTactics }
  | { id: number; type: 'cancelManagedMatch'; matchId: string }
  | { id: number; type: 'finishSeason' }
  | { id: number; type: 'matchDetail'; matchId: string }
  | { id: number; type: 'exportSave' }
  | { id: number; type: 'importSave'; json: string }
  | { id: number; type: 'listSlots' }
  | { id: number; type: 'saveSlot'; name: string }
  | { id: number; type: 'loadSlot'; name: string }
  | { id: number; type: 'deleteSlot'; name: string }
  | { id: number; type: 'renameSlot'; name: string; newName: string }
  | { id: number; type: 'setAutosave'; enabled: boolean };

export interface CompetitionViewData {
  competitionId: string;
  seasonNumber: number;
  phase: 'regular' | 'playoffs' | 'done';
  groups: GroupSeason[];
  playoffSeries: PlayoffSeriesState[];
  matches: MatchResult[];
  fixtures?: Fixture[];
  championTeamId: string | null;
  promotedTeamIds: string[];
  relegatedTeamIds: string[];
}

export interface SquadPlayer {
  player: Player;
  overall: number;
  /** Season totals so far, if the player has played. */
  stats: PlayerSeasonStats | null;
  contract: Contract | null;
  /** The contract has run out: renew it before the season starts or the player leaves. */
  expired: boolean;
  /** Salary he would ask to renew. */
  renewalSalary: number;
  /** What it would cost to release him now. */
  releaseCost: number;
}

export interface FreeAgentRow {
  player: Player;
  overall: number;
  askingSalary: number;
}

export interface MarketMove {
  seasonNumber: number;
  type: 'signed' | 'renewed' | 'released' | 'expired' | 'retired';
  playerName: string;
  salary: number | null;
  endSeason: number | null;
  cost: number | null;
}

export interface MarketView {
  /** True between seasons: signings, renewals and releases are allowed. */
  open: boolean;
  payroll: number;
  /** Contracts that stay next season (expired ones excluded). */
  payrollNextSeason: number;
  /** What the club will commit to in salaries: the lower of the league cap and its wage budget. */
  salaryLimit: number;
  salaryCap: number;
  wageBudget: number;
  wageSharePercent: number;
  minSalary: number;
  rosterMin: number;
  rosterMax: number;
  rosterSize: number;
  /** Why the season cannot start yet, or null. */
  problem: string | null;
  /** Best free agents (by what clubs think of them), at most 150. */
  freeAgents: FreeAgentRow[];
  freeAgentCount: number;
  moves: MarketMove[];
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

export interface FinanceView {
  balance: number;
  /** How far into debt the club may go. */
  overdraftLimit: number;
  restricted: boolean;
  reputation: number;
  /** Reputation a typical club of this league has. */
  typicalReputation: number;
  lastRevenue: number;
  wageBudget: number;
  payroll: number;
  fixedCosts: number;
  /** What the club would earn next season at its current reputation. */
  expectedRevenue: number;
  /** One record per finished season, newest first. */
  history: TeamFinanceRecord[];
}

/** Everything the UI needs to draw the current state of the game. */
export interface GameView {
  clubData: 'generated' | 'defined' | 'mixed';
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
  market: MarketView | null;
  finance: FinanceView | null;
}

export interface HalftimeView {
  matchId: string;
  detail: Pick<MatchDetail, 'events' | 'boxScore'>;
  playerNames: Record<string, string>;
  tactics: HalftimeTactics;
}

export type Reply =
  | { id: number; type: 'dataPack'; summary: DataPackSummary | null; message: string }
  | { id: number; type: 'world'; result: WorldPayload }
  | { id: number; type: 'slots'; slots: SlotSummary[]; autosave: boolean; message: string }
  | { id: number; type: 'halftime'; match: HalftimeView }
  | {
      id: number;
      type: 'state';
      view: GameView;
      message: string;
      watchedMatchId?: string;
      storageWarning?: string;
    }
  | {
      id: number;
      type: 'matchDetail';
      detail: MatchDetail;
      playerNames: Record<string, string>;
      /** Tactics each team used in this match, by team id. */
      tactics: Record<string, TeamTactics>;
      halftimeTactics?: HalftimeTactics;
      ms: number;
    }
  | { id: number; type: 'save'; json: string; fileName: string }
  | { id: number; type: 'error'; message: string };
