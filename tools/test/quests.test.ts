/**
 * The hand (tools/src/quests/hand.ts): which two quests of one type a player
 * can finish back to back by choice, and how many tasks a character holds at once.
 */
import { type Bundle, type State, questSatisfied } from '@game/kernel';
import { QUEST_TYPES } from '@game/schema';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { handOf, hands, typeCounts } from '../src/quests/hand';

type Q = { type?: string; requires?: string[]; pocket?: string; giver?: string; steps?: unknown[] };

/** The quests and the wake pockets, and the few things the items orders read: all the hand reads. */
function world(quests: Record<string, Q>, things: Record<string, Record<string, object>> = {}): Bundle {
  return {
    quests: Object.fromEntries(Object.entries(quests).map(([id, q]) => [id, { id, steps: [], reward: { rep: 0 }, ...q }])),
    pockets: { a: { id: 'a', ground: [] }, b: { id: 'b', ground: [] } },
    items: {},
    resources: {},
    treasures: {},
    recipes: {},
    shops: {},
    expeditions: {},
    restores: {},
    camps: {},
    ...things,
  } as unknown as Bundle;
}

/** The slid bank's morning in small: a dig that finds the only axe, a fire whose logs only an axe fells, a town after the fire. */
const morning = (things: Record<string, Record<string, object>> = {}) =>
  world(
    {
      dig: { type: 'discovery', pocket: 'a', steps: [{ kind: 'find', item: 'axe', clue: '.' }] },
      fire: { type: 'mastery', steps: [{ kind: 'build', camp: 'campfire' }] },
      town: { type: 'discovery', requires: ['fire'], steps: [{ kind: 'visit', slot: 'square' }] },
    },
    {
      items: { axe: { tool: { kind: 'axe', tier: 1 } }, log: {} },
      resources: { oak: { output: 'log', tool: 'axe' } },
      camps: { campfire: { inputs: [{ item: 'log', qty: 2 }] } },
      ...things,
    },
  );

describe('the hand', () => {
  it('names two of one type that can be open at once, in either order', () => {
    const h = handOf(world({ root: { type: 'skill' }, x: { type: 'riddle', requires: ['root'] }, y: { type: 'riddle', requires: ['root'] } }), 'a');
    expect(h.same).toEqual([{ type: 'riddle', first: 'x', then: 'y', how: 'open' }]);
    expect(h.widest).toBe(2);
  });

  it('marks a pair along a direct requires link, the case the check refuses', () => {
    const h = handOf(world({ x: { type: 'maze' }, y: { type: 'maze', requires: ['x'] } }), 'a');
    expect(h.same).toEqual([{ type: 'maze', first: 'x', then: 'y', how: 'requires' }]);
    expect(h.widest).toBe(1);
  });

  it('finds nothing when another quest must come between', () => {
    const chain = world({ x: { type: 'maze' }, m: { type: 'skill', requires: ['x'] }, y: { type: 'maze', requires: ['m'] } });
    expect(handOf(chain, 'a').same).toEqual([]);
    // y names x directly, but also needs m, which needs x: m always comes between
    const both = world({ x: { type: 'maze' }, m: { type: 'skill', requires: ['x'] }, y: { type: 'maze', requires: ['x', 'm'] } });
    expect(handOf(both, 'a').same).toEqual([]);
  });

  it("leaves out another pocket's own quests and what only they open", () => {
    const w = world({
      mine: { type: 'discovery', pocket: 'a' },
      theirs: { type: 'discovery', pocket: 'b' },
      after: { type: 'riddle', requires: ['theirs'] },
      open: { type: 'discovery' },
    });
    const h = handOf(w, 'a');
    expect(h.quests).toEqual(['mine', 'open']);
    expect(h.same).toEqual([{ type: 'discovery', first: 'mine', then: 'open', how: 'open' }]);
  });

  it('reads a find with no giver as done before what needs its item, or the one tool that gathers it', () => {
    // the dig is done the moment an axe comes, and the fire needs logs only an axe fells: the fire comes between
    expect(handOf(morning(), 'a').same).toEqual([]);
    // the axe could be dug and the fire built in either order, but the town waits for the fire either way
    expect(handOf(morning(), 'a').widest).toBe(2);
    // logs sold at a stall need no axe: the dig can wait for the town
    const sold = morning({ shops: { stall: { sells: [{ item: 'log', price_mg: 1000 }] } } });
    expect(handOf(sold, 'a').same).toEqual([{ type: 'discovery', first: 'dig', then: 'town', how: 'open' }]);
    // a second kind of axe: the fire no longer needs this one
    const two = morning({ items: { axe: { tool: { kind: 'axe', tier: 1 } }, 'stone-axe': { tool: { kind: 'axe', tier: 1 } }, log: {} } });
    expect(handOf(two, 'a').same).toEqual([{ type: 'discovery', first: 'dig', then: 'town', how: 'open' }]);
  });

  it('rests on the kernel: a find with no giver is met once the item was ever in the bag, however it came', () => {
    const b = { quests: { dig: { id: 'dig', steps: [{ kind: 'find', item: 'axe', clue: '.' }] } } } as unknown as Bundle;
    const s = { player: { journal: ['axe'], bag: {} } } as unknown as State;
    expect(questSatisfied(b, s, 'dig')).toBe(true);
  });

  it('reads a node that opens after a quest as holding back what needs what only it gives', () => {
    const bridge = (shops: Record<string, object> = {}) =>
      world(
        {
          glint: { type: 'investigation', pocket: 'a', steps: [{ kind: 'find', item: 'axe', clue: '.' }] },
          mend: { type: 'skill', steps: [{ kind: 'restore', restore: 'bridge' }] },
          herbs: { type: 'investigation', giver: 'pell', requires: ['mend'], steps: [{ kind: 'visit', slot: 'bank' }] },
        },
        {
          resources: { key: { output: 'keystone', opens_after: [{ quest: 'glint' }] } },
          restores: { bridge: { inputs: [{ item: 'keystone', qty: 1 }] } },
          shops,
        },
      );
    expect(handOf(bridge(), 'a').same).toEqual([]);
    // a keystone at a stall opens no later than the glint
    const sold = bridge({ stall: { sells: [{ item: 'keystone', price_mg: 1000 }] } });
    expect(handOf(sold, 'a').same).toEqual([{ type: 'investigation', first: 'glint', then: 'herbs', how: 'open' }]);
  });

  it('marks a pair where the second needs what the first opens, and nothing comes between', () => {
    const w = world(
      {
        glint: { type: 'investigation', pocket: 'a', steps: [{ kind: 'find', item: 'axe', clue: '.' }] },
        mend: { type: 'investigation', giver: 'pell', steps: [{ kind: 'restore', restore: 'bridge' }] },
      },
      { resources: { key: { output: 'keystone', opens_after: [{ quest: 'glint' }] } }, restores: { bridge: { inputs: [{ item: 'keystone', qty: 1 }] } } },
    );
    expect(handOf(w, 'a').same).toEqual([{ type: 'investigation', first: 'glint', then: 'mend', how: 'needs' }]);
    // both can be open at once: the mend is offered before the glint is done
    expect(handOf(w, 'a').widest).toBe(2);
    // a character never offered the glint strikes the keystone as ever
    expect(handOf(w, 'b').same).toEqual([]);
  });

  it('counts the widest hand as the largest set no requires link orders', () => {
    const w = world({
      r: { type: 'skill' },
      p: { type: 'riddle', requires: ['r'] },
      q: { type: 'maze', requires: ['r'] },
      s: { type: 'tending', requires: ['r'] },
      t: { type: 'stealth', requires: ['p', 'q'] },
    });
    expect(handOf(w, 'a').widest).toBe(3);
  });

  it('reads the core content for every wake pocket', () => {
    const b = runCheck().assembled.bundle!;
    const all = hands(b);
    expect(all.map((h) => h.pocket)).toEqual(Object.keys(b.pockets).sort());
    for (const h of all) {
      expect(h.widest).toBeGreaterThan(0);
      expect(h.same.filter((s) => s.how === 'requires')).toEqual([]);
    }
    const t = typeCounts(b, QUEST_TYPES);
    expect(t.used.reduce((n, [, k]) => n + k, 0)).toBe(Object.keys(b.quests).length);
  });
});
