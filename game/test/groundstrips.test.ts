/**
 * The ground pages baked in strips (#879): a page the walk reaches is painted a few tiles at a time in idle slices, the
 * pages the view touches first and the ring ahead of the figure's heading next, and what comes out is the pixels the whole-page
 * bake made. The painter here is a plain deterministic one over pixel buffers, with an animated tile and a crown
 * that overhangs the strip's edges, as the world's own does.
 */
import { describe, expect, test } from 'vitest';
import { CHUNK, GroundChunks, STRIP_COLS, STRIP_ROWS, pageOrder, stripsOf, type ChunkPainter } from '../src/groundchunks';
import { IdleQueue, type Slice } from '../src/stream';
import { fakeScene, type FakeCanvas } from './groundfake';

const UNIT = 16;
const DENSITY = 4;
const PX = UNIT * DENSITY;
const SIDE = CHUNK * UNIT;

/** Tile (x, y) at a frame: opaque grey-blues that differ by tile, an animated tile in nine, a half see-through one in seven. */
function tileColour(x: number, y: number, frame: number): [number, number, number, number] {
  const animated = (x * 7 + y * 3) % 9 === 0;
  const seed = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  return [seed & 255, (seed >> 8) & 255, ((seed >> 16) & 255) ^ (animated ? frame * 40 : 0), (x + y) % 7 === 0 ? 128 : 255];
}

/** A painter in the world's shape: tiles into the rectangle's corner, then crowns that hang over the tile rows and columns. */
const painter = (): ChunkPainter => (tex, frame, tx0, ty0, tw, th) => {
  const c = tex as unknown as FakeCanvas;
  let animated = false;
  const put = (px: number, py: number, rgba: readonly number[]) => {
    if (px < 0 || py < 0 || px >= tw * PX || py >= th * PX) return;
    c.data.set(rgba, (py * c.width + px) * 4);
  };
  for (let y = ty0; y < ty0 + th; y++) {
    for (let x = tx0; x < tx0 + tw; x++) {
      if ((x * 7 + y * 3) % 9 === 0) animated = true;
      const rgba = tileColour(x, y, frame);
      for (let j = 0; j < PX; j++) for (let i = 0; i < PX; i++) put((x - tx0) * PX + i, (y - ty0) * PX + j, rgba);
    }
  }
  // a crown 1.5 tiles across over every fifth tile in each direction, drawn over the tiles and over the strip's edge
  for (let y = 0; y < 100; y += 5) {
    for (let x = 0; x < 100; x += 5) {
      const left = x * PX - PX / 4 - tx0 * PX;
      const top = y * PX - PX / 4 - ty0 * PX;
      if (left >= tw * PX || top >= th * PX || left + PX * 1.5 <= 0 || top + PX * 1.5 <= 0) continue;
      for (let j = 0; j < PX * 1.5; j++) for (let i = 0; i < PX * 1.5; i++) put(left + i, top + j, [200, 30 + frame, 60, 255]);
    }
  }
  return animated;
};

const view = (px: number, py: number) => ({ x: px * SIDE + 4, y: py * SIDE + 4, right: px * SIDE + 180, bottom: py * SIDE + 190 });
const slice = (timeRemaining = 100): Slice => ({ timeRemaining: () => timeRemaining });
/** Runs idle slices until the queue says nothing waits. */
function drain(idle: ((s: Slice) => void)[]): void {
  for (let n = 0; idle.length > 0 && n < 10_000; n++) idle.shift()!(slice());
}

describe('the strips of a page', () => {
  test('cover every tile once, a short page and a narrow one included, the strips nearest a point first', () => {
    for (const [tw, th] of [[16, 16], [16, 5], [11, 16], [3, 2]] as const) {
      const strips = stripsOf(tw, th, { x: 0, y: 0 });
      const seen = new Set<string>();
      for (const s of strips) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) seen.add(`${x},${y}`);
      expect(seen.size).toBe(tw * th);
      expect(strips.reduce((n, s) => n + s.w * s.h, 0)).toBe(tw * th);
    }
    const first = stripsOf(16, 16, { x: 16, y: 16 })[0]!;
    expect([first.x, first.y]).toEqual([STRIP_COLS, 16 - STRIP_ROWS]);
    expect(stripsOf(16, 16, { x: 0, y: 0 })[0]).toEqual({ x: 0, y: 0, w: STRIP_COLS, h: STRIP_ROWS });
  });
});

describe('a page baked in strips', () => {
  /** Every texture of the pages a scene holds, by key. */
  const pixels = (textures: Map<string, FakeCanvas>) => new Map([...textures].filter(([k]) => k !== 'ground-strip').map(([k, v]) => [k, v.data]));

  // a clock that makes every piece slow (the pieces narrow to one tile) and one that makes every piece fast (they widen to a strip)
  const clocks = { 'pieces of one tile': () => { let t = 0; return () => (t += 40); }, 'whole strips': () => () => 0 };
  test.each(Object.entries(clocks))('equals the page baked whole, pixel for pixel, on every frame and on a short and a narrow page, in %s', (_name, clock) => {
    // 40 by 36 tiles: the last column of pages is 8 tiles wide and the last row 4 tall
    const w = 40;
    const h = 36;
    const whole = fakeScene();
    const a = new GroundChunks(whole.scene, w, h, DENSITY, UNIT, 4, 0, painter);
    // first light: the view's own pages are baked whole
    a.update({ x: 0, y: 0, right: w * UNIT, bottom: h * UNIT });
    expect(a.waiting).toBe(0);
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => 0);
    const strip = fakeScene();
    const b = new GroundChunks(strip.scene, w, h, DENSITY, UNIT, 4, 0, painter, () => true, q, STRIP_COLS, STRIP_ROWS, clock());
    // the view sits on the first page alone, so the rest are strips; then it sees the whole map and nothing is whole-baked again
    b.update(view(0, 0));
    const first = [...pixels(strip.textures).keys()];
    expect(first.length).toBeGreaterThan(0);
    b.update({ x: 0, y: 0, right: w * UNIT, bottom: h * UNIT });
    drain(idle);
    expect(b.waiting).toBe(0);
    const want = pixels(whole.textures);
    const got = pixels(strip.textures);
    expect([...got.keys()].sort()).toEqual([...want.keys()].sort());
    let compared = 0;
    for (const [key, bytes] of want) {
      expect(Buffer.from(got.get(key)!).equals(Buffer.from(bytes)), key).toBe(true);
      compared++;
    }
    // 3 by 3 pages, the animated tile in every one: four frames each, a band of two tile rows to a canvas (8, 8 and 2 bands: the last row of pages is 4 tiles tall)
    expect(compared).toBe(3 * (8 + 8 + 2) * 4);
  });

  test('a page the walk reaches before its strips are done shows what is baked, and the rest comes in the next slices', () => {
    const { scene, textures, shown } = fakeScene();
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => 0);
    const g = new GroundChunks(scene, 48, 48, DENSITY, UNIT, 4, 0, painter, () => true, q);
    g.update(view(0, 0));
    // one slice of one strip: the page next to it has begun and shows its strip, the others have nothing yet
    idle.shift()!({ timeRemaining: () => 0, didTimeout: true });
    const started = g.count;
    expect(g.waiting).toBeGreaterThan(0);
    const page = [...textures].find(([k, v]) => k !== 'ground-strip' && v.data.some((b) => b !== 0) && k.endsWith('-0') && !k.startsWith('ground-c0x0'));
    expect(page).toBeDefined();
    const bytes = page![1].data;
    const opaque = bytes.reduce((n, _b, i) => n + (i % 4 === 3 && bytes[i] !== 0 ? 1 : 0), 0);
    expect(opaque).toBeGreaterThan(0);
    expect(opaque).toBeLessThan(bytes.length / 4);
    // a frame of the water's cycle asked for now shows the first frame of a page that has only that one whole
    g.setFrame(3);
    expect(shown.at(-1)).toMatch(/-0$/);
    drain(idle);
    expect(g.waiting).toBe(0);
    expect(g.count).toBeGreaterThan(started);
    g.setFrame(3);
    expect(shown.at(-1)).toMatch(/-3$/);
  });

  test('the view landing on pages nothing of which is held is baked whole at once, a walk-in is not', () => {
    const { scene } = fakeScene();
    const painted: string[] = [];
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => 0);
    const g = new GroundChunks(scene, 96, 96, DENSITY, UNIT, 1, 0, () => (tex, frame, tx0, ty0, tw, th) => (painted.push(`${tx0}x${ty0}:${tw}x${th}`), painter()(tex, frame, tx0, ty0, tw, th)), () => true, q);
    g.update(view(0, 0));
    // a page whole is its bands, each painted by itself
    expect(painted).toEqual([0, 2, 4, 6, 8, 10, 12, 14].map((y) => `0x${y}:16x2`));
    painted.length = 0;
    // walking to the next page, a tile at a time: its strips are painted in the idle slices, one strip's rectangle at a time
    for (let step = 1; step <= 12; step++) g.update({ x: step * UNIT + 4, y: 4, right: step * UNIT + 180, bottom: 190 });
    expect(painted).toEqual([]);
    idle.shift()!({ timeRemaining: () => 0, didTimeout: true });
    expect(painted).toHaveLength(1);
    expect(painted[0]).toMatch(/^\d+x\d+:[1-8]x1$/);
    // a teleport to pages far from everything held
    g.update(view(5, 5));
    expect(painted).toContain('80x80:16x2');
    expect(painted).toContain('80x94:16x2');
  });
});

describe('no slice goes over its budget', () => {
  test('a page that costs 1.5 s whole is baked in strips of at most 50 ms', () => {
    const { scene } = fakeScene();
    let clock = 0;
    // 5.9 ms a tile: 256 tiles are 1.5 s
    const cost = (tw: number, th: number) => tw * th * 5.9;
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => clock);
    const g = new GroundChunks(scene, 48, 48, DENSITY, UNIT, 1, 0, () => (tex, frame, tx0, ty0, tw, th) => {
      clock += cost(tw, th);
      return painter()(tex, frame, tx0, ty0, tw, th);
    }, () => true, q, STRIP_COLS, STRIP_ROWS, () => clock);
    g.update(view(0, 0));
    const firstLight = clock;
    expect(firstLight).toBeGreaterThan(1000);
    for (let n = 0; idle.length > 0 && n < 5000; n++) idle.shift()!({ timeRemaining: () => 50, didTimeout: false });
    expect(g.waiting).toBe(0);
    expect(g.longest).toBeGreaterThan(0);
    expect(g.longest).toBeLessThanOrEqual(50);
    expect(g.count).toBe(4);
  });
});

describe('the ring follows the heading', () => {
  const seen = { x0: 1, y0: 1, x1: 1, y1: 1 };
  const ring = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ cx: 1 + dx, cy: 1 + dy })));
  const first = (heading: { x: number; y: number }, n: number) => pageOrder(ring, seen, { x: 1.5, y: 1.5 }, heading).slice(0, n).map((p) => `${p.cx},${p.cy}`);

  test('the pages the view touches come first, then those ahead of the figure, nearest first, then the rest', () => {
    // going east: the view's own page, then the three pages on the east side
    const order = first({ x: 1, y: 0 }, 9);
    expect(order[0]).toBe('1,1');
    expect(new Set(order.slice(1, 4))).toEqual(new Set(['2,1', '2,0', '2,2']));
    expect(new Set(order.slice(4))).toEqual(new Set(['0,0', '0,1', '0,2', '1,0', '1,2'].map((s) => s)));
    // going west: the west side instead
    expect(new Set(first({ x: -1, y: 0 }, 4).slice(1))).toEqual(new Set(['0,1', '0,0', '0,2']));
    // going north: the pages above
    expect(new Set(first({ x: 0, y: -1 }, 4).slice(1))).toEqual(new Set(['1,0', '0,0', '2,0']));
    // standing still puts none ahead: nearest first
    expect(first({ x: 0, y: 0 }, 1)).toEqual(['1,1']);
  });

  test('walking west, the pages west of the view are the first the idle slices start', () => {
    const { scene } = fakeScene();
    const started: string[] = [];
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => 0);
    const g = new GroundChunks(scene, 96, 96, DENSITY, UNIT, 1, 0, () => {
      let page = '';
      return (tex, frame, tx0, ty0, tw, th) => {
        const here = `${Math.floor(tx0 / CHUNK)},${Math.floor(ty0 / CHUNK)}`;
        if (page === '') started.push((page = here));
        return painter()(tex, frame, tx0, ty0, tw, th);
      };
    }, () => true, q);
    // first light on the page (3,2), then a walk west that crosses into (2,2) a tile at a time
    g.update(view(3, 2));
    started.length = 0;
    for (let step = 0; step < 8; step++) g.update({ x: 3 * SIDE - step * UNIT + 4, y: 2 * SIDE + 4, right: 3 * SIDE - step * UNIT + 180, bottom: 2 * SIDE + 190 });
    // pages in the view first, then the ones ahead (west), the east ones last
    const order = (): string[] => {
      const out: string[] = [];
      for (let n = 0; n < 400 && idle.length > 0; n++) {
        idle.shift()!({ timeRemaining: () => 0, didTimeout: true });
        for (const s of started) if (!out.includes(s)) out.push(s);
      }
      return out;
    };
    const got = order();
    const col = (p: string) => Number(p.split(',')[0]);
    const inView = got.filter((p) => col(p) === 2);
    const west = got.filter((p) => col(p) <= 1);
    const east = got.filter((p) => col(p) >= 4);
    expect(inView.length).toBeGreaterThan(0);
    expect(west.length).toBeGreaterThan(0);
    expect(east.length).toBeGreaterThan(0);
    expect(Math.max(...inView.map((p) => got.indexOf(p)))).toBeLessThan(Math.min(...west.map((p) => got.indexOf(p))));
    expect(Math.max(...west.map((p) => got.indexOf(p)))).toBeLessThan(Math.min(...east.map((p) => got.indexOf(p))));
  });
});
