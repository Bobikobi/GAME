/**
 * A solid node (a tree) must never wall the map (DECISIONS.md, 2026-10-10):
 * the core content passes with no line, and a tree planted in front of the
 * bridge gets an error that names the tree and the places it cuts off.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, makeWalkable } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkReach } from '../src/reach';

let bundle: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  bundle = found;
});

describe('solid nodes and the road', () => {
  it('the oaks of the core content close no road', () => {
    expect(checkReach(bundle, {})).toEqual([]);
  });

  it('a tree in front of the bridge cuts off the far bank, and the error names it', () => {
    const view = { restored: [] as string[], camp: [] as string[] };
    // the bridge is two rows wide: one tree before each row
    expect(makeWalkable(bundle)(12, 17, view), 'the tile before the bridge must be open ground').toBe(true);
    expect(makeWalkable(bundle)(12, 18, view), 'the tile before the bridge must be open ground').toBe(true);
    const walled: Bundle = {
      ...bundle,
      instances: {
        ...bundle.instances,
        'core/oak-trees#wall': { source: 'core/oak-trees', kind: 'resource', x: 12, y: 17 },
        'core/oak-trees#wall2': { source: 'core/oak-trees', kind: 'resource', x: 12, y: 18 },
      },
    };
    const issues = checkReach(walled, { 'core/oak-trees': 'content/core/resources/oak-trees.json' });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
    expect(issues[0]!.file).toBe('content/core/resources/oak-trees.json');
    expect(issues[0]!.message).toContain('core/oak-trees stands in the way');
    expect(issues[0]!.message).toContain('"core/camp"');
  });

  it('a start that is already walled without any tree is not blamed on the trees', () => {
    const sealed: Bundle = { ...bundle, restores: {} };
    expect(checkReach(sealed, {})).toEqual([]);
  });
});
