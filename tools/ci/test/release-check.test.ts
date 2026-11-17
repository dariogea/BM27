import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs module without types
import { checkRelease } from '../release-check.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

const base = {
  tag: 'v0.1.0-alpha.1',
  headSha: A,
  tagSha: null as string | null,
  ref: 'refs/heads/main',
  packageVersion: '0.1.0-alpha.1',
  tauriVersion: '0.1.0-alpha.1',
  releaseExists: false,
};

describe('checkRelease', () => {
  it('acepta crear una etiqueta nueva desde main con versiones coincidentes', () => {
    expect(checkRelease(base)).toEqual({ ok: true });
  });

  it('acepta una etiqueta existente que apunta al commit compilado (subida de etiqueta)', () => {
    expect(checkRelease({ ...base, tagSha: A, ref: 'refs/tags/v0.1.0-alpha.1' })).toEqual({
      ok: true,
    });
  });

  it('rechaza una etiqueta existente que apunta a otro commit (caso del Issue #39)', () => {
    const r = checkRelease({
      ...base,
      tag: 'v0.1.0',
      packageVersion: '0.1.0',
      tauriVersion: '0.1.0',
      tagSha: B,
    });
    expect(r).toMatchObject({ ok: false, code: 'tag-other-commit' });
  });

  it('las versiones de texto iguales no bastan si el commit es otro', () => {
    const r = checkRelease({ ...base, tagSha: B });
    expect(r.ok).toBe(false);
  });

  it('rechaza si las versiones no coinciden con la etiqueta', () => {
    expect(checkRelease({ ...base, packageVersion: '0.1.0' })).toMatchObject({
      code: 'version-mismatch',
    });
    expect(checkRelease({ ...base, tauriVersion: '0.2.0' })).toMatchObject({
      code: 'version-mismatch',
    });
  });

  it('rechaza etiquetas con formato raro', () => {
    for (const tag of ['0.1.0', 'v1', 'v1.2', 'vx.y.z', 'v1.2.3 ', 'v1.2.3/../x']) {
      expect(checkRelease({ ...base, tag })).toMatchObject({ ok: false, code: 'bad-tag' });
    }
  });

  it('una etiqueta nueva solo se crea desde main', () => {
    expect(checkRelease({ ...base, ref: 'refs/heads/otra-rama' })).toMatchObject({
      code: 'new-tag-off-main',
    });
  });

  it('no reemplaza una Release que ya existe', () => {
    expect(checkRelease({ ...base, releaseExists: true })).toMatchObject({
      code: 'release-exists',
    });
  });
});
