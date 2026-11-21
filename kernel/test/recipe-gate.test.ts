/**
 * A recipe behind a gate, and a family node (CLOTHING 6 and 6.1; #769): a recipe that waits for the fight is known
 * by nobody, taught by nothing and refused at the bench while `combat.enabled` is 0, and a loaded save gains nothing;
 * once the switch is on, a new player and a loaded save both know it. A tree node with a family helps only the
 * recipes of that family, and a node behind the same gate takes no point while it is closed.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, adaptState, effectValue, newState, nodeKey, nodeRefusal, recipeOpen, startRecipes, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const HOOD = 'x/hide-hood';
const SCRAP = 'x/hood-scrap';

/** The core world with one start-known recipe behind the combat gate, and a scrap that names it. */
function gated(enabled: 0 | 1): Bundle {
  const b = structuredClone(loadBundle());
  b.params.combat.enabled = enabled;
  b.recipes[HOOD] = { ...structuredClone(b.recipes['core/reed-hat']!), id: HOOD, title: 'Hide hood', known: 'start', gate: 'combat' };
  b.items[SCRAP] = { ...structuredClone(b.items['core/stew-scrap']!), id: SCRAP, fragment: { unlocks: HOOD } };
  return b;
}

function started(b: Bundle): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('a recipe behind the combat gate', () => {
  let shut: Bundle;
  let open: Bundle;
  beforeAll(() => {
    shut = gated(0);
    open = gated(1);
  });

  test('the core ships the switch off, so the gated recipe is closed', () => {
    expect(loadBundle().params.combat.enabled).toBe(0);
    expect(recipeOpen(shut, shut.recipes[HOOD]!)).toBe(false);
    expect(recipeOpen(open, open.recipes[HOOD]!)).toBe(true);
    expect(recipeOpen(shut, shut.recipes['core/reed-hat']!)).toBe(true);
  });

  test('gate off: a new player does not know it, the bench refuses it and a scrap does not teach it', () => {
    expect(startRecipes(shut)).not.toContain(HOOD);
    const s = started(shut);
    expect(s.player.recipes).not.toContain(HOOD);
    expect(s.player.recipes).toContain('core/reed-hat');
    // a save that holds it anyway (an older build, a hand-made state) is still refused at the bench
    const forced = structuredClone(s);
    forced.player.recipes = [...forced.player.recipes, HOOD].sort();
    expect(step(shut, forced, { t: 'craft', recipe: HOOD, at: forced.player.at }, 1)).toMatchObject({ ok: false, error: 'You do not know this recipe yet.' });
    const holding = structuredClone(s);
    holding.player.bag[SCRAP] = 1;
    const read = step(shut, holding, { t: 'learn', item: SCRAP }, 1);
    expect(read).toMatchObject({ ok: false, error: 'This recipe cannot be learned yet.' });
    // the scrap is kept: a refused read spends nothing
    expect(holding.player.bag[SCRAP]).toBe(1);
  });

  test('gate off: a loaded save gains nothing, neither the recipe nor a journal line', () => {
    const saved = started(loadBundle());
    saved.content = 'an-older-world';
    const adapted = adaptState(shut, saved)!;
    expect(adapted.player.recipes).toEqual(saved.player.recipes);
    // the closed recipe adds nothing: the save comes out exactly as it does in the same world without it
    const plain = structuredClone(shut);
    delete plain.recipes[HOOD];
    expect(adapted.player).toEqual(adaptState(plain, saved)!.player);
  });

  test('gate on: a new player and a loaded save both know it', () => {
    expect(startRecipes(open)).toContain(HOOD);
    expect(started(open).player.recipes).toContain(HOOD);
    const saved = started(shut);
    saved.content = 'an-older-world';
    expect(adaptState(open, saved)!.player.recipes).toContain(HOOD);
  });
});

describe('a family node', () => {
  test('helps only the recipes of its family; a node with no family helps every recipe of its profession', () => {
    const b = structuredClone(loadBundle());
    const school = Object.values(b.schools).find((sc) => sc.profession === 'core/handcraft')!;
    const base = school.nodes.find((n) => n.slot !== true && (n.needs ?? []).length === 0)!;
    school.nodes.push(
      { ...structuredClone(base), id: 'x-wear', effect: 'craft_chance_pct', value: 4, family: 'wear', needs: undefined },
      { ...structuredClone(base), id: 'x-any', effect: 'craft_chance_pct', value: 1, family: undefined, needs: undefined },
    );
    const s = started(b);
    s.player.nodes = [nodeKey(school.id, 'x-wear'), nodeKey(school.id, 'x-any')];
    const hand = 'core/handcraft';
    const before = effectValue(b, started(b), 'craft_chance_pct', hand);
    expect(effectValue(b, s, 'craft_chance_pct', hand, 'wear')).toBe(before + 5);
    expect(effectValue(b, s, 'craft_chance_pct', hand, 'tools')).toBe(before + 1);
    expect(effectValue(b, s, 'craft_chance_pct', hand)).toBe(before + 1);
  });
});

describe('a tree node behind the combat gate', () => {
  /** A handcraft player with points to spend and a gated wear node with no path before it. */
  function setup(enabled: 0 | 1): { b: Bundle; s: State; key: string } {
    const b = gated(enabled);
    const school = Object.values(b.schools).find((sc) => sc.profession === 'core/handcraft')!;
    const base = school.nodes.find((n) => n.slot !== true && (n.needs ?? []).length === 0)!;
    school.nodes.push({ ...structuredClone(base), id: 'x-hide', effect: 'craft_chance_pct', value: 4, family: 'wear', gate: 'combat', needs: undefined });
    const s = started(b);
    const prof = b.professions['core/handcraft']!;
    s.player.xp['core/handcraft'] = prof.xp_levels[prof.xp_levels.length - 1]! * 1000;
    return { b, s, key: nodeKey(school.id, 'x-hide') };
  }

  test('gate off: the node is there and a point cannot be spent on it', () => {
    const { b, s, key } = setup(0);
    expect(nodeRefusal(b, s, key)).toBe('This cannot be learned yet.');
  });

  test('gate on: a point can be spent on it, and it helps only its family', () => {
    const { b, s, key } = setup(1);
    expect(nodeRefusal(b, s, key)).toBeUndefined();
    const before = effectValue(b, s, 'craft_chance_pct', 'core/handcraft', 'wear');
    s.player.nodes = [...(s.player.nodes ?? []), key];
    expect(effectValue(b, s, 'craft_chance_pct', 'core/handcraft', 'wear')).toBe(before + 4);
    expect(effectValue(b, s, 'craft_chance_pct', 'core/handcraft', 'tools')).toBe(effectValue(b, setup(1).s, 'craft_chance_pct', 'core/handcraft', 'tools'));
  });
});
