import {
  NamePoolSchema,
  RulesetSchema,
  UniverseConfigSchema,
  parseWith,
  type NamePool,
  type Ruleset,
  type UniverseConfig,
} from '@bm27/schema';
import { z } from 'zod';
import namesEs from './names-es.json';
import rulesets from './rulesets.json';
import universeEs from './universe-es.json';

/** Built-in data. Everything is validated against the schema when loaded. */
export const BUILTIN_RULESETS: readonly Ruleset[] = parseWith(
  z.array(RulesetSchema),
  'built-in rulesets',
  rulesets,
);

export const DEFAULT_UNIVERSE_CONFIG: UniverseConfig = parseWith(
  UniverseConfigSchema,
  'built-in universe config',
  universeEs,
);

export const DEFAULT_NAME_POOL: NamePool = parseWith(NamePoolSchema, 'built-in name pool', namesEs);

export function getBuiltinRuleset(id: string): Ruleset {
  const found = BUILTIN_RULESETS.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown built-in ruleset "${id}"`);
  return found;
}
