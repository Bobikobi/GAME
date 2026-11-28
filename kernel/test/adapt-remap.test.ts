/**
 * A save of the pixel valley opened on the painted one (public #919, gap V8): the painted map is a redrawn valley, not
 * the old one moved, so one shift cannot carry a save. The map of the new frame lists where the old frame's slots lay
 * (`map.remap`), and `adaptState` carries every saved tile slot by slot, ahead of the reach check.
 *
 * The painted valley here is a fixture (tools/test/fixtures/painted-valley: its map and its three wake tiles), set
 * against the valley the content ships today. When the painted valley ships, its map carries the remap itself.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { adaptState, newState, relocationOf, remapTile, step, type Bundle, type State, type Tile } from '../src';
import { inRect, makeStepRule, makeWalkable } from '../src/world';
import { assemble } from '../../tools/src/assemble.js';
import { readBoard } from '../../tools/src/board.js';
import { checkFrame } from '../../tools/src/check.js';
import { loadAll } from '../../tools/src/load.js';
import { loadBundle } from '../../tools/test/helpers/world.js';

const PAINTED = new URL('../../tools/test/fixtures/painted-valley/', import.meta.url);

const classic: Bundle = loadBundle();
const REMAP = { slots: classic.map.slots.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })) };

/** The content of today on the painted valley's map and wake tiles, its map one frame on and carrying the classic slots. */
function paintedBundle(): Bundle {
  const { files } = loadAll();
  const file = JSON.parse(readFileSync(new URL('map.json', PAINTED), 'utf8')) as { map: Record<string, unknown> };
  file.map = { ...file.map, frame: 2, remap: REMAP };
  const wakes = JSON.parse(readFileSync(new URL('wakes.json', PAINTED), 'utf8')) as Record<string, { x: number; y: number }>;
  for (const f of files) {
    const data = f.data as unknown as { type: string; id?: string; pocket?: { wake: { x: number; y: number } } };
    if (f.rel === 'core/map.json') f.data = file as unknown as typeof f.data;
    else if (data.type === 'pocket' && data.id && wakes[data.id] && data.pocket) data.pocket.wake = wakes[data.id]!;
  }
  const bundle = assemble(files, readBoard()).bundle;
  if (!bundle) throw new Error('The painted valley did not assemble into a bundle.');
  return { ...bundle, tag: 'painted-frame-2' };
}
const painted = paintedBundle();

/** A started player of the classic valley (frame 1, as every save so far) standing on `at`; `late` has mended everything there is to mend. */
function saveAt(at: Tile, late = false): State {
  const r = step(classic, newState(classic, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  const saved = structuredClone(r.state);
  saved.player.at = [at[0], at[1]];
  if (late) saved.player.restored = Object.keys(classic.restores).sort();
  return saved;
}

/** Every tile a foot reaches from a wake, for a player who has mended `restored` (the kernel's walk and step rules, as `relocationOf` reads them). */
function reach(b: Bundle, restored: string[]): (x: number, y: number) => boolean {
  const walkable = makeWalkable(b);
  const stepOpen = makeStepRule(b);
  const view = { ...newState(b, 1).player, restored };
  const { width, height } = b.map;
  const seen = new Uint8Array(width * height);
  const queue: Tile[] = [];
  for (const [x, y] of [[b.map.spawn.x, b.map.spawn.y], ...Object.values(b.pockets).map((p) => [p.wake.x, p.wake.y])] as Tile[]) {
    if (walkable(x, y, view) && seen[y * width + x] === 0) {
      seen[y * width + x] = 1;
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as Tile[]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny * width + nx] === 1) continue;
      if (!walkable(nx, ny, view) || !stepOpen(x, y, nx, ny)) continue;
      seen[ny * width + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  return (x, y) => x >= 0 && y >= 0 && x < width && y < height && seen[y * width + x] === 1;
}

/** For each classic slot, the first tile of it a foot reaches (rows, then columns): where a classic save can stand in that slot. */
function standingIn(b: Bundle, reached: (x: number, y: number) => boolean): { id: string; at: Tile }[] {
  return b.map.slots.flatMap((s) => {
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (reached(x, y)) return [{ id: s.id, at: [x, y] as Tile }];
    return [];
  });
}

const ALL_MENDED = Object.keys(classic.restores).sort();
const early = standingIn(classic, reach(classic, []));
const late = standingIn(classic, reach(classic, ALL_MENDED));
const standing = late;

describe('a classic save on the painted valley', () => {
  test('the fixture is the redrawn valley: the same 71 slots by id, on a smaller map', () => {
    expect([painted.map.width, painted.map.height]).toEqual([41, 30]);
    expect(painted.map.slots.map((s) => s.id).sort()).toEqual(classic.map.slots.map((s) => s.id).sort());
    expect(checkFrame(painted, {})).toEqual([]);
  });

  test('a late save standing in any reachable classic slot wakes on a reachable tile of the same slot', () => {
    expect(late.length).toBeGreaterThanOrEqual(20);
    const lost: string[] = [];
    for (const { id, at } of late) {
      const adapted = adaptState(painted, saveAt(at, true))!;
      const slot = painted.map.slots.find((s) => s.id === id)!;
      const [x, y] = adapted.player.at;
      if (!inRect(x, y, slot) || relocationOf(painted, adapted) !== undefined) lost.push(`${id} ${at.join(',')} -> ${x},${y}`);
      expect(adapted.frame).toBe(2);
    }
    expect(lost).toEqual([]);
  });

  test('an early save wakes on a reachable tile, in its slot whenever the painted slot is reachable before the mending', () => {
    const reachedNow = reach(painted, []);
    const outside: string[] = [];
    for (const { id, at } of early) {
      const adapted = adaptState(painted, saveAt(at))!;
      const [x, y] = adapted.player.at;
      expect(reachedNow(x, y)).toBe(true);
      const slot = painted.map.slots.find((s) => s.id === id)!;
      const open = standingIn({ ...painted, map: { ...painted.map, slots: [slot] } } as Bundle, reachedNow).length > 0;
      if (open) expect(inRect(x, y, slot)).toBe(true);
      else outside.push(id);
    }
    // the painted valley lays these two banks across the river from every wake: before the bridge is mended no foot reaches them
    expect(outside).toEqual(['core/reed-bank', 'core/moon-bank']);
  });

  test('an early save on the reed bank or the moon bank moves to the wake side and loses nothing it carried or placed', () => {
    for (const id of ['core/reed-bank', 'core/moon-bank']) {
      const { at } = early.find((e) => e.id === id)!;
      const saved = saveAt(at);
      const p = saved.player;
      p.bag = { ...p.bag, 'core/berry': 4 };
      p.own = { at: [at[0], at[1]], lit: 0, until: 1, log: 1 };
      p.carcasses = [{ id: 1, kind: 'core/roe', at: [at[0], at[1]], grade: 1, since: 0 }];
      p.ground = { [`${at[0]},${at[1]}`]: { 'core/berry': 2, 'core/stick': 1 } };
      p.stones = { taken: {}, placed: { [`${at[0]},${at[1]}`]: { 'core/stone': 3 } }, returns: [] };
      const a = adaptState(painted, saved)!.player;
      // the player stands on the nearest tile a foot reaches before the bridge is mended
      expect(reach(painted, [])(a.at[0], a.at[1])).toBe(true);
      expect(inRect(a.at[0], a.at[1], painted.map.slots.find((s) => s.id === id)!)).toBe(false);
      // nothing carried or placed is lost: the bag, the fire, the carcass, what lies dropped and the stone pile all carry over
      for (const [item, qty] of Object.entries(p.bag)) expect(a.bag[item]).toBe(qty);
      expect(a.own).not.toBeNull();
      expect(a.carcasses).toHaveLength(1);
      expect(Object.values(a.ground ?? {})).toEqual([{ 'core/berry': 2, 'core/stick': 1 }]);
      expect(Object.values(a.stones!.placed)).toEqual([{ 'core/stone': 3 }]);
    }
  });

  test('a save in no slot lands on a reachable tile of the painted map', () => {
    for (const at of [[0, 0], [63, 63], [32, 40], [50, 10]] as Tile[]) {
      const adapted = adaptState(painted, saveAt(at))!;
      const [x, y] = adapted.player.at;
      expect(x >= 0 && y >= 0 && x < 41 && y < 30).toBe(true);
      expect(reach(painted, [])(x, y)).toBe(true);
    }
  });

  test('every saved tile is carried and nothing is lost: the fire, a carcass, a snare, a cooldown, the stones, what lies dropped', () => {
    const bridge = classic.map.slots.find((s) => s.id === 'core/old-bridge')!;
    const spot = classic.map.creatures!.spots[0]!;
    const saved = saveAt([bridge.x, bridge.y]);
    const p = saved.player;
    p.own = { at: [bridge.x, bridge.y], lit: 0, until: 1, log: 1 };
    p.carcasses = [{ id: 1, kind: 'core/roe', at: [bridge.x + 1, bridge.y], grade: 1, since: 0 }];
    p.snares = [{ at: [bridge.x, bridge.y + 1], readyDay: 2 }];
    p.ground = { [`${bridge.x},${bridge.y}`]: { 'core/berry': 2 }, [`${bridge.x + 1},${bridge.y}`]: { 'core/berry': 3, 'core/stick': 1 } };
    p.preyReturns = { [`${spot.kind}@${spot.x},${spot.y}`]: 900 };
    const kin = classic.map.creatures!.spots.filter((s) => s.kind === spot.kind);
    p.preySeats = { [`${kin[0]!.kind}@${kin[0]!.x},${kin[0]!.y}`]: `${kin[1]!.kind}@${kin[1]!.x},${kin[1]!.y}` };
    p.stones = { taken: { '0': true }, placed: { [`${bridge.x},${bridge.y}`]: { 'core/stone': 2 } }, returns: [{ key: `${bridge.x + 1},${bridge.y}`, kind: 'core/stone', at: 5 }] };
    const a = adaptState(painted, saved)!.player;
    const now = painted.map.slots.find((s) => s.id === 'core/old-bridge')!;
    for (const at of [a.own!.at, a.carcasses![0]!.at, a.snares![0]!.at]) expect(inRect(at[0], at[1], now)).toBe(true);
    const held = (g: Record<string, Record<string, number>>) =>
      Object.values(g).reduce<Record<string, number>>((n, items) => {
        for (const [item, qty] of Object.entries(items)) n[item] = (n[item] ?? 0) + qty;
        return n;
      }, {});
    expect(held(a.ground ?? {})).toEqual({ 'core/berry': 5, 'core/stick': 1 });
    for (const key of Object.keys(a.ground ?? {})) {
      const [x, y] = key.split(',').map(Number) as Tile;
      expect(inRect(x, y, now)).toBe(true);
    }
    const piles = Object.entries(a.stones!.placed);
    expect(piles.map(([, pile]) => pile)).toEqual([{ 'core/stone': 2 }]);
    for (const key of [piles[0]![0], a.stones!.returns[0]!.key]) {
      const [x, y] = key.split(',').map(Number) as Tile;
      expect(inRect(x, y, now)).toBe(true);
    }
    // the stone spots are a new list on the redrawn map: none is counted as emptied
    expect(a.stones!.taken).toEqual({});
    // a cooldown follows its spot only when the carried tile is a spot of the same kind on the painted map
    const spots = new Set(painted.map.creatures!.spots.map((s) => `${s.kind}@${s.x},${s.y}`));
    for (const key of Object.keys(a.preyReturns ?? {})) expect(spots.has(key)).toBe(true);
    // a seat is kept only when both its spots are spots of one kind on the painted map, else the animal goes home
    for (const [home, seat] of Object.entries(a.preySeats ?? {})) {
      expect(spots.has(home) && spots.has(seat)).toBe(true);
      expect(home.split('@')[0]).toBe(seat.split('@')[0]);
    }
  });

  test('the carry is made once, and is pure', () => {
    const saved = saveAt(standing[0]!.at);
    const before = JSON.stringify(saved);
    const once = adaptState(painted, saved)!;
    expect(JSON.stringify(saved)).toBe(before);
    expect(adaptState({ ...painted, tag: 'painted-and-more' } as Bundle, once)!.player.at).toEqual(once.player.at);
  });
});

describe('remapTile', () => {
  const map = (remap: { id: string; x: number; y: number; w: number; h: number }[], slots: { id: string; x: number; y: number; w: number; h: number }[]): Bundle =>
    ({ ...classic, map: { ...classic.map, width: 20, height: 20, frame: 2, remap: { slots: remap }, slots: slots.map((s) => ({ ...s, kind: 'area' })) } }) as Bundle;

  test('a tile in an old slot lands on the same share of that slot today, in whole tiles', () => {
    const b = map([{ id: 'a', x: 10, y: 10, w: 4, h: 2 }], [{ id: 'a', x: 2, y: 3, w: 8, h: 1 }]);
    expect([10, 11, 12, 13].map((x) => remapTile(b, [x, 11]))).toEqual([[2, 3], [4, 3], [6, 3], [8, 3]]);
  });

  test('the smallest old slot that holds the tile wins, and a slot that left the map carries nothing', () => {
    const b = map(
      [
        { id: 'wide', x: 0, y: 0, w: 10, h: 10 },
        { id: 'gone', x: 4, y: 4, w: 1, h: 1 },
        { id: 'small', x: 4, y: 4, w: 2, h: 2 },
      ],
      [
        { id: 'wide', x: 0, y: 0, w: 10, h: 10 },
        { id: 'small', x: 15, y: 15, w: 2, h: 2 },
      ],
    );
    expect(remapTile(b, [4, 4])).toEqual([15, 15]);
    expect(remapTile(b, [1, 1])).toEqual([1, 1]);
  });

  test('a tile in no old slot keeps its step from the nearest slot\'s edge, clamped to the map', () => {
    const b = map([{ id: 'a', x: 10, y: 10, w: 2, h: 2 }], [{ id: 'a', x: 3, y: 3, w: 2, h: 2 }]);
    expect(remapTile(b, [13, 11])).toEqual([6, 4]);
    expect(remapTile(b, [0, 0])).toEqual([0, 0]);
  });
});

describe('checkFrame', () => {
  const at = (map: Partial<Bundle['map']>): string[] => checkFrame({ ...classic, map: { ...classic.map, ...map } } as Bundle, {}).map((i) => i.message);

  test('a later frame carries saves one way, by ids of today, each once', () => {
    const slot = classic.map.slots[0]!;
    const one = { id: slot.id, x: 0, y: 0, w: 1, h: 1 };
    expect(at({ frame: 2, remap: { slots: [one] } })).toEqual([]);
    expect(at({ frame: 2, moved: { dx: 1, dy: 1 }, remap: { slots: [one] } })).toEqual(['a map carries saves by `moved` or by `remap`, not both']);
    expect(at({ remap: { slots: [one] } })).toEqual(['only a map of frame 2 or more carries saves: raise `frame` with it']);
    expect(at({ frame: 2, remap: { slots: [one, one, { ...one, id: 'core/nowhere' }] } })).toEqual([
      `"${slot.id}" is listed twice`,
      `"core/nowhere" is no slot of today's map, so nothing saved in it can be carried`,
    ]);
  });
});
