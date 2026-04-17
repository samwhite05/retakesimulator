/**
 * Seeded PRNG used by the simulation. Using mulberry32 for speed and a tiny
 * state footprint — the whole RNG serializes to one integer. Determinism is
 * important because an interactive run persists `SimState` server-side
 * between decisions and later validates the final score by re-running the
 * same seed + decisions.
 */

export interface Rng {
  next(): number;
  nextInt(maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  /** Export the current internal state so it can be persisted + restored. */
  export(): number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RngImpl implements Rng {
  private state: number;
  private gen: () => number;
  constructor(seed: number) {
    this.state = seed >>> 0;
    this.gen = mulberry32(this.state);
  }
  next(): number {
    const v = this.gen();
    // Advance exported state as well. `mulberry32` increments internally on
    // each call, but the factory keeps the original seed; we re-synthesize
    // an exportable state by stepping a parallel counter.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    return v;
  }
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  export(): number {
    return this.state >>> 0;
  }
}

export function createRng(seed: number): Rng {
  return new RngImpl(seed);
}

/** Reconstruct an RNG from an exported state integer. */
export function restoreRng(state: number): Rng {
  return new RngImpl(state);
}

/**
 * Cheap string-hash used to derive a stable integer seed from a plan id or
 * scenario identifier. Not cryptographic; good enough to spread seeds.
 */
export function stringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
