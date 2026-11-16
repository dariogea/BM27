import {
  SCHEMA_VERSION,
  POSITIONS,
  type Competition,
  type NamePool,
  type Player,
  type Position,
  type Ruleset,
  type Team,
  type Universe,
  type UniverseConfig,
} from '@bm27/schema';
import { BUILTIN_RULESETS, DEFAULT_NAME_POOL, DEFAULT_UNIVERSE_CONFIG } from '../data';
import { createRng } from '../rng';
import { generatePlayer, playerId } from './player';

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
          minAge: 19,
          maxAge: 34,
        });
        players.push(player);
        playerIds.push(player.id);
      }
      teams.push({ id: teamId, name, city: city.name, region: city.region, playerIds });
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
    });
  }

  const qualityByLevel: Record<string, number> = {};
  for (const level of levels) qualityByLevel[String(level.level)] = level.averageQuality;

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
