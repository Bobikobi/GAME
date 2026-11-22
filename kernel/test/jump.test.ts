/**
 * The jump and the fall (DECISIONS.md, 2026-11-22; G68, G33): up one level anywhere, down any height, across a gap of
 * water one tile wide; a little breath each; never in the first minute; a fall hurts by its height, up to death.
 */
import { describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type State,
  type Tile,
  breathCap,
  breathLeft,
  canonical,
  fallHarm,
  hpCap,
  jumpRule,
  jumpTargets,
  newState,
  replay,
  step,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const base: Bundle = loadBundle();
const J = base.params.jump;
/** Past the first minute, with room to spare. */
const LATER = J.first_minute_ms + 10_000;

interface Layout {
  ground: string[];
  levels?: string[];
}

/** A small world of the real content's rules: `.` is grass, `~` water, `T` forest (solid), with the given height layer. */
function world({ ground, levels }: Layout): Bundle {
  const map = { ...base.map, width: ground[0]!.length, height: ground.length, ground, props: [], slots: [], spawn: { x: 0, y: 0 }, ...(levels ? { levels } : {}) };
  if (!levels) delete (map as { levels?: unknown }).levels;
  return { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {} } as Bundle;
}

/** A started player standing on `at`, with the full health the start gives. */
function standing(at: Tile): State {
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return { ...r.state, player: { ...r.state.player, at: [at[0], at[1]], movedAt: r.state.tick } };
}

function jump(b: Bundle, s: State, at: Tile, tick = LATER): ReturnType<typeof step> {
  return step(b, s, { t: 'jump', at }, tick);
}

function must(r: ReturnType<typeof step>): { state: State; events: GameEvent[] } {
  if (!r.ok) throw new Error(r.error);
  return r;
}

/** One row, levels given as digits: a jump along x from the first tile to the second. */
const row = (levels: string): Bundle => world({ ground: [`.`.repeat(levels.length)], levels: [levels] });

describe('a jump up', () => {
  test('one level is allowed where a plain step is refused, two are not', () => {
    const b = row('0120');
    const up1 = must(jump(b, standing([0, 0]), [1, 0]));
    expect(up1.state.player.at).toEqual([1, 0]);
    expect(up1.events.find((e) => e.e === 'jump')).toMatchObject({ from: [0, 0], at: [1, 0], drop: -1, across: false, harm: 0 });
    // the same step on foot is refused by the rock face (G68)
    expect(step(b, standing([0, 0]), { t: 'move', at: [1, 0] }, LATER, { validateTravel: true }).ok).toBe(false);
    // two levels up: refused with a reason a player can read
    const up2 = jump(row('0200'), standing([0, 0]), [1, 0]);
    expect(up2).toEqual({ ok: false, error: 'That is too high to jump up.' });
  });

  test('on level ground a hop is a hop: allowed, and it takes nothing', () => {
    const r = must(jump(row('000'), standing([0, 0]), [1, 0]));
    expect(r.state.player.hp).toBe(standing([0, 0]).player.hp);
  });
});

describe('a jump down, and the fall', () => {
  const cap = hpCap(base, standing([0, 0]));
  const drop = (levels: number) => {
    const b = row(`${levels}0`);
    return must(jump(b, standing([0, 0]), [1, 0]));
  };

  test('one level costs nothing and sends no hurt', () => {
    const r = drop(1);
    expect(r.state.player.hp).toBe(cap);
    expect(r.events.some((e) => e.e === 'hurt')).toBe(false);
    expect(r.state.player.at).toEqual([1, 0]);
  });

  test('two levels cost a fifth of the cap, three levels half', () => {
    const two = drop(2);
    expect(two.state.player.hp).toBe(cap - (cap * J.fall_two_bp) / 10_000);
    expect(cap - two.state.player.hp).toBe(cap / 5);
    expect(two.events.find((e) => e.e === 'hurt')).toMatchObject({ by: 'fall', hp: two.state.player.hp });
    const three = drop(3);
    expect(cap - three.state.player.hp).toBe(cap / 2);
    expect(three.events.find((e) => e.e === 'jump')).toMatchObject({ drop: 3, harm: cap / 2 });
  });

  test('four levels or more are death (G33): the body falls where it landed, and the player wakes whole', () => {
    for (const levels of [4, 5, 9]) {
      const r = drop(levels);
      const fall = r.events.find((e) => e.e === 'fall');
      expect(fall).toMatchObject({ e: 'fall', from: [1, 0] });
      expect(r.state.player.falls).toBe(1);
      expect(r.state.player.hp).toBe(cap);
    }
  });

  test('a fall that takes the last of a hurt player is death even at two levels', () => {
    const s = standing([0, 0]);
    const hurt = { ...s, player: { ...s.player, hp: cap / 10 } };
    const r = must(jump(row('20'), hurt, [1, 0]));
    expect(r.events.some((e) => e.e === 'fall')).toBe(true);
  });

  test('a death keeps what the outing brought lying where the body fell, and takes it from the bag (G33)', () => {
    const s = standing([0, 0]);
    // out on the grass with something the outing found
    const out = { ...s, player: { ...s.player, outing: { gained: { 'core/stone': 1 }, solved: [], visited: [] }, bag: { ...s.player.bag, 'core/stone': 1 } } };
    const r = must(jump(row('50'), out, [1, 0]));
    const fall = r.events.find((e) => e.e === 'fall');
    expect(fall).toMatchObject({ from: [1, 0], lost: [{ item: 'core/stone', qty: 1 }] });
    expect(r.state.player.bag['core/stone'] ?? 0).toBe(0);
  });

  test('the harm of a height is one function the client can read', () => {
    const s = standing([0, 0]);
    expect([0, 1, 2, 3, 4, 7].map((n) => fallHarm(base, s, n))).toEqual([0, 0, cap / 5, cap / 2, s.player.hp, s.player.hp]);
  });
});

describe('across a gap', () => {
  const gap = (mid: string): Bundle => world({ ground: [`.${mid}.`] });

  test('one tile of water is crossed, two are not, and land or a tree is not a gap', () => {
    const one = must(jump(gap('~'), standing([0, 0]), [2, 0]));
    expect(one.state.player.at).toEqual([2, 0]);
    expect(one.events.find((e) => e.e === 'jump')).toMatchObject({ across: true, drop: 0 });
    const two = jump(world({ ground: ['.~~.'] }), standing([0, 0]), [3, 0]);
    expect(two.ok).toBe(false);
    expect(jump(gap('.'), standing([0, 0]), [2, 0])).toEqual({ ok: false, error: 'There is nothing to jump over.' });
    expect(jump(gap('T'), standing([0, 0]), [2, 0])).toEqual({ ok: false, error: 'There is nothing to jump over.' });
  });

  test('the far bank follows the height rule: up one level yes, two no, down any', () => {
    const lv = (levels: string) => world({ ground: ['.~.'], levels: [levels] });
    expect(jump(lv('001'), standing([0, 0]), [2, 0]).ok).toBe(true);
    expect(jump(lv('002'), standing([0, 0]), [2, 0]).ok).toBe(false);
    expect(jump(lv('300'), standing([0, 0]), [2, 0]).ok).toBe(true);
  });

  test('the landing must be a tile a foot can stand on, and a jump goes straight, never on a diagonal', () => {
    expect(jump(world({ ground: ['.~T'] }), standing([0, 0]), [2, 0])).toEqual({ ok: false, error: 'You cannot land there.' });
    const b = world({ ground: ['..', '..'] });
    expect(jump(b, standing([0, 0]), [1, 1])).toEqual({ ok: false, error: 'You can only jump straight ahead, one tile or across a gap.' });
    expect(jump(b, standing([0, 0]), [0, 0]).ok).toBe(false);
  });

  test('the rule lists the same landings the kernel accepts', () => {
    const b = world({ ground: ['.~.', '...', '...'], levels: ['001', '000', '000'] });
    const targets = jumpTargets(b, [0, 0]).map((t) => t.to.join(','));
    // the water beside is listed too (the rule judges the line and the height; whether a foot stands there is the walk's)
    expect(targets.sort()).toEqual(['0,1', '1,0', '2,0']);
    expect(jumpRule(b)([0, 0], [2, 0])).toEqual({ ok: true, drop: -1, across: true });
  });
});

describe('breath and the first minute', () => {
  test('a jump costs breath, and the cap is the fight\'s', () => {
    const b = row('000000000000000000');
    const s0 = standing([0, 0]);
    expect(breathLeft(b, s0, LATER)).toBe(breathCap(b, s0));
    const r = must(jump(b, s0, [1, 0]));
    expect(r.state.player.breath).toEqual({ left: breathCap(b, s0) - J.breath_cost, at: LATER });
  });

  test('breath runs out, and comes back with time', () => {
    const b = row('0'.repeat(60));
    let s = standing([0, 0]);
    let tick = LATER;
    let x = 0;
    let made = 0;
    // one jump after another, each as soon as the landing is over: the refill of one air time is less than one jump costs
    for (; made < 50; made++) {
      const r = jump(b, s, [x + 1, 0], tick);
      if (!r.ok) {
        expect(r.error).toBe('You are out of breath.');
        break;
      }
      s = r.state;
      x += 1;
      tick += J.air_ms;
    }
    expect(made).toBeGreaterThan(2);
    expect(made).toBeLessThan(50);
    expect(breathLeft(b, s, tick)).toBeLessThan(J.breath_cost);
    // a few seconds of rest bring a jump back, and never above the cap
    expect(jump(b, s, [x + 1, 0], tick + 3000).ok).toBe(true);
    expect(breathLeft(b, s, tick + 10_000_000)).toBe(breathCap(b, s));
  });

  test('the jump itself keeps the player busy for its air time; a walk report goes through', () => {
    const b = row('0000');
    const s = must(jump(b, standing([0, 0]), [1, 0])).state;
    expect(s.player.busyUntil).toBe(LATER + J.air_ms);
    expect(jump(b, s, [2, 0], LATER + J.air_ms - 1)).toEqual({ ok: false, error: 'You are still busy.' });
    expect(step(b, s, { t: 'move', at: [2, 0] }, LATER + 1).ok).toBe(true);
  });

  test('the first minute after waking refuses a jump, and the minute is the param', () => {
    const b = row('00');
    const s = standing([0, 0]);
    const refused = { ok: false, error: 'You have only just woken. Your legs are not ready to jump.' };
    expect(jump(b, s, [1, 0], 0)).toEqual(refused);
    expect(jump(b, s, [1, 0], J.first_minute_ms - 1)).toEqual(refused);
    expect(jump(b, s, [1, 0], J.first_minute_ms).ok).toBe(true);
  });

  test('a refused jump changes nothing', () => {
    const b = row('0200');
    const s = standing([0, 0]);
    const before = canonical(s);
    expect(jump(b, s, [1, 0]).ok).toBe(false);
    expect(canonical(s)).toBe(before);
  });
});

describe('replay', () => {
  test('a log with jumps replays to the same state, byte for byte, and an old state with no breath reads full', () => {
    const b = world({ ground: ['.~..~.', '......'], levels: ['001100', '000000'] });
    const log: { a: Action; tick: number }[] = [
      { a: { t: 'jump', at: [2, 0] }, tick: LATER },
      { a: { t: 'jump', at: [2, 1] }, tick: LATER + 1000 },
      { a: { t: 'move', at: [3, 1] }, tick: LATER + 2000 },
      { a: { t: 'jump', at: [3, 0] }, tick: LATER + 3000 },
      { a: { t: 'jump', at: [5, 0] }, tick: LATER + 5000 },
    ];
    const start = standing([0, 0]);
    expect('breath' in start.player).toBe(false);
    const one = replay(b, start, log);
    const two = replay(b, start, log);
    expect(one.error).toBeUndefined();
    expect(canonical(one.state)).toBe(canonical(two.state));
    // the log ends on the far bank of the second stream
    expect(one.state.player.at).toEqual([5, 0]);
    expect(one.events.filter((e) => e.e === 'jump')).toHaveLength(4);
    // one step at a time, the same state
    let s = start;
    for (const entry of log) s = must(step(b, s, entry.a, entry.tick)).state;
    expect(canonical(s)).toBe(canonical(one.state));
  });
});
