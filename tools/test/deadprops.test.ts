/** A prop that wears the look of a node but is not one gets an error (owner, 10.10: no dead props). */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkDeadProps } from '../src/deadprops';

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

describe('dead props', () => {
  it('every tree and log of the valley can be worked', () => {
    expect(checkDeadProps(base, {})).toEqual([]);
  });

  it('a scenery oak, stump or lying log is named', () => {
    for (const sprite of ['core/base-kit:props/tree_oak', 'core/base-kit:props/stump', 'core/base-kit:props/log_fallen']) {
      const b = structuredClone(base);
      b.map.props = [...b.map.props, { sprite, x: 1, y: 1, w: 1, h: 1, solid: false }];
      const issues = checkDeadProps(b, {});
      expect(issues, sprite).toHaveLength(1);
      expect(issues[0]!.message).toContain(sprite);
    }
  });

  it('a prop with a scenery look passes', () => {
    const b = structuredClone(base);
    b.map.props = [...b.map.props, { sprite: 'core/base-kit:props/dead_tree', x: 1, y: 1, w: 1, h: 1, solid: true }];
    expect(checkDeadProps(b, {})).toEqual([]);
  });

  it('a scatter slot with no node is named', () => {
    const b = structuredClone(base);
    const slot = b.map.slots.find((s) => s.id === 'core/lone-oak-1')!;
    for (const [k, n] of Object.entries(b.instances)) if (n.x === slot.x && n.y === slot.y) delete b.instances[k];
    const issues = checkDeadProps(b, {});
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('core/lone-oak-1');
  });
});
