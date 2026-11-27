import { describe, expect, test } from 'vitest';

import { baseOf, presenceOf } from '../src/painted-presence.js';

/** a map and a scene of the sizes the function reads */
const map = (w: number, h: number) => ({ width: w, ground: Array.from({ length: h }, () => '.'.repeat(w)) }) as never;
const scene = (cols: number, rows: number) => ({ cols, rows }) as never;

describe('the valley as the painted land (base=1, V5)', () => {
  test('the query turns it on, and nothing else does', () => {
    expect(presenceOf('?debug&painted=x&base=1').base).toBe(true);
    expect(presenceOf('?debug&painted=x').base).toBe(false);
    expect(presenceOf('?debug&painted=x&base=0').base).toBe(false);
    expect(presenceOf('?preview').base).toBe(false);
  });

  test('the content map is the world and the scene lies one tile in, inside the ring', () => {
    const raw = map(41, 30);
    const got = baseOf(raw, scene(39, 28));
    expect(got.map).toBe(raw);
    expect([got.x0, got.y0]).toEqual([1, 1]);
  });

  test('a map of another size is refused, with both sizes in the message', () => {
    expect(() => baseOf(map(41, 30), scene(38, 28))).toThrow('the map is 41 x 30, the scene 38 x 28 needs 40 x 30');
    expect(() => baseOf(map(41, 29), scene(39, 28))).toThrow(/needs 41 x 30/);
  });
});
