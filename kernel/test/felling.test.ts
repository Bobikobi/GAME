/**
 * Felling (DECISIONS.md, 2026-10-10: the axe and the first starts): a tree is a node worked with an
 * axe, it trains woodcutting and not foraging, it stands in the way grown or felled, and a character
 * may begin with a small kit in the bag.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type StepResult, makeWalkable, newState, nodeVerb, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
let tree: string;

function begin(bundle: Bundle, starter = 'core/forager'): State {
  const r = step(bundle, newState(bundle, 7), { t: 'start', starter, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** A tile next to the node where the player may stand. */
function beside(bundle: Bundle, state: State, node: string): [number, number] {
  const inst = bundle.instances[node]!;
  const walkable = makeWalkable(bundle);
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
    if (walkable(inst.x + dx, inst.y + dy, state.player)) return [inst.x + dx, inst.y + dy];
  }
  throw new Error(`No standing place next to ${node}.`);
}

function fell(bundle: Bundle, state: State, node: string, tick: number, grade: 0 | 1 | 2 | 3 | 4 = 3): StepResult {
  return step(bundle, state, { t: 'gather', node, grade, at: beside(bundle, state, node) }, tick);
}

beforeAll(() => {
  b = loadBundle();
  tree = Object.keys(b.instances).sort().find((id) => b.instances[id]!.source === 'core/oak-trees')!;
});

describe('felling', () => {
  test('a tree is worked with an axe and trains the felling verb', () => {
    expect(b.resources['core/oak-trees']!.tool).toBe('axe');
    expect(nodeVerb(b.resources['core/oak-trees']!)).toBe('fell');
    expect(nodeVerb({ tool: 'basket' })).toBe('gather');
    expect(nodeVerb({})).toBe('gather');
    expect(b.verbs.fell).toBe('core/woodcutting');
  });

  test('without an axe the tree is refused', () => {
    const bare = structuredClone(b);
    for (const starter of Object.values(bare.starters)) delete starter.kit;
    const s = begin(bare);
    expect(s.player.bag['core/axe']).toBeUndefined();
    expect(fell(bare, s, tree, 1000)).toEqual({ ok: false, error: 'You need an axe for this.' });
  });

  test('felling gives logs, trains woodcutting only and wears the axe', () => {
    const s = begin(b);
    const r = fell(b, s, tree, 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual({ e: 'gain', item: 'core/log', qty: 3 });
    expect(r.state.player.bag['core/log']).toBe(3);
    expect(r.state.player.xp['core/woodcutting']).toBe(3000);
    expect(r.state.player.xp['core/foraging']).toBeUndefined();
    expect(r.state.player.wear['core/axe']).toBe(1);
  });

  test('a felled tree does not give again before it has grown back', () => {
    const first = fell(b, begin(b), tree, 1000);
    if (!first.ok) throw new Error(first.error);
    const again = fell(b, first.state, tree, first.state.player.busyUntil);
    expect(again).toEqual({ ok: false, error: 'It has not grown back yet.' });
    const regrown = b.resources['core/oak-trees']!.respawn_ms;
    const later = fell(b, first.state, tree, first.state.player.busyUntil + regrown);
    expect(later.ok).toBe(true);
  });

  test('a tree asks for its level in woodcutting', () => {
    const hard = structuredClone(b);
    hard.resources['core/oak-trees']!.level = 2;
    expect(fell(hard, begin(hard), tree, 1000)).toEqual({ ok: false, error: 'Needs Woodcutting level 2.' });
  });

  test('a tree stands in the way, grown or felled; a plain node does not', () => {
    const s = begin(b);
    const walkable = makeWalkable(b);
    const at = b.instances[tree]!;
    expect(walkable(at.x, at.y, s.player)).toBe(false);
    const r = fell(b, s, tree, 1000);
    if (!r.ok) throw new Error(r.error);
    expect(walkable(at.x, at.y, r.state.player)).toBe(false);
    const bush = Object.values(b.instances).find((i) => i.source === 'core/berry-bushes')!;
    expect(walkable(bush.x, bush.y, s.player)).toBe(true);
  });
});

describe('the kit of a starter', () => {
  test.each(['core/forager', 'core/explorer'])('%s begins with its kit in the bag', (starter) => {
    const s = begin(b, starter);
    for (const stack of b.starters[starter]!.kit ?? []) expect(s.player.bag[stack.item]).toBe(stack.qty);
    expect(Object.keys(s.player.bag).length).toBeGreaterThan(0);
  });

  test('the kit is given once', () => {
    const s = begin(b);
    const again = step(b, s, { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
    expect(again.ok).toBe(false);
    expect(s.player.bag['core/axe']).toBe(1);
  });
});
