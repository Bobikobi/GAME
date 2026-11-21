/** The character's look: the second look a race has, and a look it does not. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, newState, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

function raced(seed: number, race: string, look?: number): State {
  const result = step(bundle, newState(bundle, seed), { t: 'start', race, name: 'Tester', look }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('the look', () => {
  test('defaults to the first look and keeps the second when the race has one', () => {
    expect(raced(1, 'core/elf').player.look).toBe(0);
    const withAlt = Object.values(bundle.races).find((r) => r.sprite_alt);
    if (withAlt) expect(raced(1, withAlt.id, 1).player.look).toBe(1);
  });

  test('refuses a look the race does not have', () => {
    const result = step(bundle, newState(bundle, 1), { t: 'start', race: 'core/elf', name: 'Tester', look: 2 }, 0);
    expect(result.ok).toBe(false);
    const plain = { ...bundle, races: Object.fromEntries(Object.entries(bundle.races).map(([id, r]) => [id, { ...r, sprite_alt: undefined }])) };
    const second = step(plain, newState(plain, 1), { t: 'start', race: 'core/elf', name: 'Tester', look: 1 }, 0);
    expect(second.ok).toBe(false);
  });
});
