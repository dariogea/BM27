import {
  SCHEMA_VERSION,
  POSITIONS,
  type Competition,
  type NamePool,
  type Player,
  type Position,
  type Ruleset,
  type Team,
  type TeamTactics,
  type Universe,
  type UniverseConfig,
} from '@bm27/schema';
import { BUILTIN_RULESETS, DEFAULT_NAME_POOL, DEFAULT_UNIVERSE_CONFIG } from '../data';
import { createRng, type Rng } from '../rng';
import { FINANCE, revenueOf } from '../finance/economy';
import { askingSalary } from '../market/market';
import { MARKET } from '../market/value';
import { sampleCareerAge } from './development';
import { generatePlayer, playerId } from './player';

/** Reputation points gained per point of squad quality above the level average. */
const REPUTATION_PER_QUALITY = 3;

export interface GenerateUniverseOptions {
  seed: string;
  config?: UniverseConfig;
  names?: NamePool;
  rulesets?: readonly Ruleset[];
}

/**
 * Builds a fully fictional universe from a seed and a data-only configuration.
 * Same seed + same config ⇒ identical universe.
 */
export function generateUniverse(options: GenerateUniverseOptions): Universe {
  const config = options.config ?? DEFAULT_UNIVERSE_CONFIG;
  const names = options.names ?? DEFAULT_NAME_POOL;
  const rulesets = options.rulesets ?? BUILTIN_RULESETS;
  const rng = createRng(`${options.seed}/universe`);

  validateConfig(config, rulesets);

  const totalTeams = config.levels.reduce((sum, l) => sum + l.teamCount, 0);
  const maxNames = names.cities.length * names.teamNicknames.length;
  if (totalTeams > maxNames) {
    throw new Error(`Name pool too small: ${totalTeams} teams but only ${maxNames} unique names`);
  }

  // Cities are listed roughly from largest to smallest: top levels get the big
  // ones. When the list is exhausted we start again with a different nickname.
  const usedNames = new Set<string>();
  const teams: Team[] = [];
  const players: Player[] = [];
  const competitions: Competition[] = [];
  let playerSeq = 1;
  let teamSeq = 1;
  let cityCursor = 0;

  const levels = [...config.levels].sort((a, b) => a.level - b.level);
  for (const level of levels) {
    const teamIds: string[] = [];
    for (let i = 0; i < level.teamCount; i++) {
      const city = names.cities[cityCursor % names.cities.length]!;
      cityCursor++;
      let name = '';
      do {
        name = `${city.name} ${rng.pick(names.teamNicknames)}`;
      } while (usedNames.has(name));
      usedNames.add(name);

      const teamId = `t${String(teamSeq++).padStart(3, '0')}`;
      const teamQuality = level.averageQuality + rng.normal(0, 3.5);
      const rosterSize = rng.int(config.rosterSize.min, config.rosterSize.max);
      const playerIds: string[] = [];
      for (let slot = 0; slot < rosterSize; slot++) {
        // Two full line-ups first, then random positions.
        const position: Position =
          slot < 10 ? (POSITIONS[slot % 5] as Position) : rng.pick(POSITIONS);
        const player = generatePlayer(rng, names, {
          id: playerId(playerSeq++),
          teamId,
          quality: teamQuality,
          position,
          minAge: 18,
          maxAge: 18,
          // Steady-state age mix, so the world does not age (or rejuvenate) over time.
          age: sampleCareerAge(rng),
        });
        players.push(player);
        playerIds.push(player.id);
      }
      // Reputation follows the quality of the squad (plus luck); it sets the club's income.
      const reputation = Math.round(
        Math.max(
          5,
          Math.min(
            98,
            level.economy.baseReputation +
              REPUTATION_PER_QUALITY * (teamQuality - level.averageQuality) +
              rng.normal(0, 6),
          ),
        ),
      );
      const groupSize = level.teamCount / Math.max(1, level.format.groupCount);
      const homeGames = Math.round(((groupSize - 1) * level.format.roundRobinLegs) / 2);
      const revenue = revenueOf(level.economy, reputation, homeGames).total;
      const wageBudgetNow = Math.min(level.salaryCap, revenue * level.economy.wageShare);

      // Contracts: asking salary with a little spread, scaled down if the club would exceed
      // its cap or the wage budget its income allows.
      const roster = players.slice(-rosterSize);
      const asking = roster.map(
        (p) =>
          askingSalary(p, { minSalary: level.minSalary } as Competition) *
          (0.92 + 0.16 * rng.next()),
      );
      const total = asking.reduce((a, b) => a + b, 0);
      const limit = Math.min(level.salaryCap, wageBudgetNow) * 0.97;
      const scale = total > limit ? limit / total : 1;
      roster.forEach((p, i) => {
        const salary = Math.max(
          level.minSalary,
          Math.round(((asking[i] as number) * scale) / 1000) * 1000,
        );
        // Contracts end between this season and three seasons from now.
        p.contract = { salary, endSeason: 1 + rng.int(0, MARKET.maxYears - 1) };
      });
      teams.push({
        id: teamId,
        name,
        city: city.name,
        region: city.region,
        playerIds,
        tactics: chooseTactics(players.slice(-rosterSize), rng),
        rotation: null,
        reputation,
        finance: {
          balance: Math.round(revenue * FINANCE.openingBalanceShare * (0.5 + rng.next())),
          lastRevenue: revenue,
        },
      });
      teamIds.push(teamId);
    }
    competitions.push({
      id: level.competitionId,
      name: level.name,
      level: level.level,
      rulesetId: level.rulesetId,
      format: level.format,
      promotionSlots: level.promotionSlots,
      relegationSlots: level.relegationSlots,
      teamIds,
      salaryCap: level.salaryCap,
      minSalary: level.minSalary,
      rosterMin: config.rosterSize.min,
      rosterMax: config.rosterSize.max,
      economy: level.economy,
    });
  }

  const qualityByLevel: Record<string, number> = {};
  for (const level of levels) qualityByLevel[String(level.level)] = level.averageQuality;

  // A small pool of free agents, so the market is not empty on day one: about one for every
  // four clubs of each level, of the quality of that level.
  for (const level of levels) {
    for (let i = 0; i < Math.round(level.teamCount / 4); i++) {
      players.push(
        generatePlayer(rng, names, {
          id: playerId(playerSeq++),
          teamId: null,
          quality: level.averageQuality - 2,
          position: rng.pick(POSITIONS),
          minAge: 18,
          maxAge: 18,
          age: sampleCareerAge(rng),
        }),
      );
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seed: options.seed,
    seasonNumber: 1,
    nextPlayerSeq: playerSeq,
    regions: [...config.regions],
    qualityByLevel,
    rulesets: rulesets.map((r) => ({ ...r })),
    competitions,
    teams,
    players,
    history: [],
    transactions: [],
    currentSeason: null,
    userTeamId: null,
  };
}

/**
 * PLACEHOLDER club AI: picks tactics that roughly suit the squad, with some
 * randomness so that not every team plays the same way. There is no coach
 * entity yet; a later task will replace this.
 */
export function chooseTactics(roster: readonly Player[], rng: Rng): TeamTactics {
  const mean = (pick: (p: Player) => number, of: readonly Player[] = roster): number =>
    of.reduce((sum, p) => sum + pick(p), 0) / Math.max(1, of.length);
  const bigs = roster.filter((p) => p.positions[0] === 'PF' || p.positions[0] === 'C');
  const jitter = (): number => rng.normal(0, 3);

  const shooting = mean((p) => p.attributes.offensive.threePoint) + jitter();
  const insideGame = mean((p) => p.attributes.offensive.closeShot) + jitter();
  const athleticism =
    mean((p) => (p.attributes.physical.speed + p.attributes.physical.stamina) / 2) -
    mean((p) => p.attributes.mental.decisions) +
    jitter();
  const perimeterD = mean((p) => p.attributes.defensive.perimeterDefense) + jitter();
  const interiorD = mean((p) => p.attributes.defensive.interiorDefense) + jitter();
  const thieves =
    mean((p) => p.attributes.defensive.steal) -
    mean((p) => p.attributes.mental.discipline) +
    jitter();
  const glass =
    mean((p) => p.attributes.offensive.offensiveRebound) -
    mean((p) => p.attributes.physical.speed) +
    jitter();
  const bigSpeed = mean((p) => p.attributes.physical.speed, bigs) + jitter();
  const bigBlock = mean((p) => p.attributes.defensive.block, bigs) + jitter();

  const coverage: TeamTactics['pickAndRollCoverage'] =
    bigSpeed - bigBlock > 2
      ? rng.chance(0.6)
        ? 'switch'
        : 'hedge'
      : bigBlock - bigSpeed > 12
        ? 'drop'
        : rng.chance(0.12)
          ? 'blitz'
          : 'hedge';

  return {
    pace: athleticism > 3 ? 'fast' : athleticism < -3 ? 'slow' : 'normal',
    offenseFocus:
      shooting - insideGame > 3 ? 'perimeter' : insideGame - shooting > 3 ? 'inside' : 'balanced',
    defenseScheme: interiorD - perimeterD > 5 ? 'zone' : 'man',
    pickAndRollCoverage: coverage,
    pressure: thieves > 3 ? 'high' : thieves < -3 ? 'low' : 'normal',
    offensiveRebounding: glass > 4 ? 'crash' : glass < -4 ? 'get-back' : 'normal',
    rotationDepth: rng.int(9, 10),
  };
}

function validateConfig(config: UniverseConfig, rulesets: readonly Ruleset[]): void {
  const levels = [...config.levels].sort((a, b) => a.level - b.level);
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    if (!rulesets.some((r) => r.id === level.rulesetId)) {
      throw new Error(`Level ${level.level}: unknown ruleset "${level.rulesetId}"`);
    }
    const below = levels[i + 1];
    const relegated = level.relegationSlots;
    const promoted = below?.promotionSlots ?? 0;
    if (relegated !== promoted) {
      throw new Error(
        `Level ${level.level} relegates ${relegated} team(s) but the level below promotes ${promoted}`,
      );
    }
    if (i === 0 && level.promotionSlots !== 0) {
      throw new Error('The top level cannot have promotion slots');
    }
    const playoffs = level.format.playoffs;
    if (playoffs) {
      const perGroup = Math.floor(level.teamCount / level.format.groupCount);
      if (playoffs.qualifiersPerGroup > perGroup) {
        throw new Error(`Level ${level.level}: more playoff qualifiers than teams in a group`);
      }
    }
  }
}
