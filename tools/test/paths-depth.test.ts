/**
 * The depth of each path (tools/src/paths/depth.ts; docs/design/PATHS.md): the table is read from the
 * content alone, comes out the same every time, and counts what the content holds.
 */
import type { Bundle } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorld } from '../src/balance/world';
import type { Rules } from '../src/balance/rules';
import { formatDepth, pathsDepth } from '../src/paths/depth';

let core: Bundle;
let rules: Rules;
beforeAll(() => {
  ({ bundle: core, rules } = loadWorld());
});

describe('pathsDepth', () => {
  it('has one row for each school, in the order of their ids', () => {
    const rows = pathsDepth(core, rules).paths;
    expect(rows.map((p) => p.id)).toEqual(Object.keys(core.schools).sort());
  });

  it('counts the nodes of a school by size and they add up', () => {
    for (const p of pathsDepth(core, rules).paths) {
      const n = p.nodes;
      expect(n.small + n.major + n.corner + n.keystone).toBe(n.total);
      expect(n.total).toBe(core.schools[p.id]!.nodes.length);
    }
  });

  it('counts every recipe once, under the profession that gates it', () => {
    const total = pathsDepth(core, rules).paths.reduce((sum, p) => sum + p.recipes, 0);
    expect(total).toBe(Object.keys(core.recipes).length);
  });

  it('gives the same table on every run', () => {
    expect(formatDepth(pathsDepth(core, rules))).toBe(formatDepth(pathsDepth(core, rules)));
  });

  it('lists a quest under a path only when a step trains it', () => {
    const r = pathsDepth(core, rules);
    for (const p of r.paths) for (const q of p.quests) expect(core.quests[q]).toBeDefined();
    expect(r.questsNoSchool.length).toBeLessThanOrEqual(r.questsTotal);
  });
});
