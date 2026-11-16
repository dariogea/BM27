import type { BoxScore, MatchEvent, PlayerBoxLine, StatLine, TeamBoxScore } from '@bm27/schema';

export interface TeamSheet {
  teamId: string;
  /** Every player on the match roster (including those who do not play). */
  playerIds: readonly string[];
}

export function emptyStatLine(): StatLine {
  return {
    seconds: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
  };
}

export const STAT_KEYS = Object.keys(emptyStatLine()) as (keyof StatLine)[];

export function addStatLine(target: StatLine, source: StatLine): void {
  for (const key of STAT_KEYS) target[key] += source[key];
}

interface TeamAccumulator {
  teamId: string;
  lines: PlayerBoxLine[];
  periodPoints: number[];
  possessions: number;
  lastPossession: number;
}

/**
 * Derives the complete box score from the event log alone. Nothing here is
 * computed by the engine: if it is not in the events, it is not in the box score.
 */
export function deriveBoxScore(
  events: readonly MatchEvent[],
  home: TeamSheet,
  away: TeamSheet,
): BoxScore {
  const lineByPlayer = new Map<string, PlayerBoxLine>();
  const teamByPlayer = new Map<string, TeamAccumulator>();
  const makeTeam = (sheet: TeamSheet): TeamAccumulator => {
    const acc: TeamAccumulator = {
      teamId: sheet.teamId,
      lines: [],
      periodPoints: [],
      possessions: 0,
      lastPossession: -1,
    };
    for (const playerId of sheet.playerIds) {
      const line: PlayerBoxLine = { playerId, starter: false, ...emptyStatLine() };
      acc.lines.push(line);
      lineByPlayer.set(playerId, line);
      teamByPlayer.set(playerId, acc);
    }
    return acc;
  };
  const homeAcc = makeTeam(home);
  const awayAcc = makeTeam(away);
  const teamById = new Map([
    [home.teamId, homeAcc],
    [away.teamId, awayAcc],
  ]);

  const line = (playerId: string): PlayerBoxLine => {
    const found = lineByPlayer.get(playerId);
    if (!found) throw new Error(`Event references unknown player ${playerId}`);
    return found;
  };
  const score = (playerId: string, points: number, period: number): void => {
    line(playerId).points += points;
    const acc = teamByPlayer.get(playerId) as TeamAccumulator;
    acc.periodPoints[period - 1] = (acc.periodPoints[period - 1] ?? 0) + points;
  };
  const countPossession = (event: MatchEvent): void => {
    const acc = teamById.get(event.offenseTeamId);
    if (acc && acc.lastPossession !== event.possession) {
      acc.lastPossession = event.possession;
      acc.possessions++;
    }
  };

  // Time on court: elapsed game seconds at which each player entered.
  const enteredAt = new Map<string, number>();
  let periodStart = 0;
  let periodSeconds = 0;
  const elapsed = (event: MatchEvent): number => periodStart + (periodSeconds - event.clock);

  for (const event of events) {
    switch (event.type) {
      case 'period_start':
        periodSeconds = event.periodSeconds;
        homeAcc.periodPoints[event.period - 1] ??= 0;
        awayAcc.periodPoints[event.period - 1] ??= 0;
        break;
      case 'period_end':
        periodStart += periodSeconds;
        periodSeconds = 0;
        break;
      case 'lineup':
        for (const playerId of event.playerIds) {
          line(playerId).starter = true;
          enteredAt.set(playerId, elapsed(event));
        }
        break;
      case 'substitution': {
        const now = elapsed(event);
        const since = enteredAt.get(event.playerOutId);
        if (since !== undefined) {
          line(event.playerOutId).seconds += now - since;
          enteredAt.delete(event.playerOutId);
        }
        enteredAt.set(event.playerInId, now);
        break;
      }
      case 'shot': {
        countPossession(event);
        const shooter = line(event.playerId);
        shooter.fieldGoalsAttempted++;
        if (event.shotType === 'three') shooter.threePointersAttempted++;
        if (event.made) {
          shooter.fieldGoalsMade++;
          if (event.shotType === 'three') shooter.threePointersMade++;
          score(event.playerId, event.points, event.period);
        }
        if (event.assistPlayerId) line(event.assistPlayerId).assists++;
        if (event.blockPlayerId) line(event.blockPlayerId).blocks++;
        break;
      }
      case 'free_throw': {
        countPossession(event);
        const shooter = line(event.playerId);
        shooter.freeThrowsAttempted++;
        if (event.made) {
          shooter.freeThrowsMade++;
          score(event.playerId, 1, event.period);
        }
        break;
      }
      case 'rebound':
        if (event.kind === 'offensive') line(event.playerId).offensiveRebounds++;
        else line(event.playerId).defensiveRebounds++;
        break;
      case 'turnover':
        countPossession(event);
        line(event.playerId).turnovers++;
        if (event.stealPlayerId) line(event.stealPlayerId).steals++;
        break;
      case 'foul':
        countPossession(event);
        line(event.playerId).fouls++;
        break;
      case 'game_end':
        for (const [playerId, since] of enteredAt) line(playerId).seconds += periodStart - since;
        enteredAt.clear();
        break;
    }
  }

  const finish = (acc: TeamAccumulator): TeamBoxScore => {
    const totals = emptyStatLine();
    for (const l of acc.lines) addStatLine(totals, l);
    return {
      teamId: acc.teamId,
      points: totals.points,
      periodPoints: acc.periodPoints,
      possessions: acc.possessions,
      players: acc.lines,
      totals,
    };
  };
  return { home: finish(homeAcc), away: finish(awayAcc) };
}
