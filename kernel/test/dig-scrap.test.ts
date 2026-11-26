/**
 * A dig draws only among recipes neither known nor carried (DECISIONS.md, 2026-10-10): a scrap of a recipe the player
 * knows or already carries is left out of the draw, and the other rows keep their own chances. A known scrap is never
 * drawn, an unknown one still is, and with a scrap blocked the dig gives its other rows or nothing.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type Rect, type State, drawBasisPoints, makeWalkable, mulDiv, near, newState, rareFindPermille, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const DEEP = 'core/ruins-deep';
const GATE = 'core/ruins-gate';
const PAGE = 'core/reed-coat-scrap';
const COAT = 'core/woven-reed-coat';
const STEW = 'core/stew-scrap';
const HERB_STEW = 'core/herb-stew';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

function started(): State {
  const r = step(b, newState(b, 11), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  const s = r.state;
  s.player.xp[b.verbs.dig] = 1_000_000_000;
  const trowel = Object.values(b.items).find((it) => it.tool?.kind === 'trowel');
  if (!trowel) throw new Error('no trowel in the content');
  s.player.bag[trowel.id] = 1;
  return s;
}

function spotOf(treasure: string): [string, Rect] {
  const found = Object.entries(b.instances).find(([, i]) => i.source === treasure);
  if (!found) throw new Error(`no dig spot for ${treasure}`);
  return [found[0], { x: found[1].x, y: found[1].y, w: 1, h: 1 }];
}

function standNear(s: State, target: Rect): [number, number] {
  const walkable = makeWalkable(b);
  for (let y = target.y - 1; y <= target.y + target.h; y++) {
    for (let x = target.x - 1; x <= target.x + target.w; x++) {
      if (near([x, y], target) && walkable(x, y, s.player)) {
        s.player.at = [x, y];
        return [x, y];
      }
    }
  }
  throw new Error('no walkable tile at the target');
}

/** The [from, to) window in basis points of one find row, read as the dig reads it while no scrap is blocked. */
function rowWindow(s: State, treasure: string, item: string): [number, number] {
  const luck = rareFindPermille(b, s);
  let edge = 0;
  for (const f of b.treasures[treasure]!.finds) {
    let bp = f.chance_pct * 100;
    const rarity = b.items[f.item]?.rarity ?? 'common';
    if (rarity === 'rare' || rarity === 'legendary') bp = mulDiv(bp, luck, 1000);
    if (f.item === item) return [edge, Math.min(10_000, edge + bp)];
    edge = Math.min(10_000, edge + bp);
  }
  throw new Error(`${item} is not a find of ${treasure}`);
}

/** A draws counter whose roll lands in the row's window while no scrap is blocked. */
function drawsOn(s: State, treasure: string, item: string): number {
  const [spot] = spotOf(treasure);
  const [lo, hi] = rowWindow(s, treasure, item);
  for (let draws = 0; draws < 100_000; draws++) {
    const roll = drawBasisPoints(s.seed, spot, draws);
    if (roll >= lo && roll < hi) return draws;
  }
  throw new Error(`no roll in [${lo}, ${hi})`);
}

function dig(s: State, treasure: string, draws: number) {
  const [spot, rect] = spotOf(treasure);
  const at = standNear(s, rect);
  s.nodes[spot] = { readyAt: 0, draws };
  const r = step(b, s, { t: 'dig', spot, grade: 3, at }, 0);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('a dig draws only among recipes neither known nor carried', () => {
  test('an unknown scrap is still drawn: the gate rubble yields the stew scrap', () => {
    const s = started();
    const r = dig(s, GATE, drawsOn(s, GATE, STEW));
    expect(r.state.player.bag[STEW]).toBe(1);
    expect(r.state.player.recipes).not.toContain(HERB_STEW);
  });

  test('a known recipe is never drawn: the coat page is skipped once the coat is known', () => {
    const s = started();
    const draws = drawsOn(s, DEEP, PAGE);
    s.player.recipes = [...s.player.recipes, COAT];
    const r = dig(s, DEEP, draws);
    expect(r.state.player.bag[PAGE] ?? 0).toBe(0);
    expect(r.state.player.recipes).toContain(COAT);
  });

  test('a carried scrap is never drawn again', () => {
    const s = started();
    const draws = drawsOn(s, DEEP, PAGE);
    s.player.bag[PAGE] = 1;
    const r = dig(s, DEEP, draws);
    expect(r.state.player.bag[PAGE]).toBe(1);
  });

  test('the other rows still draw when a scrap is skipped', () => {
    const s = started();
    s.player.recipes = [...s.player.recipes, COAT];
    const r = dig(s, DEEP, drawsOn(s, DEEP, 'core/pottery-shard'));
    expect(r.state.player.bag['core/pottery-shard']).toBe(1);
    expect(r.state.player.bag[PAGE] ?? 0).toBe(0);
  });
});
