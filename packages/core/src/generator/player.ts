import type { NamePool, Player, PlayerAttributes, Position } from '@bm27/schema';
import { POSITIONS } from '@bm27/schema';
import type { Rng } from '../rng';
import { DEVELOPMENT, developPlayer } from './development';

type FlatKey =
  | keyof PlayerAttributes['offensive']
  | keyof PlayerAttributes['defensive']
  | keyof PlayerAttributes['physical']
  | keyof PlayerAttributes['mental'];

/** Attribute offsets by primary position, so that guards and bigs look different. */
const POSITION_PROFILE: Record<Position, Partial<Record<FlatKey, number>>> = {
  PG: {
    ballHandling: 10,
    passing: 10,
    threePoint: 4,
    speed: 6,
    offensiveRebound: -12,
    defensiveRebound: -10,
    interiorDefense: -10,
    block: -12,
    strength: -6,
    closeShot: -4,
    steal: 5,
  },
  SG: {
    threePoint: 8,
    midRange: 5,
    ballHandling: 3,
    offensiveRebound: -8,
    defensiveRebound: -6,
    block: -8,
    interiorDefense: -6,
    perimeterDefense: 3,
  },
  SF: {},
  PF: {
    offensiveRebound: 7,
    defensiveRebound: 7,
    interiorDefense: 6,
    strength: 6,
    closeShot: 5,
    block: 3,
    ballHandling: -8,
    threePoint: -5,
    passing: -5,
  },
  C: {
    offensiveRebound: 12,
    defensiveRebound: 12,
    interiorDefense: 10,
    block: 10,
    strength: 10,
    closeShot: 8,
    ballHandling: -14,
    threePoint: -14,
    passing: -8,
    speed: -8,
    midRange: -5,
    perimeterDefense: -8,
  },
};

const HEIGHT_BY_POSITION: Record<Position, number> = { PG: 188, SG: 194, SF: 200, PF: 205, C: 210 };

function clampAttr(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

export interface GeneratePlayerInput {
  id: string;
  /** Club of the player, or null for a free agent. */
  teamId: string | null;
  /**
   * Target ability (average attribute, 1–99) of a typical player of this
   * kind in his prime. Younger and older players are generated below it.
   */
  quality: number;
  position: Position;
  minAge: number;
  maxAge: number;
  /** Exact age; overrides `minAge` and `maxAge`. */
  age?: number;
}

/** Added to `quality` to get the mean potential, so that primes land on `quality`. */
const POTENTIAL_OFFSET = 4.2;

/**
 * Creates a player by generating him as an 18-year-old prospect and then
 * running the development model year by year up to his age. This keeps freshly
 * generated squads consistent with how players evolve later on.
 */
export function generatePlayer(rng: Rng, names: NamePool, input: GeneratePlayerInput): Player {
  const profile = POSITION_PROFILE[input.position];
  const potential = Math.max(
    20,
    Math.min(99, Math.round(input.quality + POTENTIAL_OFFSET + rng.normal(0, 5))),
  );
  const base = potential - (DEVELOPMENT.youthGap + rng.normal(0, DEVELOPMENT.youthGapSpread));
  // Mental attributes never decline in the development model, so prospects start a
  // little lower in them; the offset was calibrated so that squad balance between
  // attribute groups matches the T-002 engine calibration (see docs/benchmarks/T-004-estabilidad.md).
  const MENTAL: readonly FlatKey[] = ['decisions', 'composure', 'workRate', 'discipline'];
  const attr = (key: FlatKey): number =>
    clampAttr(base + (profile[key] ?? 0) - (MENTAL.includes(key) ? 0.8 : 0) + rng.normal(0, 6));

  const attributes: PlayerAttributes = {
    offensive: {
      closeShot: attr('closeShot'),
      midRange: attr('midRange'),
      threePoint: attr('threePoint'),
      freeThrow: attr('freeThrow'),
      passing: attr('passing'),
      ballHandling: attr('ballHandling'),
      offensiveRebound: attr('offensiveRebound'),
    },
    defensive: {
      perimeterDefense: attr('perimeterDefense'),
      interiorDefense: attr('interiorDefense'),
      steal: attr('steal'),
      block: attr('block'),
      defensiveRebound: attr('defensiveRebound'),
    },
    physical: {
      speed: attr('speed'),
      strength: attr('strength'),
      stamina: attr('stamina'),
      jumping: attr('jumping'),
    },
    mental: {
      decisions: attr('decisions'),
      composure: attr('composure'),
      workRate: attr('workRate'),
      discipline: attr('discipline'),
    },
  };

  const positions: Position[] = [input.position];
  if (rng.chance(0.35)) {
    const index = POSITIONS.indexOf(input.position);
    const neighbours = [index - 1, index + 1].filter((i) => i >= 0 && i < POSITIONS.length);
    positions.push(POSITIONS[rng.pick(neighbours)] as Position);
  }

  const heightCm = Math.max(
    165,
    Math.min(228, Math.round(rng.normal(HEIGHT_BY_POSITION[input.position], 4))),
  );

  let player: Player = {
    id: input.id,
    firstName: rng.pick(names.firstNames),
    lastName: `${rng.pick(names.lastNames)} ${rng.pick(names.lastNames)}`,
    age: DEVELOPMENT.startAge,
    heightCm,
    positions,
    attributes,
    potential,
    teamId: input.teamId,
    // Contracts are agreed by whoever signs the player (the universe generator or the market).
    contract: null,
    retired: false,
    injury: null,
  };
  const targetAge = Math.max(
    DEVELOPMENT.startAge,
    input.age ?? rng.int(input.minAge, input.maxAge),
  );
  while (player.age < targetAge) player = developPlayer(player, rng);
  return player;
}

export function playerId(seq: number): string {
  return `p${String(seq).padStart(6, '0')}`;
}
