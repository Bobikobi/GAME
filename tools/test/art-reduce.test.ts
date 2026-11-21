import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { afterAll, describe, expect, test } from 'vitest';

import { reduceCli } from '../src/art/reduce-cli.js';
import { boxScale, cropToAlpha, distinct, keyOut, quantize, reduce } from '../src/art/reduce.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-reduce-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A figure on the magenta key: a body of `rows` colours, with a 3-pixel margin of key all around. */
function drawing(w: number, h: number, paint: (x: number, y: number) => [number, number, number] | null): PNG {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const c = paint(x, y) ?? [255, 0, 255];
      const i = (y * w + x) * 4;
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
      png.data[i + 3] = 255;
    }
  }
  return png;
}

const body = (x: number, y: number): [number, number, number] | null => (x >= 8 && x < 56 && y >= 8 && y < 72 ? [30 + ((x * 3 + y * 5) % 90), 60 + ((x * 7) % 120), 40 + ((y * 11) % 150)] : null);

describe('the key and the crop', () => {
  test('the magenta key goes clear, one ring of fringe goes with it, and the image border counts as outside', () => {
    const src = drawing(20, 20, (x, y) => (x >= 4 && x < 16 && y >= 4 && y < 16 ? [10, 200, 10] : null));
    const { png, found } = keyOut(src);
    expect(found).toBe(true);
    const alpha = (x: number, y: number): number => png.data[(y * 20 + x) * 4 + 3] as number;
    expect(alpha(3, 3)).toBe(0);
    expect(alpha(4, 4)).toBe(0);
    expect(alpha(5, 5)).toBe(255);
    expect(alpha(10, 10)).toBe(255);
    const cropped = cropToAlpha(png) as PNG;
    expect([cropped.width, cropped.height]).toEqual([10, 10]);
  });

  test('a picture with no key keeps all its pixels (no erosion of a real edge)', () => {
    const src = drawing(12, 12, () => [10, 120, 10]);
    const { png, found } = keyOut(src);
    expect(found).toBe(false);
    expect(cropToAlpha(png)).toMatchObject({ width: 12, height: 12 });
  });

  test('a pink that is not the key is kept: the key needs R>150, G<110 and B>150', () => {
    const src = drawing(12, 12, (x) => (x < 6 ? [255, 160, 255] : [255, 0, 255]));
    const { png } = keyOut(src);
    expect(png.data[(5 * 12 + 2) * 4 + 3]).toBe(255);
    expect(png.data[(5 * 12 + 11) * 4 + 3]).toBe(0);
  });
});

describe('scaling', () => {
  test('a box scale averages by area on premultiplied colour: a clear neighbour does not darken or tint an edge', () => {
    const src = new PNG({ width: 4, height: 2 });
    const set = (x: number, y: number, rgba: [number, number, number, number]): void => {
      const i = (y * 4 + x) * 4;
      [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]] = rgba;
    };
    for (let y = 0; y < 2; y += 1) {
      set(0, y, [200, 100, 50, 255]);
      set(1, y, [200, 100, 50, 255]);
      set(2, y, [0, 0, 0, 0]);
      set(3, y, [0, 0, 0, 0]);
    }
    const out = boxScale(src, 2, 1);
    expect([...out.data.subarray(0, 4)]).toEqual([200, 100, 50, 255]);
    expect(out.data[7]).toBe(0);
    // half covered is the rule: hard alpha at 127, no soft edge survives
    const half = new PNG({ width: 2, height: 1 });
    half.data.set([200, 100, 50, 255, 0, 0, 0, 0]);
    expect([...boxScale(half, 1, 1).data]).toEqual([200, 100, 50, 255]);
    const under = new PNG({ width: 3, height: 1 });
    under.data.set([200, 100, 50, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(boxScale(under, 1, 1).data[3]).toBe(0);
  });
});

describe('the colour cut', () => {
  test('at most N colours among the opaque pixels, only 0 and 255 alpha, and clear pixels stay clear', () => {
    const out = reduce(drawing(64, 80, body), { height: 40, colours: 12 });
    expect(out.height).toBe(40);
    expect(distinct(out)).toBeLessThanOrEqual(12);
    const alphas = new Set<number>();
    for (let i = 3; i < out.data.length; i += 4) alphas.add(out.data[i] as number);
    expect([...alphas].sort()).toEqual([0, 255].filter((a) => alphas.has(a)));
    expect(alphas.has(0) || alphas.has(255)).toBe(true);
  });

  test('no magenta fringe: no opaque pixel of the result is the key or leans to it', () => {
    const out = reduce(drawing(64, 80, body), { height: 30 });
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i + 3] === 0) continue;
      const r = out.data[i] as number;
      const g = out.data[i + 1] as number;
      const b = out.data[i + 2] as number;
      expect(r > 150 && g < 110 && b > 150).toBe(false);
    }
  });

  test('colours 0 keeps every colour; a picture under the limit is untouched', () => {
    const src = drawing(64, 80, body);
    const keep = reduce(src, { height: 80, colours: 0 });
    expect(distinct(keep)).toBeGreaterThan(48);
    const few = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < 16; i += 1) few.data.set([i % 3 === 0 ? 255 : 10, 20, 30, 255], i * 4);
    const copy = PNG.sync.read(PNG.sync.write(few));
    expect(quantize(copy, 48)).toBe(2);
    expect(copy.data).toEqual(few.data);
  });

  test('it does not snap to anything: a colour the cut makes is a mean of the colours it replaced', () => {
    const src = new PNG({ width: 2, height: 1 });
    src.data.set([100, 0, 0, 255, 102, 0, 0, 255]);
    quantize(src, 1);
    expect([...src.data]).toEqual([101, 0, 0, 255, 101, 0, 0, 255]);
  });

  test('it is deterministic: the same picture gives the same bytes', () => {
    const a = PNG.sync.write(reduce(drawing(64, 80, body), { height: 33, colours: 20 }));
    const b = PNG.sync.write(reduce(drawing(64, 80, body), { height: 33, colours: 20 }));
    expect(Buffer.compare(a, b)).toBe(0);
  });
});

describe('sizes and the frame', () => {
  test('a width gives the height by the ratio, a frame puts the figure bottom-centred on a transparent square', () => {
    const src = drawing(64, 80, body);
    const wide = reduce(src, { width: 24 });
    expect(wide.width).toBe(24);
    expect(wide.height).toBe(32);
    const framed = reduce(src, { height: 32, frame: 64 });
    expect([framed.width, framed.height]).toEqual([64, 64]);
    const alphaAt = (x: number, y: number): number => framed.data[(y * 64 + x) * 4 + 3] as number;
    expect(alphaAt(32, 63)).toBe(255);
    expect(alphaAt(32, 20)).toBe(0);
    expect(alphaAt(0, 63)).toBe(0);
    expect(() => reduce(src, { height: 80, frame: 64 })).toThrow(/larger than the 64 px frame/);
    expect(() => reduce(src, {})).toThrow(/height or width/);
  });

  test('the command reduces a file or a folder, names what it made, and refuses a missing --out', () => {
    const dir = join(scratch, 'cli');
    mkdirSync(join(dir, 'in'), { recursive: true });
    writeFileSync(join(dir, 'in/a.png'), PNG.sync.write(drawing(64, 80, body)));
    writeFileSync(join(dir, 'in/b.png'), PNG.sync.write(drawing(64, 80, body)));
    writeFileSync(join(dir, 'in/notes.txt'), 'skip');
    const text = reduceCli([join(dir, 'in'), '--height', '20', '--colours', '8', '--out', join(dir, 'out')]);
    expect(text).toMatch(/a\.png -> .*a\.png {2}\d+x20, \d+ colours/);
    expect(readdirSync(join(dir, 'out')).sort()).toEqual(['a.png', 'b.png']);
    expect(PNG.sync.read(readFileSync(join(dir, 'out/a.png'))).height).toBe(20);
    expect(() => reduceCli([join(dir, 'in/a.png'), '--height', '20'])).toThrow(/Usage/);
    expect(() => reduceCli([join(dir, 'in/a.png'), '--height', 'tall', '--out', join(dir, 'x.png')])).toThrow(/whole number/);
  });
});
