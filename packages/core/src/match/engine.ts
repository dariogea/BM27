import type { MatchEvent, Ruleset, ShotType } from '@bm27/schema';
import { createRng } from '../rng';
import type { PreparedTeam, SimPlayer } from './prepare';

/**
 * PLACEHOLDER MATCH ENGINE (T-001).
 *
 * This is a deliberately simple, provisional possession-based engine whose only
 * purpose is to prove the architecture (seeded RNG, event log, derived stats,
 * performance). It has no tactics, no play types, no defensive coverages and a
 * naive rotation. It will be rewritten in a later task. Every constant below is
 * a rough calibration, not a basketball model.
 *
 * Contract that the definitive engine must keep: the ONLY output is the event
 * log; box scores are derived from it (see `deriveBoxScore`).
 */
export const PLACEHOLDER_ENGINE = {
  /** Flat boost to the home team's shot probabilities. */
  homeShotBonus: 0.012,
  /** Shortest and longest first action of a possession, in seconds. */
  firstActionMinSeconds: 6,
  /** Shortest action after an offensive rebound or a non-shooting foul. */
  resetActionMinSeconds: 3,
  turnoverBase: 0.175,
  stealShareOfTurnovers: 0.5,
  nonShootingFoulBase: 0.115,
  shootingFoulRate: { rim: 0.2, mid: 0.08, three: 0.04 },
  andOneFactor: 0.35,
  makeBase: { rim: 0.56, mid: 0.37, three: 0.285 },
  makeOffenseWeight: { rim: 0.3, mid: 0.25, three: 0.25 },
  makeDefenseWeight: { rim: 0.2, mid: 0.15, three: 0.12 },
  assistRate: { rim: 0.55, mid: 0.45, three: 0.8 },
  blockBase: { rim: 0.12, mid: 0.03, three: 0.01 },
  offensiveReboundBase: 0.28,
  freeThrowBase: 0.72,
  /** Players considered for voluntary substitutions. */
  rotationSize: 10,
  energyRecoveryPerSecond: 0.0016,
  minEnergy: 0.3,
  benchReadyEnergy: 0.85,
  substitutionHysteresis: 1.04,
  breakRecovery: 0.12,
  halftimeRecovery: 0.35,
} as const;

const E = PLACEHOLDER_ENGINE;

export interface MatchInput {
  home: PreparedTeam;
  away: PreparedTeam;
  ruleset: Ruleset;
  /** Seed string for this match. Same input + same seed ⇒ same events. */
  seed: string;
}

interface Side {
  team: PreparedTeam;
  players: SimPlayer[];
  /** Court slot (0..4) → index into `players`. */
  onCourt: number[];
  isOn: boolean[];
  energy: number[];
  fouls: number[];
  fouledOut: boolean[];
  score: number;
  teamFouls: number;
  shotBonus: number;
}

function makeSide(team: PreparedTeam, shotBonus: number): Side {
  const n = team.players.length;
  return {
    team,
    players: team.players,
    onCourt: [0, 1, 2, 3, 4],
    isOn: team.players.map((_, i) => i < 5),
    energy: new Array<number>(n).fill(1),
    fouls: new Array<number>(n).fill(0),
    fouledOut: new Array<boolean>(n).fill(false),
    score: 0,
    teamFouls: 0,
    shotBonus,
  };
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** Simulates one match and returns its complete event log. */
export function simulateMatch(input: MatchInput): MatchEvent[] {
  const rng = createRng(input.seed);
  const rules = input.ruleset;
  const events: MatchEvent[] = [];
  const home = makeSide(input.home, E.homeShotBonus);
  const away = makeSide(input.away, 0);

  let period = 1;
  let clock = 0;
  let possession = 0;
  let offense = rng.chance(0.5) ? home : away;
  let defense = offense === home ? away : home;
  const firstOffense = offense;

  const stamp = () => ({
    seq: events.length,
    period,
    clock,
    possession,
    offenseTeamId: offense.team.teamId,
  });

  const advance = (seconds: number): void => {
    for (const side of [home, away]) {
      const { energy, isOn, players } = side;
      for (let i = 0; i < energy.length; i++) {
        if (isOn[i]) {
          const next = (energy[i] as number) - seconds * (players[i] as SimPlayer).drain;
          energy[i] = next < E.minEnergy ? E.minEnergy : next;
        } else {
          const next = (energy[i] as number) + seconds * E.energyRecoveryPerSecond;
          energy[i] = next > 1 ? 1 : next;
        }
      }
    }
    clock -= seconds;
  };

  const rest = (side: Side, amount: number): void => {
    for (let i = 0; i < side.energy.length; i++) {
      side.energy[i] = Math.min(1, (side.energy[i] as number) + amount);
    }
  };

  const courtValue = (side: Side, index: number, slot: number): number => {
    const p = side.players[index] as SimPlayer;
    return p.overall * (p.slotFit[slot] as number) * (0.6 + 0.4 * (side.energy[index] as number));
  };

  /** Naive rotation: swap tired players for fresher ones, replace fouled-out players. */
  const rotate = (side: Side): void => {
    for (let slot = 0; slot < 5; slot++) {
      const current = side.onCourt[slot] as number;
      const forced = side.fouledOut[current] as boolean;
      let best = -1;
      let bestValue = forced
        ? -Infinity
        : courtValue(side, current, slot) * E.substitutionHysteresis;
      for (let j = 0; j < side.players.length; j++) {
        if (side.isOn[j] || side.fouledOut[j]) continue;
        if (!forced) {
          if (j >= E.rotationSize || (side.energy[j] as number) < E.benchReadyEnergy) continue;
          if (((side.players[j] as SimPlayer).slotFit[slot] as number) < 0.9) continue;
        }
        const value = courtValue(side, j, slot);
        if (value > bestValue) {
          best = j;
          bestValue = value;
        }
      }
      if (best >= 0) {
        side.onCourt[slot] = best;
        side.isOn[current] = false;
        side.isOn[best] = true;
        events.push({
          ...stamp(),
          type: 'substitution',
          teamId: side.team.teamId,
          playerInId: (side.players[best] as SimPlayer).id,
          playerOutId: (side.players[current] as SimPlayer).id,
        });
      }
      // If a fouled-out player cannot be replaced (nobody left), he stays on
      // court. PLACEHOLDER: real rules would continue with fewer players.
    }
  };

  const pickWeighted = (side: Side, weight: (p: SimPlayer) => number, exclude = -1): number => {
    let total = 0;
    for (let slot = 0; slot < 5; slot++) {
      if (slot !== exclude)
        total += weight(side.players[side.onCourt[slot] as number] as SimPlayer);
    }
    let roll = rng.next() * total;
    let last = 0;
    for (let slot = 0; slot < 5; slot++) {
      if (slot === exclude) continue;
      last = slot;
      roll -= weight(side.players[side.onCourt[slot] as number] as SimPlayer);
      if (roll < 0) return slot;
    }
    return last;
  };

  const playerAt = (side: Side, slot: number): SimPlayer =>
    side.players[side.onCourt[slot] as number] as SimPlayer;

  /**
   * Registers a defensive foul. `shotFreeThrows` is the number of free throws
   * for a shooting foul (0 for a personal foul). Returns true if the team is in
   * the bonus.
   */
  const commitFoul = (slot: number, drawnBy: SimPlayer, shotFreeThrows: number): boolean => {
    const index = defense.onCourt[slot] as number;
    const fouler = defense.players[index] as SimPlayer;
    defense.fouls[index] = (defense.fouls[index] as number) + 1;
    defense.teamFouls++;
    const inBonus = defense.teamFouls >= rules.teamFoulsForBonus;
    const fouledOut = (defense.fouls[index] as number) >= rules.personalFoulLimit;
    events.push({
      ...stamp(),
      type: 'foul',
      playerId: fouler.id,
      teamId: defense.team.teamId,
      drawnByPlayerId: drawnBy.id,
      kind: shotFreeThrows > 0 ? 'shooting' : 'personal',
      freeThrows: shotFreeThrows > 0 ? shotFreeThrows : inBonus ? 2 : 0,
      fouledOut,
    });
    if (fouledOut) {
      defense.fouledOut[index] = true;
      rotate(defense);
    }
    return inBonus;
  };

  /** Shoots free throws. Returns true if the last one was missed (live rebound). */
  const freeThrows = (shooter: SimPlayer, attempts: number): boolean => {
    const probability = clamp(E.freeThrowBase + 0.35 * (shooter.freeThrow - 0.2), 0.4, 0.95);
    let lastMissed = false;
    for (let i = 0; i < attempts; i++) {
      const made = rng.next() < probability;
      if (made) offense.score++;
      lastMissed = !made;
      events.push({ ...stamp(), type: 'free_throw', playerId: shooter.id, made });
    }
    return lastMissed;
  };

  /** Resolves a rebound. Returns true if the offense keeps the ball. */
  const rebound = (): boolean => {
    let off = 0;
    let def = 0;
    for (let slot = 0; slot < 5; slot++) {
      off += playerAt(offense, slot).offensiveRebound;
      def += playerAt(defense, slot).defensiveRebound;
    }
    const probability = clamp(E.offensiveReboundBase * Math.pow(off / def, 1.5), 0.1, 0.5);
    const offensive = rng.next() < probability;
    const side = offensive ? offense : defense;
    const slot = pickWeighted(side, (p) =>
      offensive ? p.offensiveRebound * p.offensiveRebound : p.defensiveRebound * p.defensiveRebound,
    );
    events.push({
      ...stamp(),
      type: 'rebound',
      playerId: playerAt(side, slot).id,
      teamId: side.team.teamId,
      kind: offensive ? 'offensive' : 'defensive',
    });
    return offensive;
  };

  const playPossession = (): void => {
    let reset = false;
    for (;;) {
      const minSeconds = reset ? E.resetActionMinSeconds : E.firstActionMinSeconds;
      const maxSeconds = reset ? rules.shotClockOffensiveReboundSeconds : rules.shotClockSeconds;
      let seconds = Math.round(minSeconds + rng.next() * (maxSeconds - minSeconds));
      if (seconds >= clock) {
        if (clock <= 3) {
          advance(clock); // not enough time for another action
          return;
        }
        seconds = clock; // last action of the period, at the buzzer
      }
      advance(seconds);

      const slot = pickWeighted(offense, (p) => p.usage);
      const user = playerAt(offense, slot);
      const defender = playerAt(defense, slot);
      const userEnergy = offense.energy[offense.onCourt[slot] as number] as number;

      // 1) Turnover
      const turnoverProbability = clamp(
        E.turnoverBase -
          0.05 * user.handling -
          0.03 * user.decisions +
          0.04 * ((defender.steal + defender.perimeterDefense) / 2),
        0.04,
        0.3,
      );
      if (rng.next() < turnoverProbability) {
        const stolen = rng.next() < E.stealShareOfTurnovers;
        const stealSlot = stolen ? pickWeighted(defense, (p) => Math.exp(p.steal * 1.5)) : -1;
        events.push({
          ...stamp(),
          type: 'turnover',
          playerId: user.id,
          ...(stolen ? { stealPlayerId: playerAt(defense, stealSlot).id } : {}),
        });
        return;
      }

      // 2) Non-shooting defensive foul
      const foulProbability = clamp(
        E.nonShootingFoulBase * (1 - 0.3 * defender.discipline),
        0.02,
        0.2,
      );
      if (rng.next() < foulProbability) {
        const inBonus = commitFoul(slot, user, 0);
        if (!inBonus) {
          reset = true;
          continue;
        }
        if (freeThrows(user, 2) && rebound()) {
          reset = true;
          continue;
        }
        return;
      }

      // 3) Shot
      const roll = rng.next();
      const shotType: ShotType =
        roll < user.shotMix[0] ? 'rim' : roll < user.shotMix[1] ? 'mid' : 'three';
      const skill = shotType === 'rim' ? user.close : shotType === 'mid' ? user.mid : user.three;
      const resistance = shotType === 'rim' ? defender.interiorDefense : defender.perimeterDefense;
      const makeProbability = clamp(
        (E.makeBase[shotType] +
          E.makeOffenseWeight[shotType] * skill -
          E.makeDefenseWeight[shotType] * resistance +
          offense.shotBonus) *
          (0.94 + 0.06 * userEnergy),
        0.05,
        0.95,
      );
      const points = shotType === 'three' ? 3 : 2;
      const shootingFoulProbability = clamp(
        E.shootingFoulRate[shotType] * (1 - 0.3 * defender.discipline),
        0.005,
        0.4,
      );
      const fouled = rng.next() < shootingFoulProbability;
      const made = rng.next() < (fouled ? makeProbability * E.andOneFactor : makeProbability);

      if (made || !fouled) {
        // A missed shot on a shooting foul is not a field-goal attempt.
        let assistSlot = -1;
        let blockSlot = -1;
        if (made) {
          offense.score += points;
          if (rng.next() < E.assistRate[shotType]) {
            assistSlot = pickWeighted(offense, (p) => Math.exp(p.passing * 1.5), slot);
          }
        } else if (rng.next() < clamp(E.blockBase[shotType] + 0.1 * defender.block, 0.005, 0.4)) {
          blockSlot = pickWeighted(defense, (p) => Math.exp(p.block * 2));
        }
        events.push({
          ...stamp(),
          type: 'shot',
          playerId: user.id,
          shotType,
          made,
          points: made ? points : 0,
          ...(assistSlot >= 0 ? { assistPlayerId: playerAt(offense, assistSlot).id } : {}),
          ...(blockSlot >= 0 ? { blockPlayerId: playerAt(defense, blockSlot).id } : {}),
        });
      }

      if (fouled) {
        const awarded = made ? 1 : points;
        commitFoul(slot, user, awarded);
        if (freeThrows(user, awarded) && rebound()) {
          reset = true;
          continue;
        }
        return;
      }
      if (made) return;
      if (rebound()) {
        reset = true;
        continue;
      }
      return;
    }
  };

  for (period = 1; ; period++) {
    const overtime = period > rules.periods;
    if (overtime && home.score !== away.score) {
      period--;
      break;
    }
    const periodSeconds = (overtime ? rules.overtimeMinutes : rules.periodMinutes) * 60;
    clock = periodSeconds;
    // PLACEHOLDER: in overtime, team fouls carry over from the last period.
    if (!overtime) {
      home.teamFouls = 0;
      away.teamFouls = 0;
    }
    if (period > 1) {
      // Alternate the first possession of each period.
      const startsWithFirst = period % 2 === 1;
      offense = startsWithFirst ? firstOffense : firstOffense === home ? away : home;
      defense = offense === home ? away : home;
      possession++;
    }
    events.push({ ...stamp(), type: 'period_start', periodSeconds });
    if (period === 1) {
      for (const side of [home, away]) {
        events.push({
          ...stamp(),
          type: 'lineup',
          teamId: side.team.teamId,
          playerIds: side.onCourt.map((i) => (side.players[i] as SimPlayer).id),
        });
      }
    } else {
      const amount =
        period === Math.floor(rules.periods / 2) + 1 ? E.halftimeRecovery : E.breakRecovery;
      rest(home, amount);
      rest(away, amount);
      rotate(home);
      rotate(away);
    }

    while (clock > 0) {
      playPossession();
      if (clock > 0) {
        const previous = offense;
        offense = defense;
        defense = previous;
        possession++;
        rotate(home);
        rotate(away);
      }
    }
    events.push({ ...stamp(), type: 'period_end' });
  }

  events.push({ ...stamp(), type: 'game_end' });
  return events;
}
