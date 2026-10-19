import { describe, expect, test } from 'vitest';

import { newState, step } from '@game/kernel';

import { activeQuests } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

const bundle = loadBundle();
const STARTERS = ['core/forager', 'core/digger', 'core/explorer'];

describe('the waking box (OPENING_REVIEW criterion 7)', () => {
  test.each(STARTERS)('%s wakes in one box of two lines of at most 80 characters, the first on the mist', (id) => {
    const lines = bundle.starters[id]!.intro!;
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length <= 80)).toBe(true);
    expect(lines[0]).toContain('mist');
  });

  test.each(STARTERS)('%s has the bridge task in the tracker from the wake, so the lines need not name it', (id) => {
    const r = step(bundle, newState(bundle, 1), { t: 'start', starter: id, name: 'Tess' }, 0);
    if (!r.ok) throw new Error(r.error);
    expect(activeQuests(bundle, r.state)).toContain('core/fix-the-bridge');
  });
});
