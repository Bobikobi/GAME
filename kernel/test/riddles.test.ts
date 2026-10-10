/**
 * The find and riddle steps (GRUNT P-2): a riddle completes on its answer's
 * event and on nothing else; a find is a bring of one that the hand-in takes,
 * and a task nobody gave keeps what it found in the bag.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Bundle,
  type QuestDef,
  type Rect,
  type State,
  hourOf,
  inRect,
  isNight,
  makeWalkable,
  near,
  newState,
  npcTile,
  questSatisfied,
  riddleSlots,
  step,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

const GATE = 'core/ruins-gate';
const DEEP = 'core/ruins-deep';
const GLADE = 'core/west-glade';

function quest(steps: QuestDef['steps']): QuestDef {
  return { id: 'test/q', creator: 'core', title: 'A test', file: 'test.json', summary: 'For the test.', steps, reward: { rep: 0 } };
}

function withQuest(q: QuestDef): Bundle {
  return { ...base, quests: { ...base.quests, [q.id]: q } };
}

/** A started game with every dig level and a trowel in the bag; the test quest starts by itself (no giver). */
function started(bundle: Bundle): State {
  const r = step(bundle, newState(bundle, 11), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  const s = r.state;
  s.player.xp[bundle.verbs.dig] = 1_000_000_000;
  const trowel = Object.values(bundle.items).find((it) => it.tool?.kind === 'trowel');
  if (!trowel) throw new Error('no trowel in the content');
  s.player.bag[trowel.id] = 1;
  return s;
}

function act(bundle: Bundle, s: State, action: Parameters<typeof step>[2], tick: number) {
  const r = step(bundle, s, action, tick);
  if (!r.ok) throw new Error(r.error);
  return r;
}

/** Put the player on a walkable tile next to the target (the kernel checks the tile, not the walk). */
function standNear(bundle: Bundle, s: State, target: Rect, inside = false): [number, number] {
  const walkable = makeWalkable(bundle);
  for (let y = target.y - 1; y <= target.y + target.h; y++) {
    for (let x = target.x - 1; x <= target.x + target.w; x++) {
      const ok = inside ? inRect(x, y, target) : near([x, y], target);
      if (ok && walkable(x, y, s.player)) {
        s.player.at = [x, y];
        return [x, y];
      }
    }
  }
  throw new Error('no walkable tile at the target');
}

function spotOf(bundle: Bundle, treasure: string): [string, Rect] {
  const found = Object.entries(bundle.instances).find(([, i]) => i.source === treasure);
  if (!found) throw new Error(`no dig spot for ${treasure}`);
  return [found[0], { x: found[1].x, y: found[1].y, w: 1, h: 1 }];
}

function slotOf(bundle: Bundle, id: string): Rect {
  const slot = bundle.map.slots.find((s) => s.id === id);
  if (!slot) throw new Error(`no slot ${id}`);
  return slot;
}

/** The first tick at which the valley's hour is `hour`. */
function tickAt(bundle: Bundle, hour: number): number {
  const day = bundle.params.day_length_ms;
  const tick = Math.ceil((((hour - 6 + 24) % 24) * day) / 24) + 1;
  if (hourOf(bundle, tick) !== hour) throw new Error(`tick ${tick} is not hour ${hour}`);
  return tick;
}

describe('a riddle answered by a dig', () => {
  const dug = () => withQuest(quest([{ kind: 'riddle', clue: 'Under the statue that faces the hills.', props: ['core/stone-a'], answer: { kind: 'dig', treasure: GATE } }]));

  test('starts with the game and is not satisfied', () => {
    const b = dug();
    const s = started(b);
    expect(s.player.quests['test/q']).toBe('active');
    expect(questSatisfied(b, s, 'test/q')).toBe(false);
    expect(riddleSlots(b, s).size).toBe(0);
  });

  test('is not solved by a dig elsewhere', () => {
    const b = dug();
    const s = started(b);
    const [spot, rect] = spotOf(b, DEEP);
    const at = standNear(b, s, rect);
    const r = act(b, s, { t: 'dig', spot, grade: 3, at }, 0);
    expect(r.state.player.solved).toEqual([]);
    expect(r.state.player.quests['test/q']).toBe('active');
    expect(r.events.some((e) => e.e === 'riddle')).toBe(false);
  });

  test('is solved by a dig at the named spot, whatever comes up, and the quest closes', () => {
    const b = dug();
    const s = started(b);
    const [spot, rect] = spotOf(b, GATE);
    const at = standNear(b, s, rect);
    const r = act(b, s, { t: 'dig', spot, grade: 0, at }, 0);
    expect(r.events).toContainEqual({ e: 'riddle', quest: 'test/q' });
    expect(r.state.player.quests['test/q']).toBe('done');
    expect(r.state.player.solved).toEqual(['test/q#0']);
  });

  test('replays the same way', () => {
    const b = dug();
    const [spot, rect] = spotOf(b, GATE);
    const one = started(b);
    const two = started(b);
    const at = standNear(b, one, rect);
    standNear(b, two, rect);
    expect(act(b, one, { t: 'dig', spot, grade: 2, at }, 0).state).toEqual(act(b, two, { t: 'dig', spot, grade: 2, at }, 0).state);
  });
});

describe('a riddle answered by a place by night', () => {
  const byNight = () => withQuest(quest([{ kind: 'riddle', clue: 'Where the mist sits like a lid, after dark.', props: ['core/stone-a'], answer: { kind: 'visit', slot: GLADE, at: 'night' } }]));

  test('waits for the night: a visit by day does not solve it, a visit at night does', () => {
    const b = byNight();
    const s = started(b);
    expect(riddleSlots(b, s)).toEqual(new Set([GLADE]));
    const at = standNear(b, s, slotOf(b, GLADE), true);
    expect(isNight(b, 0)).toBe(false);
    const day = act(b, s, { t: 'visit', slot: GLADE, at }, 0);
    expect(day.state.player.visited).toContain(GLADE);
    expect(day.state.player.solved).toEqual([]);
    const night = tickAt(b, 22);
    expect(isNight(b, night)).toBe(true);
    const r = act(b, day.state, { t: 'visit', slot: GLADE, at }, night);
    expect(r.events).toContainEqual({ e: 'riddle', quest: 'test/q' });
    expect(r.state.player.quests['test/q']).toBe('done');
    expect(riddleSlots(b, r.state).size).toBe(0);
  });

  test('a visit to a place already seen still counts when the hour is right', () => {
    const b = byNight();
    const s = started(b);
    s.player.visited = [GLADE];
    const at = standNear(b, s, slotOf(b, GLADE), true);
    const r = act(b, s, { t: 'visit', slot: GLADE, at }, tickAt(b, 3));
    expect(r.state.player.solved).toEqual(['test/q#0']);
    expect(r.events.some((e) => e.e === 'visit')).toBe(false);
  });
});

describe('night for the rules', () => {
  test('runs from 20:00 to 05:00', () => {
    for (const h of [20, 23, 0, 4]) expect(isNight(base, tickAt(base, h))).toBe(true);
    for (const h of [5, 6, 12, 19]) expect(isNight(base, tickAt(base, h))).toBe(false);
  });
});

describe('a find', () => {
  const coin = 'core/old-coin';
  const steps: QuestDef['steps'] = [{ kind: 'find', item: coin, clue: 'Old pottery lies under the gate stones; the coin is in the same rubble.' }];

  test('is a bring of one that the hand-in takes', () => {
    const b = withQuest({ ...quest(steps), giver: 'core/elder' });
    const s = started(b);
    const tile = npcTile(b, 'core/elder')!;
    const at = standNear(b, s, { x: tile[0], y: tile[1], w: 1, h: 1 });
    let r = act(b, s, { t: 'accept', quest: 'test/q', at }, 0);
    expect(questSatisfied(b, r.state, 'test/q')).toBe(false);
    r.state.player.bag[coin] = 2;
    expect(questSatisfied(b, r.state, 'test/q')).toBe(true);
    r = act(b, r.state, { t: 'turnin', quest: 'test/q', at }, 0);
    expect(r.state.player.quests['test/q']).toBe('done');
    expect(r.state.player.bag[coin]).toBe(1);
  });

  test('handed to nobody stays in the bag', () => {
    const b = withQuest(quest(steps));
    const s = started(b);
    s.player.bag[coin] = 2;
    const at = standNear(b, s, slotOf(b, GLADE), true);
    const r = act(b, s, { t: 'visit', slot: GLADE, at }, 0);
    expect(r.state.player.quests['test/q']).toBe('done');
    expect(r.state.player.bag[coin]).toBe(2);
  });
});
