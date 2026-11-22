/**
 * The wear and tools groups of Handcraft (SKILL_FAMILIES 2.2, CLOTHING 6.1; #769): each family has two small nodes, a
 * speed and then a chance, and each reaches only the recipes of its own family, on the real content.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, effectValue, newState, nodeKey, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const HAND = 'core/handcraft';
let b: Bundle;
let school: string;

beforeAll(() => {
  b = loadBundle();
  school = Object.entries(b.schools).find(([, sc]) => sc.profession === HAND)![0];
});

function started(nodes: string[]): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.nodes = nodes.map((n) => nodeKey(school, n));
  return r.state;
}

const GROUPS = {
  wear: ['quick-seams', 'steady-needle'],
  tools: ['deft-grip', 'sure-edge'],
} as const;

describe('the wear and tools groups', () => {
  test('each family has a speed node and then a chance node, both 5, the first hanging from careful-work', () => {
    const nodes = b.schools[school]!.nodes;
    for (const [family, [speed, chance]] of Object.entries(GROUPS)) {
      const group = nodes.filter((n) => n.family === family);
      expect(group.map((n) => n.id)).toEqual([speed, chance]);
      expect(group[0]).toMatchObject({ size: 'small', effect: 'craft_speed_pct', value: 5, needs: ['careful-work'] });
      expect(group[1]).toMatchObject({ size: 'small', effect: 'craft_chance_pct', value: 5, needs: [speed] });
    }
  });

  test('a node of one family moves its own family and no other', () => {
    const none = started([]);
    const base = (fam?: string) => effectValue(b, none, 'craft_speed_pct', HAND, fam);
    for (const [family, [speed]] of Object.entries(GROUPS)) {
      const s = started([speed!]);
      const other = family === 'wear' ? 'tools' : 'wear';
      expect(effectValue(b, s, 'craft_speed_pct', HAND, family), family).toBe(base(family) + 5);
      expect(effectValue(b, s, 'craft_speed_pct', HAND, other), family).toBe(base(other));
      expect(effectValue(b, s, 'craft_speed_pct', HAND), family).toBe(base());
    }
  });

  test('the built pieces carry the family their node reaches: the satchel and the charm wear, the stone and reed tools tools', () => {
    for (const id of ['core/satchel', 'core/lucky-charm', 'core/reed-hat', 'core/reed-sandals', 'core/woven-reed-coat']) expect(b.recipes[id]!.family, id).toBe('wear');
    for (const id of ['core/hammerstone', 'core/fishing-rod', 'core/knapped-pick', 'core/flint-trowel', 'core/reed-basket', 'core/stone-trowel', 'core/fine-basket']) {
      expect(b.recipes[id]!.family, id).toBe('tools');
    }
    // the goods other recipes use, the bandage and the dishes belong to no family
    for (const id of ['core/reed-cord', 'core/stone-flakes', 'core/woven-mat', 'core/stone-blade', 'core/bandage', 'core/herb-tea']) expect(b.recipes[id]!.family, id).toBeUndefined();
  });

  test('a school sees at most nodes_max nodes of one race, and the two groups fit', () => {
    expect(b.params.growth!.nodes_max).toBe(20);
    const nodes = b.schools[school]!.nodes;
    for (const race of Object.keys(b.races)) {
      const seen = nodes.filter((n) => n.size !== 'corner' || n.race === race).length;
      expect(seen, race).toBeLessThanOrEqual(20);
    }
  });
});
