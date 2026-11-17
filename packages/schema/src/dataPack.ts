import { ClubDefinitionSchema } from './clubIdentity';
import { z } from 'zod';
import { NamePoolSchema } from './names';
import { RulesetSchema } from './ruleset';
import { UniverseConfigSchema } from './universe';
import { SCHEMA_VERSION } from './version';

export const DATA_PACK_FORMAT_VERSION = 1 as const;
export const MAX_DATA_PACK_BYTES = 2 * 1024 * 1024;
export const MAX_DATA_PACK_TEAMS = 512;
const word = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => s.trim().length > 0, 'no puede estar vacío');
const PackNamesSchema = NamePoolSchema.extend({
  cities: z
    .array(z.object({ name: word, region: word }).strict())
    .min(1)
    .max(256),
  teamNicknames: z.array(word).min(1).max(512),
  firstNames: z.array(word).min(1).max(2048),
  lastNames: z.array(word).min(1).max(2048),
}).strict();

/** Structural contract plus cross-file checks that JSON Schema alone cannot express. */
export const DataPackSchema = z
  .object({
    formatVersion: z.literal(DATA_PACK_FORMAT_VERSION),
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),
    name: word,
    description: z.string().max(1000).default(''),
    config: UniverseConfigSchema.extend({
      id: word,
      regions: z.array(word).min(1).max(256),
      rosterSize: z
        .object({ min: z.number().int().min(5).max(30), max: z.number().int().min(5).max(30) })
        .strict(),
      levels: z
        .array(
          UniverseConfigSchema.shape.levels.element.extend({
            competitionId: word,
            name: word,
            rulesetId: word,
            teamCount: z.number().int().min(2).max(MAX_DATA_PACK_TEAMS),
          }),
        )
        .min(1)
        .max(12),
    }).strict(),
    rulesets: z.array(RulesetSchema).min(1).max(32),
    names: PackNamesSchema,
    clubs: z.array(ClubDefinitionSchema).min(2).max(MAX_DATA_PACK_TEAMS).optional(),
  })
  .strict()
  .superRefine((pack, ctx) => {
    const issue = (path: PropertyKey[], message: string): void =>
      ctx.addIssue({ code: 'custom', path, message });
    const duplicate = (values: string[], path: PropertyKey[]): void => {
      const seen = new Set<string>();
      for (const [index, value] of values.entries()) {
        if (seen.has(value)) issue([...path, index], `valor duplicado: ${value}`);
        seen.add(value);
      }
    };
    duplicate(
      pack.rulesets.map((r) => r.id),
      ['rulesets'],
    );
    duplicate(pack.config.regions, ['config', 'regions']);
    duplicate(
      pack.config.levels.map((l) => l.competitionId),
      ['config', 'levels'],
    );
    duplicate(
      pack.names.cities.map((c) => c.name),
      ['names', 'cities'],
    );
    duplicate(pack.names.teamNicknames, ['names', 'teamNicknames']);
    const { min, max } = pack.config.rosterSize;
    if (min > max) issue(['config', 'rosterSize', 'max'], 'debe ser mayor o igual que min');
    if (max > 30)
      issue(['config', 'rosterSize', 'max'], 'límite actual: 30 jugadores por plantilla');
    if (pack.config.levels.length > 12) issue(['config', 'levels'], 'límite actual: 12 niveles');
    const total = pack.config.levels.reduce((sum, l) => sum + l.teamCount, 0);
    if (total > MAX_DATA_PACK_TEAMS)
      issue(['config', 'levels'], `límite actual: ${MAX_DATA_PACK_TEAMS} clubes`);
    const levels = pack.config.levels
      .map((level, index) => ({ level, index }))
      .sort((a, b) => a.level.level - b.level.level);
    for (const [position, { level, index }] of levels.entries()) {
      const path = ['config', 'levels', index];
      if (level.level !== position + 1)
        issue([...path, 'level'], 'los niveles deben ser consecutivos, desde 1, sin duplicados');
      if (!pack.rulesets.some((r) => r.id === level.rulesetId))
        issue([...path, 'rulesetId'], `reglamento inexistente: ${level.rulesetId}`);
      if (level.relegationSlots !== (levels[position + 1]?.level.promotionSlots ?? 0))
        issue(
          [...path, 'relegationSlots'],
          'debe coincidir con los ascensos del nivel inferior; el último nivel no tiene descensos',
        );
      if (position === 0 && level.promotionSlots !== 0)
        issue([...path, 'promotionSlots'], 'el primer nivel no puede ascender');
      if (level.promotionSlots > level.teamCount || level.relegationSlots > level.teamCount)
        issue(path, 'ascensos/descensos superan los clubes del nivel');
      if (level.format.groupCount > Math.floor(level.teamCount / 2))
        issue([...path, 'format', 'groupCount'], 'cada grupo necesita al menos dos clubes');
      if (
        level.format.playoffs &&
        level.format.playoffs.qualifiersPerGroup >
          Math.floor(level.teamCount / level.format.groupCount)
      )
        issue(
          [...path, 'format', 'playoffs', 'qualifiersPerGroup'],
          'hay más clasificados que clubes en un grupo',
        );
      if (level.minSalary * min > level.salaryCap)
        issue([...path, 'salaryCap'], 'no alcanza para una plantilla mínima con el salario mínimo');
    }
    if (pack.clubs) {
      duplicate(
        pack.clubs.map((club) => club.id),
        ['clubs'],
      );
      if (pack.clubs.length !== total) issue(['clubs'], `se requieren exactamente ${total} clubes`);
      const sources = new Set<string>();
      pack.clubs.forEach((club, index) => {
        if (!pack.config.levels.some((level) => level.competitionId === club.competitionId))
          issue(
            ['clubs', index, 'competitionId'],
            `competición inexistente: ${club.competitionId}`,
          );
        if (!pack.config.regions.includes(club.region))
          issue(['clubs', index, 'region'], `región no declarada: ${club.region}`);
        const source = club.identity.source;
        if (source) {
          const key = JSON.stringify([source.catalogId, source.clubId]);
          if (sources.has(key))
            issue(['clubs', index, 'identity', 'source'], 'identidad de origen duplicada');
          sources.add(key);
        }
      });
      pack.config.levels.forEach((level) => {
        const actual = pack.clubs!.filter(
          (club) => club.competitionId === level.competitionId,
        ).length;
        if (actual !== level.teamCount)
          issue(
            ['clubs'],
            `${level.competitionId}: se requieren ${level.teamCount} clubes, recibidos ${actual}`,
          );
      });
    }
    pack.names.cities.forEach((city, index) => {
      if (!pack.config.regions.includes(city.region))
        issue(['names', 'cities', index, 'region'], `región no declarada: ${city.region}`);
    });
    // Generation cycles through cities; preflight actual name demand so exhausted pools cannot loop.
    if (total <= MAX_DATA_PACK_TEAMS) {
      const used = new Set<string>();
      let ambiguous: string | null = null;
      const demand = new Map<string, number>();
      for (let i = 0; i < total; i++) {
        const city = pack.names.cities[i % pack.names.cities.length]!.name;
        demand.set(city, (demand.get(city) ?? 0) + 1);
      }
      for (const [city, needed] of demand) {
        let available = 0;
        for (const nickname of pack.names.teamNicknames) {
          const name = `${city} ${nickname}`;
          if (!used.has(name)) {
            used.add(name);
            available++;
          } else if (ambiguous === null) ambiguous = name;
        }
        if (available < needed)
          issue(
            ['names', 'teamNicknames'],
            `faltan nombres únicos para ${city}: ${needed} clubes, ${available} nombres`,
          );
      }
      if (ambiguous !== null)
        issue(['names', 'cities'], `combinación ciudad/apodo ambigua: ${ambiguous}`);
    }
  });
export type DataPack = z.infer<typeof DataPackSchema>;
