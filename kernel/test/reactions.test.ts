/**
 * World reactions (docs/design/REACTIONS.md): read, never run. A node that appears while its
 * condition holds, a wait on a respawn, and cues on the edge of their reach, all pure functions
 * of the content, the one thing they hang on, the tick and the seed.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type ReactionDef,
  type State,
  type Tile,
  MAX_CUES,
  RIDDLE_CLEAR,
  anchorsOf,
  appearSlots,
  appears,
  computeValues,
  cuesOnStep,
  dayOf,
  newState,
  reactionHolds,
  replay,
  serialize,
  step,
  waitPermille,
} from '@game/kernel';

import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

const BUSH = 'core/berry-bushes#0';
const WINDFALL = 'test/windfall';
const NIGHT = 450_000; // 21:00 on the first day
const reaction = (id: string, body: Pick<ReactionDef, 'on' | 'when' | 'then'>): ReactionDef => ({ id, creator: 'test', title: id, file: 'test', ...body });
const windfall = (active_ms = 1500): ReactionDef =>
  reaction(WINDFALL, {
    on: { resource: 'core/berry-bushes' },
    when: { ready_for_ms: 240_000 },
    then: { appear: { output: 'core/berry', yield: 1, active_ms, respawn_ms: 240_000, level: 1, game: 'pick', sprite: 'core/base-kit:items/berry', at: 'below' } },
  });

function world(...reactions: ReactionDef[]): Bundle {
  const b = structuredClone(base);
  b.reactions = Object.fromEntries(reactions.map((r) => [r.id, r]));
  return b;
}

function started(b: Bundle, seed = 5): State {
  const r = step(b, newState(b, seed), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The gather of a node from a tile beside it, reached over every bridge mended (a step names its tile, not its path). */
function gatherAt(b: Bundle, s: State, node: string, x: number, y: number): Action {
  const path = bfsNear(b, { restored: Object.keys(b.restores), camp: [] }, s.player.at, { x, y, w: 1, h: 1 });
  return { t: 'gather', node, grade: 3, at: path!.at(-1)! };
}

describe('a node that appears', () => {
  test('shows below a bush left full long enough, and is gone once the bush is picked', () => {
    const b = world(windfall());
    const id = `${WINDFALL}@${BUSH}`;
    const slot = appearSlots(b).get(id)!;
    expect([slot.x, slot.y]).toEqual([b.instances[BUSH]!.x, b.instances[BUSH]!.y + 1]);
    let s = started(b);
    expect(appears(b, s, id, 200_000)).toBe(false);
    expect(step(b, s, gatherAt(b, s, id, slot.x, slot.y), 200_000)).toEqual({ ok: false, error: 'Nothing is there now.' });

    const got = step(b, s, gatherAt(b, s, id, slot.x, slot.y), 250_000);
    if (!got.ok) throw new Error(got.error);
    s = got.state;
    expect(s.player.bag['core/berry']).toBe(1);
    expect(appears(b, s, id, 300_000)).toBe(false); // taken: back after its own respawn

    const bush = b.instances[BUSH]!;
    const picked = step(b, s, gatherAt(b, s, BUSH, bush.x, bush.y), 300_000);
    if (!picked.ok) throw new Error(picked.error);
    s = picked.state;
    // the bush is no longer full: no windfall until it has stood ready for the whole wait again
    const readyAt = s.nodes[BUSH]!.readyAt;
    expect(appears(b, s, id, readyAt + 239_999)).toBe(false);
    expect(appears(b, s, id, readyAt + 240_000)).toBe(true);
  });

  test('is priced as a node of its own, and an older source that costs as much keeps the value', () => {
    const plain = computeValues(base).values['core/berry'];
    const fair = computeValues({ ...base, reactions: { [WINDFALL]: windfall(1500) } });
    expect(fair.values['core/berry']).toBe(plain);
    expect(fair.cheapest['core/berry']).toBe('core/berry-bushes');
    const cheap = computeValues({ ...base, reactions: { [WINDFALL]: windfall(1000) } });
    expect(cheap.values['core/berry']).toBeLessThan(plain!);
    expect(cheap.cheapest['core/berry']).toBe(WINDFALL);
  });

  test('a replay of the same log gives the same state, step by step or at once', () => {
    const b = world(windfall());
    const s0 = newState(b, 9);
    const slot = appearSlots(b).get(`${WINDFALL}@${BUSH}`)!;
    const first = step(b, s0, { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
    if (!first.ok) throw new Error(first.error);
    const log = [
      { a: { t: 'start', starter: 'core/forager', name: 'Tester' } as Action, tick: 0 },
      { a: gatherAt(b, first.state, slot.id, slot.x, slot.y), tick: 250_000 },
    ];
    const once = replay(b, s0, log);
    const again = replay(structuredClone(b), s0, log);
    expect(once.error).toBeUndefined();
    expect(serialize(once.state)).toBe(serialize(again.state));
    expect(once.state.player.bag['core/berry']).toBe(1);
  });
});

describe('a wait', () => {
  test('scales the respawn while it holds, the waits multiplied and clamped', () => {
    const slower = reaction('test/slower-at-night', { on: { resource: 'core/berry-bushes' }, when: { night: true }, then: { wait: 2000 } });
    const b = world(slower);
    const s = started(b);
    const bush = b.instances[BUSH]!;
    const byDay = step(b, s, gatherAt(b, s, BUSH, bush.x, bush.y), 100_000);
    const byNight = step(b, s, gatherAt(b, s, BUSH, bush.x, bush.y), NIGHT);
    if (!byDay.ok || !byNight.ok) throw new Error('refused');
    const respawn = b.resources['core/berry-bushes']!.respawn_ms;
    expect(byNight.state.nodes[BUSH]!.readyAt - NIGHT - (byDay.state.nodes[BUSH]!.readyAt - 100_000)).toBe(respawn);

    const both = world(slower, reaction('test/slower-still', { on: { resource: '*' }, when: { night: true }, then: { wait: 1500 } }));
    expect(waitPermille(both, started(both), BUSH, NIGHT)).toBe(2000);
    expect(waitPermille(both, started(both), BUSH, 100_000)).toBe(1000);
  });
});

describe('cues', () => {
  const birds = reaction('test/birds', { on: { treasure: '*' }, when: { player_within: 8, unseen: true, night: false }, then: { cue: 'birds_lift', spread: 2 } });

  test('fire on the edge of their reach, around a find the player cannot see yet', () => {
    const b = world(birds);
    const s = started(b);
    const FIND = 'core/ruins-gate#1';
    const spot = b.instances[FIND]!;
    const outside: Tile = [spot.x - 9, spot.y];
    const edge: Tile = [spot.x - 8, spot.y];
    // the gate's other finds lie further off along this row; only this find's edge is crossed here
    const hits = cuesOnStep(b, s, 100_000, outside, edge).filter((h) => h.anchor === FIND);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.cue).toBe('birds_lift');
    expect(Math.abs(hits[0]!.x - spot.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(hits[0]!.y - spot.y)).toBeLessThanOrEqual(2);
    // the same day draws the same tile
    expect(cuesOnStep(b, s, 100_500, outside, edge).filter((h) => h.anchor === FIND)).toEqual(hits);
    // a step inside the reach starts nothing, and nor does a find the player already sees
    expect(cuesOnStep(b, s, 100_000, edge, [spot.x - 7, spot.y])).toEqual([]);
    expect(cuesOnStep(b, s, 100_000, [spot.x - 1, spot.y + 9], [spot.x - 1, spot.y + 8]).some((h) => h.anchor === FIND)).toBe(true);
    expect(reactionHolds(b, s, birds, { id: FIND, x: spot.x, y: spot.y, inst: spot }, 100_000, [spot.x - 1, spot.y])).toBe(false);
    // not at night, and not over a start's own find for another start
    expect(cuesOnStep(b, s, NIGHT, outside, edge)).toEqual([]);
    const glint = b.instances['core/bridge-glint#0']!;
    expect(cuesOnStep(b, s, 100_000, [glint.x - 9, glint.y], [glint.x - 8, glint.y]).some((h) => h.anchor === 'core/bridge-glint#0')).toBe(false);
  });

  test("never point at a riddle's answer, nor land beside it", () => {
    const onLantern = reaction('test/birds-on-lantern', { on: { treasure: 'core/lantern-foot' }, when: { player_within: 8, unseen: true }, then: { cue: 'birds_lift', spread: 2 } });
    const answer = base.instances['core/lantern-foot#0']!;
    const from: Tile = [answer.x - 9, answer.y];
    const to: Tile = [answer.x - 8, answer.y];
    const b = world(onLantern);
    expect(cuesOnStep(b, started(b), 100_000, from, to)).toEqual([]);
    // the same find with no riddle on it draws its birds, inside its spread of two
    const free = world(onLantern);
    delete free.quests['core/a-coin-for-maru'];
    const hits = cuesOnStep(free, started(free), 100_000, from, to);
    expect(hits).toHaveLength(1);
    expect(Math.max(Math.abs(hits[0]!.x - answer.x), Math.abs(hits[0]!.y - answer.y))).toBeLessThanOrEqual(RIDDLE_CLEAR);
  });

  test('a step starts at most a few, the nearest first, and a day roll is the same on every replay', () => {
    const fish = reaction('test/fish', { on: { tag: 'water' }, when: { player_within: 5 }, then: { cue: 'fish_rise' } });
    const b = world(fish);
    const s = started(b);
    const water = anchorsOf(b, fish)[0]!;
    const hits = cuesOnStep(b, s, 100_000, [water.x - 6, water.y], [water.x - 5, water.y]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(MAX_CUES);

    const rare = reaction('test/rare-fish', { on: { tag: 'water' }, when: { chance_pct: 25 }, then: { cue: 'fish_rise' } });
    const r = world(rare);
    const rs = started(r);
    const anchors = anchorsOf(r, rare);
    const day = (n: number) => n * r.params.day_length_ms + 100_000;
    expect(dayOf(r, day(3))).toBe(3);
    const on = (n: number) => anchors.filter((a) => reactionHolds(r, rs, rare, a, day(n))).length;
    expect(on(3)).toBe(on(3));
    const share = [0, 1, 2, 3, 4, 5, 6, 7].reduce((n, d) => n + on(d), 0) / (8 * anchors.length);
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.35);
  });

  test('a frame of reactions on the map costs well under half a millisecond', () => {
    const fish = reaction('test/fish', { on: { tag: 'water' }, when: { player_within: 5, hours: [18, 21] }, then: { cue: 'fish_rise' } });
    const b = world(windfall(), birds, fish);
    const s = started(b);
    const ids = [...appearSlots(b).keys()];
    const frame = (i: number) => {
      const x = 5 + (i % 30);
      cuesOnStep(b, s, 900_000, [x, 20], [x + 1, 20]);
      for (const id of ids) appears(b, s, id, 900_000);
    };
    frame(0);
    const runs = 400;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) frame(i);
    const ms = (performance.now() - t0) / runs;
    expect(ms).toBeLessThan(0.5);
  });
});
