import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTRACTS,
  PlayerSchema,
  SCHEMA_VERSION,
  SchemaValidationError,
  allJsonSchemas,
  parseRuleset,
  type ContractName,
} from '../src/index';

describe('schema contract', () => {
  it('has a schema version', () => {
    expect(SCHEMA_VERSION).toBe(4);
  });

  it('accepts a valid ruleset and rejects an invalid one with a readable message', () => {
    const fiba = {
      id: 'fiba',
      name: 'FIBA',
      periods: 4,
      periodMinutes: 10,
      overtimeMinutes: 5,
      personalFoulLimit: 5,
      teamFoulsForBonus: 5,
      shotClockSeconds: 24,
      shotClockOffensiveReboundSeconds: 14,
    };
    expect(parseRuleset(fiba)).toEqual(fiba);
    expect(() => parseRuleset({ ...fiba, periodMinutes: -3 })).toThrow(SchemaValidationError);
    expect(() => parseRuleset({ ...fiba, periodMinutes: -3 })).toThrow(/periodMinutes/);
  });

  it('rejects out-of-range player attributes', () => {
    const result = PlayerSchema.safeParse({ id: 'p1' });
    expect(result.success).toBe(false);
  });

  it('exports every contract to JSON Schema and the committed files are up to date', () => {
    const schemas = allJsonSchemas();
    for (const name of Object.keys(CONTRACTS) as ContractName[]) {
      const file = join(__dirname, '..', 'json-schema', `${name}.schema.json`);
      expect(existsSync(file), `${file} missing: run "pnpm schema:export"`).toBe(true);
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(
        JSON.parse(JSON.stringify(schemas[name])),
      );
    }
  });
});
