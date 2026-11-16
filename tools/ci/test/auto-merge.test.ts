import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module without types (it also runs inside GitHub Actions)
import { BLOCKING_LABELS, MANUAL_PATHS, decide } from '../auto-merge.mjs';

type Input = Parameters<typeof decide>[0];

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
    files: ['packages/core/src/market/market.ts', 'docs/estado.md'],
    checks: [
      { status: 'completed', conclusion: 'success' },
      { status: 'completed', conclusion: 'success' },
    ],
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

  it('waits while the CI has not finished and never merges with a red CI', () => {
    const running = ok({
      checks: [
        { status: 'completed', conclusion: 'success' },
        { status: 'in_progress', conclusion: null },
      ],
    });
    expect(decide(running)).toMatchObject({ action: 'wait', code: 'ci-running' });
    expect(decide(ok({ checks: [] }))).toMatchObject({ action: 'wait', code: 'no-checks' });

    for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', null]) {
      const red = ok({
        checks: [
          { status: 'completed', conclusion: 'success' },
          { status: 'completed', conclusion },
        ],
      });
      expect(decide(red), String(conclusion)).toMatchObject({ action: 'skip', code: 'ci-red' });
    }
  });

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
  ])('does not merge a pull request that changes %s', (file: string) => {
    const result = decide(ok({ files: ['docs/estado.md', file] }));
    expect(result).toMatchObject({ action: 'skip', code: 'manual-files', notify: true });
    expect(result.reason).toContain(file);
  });

  it.each([
    'packages/core/src/market/market.ts',
    'packages/core/src/season/offseason.ts',
    'packages/schema/json-schema/team.schema.json',
    'packages/schema/test/schema.test.ts',
    'apps/web/src/App.tsx',
    'docs/decisiones.md',
    'README.md',
    'tools/cli/src/bench.ts',
  ])('can merge a pull request that only changes %s', (file: string) => {
    expect(decide(ok({ files: [file] })).action).toBe('merge');
  });

  it('does not merge while a review asks for changes', () => {
    expect(decide(withPr({ reviewDecision: 'CHANGES_REQUESTED' }))).toMatchObject({
      action: 'skip',
      code: 'changes-requested',
      notify: true,
    });
    expect(decide(withPr({ reviewDecision: 'APPROVED' })).action).toBe('merge');
  });

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

  it('checks the safety rules before the waiting time, never merging a blocked pull request later', () => {
    const blocked = withPr({ labels: ['bloqueado'] });
    expect(decide({ ...blocked, minutesGreen: 0 } as Input).action).toBe('skip');
    expect(decide({ ...blocked, minutesGreen: 100 } as Input).action).toBe('skip');
  });

  it('keeps the list of manual paths limited to what the owner must approve', () => {
    expect(MANUAL_PATHS).toHaveLength(5);
  });
});
