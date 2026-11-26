// Deterministic randomness (GDD §12: "the same seed always gives the same result").
// Every random draw comes from a stream keyed by (seed, turn, purpose), so replaying a turn
// with one decision changed (counterfactual replay, §9) keeps all unrelated draws identical.

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  range(lo: number, hi: number): number;
  int(lo: number, hiInclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined;
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items, weight) => {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) return undefined;
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weight(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

export function streamRng(seed: number, turn: number, purpose: string): Rng {
  return makeRng(hashString(`${seed}|${turn}|${purpose}`));
}
