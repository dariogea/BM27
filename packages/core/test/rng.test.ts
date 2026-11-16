import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRng, sha256Hex } from '../src/index';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('seeded RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-2');
    const same = Array.from({ length: 50 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBeLessThan(5);
  });

  it('stays in range and is roughly uniform', () => {
    const rng = createRng('uniform');
    let sum = 0;
    let min = 1;
    let max = 0;
    for (let i = 0; i < 100_000; i++) {
      const v = rng.next();
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    expect(sum / 100_000).toBeGreaterThan(0.49);
    expect(sum / 100_000).toBeLessThan(0.51);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });
});

describe('sha256', () => {
  it('matches known test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    // Non-ASCII text exercises the UTF-8 encoder.
    expect(sha256Hex('ñ')).toBe('024bb90888ca89a15a19e9bdd8c712bfb070465fce1ef25e43c170ea44fc5e5f');
  });
});

describe('core purity rules', () => {
  const coreSrc = join(__dirname, '..', 'src');
  const files = sourceFiles(coreSrc);

  it('never uses Math.random', () => {
    const offenders = files.filter((f) =>
      /Math\s*\.\s*random/.test(stripComments(readFileSync(f, 'utf8'))),
    );
    expect(offenders).toEqual([]);
  });

  it('never imports UI, DOM or Node-only modules', () => {
    const forbidden = /from\s+['"](react|react-dom|vite|node:[^'"]+|fs|path|crypto)[^'"]*['"]/;
    const globals = /\b(window|document|navigator|localStorage|HTMLElement)\s*[.[(]/;
    const offenders = files.filter((f) => {
      const text = stripComments(readFileSync(f, 'utf8'));
      return forbidden.test(text) || globals.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
