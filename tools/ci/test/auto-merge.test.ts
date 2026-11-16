import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module without types (it also runs inside GitHub Actions)
import {
  BLOCKING_LABELS,
  MANUAL_PATHS,
  REQUIRED_CHECKS,
  decide,
  latestReviewStates,
} from '../auto-merge.mjs';

type Input = Parameters<typeof decide>[0];

const CI = REQUIRED_CHECKS[0] as string;
const green = { name: CI, status: 'completed', conclusion: 'success' };
/** A patch that only adds lines. */
const ADDS_ONLY =
  '@@ -1,3 +1,4 @@\n const a = 1;\n+export function nueva(): void {}\n const b = 2;';

/** A pull request that would be merged: everything fine, CI green for long enough. */
function ok(overrides: Record<string, unknown> = {}): Input {
  return {
    pr: {
      number: 12,
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'main',
      headRefOid: 'abc123',
      labels: ['agente:claude'],
      reviewDecision: null,
      mergeable: 'MERGEABLE',
    },
    files: [{ filename: 'packages/core/src/market/market.ts', patch: ADDS_ONLY }, 'docs/estado.md'],
    checks: [green, { ...green }],
    reviews: [],
    behindBy: 0,
    minutesGreen: 12,
    graceMinutes: 10,
    eventSha: 'abc123',
    ...overrides,
  } as Input;
}

const withPr = (patch: Record<string, unknown>): Input => {
  const base = ok();
  return { ...base, pr: { ...base.pr, ...patch } } as Input;
};
const review = (user: string, state: string, at: string) => ({ user, state, submittedAt: at });

describe('automatic merge decision', () => {
  it('merges a green pull request that changes no contract', () => {
    expect(decide(ok())).toMatchObject({ action: 'merge', code: 'ok' });
  });

  it('never merges what is not open, is a draft or does not target main', () => {
    expect(decide(withPr({ state: 'MERGED' })).action).toBe('skip');
    expect(decide(withPr({ state: 'CLOSED' })).action).toBe('skip');
    expect(decide(withPr({ isDraft: true })).action).toBe('skip');
    expect(decide(withPr({ baseRefName: 't-007-otra-rama' })).action).toBe('skip');
  });

  it('ignores a CI run that is not about the current head commit', () => {
    expect(decide(ok({ eventSha: 'older-commit' }))).toMatchObject({
      action: 'skip',
      code: 'stale',
    });
  });
});

describe('the CI evidence', () => {
  it('waits while the CI has not finished and never merges with a red CI', () => {
    const running = ok({ checks: [green, { name: CI, status: 'in_progress', conclusion: null }] });
    expect(decide(running)).toMatchObject({ action: 'wait', code: 'ci-running' });
    expect(decide(ok({ checks: [] }))).toMatchObject({ action: 'wait', code: 'no-checks' });

    for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', null]) {
      const red = ok({ checks: [green, { name: CI, status: 'completed', conclusion }] });
      expect(decide(red), String(conclusion)).toMatchObject({ action: 'skip', code: 'ci-red' });
    }
  });

  it('requires a successful run of the project CI by name: a skipped or unrelated check is not evidence', () => {
    const onlySkipped = ok({
      checks: [{ name: 'otra cosa', status: 'completed', conclusion: 'skipped' }],
    });
    expect(decide(onlySkipped)).toMatchObject({ action: 'wait', code: 'ci-missing' });
    const unrelated = ok({
      checks: [{ name: 'Linter externo', status: 'completed', conclusion: 'success' }],
    });
    expect(decide(unrelated)).toMatchObject({ action: 'wait', code: 'ci-missing' });
    // The project CI must have succeeded, not merely been skipped.
    const ciSkipped = ok({ checks: [{ name: CI, status: 'completed', conclusion: 'skipped' }] });
    expect(decide(ciSkipped)).toMatchObject({ action: 'wait', code: 'ci-missing' });
    // Extra successful checks next to the CI are fine.
    const extra = ok({
      checks: [green, { name: 'Linter externo', status: 'completed', conclusion: 'success' }],
    });
    expect(decide(extra).action).toBe('merge');
  });
});

describe('what the owner merges by hand', () => {
  it.each(BLOCKING_LABELS)(
    'does not merge a pull request labelled "%s", and says why',
    (label: string) => {
      const result = decide(withPr({ labels: ['agente:claude', label] }));
      expect(result).toMatchObject({ action: 'skip', code: 'label', notify: true });
      expect(result.reason).toContain(label);
    },
  );

  it.each([
    'packages/schema/src/team.ts',
    'packages/schema/src/migrations.ts',
    'packages/core/src/index.ts',
    '.github/workflows/ci.yml',
    '.github/workflows/auto-merge.yml',
    '.github/labels.yml',
    'CLAUDE.md',
    'AGENTS.md',
    // The merge policy protects itself: its script and its tests have the same power as the workflow.
    'tools/ci/auto-merge.mjs',
    'tools/ci/test/auto-merge.test.ts',
  ])('does not merge a pull request that changes %s', (file: string) => {
    const result = decide(ok({ files: ['docs/estado.md', file] }));
    expect(result).toMatchObject({ action: 'skip', code: 'manual-files', notify: true });
    expect(result.reason).toContain(file);
  });

  it.each([
    ['CLAUDE.md', 'docs/reglas.md'],
    ['AGENTS.md', 'docs/agentes.md'],
    ['.github/workflows/ci.yml', 'docs/ci.yml'],
    ['packages/schema/src/team.ts', 'docs/team.ts'],
    ['tools/ci/auto-merge.mjs', 'docs/auto-merge.mjs'],
  ])(
    'does not merge a rename of %s out of its protected place (to %s)',
    (from: string, to: string) => {
      const result = decide(ok({ files: [{ filename: to, previous_filename: from }] }));
      expect(result).toMatchObject({ action: 'skip', code: 'manual-files' });
      expect(result.reason).toContain(from);
    },
  );

  it('does not merge a rename INTO a protected place either', () => {
    const result = decide(
      ok({ files: [{ filename: 'CLAUDE.md', previous_filename: 'docs/reglas.md' }] }),
    );
    expect(result).toMatchObject({ action: 'skip', code: 'manual-files' });
  });

  it.each([
    'packages/schema/json-schema/team.schema.json',
    'packages/schema/test/schema.test.ts',
    'packages/core/test/market.test.ts',
    'apps/web/src/App.tsx',
    'docs/decisiones.md',
    'README.md',
    'tools/cli/src/bench.ts',
  ])('can merge a pull request that only changes %s', (file: string) => {
    expect(decide(ok({ files: [file] })).action).toBe('merge');
  });

  it('keeps the list of manual paths limited to what the owner must approve', () => {
    expect(MANUAL_PATHS).toHaveLength(6);
  });
});

describe('indirect changes to the public API of the core', () => {
  const core = (patch: string | undefined, filename = 'packages/core/src/game/manage.ts') => ({
    filename,
    patch,
  });

  it('does not merge a removed or changed exported declaration (a changed signature shows as one)', () => {
    const changed =
      '@@ -4,3 +4,3 @@\n-export function setTeamTactics(u: Universe, id: string): Universe {\n+export function setTeamTactics(u: Universe, id: string, t: Tactics): Universe {';
    const removed = '@@ -4,3 +4,2 @@\n-export const LIMIT = 4;\n const a = 1;';
    for (const patch of [changed, removed]) {
      const result = decide(ok({ files: [core(patch)] }));
      expect(result).toMatchObject({ action: 'skip', code: 'api-change', notify: true });
      expect(result.reason).toContain('packages/core/src/game/manage.ts');
    }
  });

  it('can merge a change that only ADDS exports or touches internals', () => {
    expect(decide(ok({ files: [core(ADDS_ONLY)] })).action).toBe('merge');
    const internal = '@@ -4,3 +4,3 @@\n-  const x = 1;\n+  const x = 2;';
    expect(decide(ok({ files: [core(internal)] })).action).toBe('merge');
  });

  it('does not trust a core file whose patch GitHub did not provide (too large to check)', () => {
    expect(decide(ok({ files: [core(undefined)] }))).toMatchObject({
      action: 'skip',
      code: 'api-change',
    });
  });

  it('looks only at the sources of the core, not at its tests or at other packages', () => {
    const removedExport = '@@ -1 +1 @@\n-export const A = 1;\n+export const A = 2;';
    for (const filename of [
      'packages/core/test/x.test.ts',
      'apps/web/src/platform.ts',
      'tools/cli/src/bench.ts',
    ]) {
      expect(decide(ok({ files: [{ filename, patch: removedExport }] })).action, filename).toBe(
        'merge',
      );
    }
  });
});

describe('reviews', () => {
  it('does not merge while a review asks for changes, even if GitHub reports no decision (no branch protection)', () => {
    const reviews = [review('codex', 'CHANGES_REQUESTED', '2026-11-16T19:00:00Z')];
    expect(decide(ok({ reviews }))).toMatchObject({
      action: 'skip',
      code: 'changes-requested',
      notify: true,
    });
    expect(decide(withPr({ reviewDecision: 'CHANGES_REQUESTED' })).code).toBe('changes-requested');
  });

  it('lets the reviewer change their mind: only the latest state of each reviewer counts', () => {
    const asked = review('codex', 'CHANGES_REQUESTED', '2026-11-16T19:00:00Z');
    expect(
      decide(ok({ reviews: [asked, review('codex', 'APPROVED', '2026-11-16T19:30:00Z')] })).action,
    ).toBe('merge');
    expect(
      decide(ok({ reviews: [asked, review('codex', 'DISMISSED', '2026-11-16T19:30:00Z')] })).action,
    ).toBe('merge');
    // Comments neither block nor clear a request for changes.
    expect(
      decide(ok({ reviews: [asked, review('codex', 'COMMENTED', '2026-11-16T19:30:00Z')] })).action,
    ).toBe('skip');
    expect(
      decide(ok({ reviews: [review('codex', 'COMMENTED', '2026-11-16T19:30:00Z')] })).action,
    ).toBe('merge');
  });

  it('one reviewer approving does not clear another reviewer who asked for changes', () => {
    const reviews = [
      review('claude', 'CHANGES_REQUESTED', '2026-11-16T19:00:00Z'),
      review('codex', 'APPROVED', '2026-11-16T19:10:00Z'),
    ];
    expect(decide(ok({ reviews })).code).toBe('changes-requested');
  });

  it('computes the latest state per reviewer regardless of the order they are listed in', () => {
    const latest = latestReviewStates([
      review('a', 'APPROVED', '2026-11-16T20:00:00Z'),
      review('a', 'CHANGES_REQUESTED', '2026-11-16T19:00:00Z'),
      review('b', 'COMMENTED', '2026-11-16T19:00:00Z'),
    ]);
    expect([...latest.entries()]).toEqual([['a', 'APPROVED']]);
  });
});

describe('the rest of the conditions', () => {
  it('requires the branch to include everything in main, so the CI tests the real result', () => {
    const result = decide(ok({ behindBy: 3 }));
    expect(result).toMatchObject({ action: 'skip', code: 'behind', notify: true });
    expect(result.reason).toContain('3 commit');
  });

  it('does not merge with conflicts, and waits while GitHub is still working it out', () => {
    expect(decide(withPr({ mergeable: 'CONFLICTING' }))).toMatchObject({
      action: 'skip',
      code: 'conflict',
    });
    expect(decide(withPr({ mergeable: 'UNKNOWN' }))).toMatchObject({
      action: 'wait',
      code: 'mergeable-unknown',
    });
  });

  it('waits the grace period after the CI turns green, so the cross review can block it', () => {
    expect(decide(ok({ minutesGreen: 2 }))).toMatchObject({ action: 'wait', code: 'grace' });
    expect(decide(ok({ minutesGreen: 9.9 })).action).toBe('wait');
    expect(decide(ok({ minutesGreen: 10 })).action).toBe('merge');
  });

  it('merges without waiting when the grace period is zero (the final check right before merging)', () => {
    expect(decide(ok({ minutesGreen: 0, graceMinutes: 0 })).action).toBe('merge');
  });

  it('checks the safety rules before the waiting time, never merging a blocked pull request later', () => {
    const blocked = withPr({ labels: ['bloqueado'] });
    expect(decide({ ...blocked, minutesGreen: 0 } as Input).action).toBe('skip');
    expect(decide({ ...blocked, minutesGreen: 100 } as Input).action).toBe('skip');
  });
});
