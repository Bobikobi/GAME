/**
 * A clothing set drawn whole on the figure (public #772): the player's walk sheet is the set's own drawing
 * (`chars/human_reed-walker_down`) when every piece of the set is worn, and the bare figure's sheet otherwise.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle } from '@game/kernel';
import { setSheetsOn, wornSetSheet } from '../src/walking';
import { loadBundle } from '../../tools/test/helpers/world';

const BARE = 'core/base-kit:chars/human_down';
const SET = 'core/base-kit:chars/human_reed-walker_down';
const state = (worn: Record<string, string>) => ({ player: { worn } }) as never;
const ON = '?sets=1';
const has = (...keys: string[]) => (k: string) => keys.includes(k);

let bundle: Bundle;
beforeAll(() => {
  bundle = loadBundle();
});

describe('the switch', () => {
  const worn = { head: 'core/reed-hat', feet: 'core/reed-sandals' };
  test('off by default: the whole set worn still walks with the race sheet', () => {
    expect(setSheetsOn('')).toBe(false);
    expect(setSheetsOn('?sets=0')).toBe(false);
    expect(wornSetSheet(bundle, state(worn), BARE, has(BARE, SET), '')).toBe(BARE);
  });
  test('?sets=1 walks with the set sheet', () => {
    expect(setSheetsOn('?sets=1')).toBe(true);
    expect(wornSetSheet(bundle, state(worn), BARE, has(BARE, SET), '?sets=1')).toBe(SET);
  });
});

describe('wornSetSheet (switch on)', () => {
  test('the whole set worn: the set sheet of the same race and view', () => {
    const worn = { head: 'core/reed-hat', feet: 'core/reed-sandals' };
    expect(wornSetSheet(bundle, state(worn), BARE, has(BARE, SET), ON)).toBe(SET);
    expect(wornSetSheet(bundle, state(worn), BARE.replace('_down', '_up'), has(SET.replace('_down', '_up'), ON))).toBe(BARE.replace('_down', '_up'));
  });
  test('one piece, or none: the bare figure', () => {
    expect(wornSetSheet(bundle, state({ head: 'core/reed-hat' }), BARE, has(BARE, SET), ON)).toBe(BARE);
    expect(wornSetSheet(bundle, state({}), BARE, has(BARE, SET), ON)).toBe(BARE);
  });
  test('a set with no drawing for this race: the bare figure', () => {
    const worn = { head: 'core/reed-hat', feet: 'core/reed-sandals' };
    expect(wornSetSheet(bundle, state(worn), BARE, has(BARE), ON)).toBe(BARE);
  });
  test('a look with no set drawing (the alt build): the bare figure', () => {
    const worn = { head: 'core/reed-hat', feet: 'core/reed-sandals' };
    expect(wornSetSheet(bundle, state(worn), 'core/base-kit:chars/human_w_down', has(SET), ON)).toBe('core/base-kit:chars/human_w_down');
  });
});
