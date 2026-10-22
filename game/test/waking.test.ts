import { describe, expect, test } from 'vitest';

import { newState, step } from '@game/kernel';

import { activeQuests } from '../src/text';
import { loadBundle, seedFor } from '../../tools/test/helpers/world';

const bundle = loadBundle();
const POCKETS = ['core/west-bank', 'core/slid-bank', 'core/north-meadow'];

describe('the waking box (OPENING_REVIEW criterion 7)', () => {
  test.each(POCKETS)('%s wakes in one box of two lines of at most 80 characters, the first on the mist', (id) => {
    const lines = bundle.pockets[id]!.intro!;
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length <= 80)).toBe(true);
    expect(lines[0]).toContain('mist');
  });

  test.each(POCKETS)('%s has the bridge task in the tracker from the wake, so the lines need not name it', (id) => {
    const r = step(bundle, newState(bundle, seedFor(bundle, id)), { t: 'start', race: 'core/elf', name: 'Tess' }, 0);
    if (!r.ok) throw new Error(r.error);
    expect(activeQuests(bundle, r.state)).toContain('core/fix-the-bridge');
  });
});
