import { expect, test } from 'vitest';
import { groundBlender } from '../src/groundblend';
import { EDGE_PX } from '../src/pathedge';
import { openingGround } from './fixtures/ground-blends';

test('the opening ground blends match the original bytes across four frames', () => {
  const { tiles, at, grassSprites, withVariants, frames, pixels, legacy } = openingGround();
  const prepare = groundBlender(at, grassSprites, withVariants, frames, pixels);
  // A fixed row-major sample from each pair, with positions deduplicated at junctions.
  const counts = new Map<string, number>();
  const sample = tiles.filter(({ touching }) => {
    let include = false;
    for (const { a, b } of touching) {
      const pair = a + '/' + b;
      const i = counts.get(pair) ?? 0;
      counts.set(pair, i + 1);
      if (i % 3 === 0) include = true;
    }
    return include;
  });
  expect(sample.length).toBeGreaterThanOrEqual(200);
  expect(counts.size).toBe(9);
  const comparedPairs = new Set<string>();
  let compared = 0;
  let waterChanges = false;
  for (const tile of sample) {
    const { x, y, sprite, key } = tile;
    const blend = prepare(x, y, sprite, key)!;
    const first = blend(0);
    if (first) {
      compared++;
      for (const { a, b } of tile.touching) comparedPairs.add(a + '/' + b);
    }
    const water = tile.touching.some(({ b }) => b === 'water');
    for (let frame = 0; frame < 4; frame++) {
      const old = legacy(tile, frame);
      const actual = frame === 0 ? first : blend(frame);
      const equal = actual && old ? Buffer.from(actual).equals(Buffer.from(old)) : actual === old;
      expect(equal, `tile (${x},${y}), frame ${frame}`).toBe(true);
      if (water && frame > 0 && first && actual && !Buffer.from(first).equals(Buffer.from(actual))) waterChanges = true;
    }
  }
  expect(compared).toBeGreaterThanOrEqual(200);
  expect(comparedPairs).toEqual(new Set(counts.keys()));
  expect(waterChanges).toBe(true);
});

test('a multi-frame ground sprite stays animated at its edge', () => {
  const meadow = { sprite: 'tiles/grass', tag: 'meadow' };
  const path = { sprite: 'tiles/path', tag: 'path' };
  const at = (x: number) => x <= 0 ? path : meadow;
  const frames = (ref: string) => ref === path.sprite ? 2 : 1;
  const pixels = (ref: string, frame: number) => new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4).fill(ref === path.sprite ? 100 + frame % 2 : 20);
  const blend = groundBlender(at, [meadow.sprite], (ref) => [ref], frames, pixels)(0, 0, path.sprite, path.sprite)!;
  const centre = (32 * EDGE_PX + 32) * 4;
  expect([0, 1, 2, 3].map((frame) => blend(frame)?.[centre])).toEqual([100, 101, 100, 101]);
});
