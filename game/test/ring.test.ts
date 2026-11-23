import { describe, expect, it } from 'vitest';
import { RING_COUNT, RING_GAP_MS, RING_LIFE_MS, RING_TOTAL_MS, RING_TO, SQUASH, ringPixels, ringsAt } from '../src/ring';

describe('the sink ring timeline', () => {
  it('starts: one ring, small and strong, at the first instant', () => {
    const r = ringsAt(0);
    expect(r).toHaveLength(1);
    expect(r[0]!.rx).toBeLessThan(2);
    expect(r[0]!.alpha).toBeGreaterThan(0.8);
  });
  it('widens: the first ring is wider at every later instant and fades', () => {
    let rx = 0;
    let alpha = 1;
    for (let t = 0; t < RING_LIFE_MS; t += 40) {
      const r = ringsAt(t)[0]!;
      expect(r.rx).toBeGreaterThanOrEqual(rx);
      expect(r.alpha).toBeLessThanOrEqual(alpha);
      expect(r.ry).toBeCloseTo(r.rx * SQUASH);
      rx = r.rx;
      alpha = r.alpha;
    }
    expect(rx).toBeGreaterThan(RING_TO * 0.9);
  });
  it('follows itself: the rings join in turn, up to the count, a gap apart', () => {
    expect(ringsAt(RING_GAP_MS - 1)).toHaveLength(1);
    expect(ringsAt(RING_GAP_MS)).toHaveLength(2);
    expect(Math.max(...Array.from({ length: RING_TOTAL_MS }, (_, t) => ringsAt(t).length))).toBe(RING_COUNT);
  });
  it('is gone by its end', () => {
    expect(ringsAt(RING_TOTAL_MS)).toHaveLength(0);
    expect(ringsAt(RING_TOTAL_MS - 1).length).toBeGreaterThan(0);
    expect(ringsAt(-5)).toHaveLength(0);
  });
  it('draws on the pixel grid: whole pixels, each once, all on the ellipse\'s outline', () => {
    const px = ringPixels({ rx: 8, ry: 4 });
    expect(new Set(px.map((p) => p.join(','))).size).toBe(px.length);
    for (const [x, y] of px) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(Math.abs((x / 8) ** 2 + (y / 4) ** 2 - 1)).toBeLessThan(0.45);
    }
    expect(px.length).toBeGreaterThan(20);
  });
});
