import { describe, expect, test } from 'vitest';

import { growthSprite, nodeLook } from '../src/growth';
import { loadBundle } from '../../tools/test/helpers/world';

const bundle = loadBundle();
const oak = bundle.resources['core/oak-trees']!;
const bush = bundle.resources['core/berry-bushes']!;
const stones = bundle.resources['core/river-stones']!;
const [stump, sapling, young] = [oak.sprite_empty!, ...(oak.growth ?? [])];

describe('a tree grows back in stages', () => {
  test('the oak has a stump and two young stages', () => {
    expect(oak.growth).toHaveLength(2);
    expect(new Set([stump, sapling, young, oak.sprite]).size).toBe(4);
  });

  test('just after the felling it is a stump, then a sapling, then a young tree, then grown', () => {
    const span = oak.respawn_ms;
    // `left` is the time to go: the whole respawn at the start, nothing at the end
    expect(growthSprite(oak, span + 3000)).toBe(stump);
    expect(growthSprite(oak, span)).toBe(stump);
    expect(growthSprite(oak, Math.round(span * 0.6))).toBe(sapling);
    expect(growthSprite(oak, Math.round(span * 0.2))).toBe(young);
    expect(nodeLook(oak, 0).sprite).toBe(oak.sprite);
    expect(nodeLook(oak, -500).sprite).toBe(oak.sprite);
  });

  test('a stage begins exactly at its share of the time', () => {
    const span = oak.respawn_ms;
    expect(growthSprite(oak, span - Math.ceil(span / 3))).toBe(sapling);
    expect(growthSprite(oak, span - Math.ceil(span / 3) + 1)).toBe(stump);
    expect(growthSprite(oak, Math.floor(span / 3))).toBe(young);
    expect(growthSprite(oak, Math.floor(span / 3) + 1)).toBe(sapling);
  });

  test('a tree stands upright and in full colour at every stage, because it stays in the way', () => {
    for (const left of [oak.respawn_ms + 1, oak.respawn_ms / 2, 1]) {
      const look = nodeLook(oak, left);
      expect(look.flat).toBe(false);
      expect(look.alpha).toBe(1);
    }
  });

  test('a bush lies flat and faded when gathered, a stone node fades without a bare sprite', () => {
    expect(nodeLook(bush, 1000)).toEqual({ sprite: bush.sprite_empty, alpha: 0.8, flat: true });
    expect(stones.sprite_empty).toBeUndefined();
    expect(nodeLook(stones, 1000)).toEqual({ sprite: stones.sprite, alpha: 0.3, flat: true });
  });
});
