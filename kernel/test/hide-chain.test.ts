/**
 * The tier-1 hide chain (docs/design/CLOTHING.md, appendix "For the take verb"; #769): a raw hide is scraped, tanned
 * with a herb and sewn with sinew thread into a hood, a jerkin, leggings and shoes. The whole chain waits for the
 * fight (gate "combat": nothing but a hunt lays a hide in a player's hands), only the worn pieces are of the `wear`
 * family, and a run from a hare and a roe to a worn pair of shoes works end to end once the gate is open.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, campTile, effectValue, makeWalkable, near, newState, recipeOpen, startRecipes, step, wornValue } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const STEPS = [
  'core/scrape-hare-hide',
  'core/scrape-roe-hide',
  'core/tan-hare-leather',
  'core/tan-hare-fur',
  'core/tan-roe-leather',
  'core/sinew-thread',
];
const WORN = ['core/hare-fur-hood', 'core/roe-leather-jerkin', 'core/roe-leather-leggings', 'core/hare-leather-shoes'];

let shut: Bundle;
let open: Bundle;

beforeAll(() => {
  shut = loadBundle();
  open = structuredClone(shut);
  open.params.combat.enabled = 1;
});

function started(b: Bundle): State {
  const r = step(b, newState(b, 5), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** One craft at the work stone: the player stands on a walkable tile beside it, and the clock moves past the last action. */
function craft(b: Bundle, s: State, recipe: string): State {
  const tile = campTile(b, 'workshop')!;
  const target = { x: tile[0], y: tile[1], w: 1, h: 1 };
  const walkable = makeWalkable(b);
  let at: [number, number] | undefined;
  for (let y = target.y - 1; y <= target.y + 1 && !at; y++) {
    for (let x = target.x - 1; x <= target.x + 1; x++) {
      if (near([x, y], target) && walkable(x, y, s.player)) {
        at = [x, y];
        break;
      }
    }
  }
  if (!at) throw new Error('no walkable tile beside the work stone');
  s.player.at = at;
  const r = step(b, s, { t: 'craft', recipe, at }, Math.max(s.tick, s.player.busyUntil));
  if (!r.ok) throw new Error(`${recipe}: ${r.error}`);
  return r.state;
}

describe('the tier-1 hide chain', () => {
  test('every step waits behind the combat gate and is known from the start once it opens', () => {
    for (const id of [...STEPS, ...WORN]) {
      expect(shut.recipes[id], id).toMatchObject({ known: 'start', gate: 'combat', station: 'workshop' });
      expect(recipeOpen(shut, shut.recipes[id]!), id).toBe(false);
      expect(recipeOpen(open, open.recipes[id]!), id).toBe(true);
      expect(startRecipes(shut)).not.toContain(id);
      expect(startRecipes(open)).toContain(id);
    }
  });

  test('only the worn pieces are of the wear family; the hide steps and the thread have none', () => {
    for (const id of WORN) expect(shut.recipes[id]!.family, id).toBe('wear');
    for (const id of STEPS) expect(shut.recipes[id]!.family, id).toBeUndefined();
  });

  test('the raw hides carry their animal as family, leather and fur are garment classes', () => {
    expect(shut.items['core/hare-hide']).toMatchObject({ class: 'core/hide', family: 'hare' });
    expect(shut.items['core/roe-hide']).toMatchObject({ class: 'core/hide', family: 'roe' });
    expect(shut.items['core/wolf-hide']).toMatchObject({ class: 'core/hide', family: 'wolf' });
    expect(shut.items['core/hare-fur']).toMatchObject({ class: 'core/hide', family: 'hare', tags: ['tanned', 'fur'] });
    expect(shut.items['core/hare-fur-hood']).toMatchObject({ class: 'core/fur', family: 'hare' });
    for (const id of ['core/roe-leather-jerkin', 'core/roe-leather-leggings', 'core/hare-leather-shoes']) {
      expect(shut.items[id]!.class, id).toBe('core/leather');
    }
  });

  test('gate off: a new player knows none of it, and the core ships the switch off', () => {
    expect(shut.params.combat.enabled).toBe(0);
    const s = started(shut);
    for (const id of [...STEPS, ...WORN]) expect(s.player.recipes, id).not.toContain(id);
  });

  test('gate on: from a hare and a roe to a worn pair of shoes, and the other three pieces beside them', () => {
    const s = started(open);
    for (const id of [...STEPS, ...WORN]) expect(s.player.recipes, id).toContain(id);
    s.player.camp = [...new Set([...s.player.camp, 'core/work-stone'])];
    s.player.xp['core/handcraft'] = 1_000_000_000;
    Object.assign(s.player.bag, {
      'core/hare-hide': 2,
      'core/roe-hide': 2,
      'core/roe-sinew': 3,
      'core/stone-flakes': 4,
      'core/herb': 4,
    });
    let t = s;
    for (const id of [
      'core/scrape-hare-hide',
      'core/scrape-hare-hide',
      'core/scrape-roe-hide',
      'core/scrape-roe-hide',
      'core/tan-hare-leather',
      'core/tan-hare-fur',
      'core/tan-roe-leather',
      'core/tan-roe-leather',
      'core/sinew-thread',
      'core/sinew-thread',
      'core/sinew-thread',
      'core/hare-leather-shoes',
      'core/hare-fur-hood',
      'core/roe-leather-jerkin',
      'core/roe-leather-leggings',
    ]) {
      t = craft(open, t, id);
    }
    for (const id of WORN) expect(t.player.bag[id], id).toBe(1);
    // the hides are all spent, and so is the thread (3 sinew make 6: 1 + 1 + 2 + 2)
    expect(t.player.bag['core/sinew-thread'] ?? 0).toBe(0);
    expect(t.player.bag['core/hare-hide'] ?? 0).toBe(0);
    expect(t.player.bag['core/roe-hide'] ?? 0).toBe(0);
    const on = step(open, t, { t: 'wear', item: 'core/hare-leather-shoes' }, Math.max(t.tick, t.player.busyUntil));
    if (!on.ok) throw new Error(on.error);
    expect(on.state.player.worn.feet).toBe('core/hare-leather-shoes');
    expect(wornValue(open, on.state, 'dig_speed_pct')).toBe(5);
    expect(effectValue(open, on.state, 'dig_speed_pct')).toBeGreaterThanOrEqual(5);

    const hood = step(open, on.state, { t: 'wear', item: 'core/hare-fur-hood' }, on.state.tick);
    if (!hood.ok) throw new Error(hood.error);
    expect(hood.state.player.worn.head).toBe('core/hare-fur-hood');
    expect(wornValue(open, hood.state, 'craft_speed_pct')).toBe(5);
  });
});
