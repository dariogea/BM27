#!/usr/bin/env node
/**
 * Release policy: decides whether the Windows workflow may build/publish a tag.
 *
 * Pure function `checkRelease` (tested in tools/ci/test/release-check.test.ts) plus a small CLI used
 * by .github/workflows/release.yml. The rules exist so that a Release tag always corresponds to the
 * exact commit that was compiled (Issue #39):
 *
 *  - The tag must look like vX.Y.Z or vX.Y.Z-prerelease.
 *  - The versions in apps/desktop/package.json and tauri.conf.json must equal the tag version.
 *  - If the tag already exists, it must point to the commit being compiled (never silently
 *    publish different code under an old tag).
 *  - If the tag does not exist yet, it may only be created from `main`.
 *  - A Release that already exists is never replaced.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TAG_PATTERN = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/**
 * @param {{
 *   tag: string,
 *   headSha: string,
 *   tagSha: string | null,        // commit the tag points to, null if the tag does not exist
 *   ref: string,                  // github.ref of the run (refs/heads/main, refs/tags/v…)
 *   packageVersion: string,
 *   tauriVersion: string,
 *   releaseExists: boolean,
 * }} input
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function checkRelease(input) {
  const { tag, headSha, tagSha, ref, packageVersion, tauriVersion, releaseExists } = input;
  if (!TAG_PATTERN.test(tag)) {
    return fail('bad-tag', `La etiqueta «${tag}» no tiene el formato vX.Y.Z o vX.Y.Z-alpha.N.`);
  }
  const version = tag.slice(1);
  if (version !== packageVersion || version !== tauriVersion) {
    return fail(
      'version-mismatch',
      `La versión de la etiqueta (${version}) no coincide con apps/desktop/package.json (${packageVersion}) y tauri.conf.json (${tauriVersion}).`,
    );
  }
  if (tagSha !== null && tagSha !== headSha) {
    return fail(
      'tag-other-commit',
      `La etiqueta ${tag} apunta a ${tagSha.slice(0, 7)} pero se está compilando ${headSha.slice(0, 7)}. No se publica código distinto bajo una etiqueta existente.`,
    );
  }
  if (tagSha === null && ref !== 'refs/heads/main') {
    return fail(
      'new-tag-off-main',
      `La etiqueta ${tag} no existe y solo se puede crear desde main (se ejecutó desde ${ref}).`,
    );
  }
  if (releaseExists) {
    return fail(
      'release-exists',
      `Ya existe una Release ${tag}; no se reemplaza. Bórrala a mano si de verdad quieres republicarla.`,
    );
  }
  return { ok: true };
}

function fail(code, message) {
  return { ok: false, code, message };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function tagCommit(tag) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function releaseExists(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const readVersion = (file) => JSON.parse(readFileSync(file, 'utf8')).version;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tag = process.env.TAG ?? '';
  if (tag === '') {
    console.log('Sin etiqueta: solo se compila, no se publica.');
    process.exit(0);
  }
  const result = checkRelease({
    tag,
    headSha: git('rev-parse', 'HEAD'),
    tagSha: tagCommit(tag),
    ref: process.env.GITHUB_REF ?? '',
    packageVersion: readVersion('apps/desktop/package.json'),
    tauriVersion: readVersion('apps/desktop/src-tauri/tauri.conf.json'),
    releaseExists: releaseExists(tag),
  });
  if (!result.ok) {
    console.error(`::error::${result.message}`);
    process.exit(1);
  }
  console.log(`Etiqueta ${tag} válida para el commit ${git('rev-parse', '--short', 'HEAD')}.`);
}
