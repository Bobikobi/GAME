/**
 * The search window's logic (docs/design/SEARCH.md): which rows it lists, what an empty one says, which prop
 * the A button reads as a searchable, and that its text is 16 px or more (G29). The panel itself is DOM and has no
 * test of its own: it draws exactly `searchRows`, and every change goes through the kernel's `search` and `take`.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, newState, searchDawn, step } from '@game/kernel';
import { SEARCH_EMPTY, describe as describeEvent, searchRows, searchableOn } from '../src/text';
import { bfsNear, loadBundle } from '../../tools/test/helpers/world';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

const LOG = 'core/hollow-log';

/** A started character that has searched the log on a seed that holds something. */
function searched(): { s: State; at: [number, number]; rows: string[] } {
  const prop = b.map.props.find((p) => p.id === b.searchables[LOG]!.place.prop)!;
  for (let seed = 1; seed < 500; seed++) {
    const r = step(b, newState(b, seed), { t: 'start', race: 'core/human', name: 'Seeker' }, 0);
    if (!r.ok) throw new Error(r.error);
    const view = { restored: Object.values(b.restores).filter((x) => x.passable).map((x) => x.id), camp: [] as string[] };
    const at = bfsNear(b, view, r.state.player.at, prop)!.at(-1)! as [number, number];
    const f = step(b, r.state, { t: 'search', spot: LOG, at }, 0);
    if (f.ok && f.state.searched[LOG]!.rows.length >= 2) return { s: f.state, at, rows: f.state.searched[LOG]!.rows };
  }
  throw new Error('no seed');
}

describe('the rows of the window', () => {
  test('are the kept rows in order, each with its place for a take, and shrink as rows are taken', () => {
    const { s, at, rows } = searched();
    const shown = searchRows(b, s, 0, LOG);
    expect(shown.map((r) => r.item)).toEqual(rows);
    expect(shown.map((r) => r.index)).toEqual(rows.map((_, i) => i));
    expect(shown[0]!.name).toBe(b.items[rows[0]!]!.name);
    const taken = step(b, s, { t: 'take', spot: LOG, row: 0, at }, 1);
    if (!taken.ok) throw new Error(taken.error);
    expect(searchRows(b, taken.state, 1, LOG).map((r) => r.item)).toEqual(rows.slice(1));
  });

  test('are empty before a search, for a save without the field, and after the dawn that clears the day', () => {
    const { s } = searched();
    expect(searchRows(b, newState(b, 1), 0, LOG)).toEqual([]);
    const old = structuredClone(s) as Partial<State>;
    delete old.searched;
    expect(searchRows(b, old as State, 0, LOG)).toEqual([]);
    const tomorrow = b.params.day_length_ms * 2;
    expect(searchDawn(b, tomorrow)).toBeGreaterThan(searchDawn(b, 0));
    expect(searchRows(b, s, tomorrow, LOG)).toEqual([]);
  });

  test('an empty window says one short line', () => {
    expect(SEARCH_EMPTY).toBe('Nothing here.');
    expect(SEARCH_EMPTY.split(/\s+/).length).toBeLessThanOrEqual(4);
  });
});

describe('the A button', () => {
  test('reads a prop as a searchable by its id, and no other prop', () => {
    expect(searchableOn(b, 'core/hollow-log')).toBe(LOG);
    expect(searchableOn(b, 'core/marked-stone')).toBeUndefined();
    for (const sr of Object.values(b.searchables)) expect(searchableOn(b, sr.place.prop)).toBe(sr.id);
  });

  test('a search itself raises no toast: the window is the answer', () => {
    const { s } = searched();
    expect(describeEvent(b, s, { e: 'search', spot: LOG, rows: [] })).toBeUndefined();
  });
});

describe('text size (G29)', () => {
  test("every font-size in the search window's rules is 16 px or more", () => {
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const rules = [...css.matchAll(/\.panel\.search[^{]*\{([^}]*)\}/g)].map((m) => m[1]!);
    expect(rules.length).toBeGreaterThan(3);
    const sizes = rules.flatMap((r) => [...r.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
    expect(sizes.length).toBeGreaterThan(3);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(16);
    // the row's `font:` shorthand is not used, so no size hides there
    expect(rules.some((r) => /font:\s*\d/.test(r))).toBe(false);
  });
});
