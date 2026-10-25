/**
 * The search rules (docs/design/SEARCH.md): what `pnpm check` tests on every searchable. Each row is an
 * item that has a value (so it is a thing the world already prices, never the only source of itself),
 * the prop it hangs on exists, and none stands in the opening's first-path area (rule 9), so a player
 * who never presses A loses nothing and one who does is not pulled off the road.
 */
import { type Bundle, type Rect, campTile, findSlot } from '@game/kernel';
import type { Issue } from './load';
import { openingQuests } from './play';

/** Tiles of margin around the opening's places and road inside which nothing may be searched. */
export const OPENING_MARGIN = 4;

/** How many links after the shared opening chain still belong to the first fifteen minutes (the afternoon tasks and the arch). */
export const OPENING_DEPTH = 3;

/**
 * The opening's first-path area as the data marks it, since the map plan marks none: every tile within
 * OPENING_MARGIN (Chebyshev) of the road (path-tagged ground), the map's spawn, every wake tile, and the places
 * of the opening quests and of the quests up to OPENING_DEPTH links after them (their steps, their givers
 * and the props their riddles read). Quests of an expedition's chain are outside the first path.
 */
export function openingRects(b: Bundle): Rect[] {
  const rects: Rect[] = [];
  const at = (x: number, y: number): Rect => ({ x, y, w: 1, h: 1 });
  const slot = (id: string | undefined) => {
    const s = id === undefined ? undefined : findSlot(b.map, id);
    if (s) rects.push(s);
  };
  const prop = (id: string) => {
    const p = b.map.props.find((o) => o.id === id);
    if (p) rects.push(p);
  };
  rects.push(at(b.map.spawn.x, b.map.spawn.y));
  for (const p of Object.values(b.pockets)) {
    rects.push(at(p.wake.x, p.wake.y));
    for (const t of Object.values(b.treasures)) if (t.pocket === p.id) slot(t.place.slot);
  }

  const chained = new Set(Object.values(b.expeditions).flatMap((x) => x.chain));
  const opening = openingQuests(b);
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen: string[] = []): number => {
    if (opening.has(id)) return 0;
    if (depth.has(id)) return depth.get(id)!;
    const q = b.quests[id];
    if (!q || seen.includes(id)) return Infinity;
    const d = 1 + Math.max(0, ...(q.requires ?? []).map((r) => depthOf(r, [...seen, id])));
    depth.set(id, d);
    return d;
  };
  for (const q of Object.values(b.quests)) {
    if (chained.has(q.id) || depthOf(q.id) > OPENING_DEPTH) continue;
    if (q.giver) slot(b.npcs[q.giver]?.place.slot);
    for (const st of q.steps) {
      if (st.kind === 'visit') slot(st.slot);
      else if (st.kind === 'restore') slot(b.restores[st.restore]?.place.slot);
      else if (st.kind === 'build') {
        const c = b.camps[st.camp];
        const t = c && campTile(b, c.slot);
        if (t) rects.push(at(t[0], t[1]));
      } else if (st.kind === 'tend') prop(st.fire);
      else if (st.kind === 'riddle') {
        st.props.forEach(prop);
        if (st.answer.kind === 'dig') slot(b.treasures[st.answer.treasure]?.place.slot);
        else slot(st.answer.slot);
      } else if (st.kind === 'find') {
        for (const t of Object.values(b.treasures)) if (t.finds.some((f) => f.item === st.item)) slot(t.place.slot);
      }
    }
  }
  const { width, height } = b.map;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (b.map.legend[b.map.ground[y]?.[x] ?? '']?.tag === 'path') rects.push(at(x, y));
  return rects;
}

/** Whether a rectangle comes within OPENING_MARGIN tiles of any of the rectangles. */
export function nearOpening(r: Rect, area: readonly Rect[]): boolean {
  return area.some(
    (a) => r.x < a.x + a.w + OPENING_MARGIN && r.x + r.w > a.x - OPENING_MARGIN && r.y < a.y + a.h + OPENING_MARGIN && r.y + r.h > a.y - OPENING_MARGIN,
  );
}

export function checkSearch(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const area = openingRects(b);
  for (const sr of Object.values(b.searchables)) {
    const file = origin[sr.id] ?? sr.file;
    const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
    sr.rows.forEach((row, i) => {
      if (b.items[row.item] && b.values[row.item] === undefined) {
        err(`search.rows.${i}.item`, `${row.item} has no value: a search gives only things another source already prices, so it is never the only way to get one (SEARCH.md rule 6)`);
      }
    });
    const prop = b.map.props.find((p) => p.id === sr.place.prop);
    if (prop && nearOpening(prop, area)) {
      err('search.place.prop', `${sr.place.prop} at (${prop.x}, ${prop.y}) is within ${OPENING_MARGIN} tiles of the opening's first path (the road, the wake tiles and the places of the first tasks): move it away (SEARCH.md rule 9)`);
    }
  }
  return issues;
}
