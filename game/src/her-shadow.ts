/**
 * Her shadows by night on a painted land (13.11, round four, figure presence #16, order 4: "she casts a moving shadow from each light near her").
 *
 * By day she has the one sun's shadow, the land's own (cast.ts). By night every light whose pool reaches her casts one, away from the light, longer the farther she stands from it, and nearer than two of them
 * are dropped. The lantern she holds casts none: it hangs at her side and its shadow would lie behind her body (the same rule as `nightSun`, a light's own post casts nothing from it).
 *
 * A shadow is a share of the strongest one (`alpha`, 0 to 1): it fades from half the light's radius to the pool's edge, and is fainter where a second light also reaches her (the other light lights what
 * this one shades). The shares are realised as an ordered dither on the art pixel, never a gradient, and two shadows are composed by union: where they overlap the ground is no darker than under one
 * of them, so the pass takes a light's strength away and never doubles it. All numbers are whole steps (a sixteenth of a turn, a tenth of a height, a quarter of a share), so a walk reuses few shadows.
 */
import { type Shadow, type ShadowSpan, type Sun, shadowBox } from './cast';
import { bayerAt } from './standing';
import { PAINTED_LIGHTS, type PaintedLightKind, paintedPoolTexel } from './light';

/** A light as the pool reports it, in world px: where it stands, how far it reaches now, how strongly it burns, and whether she holds it. */
export interface HerLight {
  x: number;
  y: number;
  radius: number;
  strength: number;
  held?: boolean;
  /** which kind of light it is (PAINTED_LIGHTS): its colour is what its shadow takes away */
  kind?: PaintedLightKind;
}

/** One shadow of hers: the shear per art px of her height away from a light, and its share of the strongest shadow. */
export interface HerSun extends Sun {
  up: true;
  /** the light this lamp adds to the flat ground where she stands, per channel: its shadow takes it away (painted.ts turns it into a tint over the ground's flat light) */
  add: readonly [number, number, number];
}

export const HER_SHADOW = {
  /** at most this many lights cast: the nearest by how far their pool reaches her */
  lights: 2,
  /** the share of a pool's radius, from the light, inside which a shadow is whole; it fades to nothing at the edge */
  whole: 0.5,
  /** how much of a light's share a second light's reach takes away (1 = the other's reach, fully) */
  other: 0.5,
  /** a light closer than this (world px) is her own post: nothing casts from it */
  post: 4,
  /** shares come in this many steps */
  steps: 4,
  /** the shadow's length in heights: from at the light to the pool's edge */
  length: [0.3, 1.1],
  /** art px her footprint is deep, laid across every row of the shadow (cast.ts `Sun.thick`), so a light level with her casts a band this thick, not a ruled line. About as deep as her torso is wide (a round column, 10 to 12 art px): the shadow's
   * area then stays over 60% of its largest as the light goes round her (bar H1; at 6 it fell to 49%, at 8 to 59%) */
  depth: 10,
} as const;

/** The shadows she casts standing at (x, y) in world px among `lights`, nearest reach first; none when the night is not down. */
export function herSuns(x: number, y: number, lights: readonly HerLight[], night: number): HerSun[] {
  if (night <= 0) return [];
  const reach: { d: number; r: number; dx: number; dy: number; f: number; add: [number, number, number] }[] = [];
  for (const l of lights) {
    if (l.held || l.radius <= 0) continue;
    const dx = x - l.x;
    const dy = y - l.y;
    const d = Math.hypot(dx, dy);
    const r = l.radius / 4;   // the pool's radius is in art px, the world's in px
    if (d < HER_SHADOW.post || d >= r) continue;
    // the pool's own step where she stands (art px about the pool's centre): the share of the core's light the ground holds there
    const c = Math.round(l.radius);
    const level = paintedPoolTexel(Math.round(c + (dx * 4) - 0.5), Math.round(c + (dy * 4) - 0.5), c, l.radius);
    const lamp = PAINTED_LIGHTS[l.kind ?? 'lantern'].lamp;
    const add: [number, number, number] = [lamp[0]! * l.strength * level, lamp[1]! * l.strength * level, lamp[2]! * l.strength * level];
    reach.push({ d, r, dx, dy, f: Math.min(1, (1 - d / r) / (1 - HER_SHADOW.whole)) * Math.min(1, l.strength), add });
  }
  reach.sort((a, b) => b.f - a.f);
  const use = reach.slice(0, HER_SHADOW.lights);
  const out: HerSun[] = [];
  for (const [i, l] of use.entries()) {
    const other = use.length > 1 ? use[1 - i]!.f : 0;
    const share = l.f * (1 - HER_SHADOW.other * other);
    const alpha = Math.round(share * HER_SHADOW.steps) / HER_SHADOW.steps;
    if (alpha <= 0) continue;
    const [lo, hi] = HER_SHADOW.length;
    const length = Math.round(10 * (lo + (hi - lo) * (l.d / l.r))) / 10;
    // a sixteenth of a turn, like a light's own sun (poolSun)
    const turn = Math.round((Math.atan2(l.dy, l.dx) / (2 * Math.PI)) * 16) * ((2 * Math.PI) / 16);
    out.push({ up: true, sx: Math.round(Math.cos(turn) * length * 1000) / 1000, sy: Math.round(Math.sin(turn) * length * 1000) / 1000, length, alpha, thick: HER_SHADOW.depth, add: l.add });
  }
  return out;
}

/**
 * The shadows laid as one: a pixel is in it when it lies in a shadow whose share beats the art pixel's ordered-dither threshold, so a share of 1 is solid and a quarter is one pixel in four. `shadows` and
 * `alphas` go in the same order; the result has the first shadow's feet and contact line and is a `Shadow` like any other.
 */
export function composeShadows(shadows: readonly Shadow[], alphas: readonly number[]): Shadow {
  const first = shadows[0];
  if (!first) return { spans: [], minX: 0, maxX: -1, height: 0, contact: [], base: 0 };
  const boxes = shadows.map(shadowBox);
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const w = x1 - x0;
  const h = y1 - y0;
  const on = new Uint8Array(w * h);
  shadows.forEach((s, i) => {
    const a = alphas[i] ?? 1;
    for (const span of s.spans) {
      for (let x = span.x; x < span.x + span.w; x++) {
        if (a > bayerAt(x & 3, span.y & 3) || a >= 1) on[(span.y - y0) * w + (x - x0)] = 1;
      }
    }
  });
  const spans: ShadowSpan[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let height = 0;
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!on[y * w + x]) {
        x++;
        continue;
      }
      const a = x;
      while (x < w && on[y * w + x]) x++;
      spans.push({ x: a + x0, y: y + y0, w: x - a });
      minX = Math.min(minX, a + x0);
      maxX = Math.max(maxX, x - 1 + x0);
      height = Math.max(height, y + y0 + 1);
    }
  }
  return { spans, minX: spans.length ? minX : 0, maxX, height, contact: first.contact, base: first.base };
}
