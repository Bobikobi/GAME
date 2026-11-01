/**
 * The engine step of the art at 64 px per tile (NEXT 15): the camera's whole-number zoom, the canvas at the device's
 * pixels, a density-4 sprite's base scale, the ground in chunks, and the tone remap on a 64 px frame.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import type { Bundle } from '@game/kernel';
import { app } from '../src/app';
import { CHUNK, chunkRange } from '../src/groundchunks';
import { adopt, baseOf, baseScale, densityOf, rel, retex, setRel, unitOf } from '../src/kitart';
import { GREENS, remapTone } from '../src/richground';
import { heightOf } from '../src/targets';
import { cameraK, cameraZoom, deviceSize, ratioOf, WHEEL_STEPS, wheelStep, wheelZoom, worldToPage } from '../src/view';

describe('the camera: k = max(1, floor(S / 576)), zoom 4 * ceil(1.5k)', () => {
  // S is the canvas's shorter side in device pixels; the screen's own step k, and the picked closer view (DECISIONS 2026-10-25)
  test.each([
    ['2K phone, 1440 x 3120', 1440, 2, 12],
    ['e2e phone, 390 x 844 at 3x', 1170, 2, 12],
    ['1080 px phone', 1080, 1, 8],
    ['e2e desktop, 1440 x 900', 900, 1, 8],
    ['1920 x 1080 desktop', 1080, 1, 8],
    ['a 4K desktop, 2160 short side', 2160, 3, 20],
  ])('%s', (_name, side, k, zoom) => {
    expect(cameraK(side)).toBe(k);
    expect(cameraZoom(side)).toBe(zoom);
  });

  test('the zoom is always a multiple of 4, at or above 1.5 times the screen\'s own and less than one step over it', () => {
    for (let side = 1; side <= 6000; side += 7) {
      const zoom = cameraZoom(side);
      const own = 4 * cameraK(side);
      // an art pixel is a whole number of device pixels at density 1 (zoom) and at density 4 (zoom / 4)
      expect(Number.isInteger(zoom / 4)).toBe(true);
      expect(zoom).toBeGreaterThanOrEqual(1.5 * own);
      expect(zoom).toBeLessThan(1.5 * own + 4);
    }
  });

  test('tiles across x down at the picked view', () => {
    const across = (w: number, h: number) => [(w / (16 * cameraZoom(Math.min(w, h)))).toFixed(1), (h / (16 * cameraZoom(Math.min(w, h)))).toFixed(1)];
    expect(across(1440, 3120)).toEqual(['7.5', '16.3']);
    expect(across(1170, 2532)).toEqual(['6.1', '13.2']);
    expect(across(1440, 900)).toEqual(['11.3', '7.0']);
    expect(across(1920, 1080)).toEqual(['15.0', '8.4']);
  });
});

describe('the canvas at device pixels', () => {
  test('takes the browser\'s own device-pixel size when it agrees with css x ratio', () => {
    expect(deviceSize(480, 1040, 3, { w: 1440, h: 3120 })).toEqual({ w: 1440, h: 3120 });
    // a fractional ratio: the browser's snapped size wins by a pixel
    expect(deviceSize(411.4, 914.3, 2.625, { w: 1080, h: 2400 })).toEqual({ w: 1080, h: 2400 });
  });

  test('falls back to the rounded product, and does not believe a box that disagrees', () => {
    expect(deviceSize(390, 844, 3)).toEqual({ w: 1170, h: 2532 });
    expect(deviceSize(480, 1040, 3, { w: 480, h: 1040 })).toEqual({ w: 1440, h: 3120 });
    expect(deviceSize(0, 0, 3)).toEqual({ w: 1, h: 1 });
  });

  test('the ratio is device over css', () => {
    expect(ratioOf(1440, 480)).toBe(3);
    expect(ratioOf(1440, 0)).toBe(1);
  });

  test('worldToPage gives CSS pixels on a 3x canvas', () => {
    // zoom 8 canvas px per unit on a 3x canvas is 8/3 css px per unit
    const at = worldToPage({ x: 100, y: 50 }, 8, 3, 160, 80);
    expect(at.x).toBeCloseTo(60 * (8 / 3), 9);
    expect(at.y).toBeCloseTo(30 * (8 / 3), 9);
    // at ratio 1 it is the camera's own zoom
    expect(worldToPage({ x: 0, y: 0 }, 4, 1, 10, 20)).toEqual({ x: 40, y: 80 });
  });

  test('the tile under the player is 16 x zoom / ratio css px wide, whole canvas pixels', () => {
    for (const [side, ratio] of [[1440, 3], [1170, 3], [900, 1], [1080, 1], [2160, 2]] as const) {
      const zoom = cameraZoom(side);
      const css = worldToPage({ x: 0, y: 0 }, zoom, ratio, 16, 0).x;
      expect(css * ratio).toBe(16 * zoom);
    }
  });
});

describe('density in the client', () => {
  beforeEach(() => {
    app.bundle = {
      sprites: {
        'k:chars/old': { url: 'a', w: 16, h: 24, frames: 1, density: 1 },
        'k:chars/pell': { url: 'b', w: 64, h: 96, frames: 3, density: 4 },
        'k:tiles/grass': { url: 'c', w: 64, h: 64, frames: 1, density: 4 },
      },
    } as unknown as Bundle;
  });

  /** The few parts of a Phaser image the helpers touch. */
  const fake = (key: string) => {
    const data = new Map<string, unknown>();
    const o = {
      texture: { key },
      scaleX: 1,
      scaleY: 1,
      getData: (k: string) => data.get(k),
      setData: (k: string, v: unknown) => (data.set(k, v), o),
      setScale: (x: number, y = x) => ((o.scaleX = x), (o.scaleY = y), o),
      setTexture: (k: string) => ((o.texture.key = k), o),
    };
    return o as unknown as Parameters<typeof adopt>[0] & { scaleX: number; scaleY: number; texture: { key: string } };
  };

  test('density and size in world units', () => {
    expect(densityOf('k:chars/old')).toBe(1);
    expect(densityOf('k:chars/pell')).toBe(4);
    expect(densityOf('fx-shadow')).toBe(1);
    expect(unitOf('k:chars/pell')).toEqual({ w: 16, h: 24 });
    expect(unitOf('k:chars/old')).toEqual({ w: 16, h: 24 });
    expect(unitOf('nope')).toBeUndefined();
    expect(baseScale('k:chars/pell')).toBe(0.25);
  });

  test('a density-4 sprite shows at a quarter scale, a density-1 one at 1', () => {
    expect(adopt(fake('k:chars/pell')).scaleX).toBe(0.25);
    expect(adopt(fake('k:chars/old')).scaleX).toBe(1);
  });

  test('a squash and a return end at the base scale, never at 1', () => {
    const o = adopt(fake('k:chars/pell'));
    const squash = rel(o, 1, 0.92);
    expect(squash.x).toBe(0.25);
    expect(squash.y).toBeCloseTo(0.23, 12);
    // a yoyo tween returns to where it started: the base
    const start = { x: o.scaleX, y: o.scaleY };
    setRel(o, 1, 1.04);
    expect(o.scaleY).toBeCloseTo(0.26, 12);
    o.setScale(start.x, start.y);
    setRel(o, 1);
    expect(o.scaleX).toBe(0.25);
    expect(o.scaleY).toBe(0.25);
    expect(baseOf(o)).toBe(0.25);
  });

  test('a texture swap keeps a squash and takes the new base', () => {
    const o = adopt(fake('k:chars/old'));
    setRel(o, 1, 1.04);
    retex(o, 'k:chars/pell', 1);
    expect(o.texture.key).toBe('k:chars/pell');
    expect(o.scaleX).toBe(0.25);
    expect(o.scaleY).toBeCloseTo(0.26, 12);
    retex(o, 'k:chars/old');
    expect(o.scaleX).toBe(1);
    expect(o.scaleY).toBeCloseTo(1.04, 12);
  });

  test('a prop\'s height for the glint is in world units', () => {
    const b = app.bundle;
    expect(heightOf(b, 'k:chars/pell', 24)).toBe(24);
    expect(heightOf(b, 'k:chars/old', 99)).toBe(24);
    expect(heightOf(b, undefined, 16)).toBe(16);
    expect(heightOf(b, 'nope', 16)).toBe(16);
  });
});

describe('the ground in chunks', () => {
  const view = (x: number, y: number, w: number, h: number) => ({ x, y, right: x + w, bottom: y + h });

  test('a chunk is 16 x 16 tiles', () => {
    expect(CHUNK).toBe(16);
  });

  test('the view and one ring, clamped to the 48 x 49 valley', () => {
    // the 2K phone's view is 180 x 390 units; 16 tiles of 16 units is a chunk of 256
    expect(chunkRange(view(0, 0, 180, 390), 16, 48, 49)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 2 });
    expect(chunkRange(view(600, 300, 180, 390), 16, 48, 49)).toEqual({ x0: 1, y0: 0, x1: 2, y1: 3 });
    // far outside: clamped, never negative or past the last chunk
    expect(chunkRange(view(-500, -500, 180, 390), 16, 48, 49)).toEqual({ x0: 0, y0: 0, x1: 0, y1: 0 });
    expect(chunkRange(view(5000, 5000, 180, 390), 16, 48, 49)).toEqual({ x0: 2, y0: 3, x1: 2, y1: 3 });
  });

  test('without the ring it is only what is seen, and a few chunks are held at once', () => {
    expect(chunkRange(view(300, 300, 100, 100), 16, 48, 49, 0)).toEqual({ x0: 1, y0: 1, x1: 1, y1: 1 });
    // the most chunks a phone holds, anywhere in the valley: the view spans at most 2 x 3 and the ring adds one around it
    let most = 0;
    for (let y = 0; y < 49 * 16; y += 40) {
      for (let x = 0; x < 48 * 16; x += 40) {
        const r = chunkRange(view(x, y, 180, 390), 16, 48, 49);
        most = Math.max(most, (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
      }
    }
    expect(most).toBeLessThanOrEqual(12);
  });
});

describe('the tone remap on a 64 px frame', () => {
  const frame = (w: number, h: number, rgb: number) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 255], i * 4);
    return data;
  };

  test('shades a tenth of a 64 x 64 grass tile, every pixel still a palette green, and keeps the stipple from frame to frame', () => {
    const base = GREENS[2]!;
    const sheet = new Uint8ClampedArray(128 * 64 * 4);
    // two frames side by side, both plain base green
    const one = frame(64, 64, base);
    for (let y = 0; y < 64; y++) for (const f of [0, 1]) sheet.set(one.subarray(y * 64 * 4, (y + 1) * 64 * 4), (y * 128 + f * 64) * 4);
    remapTone(sheet, 128, 1, 64);
    let shaded = 0;
    const left: number[] = [];
    const right: number[] = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4;
        const rgb = ((sheet[i]! << 16) | (sheet[i + 1]! << 8) | sheet[i + 2]!) >>> 0;
        expect(rgb === base || rgb === GREENS[1]).toBe(true);
        if (rgb !== base) shaded++;
        (x < 64 ? left : right).push(rgb);
      }
    }
    // a checker-biased tenth of 2 x 4096 art pixels
    expect(shaded / (2 * 64 * 64)).toBeGreaterThan(0.08);
    expect(shaded / (2 * 64 * 64)).toBeLessThan(0.3);
    // both frames of a sheet share the stipple: nothing twinkles
    expect(right).toEqual(left);
  });

  test('leaves everything but the greens alone', () => {
    const data = frame(64, 64, 0x9e6b3c);
    const copy = data.slice();
    remapTone(data, 64, 2);
    expect(data).toEqual(copy);
  });
});

describe('the wheel: whole steps from the default view up to k + 2, and back out to it', () => {
  const short = 900; // a 1440 x 900 window at 1x: k 1, the default view 8
  test('a notch in comes one step closer, a notch out one step back, held to 0..2', () => {
    let step = 0;
    const seen: number[] = [];
    for (const dy of [-100, -100, -100, 100, 100, 100, 100]) {
      step = wheelStep(step, dy);
      seen.push(wheelZoom(short, step));
    }
    expect(seen).toEqual([12, 16, 16, 12, 8, 8, 8]);
    expect(wheelStep(1, 0)).toBe(1);
  });
  test.each([450, 576, 900, 1080, 1170, 2160])('every step is a multiple of 4 and never under the default, at a short side of %i', (side) => {
    const base = cameraZoom(side);
    for (let step = -3; step <= 5; step++) {
      const zoom = wheelZoom(side, step);
      expect(zoom % 4).toBe(0);
      expect(zoom).toBeGreaterThanOrEqual(base);
      expect(zoom).toBeLessThanOrEqual(base + 4 * WHEEL_STEPS);
    }
    expect(wheelZoom(side, 0)).toBe(base);
    expect(wheelZoom(side, WHEEL_STEPS)).toBe(base + 8);
  });
});
