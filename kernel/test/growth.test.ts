/**
 * The skill tree's format (docs/design/GROWTH.md section 4; DECISIONS.md 2026-10-22 "The tree"):
 * a node is bought with skill points by choice at a safe place, after its path and with its keys; a
 * corner node belongs to one race; a small node is always on and a technique counts only in a slot of
 * the build; the slots open by character level; a save from before the tree loads and plays.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Bundle,
  type State,
  characterLevel,
  effectValue,
  isSafe,
  makeWalkable,
  newState,
  nodeKey,
  nodeRefusal,
  skillPoints,
  slotsOpen,
  step,
  treeNode,
} from '@game/kernel';

import { loadBundle, seedFor } from '../../tools/test/helpers/world.js';

let b: Bundle;
let safe: [number, number];
let wild: [number, number];

const DIG = 'core/digging-school';
const STEADY = nodeKey(DIG, 'steady');
const OLD_SIGNS = nodeKey(DIG, 'old-signs');
const QUICK = nodeKey(DIG, 'quick-trowel');
const DEPTH = nodeKey(DIG, 'depth-sense');
const HUMAN_CORNER = nodeKey(DIG, 'surveyor');
const ELF_CORNER = nodeKey(DIG, 'root-reader');

beforeAll(() => {
  b = loadBundle();
  const s = started('core/human');
  const walk = makeWalkable(b);
  let foundSafe: [number, number] | undefined;
  const wilds: [number, number][] = [];
  for (let y = 0; y < b.map.height; y++) {
    for (let x = 0; x < b.map.width; x++) {
      if (!walk(x, y, s.player)) continue;
      if (isSafe(b, s, [x, y])) foundSafe ??= [x, y];
      else wilds.push([x, y]);
    }
  }
  // a wild tile where nothing happens to the one who stands on it but the refusal
  const probe = (t: [number, number]) => {
    const p = started('core/human');
    p.player.xp['core/digging'] = b.professions['core/digging']!.xp_levels[1]! * 1000;
    p.player.at = [...t];
    const r = step(b, p, { t: 'learn_node', node: STEADY, at: t }, 1);
    return !r.ok && r.error === 'Learn at a fire, a camp or in town.';
  };
  const foundWild = wilds.find(probe);
  safe = foundSafe!;
  wild = foundWild!;
});

function started(race: string): State {
  const r = step(b, newState(b, seedFor(b, 'core/north-meadow')), { t: 'start', race, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** A character of this race at a level, standing on a tile, with every profession level bought by experience. */
function grown(race: string, digLevel: number, at: [number, number] = safe): State {
  const s = started(race);
  const prof = b.professions['core/digging']!;
  s.player.xp['core/digging'] = digLevel > 1 ? prof.xp_levels[digLevel - 2]! * 1000 : 0;
  s.player.at = [...at];
  return s;
}

function act(s: State, a: Parameters<typeof step>[2], tick = s.tick + 1) {
  return step(b, s, a, tick);
}

describe('the core schools', () => {
  test('are five, one for each profession, each with a path and one corner for each race', () => {
    const schools = Object.values(b.schools);
    expect(schools.map((sc) => sc.profession).sort()).toEqual(Object.keys(b.professions).sort());
    for (const sc of schools) {
      expect(sc.nodes.filter((n) => n.size !== 'corner').length, sc.id).toBeGreaterThanOrEqual(3);
      for (const race of Object.keys(b.races)) expect(sc.nodes.filter((n) => n.race === race), `${sc.id} ${race}`).toHaveLength(1);
    }
    expect(treeNode(b, DEPTH)?.node.key).toEqual({ senses: 3 });
    expect(treeNode(b, 'core/nowhere/steady')).toBeUndefined();
  });

  test('cost one, two and three points by size, and open two slots at level one, then one at 5, 10 and 15', () => {
    expect(b.params.growth?.cost).toEqual({ small: 1, major: 2, corner: 3 });
    expect(b.params.growth?.slot_levels).toEqual([1, 1, 5, 10, 15]);
    const s = started('core/human');
    expect(slotsOpen(b, s)).toBe(2);
  });
});

describe('learning a node', () => {
  test('pays its points at a safe place, keeps the key sorted and says so', () => {
    const s = grown('core/human', 3);
    const points = skillPoints(b, s);
    expect(points).toBeGreaterThanOrEqual(2);
    const r = act(s, { t: 'learn_node', node: STEADY, at: safe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.player.nodes).toEqual([STEADY]);
    expect(skillPoints(b, r.state)).toBe(points - 1);
    expect(r.events).toContainEqual({ e: 'node', node: STEADY, cost: 1 });
  });

  test('is refused in the wild, before its path, twice, without points, and for another race', () => {
    const away = act(grown('core/human', 3, wild), { t: 'learn_node', node: STEADY, at: wild });
    expect(away).toMatchObject({ ok: false, error: 'Learn at a fire, a camp or in town.' });
    const early = act(grown('core/human', 3), { t: 'learn_node', node: OLD_SIGNS, at: safe });
    expect(early).toMatchObject({ ok: false, error: 'Learn Steady first.' });
    const once = act(grown('core/human', 3), { t: 'learn_node', node: STEADY, at: safe });
    if (!once.ok) throw new Error(once.error);
    expect(act(once.state, { t: 'learn_node', node: STEADY, at: safe })).toMatchObject({ ok: false, error: 'You know this already.' });
    const poor = grown('core/human', 1);
    expect(skillPoints(b, poor)).toBe(0);
    expect(act(poor, { t: 'learn_node', node: STEADY, at: safe })).toMatchObject({ ok: false, error: 'Needs a skill point.' });
    expect(nodeRefusal(b, grown('core/human', 9), ELF_CORNER)).toBe('That belongs to another race.');
    expect(act(grown('core/human', 3), { t: 'learn_node', node: 'core/digging-school/nothing', at: safe })).toMatchObject({ ok: false });
  });

  test('asks its key and never spends it: senses 3 opens Depth sense', () => {
    let s = grown('core/human', 9);
    for (const node of [STEADY, OLD_SIGNS, QUICK]) {
      const r = act(s, { t: 'learn_node', node, at: safe });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.player.attrs.senses).toBe(2);
    expect(nodeRefusal(b, s, DEPTH)).toBe('Needs senses 3 - you have 2.');
    const pip = act(s, { t: 'spend', attr: 'senses' });
    if (!pip.ok) throw new Error(pip.error);
    const r = act(pip.state, { t: 'learn_node', node: DEPTH, at: safe });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.player.attrs.senses).toBe(3);
  });

  test('a corner node is the race\'s own, after the school\'s first major node', () => {
    let s = grown('core/human', 9);
    expect(nodeRefusal(b, s, HUMAN_CORNER)).toBe('Learn Old signs first.');
    for (const node of [STEADY, OLD_SIGNS, HUMAN_CORNER]) {
      const r = act(s, { t: 'learn_node', node, at: safe });
      if (!r.ok) throw new Error(`${node}: ${r.error}`);
      s = r.state;
    }
    expect(s.player.spent).toBe(1 + 2 + 3);
  });
});

describe('what a node does', () => {
  test('a small node is always on; a technique counts only while it sits in the build', () => {
    let s = grown('core/human', 9);
    const before = effectValue(b, s, 'dig_speed_pct');
    for (const node of [STEADY, OLD_SIGNS, QUICK]) {
      const r = act(s, { t: 'learn_node', node, at: safe });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    // Quick trowel is small: on at once
    expect(effectValue(b, s, 'dig_speed_pct')).toBe(before + treeNode(b, QUICK)!.node.value);
    const hint = effectValue(b, s, 'second_hint');
    const put = act(s, { t: 'equip', node: OLD_SIGNS, slot: 0, at: safe });
    if (!put.ok) throw new Error(put.error);
    expect(put.state.player.build).toEqual([OLD_SIGNS]);
    expect(effectValue(b, put.state, 'second_hint')).toBeGreaterThan(hint);
    const off = act(put.state, { t: 'unequip', slot: 0, at: safe });
    if (!off.ok) throw new Error(off.error);
    expect(off.state.player.build).toEqual([]);
    expect(effectValue(b, off.state, 'second_hint')).toBe(hint);
  });
});

describe('the build', () => {
  function withTechniques(): State {
    let s = grown('core/human', 9);
    for (const node of [STEADY, OLD_SIGNS, HUMAN_CORNER]) {
      const r = act(s, { t: 'learn_node', node, at: safe });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    return s;
  }

  test('fills the open slots in order, moves a technique, replaces one, and refuses a closed slot', () => {
    const s = withTechniques();
    const open = slotsOpen(b, s);
    expect(characterLevel(b, s)).toBe(9);
    expect(open).toBe(3);
    const a = act(s, { t: 'equip', node: OLD_SIGNS, slot: 2, at: safe });
    if (!a.ok) throw new Error(a.error);
    expect(a.state.player.build).toEqual([OLD_SIGNS]); // the next empty slot at most
    const c = act(a.state, { t: 'equip', node: HUMAN_CORNER, slot: 1, at: safe });
    if (!c.ok) throw new Error(c.error);
    expect(c.state.player.build).toEqual([OLD_SIGNS, HUMAN_CORNER]);
    const swapped = act(c.state, { t: 'equip', node: HUMAN_CORNER, slot: 0, at: safe });
    if (!swapped.ok) throw new Error(swapped.error);
    expect(swapped.state.player.build).toEqual([HUMAN_CORNER]);
    expect(act(c.state, { t: 'equip', node: OLD_SIGNS, slot: open, at: safe })).toMatchObject({ ok: false, error: 'That slot is not open yet.' });
  });

  test('takes only a learned technique, never a small node, and changes only at a safe place', () => {
    const s = withTechniques();
    expect(act(s, { t: 'equip', node: STEADY, slot: 0, at: safe })).toMatchObject({ ok: false, error: 'That is always on: it needs no slot.' });
    expect(act(s, { t: 'equip', node: DEPTH, slot: 0, at: safe })).toMatchObject({ ok: false, error: 'You have not learned that.' });
    s.player.at = [...wild];
    expect(act(s, { t: 'equip', node: OLD_SIGNS, slot: 0, at: wild })).toMatchObject({ ok: false, error: 'Change the build at a fire, a camp or in town.' });
    expect(act(s, { t: 'unequip', slot: 0, at: wild })).toMatchObject({ ok: false, error: 'That slot is empty.' });
  });
});

describe('a save from before the tree', () => {
  test('has no nodes and no build, and still learns and plays', () => {
    const s = grown('core/human', 3);
    delete s.player.nodes;
    delete s.player.build;
    expect(effectValue(b, s, 'dig_speed_pct')).toBeGreaterThanOrEqual(0);
    expect(slotsOpen(b, s)).toBe(2);
    const r = act(s, { t: 'learn_node', node: STEADY, at: safe });
    expect(r.ok).toBe(true);
  });
});
