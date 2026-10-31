import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { blockiness, leftoversReport, stateOf } from '../src/art/leftovers.js';

function sheet(w: number, h: number, paint: (x: number, y: number) => number): PNG {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const c = paint(x, y);
      png.data.set([c >> 16, (c >> 8) & 255, c & 255, 255], (y * w + x) * 4);
    }
  }
  return png;
}

describe('the 16 px leftovers', () => {
  test('a picture of 4 x 4 blocks is scaled, one with detail inside its blocks is not', () => {
    const scaled = sheet(16, 16, (x, y) => (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 0x336699 : 0x996633);
    const native = sheet(16, 16, (x, y) => ((x * 7 + y * 3) % 5) * 0x101010);
    expect(blockiness(scaled)).toBe(1);
    expect(blockiness(native)).toBeLessThan(0.2);
    expect(stateOf(4, blockiness(scaled))).toBe('scaled16');
    expect(stateOf(4, blockiness(native))).toBe('native64');
    expect(stateOf(1, undefined)).toBe('old16');
  });
  test('the repo report ranks the leftovers by footprint and holds no scaled or native sprite among them wrongly', () => {
    const { rows, text } = leftoversReport();
    const left = rows.filter((r) => r.state !== 'native64');
    expect(left.length).toBeGreaterThan(0);
    for (let i = 1; i < left.length; i += 1) expect(left[i - 1]!.per100).toBeGreaterThanOrEqual(left[i]!.per100 - 1e-9);
    expect(text).toContain('| # | sprite | state |');
    expect(rows.find((r) => r.ref === 'core/base-kit:tiles/grass')?.state).toBe('native64');
  });
});
