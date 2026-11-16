import { z } from 'zod';
import { RulesetSchema, type Ruleset } from './ruleset';
import { UniverseSchema, type Universe } from './universe';

/** Thrown when data does not match the contract. The message is human readable. */
export class SchemaValidationError extends Error {
  readonly issues: readonly z.core.$ZodIssue[];
  constructor(what: string, error: z.ZodError) {
    const shown = error.issues.slice(0, 10);
    const lines = shown.map((i) => `  - ${formatPath(i.path)}: ${i.message}`);
    const more =
      error.issues.length > shown.length
        ? `\n  ... and ${error.issues.length - shown.length} more problem(s)`
        : '';
    super(`Invalid ${what} (${error.issues.length} problem(s)):\n${lines.join('\n')}${more}`);
    this.name = 'SchemaValidationError';
    this.issues = error.issues;
  }
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(root)';
  return path
    .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
    .join('');
}

export function parseWith<T>(schema: z.ZodType<T>, what: string, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new SchemaValidationError(what, result.error);
  return result.data;
}

export function parseUniverse(data: unknown): Universe {
  return parseWith(UniverseSchema, 'universe', data);
}

export function parseRuleset(data: unknown): Ruleset {
  return parseWith(RulesetSchema, 'ruleset', data);
}
