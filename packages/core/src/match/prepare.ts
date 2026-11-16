import { POSITIONS, type Player, type Team } from '@bm27/schema';

/** Player data pre-digested for the match engine (plain numbers, no lookups). */
export interface SimPlayer {
  id: string;
  overall: number;
  /** How well the player fits each of the five court slots (PG..C), 0–1. */
  slotFit: number[];
  /** Relative weight for ending a possession (shot or turnover). */
  usage: number;
  /** Cumulative probabilities of shot type: [rim, rim+mid]. The rest is three. */
  shotMix: [number, number];
  // Normalised attributes: (value - 50) / 50, i.e. roughly -1..1.
  close: number;
  mid: number;
  three: number;
  freeThrow: number;
  passing: number;
  handling: number;
  decisions: number;
  perimeterDefense: number;
  interiorDefense: number;
  steal: number;
  block: number;
  discipline: number;
  /** Raw 1–99 rebounding strength. */
  offensiveRebound: number;
  defensiveRebound: number;
  /** Energy lost per second on court. */
  drain: number;
}

export interface PreparedTeam {
  teamId: string;
  /** Rotation order: the five starters by slot (PG..C), then the bench by overall. */
  players: SimPlayer[];
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

function toSimPlayer(player: Player): SimPlayer {
  const { offensive: o, defensive: d, physical: p, mental: m } = player.attributes;
  const positionIndexes = player.positions.map((pos) => POSITIONS.indexOf(pos));
  const slotFit = [0, 1, 2, 3, 4].map((slot) => {
    if (positionIndexes.includes(slot)) return 1;
    const distance = Math.min(...positionIndexes.map((i) => Math.abs(i - slot)));
    return distance === 1 ? 0.93 : 0.8;
  });

  const primary = positionIndexes[0] ?? 2;
  const isBig = primary >= 3;
  const wRim = 0.38 * (0.5 + o.closeShot / 100 + (isBig ? 0.25 : 0));
  const wMid = 0.2 * (0.5 + o.midRange / 100);
  const wThree = 0.42 * (0.3 + (1.4 * o.threePoint) / 100) * (primary === 4 ? 0.5 : 1);
  const total = wRim + wMid + wThree;

  const bestShot = Math.max(o.closeShot, o.midRange, o.threePoint);
  const meanShot = (o.closeShot + o.midRange + o.threePoint) / 3;
  const offenseComposite = 0.5 * bestShot + 0.3 * meanShot + 0.2 * o.ballHandling;

  return {
    id: player.id,
    overall: playerOverall(player),
    slotFit,
    usage: Math.exp((offenseComposite - 50) / 15),
    shotMix: [wRim / total, (wRim + wMid) / total],
    close: norm(o.closeShot),
    mid: norm(o.midRange),
    three: norm(o.threePoint),
    freeThrow: norm(o.freeThrow),
    passing: norm(o.passing),
    handling: norm(o.ballHandling),
    decisions: norm(m.decisions),
    perimeterDefense: norm(d.perimeterDefense),
    interiorDefense: norm(d.interiorDefense),
    steal: norm(d.steal),
    block: norm(d.block),
    discipline: norm(m.discipline),
    offensiveRebound: (o.offensiveRebound * 2 + p.jumping + player.heightCm - 150) / 4,
    defensiveRebound: (d.defensiveRebound * 2 + p.jumping + player.heightCm - 150) / 4,
    drain: 0.00115 * (1.25 - p.stamina / 200),
  };
}

/**
 * Picks starters (best available player per position) and orders the bench.
 * PLACEHOLDER: there is no coach or tactics yet; rotation is purely by rating.
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
  return { teamId: team.id, players: [...starters, ...bench] };
}
