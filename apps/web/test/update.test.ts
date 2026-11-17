import { describe, expect, it } from 'vitest';
import {
  checkForUpdate,
  compareVersions,
  newestRelease,
  parseVersion,
  type ParsedVersion,
} from '../src/update';

const v = (text: string): ParsedVersion => parseVersion(text)!;

describe('version order', () => {
  it('parses tags and rejects anything else', () => {
    expect(parseVersion('v0.1.0-alpha.1')).toEqual({
      major: 0,
      minor: 1,
      patch: 0,
      pre: ['alpha', '1'],
    });
    expect(parseVersion('1.2.3')).toMatchObject({ major: 1, pre: [] });
    for (const bad of ['', 'latest', '1.2', 'v1.2.3.4', 'x.y.z', 'v1.2.3-'])
      expect(parseVersion(bad)).toBeNull();
  });

  it('orders versions like semantic versioning', () => {
    const ascending = [
      '0.1.0-alpha.1',
      '0.1.0-alpha.2',
      '0.1.0-alpha.10',
      '0.1.0-beta.1',
      '0.1.0-rc.1',
      '0.1.0',
      '0.1.1',
      '0.2.0',
      '1.0.0',
    ];
    for (let i = 0; i < ascending.length - 1; i++) {
      expect(
        compareVersions(v(ascending[i]!), v(ascending[i + 1]!)),
        `${ascending[i]} < ${ascending[i + 1]}`,
      ).toBeLessThan(0);
      expect(compareVersions(v(ascending[i + 1]!), v(ascending[i]!))).toBeGreaterThan(0);
    }
    expect(compareVersions(v('1.0.0'), v('v1.0.0'))).toBe(0);
  });
});

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `BM27 ${tag}`,
  draft: false,
  prerelease: tag.includes('-'),
  html_url: `https://example.test/releases/${tag}`,
  published_at: '2026-11-17T12:00:00Z',
  assets: [
    { name: `BM27_${tag}_x64-setup.exe`, browser_download_url: `https://example.test/${tag}.exe` },
  ],
  ...extra,
});

describe('newestRelease', () => {
  it('ignores drafts, odd tags and (for stable users) pre-releases', () => {
    const list = [
      release('v0.2.0-alpha.1'),
      release('v0.1.0'),
      release('v9.9.9', { draft: true }),
      release('nightly'),
    ];
    expect(newestRelease(list, true)?.tag).toBe('v0.2.0-alpha.1');
    expect(newestRelease(list, false)?.tag).toBe('v0.1.0');
    expect(newestRelease([], true)).toBeNull();
    expect(newestRelease('nope', true)).toBeNull();
  });

  it('exposes the installer of the release', () => {
    expect(newestRelease([release('v0.1.0')], false)?.installerUrl).toBe(
      'https://example.test/v0.1.0.exe',
    );
    expect(newestRelease([release('v0.1.0', { assets: [] })], false)?.installerUrl).toBeNull();
  });
});

const answer = (status: number, body: unknown = []) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('checkForUpdate', () => {
  it('reports a newer pre-release to an alpha user', async () => {
    const result = await checkForUpdate({
      current: '0.1.0-alpha.1',
      fetchFn: answer(200, [release('v0.1.0-alpha.2'), release('v0.1.0-alpha.1')]),
    });
    expect(result).toMatchObject({ kind: 'available', release: { tag: 'v0.1.0-alpha.2' } });
  });

  it('says up to date when the newest release is the running one or older', async () => {
    expect(
      await checkForUpdate({
        current: '0.1.0-alpha.2',
        fetchFn: answer(200, [release('v0.1.0-alpha.2')]),
      }),
    ).toEqual({ kind: 'up-to-date', current: '0.1.0-alpha.2' });
    expect(
      await checkForUpdate({ current: '1.0.0', fetchFn: answer(200, [release('v0.9.0')]) }),
    ).toMatchObject({
      kind: 'up-to-date',
    });
  });

  it('does not offer pre-releases to someone on a stable version', async () => {
    expect(
      await checkForUpdate({ current: '1.0.0', fetchFn: answer(200, [release('v1.1.0-beta.1')]) }),
    ).toMatchObject({ kind: 'up-to-date' });
  });

  it('explains why it could not check, and never throws', async () => {
    expect(await checkForUpdate({ current: '0.1.0', fetchFn: answer(404) })).toMatchObject({
      reason: 'private-or-missing',
    });
    expect(await checkForUpdate({ current: '0.1.0', fetchFn: answer(403) })).toMatchObject({
      reason: 'rate-limited',
    });
    expect(await checkForUpdate({ current: '0.1.0', fetchFn: answer(500) })).toMatchObject({
      reason: 'bad-answer',
    });
    const offline = (async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    expect(await checkForUpdate({ current: '0.1.0', fetchFn: offline })).toMatchObject({
      reason: 'offline',
    });
    expect(await checkForUpdate({ current: 'dev', fetchFn: answer(200) })).toMatchObject({
      reason: 'bad-version',
    });
    expect(
      await checkForUpdate({ current: '0.1.0', repo: 'not a repo', fetchFn: answer(200) }),
    ).toMatchObject({ reason: 'bad-answer' });
  });

  it('sends the token only when given, and asks the right repository', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const spy = (async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, headers: init.headers });
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    await checkForUpdate({ current: '0.1.0', repo: 'a/b', fetchFn: spy });
    await checkForUpdate({ current: '0.1.0', repo: 'a/b', token: ' secret ', fetchFn: spy });
    expect(calls[0]!.url).toContain('/repos/a/b/releases');
    expect(calls[0]!.headers.Authorization).toBeUndefined();
    expect(calls[1]!.headers.Authorization).toBe('Bearer secret');
  });
});
