/**
 * The woven reed coat (docs/design/CLOTHING.md, appendix rows 472-477): its weaving page lies in the deep ruins as the
 * fourth row, on the edge just past the shard's, and reading it teaches the coat. A roll just below that edge still
 * gives the shard and one at its top gives nothing, so the page takes only the four points it was given.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type Rect, type State, drawBasisPoints, makeWalkable, mulDiv, near, newState, rareFindPermille, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const DEEP = 'core/ruins-deep';
const PAGE = 'core/reed-coat-scrap';
const COAT = 'core/woven-reed-coat';

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

/** Each row's [from, to) window in basis points, as the dig reads them: a rare or legendary row is scaled by luck. */
function windows(s: State): Record<string, [number, number]> {
  const luck = rareFindPermille(b, s);
  const out: Record<string, [number, number]> = {};
  let edge = 0;
  for (const f of b.treasures[DEEP]!.finds) {
    let bp = f.chance_pct * 100;
    const rarity = b.items[f.item]?.rarity ?? 'common';
    if (rarity === 'rare' || rarity === 'legendary') bp = mulDiv(bp, luck, 1000);
    out[f.item] = [edge, Math.min(10_000, edge + bp)];
    edge = Math.min(10_000, edge + bp);
  }
  return out;
}

/** Dig the deep ruins once with the spot's draw counter set so the roll lands in [lo, hi). */
function digWithRoll(lo: number, hi: number): State {
  const s = started();
  const [spot, rect] = spotOf(DEEP);
  const at = standNear(s, rect);
  let draws = 0;
  for (; draws < 100_000; draws++) {
    const roll = drawBasisPoints(s.seed, spot, draws);
    if (roll >= lo && roll < hi) break;
  }
  if (draws === 100_000) throw new Error(`no roll in [${lo}, ${hi})`);
  s.nodes[spot] = { readyAt: 0, draws };
  const r = step(b, s, { t: 'dig', spot, grade: 3, at }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('the woven reed coat', () => {
  test('is a tier-3 reedwork top, found, made at the workshop from a woven mat and a dyed cord', () => {
    const coat = b.items[COAT]!;
    expect(coat).toMatchObject({ class: 'core/reedwork', family: 'reed', tier: 3, weight: 2 });
    expect(coat.wear).toMatchObject({ slot: 'top', effects: [{ effect: 'gather_speed_pct', value: 8 }] });
    const recipe = b.recipes[COAT]!;
    expect(recipe).toMatchObject({ station: 'workshop', level: 6, known: 'found' });
    expect(recipe.inputs).toEqual([
      { item: 'core/woven-mat', qty: 1 },
      { item: 'core/dyed-cord', qty: 1 },
    ]);
  });

  test('the reed pair is reedwork of the reed family, its set unchanged', () => {
    for (const id of ['core/reed-hat', 'core/reed-sandals']) {
      expect(b.items[id]).toMatchObject({ class: 'core/reedwork', family: 'reed' });
      expect(b.items[id]!.wear?.set).toBe('core/reed-walker');
    }
  });

  test('the weaving page is the deep ruins\' fourth row, four points past the shard', () => {
    const s = started();
    const w = windows(s);
    const rows = b.treasures[DEEP]!.finds.map((f) => f.item);
    expect(rows).toEqual(['core/old-coin', 'core/stone-idol', 'core/pottery-shard', PAGE]);
    const [from, to] = w[PAGE]!;
    expect(from).toBe(w['core/pottery-shard']![1]);
    expect(to - from).toBe(mulDiv(400, rareFindPermille(b, s), 1000));
  });

  test('a roll on the page\'s edge digs it up, and reading it teaches the coat', () => {
    const [from, to] = windows(started())[PAGE]!;
    const s = digWithRoll(from, to);
    expect(s.player.bag[PAGE]).toBe(1);
    expect(s.player.recipes).not.toContain(COAT);
    const r = step(b, s, { t: 'learn', item: PAGE }, 60_000);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.recipes).toContain(COAT);
    expect(r.state.player.bag[PAGE] ?? 0).toBe(0);
  });

  test('just below the edge is still the shard, and at its top there is nothing', () => {
    const w = windows(started());
    const [from, to] = w[PAGE]!;
    const below = digWithRoll(from - 1, from);
    expect(below.player.bag['core/pottery-shard']).toBe(1);
    expect(below.player.bag[PAGE] ?? 0).toBe(0);
    const above = digWithRoll(to, to + 1);
    expect(above.player.bag[PAGE] ?? 0).toBe(0);
    expect(above.player.bag['core/pottery-shard'] ?? 0).toBe(0);
  });
});
