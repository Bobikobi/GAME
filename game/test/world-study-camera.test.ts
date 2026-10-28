import { expect, test } from 'vitest';
import { deviceSize } from '../src/view';
import { worldStudyCameraZoom } from '../src/world-study-camera';

test.each([
  ['desktop', 1440, 900, 1, 2, 1],
  ['3x phone', 390, 844, 3, 3, 2],
  ['2K phone', 480, 1040, 3, 3, 2],
  ['fractional DPR', 411.4, 914.3, 2.625, 2, 1],
] as const)('%s uses the approved close framing in 64-unit coordinates', (_name, cssW, cssH, dpr, close, wide) => {
  const { w, h } = deviceSize(cssW, cssH, dpr);
  expect(worldStudyCameraZoom(w, h)).toBe(close);
  expect(worldStudyCameraZoom(w, h, false)).toBe(wide);
  // A native 64 px tile has the same device size as production's 16-unit tile.
  expect(64 * worldStudyCameraZoom(w, h)).toBe(16 * close * 4);
});

test('resize and DPR changes recompute the picked step without changing view mode', () => {
  const zoom = (w: number, h: number, dpr: number, close: boolean) => {
    const device = deviceSize(w, h, dpr);
    return worldStudyCameraZoom(device.w, device.h, close);
  };
  for (const close of [true, false]) {
    expect(zoom(1440, 900, 1, close)).toBe(close ? 2 : 1);
    expect(zoom(1440, 900, 2, close)).toBe(close ? 5 : 3);
    expect(zoom(900, 1440, 2, close)).toBe(close ? 5 : 3);
    expect(zoom(1440, 900, 1, close)).toBe(close ? 2 : 1);
  }
});

test('both views keep art pixels whole, with close at the first whole step at or above 1.5 times wide', () => {
  for (let side = 1; side <= 6000; side += 17) {
    const close = worldStudyCameraZoom(side, side * 2);
    const wide = worldStudyCameraZoom(side, side * 2, false);
    expect(Number.isInteger(close) && Number.isInteger(wide)).toBe(true);
    expect(close).toBeGreaterThanOrEqual(1.5 * wide);
    expect(close - 1).toBeLessThan(1.5 * wide);
  }
});
