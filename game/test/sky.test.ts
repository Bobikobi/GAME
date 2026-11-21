import { describe, expect, it } from 'vitest';
import { AIR_DENSITY, BANK_ALPHA, BANK_RGB, BANK_TILE, CLOUD_ALPHA, CLOUD_BUCKETS, CLOUD_TILE, bankPixels, cloudBucket, cloudCover, cloudDrift, cloudField, cloudOffset, cloudPixels, fogStrength } from '../src/sky';

/** The alpha and colour of one pixel of an RGBA buffer. */
function at(buf: Uint8ClampedArray, w: number, x: number, y: number): [number, number, number, number] {
  const i = 4 * (y * w + x);
  return [buf[i]!, buf[i + 1]!, buf[i + 2]!, buf[i + 3]!];
}

describe('the cloud shade', () => {
  it('wraps: the field is the same at the left edge as at the right', () => {
    for (const y of [0, 31, 64, 127]) expect(cloudField(0, y)).toBeCloseTo(cloudField(CLOUD_TILE, y), 6);
    for (const x of [0, 17, 64, 127]) expect(cloudField(x, 0)).toBeCloseTo(cloudField(x, CLOUD_TILE), 6);
  });

  it('is ink at 34 percent inside a cloud with a thin rim, never above its own alpha', () => {
    const side = CLOUD_TILE * AIR_DENSITY;
    const px = cloudPixels();
    expect(px.length).toBe(side * side * 4);
    expect(CLOUD_ALPHA).toBe(Math.round(0.34 * 255));
    let covered = 0;
    let soft = 0;
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const [r, g, b, a] = at(px, side, x, y);
        expect(a).toBeLessThanOrEqual(CLOUD_ALPHA);
        if (a === 0) continue;
        covered++;
        if (a < CLOUD_ALPHA) soft++;
        expect([r, g, b]).toEqual([0x17, 0x2a, 0x52]);
      }
    }
    // a cloud covers a share of the patch, not all of it and not none, and its edge is a ramp rather than a cut
    const share = covered / (side * side);
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.6);
    // the rim is thin: a shade has an edge, so only a little of the patch is between ink and clear
    expect(soft / covered).toBeLessThan(0.15);
  });

  it('carries fewer clouds on a still day and more on a heavy one', () => {
    const side = CLOUD_TILE * AIR_DENSITY;
    const inked = (cover: number) => {
      const px = cloudPixels(side, cover);
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) n++;
      return n;
    };
    // a clear sky keeps only a wisp or two, and the scene hides even that on a clear day
    expect(inked(0)).toBeLessThan(side * side * 0.05);
    expect(inked(0.3)).toBeLessThan(inked(0.55));
    expect(inked(0.55)).toBeLessThan(inked(0.8));
  });

  it('keeps still when the reader asked for less motion (G29)', () => {
    expect(cloudDrift(10_000, false)).toEqual({ x: 0, y: 0 });
    expect(cloudDrift(10_000, true)).toEqual(cloudOffset(10_000));
  });

  it('drifts on one wind, moving a little more every second', () => {
    const a = cloudOffset(0);
    const b = cloudOffset(10_000);
    expect(a).toEqual({ x: 0, y: 0 });
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe('the sky over the days', () => {
  it('has clear days, single-cloud days and heavy days, and moves slowly', () => {
    const days = Array.from({ length: 120 }, (_, d) => cloudCover(d));
    expect(Math.min(...days)).toBe(0);
    expect(Math.max(...days)).toBeGreaterThan(0.8);
    const buckets = new Set(days.map(cloudBucket));
    expect(buckets.size).toBe(CLOUD_BUCKETS.length);
    for (let d = 0; d < days.length - 1; d++) expect(Math.abs(days[d + 1]! - days[d]!)).toBeLessThan(0.35);
  });

  it('leans clear: most days carry no cloud or one' , () => {
    const days = Array.from({ length: 120 }, (_, d) => cloudCover(d));
    const quiet = days.filter((c) => cloudBucket(c) <= 1).length;
    expect(quiet / days.length).toBeGreaterThan(0.5);
  });
});

describe('the fog banks', () => {
  const W = 24 * 16;
  const H = BANK_TILE.low;

  it('lies dense through its middle and clear at its top and bottom', () => {
    const px = bankPixels(W, H, 1.7);
    const rowShare = (y: number) => {
      let n = 0;
      for (let x = 0; x < W; x++) if (at(px, W, x, y)[3] > 0) n++;
      return n / W;
    };
    const rowAlpha = (y: number) => {
      let n = 0;
      for (let x = 0; x < W; x++) n += at(px, W, x, y)[3];
      return n / W / (255 * BANK_ALPHA);
    };
    // its very edges thin to a few dots and its middle is a sheet, so it has no straight border
    expect(rowShare(0)).toBeLessThan(0.15);
    expect(rowShare(H - 1)).toBeLessThan(0.15);
    expect(rowShare(Math.round(H / 2))).toBeGreaterThan(0.95);
    // and the veil is thick there rather than a few pale dots
    expect(rowAlpha(Math.round(H / 2))).toBeGreaterThan(0.55);
  });

  it('breaks into soft shapes rather than columns: a column of the bank changes as it runs down the band', () => {
    const period = 256;
    const h = BANK_TILE.high * AIR_DENSITY;
    const px = bankPixels(period, h, 1.7, true, period);
    const row = (y: number) => Array.from({ length: period }, (_, x) => at(px, period, x, y)[3]);
    const corr = (a: number[], b: number[]) => {
      const m = (v: number[]) => v.reduce((n, k) => n + k, 0) / v.length;
      const [ma, mb] = [m(a), m(b)];
      const top = a.reduce((n, k, i) => n + (k - ma) * (b[i]! - mb), 0);
      return top / Math.sqrt(a.reduce((n, k) => n + (k - ma) ** 2, 0) * b.reduce((n, k) => n + (k - mb) ** 2, 0));
    };
    // rows a third of the band apart: in columns they would be the same row, near 1
    expect(corr(row(Math.round(h * 0.35)), row(Math.round(h * 0.65)))).toBeLessThan(0.5);
  });

  it('is a pale veil: the light end of the ramp and an alpha under its own cap', () => {
    const px = bankPixels(W, H, 4.3);
    const tones = new Set(Object.values(BANK_RGB).map((c) => c.join(',')));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, b, a] = at(px, W, x, y);
        if (a === 0) continue;
        expect(a).toBeLessThanOrEqual(Math.round(255 * BANK_ALPHA));
        expect(tones.has([r, g, b].join(','))).toBe(true);
        // nothing darker than the light rim: fog reads white, not smoke
        expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(0xc6);
      }
    }
  });
});

describe('how thick the banks lie by the hour', () => {
  it('gathers before dawn, thins at midday and comes back with the dark', () => {
    expect(fogStrength(12 * 60)).toBe(0);
    expect(fogStrength(5.5 * 60)).toBe(1);
    expect(fogStrength(21.5 * 60)).toBeGreaterThan(0.5);
    expect(fogStrength(0)).toBeGreaterThan(0);
    expect(fogStrength(3 * 60)).toBeLessThan(fogStrength(5.5 * 60));
  });

  it('has no step at midnight: a minute either side is a minute apart', () => {
    expect(fogStrength(23 * 60 + 59)).toBeCloseTo(fogStrength(0), 2);
    expect(fogStrength(0)).toBeCloseTo(fogStrength(1), 2);
    for (let m = 0; m < 1440; m += 1) {
      expect(Math.abs(fogStrength((m + 1) % 1440) - fogStrength(m))).toBeLessThan(0.01);
    }
  });

  it('never leaves the 0 to 1 range, whatever the minute', () => {
    for (let m = -1440; m < 2880; m += 7) {
      const v = fogStrength(m);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
