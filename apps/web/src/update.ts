/**
 * Update check for the desktop app (the "launcher" part of BM27).
 *
 * At start the app asks GitHub for the Releases of the project and compares the newest one with
 * the version it is running. Pure logic with an injectable `fetch`, so it can be tested without
 * a network. The page that downloads and installs the new version is the Release page itself:
 * the installer is not signed, so the app only tells the player and links to it.
 */

/** Repository whose Releases are checked. Can be overridden in the launcher panel. */
export const DEFAULT_RELEASES_REPO = 'dariogea/BM27';

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated pre-release identifiers (`alpha.1`), empty for a stable version. */
  pre: string[];
}

/** Parses `v1.2.3` or `1.2.3-alpha.1`. Returns null for anything else. */
export function parseVersion(text: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    text.trim(),
  );
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split('.') : [],
  };
}

/** Semantic-versioning order: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  // A version with a pre-release part is older than the same version without it.
  if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length;
  const length = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < length; i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1; // fewer identifiers is older
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y);
    } else if (nx !== ny) {
      return nx ? -1 : 1; // numbers are older than words
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  prerelease: boolean;
  url: string;
  publishedAt: string | null;
  installerUrl: string | null;
}

interface GithubRelease {
  tag_name?: unknown;
  name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

/** Picks the newest valid, published Release (drafts and unparsable tags are ignored). */
export function newestRelease(raw: unknown, includePrereleases: boolean): ReleaseInfo | null {
  if (!Array.isArray(raw)) return null;
  let best: { release: ReleaseInfo; version: ParsedVersion } | null = null;
  for (const item of raw as GithubRelease[]) {
    if (item === null || typeof item !== 'object') continue;
    if (item.draft === true || typeof item.tag_name !== 'string') continue;
    const version = parseVersion(item.tag_name);
    if (!version) continue;
    const prerelease = item.prerelease === true || version.pre.length > 0;
    if (prerelease && !includePrereleases) continue;
    const assets = Array.isArray(item.assets)
      ? (item.assets as { name?: unknown; browser_download_url?: unknown }[])
      : [];
    const installer = assets.find(
      (a) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.exe'),
    );
    const release: ReleaseInfo = {
      tag: item.tag_name,
      name: typeof item.name === 'string' && item.name !== '' ? item.name : item.tag_name,
      prerelease,
      url: typeof item.html_url === 'string' ? item.html_url : '',
      publishedAt: typeof item.published_at === 'string' ? item.published_at : null,
      installerUrl:
        typeof installer?.browser_download_url === 'string' ? installer.browser_download_url : null,
    };
    if (!best || compareVersions(version, best.version) > 0) best = { release, version };
  }
  return best?.release ?? null;
}

export type UpdateResult =
  | { kind: 'up-to-date'; current: string }
  | { kind: 'available'; current: string; release: ReleaseInfo }
  | {
      kind: 'unavailable';
      current: string;
      reason: 'private-or-missing' | 'rate-limited' | 'offline' | 'bad-answer' | 'bad-version';
    };

export interface CheckOptions {
  /** Version the app is running, such as `0.1.0-alpha.1`. */
  current: string;
  /** `owner/name` of the repository whose Releases are checked. */
  repo?: string;
  /** Optional GitHub token (read access) for a private repository. */
  token?: string;
  fetchFn?: typeof fetch;
}

/** Asks GitHub for the Releases and says whether a newer version exists. Never throws. */
export async function checkForUpdate(options: CheckOptions): Promise<UpdateResult> {
  const current = options.current;
  const running = parseVersion(current);
  if (!running) return { kind: 'unavailable', current, reason: 'bad-version' };
  const repo = options.repo?.trim() || DEFAULT_RELEASES_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
    return { kind: 'unavailable', current, reason: 'bad-answer' };
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (options.token?.trim()) headers.Authorization = `Bearer ${options.token.trim()}`;
  const fetchFn = options.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
      headers,
    });
  } catch {
    return { kind: 'unavailable', current, reason: 'offline' };
  }
  // A private repository answers 404 to an anonymous request, as if it did not exist.
  if (response.status === 404 || response.status === 401) {
    return { kind: 'unavailable', current, reason: 'private-or-missing' };
  }
  if (response.status === 403 || response.status === 429) {
    return { kind: 'unavailable', current, reason: 'rate-limited' };
  }
  if (!response.ok) return { kind: 'unavailable', current, reason: 'bad-answer' };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unavailable', current, reason: 'bad-answer' };
  }
  const release = newestRelease(body, running.pre.length > 0);
  const version = release ? parseVersion(release.tag) : null;
  if (release && version && compareVersions(version, running) > 0) {
    return { kind: 'available', current, release };
  }
  return { kind: 'up-to-date', current };
}
