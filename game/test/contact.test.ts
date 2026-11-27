import { describe, expect, test } from 'vitest';

import { PAINTED_SCREEN_PX_PER_ART_PX, aimAlpha, easeAlpha, feetOffset, lstar, paintedCameraZoom, phoneArtPx, phoneCameraZoom } from '../src/contact.js';

const AIM = { aim: 10.5, skip: 8, max: 0.75, cover: 0.7 };
const TINT = 0x1b1a2e;

describe('the contact patch strength', () => {
  test('a jump of the target from 0 to 0.6 moves the drawn alpha by at most 0.05 in one 16 ms frame', () => {
    expect(easeAlpha(0, 0.6, 16)).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(easeAlpha(0.6, 0, 16)).toBeGreaterThanOrEqual(0.6 - 0.05 - 1e-9);
  });
  test('it settles on the target', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) a = easeAlpha(a, 0.6, 16);
    expect(a).toBeCloseTo(0.6, 2);
  });
  test('it does not overshoot on a long frame', () => {
    expect(easeAlpha(0.2, 0.25, 1000)).toBeLessThanOrEqual(0.25);
  });
});

describe('the aim', () => {
  const light: [number, number, number] = [150, 140, 90];
  const L = lstar(...light);
  test('light ground gets a patch that darkens the band by about the aim', () => {
    const a = aimAlpha(light, L, L, TINT, AIM);
    expect(a).toBeGreaterThan(0.2);
    expect(a).toBeLessThanOrEqual(0.75);
  });
  test('ground already 8 L* under the ring gets nothing', () => {
    expect(aimAlpha(light, L, L + 8.5, TINT, AIM)).toBe(0);
  });
  test('the alpha never passes the clamp', () => {
    expect(aimAlpha([250, 250, 250], 98, 98, TINT, { ...AIM, aim: 60 })).toBe(0.75);
  });
  test('a darker target needs a stronger patch', () => {
    expect(aimAlpha(light, L, L, TINT, { ...AIM, aim: 12 })).toBeGreaterThan(aimAlpha(light, L, L, TINT, { ...AIM, aim: 9 }));
  });
});

describe('the feet offset', () => {
  test('is the median over frames of the middle of the lowest three rows, from the frame middle', () => {
    const w = 16, h = 16;
    // frame 0 and 1: feet at cols 4-7 (middle 6 -> -2); frame 2: an outlier at cols 10-13
    const feet = [[4, 7], [4, 7], [10, 13]];
    const at = (f: number, x: number, y: number): number => (y >= 13 && y <= 14 && x >= feet[f]![0]! && x <= feet[f]![1]! ? 255 : y < 12 && x === 8 ? 255 : 0);
    expect(feetOffset(3, w, h, at)).toBeCloseTo(6 - 8, 5);
  });
});

describe('the painted lands camera', () => {
  test('the default is 3 screen px per art px, camera zoom 12 on the 4-per-pixel grid', () => {
    expect(PAINTED_SCREEN_PX_PER_ART_PX).toBe(3);
    expect(paintedCameraZoom(4)).toBe(12);
  });
  test('figzoom still overrides, and a bad value falls back to the default', () => {
    expect(paintedCameraZoom(4, 4)).toBe(16);
    expect(paintedCameraZoom(4, 0)).toBe(12);
    expect(paintedCameraZoom(4, -2)).toBe(12);
  });
});

describe('the phone camera (zoom=auto)', () => {
  test('1080 high is the owner\'s 3, 390 high is 1, and a tall screen never drops below 1', () => {
    expect(phoneArtPx(1080)).toBe(3);
    expect(phoneArtPx(390)).toBe(1);
    expect(phoneArtPx(1)).toBe(1);
    expect(phoneArtPx(0)).toBe(1);
    expect(phoneArtPx(720)).toBe(2);
    expect(phoneArtPx(1440)).toBe(4);
  });
  test('the zoom is whole device pixels per art pixel: 1 css px at ratio 3 is 3 device px, a fractional ratio is rounded to whole', () => {
    expect(phoneCameraZoom(4, 1080, 1)).toBe(12);
    expect(phoneCameraZoom(4, 390, 1)).toBe(4);
    expect(phoneCameraZoom(4, 390, 3)).toBe(12);
    expect(phoneCameraZoom(4, 390, 2.625)).toBe(12);
    expect(phoneCameraZoom(4, 390, 2)).toBe(8);
    expect(Number.isInteger(phoneCameraZoom(4, 413, 2.75) / 4)).toBe(true);
    expect(phoneCameraZoom(4, 390, 0)).toBe(4);
  });
  test('the figure keeps her share of the height at every phone height (51 art px of 1080 at zoom 3 = 14.2%)', () => {
    const share = (cssH: number): number => (51 * phoneArtPx(cssH)) / cssH;
    const ref = share(1080);
    for (const h of [360, 390, 412, 600, 720, 1080, 1440]) expect(Math.abs(share(h) - ref)).toBeLessThan(0.05);
  });
});
