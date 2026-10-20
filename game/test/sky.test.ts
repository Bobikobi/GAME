import { describe, expect, it } from 'vitest';
import { BANK_RGB, BANK_TILE, CLOUD_ALPHA, CLOUD_TILE, bankPixels, cloudField, cloudOffset, cloudPixels, fogStrength } from '../src/sky';

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

  it('is ink at 12 to 15 percent, whole pixels, nothing in between', () => {
    const px = cloudPixels();
    expect(px.length).toBe(CLOUD_TILE * CLOUD_TILE * 4);
    let covered = 0;
    for (let y = 0; y < CLOUD_TILE; y++) {
      for (let x = 0; x < CLOUD_TILE; x++) {
        const [r, g, b, a] = at(px, CLOUD_TILE, x, y);
        expect([0, CLOUD_ALPHA]).toContain(a);
        if (a === 0) continue;
        covered++;
        expect([r, g, b]).toEqual([0x1b, 0x1a, 0x2e]);
      }
    }
    expect(CLOUD_ALPHA).toBe(Math.round(0.15 * 255));
    // a cloud covers a share of the patch, not all of it and not none: the view can sit inside one or between two
    const share = covered / (CLOUD_TILE * CLOUD_TILE);
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.75);
  });

  it('drifts on one wind, moving a little more every second', () => {
    const a = cloudOffset(0);
    const b = cloudOffset(10_000);
    expect(a).toEqual({ x: 0, y: 0 });
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe('the fog banks', () => {
  const W = 24 * 16;
  const H = BANK_TILE.low;

  it('lies dense through its middle and clear at its top and bottom', () => {
    const px = bankPixels(W, H, 1.7);
    const rowShare = (y: number) => {
      let n = 0;
      for (let x = 0; x < W; x++) if (at(px, W, x, y)[3] === 255) n++;
      return n / W;
    };
    // its very edges thin to a few dots and its middle is a sheet, so it has no straight border
    expect(rowShare(0)).toBeLessThan(0.15);
    expect(rowShare(H - 1)).toBeLessThan(0.15);
    expect(rowShare(Math.round(H / 2))).toBeGreaterThan(0.7);
  });

  it('uses the grey ramp and whole pixels only', () => {
    const px = bankPixels(W, H, 4.3);
    const tones = new Set(Object.values(BANK_RGB).map((c) => c.join(',')));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, b, a] = at(px, W, x, y);
        if (a === 0) continue;
        expect(a).toBe(255);
        expect(tones.has([r, g, b].join(','))).toBe(true);
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

  it('never leaves the 0 to 1 range, whatever the minute', () => {
    for (let m = -1440; m < 2880; m += 7) {
      const v = fogStrength(m);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
