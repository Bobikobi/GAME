/** A save from older content, brought to today's (kernel/src/adapt.ts): the phone and the server run the same rule. */
import { beforeAll, describe, expect, test } from 'vitest';

import { KERNEL_VERSION, adaptState, newState, serialize, step, type Bundle, type State } from '../src';
import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

function olderWorld(): State {
  const result = step(b, newState(b, 17), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!result.ok) throw new Error(result.error);
  const state = result.state;
  state.content = 'an-older-world';
  state.kernel = '0.0.1';
  state.player.bag['core/no-longer-made'] = 3;
  state.player.journal = [...state.player.journal, 'core/no-longer-made'];
  return state;
}

describe('adaptState', () => {
  test('keeps what still exists, drops what left the content, and takes the bundle tag and the kernel version', () => {
    const saved = olderWorld();
    const adapted = adaptState(b, saved)!;
    expect(adapted.content).toBe(b.tag);
    expect(adapted.kernel).toBe(KERNEL_VERSION);
    expect(adapted.player.bag['core/no-longer-made']).toBeUndefined();
    expect(adapted.player.journal).not.toContain('core/no-longer-made');
    for (const [item, qty] of Object.entries(saved.player.bag)) if (item in b.items) expect(adapted.player.bag[item]).toBe(qty);
    expect(adapted.player.gold).toBe(saved.player.gold);
    // the adapted state plays: step refuses only a state of other content
    expect(step(b, saved, { t: 'eat', item: 'core/berry' }, saved.tick + 1)).toMatchObject({ ok: false, error: 'This save belongs to different game content.' });
    const played = step(b, adapted, { t: 'eat', item: 'core/berry' }, adapted.tick + 1);
    expect(played.ok ? '' : played.error).not.toBe('This save belongs to different game content.');
  });

  test('is pure: the saved state is left as it was', () => {
    const saved = olderWorld();
    const before = serialize(saved);
    adaptState(b, saved);
    expect(serialize(saved)).toBe(before);
  });

  test('gives up on a character whose race left the content', () => {
    const saved = olderWorld();
    saved.player.race = 'core/a-race-that-left';
    expect(adaptState(b, saved)).toBeUndefined();
  });
});
