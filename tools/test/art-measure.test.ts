import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { paletteWithRamps } from '../src/kit/palette.js';
import { bestPerEntry, echo, measureTile, seamRatio } from '../src/art/measure.js';

const GREENS = paletteWithRamps(['green', 'moss']).slice(-6);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

function tile(fn: (x: number, y: number) => string | null, size = 64): PNG {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hex = fn(x, y);
      const [r, g, b] = hex === null ? [0, 0, 0] : rgb(hex);
      png.data.set([r, g, b, hex === null ? 0 : 255], (y * size + x) * 4);
    }
  }
  return png;
}
// a deterministic scatter that wraps: a hash of the position modulo the tile
const h = (x: number, y: number): number => {
  let v = Math.imul((x % 64) + 1, 374761393) ^ Math.imul((y % 64) + 1, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return (v ^ (v >>> 16)) >>> 0;
};
const noise = (x: number, y: number): string => GREENS[(h(x, y) >>> 4) % GREENS.length] ?? GREENS[0] ?? '#000000';

const scatter = (x: number, y: number): string => ((h(x, y) >>> 4) % 4 === 0 ? (GREENS[1 + ((h(x, y) >>> 9) % 5)] ?? '#000000') : (GREENS[0] ?? '#000000'));

describe('art:measure', () => {
  it('passes a wrapping scatter in the shared ramps', () => {
    const m = measureTile(tile((x, y) => scatter(x, y)), ['green', 'moss']);
    expect(m.failures).toEqual([]);
    expect(m.pass).toBe(true);
  });
  it('fails a flat tile, a tile with a clear corner and a colour outside the ramps', () => {
    expect(measureTile(tile(() => GREENS[0] ?? '#000000'), ['green']).failures.join()).toMatch(/colours|detail/u);
    expect(measureTile(tile((x, y) => (x < 4 && y < 4 ? null : noise(x, y))), ['green', 'moss']).failures.join()).toMatch(/fill: 16 clear/u);
    expect(measureTile(tile((x, y) => (x < 20 ? '#ff00ff' : noise(x, y))), ['green', 'moss']).failures.join()).toMatch(/palette/u);
  });
  it('sees a seam where the right edge does not meet the left', () => {
    const ramp = tile((x) => GREENS[Math.min(5, Math.floor(x / 11))] ?? GREENS[0] ?? '#000000');
    expect(seamRatio(ramp)).toBeGreaterThan(1.35);
    expect(seamRatio(tile((x, y) => noise(x, y)))).toBeLessThan(1.35);
  });
  it('sees rows: a tile that repeats every 8 px echoes, a random one does not', () => {
    expect(echo(tile((x, y) => noise(x % 8, y % 8)))).toBeGreaterThan(0.9);
    expect(echo(tile((x, y) => noise(x, y)))).toBeLessThan(0.3);
  });
  it('keeps the best passing draft of each entry and none for an entry that never passes', () => {
    const row = (name: string, id: string, pass: boolean, score: number): never => ({ entry: { name }, draft: { id }, m: { pass, score } }) as never;
    const best = bestPerEntry([row('a', '1', true, 1), row('a', '2', true, 2), row('b', '3', false, 9)]);
    expect(best.get('a')?.draft.id).toBe('2');
    expect(best.has('b')).toBe(false);
  });
});

describe('wrapTile', () => {
  it('makes a tile that does not wrap wrap, with no new colour', async () => {
    const { wrapTile } = await import('../src/kit/wrap.js');
    const ramp = tile((x, y) => GREENS[(Math.floor(x / 11) + Math.floor(y / 13)) % 6] ?? '#000000');
    const before = seamRatio(ramp);
    const wrapped = PNG.sync.read(wrapTile(PNG.sync.write(ramp)));
    expect(before).toBeGreaterThan(1.35);
    expect(seamRatio(wrapped)).toBeLessThan(before);
    const colours = new Set<number>();
    for (let i = 0; i < wrapped.data.length; i += 4) colours.add(((wrapped.data[i] ?? 0) << 16) | ((wrapped.data[i + 1] ?? 0) << 8) | (wrapped.data[i + 2] ?? 0));
    expect(colours.size).toBeLessThanOrEqual(6);
  });
});
