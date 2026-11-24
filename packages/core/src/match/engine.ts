import type {
  FoulKind,
  MatchEvent,
  PlayType,
  Ruleset,
  ShotType,
  ShotZone,
  TeamTactics,
  TurnoverKind,
} from '@bm27/schema';
import { createRng } from '../rng';
import type { PreparedTeam, SimPlayer } from './prepare';

/**
 * MATCH ENGINE v1 (T-002).
 *
 * Possession-based engine built around play types (pick and roll, isolation,
 * post-up, spot-up, cut, off-screen, transition, putback). Each play picks its
 * actors from the players on court, confronts them with their defenders under
 * the defensive tactics, and produces a turnover, a foul or a shot with a
 * court zone and an "openness" value.
 *
 * Contract: the ONLY output is the event log; box scores and any viewer are
 * derived from it (see `deriveBoxScore`).
 *
 * T-028 adds timeouts, in-game injuries, technical and unsportsmanlike fouls, the
 * opening jump ball and the possession arrow (held balls).
 *
 * Still PLACEHOLDER inside this engine (to be replaced in later tasks):
 *  - The coach: starters, minutes plan, substitutions and timeouts follow fixed rules.
 *  - No and-one variety; an injured player who cannot be replaced stays on court.
 *  - Help defense is a single "rim protection" number per line-up.
 *  - All numeric constants are calibrated against approximate league averages
 *    (see docs/benchmarks/T-002.md), not against a verified dataset.
 */
export const ENGINE = {
  homeShotBonus: 0.02,

  // --- Time (seconds) --------------------------------------------------------
  halfCourtMinSeconds: 10,
  transitionMinSeconds: 3,
  transitionMaxSeconds: 8,
  resetMinSeconds: 4,
  paceTime: { slow: 1.12, normal: 1, fast: 0.87 },

  // --- Play selection --------------------------------------------------------
  playMix: {
    'pick-and-roll': 0.3,
    isolation: 0.09,
    'post-up': 0.09,
    'spot-up': 0.26,
    cut: 0.08,
    'off-screen': 0.08,
  },
  focusMix: {
    inside: {
      'pick-and-roll': 1,
      isolation: 1,
      'post-up': 1.9,
      'spot-up': 0.75,
      cut: 1.4,
      'off-screen': 0.6,
    },
    balanced: {
      'pick-and-roll': 1,
      isolation: 1,
      'post-up': 1,
      'spot-up': 1,
      cut: 1,
      'off-screen': 1,
    },
    perimeter: {
      'pick-and-roll': 1,
      isolation: 1,
      'post-up': 0.45,
      'spot-up': 1.3,
      cut: 0.8,
      'off-screen': 1.6,
    },
  },
  /** Shift in the probability of choosing a three over a two when both are possible. */
  focusThreeShift: { inside: -0.12, balanced: 0, perimeter: 0.12 },
  transitionChance: { steal: 0.55, 'defensive-rebound': 0.16, made: 0.03, dead: 0 },
  paceTransition: { slow: 0.65, normal: 1, fast: 1.4 },
  putbackChance: 0.36,

  // --- Turnovers -------------------------------------------------------------
  turnoverBase: {
    'pick-and-roll': 0.185,
    isolation: 0.135,
    'post-up': 0.17,
    'spot-up': 0.112,
    cut: 0.175,
    'off-screen': 0.112,
    transition: 0.17,
    putback: 0.03,
  },
  paceTurnover: { slow: 0.97, normal: 1, fast: 1.04 },
  pressureTurnover: { low: 0.88, normal: 1, high: 1.15 },
  zoneTurnover: 0.92,
  shotClockViolation: 0.007,

  // --- Fouls -----------------------------------------------------------------
  floorFoulBase: 0.172,
  shootingFoul: {
    restricted: 0.235,
    paint: 0.15,
    midrange: 0.045,
    corner3: 0.025,
    'above-break3': 0.025,
  },
  pressureFoul: { low: 0.8, normal: 1, high: 1.3 },
  zoneFoul: 0.85,
  andOneFactor: 0.33,

  // --- Shooting --------------------------------------------------------------
  makeBase: {
    restricted: 0.56,
    paint: 0.37,
    midrange: 0.315,
    corner3: 0.285,
    'above-break3': 0.265,
  },
  makeSkillWeight: 0.22,
  makeDefenseWeight: 0.13,
  makeOpenWeight: {
    restricted: 0.1,
    paint: 0.09,
    midrange: 0.08,
    corner3: 0.075,
    'above-break3': 0.075,
  },
  zoneInteriorBonus: 0.18,
  pressureOpenness: { low: -0.1, normal: 0, high: 0.16 },
  paceOpenness: { slow: 0.01, normal: 0, fast: -0.01 },
  blockBase: {
    restricted: 0.14,
    paint: 0.07,
    midrange: 0.015,
    corner3: 0.008,
    'above-break3': 0.008,
  },
  assistCredit: 0.95,
  freeThrowBase: 0.645,

  // --- Rebounding ------------------------------------------------------------
  offensiveReboundBase: 0.275,
  crashRebound: { 'get-back': 0.88, normal: 1, crash: 1.15 },
  crashTransitionAllowed: { 'get-back': 0.5, normal: 1, crash: 1.7 },
  zoneReboundPenalty: 1.1,

  // --- Energy and rotation ---------------------------------------------------
  energyRecoveryPerSecond: 0.0016,
  minEnergy: 0.3,
  paceDrain: { slow: 0.95, normal: 1, fast: 1.08 },
  pressureDrain: { low: 0.97, normal: 1, high: 1.1 },
  zoneDrain: 0.96,
  breakRecovery: 0.12,
  halftimeRecovery: 0.35,
  substitutionMargin: 2,
  minStintSeconds: 120,
  minStintBonus: 6,
  minutesDeficitWeight: 1.6,
  foulTroublePenalty: 25,

  // --- Jump balls --------------------------------------------------------------
  /** Chance per half-court action that the ball is held (settled by the arrow). */
  heldBallChance: 0.006,
  /** How much the tip-off depends on height and jumping (per unit of difference). */
  tipSkillWeight: 0.2,

  // --- Timeouts -----------------------------------------------------------------
  /** Unanswered points by the opponent that make a coach stop the game. */
  timeoutRunPoints: 8,
  /** Seconds of game time that must pass between two timeouts. */
  timeoutCooldownSeconds: 150,
  /** Energy both teams recover during a timeout. */
  timeoutRecovery: 0.05,
  /** Average energy on court under which a tired team may ask for a rest. */
  timeoutRestEnergy: 0.74,
  timeoutRestChance: 0.5,
  /** End of the game: the trailing team uses timeouts to set up plays. */
  timeoutEndSeconds: 120,
  timeoutEndDeficit: 8,
  timeoutEndChance: 0.6,
  /** Momentum: small shooting bonus for a team on an unanswered run (needs > 5 points). */
  momentumPerPoint: 0.0015,
  momentumMax: 0.012,

  // --- Injuries -------------------------------------------------------------------
  /** Chance per player on court and possession (about 0.2 injuries per match). */
  injuryPerPlayerPossession: 0.0001,
  /** Injury risk grows as energy drops: risk × (1 + factor × (1 − energy)). */
  injuryFatigueFactor: 1.5,

  // --- Conduct fouls ----------------------------------------------------------------
  /** Chance per team and action of a technical foul (about 0.2 per match). */
  technicalChance: 0.0008,
  unsportsmanlikeChance: 0.0005,
  conductDisciplineWeight: 0.6,

  // --- End of game -----------------------------------------------------------
  clutchSeconds: 300,
  clutchMargin: 10,
  intentionalFoulSeconds: 35,
  intentionalFoulMaxDeficit: 9,
} as const;

const E = ENGINE;

/** Highest chance of a conduct foul per team and action (discipline of -1 on all five players). */
const CONDUCT_MAX_CHANCE =
  (E.technicalChance + E.unsportsmanlikeChance) * Math.exp(E.conductDisciplineWeight);
/** Highest injury risk per player and possession (energy at its minimum). */
const INJURY_MAX_RISK =
  E.injuryPerPlayerPossession * (1 + E.injuryFatigueFactor * (1 - E.minEnergy));

export interface MatchInput {
  home: PreparedTeam;
  away: PreparedTeam;
  ruleset: Ruleset;
  /** Seed string for this match. Same input + same seed ⇒ same events. */
  seed: string;
}

type HalfCourtPlay = keyof typeof E.playMix;
const HALF_COURT_PLAYS = Object.keys(E.playMix) as HalfCourtPlay[];

/** How the previous possession ended, i.e. how this one starts. */
type Start = 'dead' | 'made' | 'defensive-rebound' | 'steal';

interface Side {
  team: PreparedTeam;
  players: SimPlayer[];
  tactics: TeamTactics;
  /** Court slot (0..4) → index into `players`. */
  onCourt: number[];
  isOn: boolean[];
  energy: number[];
  fouls: number[];
  fouledOut: boolean[];
  playedSeconds: number[];
  enteredAt: number[];
  score: number;
  teamFouls: number;
  shotBonus: number;
  /** Extra shot probability while the team is on an unanswered run. */
  momentum: number;
  /** Players who cannot continue (injured). */
  injured: boolean[];
  /** Technical and unsportsmanlike fouls per player. */
  conduct: number[];
  timeoutsLeft: number;
  drainMultiplier: number;
  /** Cumulative play-type weights for this team's offense. */
  playWeights: number[];
}

function makeSide(team: PreparedTeam, shotBonus: number): Side {
  const n = team.players.length;
  const t = team.tactics;
  const weights: number[] = [];
  let total = 0;
  for (const play of HALF_COURT_PLAYS) {
    total += E.playMix[play] * E.focusMix[t.offenseFocus][play];
    weights.push(total);
  }
  return {
    team,
    players: team.players,
    tactics: t,
    onCourt: [0, 1, 2, 3, 4],
    isOn: team.players.map((_, i) => i < 5),
    energy: new Array<number>(n).fill(1),
    fouls: new Array<number>(n).fill(0),
    fouledOut: new Array<boolean>(n).fill(false),
    playedSeconds: new Array<number>(n).fill(0),
    enteredAt: new Array<number>(n).fill(0),
    score: 0,
    teamFouls: 0,
    shotBonus,
    momentum: 0,
    injured: new Array<boolean>(n).fill(false),
    conduct: new Array<number>(n).fill(0),
    timeoutsLeft: 0,
    drainMultiplier:
      E.paceDrain[t.pace] *
      E.pressureDrain[t.pressure] *
      (t.defenseScheme === 'zone' ? E.zoneDrain : 1),
    playWeights: weights.map((w) => w / total),
  };
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export type HalftimeTactics = Pick<TeamTactics, 'pace' | 'pressure'>;

interface HalftimeSnapshot {
  events: MatchEvent[];
  tactics: HalftimeTactics;
}

export interface HalftimeMatch extends HalftimeSnapshot {
  /** Completes the same simulation. No second call is permitted. */
  finish(tactics?: HalftimeTactics): MatchEvent[];
}

/** Simulates one match and returns its complete event log. */
export function simulateMatch(input: MatchInput): MatchEvent[] {
  const result = runMatch(input).next();
  if (!result.done) throw new Error('An uninterrupted match paused unexpectedly');
  return result.value;
}

/** Plays up to halftime and holds the engine state for one team's instructions. */
export function beginHalftimeMatch(input: MatchInput, teamId: string): HalftimeMatch {
  if (input.ruleset.periods < 2) throw new Error('This ruleset has no halftime break');
  const side = input.home.teamId === teamId ? 'home' : input.away.teamId === teamId ? 'away' : null;
  if (!side) throw new Error('The managed team is not playing this match');
  const simulation = runMatch(input, side);
  const breakState = simulation.next();
  if (breakState.done) throw new Error('The match did not reach halftime');
  return {
    ...breakState.value,
    finish(tactics) {
      const result = simulation.next(tactics);
      if (!result.done || !result.value) throw new Error('The halftime match has already resumed');
      return result.value;
    },
  };
}

function* runMatch(
  input: MatchInput,
  managedSide?: 'home' | 'away',
): Generator<HalftimeSnapshot, MatchEvent[], HalftimeTactics | undefined> {
  const rng = createRng(input.seed);
  const rules = input.ruleset;
  const events: MatchEvent[] = [];
  const home = makeSide(input.home, E.homeShotBonus);
  const away = makeSide(input.away, 0);

  let period = 1;
  let clock = 0;
  let elapsed = 0;
  let possession = 0;
  // The opening tip decides the first possession (see the game loop); the arrow then
  // alternates possessions: period starts and held balls.
  let offense = home;
  let defense = away;
  let arrow: Side = away;
  // Unanswered run, used for momentum and for timeouts.
  let runSide: Side | null = null;
  let runPoints = 0;
  let lastTimeoutAt = -Infinity;

  // Build stamp fields directly in event literals: no intermediate object per event.
  // Keep their order identical for reproducible event-log fingerprints.

  const P = (side: Side, slot: number): SimPlayer =>
    side.players[side.onCourt[slot] as number] as SimPlayer;

  const noise = (): number => rng.normal(0, 0.3);

  // ---------------------------------------------------------------------------
  // Time and energy
  // ---------------------------------------------------------------------------
  const advance = (seconds: number): void => {
    if (seconds <= 0) return;
    for (const side of [home, away]) {
      const { energy, isOn, players, playedSeconds } = side;
      for (let i = 0; i < energy.length; i++) {
        if (isOn[i]) {
          const next =
            (energy[i] as number) -
            seconds * (players[i] as SimPlayer).drain * side.drainMultiplier;
          energy[i] = next < E.minEnergy ? E.minEnergy : next;
          playedSeconds[i] = (playedSeconds[i] as number) + seconds;
        } else {
          const next = (energy[i] as number) + seconds * E.energyRecoveryPerSecond;
          energy[i] = next > 1 ? 1 : next;
        }
      }
    }
    clock -= seconds;
    elapsed += seconds;
  };

  const rest = (side: Side, amount: number): void => {
    for (let i = 0; i < side.energy.length; i++) {
      side.energy[i] = Math.min(1, (side.energy[i] as number) + amount);
    }
  };

  /** Adds points and keeps track of the unanswered run (momentum). */
  const scored = (side: Side, points: number): void => {
    side.score += points;
    if (runSide === side) runPoints += points;
    else {
      runSide = side;
      runPoints = points;
    }
    const other = side === home ? away : home;
    side.momentum = clamp((runPoints - 5) * E.momentumPerPoint, 0, E.momentumMax);
    other.momentum = 0;
  };

  const isFinalStretch = (): boolean => period >= rules.periods;
  const isClutch = (): boolean =>
    isFinalStretch() &&
    clock <= E.clutchSeconds &&
    Math.abs(home.score - away.score) <= E.clutchMargin;

  // ---------------------------------------------------------------------------
  // Coach (PLACEHOLDER rules): substitutions at dead balls only
  // ---------------------------------------------------------------------------
  const coach = (side: Side, protectedIndex = -1): void => {
    const margin = Math.abs(home.score - away.score);
    const clutch = isClutch();
    const garbage =
      isFinalStretch() &&
      period === rules.periods &&
      ((margin >= 20 && clock <= 360) || margin >= 30);
    const troubleAt =
      period >= rules.periods
        ? rules.personalFoulLimit
        : Math.ceil((rules.personalFoulLimit * period) / rules.periods);
    const inTrouble = (index: number): boolean =>
      !clutch &&
      (side.fouls[index] as number) >= troubleAt &&
      (side.fouls[index] as number) < rules.personalFoulLimit;

    const value = (index: number, slot: number): number => {
      const p = side.players[index] as SimPlayer;
      const fresh = 0.8 + 0.2 * (side.energy[index] as number);
      if (garbage) return (index >= 8 ? 100 : 0) + 10 * fresh;
      let v = p.overall * (p.slotFit[slot] as number) * fresh;
      if (!clutch) {
        const plan = (side.team.minuteShare[index] as number) * elapsed;
        const deficit = clamp((plan - (side.playedSeconds[index] as number)) / 60, -6, 6);
        v += E.minutesDeficitWeight * deficit;
        if (inTrouble(index)) v -= E.foulTroublePenalty;
      }
      return v;
    };

    for (let slot = 0; slot < 5; slot++) {
      const current = side.onCourt[slot] as number;
      if (current === protectedIndex) continue;
      const forced = (side.fouledOut[current] as boolean) || (side.injured[current] as boolean);
      let best = -1;
      let bestValue = -Infinity;
      if (!forced) {
        const shortStint = elapsed - (side.enteredAt[current] as number) < E.minStintSeconds;
        bestValue =
          value(current, slot) +
          E.substitutionMargin +
          (shortStint && !inTrouble(current) ? E.minStintBonus : 0);
      }
      for (let j = 0; j < side.players.length; j++) {
        if (side.isOn[j] || side.fouledOut[j] || side.injured[j]) continue;
        if (!forced) {
          if (((side.players[j] as SimPlayer).slotFit[slot] as number) < 0.9) continue;
          // Outside the planned rotation: only in garbage time.
          if (!garbage && (side.team.minuteShare[j] as number) === 0) continue;
        }
        const v = value(j, slot);
        if (v > bestValue) {
          best = j;
          bestValue = v;
        }
      }
      if (best >= 0) {
        side.onCourt[slot] = best;
        side.isOn[current] = false;
        side.isOn[best] = true;
        side.enteredAt[best] = elapsed;
        events.push({
          seq: events.length,
          period,
          clock,
          possession,
          offenseTeamId: offense.team.teamId,
          type: 'substitution',
          teamId: side.team.teamId,
          playerInId: (side.players[best] as SimPlayer).id,
          playerOutId: (side.players[current] as SimPlayer).id,
        });
      }
      // If a fouled-out, ejected or injured player cannot be replaced (nobody left), he
      // stays on court. PLACEHOLDER: real rules would continue with fewer players.
    }
  };

  const deadBall = (protectedOffenseIndex = -1): void => {
    coach(offense, protectedOffenseIndex);
    coach(defense);
  };

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------
  const pick = (
    side: Side,
    weight: (p: SimPlayer) => number,
    excludeA = -1,
    excludeB = -1,
  ): number => {
    let total = 0;
    for (let slot = 0; slot < 5; slot++) {
      if (slot !== excludeA && slot !== excludeB) total += weight(P(side, slot));
    }
    let roll = rng.next() * total;
    let last = 0;
    for (let slot = 0; slot < 5; slot++) {
      if (slot === excludeA || slot === excludeB) continue;
      last = slot;
      roll -= weight(P(side, slot));
      if (roll < 0) return slot;
    }
    return last;
  };

  const average = (side: Side, value: (p: SimPlayer) => number): number => {
    let sum = 0;
    for (let slot = 0; slot < 5; slot++) sum += value(P(side, slot));
    return sum / 5;
  };

  const passWeight = (p: SimPlayer): number => Math.exp(p.passing * 1.6);

  // Defensive context, refreshed at the start of every action.
  let zone = false;
  let teamPerimeterD = 0;
  let teamInteriorD = 0;
  let rimProtection = 0;
  const refreshDefense = (): void => {
    zone = defense.tactics.defenseScheme === 'zone';
    teamPerimeterD = average(defense, (p) => p.perimeterDefense);
    teamInteriorD = average(defense, (p) => p.interiorDefense);
    let first = -9;
    let second = -9;
    for (let slot = 0; slot < 5; slot++) {
      const p = P(defense, slot);
      const v = 0.5 * p.interiorDefense + 0.5 * p.block;
      if (v > first) {
        second = first;
        first = v;
      } else if (v > second) second = v;
    }
    rimProtection = 0.65 * first + 0.35 * second;
  };
  /** In a zone, individual defenders matter less: weak links are hidden. */
  const perD = (p: SimPlayer): number =>
    zone ? 0.5 * p.perimeterDefense + 0.5 * teamPerimeterD : p.perimeterDefense;
  const intD = (p: SimPlayer): number =>
    zone ? 0.5 * p.interiorDefense + 0.5 * teamInteriorD : p.interiorDefense;

  // ---------------------------------------------------------------------------
  // Fouls, free throws, rebounds
  // ---------------------------------------------------------------------------
  const registerFoul = (
    side: Side,
    index: number,
    drawnBy: SimPlayer,
    kind: FoulKind,
    freeThrowCount: number,
    intentional: boolean,
  ): void => {
    const fouler = side.players[index] as SimPlayer;
    side.fouls[index] = (side.fouls[index] as number) + 1;
    // All modeled fouls are player fouls: under FIBA they also count against the team.
    // Coach/bench technicals, which do not count as team fouls, are not modeled here.
    side.teamFouls++;
    if (kind === 'technical' || kind === 'unsportsmanlike') {
      side.conduct[index] = (side.conduct[index] as number) + 1;
    }
    const fouledOut =
      (side.fouls[index] as number) >= rules.personalFoulLimit ||
      (side.conduct[index] as number) >= rules.technicalFoulsForEjection;
    if (fouledOut) side.fouledOut[index] = true;
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'foul',
      playerId: fouler.id,
      teamId: side.team.teamId,
      drawnByPlayerId: drawnBy.id,
      kind,
      intentional,
      freeThrows: freeThrowCount,
      fouledOut,
    });
  };

  /** Defensive foul away from a shot. Returns the number of free throws (0 or 2). */
  const floorFoul = (defenderSlot: number, drawnBy: SimPlayer, intentional: boolean): number => {
    const inBonus = defense.teamFouls + 1 >= rules.teamFoulsForBonus;
    const awarded = inBonus ? 2 : 0;
    registerFoul(
      defense,
      defense.onCourt[defenderSlot] as number,
      drawnBy,
      'personal',
      awarded,
      intentional,
    );
    return awarded;
  };

  /** Shoots free throws. Returns true if the last one was missed (live rebound). */
  const freeThrows = (
    shooter: SimPlayer,
    attempts: number,
    shooterSide: Side = offense,
  ): boolean => {
    const pressure = isClutch() && clock <= 120 ? 0.05 * shooter.composure : 0;
    const probability = clamp(
      E.freeThrowBase + 0.35 * (shooter.freeThrow - 0.2) + pressure,
      0.35,
      0.96,
    );
    let lastMissed = false;
    for (let i = 0; i < attempts; i++) {
      const made = rng.next() < probability;
      if (made) scored(shooterSide, 1);
      lastMissed = !made;
      events.push({
        seq: events.length,
        period,
        clock,
        possession,
        offenseTeamId: offense.team.teamId,
        type: 'free_throw',
        playerId: shooter.id,
        made,
      });
    }
    return lastMissed;
  };

  /** Resolves a rebound. Returns the offensive rebounder's slot, or -1. */
  const rebound = (): number => {
    let off = 0;
    let def = 0;
    for (let slot = 0; slot < 5; slot++) {
      off += P(offense, slot).offensiveRebound;
      def += P(defense, slot).defensiveRebound;
    }
    const probability = clamp(
      E.offensiveReboundBase *
        Math.pow(off / def, 1.5) *
        E.crashRebound[offense.tactics.offensiveRebounding] *
        (zone ? E.zoneReboundPenalty : 1),
      0.08,
      0.55,
    );
    const offensive = rng.next() < probability;
    const side = offensive ? offense : defense;
    const slot = pick(side, (p) =>
      offensive ? p.offensiveRebound * p.offensiveRebound : p.defensiveRebound * p.defensiveRebound,
    );
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'rebound',
      playerId: P(side, slot).id,
      teamId: side.team.teamId,
      kind: offensive ? 'offensive' : 'defensive',
    });
    return offensive ? slot : -1;
  };

  // ---------------------------------------------------------------------------
  // Turnovers
  // ---------------------------------------------------------------------------
  /**
   * Rolls for a turnover by the player in `slot`. `ballSkill` and `defSkill`
   * are in normalised units. Returns the next possession start, or null if the
   * offense keeps the ball.
   */
  const tryTurnover = (
    playType: PlayType,
    slot: number,
    ballSkill: number,
    defSkill: number,
    multiplier = 1,
  ): Start | null => {
    const probability = clamp(
      E.turnoverBase[playType] *
        Math.exp(-0.6 * ballSkill + 0.45 * defSkill) *
        E.paceTurnover[offense.tactics.pace] *
        E.pressureTurnover[defense.tactics.pressure] *
        (zone ? E.zoneTurnover : 1) *
        multiplier,
      0.01,
      0.45,
    );
    if (rng.next() >= probability) return null;

    const player = P(offense, slot);
    const roll = rng.next();
    const kind: TurnoverKind =
      roll < 0.4
        ? 'bad-pass'
        : roll < 0.73
          ? 'lost-ball'
          : roll < 0.86
            ? 'travel'
            : 'offensive-foul';

    if (kind === 'offensive-foul') {
      registerFoul(
        offense,
        offense.onCourt[slot] as number,
        P(defense, slot),
        'offensive',
        0,
        false,
      );
      events.push({
        seq: events.length,
        period,
        clock,
        possession,
        offenseTeamId: offense.team.teamId,
        type: 'turnover',
        playerId: player.id,
        kind,
        playType,
      });
      return 'dead';
    }
    const stealChance =
      kind === 'travel' ? 0 : 0.72 * (defense.tactics.pressure === 'high' ? 1.1 : 1);
    if (rng.next() < stealChance) {
      // Lost balls are usually taken by the direct defender; bad passes by anyone.
      const stealSlot =
        kind === 'lost-ball' && rng.next() < 0.6
          ? slot
          : pick(defense, (p) => Math.exp(p.steal * 1.6));
      events.push({
        seq: events.length,
        period,
        clock,
        possession,
        offenseTeamId: offense.team.teamId,
        type: 'turnover',
        playerId: player.id,
        kind,
        playType,
        stealPlayerId: P(defense, stealSlot).id,
      });
      return 'steal';
    }
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'turnover',
      playerId: player.id,
      kind,
      playType,
    });
    return 'dead';
  };

  // ---------------------------------------------------------------------------
  // Shots
  // ---------------------------------------------------------------------------
  const shotLocation = (shotZone: ShotZone): { x: number; y: number } => {
    const polar = (minR: number, maxR: number, minAngle: number, maxAngle: number) => {
      const r = minR + rng.next() * (maxR - minR);
      const angle = minAngle + rng.next() * (maxAngle - minAngle);
      return { x: round2(7.5 + r * Math.cos(angle)), y: round2(1.575 + r * Math.sin(angle)) };
    };
    switch (shotZone) {
      case 'restricted':
        return polar(0.2, 1.25, 0, Math.PI);
      case 'paint':
        return polar(1.4, 4.2, 0.5, Math.PI - 0.5);
      case 'midrange':
        return polar(4.3, 6.4, 0.05, Math.PI - 0.05);
      case 'corner3':
        return {
          x: round2(rng.next() < 0.5 ? 0.3 + rng.next() * 0.5 : 14.2 + rng.next() * 0.5),
          y: round2(0.3 + rng.next() * 2.6),
        };
      case 'above-break3':
        return polar(6.9, 8.0, 0.5, Math.PI - 0.5);
    }
  };

  /** Probability adjustment for threes: tactics + scoreboard pressure late. */
  const threeShift = (): number => {
    let shift = E.focusThreeShift[offense.tactics.offenseFocus];
    if (isFinalStretch() && clock <= 60 && defense.score - offense.score >= 3) shift += 0.3;
    return shift;
  };
  const threeOrMid = (shooter: SimPlayer, base: number, cornerShare: number): ShotZone => {
    const chance = clamp(base + 0.6 * (shooter.three - shooter.mid) + threeShift(), 0.04, 0.97);
    if (rng.next() >= chance) return 'midrange';
    return rng.next() < cornerShare ? 'corner3' : 'above-break3';
  };
  const rimOrPaint = (rimShare: number): ShotZone =>
    rng.next() < rimShare ? 'restricted' : 'paint';

  /**
   * Takes a shot. Handles shooting fouls, free throws and blocks.
   * Returns 'made' if the possession ends with points, or 'rebound' if the
   * ball is live off a miss.
   */
  const shoot = (
    playType: PlayType,
    shooterSlot: number,
    defenderSlot: number,
    shotZone: ShotZone,
    rawOpenness: number,
    passerSlot: number,
  ): 'made' | 'rebound' => {
    const shooter = P(offense, shooterSlot);
    const defender = P(defense, defenderSlot);
    const energy = offense.energy[offense.onCourt[shooterSlot] as number] as number;
    const openness = clamp(
      rawOpenness +
        E.pressureOpenness[defense.tactics.pressure] +
        (playType === 'transition' || playType === 'putback'
          ? 0
          : E.paceOpenness[offense.tactics.pace]),
      -1,
      1,
    );

    let skill: number;
    let resistance: number;
    switch (shotZone) {
      case 'restricted':
        skill = 0.75 * shooter.close + 0.25 * shooter.jumping;
        resistance =
          0.45 * intD(defender) + 0.55 * rimProtection + (zone ? E.zoneInteriorBonus : 0);
        break;
      case 'paint':
        skill = 0.65 * shooter.close + 0.35 * shooter.mid;
        resistance = 0.7 * intD(defender) + 0.3 * rimProtection + (zone ? E.zoneInteriorBonus : 0);
        break;
      case 'midrange':
        skill = shooter.mid;
        resistance = perD(defender);
        break;
      default:
        skill = shooter.three;
        resistance = perD(defender);
    }
    const clutchBonus = isClutch() && clock <= 120 ? 0.04 * shooter.composure : 0;
    const makeProbability = clamp(
      (E.makeBase[shotZone] +
        E.makeSkillWeight * skill -
        E.makeDefenseWeight * resistance +
        E.makeOpenWeight[shotZone] * openness +
        offense.shotBonus +
        offense.momentum +
        clutchBonus) *
        (0.94 + 0.06 * energy),
      0.03,
      0.97,
    );

    const isThree = shotZone === 'corner3' || shotZone === 'above-break3';
    const points = isThree ? 3 : 2;
    const shotType: ShotType = isThree ? 'three' : shotZone === 'midrange' ? 'mid' : 'rim';
    const foulProbability = clamp(
      E.shootingFoul[shotZone] *
        (1 - 0.3 * defender.discipline) *
        (1 + 0.12 * shooter.strength) *
        (defense.tactics.pressure === 'high'
          ? 1.1
          : defense.tactics.pressure === 'low'
            ? 0.93
            : 1) *
        (zone ? E.zoneFoul : 1),
      0.003,
      0.45,
    );
    const fouled = rng.next() < foulProbability;
    const made = rng.next() < (fouled ? makeProbability * E.andOneFactor : makeProbability);

    if (made || !fouled) {
      // A missed shot on a shooting foul is not a field-goal attempt.
      let assistId: string | undefined;
      let blockId: string | undefined;
      if (made) {
        scored(offense, points);
        if (passerSlot >= 0 && rng.next() < E.assistCredit) assistId = P(offense, passerSlot).id;
      } else {
        const inside = shotZone === 'restricted' || shotZone === 'paint';
        const blockSkill = inside ? Math.max(defender.block, rimProtection) : defender.block;
        if (rng.next() < clamp(E.blockBase[shotZone] * (1 + 1.1 * blockSkill), 0.002, 0.45)) {
          blockId = inside
            ? P(
                defense,
                pick(defense, (p) => Math.exp(p.block * 2.2)),
              ).id
            : defender.id;
        }
      }
      const location = shotLocation(shotZone);
      events.push({
        seq: events.length,
        period,
        clock,
        possession,
        offenseTeamId: offense.team.teamId,
        type: 'shot',
        playerId: shooter.id,
        shotType,
        zone: shotZone,
        playType,
        x: location.x,
        y: location.y,
        openness: round2(openness),
        made,
        points: made ? points : 0,
        ...(assistId ? { assistPlayerId: assistId } : {}),
        ...(blockId ? { blockPlayerId: blockId } : {}),
      });
    }

    if (fouled) {
      const awarded = made ? 1 : points;
      registerFoul(
        defense,
        defense.onCourt[defenderSlot] as number,
        shooter,
        'shooting',
        awarded,
        false,
      );
      deadBall(offense.onCourt[shooterSlot] as number);
      return freeThrows(shooter, awarded) ? 'rebound' : 'made';
    }
    return made ? 'made' : 'rebound';
  };

  // ---------------------------------------------------------------------------
  // Plays. Each returns: a Start (possession over), 'rebound' (live miss) or
  // 'continue' (offense keeps the ball after a non-shooting foul).
  // ---------------------------------------------------------------------------
  type PlayOutcome = Start | 'rebound' | 'continue';

  /** Non-shooting defensive foul during a play. */
  const tryFloorFoul = (defenderSlot: number, ballSlot: number, extra = 1): PlayOutcome | null => {
    const defender = P(defense, defenderSlot);
    const probability = clamp(
      E.floorFoulBase *
        (1 - 0.3 * defender.discipline) *
        E.pressureFoul[defense.tactics.pressure] *
        (zone ? E.zoneFoul : 1) *
        extra,
      0.01,
      0.3,
    );
    if (rng.next() >= probability) return null;
    const drawnBy = P(offense, ballSlot);
    const awarded = floorFoul(defenderSlot, drawnBy, false);
    deadBall(offense.onCourt[ballSlot] as number);
    if (awarded === 0) return 'continue';
    return freeThrows(drawnBy, awarded) ? 'rebound' : 'made';
  };

  const kickOut = (
    playType: PlayType,
    passerSlot: number,
    excludeB: number,
    openness: number,
    cornerShare: number,
  ): 'made' | 'rebound' => {
    const k = pick(offense, (p) => p.roleSpot, passerSlot, excludeB);
    const zoneBonus = zone ? 0.2 : 0;
    return shoot(
      playType,
      k,
      k,
      threeOrMid(P(offense, k), 0.82, cornerShare),
      openness + zoneBonus,
      passerSlot,
    );
  };

  const pickAndRoll = (): PlayOutcome => {
    const playType: PlayType = 'pick-and-roll';
    const h = pick(offense, (p) => p.roleHandler);
    const s = pick(offense, (p) => p.roleScreener, h);
    const handler = P(offense, h);
    const screener = P(offense, s);
    const coverage = zone ? 'zone' : defense.tactics.pickAndRollCoverage;
    const handlerDefender = P(defense, h);
    const screenerDefender = P(defense, s);

    const handlerSkill =
      0.4 * handler.handling +
      0.25 * handler.speed +
      0.2 * handler.decisions +
      0.15 * handler.passing;
    const blitzRisk =
      coverage === 'blitz' ? 1.5 - 0.5 * (0.5 * handler.decisions + 0.5 * handler.passing) : 1;
    const lost = tryTurnover(
      playType,
      h,
      0.6 * handler.handling + 0.4 * handler.decisions,
      0.5 * handlerDefender.steal + 0.5 * perD(handlerDefender),
      blitzRisk,
    );
    if (lost) return lost;
    const foul = tryFloorFoul(rng.next() < 0.6 ? h : s, h, coverage === 'blitz' ? 1.15 : 1);
    if (foul) return foul;

    let advantage =
      1.1 * (handlerSkill - (0.6 * perD(handlerDefender) + 0.4 * handlerDefender.speed)) +
      0.25 +
      0.2 * screener.strength +
      noise();

    // Branch weights and openness shifts: [pull-up, drive, roll, pop, kick].
    const focus = offense.tactics.offenseFocus;
    const inside = focus === 'inside' ? 1.25 : focus === 'perimeter' ? 0.85 : 1;
    const outside = focus === 'perimeter' ? 1.2 : focus === 'inside' ? 0.85 : 1;
    const w = [
      0.18 * outside,
      0.2 * inside,
      0.23 * inside,
      (0.04 + 0.16 * clamp(screener.three + 0.3, 0, 1)) * outside,
      0.27 * outside,
    ];
    const o = [0, 0, 0, 0, 0];
    let handlerDefenderSlot = h;
    let screenerDefenderSlot = s;
    switch (coverage) {
      case 'zone':
        w[0]! *= 1.2;
        o[0] = 0.15;
        w[1]! *= 0.7;
        o[1] = -0.3;
        w[2]! *= 0.7;
        o[2] = -0.3;
        w[3]! *= 1.2;
        o[3] = 0.25;
        w[4]! *= 1.5;
        o[4] = 0.1;
        break;
      case 'drop':
        w[0]! *= 1.6;
        o[0] = 0.35;
        w[1]! *= 0.85;
        o[1] = -0.25;
        w[2]! *= 0.7;
        o[2] = -0.3;
        w[3]! *= 1.6;
        o[3] = 0.45;
        w[4]! *= 0.75;
        o[4] = -0.15;
        break;
      case 'hedge': {
        const q = screenerDefender.speed;
        w[0]! *= 0.75;
        o[0] = -0.15;
        w[1]! *= 0.85;
        o[1] = -0.1 - 0.3 * q;
        w[2]! *= 1.15;
        o[2] = 0.1 - 0.5 * q;
        w[3]! *= 1.15;
        o[3] = 0.15 - 0.4 * q;
        break;
      }
      case 'switch': {
        // Defenders swap: the handler attacks the big, the screener posts the guard.
        handlerDefenderSlot = s;
        screenerDefenderSlot = h;
        advantage =
          1.1 * (handlerSkill - (0.6 * perD(screenerDefender) + 0.4 * screenerDefender.speed)) +
          0.05 +
          noise();
        const mismatch =
          screener.strength + screener.height - (handlerDefender.strength + handlerDefender.height);
        w[2]! *= 0.55;
        o[2] = -0.25 + 0.45 * mismatch;
        w[3]! *= 0.5;
        o[3] = -0.3;
        w[4]! *= 0.6;
        o[4] = -0.25;
        break;
      }
      case 'blitz':
        w[0]! *= 0.3;
        o[0] = -0.5;
        w[1]! *= 0.4;
        o[1] = -0.4;
        w[2]! *= 1.5;
        o[2] = 0.4;
        w[3]! *= 1.4;
        o[3] = 0.4;
        w[4]! *= 1.7;
        o[4] = 0.4;
        break;
    }
    let roll =
      rng.next() *
      ((w[0] as number) +
        (w[1] as number) +
        (w[2] as number) +
        (w[3] as number) +
        (w[4] as number));
    let branch = 4;
    for (let i = 0; i < 5; i++) {
      roll -= w[i] as number;
      if (roll < 0) {
        branch = i;
        break;
      }
    }
    const selfCreated = (o[branch] as number) + 0.55 * advantage;
    const created = (o[branch] as number) + 0.3 * advantage + 0.3 * handler.passing;
    switch (branch) {
      case 0:
        return shoot(
          playType,
          h,
          handlerDefenderSlot,
          threeOrMid(handler, 0.42, 0),
          selfCreated - 0.1,
          -1,
        );
      case 1:
        return shoot(playType, h, handlerDefenderSlot, rimOrPaint(0.62), selfCreated - 0.1, -1);
      case 2:
        return shoot(playType, s, screenerDefenderSlot, rimOrPaint(0.8), created + 0.1, h);
      case 3:
        return shoot(playType, s, screenerDefenderSlot, threeOrMid(screener, 0.6, 0), created, h);
      default:
        return kickOut(playType, h, s, created - 0.05, 0.4);
    }
  };

  const isolation = (): PlayOutcome => {
    const playType: PlayType = 'isolation';
    const i = pick(offense, (p) => p.roleIso);
    const scorer = P(offense, i);
    const defender = P(defense, i);
    const lost = tryTurnover(
      playType,
      i,
      0.7 * scorer.handling + 0.3 * scorer.composure,
      0.5 * defender.steal + 0.5 * perD(defender),
    );
    if (lost) return lost;
    const foul = tryFloorFoul(i, i);
    if (foul) return foul;

    const bestShot = Math.max(scorer.close, scorer.mid, scorer.three);
    const advantage =
      0.35 * scorer.handling +
      0.25 * scorer.speed +
      0.25 * bestShot +
      0.15 * scorer.composure -
      (0.65 * perD(defender) + 0.35 * defender.speed) +
      noise();
    if (rng.next() < 0.12) {
      return kickOut(playType, i, -1, 0.05 + 0.3 * advantage + 0.3 * scorer.passing, 0.35);
    }
    const openness = -0.2 + 0.75 * advantage;
    const driveWeight = clamp(0.45 + 0.25 * scorer.speed - (zone ? 0.15 : 0), 0.1, 0.8);
    const stepBackWeight = clamp(0.22 + 0.3 * scorer.three + threeShift(), 0.03, 0.7);
    const roll = rng.next() * (driveWeight + 0.33 + stepBackWeight);
    if (roll < driveWeight) return shoot(playType, i, i, rimOrPaint(0.6), openness, -1);
    if (roll < driveWeight + 0.33) return shoot(playType, i, i, 'midrange', openness, -1);
    return shoot(playType, i, i, 'above-break3', openness - 0.05, -1);
  };

  const postUp = (): PlayOutcome => {
    const playType: PlayType = 'post-up';
    const p = pick(offense, (x) => x.rolePost);
    const post = P(offense, p);
    const defender = P(defense, p);
    const lost = tryTurnover(
      playType,
      p,
      0.4 * post.strength + 0.3 * post.composure + 0.3 * post.handling,
      0.5 * average(defense, (x) => x.steal) + 0.5 * intD(defender),
      zone ? 1.15 : 1,
    );
    if (lost) return lost;
    const foul = tryFloorFoul(p, p, 1.15);
    if (foul) return foul;

    const advantage =
      0.5 * post.close +
      0.3 * post.strength +
      0.2 * post.height -
      (0.5 * intD(defender) + 0.3 * defender.strength + 0.2 * defender.height) +
      noise();
    if (rng.next() < (zone ? 0.36 : 0.24)) {
      return kickOut(playType, p, -1, 0.15 + 0.2 * advantage + 0.35 * post.passing, 0.4);
    }
    return shoot(playType, p, p, rimOrPaint(0.38), -0.15 + 0.8 * advantage - (zone ? 0.2 : 0), -1);
  };

  const spotUp = (): PlayOutcome => {
    const playType: PlayType = 'spot-up';
    const k = pick(offense, (p) => p.roleSpot);
    const passerSlot = pick(offense, passWeight, k);
    const shooter = P(offense, k);
    const passer = P(offense, passerSlot);
    const lost = tryTurnover(
      playType,
      passerSlot,
      0.6 * passer.passing + 0.4 * passer.decisions,
      0.5 * average(defense, (p) => p.steal) + 0.5 * teamPerimeterD,
    );
    if (lost) return lost;
    const foul = tryFloorFoul(k, k, 0.8);
    if (foul) return foul;

    const ballMovement = average(offense, (p) => 0.6 * p.passing + 0.4 * p.decisions);
    const advantage = 0.8 * (ballMovement - teamPerimeterD) + noise() + (zone ? 0.25 : 0);
    const openness = 0.1 + 0.9 * advantage;
    const attack = clamp(
      0.24 - 0.3 * openness + 0.3 * (shooter.handling - shooter.three),
      0.04,
      0.6,
    );
    if (rng.next() < attack) {
      // Attacks the close-out off the dribble.
      const roll = rng.next();
      const shotZone: ShotZone = roll < 0.55 ? 'restricted' : roll < 0.8 ? 'paint' : 'midrange';
      return shoot(playType, k, k, shotZone, 0.5 * openness - (zone ? 0.2 : 0), -1);
    }
    return shoot(playType, k, k, threeOrMid(shooter, 0.8, 0.42), openness, passerSlot);
  };

  const cut = (): PlayOutcome => {
    const playType: PlayType = 'cut';
    const c = pick(offense, (p) => p.roleCut);
    const passerSlot = pick(offense, passWeight, c);
    const cutter = P(offense, c);
    const passer = P(offense, passerSlot);
    const defender = P(defense, c);
    const lost = tryTurnover(
      playType,
      passerSlot,
      0.7 * passer.passing + 0.3 * passer.decisions,
      0.5 * defender.steal + 0.5 * defender.decisions,
      zone ? 1.15 : 1,
    );
    if (lost) return lost;
    const foul = tryFloorFoul(c, c, 0.9);
    if (foul) return foul;

    const advantage =
      0.45 * cutter.speed +
      0.35 * cutter.workRate +
      0.4 * passer.passing -
      (0.6 * defender.decisions + 0.4 * perD(defender)) -
      (zone ? 0.3 : 0) +
      noise();
    return shoot(playType, c, c, 'restricted', 0.3 + 0.7 * advantage, passerSlot);
  };

  const offScreen = (): PlayOutcome => {
    const playType: PlayType = 'off-screen';
    const s = pick(offense, (p) => p.roleOffScreen);
    const passerSlot = pick(offense, passWeight, s);
    const shooter = P(offense, s);
    const passer = P(offense, passerSlot);
    const defender = P(defense, s);
    const lost = tryTurnover(
      playType,
      passerSlot,
      0.6 * passer.passing + 0.4 * passer.decisions,
      0.5 * defender.steal + 0.5 * perD(defender),
    );
    if (lost) return lost;
    const foul = tryFloorFoul(s, s, 0.9);
    if (foul) return foul;

    const advantage =
      0.5 * shooter.speed +
      0.5 * shooter.workRate -
      (0.6 * perD(defender) + 0.4 * defender.speed) +
      0.2 +
      (zone ? 0.15 : 0) +
      noise();
    return shoot(
      playType,
      s,
      s,
      threeOrMid(shooter, 0.66, 0.15),
      0.05 + 0.8 * advantage,
      passerSlot,
    );
  };

  const transition = (): PlayOutcome => {
    const playType: PlayType = 'transition';
    const r = pick(offense, (p) => p.roleTransition);
    const runner = P(offense, r);
    const lost = tryTurnover(
      playType,
      r,
      0.6 * runner.handling + 0.4 * runner.decisions,
      average(defense, (p) => 0.5 * p.steal + 0.5 * p.speed),
    );
    if (lost) return lost;
    const foul = tryFloorFoul(r, r, 1.1);
    if (foul) return foul;

    const crash = defense.tactics.offensiveRebounding;
    const advantage =
      average(offense, (p) => p.speed) -
      average(defense, (p) => p.speed) +
      0.45 +
      (crash === 'crash' ? 0.3 : crash === 'get-back' ? -0.3 : 0) +
      noise();
    const openness = 0.3 + 0.6 * advantage;
    const passerSlot = rng.next() < 0.7 ? pick(offense, passWeight, r) : -1;
    const roll = rng.next();
    const threeShare = clamp(0.28 + threeShift(), 0.05, 0.6);
    if (roll < threeShare) {
      const k = passerSlot >= 0 ? pick(offense, (p) => p.roleSpot, passerSlot) : r;
      return shoot(
        playType,
        k,
        k,
        rng.next() < 0.3 ? 'corner3' : 'above-break3',
        openness,
        passerSlot,
      );
    }
    return shoot(playType, r, r, rimOrPaint(0.85), openness, passerSlot);
  };

  const runHalfCourt = (): PlayOutcome => {
    const roll = rng.next();
    const weights = offense.playWeights;
    let index = 0;
    while (index < weights.length - 1 && roll >= (weights[index] as number)) index++;
    switch (HALF_COURT_PLAYS[index] as HalfCourtPlay) {
      case 'pick-and-roll':
        return pickAndRoll();
      case 'isolation':
        return isolation();
      case 'post-up':
        return postUp();
      case 'spot-up':
        return spotUp();
      case 'cut':
        return cut();
      case 'off-screen':
        return offScreen();
    }
  };

  // ---------------------------------------------------------------------------
  // Conduct fouls and held balls
  // ---------------------------------------------------------------------------
  /**
   * Rolls for a technical or unsportsmanlike foul by either team. The opponent shoots
   * the free throws. A technical resumes the prior entitlement; an unsportsmanlike foul
   * gives the opponent two free throws and the ball.
   * Returns the possession outcome, or null when nothing happened.
   */
  const conductFoul = (): 'resume' | 'continue' | 'dead' | null => {
    for (const side of [offense, defense]) {
      const roll = rng.next();
      // Fast path (most actions): the roll is above the highest possible chance.
      if (roll >= CONDUCT_MAX_CHANCE) continue;
      const factor = Math.exp(-E.conductDisciplineWeight * average(side, (p) => p.discipline));
      const technical = E.technicalChance * factor;
      if (roll >= technical + E.unsportsmanlikeChance * factor) continue;
      const kind: FoulKind = roll < technical ? 'technical' : 'unsportsmanlike';
      const other = side === offense ? defense : offense;
      const slot = pick(side, (p) => Math.exp(-1.5 * p.discipline));
      const index = side.onCourt[slot] as number;
      // The fouled team chooses its best free-throw shooter.
      let shooterSlot = 0;
      for (let k = 1; k < 5; k++) {
        if (P(other, k).freeThrow > P(other, shooterSlot).freeThrow) shooterSlot = k;
      }
      const shooter = P(other, shooterSlot);
      const awarded = kind === 'technical' ? 1 : 2;
      registerFoul(side, index, shooter, kind, awarded, false);
      freeThrows(shooter, awarded, other);
      deadBall();
      // A technical does not cancel the attacking team's right to the ball (FIBA 36.3.2).
      if (kind === 'technical') return 'resume';
      return other === offense ? 'continue' : 'dead';
    }
    return null;
  };

  /** A held ball: the possession arrow decides who gets the ball. */
  const heldBall = (): 'continue' | 'dead' => {
    const winner = arrow;
    arrow = arrow === home ? away : home;
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'jump_ball',
      kind: 'held-ball',
      winnerTeamId: winner.team.teamId,
    });
    deadBall();
    return winner === offense ? 'continue' : 'dead';
  };

  // ---------------------------------------------------------------------------
  // One possession
  // ---------------------------------------------------------------------------
  const playPossession = (start: Start): Start => {
    let phase: 'fresh' | 'reset' | 'putback' = 'fresh';
    let putbackSlot = -1;
    let canRun =
      rng.next() <
      E.transitionChance[start] *
        E.paceTransition[offense.tactics.pace] *
        E.crashTransitionAllowed[defense.tactics.offensiveRebounding];

    for (;;) {
      if (clock <= 0) return 'dead';
      refreshDefense();
      const final = isFinalStretch();
      const deficit = defense.score - offense.score; // > 0: offense is behind

      // --- Late game: the trailing defense fouls on purpose to stop the clock.
      if (
        final &&
        clock <= E.intentionalFoulSeconds &&
        deficit < 0 &&
        -deficit <= E.intentionalFoulMaxDeficit &&
        !(-deficit <= 2 && clock > rules.shotClockSeconds)
      ) {
        advance(Math.min(clock, rng.int(1, 3)));
        if (clock <= 0) return 'dead';
        const target = pick(offense, (p) => p.roleHandler);
        const shooter = P(offense, target);
        const awarded = floorFoul(
          pick(defense, () => 1),
          shooter,
          true,
        );
        deadBall(offense.onCourt[target] as number);
        if (awarded === 0) continue; // not in the bonus yet: they will foul again
        if (!freeThrows(shooter, awarded)) return 'made';
        const slot = rebound();
        if (slot < 0) return 'defensive-rebound';
        phase = 'reset';
        continue;
      }

      // --- Conduct fouls and held balls (not during a putback in the air).
      if (phase !== 'putback') {
        const conduct = conductFoul();
        if (conduct) {
          canRun = false; // A dead-ball penalty cannot continue a fast break.
          if (conduct === 'resume') continue; // Preserve the prior phase instead of granting a reset.
          if (conduct === 'continue') {
            phase = 'reset';
            continue;
          }
          return conduct;
        }
        if (!(phase === 'fresh' && canRun) && rng.next() < E.heldBallChance) {
          const held = heldBall();
          if (held === 'continue') {
            phase = 'reset';
            canRun = false;
            continue;
          }
          return held;
        }
      }

      // --- How long this action takes.
      let seconds: number;
      const running = phase === 'fresh' && canRun;
      if (phase === 'putback') {
        seconds = rng.int(1, 2);
      } else if (running) {
        seconds = rng.int(E.transitionMinSeconds, E.transitionMaxSeconds);
      } else if (phase === 'reset') {
        seconds = Math.round(
          E.resetMinSeconds +
            rng.next() * (rules.shotClockOffensiveReboundSeconds - 1 - E.resetMinSeconds),
        );
      } else {
        seconds = Math.round(
          (E.halfCourtMinSeconds +
            rng.next() * (rules.shotClockSeconds - 1 - E.halfCourtMinSeconds)) *
            E.paceTime[offense.tactics.pace],
        );
        if (final && clock <= 120) {
          // Protect a lead by using the clock; hurry when behind.
          if (deficit < 0) seconds = Math.max(seconds, rules.shotClockSeconds - rng.int(2, 6));
          else if (deficit > 0) seconds = Math.round(seconds * 0.6);
        }
        seconds = clamp(seconds, 4, rules.shotClockSeconds);
      }
      const shotClock =
        phase === 'fresh' ? rules.shotClockSeconds : rules.shotClockOffensiveReboundSeconds;
      if (phase !== 'putback' && clock <= shotClock && !(final && deficit > 0)) {
        // Last possession of the period: hold for the final shot.
        seconds = Math.max(seconds, clock - rng.int(0, 3));
      }
      if (seconds >= clock) {
        if (clock <= 2) {
          advance(clock); // not enough time for another action
          return 'dead';
        }
        seconds = clock; // at the buzzer
      }
      advance(seconds);

      // --- Run the action.
      let outcome: PlayOutcome;
      if (phase === 'putback') {
        outcome = shoot('putback', putbackSlot, putbackSlot, 'restricted', -0.15 + noise(), -1);
      } else if (running) {
        outcome = transition();
      } else if (rng.next() < E.shotClockViolation) {
        const slot = pick(offense, (p) => p.roleHandler);
        events.push({
          seq: events.length,
          period,
          clock,
          possession,
          offenseTeamId: offense.team.teamId,
          type: 'turnover',
          playerId: P(offense, slot).id,
          kind: 'shot-clock',
          playType: 'isolation',
        });
        outcome = 'dead';
      } else {
        outcome = runHalfCourt();
      }
      canRun = false;

      if (outcome === 'continue') {
        phase = 'reset';
        continue;
      }
      if (outcome !== 'rebound') return outcome;

      const rebounderSlot = rebound();
      if (rebounderSlot < 0) return 'defensive-rebound';
      if (clock > 0 && rng.next() < E.putbackChance) {
        phase = 'putback';
        putbackSlot = rebounderSlot;
      } else {
        phase = 'reset';
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Timeouts and injuries (checked between possessions)
  // ---------------------------------------------------------------------------
  const callTimeout = (side: Side, reason: 'opponent-run' | 'end-of-game' | 'rest'): void => {
    side.timeoutsLeft--;
    lastTimeoutAt = elapsed;
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'timeout',
      teamId: side.team.teamId,
      reason,
    });
    // Both teams get their breath back, the run is over and the coaches can make changes.
    rest(home, E.timeoutRecovery);
    rest(away, E.timeoutRecovery);
    runSide = null;
    runPoints = 0;
    home.momentum = 0;
    away.momentum = 0;
    deadBall();
  };

  const averageEnergy = (side: Side): number => {
    let sum = 0;
    for (let slot = 0; slot < 5; slot++) sum += side.energy[side.onCourt[slot] as number] as number;
    return sum / 5;
  };

  const timeoutWindow = (): void => {
    if (clock <= 0 || elapsed - lastTimeoutAt < E.timeoutCooldownSeconds) return;
    // 1. A coach stops an opponent run.
    if (runSide !== null && runPoints >= E.timeoutRunPoints) {
      const victim = runSide === home ? away : home;
      if (victim.timeoutsLeft > 0) {
        callTimeout(victim, 'opponent-run');
        return;
      }
    }
    // 2. End of the game: the trailing team sets up its plays.
    if (isFinalStretch() && clock <= E.timeoutEndSeconds) {
      for (const side of [home, away]) {
        const behind = side === home ? away.score - home.score : home.score - away.score;
        if (side.timeoutsLeft > 0 && behind >= 1 && behind <= E.timeoutEndDeficit) {
          if (rng.next() < E.timeoutEndChance) {
            callTimeout(side, 'end-of-game');
            return;
          }
        }
      }
    }
    // 3. A tired team asks for a rest.
    for (const side of [offense, defense]) {
      if (side.timeoutsLeft > 0 && averageEnergy(side) < E.timeoutRestEnergy) {
        if (rng.next() < E.timeoutRestChance) {
          callTimeout(side, 'rest');
          return;
        }
      }
    }
  };

  const injuryDuration = (): number => {
    const roll = rng.next();
    if (roll < 0.55) return rng.int(1, 3);
    if (roll < 0.85) return rng.int(4, 12);
    if (roll < 0.97) return rng.int(13, 30);
    return rng.int(31, 80);
  };

  const injuryCheck = (): void => {
    for (const side of [home, away]) {
      for (let slot = 0; slot < 5; slot++) {
        const index = side.onCourt[slot] as number;
        if (side.injured[index]) continue;
        const roll = rng.next();
        if (roll >= INJURY_MAX_RISK) continue; // fast path: above any possible risk
        const risk =
          E.injuryPerPlayerPossession *
          (1 + E.injuryFatigueFactor * (1 - (side.energy[index] as number)));
        if (roll >= risk) continue;
        side.injured[index] = true;
        events.push({
          seq: events.length,
          period,
          clock,
          possession,
          offenseTeamId: offense.team.teamId,
          type: 'injury',
          playerId: (side.players[index] as SimPlayer).id,
          teamId: side.team.teamId,
          gamesOut: injuryDuration(),
        });
        coach(side);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------
  const halftime = Math.floor(rules.periods / 2);
  for (period = 1; ; period++) {
    const overtime = period > rules.periods;
    if (overtime && home.score !== away.score) {
      period--;
      break;
    }
    const periodSeconds = (overtime ? rules.overtimeMinutes : rules.periodMinutes) * 60;
    clock = periodSeconds;
    // In overtime, team fouls carry over from the last period (FIBA rule).
    if (!overtime) {
      home.teamFouls = 0;
      away.teamFouls = 0;
    }
    // Timeouts: unused first-half timeouts are lost; every overtime has its own.
    if (overtime) {
      home.timeoutsLeft = away.timeoutsLeft = rules.timeoutsOvertime;
    } else if (period === 1) {
      home.timeoutsLeft = away.timeoutsLeft = rules.timeoutsFirstHalf;
    } else if (period === halftime + 1) {
      home.timeoutsLeft = away.timeoutsLeft = rules.timeoutsSecondHalf;
    }
    if (period > 1) {
      // The possession arrow decides who starts each period after the opening tip.
      offense = arrow;
      defense = offense === home ? away : home;
      arrow = defense;
      possession++;
    }
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'period_start',
      periodSeconds,
    });
    if (period === 1) {
      for (const side of [home, away]) {
        events.push({
          seq: events.length,
          period,
          clock,
          possession,
          offenseTeamId: offense.team.teamId,
          type: 'lineup',
          teamId: side.team.teamId,
          playerIds: side.onCourt.map((i) => (side.players[i] as SimPlayer).id),
        });
      }
      // Opening tip: the taller, higher-jumping centre wins it more often.
      const jumper = (side: Side): number => {
        let best = 0;
        for (let slot = 1; slot < 5; slot++) {
          const a = P(side, slot);
          const b = P(side, best);
          if (a.height + 0.5 * a.jumping > b.height + 0.5 * b.jumping) best = slot;
        }
        return best;
      };
      const homeJumper = P(home, jumper(home));
      const awayJumper = P(away, jumper(away));
      const edge =
        homeJumper.height +
        0.5 * homeJumper.jumping -
        (awayJumper.height + 0.5 * awayJumper.jumping);
      const homeWins = rng.next() < clamp(0.5 + E.tipSkillWeight * edge, 0.3, 0.7);
      offense = homeWins ? home : away;
      defense = homeWins ? away : home;
      arrow = defense;
      events.push({
        seq: events.length,
        period,
        clock,
        possession,
        offenseTeamId: offense.team.teamId,
        type: 'jump_ball',
        kind: 'opening',
        winnerTeamId: offense.team.teamId,
        jumperIds: [homeJumper.id, awayJumper.id],
      });
    } else {
      const amount = period === halftime + 1 ? E.halftimeRecovery : E.breakRecovery;
      rest(home, amount);
      rest(away, amount);
      deadBall();
    }

    let start: Start = 'dead';
    while (clock > 0) {
      start = playPossession(start);
      if (clock > 0) {
        const previous = offense;
        offense = defense;
        defense = previous;
        possession++;
        if (start === 'dead') deadBall();
        injuryCheck();
        timeoutWindow();
      }
    }
    events.push({
      seq: events.length,
      period,
      clock,
      possession,
      offenseTeamId: offense.team.teamId,
      type: 'period_end',
    });
    if (managedSide && period === halftime) {
      const side = managedSide === 'home' ? home : away;
      const { pace, pressure } = side.tactics;
      const tactics = yield {
        events: events.slice(),
        tactics: { pace, pressure },
      };
      if (tactics)
        side.tactics = { ...side.tactics, pace: tactics.pace, pressure: tactics.pressure };
    }
  }

  events.push({
    seq: events.length,
    period,
    clock,
    possession,
    offenseTeamId: offense.team.teamId,
    type: 'game_end',
  });
  return events;
}
