/**
 * A supersampled render to a sprite: every sub-pixel takes the nearest colour (CIELAB) of the ramps its class may
 * use, each ss x ss block becomes one pixel by majority and is opaque when at least half of it is, and a 1 px outline
 * is drawn outside the silhouette (4-neighbours). The class comes from the renderer's flat ID pass: blue body, red
 * flame (the fire ramp only), green tool metal (the metal ramp only). No blended colour exists in the output.
 */
import { coreRamp, hexToRgb } from '../kit/palette.js';

/** RGBA rows, as pngjs reads them. */
export interface Picture {
  width: number;
  height: number;
  data: Uint8Array;
}

export type SnapClass = 'body' | 'fire' | 'metal';

export function rampColours(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const ramp = coreRamp(id);
    if (ramp === undefined) throw new Error(`"${id}" is not a shared ramp`);
    for (const step of ramp.steps) if (!out.includes(step)) out.push(step);
  }
  return out;
}

/** The colours each class may use: the body ramps, the fire ramp, the metal ramp. */
export function classPalettes(body: readonly string[], metal: string): Record<SnapClass, string[]> {
  return { body: rampColours(body), fire: rampColours(['fire']), metal: rampColours([metal]) };
}

export function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function classAt(ids: Picture | undefined, i: number): SnapClass {
  if (ids === undefined) return 'body';
  const r = ids.data[i] ?? 0;
  const g = ids.data[i + 1] ?? 0;
  const a = ids.data[i + 3] ?? 0;
  if (a === 0) return 'body';
  if (r > 128 && g < 128) return 'fire';
  if (g > 128 && r < 128) return 'metal';
  return 'body';
}

export function snap(hi: Picture, ids: Picture | undefined, ss: number, palettes: Record<SnapClass, string[]>, outline: string): Picture {
  if (hi.width % ss !== 0 || hi.height % ss !== 0) throw new Error(`a ${hi.width}x${hi.height} render is not a multiple of ${ss}`);
  if (ids !== undefined && (ids.width !== hi.width || ids.height !== hi.height)) throw new Error('the ID pass is not the size of the render');
  const order: string[] = [];
  for (const cls of ['body', 'fire', 'metal'] as const) for (const hex of palettes[cls]) if (!order.includes(hex)) order.push(hex);
  const labs = Object.fromEntries((['body', 'fire', 'metal'] as const).map((c) => [c, palettes[c].map((h) => lab(...hexToRgb(h)))])) as Record<SnapClass, [number, number, number][]>;
  const cache = new Map<string, string>();
  const nearest = (cls: SnapClass, r: number, g: number, b: number): string => {
    const key = `${cls}${(r << 16) | (g << 8) | b}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const [L, A, B] = lab(r, g, b);
    let best = 0;
    let bestD = Infinity;
    labs[cls].forEach(([l2, a2, b2], k) => {
      const d = (L - l2) ** 2 + (A - a2) ** 2 + (B - b2) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    const hex = palettes[cls][best] ?? '#000000';
    cache.set(key, hex);
    return hex;
  };
  const W = hi.width / ss;
  const H = hi.height / ss;
  const out: Picture = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  const solid = new Uint8Array(W * H);
  for (let by = 0; by < H; by += 1) {
    for (let bx = 0; bx < W; bx += 1) {
      const counts = new Map<string, number>();
      let clear = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const i = ((by * ss + sy) * hi.width + bx * ss + sx) * 4;
          if ((hi.data[i + 3] ?? 0) < 128) {
            clear += 1;
            continue;
          }
          const hex = nearest(classAt(ids, i), hi.data[i] ?? 0, hi.data[i + 1] ?? 0, hi.data[i + 2] ?? 0);
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
      }
      if ((ss * ss - clear) * 2 < ss * ss) continue;
      let pick = '';
      let most = -1;
      for (const hex of order) {
        const n = counts.get(hex) ?? 0;
        if (n > most) {
          most = n;
          pick = hex;
        }
      }
      const [r, g, b] = hexToRgb(pick);
      out.data.set([r, g, b, 255], (by * W + bx) * 4);
      solid[by * W + bx] = 1;
    }
  }
  const [or, og, ob] = hexToRgb(outline);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (solid[y * W + x]) continue;
      const near = (x > 0 && solid[y * W + x - 1]) || (x < W - 1 && solid[y * W + x + 1]) || (y > 0 && solid[(y - 1) * W + x]) || (y < H - 1 && solid[(y + 1) * W + x]);
      if (near) out.data.set([or, og, ob, 255], (y * W + x) * 4);
    }
  }
  return out;
}

/** Mirrored left to right (the left view is rendered facing right, and the right view is the left one mirrored). */
export function flipX(p: Picture): Picture {
  const out: Picture = { width: p.width, height: p.height, data: new Uint8Array(p.data.length) };
  for (let y = 0; y < p.height; y += 1) {
    for (let x = 0; x < p.width; x += 1) {
      const from = (y * p.width + x) * 4;
      out.data.set(p.data.subarray(from, from + 4), (y * p.width + (p.width - 1 - x)) * 4);
    }
  }
  return out;
}

export const hexOf = (p: Picture, i: number): string =>
  `#${[p.data[i] ?? 0, p.data[i + 1] ?? 0, p.data[i + 2] ?? 0].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
