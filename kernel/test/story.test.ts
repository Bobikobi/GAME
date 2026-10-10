/**
 * Lines that wait for the world (GRUNT S-1): every field of a condition holds
 * or not on its own; of the remarks that hold, priority beats specificity,
 * specificity beats the order in the file, and a heard remark steps back.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type NpcDef, type State, holds, isNight, newState, pickRemark, step, weight } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let base: Bundle;
let s: State;

beforeAll(() => {
  base = loadBundle();
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  s = r.state;
  s.player.quests['core/fix-the-bridge'] = 'done';
  s.player.quests['core/first-fire'] = 'active';
  s.player.restored = ['core/old-bridge'];
  s.player.bag['core/stone'] = 2;
  s.player.visited = ['core/town-corner'];
});

/** The first tick from 0 at which the kernel's night is `night`. */
function tickAt(night: boolean): number {
  for (let t = 0; t < base.params.day_length_ms; t += 60_000) if (isNight(base, t) === night) return t;
  throw new Error('no such hour');
}

describe('holds', () => {
  test('each field, alone, true and false', () => {
    expect(holds(base, s, { done: ['core/fix-the-bridge'] })).toBe(true);
    expect(holds(base, s, { done: ['core/first-fire'] })).toBe(false);
    expect(holds(base, s, { active: ['core/first-fire'] })).toBe(true);
    expect(holds(base, s, { active: ['core/fix-the-bridge'] })).toBe(false);
    expect(holds(base, s, { not_done: ['core/first-fire', 'core/three-fruits'] })).toBe(true);
    expect(holds(base, s, { not_done: ['core/fix-the-bridge'] })).toBe(false);
    expect(holds(base, s, { restored: ['core/old-bridge'] })).toBe(true);
    expect(holds(base, s, { has: ['core/stone'] })).toBe(true);
    expect(holds(base, s, { has: ['core/branch'] })).toBe(false);
    expect(holds(base, s, { visited: ['core/town-corner'] })).toBe(true);
    const camp = Object.keys(base.camps)[0]!;
    expect(holds(base, s, { built: [camp] })).toBe(false);
  });

  test('the time of day is the kernel night at the tick given', () => {
    expect(holds(base, s, { time: 'night' }, tickAt(true))).toBe(true);
    expect(holds(base, s, { time: 'night' }, tickAt(false))).toBe(false);
    expect(holds(base, s, { time: 'day' }, tickAt(false))).toBe(true);
  });

  test('every condition named must hold, and the weight counts them', () => {
    expect(holds(base, s, { done: ['core/fix-the-bridge'], has: ['core/branch'] })).toBe(false);
    expect(weight({ done: ['a/b', 'a/c'], has: ['a/d'], time: 'day' })).toBe(4);
  });
});

describe('pickRemark', () => {
  const npc = 'core/elder';
  function withRemarks(remarks: NpcDef['remarks']): Bundle {
    return { ...base, npcs: { ...base.npcs, [npc]: { ...base.npcs[npc]!, remarks } } };
  }
  const bridge = { done: ['core/fix-the-bridge'] };
  const bridgeAndStone = { done: ['core/fix-the-bridge'], has: ['core/stone'] };

  test('the more specific remark wins, then the first in the file', () => {
    const b = withRemarks([
      { when: bridge, say: ['plain'] },
      { when: bridgeAndStone, say: ['specific'] },
      { when: bridgeAndStone, say: ['later'] },
    ]);
    expect(pickRemark(b, s, npc, new Set())?.say).toEqual(['specific']);
  });

  test('priority beats specificity', () => {
    const b = withRemarks([
      { when: bridgeAndStone, say: ['specific'] },
      { when: bridge, say: ['urgent'], priority: 3 },
    ]);
    expect(pickRemark(b, s, npc, new Set())).toEqual({ key: `${npc}#1`, say: ['urgent'] });
  });

  test('a heard remark steps back, and one that does not hold is never said', () => {
    const b = withRemarks([
      { when: bridgeAndStone, say: ['first'] },
      { when: bridge, say: ['second'] },
      { when: { done: ['core/first-fire'] }, say: ['never'] },
    ]);
    expect(pickRemark(b, s, npc, new Set([`${npc}#0`]))?.say).toEqual(['second']);
    expect(pickRemark(b, s, npc, new Set([`${npc}#0`, `${npc}#1`]))).toBeUndefined();
  });

  test('reads the state and changes nothing', () => {
    const before = JSON.stringify(s);
    pickRemark(withRemarks([{ when: bridge, say: ['x'] }]), s, npc, new Set());
    expect(JSON.stringify(s)).toBe(before);
  });
});
