/**
 * Where the line, the float and the fish are at each moment of a cast (DECISIONS.md, 2026-10-25: fishing).
 * The work loop owns the states (cast, wait, reel); this file turns a state and the time
 * spent in it into points, so the drawing stays dumb and the motion can be tested without a scene. All of it
 * is drawn in code: no sprite sheets.
 */
/** The stages of a cast the line and the float are drawn in: out, riding, drawn in. There is no bite to catch: the catch is the end of the unit. */
export type FishPhase = 'cast' | 'wait' | 'reel';

/** The cast goes out over this long. */
export const FISH_CAST_MS = 650;

export interface Pt {
  x: number;
  y: number;
}

/** The float comes back to the rod in this long once the fish is hooked. */
export const FISH_REEL_MS = 700;
/** How high the float flies over the middle of its cast, in px. */
const CAST_ARC = 18;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

export interface FloatPose extends Pt {
  /** 0 riding on the surface, 1 pulled under */
  dip: number;
}

/** The float: out along an arc, bobbing while it waits, back to the rod on the reel. */
export function floatAt(phase: FishPhase, ms: number, rod: Pt, spot: Pt): FloatPose {
  const bob = Math.sin(ms / 260) * 0.8;
  switch (phase) {
    case 'cast': {
      const k = clamp01(ms / FISH_CAST_MS);
      const e = 1 - (1 - k) * (1 - k);
      return { x: lerp(rod.x, spot.x, e), y: lerp(rod.y, spot.y, e) - CAST_ARC * Math.sin(Math.PI * k), dip: 0 };
    }
    case 'reel': {
      const k = clamp01(ms / FISH_REEL_MS);
      return { x: lerp(spot.x, rod.x, k * k), y: lerp(spot.y + 2.5, rod.y, k * k), dip: 1 - k };
    }
    case 'wait':
      return { x: spot.x, y: spot.y + bob, dip: 0 };
  }
}

/**
 * How far the middle of the line hangs below the straight run, in px. It pays out loose on the cast, springs
 * and settles once the float lands, and goes taut on the reel.
 */
export function sagAt(phase: FishPhase, ms: number): number {
  switch (phase) {
    case 'cast':
      return 4 + 6 * Math.sin(Math.PI * clamp01(ms / FISH_CAST_MS));
    case 'wait':
      return 5 + 5 * Math.exp(-ms / 300) * Math.cos(ms / 55);
    case 'reel':
      return 0.4 * Math.sin(ms / 20);
  }
}

/** The line as points: a quadratic curve from the rod tip to the float, its middle pulled down by the sag. */
export function linePoints(from: Pt, to: Pt, sag: number, n = 12): Pt[] {
  const c = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + 2 * sag };
  const out: Pt[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: u * u * from.x + 2 * u * t * c.x + t * t * to.x, y: u * u * from.y + 2 * u * t * c.y + t * t * to.y });
  }
  return out;
}

export interface Silhouette extends Pt {
  /** the way the fish faces, in radians */
  heading: number;
}

/**
 * The dark shapes under a fishing spot: `count` fish circling slowly, each on its own loop. Once a fish has the
 * hook it leaves the loop and holds under the float.
 */
export function silhouettes(time: number, spot: Pt, count: number, seed: number, hooked?: Pt): Silhouette[] {
  const out: Silhouette[] = [];
  for (let i = 0; i < count; i += 1) {
    const dir = (seed + i) % 2 === 0 ? 1 : -1;
    const a = dir * (time / (1700 + 300 * i)) + seed * 1.3 + i * 2.1;
    const r = 4 + 2 * i;
    const p = { x: spot.x + Math.cos(a) * r, y: spot.y + Math.sin(a) * r * 0.45 };
    const heading = Math.atan2(Math.cos(a) * 0.45 * dir, -Math.sin(a) * dir);
    if (i === 0 && hooked) out.push({ x: hooked.x, y: hooked.y + 2, heading: Math.PI / 2 });
    else out.push({ ...p, heading });
  }
  return out;
}
