import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, newState, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

const start = (name: string) => step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name }, 0);

describe('the name carved at the bridge', () => {
  test('a character can start with no name', () => {
    const r = start('');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.player.name).toBe('');
  });

  test('a later action sets it, once', () => {
    const r = start('');
    if (!r.ok) throw new Error(r.error);
    const c = step(b, r.state, { t: 'carve', name: 'Tess' }, 1);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.state.player.name).toBe('Tess');
    expect(step(b, c.state, { t: 'carve', name: 'Other' }, 2)).toEqual({ ok: false, error: 'The name is already carved.' });
  });

  test('a name typed at the start is kept, and a bad name is still refused', () => {
    const r = start('Tess');
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.name).toBe('Tess');
    expect(step(b, r.state, { t: 'carve', name: 'Other' }, 1).ok).toBe(false);
    expect(start('no!').ok).toBe(false);
    const empty = start('');
    if (!empty.ok) throw new Error(empty.error);
    expect(step(b, empty.state, { t: 'carve', name: 'x'.repeat(17) }, 1).ok).toBe(false);
  });

  test('before a character is chosen there is nothing to carve', () => {
    expect(step(b, newState(b, 7), { t: 'carve', name: 'Tess' }, 0).ok).toBe(false);
  });
});
