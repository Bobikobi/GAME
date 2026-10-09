/**
 * Tools and stations of the workshop (DECISIONS.md, 2026-10-09: the crafting
 * economy): a tool with no uses lasts, a tool sells for the share of its uses
 * left, a made good sells for the made share (CR-18), and of two parts that
 * work one station the one the player stands at does the craft.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type Rect,
  type State,
  type StepResult,
  campTile,
  computeValues,
  minChargeFor,
  mulDiv,
  near,
  newState,
  npcTile,
  payFor,
  recipeTier,
  salePrice,
  step,
} from '@game/kernel';

import { type Tile, bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
let trader: string;

beforeAll(() => {
  b = loadBundle();
  trader = Object.keys(b.npcs)
    .sort()
    .find((id) => {
      const shop = b.npcs[id]!.shop;
      return shop !== undefined && b.shops[shop]?.buys;
    })!;
});

/** A fresh forager with these things in the bag. */
function started(bag: Record<string, number>, bundle = b): State {
  const r = step(bundle, newState(bundle, 1), { t: 'start', starter: 'core/forager', name: 'Maker' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.attrs.carry = 100;
  r.state.player.restored = ['core/old-bridge'];
  Object.assign(r.state.player.bag, bag);
  return r.state;
}

const act = (s: State, a: Action, bundle = b): StepResult => step(bundle, s, a, Math.max(s.tick, s.player.busyUntil));
function ok(s: State, a: Action, bundle = b): Extract<StepResult, { ok: true }> {
  const r = act(s, a, bundle);
  if (!r.ok) throw new Error(r.error);
  return r;
}

const spot = (tile: readonly [number, number]): Rect => ({ x: tile[0], y: tile[1], w: 1, h: 1 });
function beside(s: State, tile: readonly [number, number], bundle = b): Tile {
  return bfsNear(bundle, s.player, s.player.at, spot(tile))!.at(-1)!;
}

/** Gathers the wild herbs this many times, one node after another, waiting for each to grow back; the herbs leave the bag. */
function gatherHerbs(start: State, times: number): { state: State; events: GameEvent[] } {
  const herb = b.resources['core/wild-herbs']!.output;
  const nodes = Object.entries(b.instances)
    .filter(([, i]) => i.source === 'core/wild-herbs')
    .sort(([x], [y]) => (x < y ? -1 : 1));
  const events: GameEvent[] = [];
  let s = start;
  for (let i = 0; i < times; i++) {
    const [node, instance] = nodes[i % nodes.length]!;
    const tick = Math.max(s.tick, s.player.busyUntil, s.nodes[node]?.readyAt ?? 0);
    const r = step(b, s, { t: 'gather', node, grade: 3, at: beside(s, [instance.x, instance.y]) }, tick);
    if (!r.ok) throw new Error(r.error);
    events.push(...r.events);
    s = r.state;
    delete s.player.bag[herb];
  }
  return { state: s, events };
}

describe('a lasting tool', () => {
  test('a basket with uses breaks at its last use, and its uses leave with it', () => {
    const uses = b.items['core/basket']!.tool!.uses!;
    const worn = gatherHerbs(started({ 'core/basket': 1 }), uses - 1);
    expect(worn.events.filter((e) => e.e === 'tool_broke')).toEqual([]);
    expect(worn.state.player.wear['core/basket']).toBe(uses - 1);
    const last = gatherHerbs(worn.state, 1);
    expect(last.events).toContainEqual({ e: 'tool_broke', item: 'core/basket' });
    expect(last.state.player.bag['core/basket']).toBeUndefined();
    expect(last.state.player.wear['core/basket']).toBeUndefined();
  });

  test('one with no uses never breaks: a fine basket outlasts every basket that wears', () => {
    expect(b.items['core/fine-basket']!.tool).toEqual({ kind: 'basket', tier: 3 });
    const uses = Object.values(b.items).flatMap((it) => (it.tool?.kind === 'basket' && it.tool.uses !== undefined ? [it.tool.uses] : []));
    const most = Math.max(...uses);
    const herb = b.resources['core/wild-herbs']!.output;
    const { state, events } = gatherHerbs(started({ 'core/fine-basket': 1 }), most + 1);
    expect(events.filter((e) => e.e === 'tool_broke')).toEqual([]);
    expect(events.filter((e) => e.e === 'gain' && e.item === herb)).toHaveLength(most + 1);
    expect(state.player.bag['core/fine-basket']).toBe(1);
    expect(state.player.wear['core/fine-basket']).toBeUndefined();
  });
});

describe('selling tools', () => {
  /** Sells at the trader; the pay is what salePrice said, and the ledger mints exactly it. */
  function sold(s: State, item: string, qty: number): { state: State; pay: number } {
    const price = salePrice(b, s, item, qty);
    const r = ok(s, { t: 'sell', npc: trader, item, qty, at: beside(s, npcTile(b, trader)!) });
    const pay = r.state.player.gold - s.player.gold;
    expect(pay).toBe(price);
    expect(r.state.ledger.minted - s.ledger.minted).toBe(pay);
    expect(r.state.ledger.burned).toBe(s.ledger.burned);
    expect(r.events).toContainEqual({ e: 'gold', delta: pay });
    return { state: r.state, pay };
  }

  const basket = 'core/reed-basket';
  // a made tool: the trader pays the made share for it (CR-18)
  const each = () => payFor(b.params, b.values[basket]!, true);
  const uses = () => b.items[basket]!.tool!.uses!;

  test('fresh units pay their value each', () => {
    expect(b.made).toContain(basket);
    expect(each()).toBeGreaterThan(0);
    const { state, pay } = sold(started({ [basket]: 3 }), basket, 3);
    expect(pay).toBe(3 * each());
    expect(state.player.bag[basket]).toBeUndefined();
  });

  test('the unit in hand goes last: fewer than all pay in full and keep the wear', () => {
    const used = gatherHerbs(started({ [basket]: 3 }), 7).state;
    expect(used.player.wear[basket]).toBe(7);
    const two = sold(used, basket, 2);
    expect(two.pay).toBe(2 * each());
    expect(two.state.player.bag[basket]).toBe(1);
    expect(two.state.player.wear[basket]).toBe(7);
    // the last unit sells for the share of its uses left
    const last = sold(two.state, basket, 1);
    expect(last.pay).toBe(mulDiv(each(), uses() - 7, uses()));
    expect(last.state.player.bag[basket]).toBeUndefined();
    expect(last.state.player.wear[basket]).toBeUndefined();
  });

  test('every unit at once pays the worn one short, and leaves no wear behind', () => {
    const used = gatherHerbs(started({ [basket]: 3 }), 7).state;
    const all = sold(used, basket, 3);
    expect(all.pay).toBe(each() * 2 + Math.floor((each() * (uses() - 7)) / uses()));
    expect(all.pay).toBeLessThan(3 * each());
    expect(all.state.player.bag[basket]).toBeUndefined();
    expect(all.state.player.wear[basket]).toBeUndefined();
  });

  test('a lasting tool pays in full after any use', () => {
    const used = gatherHerbs(started({ 'core/fine-basket': 2 }), 5).state;
    const { pay } = sold(used, 'core/fine-basket', 2);
    expect(pay).toBe(2 * payFor(b.params, b.values['core/fine-basket']!, true));
  });

  test('a shop tool has no value and is never bought back', () => {
    for (const tool of ['core/basket', 'core/trowel']) {
      expect(b.values[tool]).toBeUndefined();
      const s = started({ [tool]: 1 });
      expect(salePrice(b, s, tool, 1)).toBeUndefined();
      expect(act(s, { t: 'sell', npc: trader, item: tool, qty: 1, at: beside(s, npcTile(b, trader)!) })).toEqual({
        ok: false,
        error: 'The trader does not want that.',
      });
    }
  });
});

describe('made goods (CR-18)', () => {
  test('an item is made when its value comes from a recipe, and the list is sorted', () => {
    const { made, cheapest } = computeValues(b);
    expect(made).toEqual(b.made);
    expect(made).toEqual([...made].sort());
    expect(made).toContain('core/reed-cord');
    expect(made).not.toContain('core/reed');
    for (const id of Object.keys(b.values)) expect(made.includes(id)).toBe(b.recipes[cheapest[id]!] !== undefined);
  });

  test('a recipe that makes an item at a higher cost than gathering does not make it a made good', () => {
    const recipes = {
      ...b.recipes,
      'x/reed-again': {
        ...structuredClone(b.recipes['core/reed-cord']!),
        id: 'x/reed-again',
        inputs: [{ item: 'core/branch', qty: 1 }],
        outputs: [{ item: 'core/reed', qty: 1, share_pct: 100 }],
      },
    };
    const table = computeValues({ ...b, recipes });
    expect(table.values['core/reed']).toBe(b.values['core/reed']);
    expect(table.made).not.toContain('core/reed');
  });

  test('the trader pays the made share for a made good and the raw share for the rest', () => {
    const p = b.params;
    expect(p.k_craft_permille).toBeGreaterThan(p.k_permille);
    const cord = 'core/reed-cord';
    const reed = 'core/reed';
    expect(payFor(p, b.values[cord]!, true)).toBe(mulDiv(p.k_craft_permille * p.r_mg_per_value_ms, b.values[cord]!, 1000));
    expect(payFor(p, b.values[reed]!)).toBe(mulDiv(p.k_permille * p.r_mg_per_value_ms, b.values[reed]!, 1000));
    const s = started({ [cord]: 2, [reed]: 3 });
    expect(salePrice(b, s, cord, 2)).toBe(2 * payFor(p, b.values[cord]!, true));
    expect(salePrice(b, s, reed, 3)).toBe(3 * payFor(p, b.values[reed]!));
    const one = ok(s, { t: 'sell', npc: trader, item: cord, qty: 2, at: beside(s, npcTile(b, trader)!) });
    expect(one.state.player.gold - s.player.gold).toBe(2 * payFor(p, b.values[cord]!, true));
    const two = ok(one.state, { t: 'sell', npc: trader, item: reed, qty: 3, at: beside(one.state, npcTile(b, trader)!) });
    expect(two.state.player.gold - one.state.player.gold).toBe(3 * payFor(p, b.values[reed]!));
    expect(two.state.ledger.minted - s.ledger.minted).toBe(two.state.player.gold - s.player.gold);
  });

  test('the trader never pays as much as the shop charges, for any valued item', () => {
    for (const [id, v] of Object.entries(b.values)) {
      expect(payFor(b.params, v, b.made.includes(id))).toBeLessThan(minChargeFor(b.params, v));
    }
  });
});

describe('two parts that work one station', () => {
  let shelf: Bundle;
  const xpFor = (level: number) => b.professions['core/handcraft']!.xp_levels[level - 2]! * 1000;

  /** The core with a tier-1 rack on the shelf spot that also provides a workshop. */
  beforeAll(() => {
    shelf = structuredClone(b);
    const stone = structuredClone(shelf.camps['core/work-stone']!);
    shelf.camps['x/rack'] = { ...stone, id: 'x/rack', title: 'Rack', slot: 'shelf', provides: 'workshop', tier: 1 };
  });

  function maker(camp: string[], bag: Record<string, number>, level = 1): State {
    const s = started(bag, shelf);
    s.player.camp = camp;
    if (level > 1) s.player.xp['core/handcraft'] = xpFor(level);
    return s;
  }
  const craft = (s: State, recipe: string, at: Tile) => act(s, { t: 'craft', recipe, at }, shelf);

  test('the one the player stands at does the craft', () => {
    const s = maker(['core/work-stone', 'x/rack'], { 'core/reed': 4 });
    const rack = spot(campTile(shelf, 'shelf')!);
    const stone = spot(campTile(shelf, 'workshop')!);
    const at = beside(s, [rack.x, rack.y], shelf);
    expect(near(at, rack)).toBe(true);
    expect(near(at, stone)).toBe(false);
    const r = ok(s, { t: 'craft', recipe: 'core/reed-cord', at }, shelf);
    expect(r.state.player.bag['core/reed-cord']).toBe(1);
    // with only the work stone built, the rack's spot is too far from it
    expect(craft(maker(['core/work-stone'], { 'core/reed': 4 }), 'core/reed-cord', at)).toEqual({ ok: false, error: 'That is too far away.' });
    // next to neither part
    const away = s.player.at;
    expect(near(away, rack) || near(away, stone)).toBe(false);
    expect(craft(s, 'core/reed-cord', away)).toEqual({ ok: false, error: 'That is too far away.' });
  });

  test('a part below the recipe\'s tier does not, wherever the player stands', () => {
    expect(recipeTier(shelf, shelf.recipes['core/woven-mat']!)).toBe(2);
    const s = maker(['core/workbench', 'x/rack'], { 'core/reed-cord': 3, 'core/reed': 4 }, 3);
    const rack = beside(s, campTile(shelf, 'shelf')!, shelf);
    expect(craft(s, 'core/woven-mat', rack)).toEqual({ ok: false, error: 'That is too far away.' });
    const bench = beside(s, campTile(shelf, 'workshop')!, shelf);
    expect(ok(s, { t: 'craft', recipe: 'core/woven-mat', at: bench }, shelf).state.player.tries['core/woven-mat']).toBe(1);
    // a tier-1 craft at the rack still works with the workbench built elsewhere
    expect(ok(s, { t: 'craft', recipe: 'core/reed-cord', at: rack }, shelf).state.player.made['core/reed-cord']).toBe(1);
  });
});
