import { DEFAULT_TACTICS, POSITIONS, type Player, type Team, type TeamTactics } from '@bm27/schema';

/**
 * Player data pre-digested for the match engine (plain numbers, no lookups).
 * Unless noted, attributes are normalised as (value - 50) / 50, roughly -1..1.
 */
export interface SimPlayer {
  id: string;
  overall: number;
  /** How well the player fits each of the five court slots (PG..C), 0–1. */
  slotFit: number[];

  close: number;
  mid: number;
  three: number;
  freeThrow: number;
  passing: number;
  handling: number;
  perimeterDefense: number;
  interiorDefense: number;
  steal: number;
  block: number;
  speed: number;
  strength: number;
  jumping: number;
  decisions: number;
  composure: number;
  workRate: number;
  discipline: number;
  /** (height - 198 cm) / 15. */
  height: number;
  /** Raw 1–99 rebounding strength. */
  offensiveRebound: number;
  defensiveRebound: number;
  /** Energy lost per second on court. */
  drain: number;

  // Role weights: how likely the team is to use this player in each role.
  roleHandler: number;
  roleScreener: number;
  roleIso: number;
  rolePost: number;
  roleSpot: number;
  roleCut: number;
  roleOffScreen: number;
  roleTransition: number;
}

export interface PreparedTeam {
  teamId: string;
  /** Rotation order: the five starters by slot (PG..C), then the bench by overall. */
  players: SimPlayer[];
  tactics: TeamTactics;
  /** Share of the game each player should play (same order as `players`; sums to 5). */
  minuteShare: number[];
}

const norm = (value: number): number => (value - 50) / 50;

/** Single-number rating: mean of the player's 12 best attributes. */
export function playerOverall(player: Player): number {
  const a = player.attributes;
  const values = [
    ...Object.values(a.offensive),
    ...Object.values(a.defensive),
    ...Object.values(a.physical),
    ...Object.values(a.mental),
  ].sort((x, y) => y - x);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += values[i] as number;
  return sum / 12;
}

/** Turns a 1–99 composite into a positive selection weight. */
const role = (composite: number, spread: number): number => Math.exp((composite - 50) / spread);

function toSimPlayer(player: Player): SimPlayer {
  const { offensive: o, defensive: d, physical: p, mental: m } = player.attributes;
  const positionIndexes = player.positions.map((pos) => POSITIONS.indexOf(pos));
  const slotFit = [0, 1, 2, 3, 4].map((slot) => {
    if (positionIndexes.includes(slot)) return 1;
    const distance = Math.min(...positionIndexes.map((i) => Math.abs(i - slot)));
    return distance === 1 ? 0.93 : 0.8;
  });
  const primary = positionIndexes[0] ?? 2;
  const bigness = [0.25, 0.4, 0.7, 1.15, 1.4][primary] as number;
  const guardness = [1.35, 1.15, 0.9, 0.55, 0.35][primary] as number;
  const bestShot = Math.max(o.closeShot, o.midRange, o.threePoint);
  const heightScore = Math.max(1, Math.min(99, 50 + (player.heightCm - 198) * 2.5));

  return {
    id: player.id,
    overall: playerOverall(player),
    slotFit,
    close: norm(o.closeShot),
    mid: norm(o.midRange),
    three: norm(o.threePoint),
    freeThrow: norm(o.freeThrow),
    passing: norm(o.passing),
    handling: norm(o.ballHandling),
    perimeterDefense: norm(d.perimeterDefense),
    interiorDefense: norm(d.interiorDefense),
    steal: norm(d.steal),
    block: norm(d.block),
    speed: norm(p.speed),
    strength: norm(p.strength),
    jumping: norm(p.jumping),
    decisions: norm(m.decisions),
    composure: norm(m.composure),
    workRate: norm(m.workRate),
    discipline: norm(m.discipline),
    height: (player.heightCm - 198) / 15,
    offensiveRebound: (o.offensiveRebound * 2 + p.jumping + player.heightCm - 150) / 4,
    defensiveRebound: (d.defensiveRebound * 2 + p.jumping + player.heightCm - 150) / 4,
    drain: 0.00115 * (1.25 - p.stamina / 200),

    roleHandler:
      guardness *
      role(0.4 * o.ballHandling + 0.25 * o.passing + 0.2 * m.decisions + 0.15 * p.speed, 11),
    roleScreener: bigness * role(0.35 * p.strength + 0.35 * o.closeShot + 0.3 * p.jumping, 16),
    roleIso: role(0.35 * o.ballHandling + 0.3 * bestShot + 0.2 * p.speed + 0.15 * m.composure, 10),
    rolePost: bigness * role(0.45 * o.closeShot + 0.35 * p.strength + 0.2 * heightScore, 11),
    roleSpot: role(0.75 * o.threePoint + 0.25 * o.midRange, 12),
    roleCut: role(0.4 * p.speed + 0.3 * o.closeShot + 0.3 * m.workRate, 16),
    roleOffScreen: guardness * role(0.6 * o.threePoint + 0.2 * p.speed + 0.2 * m.workRate, 11),
    roleTransition: role(0.5 * p.speed + 0.25 * o.closeShot + 0.25 * o.ballHandling, 14),
  };
}

/** Planned share of the game for each rotation spot. */
function minuteShares(rosterSize: number, depth: number): number[] {
  const rotation = Math.max(5, Math.min(depth, rosterSize));
  const shares = new Array<number>(rosterSize).fill(0);
  const starters = [0.74, 0.72, 0.7, 0.68, 0.66];
  const benchSpots = rotation - 5;
  if (benchSpots === 0) return shares.map((_, i) => (i < 5 ? 1 : 0));
  let total = 0;
  const weights: number[] = [];
  for (let i = 0; i < benchSpots; i++) {
    const w = Math.pow(0.76, i);
    weights.push(w);
    total += w;
  }
  const benchTotal = 5 - starters.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) shares[i] = starters[i] as number;
  for (let i = 0; i < benchSpots; i++)
    shares[5 + i] = (benchTotal * (weights[i] as number)) / total;
  return shares;
}

/**
 * Picks starters (best available player per position), orders the bench and
 * builds the minutes plan.
 *
 * PLACEHOLDER coach: the starting five and the minutes plan come purely from
 * overall rating; there is no human or AI line-up choice yet.
 */
export function prepareTeam(team: Team, playersById: ReadonlyMap<string, Player>): PreparedTeam {
  const roster: SimPlayer[] = [];
  for (const id of team.playerIds) {
    const player = playersById.get(id);
    if (!player) throw new Error(`Team ${team.id}: player ${id} not found`);
    roster.push(toSimPlayer(player));
  }
  if (roster.length < 5) throw new Error(`Team ${team.id} has fewer than 5 players`);

  // Stable order: by overall, ties broken by id so results never depend on input order.
  roster.sort((a, b) => b.overall - a.overall || (a.id < b.id ? -1 : 1));

  const used = new Set<SimPlayer>();
  const starters: SimPlayer[] = [];
  for (let slot = 0; slot < 5; slot++) {
    const natural = roster.find((p) => !used.has(p) && p.slotFit[slot] === 1);
    const chosen = natural ?? roster.find((p) => !used.has(p));
    if (!chosen) throw new Error('unreachable: roster has at least 5 players');
    used.add(chosen);
    starters.push(chosen);
  }
  const bench = roster.filter((p) => !used.has(p));
  const tactics = team.tactics ?? DEFAULT_TACTICS;

  // Starters get the starter shares ordered by quality, not by court slot.
  const players = [...starters, ...bench];
  const shares = minuteShares(players.length, tactics.rotationDepth);
  const starterOrder = [0, 1, 2, 3, 4].sort(
    (a, b) => (players[b] as SimPlayer).overall - (players[a] as SimPlayer).overall,
  );
  const minuteShare = shares.slice();
  starterOrder.forEach((playerIndex, rank) => {
    minuteShare[playerIndex] = shares[rank] as number;
  });

  return { teamId: team.id, players, tactics, minuteShare };
}
