/**
 * The skill tree's picture is worked out from the content (game/src/treelayout.ts): the same every
 * time, each wing out along its own direction, no two nodes overlapping, for the core tree and for a
 * generated tree of about three hundred nodes, for every race; a school that gives places keeps them.
 */
import { describe, expect, test } from 'vitest';

import { nodeKey } from '@game/kernel';

import { closestGap, layoutTree, wingAngles } from '../src/treelayout';
import { bigTree } from '../../tools/test/helpers/bigtree';
import { loadBundle } from '../../tools/test/helpers/world';

const core = loadBundle();
const big = bigTree(core);
const races = Object.keys(core.races).sort();

describe('the tree laid out', () => {
  test.each(races)('the core tree for %s: its own corners only, no two nodes touching', (race) => {
    const t = layoutTree(core, race);
    const corners = t.nodes.filter((p) => p.node.size === 'corner');
    expect(corners.length).toBe(Object.keys(core.schools).length);
    expect(corners.every((p) => p.node.race === race)).toBe(true);
    expect(closestGap(t)).toBeGreaterThan(0.2);
  });

  test.each(races)('three hundred nodes for %s: no two touching, every node inside the bounds', (race) => {
    const t = layoutTree(big, race);
    expect(t.nodes.length).toBeGreaterThanOrEqual(290);
    expect(closestGap(t)).toBeGreaterThan(0.2);
    for (const p of t.nodes) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(t.bounds.x0);
      expect(p.y + p.r).toBeLessThanOrEqual(t.bounds.y1);
    }
  });

  test('is the same every time, and the same shape for every race', () => {
    const a = layoutTree(big, races[0]!);
    const b = layoutTree(big, races[0]!);
    expect(a.nodes.map((p) => [p.key, p.x, p.y])).toEqual(b.nodes.map((p) => [p.key, p.x, p.y]));
    const other = layoutTree(big, races[1]!);
    expect(other.nodes.map((p) => [p.x, p.y])).toEqual(a.nodes.map((p) => [p.x, p.y]));
  });

  test('each wing grows out along its own direction, deeper nodes further out', () => {
    const t = layoutTree(core, races[0]!);
    const angles = wingAngles(Object.values(core.schools));
    expect(new Set(angles.values()).size).toBe(Object.keys(core.schools).length);
    for (const s of t.schools) {
      const rad = (s.angle * Math.PI) / 180;
      const out = (p: { x: number; y: number }) => p.x * Math.cos(rad) + p.y * Math.sin(rad);
      const mine = t.nodes.filter((p) => p.school === s.id);
      for (const p of mine) expect(out(p), p.key).toBeGreaterThan(1);
      for (const p of mine) for (const k of p.needs) if (k.startsWith(`${s.id}/`)) expect(out(p)).toBeGreaterThan(out(t.byKey.get(k) ?? p) - 0.01);
      expect(s.roots.length).toBeGreaterThan(0);
    }
  });

  test('a school that gives its nodes places stands where it says, and an angle turns a wing', () => {
    const b = structuredClone(core);
    const id = Object.keys(b.schools).sort()[0]!;
    b.schools[id]!.nodes.forEach((n, i) => (n.pos = { x: 10 + i, y: -3 }));
    b.schools[Object.keys(b.schools).sort()[1]!]!.angle = 45;
    const t = layoutTree(b, races[0]!);
    const first = b.schools[id]!.nodes[0]!;
    expect(t.byKey.get(nodeKey(id, first.id))).toMatchObject({ x: 10, y: -3 });
    expect(t.schools.find((s) => s.id === Object.keys(b.schools).sort()[1])?.angle).toBe(45);
  });
});
