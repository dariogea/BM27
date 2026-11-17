import { ClubDefinitionSchema, ClubIdentitySchema, ClubSourceSchema } from './clubIdentity';
import { DataPackSchema } from './dataPack';
import { z } from 'zod';
import { CompetitionSchema } from './competition';
import { MatchEventSchema } from './event';
import { MatchDetailSchema, MatchResultSchema } from './match';
import { PlayerSchema } from './player';
import { RulesetSchema } from './ruleset';
import { SaveEnvelopeSchema } from './save';
import { SeasonProgressSchema, SeasonSchema } from './season';
import { TeamSchema, TeamTacticsSchema } from './team';
import { NamePoolSchema, UniverseConfigSchema, UniverseSchema } from './universe';

/** Every public contract, by file name, for JSON Schema export (used by mods/tools). */
export const CONTRACTS = {
  'data-pack': DataPackSchema,
  'club-definition': ClubDefinitionSchema,
  'club-identity': ClubIdentitySchema,
  'club-source': ClubSourceSchema,
  player: PlayerSchema,
  team: TeamSchema,
  'team-tactics': TeamTacticsSchema,
  ruleset: RulesetSchema,
  competition: CompetitionSchema,
  event: MatchEventSchema,
  'match-result': MatchResultSchema,
  'match-detail': MatchDetailSchema,
  season: SeasonSchema,
  'season-progress': SeasonProgressSchema,
  universe: UniverseSchema,
  'universe-config': UniverseConfigSchema,
  'name-pool': NamePoolSchema,
  'save-envelope': SaveEnvelopeSchema,
} as const;

export type ContractName = keyof typeof CONTRACTS;

export function toJsonSchema(name: ContractName): unknown {
  return z.toJSONSchema(CONTRACTS[name]);
}

export function allJsonSchemas(): Record<ContractName, unknown> {
  const out = {} as Record<ContractName, unknown>;
  for (const name of Object.keys(CONTRACTS) as ContractName[]) out[name] = toJsonSchema(name);
  return out;
}
