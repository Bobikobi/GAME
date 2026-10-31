import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * Wave 2b: the small props stand in groups, not as lone sprites, and a few things have exactly one home.
 * Read from the map file itself, so a group that is thinned or a second well fails here.
 */
interface Prop { sprite: string; x: number; y: number; w: number; h: number; solid?: boolean }
const MAP = JSON.parse(readFileSync(new URL('../../content/core/map.json', import.meta.url), 'utf8')).map as {
  ground: string[];
  props: Prop[];
};
const name = (p: Prop): string => p.sprite.split('/').pop() ?? p.sprite;
const withName = (...names: string[]): Prop[] => MAP.props.filter((p) => names.includes(name(p)));

/** Sizes of the groups: props of one family within two tiles of each other chain into one group. */
function groups(props: Prop[]): number[] {
  const left = new Set(props);
  const sizes: number[] = [];
  while (left.size > 0) {
    const [first] = left;
    if (first === undefined) break;
    left.delete(first);
    const queue = [first];
    let n = 0;
    for (let p = queue.pop(); p !== undefined; p = queue.pop()) {
      n++;
      for (const q of [...left]) if (Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 2) { left.delete(q); queue.push(q); }
    }
    sizes.push(n);
  }
  return sizes;
}

describe('the small props stand in groups', () => {
  const lone = (props: Prop[], min: number): number => groups(props).filter((n) => n < min).length;

  test('flowers: most groups are 3 or more, none is huge', () => {
    const g = groups(withName('flowers', 'flowers_white', 'flowers_blue'));
    expect(g.filter((n) => n >= 3).length / g.length).toBeGreaterThanOrEqual(0.7);
    expect(Math.max(...g)).toBeLessThanOrEqual(20);
  });

  test('stones: the old stones keep their groups (no new solid stone: it shut a walk the e2e plans)', () => {
    const g = groups(withName('rock_mossy'));
    expect(g.filter((n) => n >= 2).length / g.length).toBeGreaterThanOrEqual(0.4);
  });

  test('tall grass: drifts of 5 or more outnumber the lone tufts', () => {
    const props = withName('grass_tall', 'grass_tall_b', 'grass_tall_c');
    expect(groups(props).filter((n) => n >= 5).length).toBeGreaterThan(lone(props, 5) - 1);
  });
});

describe('the old well and the berry bushes', () => {
  test('the second well stands once, a tile or two from a path, and blocks', () => {
    const wells = withName('well_old_b');
    expect(wells).toHaveLength(1);
    const [w] = wells;
    expect(w?.solid).toBe(true);
    const path = (x: number, y: number): boolean => ':='.includes(MAP.ground[y]?.[x] ?? ' ');
    let near = 99;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 4; dx++) if (path((w?.x ?? 0) + dx, (w?.y ?? 0) + dy)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
    expect(near).toBeLessThanOrEqual(3);
  });

  test('berry bushes are the scenery variants: the plain sprite is the gatherable', () => {
    const bushes = withName('bush_berry', 'bush_berry_b', 'bush_berry_c');
    expect(bushes.length).toBeGreaterThanOrEqual(6);
    expect(bushes.filter((p) => name(p) === 'bush_berry')).toHaveLength(0);
  });
});
