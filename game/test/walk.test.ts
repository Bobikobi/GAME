/**
 * The free walk (NEXT 22): the body at art-pixel precision, eight directions on the keyboard and any angle on
 * the stick, a box at the feet against refused tiles, four-connected tile reports, and the faced tile after a
 * diagonal walk. Measurable lines 1 to 4 of section 22, without a renderer.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Bundle, type Tile, makeWalkable, npcTile, placedAt } from '@game/kernel';
import { STEP_MS } from '../src/config';
import { Controls, DIRS, type Dir, STICK_DEAD, STICK_FULL, stickFrom } from '../src/input';
import { s1Use } from '../src/net/s1';
import { Session } from '../src/session';
import { ART_PX, BODY_BOX, type Facing8, SECTOR_LEAD_DEG, Walker, agrees, canEnter, diagonalSheet, facedTile, facing8For, facingFor, landStep } from '../src/walking';
import { loadBundle, seedFor } from '../../tools/test/helpers/world';

/** About sixty frames a second, as the scene runs. */
const FRAME = 16;
const open = () => true;

/** Walk `ms` of frames with one input; every tile entered, in order. */
function hold(w: Walker, input: readonly [number, number], ms: number, isOpen: (x: number, y: number) => boolean = open): Tile[] {
  const tiles: Tile[] = [];
  for (let t = 0; t < ms; t += FRAME) tiles.push(...w.frame(input, Math.min(FRAME, ms - t), STEP_MS, isOpen));
  return tiles;
}

/** The body box overlaps tile x, y: the box is half-open, so a box touching a tile's edge does not. */
function overlaps(w: Walker, x: number, y: number): boolean {
  const left = w.x - BODY_BOX.w / 2;
  const top = w.y - BODY_BOX.h / 2;
  return left < (x + 1) * ART_PX && left + BODY_BOX.w > x * ART_PX && top < (y + 1) * ART_PX && top + BODY_BOX.h > y * ART_PX;
}

function fourConnected(from: Tile, tiles: Tile[]): boolean {
  let at = from;
  for (const t of tiles) {
    if (Math.abs(t[0] - at[0]) + Math.abs(t[1] - at[1]) !== 1) return false;
    at = t;
  }
  return true;
}

describe('the walk on open ground (measurable 1)', () => {
  test('holding right for 1.9 s moves the feet 10 tiles', () => {
    const w = new Walker();
    w.place([0, 0]);
    const x0 = w.x;
    hold(w, [1, 0], 1900);
    expect(Math.abs((w.x - x0) / ART_PX - 10)).toBeLessThanOrEqual(0.3);
    expect(w.y).toBe(ART_PX / 2);
  });

  test('right and down for 1.9 s move the feet 10 tiles in a straight line, 7.07 on each axis', () => {
    const controls = keyboard();
    controls.down('ArrowRight');
    controls.down('ArrowDown');
    const input = controls.c.vector();
    expect(Math.hypot(input[0], input[1])).toBeCloseTo(1, 9);
    const w = new Walker();
    w.place([0, 0]);
    const [x0, y0] = [w.x, w.y];
    for (let t = 0; t < 1900; t += FRAME) {
      w.frame(input, Math.min(FRAME, 1900 - t), STEP_MS, open);
      expect(Math.abs(w.x - x0 - (w.y - y0))).toBeLessThan(1e-6);
    }
    expect(Math.abs((w.x - x0) / ART_PX - 7.07)).toBeLessThanOrEqual(0.3);
    expect(Math.abs((w.y - y0) / ART_PX - 7.07)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(Math.hypot(w.x - x0, w.y - y0) / ART_PX - 10)).toBeLessThanOrEqual(0.3);
  });

  test('a frame longer than a tile takes walks one tile at most', () => {
    // a slow machine, or a tab coming back: a quarter of a second is the longest frame the scene allows
    const w = new Walker();
    w.place([0, 0]);
    const tiles = w.frame([1, 0], 250, STEP_MS, open);
    expect((w.x - ART_PX / 2) / ART_PX).toBeLessThanOrEqual(1);
    expect(tiles.length).toBeLessThanOrEqual(1);
  });

  test('the stride is the distance walked: one tile of it per tile', () => {
    const w = new Walker();
    w.place([0, 0]);
    hold(w, [0, 1], 3 * STEP_MS);
    expect(w.walked / ART_PX).toBeCloseTo(3, 6);
  });
});

describe('stopping and walls (measurable 2)', () => {
  test('on release the body stops in the same frame', () => {
    const w = new Walker();
    w.place([0, 0]);
    hold(w, [0.6, 0.8], 500);
    expect(w.moving).toBe(true);
    const [x, y] = [w.x, w.y];
    expect(w.frame([0, 0], FRAME, STEP_MS, open)).toEqual([]);
    expect(w.moving).toBe(false);
    expect([w.x, w.y]).toEqual([x, y]);
  });

  test('walking into walls at every angle for 200 frames, the box never overlaps a refused tile, and every tile report is four-connected', () => {
    // a room of 5 x 5 open tiles, walled around, with a pillar and two tiles that meet only at a corner
    const refused = new Set(['3,3', '1,4', '2,5', '4,1']);
    const isOpen = (x: number, y: number) => x >= 1 && x <= 5 && y >= 1 && y <= 5 && !refused.has(`${x},${y}`);
    const walls: Tile[] = [];
    for (let y = 0; y <= 6; y++) for (let x = 0; x <= 6; x++) if (!isOpen(x, y)) walls.push([x, y]);
    for (const start of [[2, 2], [4, 4], [1, 5], [5, 5]] as Tile[]) {
      for (let a = 0; a < 64; a++) {
        const angle = (a / 64) * 2 * Math.PI;
        const w = new Walker();
        w.place(start);
        let from: Tile = start;
        for (let f = 0; f < 200; f++) {
          // long and short frames alike: a frame of 250 ms is the longest the scene allows
          const tiles = w.frame([Math.cos(angle), Math.sin(angle)], f % 50 === 0 ? 250 : FRAME, STEP_MS, isOpen);
          // checked plainly and failed by hand: 51,200 frames of expect() calls outlast the test timeout on a busy machine
          if (!fourConnected(from, tiles)) expect.fail(`angle ${a}/64 from ${start.join(',')}: a report is not four-connected`);
          if (tiles.length > 0) from = tiles[tiles.length - 1]!;
          const hit = walls.find(([x, y]) => overlaps(w, x, y));
          if (hit) expect.fail(`angle ${a}/64 from ${start.join(',')} overlaps ${hit.join(',')}`);
        }
      }
    }
  });

  test('no corner is cut between two refused tiles', () => {
    // from 1,1 the tile 2,2 lies past the corner where 2,1 and 1,2 meet
    const isOpen = (x: number, y: number) => !((x === 2 && y === 1) || (x === 1 && y === 2));
    const w = new Walker();
    w.place([1, 1]);
    const tiles = hold(w, [Math.SQRT1_2, Math.SQRT1_2], 2000, isOpen);
    expect(tiles).toEqual([]);
    expect(w.tile()).toEqual([1, 1]);
  });

  test('a diagonal walk along a wall slides along it', () => {
    const isOpen = (_x: number, y: number) => y <= 1;
    const w = new Walker();
    w.place([1, 1]);
    hold(w, [Math.SQRT1_2, Math.SQRT1_2], 5 * STEP_MS, isOpen);
    expect(w.y).toBe(2 * ART_PX - BODY_BOX.h / 2);
    expect(w.tile()[0]).toBeGreaterThanOrEqual(4);
  });

  test('a straight walk that meets a corner is eased onto its lane', () => {
    // a lane one tile wide going down from 2,1; the body stands off its middle, its box over the wall at 1,2
    const isOpen = (x: number, y: number) => y <= 1 || x === 2;
    const w = new Walker();
    w.place([2, 1]);
    w.x -= 20;
    const tiles = hold(w, [0, 1], 4 * STEP_MS, isOpen);
    // the ease lifts the box clear of the wall, and the walk goes on down the lane
    expect(w.x - BODY_BOX.w / 2).toBeGreaterThanOrEqual(2 * ART_PX);
    expect(tiles.every(([tileX]) => tileX === 2)).toBe(true);
    expect(w.tile()[1]).toBeGreaterThanOrEqual(4);
  });
});

describe('the facing', () => {
  test('follows the leading axis, and near 45 degrees it does not flicker', () => {
    const at = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    expect(facingFor(at(10), 'up')).toBe('right');
    expect(facingFor(at(80), 'right')).toBe('down');
    // a walk wavering between 40 and 50 degrees keeps whichever facing it had
    for (const deg of [40, 44, 46, 50]) {
      expect(facingFor(at(deg), 'right')).toBe('right');
      expect(facingFor(at(deg), 'down')).toBe('down');
    }
    // past the lead it turns
    expect(facingFor(at(55), 'right')).toBe('down');
    expect(facingFor(at(35), 'down')).toBe('right');
    expect(facingFor([0, 0], 'left')).toBe('left');
  });
});

describe('the phone stick', () => {
  test('reads any angle, nothing inside the dead zone, and full speed at 40% of the width', () => {
    const width = 100;
    expect(stickFrom(width * STICK_DEAD - 1, 0, width)).toEqual([0, 0]);
    const full = stickFrom(0, -width * STICK_FULL, width);
    expect(full[0]).toBeCloseTo(0, 9);
    expect(full[1]).toBeCloseTo(-1, 9);
    const far = stickFrom(30, 40, width);
    expect(Math.hypot(...far)).toBeCloseTo(1, 9);
    expect(far[0] / far[1]).toBeCloseTo(30 / 40, 9);
    const half = stickFrom(((STICK_DEAD + STICK_FULL) / 2) * width, 0, width);
    expect(half[0]).toBeCloseTo(0.5, 9);
  });
});

/** Controls with a stand-in window: key presses go to its own listeners. */
function keyboard(): { c: Controls; down: (code: string) => void; up: (code: string) => void } {
  const on = new Map<string, (e: unknown) => void>();
  vi.stubGlobal('window', { addEventListener: (type: string, fn: (e: unknown) => void) => on.set(type, fn) });
  const c = new Controls();
  const event = (code: string) => ({ code, target: null, ctrlKey: false, metaKey: false, altKey: false, repeat: false, preventDefault: () => undefined });
  return { c, down: (code) => on.get('keydown')!(event(code)), up: (code) => on.get('keyup')!(event(code)) };
}

describe('the keyboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('two arrows walk a diagonal as fast as one walks straight, and opposite arrows cancel', () => {
    const k = keyboard();
    k.down('ArrowLeft');
    expect(k.c.vector()).toEqual([-1, 0]);
    k.down('ArrowUp');
    const [x, y] = k.c.vector();
    expect(x).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(y).toBeCloseTo(-Math.SQRT1_2, 9);
    k.down('ArrowRight');
    expect(k.c.vector()).toEqual([0, -1]);
    k.up('ArrowUp');
    expect(k.c.vector()).toEqual([0, 0]);
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('after a diagonal walk an action hits the tile in front of the feet (measurable 4)', () => {
  let b: Bundle;

  beforeAll(() => {
    b = loadBundle();
  });

  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    s1Use(() => {});
  });

  afterEach(() => vi.unstubAllGlobals());

  /**
   * A fresh forager on the real map walks a diagonal of two tiles to the tile beside `target`, facing it on
   * the way, and stops when the feet's centre is there. Every tile is told to the kernel, as the scene does.
   */
  /** Walks a diagonal of two tiles up to `target`; a forager's game, or one woken in `pocket` by its seed (races, 22.10). */
  function walkUpTo(target: Tile, pocket?: string): Session {
    const s = pocket === undefined ? Session.fresh(b) : Session.fresh(b, seedFor(b, pocket));
    const begin = pocket === undefined ? { starter: 'core/forager' } : { race: 'core/human' };
    expect(s.act({ t: 'start', ...begin, name: 'Tess' }).ok).toBe(true);
    const walkable = makeWalkable(b);
    const nodeAt = new Map<string, string>();
    for (const [id, inst] of Object.entries(b.instances)) nodeAt.set(`${inst.x},${inst.y}`, id);
    const enter = (x: number, y: number) => canEnter(b, walkable, nodeAt, s, x, y);
    for (const d of Object.keys(DIRS) as Dir[]) {
      const [dx, dy] = DIRS[d];
      const end: Tile = [target[0] - dx, target[1] - dy];
      for (const side of [1, -1]) {
        // the diagonal leans on the facing's axis and one side of it
        const [px, py] = [dy * side, dx * side];
        const start: Tile = [end[0] - 2 * (dx + px), end[1] - 2 * (dy + py)];
        let clear = true;
        for (let y = Math.min(start[1], end[1]); y <= Math.max(start[1], end[1]); y++) {
          for (let x = Math.min(start[0], end[0]); x <= Math.max(start[0], end[0]); x++) clear &&= enter(x, y);
        }
        if (!clear) continue;
        s.pos = [start[0], start[1]];
        s.state.player.at = [start[0], start[1]];
        s.facing = d;
        const w = new Walker();
        w.place(start);
        const len = Math.hypot(dx + px, dy + py);
        const input: [number, number] = [(dx + px) / len, (dy + py) / len];
        const told: Tile[] = [];
        for (let f = 0; f < 200 && (s.pos[0] !== end[0] || s.pos[1] !== end[1]); f++) {
          s.advance(FRAME);
          s.facing = facingFor(input, s.facing);
          for (const tile of w.frame(input, FRAME, STEP_MS, enter)) {
            told.push(tile);
            landStep(s, tile);
          }
        }
        expect(s.pos).toEqual(end);
        expect(fourConnected(start, told)).toBe(true);
        expect(s.state.player.at).toEqual(end);
        // both axes moved: it was a diagonal walk
        expect(Math.abs(end[0] - start[0])).toBe(2);
        expect(Math.abs(end[1] - start[1])).toBe(2);
        return s;
      }
    }
    throw new Error(`no open diagonal of two tiles toward ${target.join(',')}`);
  }

  test('pick: the faced tile is the plant, and the kernel takes the gather', () => {
    const id = Object.keys(b.instances).find((n) => {
      const inst = placedAt(b, n);
      const r = inst?.kind === 'resource' ? b.resources[inst.source] : undefined;
      return r && r.level <= 1 && !r.tool && !r.hours && !r.unlock;
    });
    if (!id) throw new Error('no plant a fresh forager can pick');
    const inst = placedAt(b, id)!;
    const s = walkUpTo([inst.x, inst.y]);
    expect(facedTile(s)).toEqual([inst.x, inst.y]);
    expect(s.act({ t: 'gather', node: id, grade: 3, at: s.pos })).toMatchObject({ ok: true });
  });

  test('dig: the faced tile is the spot, and the kernel takes the dig', () => {
    // a pocket's own spot is a find by hand: no tool, and whoever wakes in that pocket may dig it
    const id = Object.keys(b.instances).find((n) => {
      const inst = b.instances[n]!;
      const d = inst.kind === 'treasure' ? b.treasures[inst.source] : undefined;
      return d?.pocket !== undefined && d.tool === undefined;
    });
    if (!id) throw new Error("no spot of a pocket's own");
    const inst = b.instances[id]!;
    const s = walkUpTo([inst.x, inst.y], b.treasures[inst.source]!.pocket);
    expect(facedTile(s)).toEqual([inst.x, inst.y]);
    expect(s.act({ t: 'dig', spot: id, grade: 3, at: s.pos })).toMatchObject({ ok: true });
  });

  test('talk: the faced tile is the one the person stands on', () => {
    const npc = Object.keys(b.npcs).find((n) => npcTile(b, n));
    if (!npc) throw new Error('no one stands on the map');
    const at = npcTile(b, npc)!;
    const s = walkUpTo(at);
    expect(facedTile(s)).toEqual(at);
  });
});

describe('the drawn facing (eight sectors, the rig of 23.10)', () => {
  const at = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

  test('is the nearest of the eight to the motion, a 45 degree walk drawn as a diagonal', () => {
    const want: [number, Facing8][] = [
      [0, 'right'], [45, 'down_right'], [90, 'down'], [135, 'down_left'],
      [180, 'left'], [225, 'up_left'], [270, 'up'], [315, 'up_right'], [-45, 'up_right'],
    ];
    for (const [deg, look] of want) expect(facing8For(at(deg), deg === 90 ? 'up' : 'down'), `${deg} degrees`).toBe(look);
  });

  test('keeps its sector past the edge by the four-way lead, so a walk along an edge does not flicker', () => {
    expect(SECTOR_LEAD_DEG).toBeCloseTo(6.34, 2);
    // a walk wavering between 18 and 27 degrees keeps whichever facing it had
    for (const deg of [18, 22, 23, 27]) {
      expect(facing8For(at(deg), 'right')).toBe('right');
      expect(facing8For(at(deg), 'down_right')).toBe('down_right');
    }
    // past the lead it turns
    expect(facing8For(at(30), 'right')).toBe('down_right');
    expect(facing8For(at(15), 'down_right')).toBe('right');
    expect(facing8For([0, 0], 'up_left')).toBe('up_left');
  });

  test('a diagonal leans on the four-way facing the faced tile is read from', () => {
    expect(agrees('down_right', 'right')).toBe(true);
    expect(agrees('down_right', 'down')).toBe(true);
    expect(agrees('down_right', 'left')).toBe(false);
    expect(agrees('up', 'up')).toBe(true);
    // the two picks together: a walk at 45 degrees faces a four-way axis and draws the diagonal on it
    const input = at(45);
    expect(agrees(facing8For(input, 'right'), facingFor(input, 'right'))).toBe(true);
  });

  test('draws the rig sheet, the right side mirrored, and the four-way sheet while a look has no diagonal yet', () => {
    const rig = new Set(['chars/forager_down_left', 'chars/forager_up_left']);
    const has = (k: string) => rig.has(k);
    expect(diagonalSheet('chars/forager_down', 'down_left', 'left', has)).toEqual({ key: 'chars/forager_down_left', flip: false });
    expect(diagonalSheet('chars/forager_down', 'down_right', 'right', has)).toEqual({ key: 'chars/forager_down_left', flip: true });
    expect(diagonalSheet('chars/forager_down', 'up_right', 'up', has)).toEqual({ key: 'chars/forager_up_left', flip: true });
    // no diagonal for an axis, for a look without the rig, or for a diagonal that does not lean on the facing
    expect(diagonalSheet('chars/forager_down', 'left', 'left', has)).toBeUndefined();
    expect(diagonalSheet('chars/explorer_down', 'down_left', 'left', has)).toBeUndefined();
    expect(diagonalSheet('chars/forager_down', 'down_left', 'right', has)).toBeUndefined();
  });
});
