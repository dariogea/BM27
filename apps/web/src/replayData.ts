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
const emptyPlayer = { points: 0, ...emptyTotals };
export type ReplayPlayerTotals = Readonly<typeof emptyPlayer>;
export function replayPlayerTotals(frame: ReplayFrame, id: string): ReplayPlayerTotals {
  return frame.playerTotals.get(id) ?? emptyPlayer;
}

export interface ReplayFrame {
  event: MatchEvent | null;
  period: number;
  clock: number;
  homeScore: number;
  awayScore: number;
  homeTotals: ReplayTotals;
  awayTotals: ReplayTotals;
  playerTotals: ReadonlyMap<string, ReplayPlayerTotals>;
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
  let playerTotals = new Map<string, ReplayPlayerTotals>();
  const changes = new Map<string, typeof emptyPlayer>();
  const credit = (id: string, key: keyof ReplayPlayerTotals, value = 1): void => {
    const team = owner(id);
    if (!value) return;
    let player = changes.get(id);
    if (!player) {
      player = { ...(playerTotals.get(id) ?? emptyPlayer) };
      changes.set(id, player);
    }
    player[key] += value;
    if (key === 'points') {
      if (team === homeId) homeScore += value;
      else awayScore += value;
    } else {
      totals.get(team)![key] += value;
    }
  };
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
      playerTotals,
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
    // Attribute each event to its player, including technical free throws and defensive plays.
    switch (event.type) {
      case 'shot':
        shots.push({ at: index + 1, teamId: owner(event.playerId), event });
        credit(event.playerId, 'points', event.made ? event.points : 0);
        credit(event.playerId, 'fieldGoalsAttempted');
        credit(event.playerId, 'fieldGoalsMade', Number(event.made));
        if (event.shotType === 'three') {
          credit(event.playerId, 'threePointersAttempted');
          credit(event.playerId, 'threePointersMade', Number(event.made));
        }
        if (event.assistPlayerId) credit(event.assistPlayerId, 'assists');
        if (event.blockPlayerId) credit(event.blockPlayerId, 'blocks');
        break;
      case 'free_throw':
        credit(event.playerId, 'freeThrowsAttempted');
        credit(event.playerId, 'freeThrowsMade', Number(event.made));
        credit(event.playerId, 'points', Number(event.made));
        break;
      case 'rebound':
        credit(
          event.playerId,
          event.kind === 'offensive' ? 'offensiveRebounds' : 'defensiveRebounds',
        );
        break;
      case 'turnover':
        credit(event.playerId, 'turnovers');
        if (event.stealPlayerId) credit(event.stealPlayerId, 'steals');
        break;
      case 'foul':
        credit(event.playerId, 'fouls');
        break;
    }
    // Share unchanged lines and never mutate a frame that the user can rewind to.
    if (changes.size > 0) {
      playerTotals = new Map(playerTotals);
      for (const [id, line] of changes) playerTotals.set(id, line);
      changes.clear();
    }
    frames.push({
      event,
      period: event.period,
      clock: event.clock,
      homeScore,
      awayScore,
      homeTotals: { ...totals.get(homeId)! },
      awayTotals: { ...totals.get(awayId)! },
      playerTotals,
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
