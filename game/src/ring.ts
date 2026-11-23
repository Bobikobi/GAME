/**
 * The sink ring: where a stone goes under water, rings spread on the surface and fade (#793). Pure timeline, drawn by the scene
 * with code (world.ts `splashAt`). The sizes are art pixels (one art pixel = one world pixel); the surface is seen from the
 * game's slant, so a ring is an ellipse as tall as `SQUASH` of its width.
 */

/** One ring as it shows at an instant. */
export interface RingShape {
  /** Half the ring's width, art px. */
  rx: number;
  /** Half the ring's height, art px. */
  ry: number;
  /** 0 to 1. */
  alpha: number;
}

/** How many rings follow each other. */
export const RING_COUNT = 3;
/** Delay between one ring starting and the next, ms. */
export const RING_GAP_MS = 120;
/** How long one ring lives, ms. */
export const RING_LIFE_MS = 480;
/** A ring's half-width at its start and at its end, art px. */
export const RING_FROM = 1.5;
export const RING_TO = 11;
/** The ellipse's height against its width. */
export const SQUASH = 0.5;
/** The strongest a ring shows. */
export const RING_ALPHA = 0.9;

/** Total time of the effect, ms: the last ring's start and its life. */
export const RING_TOTAL_MS = RING_GAP_MS * (RING_COUNT - 1) + RING_LIFE_MS;

/** The rings that show `t` ms after the stone went under: none before it starts or after it is over; each one wider and fainter than the one before it was at the same age. */
export function ringsAt(t: number): RingShape[] {
  const out: RingShape[] = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const age = t - i * RING_GAP_MS;
    if (age < 0 || age >= RING_LIFE_MS) continue;
    const k = age / RING_LIFE_MS;
    const ease = 1 - (1 - k) * (1 - k); // fast at first, slowing as it spreads
    const rx = RING_FROM + (RING_TO - RING_FROM) * ease;
    out.push({ rx, ry: rx * SQUASH, alpha: RING_ALPHA * (1 - k) * (1 - 0.25 * i) });
  }
  return out;
}

/** The art pixels of a ring's outline, relative to its middle, each once: the ring is drawn on the game's pixel grid like the rest of the world. */
export function ringPixels(shape: Pick<RingShape, 'rx' | 'ry'>): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const steps = Math.max(16, Math.ceil(shape.rx * 8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * shape.rx);
    const y = Math.round(Math.sin(a) * shape.ry);
    const k = `${x},${y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([x, y]);
    }
  }
  return out;
}
