/**
 * Seeded pseudo-random number generator (xoshiro128**).
 * This is the ONLY source of randomness allowed in the core. `Math.random` is
 * forbidden here (enforced by ESLint and by a test).
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (both inclusive). */
  int(min: number, max: number): number;
  /** Normally distributed value. */
  normal(mean: number, stdDev: number): number;
  /** True with the given probability. */
  chance(probability: number): boolean;
  /** Uniformly picks one element. */
  pick<T>(items: readonly T[]): T;
  /** Returns a shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
}

/** Hashes a string into four 32-bit words (cyrb128). */
function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  return [h1 >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/**
 * Creates an independent generator from a string seed. Use distinct seed strings
 * (e.g. `${universeSeed}/match/${matchId}`) to get independent streams, so that
 * results do not depend on the order in which things are simulated.
 */
export function createRng(seed: string): Rng {
  let [a, b, c, d] = hashSeed(seed);
  if ((a | b | c | d) === 0) a = 1; // the all-zero state is invalid for xoshiro

  const nextU32 = (): number => {
    const r = Math.imul(b, 5);
    const result = Math.imul((r << 7) | (r >>> 25), 9) >>> 0;
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return result;
  };

  const next = (): number => nextU32() / 4294967296;

  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    normal(mean, stdDev) {
      // Box–Muller. `1 - next()` avoids log(0).
      const u = 1 - next();
      const v = next();
      return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    chance(probability) {
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Rng.pick: empty list');
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
  };
}
