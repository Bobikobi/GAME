/**
 * The craft gate and the craft chance (G40; DECISIONS.md, 2026-10-09): a
 * recipe asks a station of its tier and trains its own profession, skill
 * decides the chance and luck tilts it, and a miss keeps part of what went in.
 * There is no level wall (CR-17): below the recipe's level the chance falls
 * a step a level, down to nothing, and a try at nothing runs and misses.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type State,
  type StepResult,
  campTile,
  craftChanceBp,
  craftLuckPermille,
  missOutcome,
  mulDiv,
  newState,
  recipeProfession,
  replay,
  serialize,
  step,
} from '@game/kernel';

import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

/** The bundle of the core world with a tier-2 workbench chain, a hearth over the campfire and a carpenter. */
beforeAll(() => {
  b = structuredClone(loadBundle());
  const material = (id: string, tier: number, value: number) => {
    b.items[id] = { ...structuredClone(b.items['core/branch']!), id, name: id, class: 'wood', tier };
    b.values[id] = value;
  };
  const branch = b.values['core/branch']!;
  material('x/plank', 2, branch * 10);
  material('x/board', 2, branch * 8);
  material('x/frame', 2, branch * 30);
  material('x/stool', 1, branch * 3);
  const recipe = (id: string, body: Partial<Bundle['recipes'][string]>) => {
    b.recipes[id] = { ...structuredClone(b.recipes['core/berry-mash']!), id, title: id, known: 'start', ...body };
  };
  const out = (item: string) => [{ item, qty: 1, share_pct: 100 }];
  recipe('x/plank', { level: 3, inputs: [{ item: 'core/branch', qty: 4 }], outputs: out('x/plank') });
  recipe('x/board', {
    level: 3,
    inputs: [{ item: 'core/branch', qty: 3 }],
    outputs: out('x/board'),
    miss: { keep_pct: 70 },
  });
  recipe('x/frame', {
    level: 3,
    inputs: [
      { item: 'core/branch', qty: 2 },
      { item: 'x/plank', qty: 1 },
    ],
    outputs: out('x/frame'),
    miss: { keep_pct: 0 },
  });
  recipe('x/stool', { station: 'workshop', level: 2, inputs: [{ item: 'core/branch', qty: 2 }], outputs: out('x/stool') });
  // far above any level the hearth's cook reaches: every try is a try at nothing
  recipe('x/far', { level: 20, inputs: [{ item: 'core/branch', qty: 4 }], outputs: out('x/plank') });
  const fire = b.camps['core/campfire']!;
  b.camps['x/hearth'] = { ...structuredClone(fire), id: 'x/hearth', title: 'Hearth', tier: 2, upgrades: 'core/campfire' };
  b.camps['x/bench'] = { ...structuredClone(fire), id: 'x/bench', title: 'Bench', slot: 'workshop', provides: 'workshop' };
  b.professions['x/carpentry'] = {
    ...structuredClone(b.professions['core/cooking']!),
    id: 'x/carpentry',
    name: 'Carpentry',
    stations: ['workshop'],
    techniques: [],
  };
  b.stations = { ...b.stations, workshop: 'x/carpentry' };
});

/** Profession experience for a level, or for the last level with no level given. */
function xpFor(profession: string, level?: number): number {
  const steps = b.professions[profession]!.xp_levels;
  if (level === 1) return 0;
  return steps[level === undefined ? steps.length - 1 : level - 2]! * 1000;
}

/** A character at the hearth with cooking at level 3, no luck, and a bag that holds plenty. */
function prepared(seed: number, edit: (s: State) => void = () => {}): State {
  const r = step(b, newState(b, seed), { t: 'start', starter: 'core/forager', name: 'Maker' }, 0);
  if (!r.ok) throw new Error(r.error);
  const s = r.state;
  s.player.attrs.might = 100;
  s.player.attrs.luck = 0;
  s.player.restored = ['core/old-bridge'];
  // the bridge's quest pays gold; closed here, so a craft never settles it and moves the ledger
  s.player.quests['core/fix-the-bridge'] = 'done';
  s.player.bag = { 'core/branch': 40, 'core/berry': 20, 'x/plank': 2 };
  s.player.camp = ['x/hearth'];
  s.player.xp['core/cooking'] = xpFor('core/cooking', 3);
  edit(s);
  return s;
}

function craftAction(s: State, recipe: string): { a: Action; tick: number } {
  const station = b.recipes[recipe]!.station;
  const camps = Object.keys(b.camps).sort();
  const camp = camps.find((id) => s.player.camp.includes(id) && b.camps[id]!.provides === station) ?? camps.find((id) => b.camps[id]!.provides === station)!;
  const tile = campTile(b, b.camps[camp]!.slot)!;
  const at = bfsNear(b, s.player, s.player.at, { x: tile[0], y: tile[1], w: 1, h: 1 })!.at(-1)!;
  return { a: { t: 'craft', recipe, at }, tick: Math.max(s.tick, s.player.busyUntil) };
}

function tryCraft(s: State, recipe: string): StepResult {
  const { a, tick } = craftAction(s, recipe);
  return step(b, s, a, tick);
}

function craft(s: State, recipe: string): Extract<StepResult, { ok: true }> {
  const r = tryCraft(s, recipe);
  if (!r.ok) throw new Error(r.error);
  return r;
}

const missed = (r: Extract<StepResult, { ok: true }>) => r.events.some((e) => e.e === 'miss');

/** The first seed whose first try of a recipe misses. */
function firstMiss(recipe: string): number {
  for (let seed = 1; seed <= 200; seed++) if (missed(craft(prepared(seed), recipe))) return seed;
  throw new Error(`${recipe} never missed in 200 seeds`);
}

describe('the craft gate', () => {
  test('a recipe takes the profession of its station, and needs a station of its tier', () => {
    expect(recipeProfession(b, b.recipes['core/berry-mash']!)).toBe('core/cooking');
    expect(recipeProfession(b, b.recipes['x/stool']!)).toBe('x/carpentry');
    const low = prepared(1, (s) => {
      s.player.camp = ['core/campfire'];
    });
    expect(tryCraft(low, 'x/plank')).toEqual({ ok: false, error: 'This needs a fire of tier 2.' });
    expect(tryCraft(low, 'core/berry-mash').ok).toBe(true);
    expect(tryCraft(prepared(1), 'x/stool')).toEqual({ ok: false, error: 'You need a workshop.' });
  });

  test('a recipe reads the level of its own profession, trains it, and takes only its techniques', () => {
    const s = prepared(1, (s) => {
      s.player.camp = ['x/bench', 'x/hearth'];
      s.player.xp['core/cooking'] = xpFor('core/cooking');
    });
    // a master cook is a carpenter of level 1: the level-2 stool is a step short of a sure craft, and the kernel still lets them try
    expect(craftChanceBp(b, s, 'x/stool')).toBe(10_000 - b.params.craft_level_step_bp);
    expect(tryCraft(s, 'x/stool').ok).toBe(true);
    s.player.xp['x/carpentry'] = xpFor('x/carpentry', 2);
    expect(craftChanceBp(b, s, 'x/stool')).toBe(10_000);
    const r = craft(s, 'x/stool');
    const stool = b.recipes['x/stool']!;
    expect(r.state.player.xp['x/carpentry']).toBe(xpFor('x/carpentry', 2) + stool.active_ms);
    expect(r.state.player.xp['core/cooking']).toBe(xpFor('core/cooking'));
    // the cook's speed technique does not reach the carpenter's bench
    expect(r.events).toContainEqual({ e: 'busy', verb: 'craft', ms: Math.max(b.params.t_min_ms, stool.active_ms) });
    const mash = craft(s, 'core/berry-mash');
    const busy = mash.events.find((e) => e.e === 'busy');
    expect(busy && busy.e === 'busy' && busy.ms).toBeLessThan(b.recipes['core/berry-mash']!.active_ms);
  });
});

describe('the craft chance', () => {
  test('a tier-1 craft at its level never misses', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = prepared(seed, (s) => {
        s.player.camp = ['core/campfire'];
        s.player.xp['core/cooking'] = 0;
      });
      expect(craftChanceBp(b, s, 'core/berry-mash')).toBe(10_000);
      const r = craft(s, 'core/berry-mash');
      expect(missed(r)).toBe(false);
      expect(r.state.player.made['core/berry-mash']).toBe(1);
    }
  });

  test('skill raises the chance a step per level above the recipe, up to a sure craft', () => {
    const at = (level: number) =>
      craftChanceBp(
        b,
        prepared(1, (s) => {
          s.player.xp['core/cooking'] = xpFor('core/cooking', level);
        }),
        'x/plank',
      );
    expect(at(3)).toBe(b.params.craft_chance_bp[1]);
    expect(at(4) - at(3)).toBe(b.params.craft_level_step_bp);
    expect(at(9)).toBe(10_000);
  });

  test('below its level a recipe loses a step of chance for each missing level, down to nothing', () => {
    const at = (level: number, recipe = 'x/plank') =>
      craftChanceBp(
        b,
        prepared(1, (s) => {
          s.player.xp['core/cooking'] = xpFor('core/cooking', level);
        }),
        recipe,
      );
    const base = b.params.craft_chance_bp[1]!;
    const step = b.params.craft_level_step_bp;
    expect(b.recipes['x/plank']!.level).toBe(3);
    expect(at(2)).toBe(base - step);
    expect(at(1)).toBe(base - 2 * step);
    // seventeen levels short of the far recipe: more steps than the chance has
    expect(base - 17 * step).toBeLessThan(0);
    expect(at(3, 'x/far')).toBe(0);
  });

  test('luck closes part of the gap, inside the power cap, and never all of it', () => {
    const lucky = (luck: number, seasoned: boolean) =>
      prepared(1, (s) => {
        s.player.attrs.luck = luck;
        if (seasoned) {
          s.player.xp['core/foraging'] = xpFor('core/foraging');
          s.player.xp['core/digging'] = xpFor('core/digging');
        }
      });
    const plain = craftChanceBp(b, lucky(0, false), 'x/plank');
    // character level 3: the power cap lets 200 permille through
    expect(craftLuckPermille(b, lucky(10, false), 'core/cooking')).toBe(200);
    const most = lucky(10, true);
    expect(craftLuckPermille(b, most, 'core/cooking')).toBe(b.params.craft_luck_max_permille);
    expect(craftChanceBp(b, most, 'x/plank')).toBe(plain + mulDiv(10_000 - plain, b.params.craft_luck_max_permille, 1000));
    expect(craftChanceBp(b, most, 'x/plank')).toBeLessThan(10_000);
  });

  test('misses come about as often as the chance says; a miss keeps half and trains as much', () => {
    const chance = craftChanceBp(b, prepared(1), 'x/plank');
    const gains = new Set<number>();
    let misses = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = prepared(seed);
      const r = craft(s, 'x/plank');
      gains.add(r.state.player.xp['core/cooking']! - s.player.xp['core/cooking']!);
      expect(r.state.player.tries['x/plank']).toBe(1);
      if (missed(r)) {
        misses++;
        expect(r.state.player.bag['core/branch']).toBe(40 - 4 + 2);
        expect(r.state.player.bag['x/plank']).toBe(2);
        expect(r.state.player.made['x/plank']).toBeUndefined();
      } else {
        expect(r.state.player.bag['core/branch']).toBe(36);
        expect(r.state.player.bag['x/plank']).toBe(3);
        expect(r.state.player.made['x/plank']).toBe(1);
      }
    }
    expect(gains.size).toBe(1);
    expect(misses).toBeGreaterThan(0);
    expect(Math.abs(misses / 400 - (10_000 - chance) / 10_000)).toBeLessThan(0.06);
  });

  test('a try at nothing runs and misses every time, keeps its share and trains as much; luck never opens it', () => {
    const luckiest = prepared(1, (s) => {
      s.player.attrs.luck = 10;
      s.player.xp['core/foraging'] = xpFor('core/foraging');
      s.player.xp['core/digging'] = xpFor('core/digging');
    });
    expect(craftLuckPermille(b, luckiest, 'core/cooking')).toBe(b.params.craft_luck_max_permille);
    expect(craftChanceBp(b, luckiest, 'x/far')).toBe(0);
    const far = b.recipes['x/far']!;
    for (let seed = 1; seed <= 50; seed++) {
      const s = prepared(seed);
      const r = craft(s, 'x/far');
      expect(missed(r)).toBe(true);
      expect(r.state.player.bag['core/branch']).toBe(40 - 4 + 2);
      expect(r.state.player.bag['x/plank']).toBe(2);
      expect(r.state.player.made['x/far']).toBeUndefined();
      expect(r.state.player.tries['x/far']).toBe(1);
      expect(r.state.player.xp['core/cooking']! - s.player.xp['core/cooking']!).toBe(far.active_ms);
    }
  });

  test('a miss keeps part of the inputs and makes nothing, and always leaves something', () => {
    expect(missOutcome(b, b.recipes['x/plank']!)).toEqual({ keep: [{ item: 'core/branch', qty: 2 }] });
    expect(missOutcome(b, b.recipes['x/board']!)).toEqual({ keep: [{ item: 'core/branch', qty: 2 }] });
    // the share keeps nothing: one unit of the most valuable input comes back
    expect(missOutcome(b, b.recipes['x/frame']!)).toEqual({
      keep: [
        { item: 'core/branch', qty: 0 },
        { item: 'x/plank', qty: 1 },
      ],
    });
    const board = craft(prepared(firstMiss('x/board')), 'x/board');
    expect(board.state.player.bag['core/branch']).toBe(40 - 3 + 2);
    expect(Object.keys(board.state.player.bag).sort()).toEqual(['core/berry', 'core/branch', 'x/plank']);
    const frame = craft(prepared(firstMiss('x/frame')), 'x/frame');
    expect(frame.state.player.bag['core/branch']).toBe(40 - 2);
    expect(frame.state.player.bag['x/plank']).toBe(2);
  });
});

describe('crafts in a log', () => {
  /** Twenty tries of the plank from one start, and what each try did. */
  function run(seed: number, log?: { a: Action; tick: number }[]) {
    const start = prepared(seed, (s) => {
      s.player.bag['core/branch'] = 99;
    });
    const entries: { a: Action; tick: number }[] = [];
    const outcomes: boolean[] = [];
    let s = structuredClone(start);
    for (let i = 0; i < 20; i++) {
      const entry = log?.[i] ?? craftAction(s, 'x/plank');
      const r = step(b, s, entry.a, entry.tick);
      if (!r.ok) throw new Error(r.error);
      entries.push(entry);
      outcomes.push(missed(r));
      s = r.state;
    }
    return { start, log: entries, end: s, outcomes };
  }

  test('replay to the same state, leave the ledger alone, and change with the seed', () => {
    const one = run(7);
    const again = replay(b, one.start, one.log);
    expect(again.error).toBeUndefined();
    expect(serialize(again.state)).toBe(serialize(one.end));
    expect(one.end.ledger).toEqual(one.start.ledger);
    expect(one.end.player.gold).toBe(one.start.player.gold);
    expect(one.end.player.tries['x/plank']).toBe(20);
    expect(one.end.player.made['x/plank']).toBe(one.outcomes.filter((m) => !m).length);
    expect(one.outcomes).toContain(true);
    expect(run(8, one.log).outcomes).not.toEqual(one.outcomes);
  });
});
