/**
 * A living fire (GRUNT CR-110): how a burning fire moves, so two fires never move alike. Each fire draws from its
 * own seed (its id): where its flame's frames start, the order they step in, each frame's time, and a flicker, a
 * value that wanders between -1 and 1 and takes a new aim every `step_min_ms` to `step_max_ms`, eased between aims.
 * The flicker moves the light's strength and its pool's radius inside a small band around the lighting ladder's
 * value, and the crackle's level with it, so a muted player sees what the others hear (G24, G27).
 * Display only: the kernel decides every burn, and nothing here reads back into it. Pure: no scene, no audio.
 */
import type { Flicker as Numbers } from '@game/kernel';

/** A seed from a fire's id (FNV-1a), so the same fire moves the same way every time it is drawn. */
export function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32): 0 to 1, the same run for the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The orders a flame's frames may step in, for a sheet of `frames`: forward, and backward. A fire takes one by its
 * seed. More orders (or more drawn sheets beside the kit's campfire) join this list without touching a fire.
 */
export function frameOrders(frames: number): number[][] {
  const forward = Array.from({ length: frames }, (_, i) => i);
  if (frames < 3) return [forward];
  return [forward, [0, ...forward.slice(1).reverse()]];
}

/**
 * A flame's frames on the fire's own clock: a first step after a drawn share of `start_spread_ms`, then each frame
 * `base` ms give or take `frame_jitter_pct`, in the order its seed picked. `frame(now)` only moves forward; a
 * clock asked about an earlier time starts again.
 */
export class FlameClock {
  private rng: () => number;
  private readonly order: number[];
  private at = 0;
  private next = 0;
  private started: number | undefined;

  constructor(
    private readonly seed: number,
    frames: number,
    private readonly t: Numbers,
    private readonly base: number,
  ) {
    this.rng = seeded(seed);
    const orders = frameOrders(Math.max(1, frames));
    this.order = orders[Math.floor(this.rng() * orders.length)] ?? orders[0]!;
    this.at = Math.floor(this.rng() * this.order.length);
  }

  /** The sheet's frame to show at `now` (wall clock ms). */
  frame(now: number): number {
    if (this.started === undefined || now < this.started) {
      this.rng = seeded(this.seed);
      this.rng();
      this.at = Math.floor(this.rng() * this.order.length);
      this.started = now;
      this.next = now + this.rng() * this.t.start_spread_ms;
    }
    while (now >= this.next) {
      this.at = (this.at + 1) % this.order.length;
      this.next += this.base * (1 + (this.t.frame_jitter_pct / 100) * (2 * this.rng() - 1));
    }
    return this.order[this.at] ?? 0;
  }
}

/** How a fire's light and crackle sit now: each a factor around 1 (the ladder's value), inside the band. */
export interface Breath {
  /** the wander itself, -1 to 1 */
  value: number;
  /** the light's strength and the crackle's level: 1 plus or minus `band_pct` */
  gain: number;
  /** the pool's radius: 1 plus or minus half of `band_pct` */
  radius: number;
}

/**
 * A fire's flicker: a new aim between -1 and 1 every `step_min_ms` to `step_max_ms`, drawn from the fire's seed, and
 * an eased glide from one aim to the next, so the light breathes and never jumps. `at(now)` only moves forward; a
 * flicker asked about an earlier time starts again.
 */
export class FireFlicker {
  private rng: () => number;
  private from = 0;
  private to = 0;
  private since = 0;
  private until = 0;
  private started: number | undefined;

  constructor(
    private readonly seed: number,
    private readonly t: Numbers,
  ) {
    this.rng = seeded(seed ^ 0x9e3779b9);
  }

  at(now: number): Breath {
    if (this.started === undefined || now < this.started) {
      this.rng = seeded(this.seed ^ 0x9e3779b9);
      this.started = now;
      this.from = 2 * this.rng() - 1;
      this.to = 2 * this.rng() - 1;
      this.since = now;
      this.until = now + this.gap();
    }
    while (now >= this.until) {
      this.from = this.to;
      this.to = 2 * this.rng() - 1;
      this.since = this.until;
      this.until += this.gap();
    }
    const u = (now - this.since) / (this.until - this.since);
    const value = this.from + (this.to - this.from) * ((1 - Math.cos(Math.PI * u)) / 2);
    return breathOf(this.t, value);
  }

  private gap(): number {
    const lo = Math.min(this.t.step_min_ms, this.t.step_max_ms);
    const hi = Math.max(this.t.step_min_ms, this.t.step_max_ms);
    return lo + this.rng() * (hi - lo);
  }
}

/** The light's and the crackle's factors for a wander `value` (-1 to 1), inside the band. */
export function breathOf(t: Numbers, value: number): Breath {
  const v = Math.max(-1, Math.min(1, value));
  const band = t.band_pct / 100;
  return { value: v, gain: 1 + band * v, radius: 1 + (band / 2) * v };
}

/** The wait before a fire's next popped spark, in ms, between the two bounds, from the fire's own draws. */
export function sparkGap(t: Numbers, rng: () => number): number {
  const lo = Math.min(t.spark_gap_min_s, t.spark_gap_max_s) * 1000;
  const hi = Math.max(t.spark_gap_min_s, t.spark_gap_max_s) * 1000;
  return lo + rng() * (hi - lo);
}

/** Ms between embers for a fire at a share of its full burn (1 full, less as it settles): never faster than `ember_per_s`. */
export function emberEvery(t: Numbers, share: number): number {
  const rate = t.ember_per_s * Math.max(0.1, Math.min(1, share));
  return Math.round(1000 / rate);
}
