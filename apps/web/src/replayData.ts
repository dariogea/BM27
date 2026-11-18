import type { MatchDetail, MatchEvent, StatLine } from '@bm27/schema';

const emptyTotals = {
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
} satisfies Partial<StatLine>;
export type ReplayTotals = Readonly<typeof emptyTotals>;

export interface ReplayFrame {
  event: MatchEvent | null;
  period: number;
  clock: number;
  homeScore: number;
  awayScore: number;
  homeTotals: ReplayTotals;
  awayTotals: ReplayTotals;
  homePlayers: readonly string[];
  awayPlayers: readonly string[];
}
export interface ReplayShot {
  at: number;
  teamId: string;
  event: Extract<MatchEvent, { type: 'shot' }>;
}

/** Exact snapshots of recorded events. No simulated positions or random calls. */
export function buildReplay(detail: MatchDetail): { frames: ReplayFrame[]; shots: ReplayShot[] } {
  const homeId = detail.boxScore.home.teamId;
  const awayId = detail.boxScore.away.teamId;
  const teamByPlayer = new Map([
    ...detail.boxScore.home.players.map((p) => [p.playerId, homeId] as const),
    ...detail.boxScore.away.players.map((p) => [p.playerId, awayId] as const),
  ]);
  const owner = (playerId: string): string => {
    const team = teamByPlayer.get(playerId);
    if (!team) throw new Error(`El registro cita un jugador ajeno al acta: ${playerId}`);
    return team;
  };
  let homeScore = 0;
  let awayScore = 0;
  const totals = new Map([
    [homeId, { ...emptyTotals }],
    [awayId, { ...emptyTotals }],
  ]);
  const playerTotals = (id: string) => totals.get(owner(id))!;
  let homePlayers: readonly string[] = [];
  let awayPlayers: readonly string[] = [];
  const first = detail.events[0];
  const frames: ReplayFrame[] = [
    {
      event: null,
      period: first?.period ?? 1,
      clock: first?.clock ?? 0,
      homeScore,
      awayScore,
      homeTotals: emptyTotals,
      awayTotals: emptyTotals,
      homePlayers,
      awayPlayers,
    },
  ];
  const shots: ReplayShot[] = [];
  for (const [index, event] of detail.events.entries()) {
    if (event.type === 'lineup') {
      if (event.teamId === homeId) homePlayers = [...event.playerIds];
      else if (event.teamId === awayId) awayPlayers = [...event.playerIds];
    } else if (event.type === 'substitution') {
      const replace = (players: readonly string[]) =>
        players.map((id) => (id === event.playerOutId ? event.playerInId : id));
      if (event.teamId === homeId) homePlayers = replace(homePlayers);
      else if (event.teamId === awayId) awayPlayers = replace(awayPlayers);
    }
    if (event.type === 'shot' || event.type === 'free_throw') {
      // Technical free throws may be taken by the team without possession.
      const teamId = owner(event.playerId);
      const points = event.made ? (event.type === 'shot' ? event.points : 1) : 0;
      if (teamId === homeId) homeScore += points;
      else awayScore += points;
      const shooter = totals.get(teamId)!;
      if (event.type === 'shot') {
        shots.push({ at: index + 1, teamId, event });
        shooter.fieldGoalsAttempted++;
        shooter.fieldGoalsMade += Number(event.made);
        if (event.shotType === 'three') {
          shooter.threePointersAttempted++;
          shooter.threePointersMade += Number(event.made);
        }
        if (event.assistPlayerId) playerTotals(event.assistPlayerId).assists++;
        if (event.blockPlayerId) playerTotals(event.blockPlayerId).blocks++;
      } else {
        shooter.freeThrowsAttempted++;
        shooter.freeThrowsMade += Number(event.made);
      }
    } else if (event.type === 'rebound') {
      const rebounder = playerTotals(event.playerId);
      if (event.kind === 'offensive') rebounder.offensiveRebounds++;
      else rebounder.defensiveRebounds++;
    } else if (event.type === 'turnover') {
      playerTotals(event.playerId).turnovers++;
      if (event.stealPlayerId) playerTotals(event.stealPlayerId).steals++;
    } else if (event.type === 'foul') {
      playerTotals(event.playerId).fouls++;
    }
    frames.push({
      event,
      period: event.period,
      clock: event.clock,
      homeScore,
      awayScore,
      homeTotals: { ...totals.get(homeId)! },
      awayTotals: { ...totals.get(awayId)! },
      homePlayers,
      awayPlayers,
    });
  }
  return { frames, shots };
}

export function replayEventText(event: MatchEvent | null, who: (id: string) => string): string {
  if (!event) return 'Pulsa Reproducir para recorrer el registro del partido.';
  switch (event.type) {
    case 'shot':
      return `${who(event.playerId)}: ${event.made ? 'canasta' : 'fallo'} de ${event.shotType === 'three' ? 3 : 2} puntos.`;
    case 'free_throw':
      return `${who(event.playerId)}: tiro libre ${event.made ? 'anotado' : 'fallado'}.`;
    case 'substitution':
      return `Entra ${who(event.playerInId)} por ${who(event.playerOutId)}.`;
    case 'lineup':
      return 'Quinteto inicial registrado.';
    case 'period_start':
      return `Empieza el periodo ${event.period}.`;
    case 'period_end':
      return `Termina el periodo ${event.period}.`;
    case 'game_end':
      return 'Final del partido.';
    case 'rebound':
      return `${who(event.playerId)}: rebote ${event.kind === 'offensive' ? 'ofensivo' : 'defensivo'}.`;
    case 'turnover':
      return `${who(event.playerId)} pierde el balón.${event.stealPlayerId ? ` Robo de ${who(event.stealPlayerId)}.` : ''}`;
    case 'foul':
      return `${who(event.playerId)}: ${event.kind === 'technical' ? 'falta técnica' : event.kind === 'unsportsmanlike' ? 'falta antideportiva' : event.kind === 'offensive' ? 'falta en ataque' : event.kind === 'shooting' ? 'falta de tiro' : 'falta personal'}.${event.fouledOut ? ' Debe abandonar el partido.' : ''}`;
    case 'injury':
      return `${who(event.playerId)} se lesiona: ${event.gamesOut} partidos de baja.`;
    case 'timeout':
      return 'Tiempo muerto registrado.';
    case 'jump_ball':
      return event.kind === 'opening'
        ? 'Salto inicial.'
        : 'Balón retenido: se aplica la flecha de posesión.';
  }
}
export const replayClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
