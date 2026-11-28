import { describe, expect, it } from 'vitest';
import { HER_SHADOW, composeShadows, herSuns } from '../src/her-shadow';
import { type Mask, maskOfAlpha, shadowOf } from '../src/cast';

const torch = (x: number, y: number, extra = {}) => ({ x, y, radius: 128, strength: 1, ...extra });

describe('her shadows by night', () => {
  it('casts away from a light within 15 degrees at eight places round it', () => {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const [sun] = herSuns(100 + 20 * Math.cos(a), 100 + 20 * Math.sin(a), [torch(100, 100)], 1);
      expect(sun).toBeDefined();
      const err = Math.abs((((Math.atan2(sun!.sy, sun!.sx) - a) * 180) / Math.PI + 540) % 360 - 180);
      expect(err).toBeLessThanOrEqual(15);
    }
  });
  it('is longer the farther she stands, and none outside the pool or at the light itself', () => {
    const lens = [6, 10, 14, 18, 22, 26, 30].map((d) => herSuns(100 + d, 100, [torch(100, 100)], 1)[0]?.length ?? 0);
    for (let i = 1; i < lens.length; i++) expect(lens[i]!).toBeGreaterThanOrEqual(lens[i - 1]!);
    expect(lens[6]!).toBeGreaterThan(lens[0]!);
    expect(herSuns(100 + 33, 100, [torch(100, 100)], 1)).toEqual([]);
    expect(herSuns(101, 100, [torch(100, 100)], 1)).toEqual([]);
  });
  it('the light she holds casts nothing, and nothing casts by day', () => {
    expect(herSuns(110, 100, [torch(100, 100, { held: true })], 1)).toEqual([]);
    expect(herSuns(110, 100, [torch(100, 100)], 0)).toEqual([]);
  });
  it('two lights cast two shadows, each fainter than it is alone, and no more than two', () => {
    const alone = herSuns(110, 100, [torch(100, 100)], 1)[0]!;
    const two = herSuns(110, 100, [torch(100, 100), torch(120, 100), torch(110, 90)], 1);
    expect(two.length).toBe(HER_SHADOW.lights);
    for (const s of two) expect(s.alpha).toBeLessThanOrEqual(alone.alpha);
  });
  it('composes shadows by union: the overlap is no darker than one, and a whole share is solid', () => {
    const alpha = new Uint8Array(4 * 6).fill(1);
    const mask: Mask = maskOfAlpha(alpha, 4, 6);
    const a = shadowOf(mask, { up: true, sx: 1, sy: 0.3, length: 1, alpha: 1 });
    const b = shadowOf(mask, { up: true, sx: -1, sy: 0.3, length: 1, alpha: 1 });
    const both = composeShadows([a, b], [1, 1]);
    const px = (s: typeof a) => s.spans.reduce((n, sp) => n + sp.w, 0);
    expect(px(both)).toBeGreaterThanOrEqual(Math.max(px(a), px(b)));
    expect(px(both)).toBeLessThanOrEqual(px(a) + px(b));
    const half = composeShadows([a], [0.5]);
    expect(px(half)).toBeLessThan(px(a));
    expect(px(half)).toBeGreaterThan(0);
  });

  // round 5, R2: a light level with her gave a ruled line (every row of the body on one ground row); the footprint's depth keeps it a shadow at every angle
  // her silhouette as the game cuts it: a head 8 wide, a torso 12 wide, legs 9 wide, 51 art px tall
  const figure = (): Mask => {
    const w = 16;
    const a = new Uint8Array(w * 51);
    for (let y = 0; y < 51; y++) {
      const half = y < 11 ? 4 : y < 31 ? 6 : 4.5;
      for (let x = 0; x < w; x++) if (Math.abs(x + 0.5 - w / 2) <= half) a[y * w + x] = 1;
    }
    return maskOfAlpha(a, w, 51);
  };
  const px = (sh: ReturnType<typeof shadowOf>) => {
    const set = new Set<string>();
    for (const sp of sh.spans) for (let x = sp.x; x < sp.x + sp.w; x++) set.add(`${x},${sp.y}`);
    return set;
  };
  it('a light level with her casts a band of her footprint depth, not a ruled line', () => {
    const mask = figure();
    const [level] = herSuns(120, 100, [torch(100, 100)], 1);
    expect(level!.sy).toBe(0);
    const rows = (sh: ReturnType<typeof shadowOf>) => new Set(sh.spans.map((sp) => sp.y)).size;
    expect(rows(shadowOf(mask, { ...level!, thick: 0 }))).toBe(1);
    expect(rows(shadowOf(mask, level!))).toBe(HER_SHADOW.depth);
  });
  it('the shadow keeps its body as the light goes round her: area never under 60% of the largest, thin side at least two art px', () => {
    const mask = figure();
    const areas: number[] = [];
    for (let k = 0; k < 24; k++) {
      const a = (k * Math.PI) / 12;
      const [sun] = herSuns(100 + 20 * Math.cos(a), 100 + 20 * Math.sin(a), [torch(100, 100)], 1);
      const cells = [...px(shadowOf(mask, sun!))].map((c) => c.split(',').map(Number) as [number, number]);
      areas.push(cells.length);
      // the thin side: along the axis the shadow runs on, the fewest cells in any line of the middle half
      const alongX = Math.abs(sun!.sx) >= Math.abs(sun!.sy);
      const key = (c: [number, number]) => (alongX ? c[0] : c[1]);
      const lo = Math.min(...cells.map(key));
      const hi = Math.max(...cells.map(key));
      const count = new Map<number, number>();
      for (const c of cells) count.set(key(c), (count.get(key(c)) ?? 0) + 1);
      for (let v = Math.ceil(lo + 0.25 * (hi - lo)); v <= Math.floor(lo + 0.75 * (hi - lo)); v++) expect(count.get(v) ?? 0).toBeGreaterThanOrEqual(2);
    }
    expect(Math.min(...areas)).toBeGreaterThanOrEqual(0.6 * Math.max(...areas));
  });
  it('the day sun carries no footprint depth: its shadow is unchanged', () => {
    const mask: Mask = maskOfAlpha(new Uint8Array(10 * 51).fill(1), 10, 51);
    const sun = { up: true, sx: 0.8, sy: -0.2, length: 1, alpha: 0.3 };
    expect(shadowOf(mask, sun).spans).toEqual(shadowOf(mask, { ...sun, thick: 0 }).spans);
  });
});
