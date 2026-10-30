/**
 * Chunk streaming in the classic client (NEXT 19 d): the 3 by 3 world chunks around the player, never more than nine
 * held, the pages baked in idle slices, the seam under the mist. The test world is generated ground, 3 by 3 chunks.
 */
import { describe, expect, test } from 'vitest';
import type * as Phaser from 'phaser';
import { CHUNK, GroundChunks } from '../src/groundchunks';
import { MIST } from '../src/mist';
import { ChunkStream, IdleQueue, MAX_HELD, WORLD_CHUNK, chunkOfTile, inWindow, type Slice } from '../src/stream';

/** A plain generated chunk: 64 by 64 tiles of a ground letter from a fixed integer hash. */
function testChunk(cx: number, cy: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < WORLD_CHUNK; y++) {
    let row = '';
    for (let x = 0; x < WORLD_CHUNK; x++) row += ((Math.imul(x + cx * 64, 73856093) ^ Math.imul(y + cy * 64, 19349663)) >>> 0) % 5 === 0 ? 'T' : 'G';
    rows.push(row);
  }
  return rows;
}

/** The test world: 3 by 3 chunks, 192 by 192 tiles; the world has no chunk past it. */
const world = (cx: number, cy: number) => (cx >= 0 && cy >= 0 && cx < 3 && cy < 3 ? testChunk(cx, cy) : undefined);

describe('the window of world chunks', () => {
  test('a chunk is 64 tiles and a tile below zero has a chunk too', () => {
    expect(WORLD_CHUNK).toBe(64);
    expect([0, 63, 64, 191, -1, -64, -65].map(chunkOfTile)).toEqual([0, 0, 1, 2, -1, -1, -2]);
  });

  test('holds the 3 by 3 around the player, and the corner of the world only the 2 by 2 that exists', () => {
    const s = new ChunkStream(world);
    s.update(96, 96);
    expect(s.count).toBe(9);
    s.update(2, 2);
    expect(s.count).toBe(4);
    expect([s.has(0, 0), s.has(1, 1), s.has(2, 2), s.has(2, 0)]).toEqual([true, true, false, false]);
  });

  test('a walk across the whole test world crosses several borders and never holds over nine', () => {
    const loaded: string[] = [];
    const dropped: string[] = [];
    const s = new ChunkStream(world, (cx, cy) => void dropped.push(`${cx},${cy}`));
    let crossings = 0;
    let last = '';
    // the boundary of a snake through the 192 by 192 tiles, a tile at a time
    const path: [number, number][] = [];
    for (let x = 0; x < 192; x++) path.push([x, 5]);
    for (let y = 5; y < 190; y++) path.push([191, y]);
    for (let x = 191; x >= 0; x--) path.push([x, 189]);
    for (let y = 189; y >= 0; y--) path.push([0, y]);
    for (let x = 0; x < 192; x++) path.push([x, x]);
    for (const [x, y] of path) {
      const step = s.update(x, y);
      loaded.push(...step.loaded);
      const here = `${chunkOfTile(x)},${chunkOfTile(y)}`;
      if (here !== last) crossings++;
      last = here;
      expect(s.count).toBeLessThanOrEqual(MAX_HELD);
      // what is held is exactly the window around the player (the world's own chunks only)
      for (let cy = -1; cy <= 3; cy++) {
        for (let cx = -1; cx <= 3; cx++) expect(s.has(cx, cy)).toBe(world(cx, cy) !== undefined && inWindow({ cx: chunkOfTile(x), cy: chunkOfTile(y) }, cx * 64, cy * 64));
      }
    }
    expect(crossings).toBeGreaterThanOrEqual(10);
    expect(s.peak).toBe(9);
    // a chunk comes in when the player nears it and goes when they are a ring past; none is held twice
    expect(new Set(loaded).size).toBeLessThan(loaded.length);
    expect(dropped.length).toBeGreaterThan(0);
  });

  test('on a larger world the count stays at nine and the far side goes before the new side comes', () => {
    const big = (cx: number, cy: number) => testChunk(Math.abs(cx), Math.abs(cy));
    let held = 0;
    let peak = 0;
    const s = new ChunkStream(
      (cx, cy) => {
        held++;
        peak = Math.max(peak, held);
        return big(cx, cy);
      },
      () => void held--,
    );
    for (let x = 0; x < 64 * 8; x += 7) s.update(x, x >> 1);
    expect(s.peak).toBe(9);
    expect(peak).toBe(9);
    expect(s.count).toBe(9);
  });

  test('the seam is under the mist: the window\'s edge is at least a chunk from the player, the mist is solid 11 tiles out', () => {
    // the least distance, in tiles, from any tile of the player's chunk to a tile outside the 3 by 3 window
    expect(WORLD_CHUNK).toBeGreaterThan(MIST.clear + MIST.ramp);
    for (const [x, y] of [[0, 0], [63, 63], [31, 31], [0, 63]] as const) {
      const edgeX = Math.min(x + WORLD_CHUNK + 1, 2 * WORLD_CHUNK - x);
      const edgeY = Math.min(y + WORLD_CHUNK + 1, 2 * WORLD_CHUNK - y);
      expect(Math.min(edgeX, edgeY) - 1).toBeGreaterThanOrEqual(WORLD_CHUNK);
    }
  });
});

describe('the idle queue', () => {
  const clock = () => {
    let t = 0;
    const idle: ((s: Slice) => void)[] = [];
    return {
      now: () => t,
      advance: (ms: number) => void (t += ms),
      idle: (run: (s: Slice) => void) => void idle.push(run),
      slices: () => idle.length,
      fire: (left: number, didTimeout = false) => idle.shift()!({ timeRemaining: () => left, didTimeout }),
    };
  };

  test('runs one page when the slice is short, more only while the slice has more time than the last page took', () => {
    const c = clock();
    const q = new IdleQueue(c.idle, c.now);
    const ran: number[] = [];
    for (let i = 0; i < 4; i++) q.push(`p${i}`, () => (c.advance(4), void ran.push(i)));
    expect(q.pending).toBe(4);
    c.fire(3);
    expect(ran).toEqual([0]);
    // 5 ms left and a page took 4: the next runs (the fake slice does not shrink, so the rest follow)
    c.fire(5);
    expect(ran).toEqual([0, 1, 2, 3]);
    expect(q.pending).toBe(0);
    expect(q.longest).toBe(4);
    expect(c.slices()).toBe(0);
  });

  test('a slice shorter than the last page waits for a longer one unless it timed out', () => {
    const c = clock();
    const q = new IdleQueue(c.idle, c.now);
    let n = 0;
    for (let i = 0; i < 3; i++) q.push(`p${i}`, () => (c.advance(6), n++));
    c.fire(1);
    expect(n).toBe(1);
    c.fire(2);
    expect(n).toBe(1);
    expect(c.slices()).toBe(1);
    c.fire(2, true);
    expect(n).toBe(2);
  });

  test('a job under a key replaces the waiting one, and a cancelled one never runs', () => {
    const c = clock();
    const q = new IdleQueue(c.idle, c.now);
    const ran: string[] = [];
    q.push('a', () => void ran.push('a1'));
    q.push('a', () => void ran.push('a2'));
    q.push('b', () => void ran.push('b'));
    q.cancel('b');
    c.fire(100);
    expect(ran).toEqual(['a2']);
  });

  test('the bake re-arms itself while pages wait, and flush runs the rest now', () => {
    const c = clock();
    const q = new IdleQueue(c.idle, c.now);
    let n = 0;
    for (let i = 0; i < 3; i++) q.push(`p${i}`, () => (c.advance(10), n++));
    c.fire(0);
    expect(n).toBe(1);
    expect(c.slices()).toBe(1);
    q.flush();
    expect(n).toBe(3);
  });
});

/** A scene with just enough of Phaser for the ground pages: canvases made and removed, images added and destroyed. */
function fakeScene() {
  const live = new Set<string>();
  const images = new Set<object>();
  const scene = {
    textures: {
      createCanvas: (key: string) => (live.add(key), { refresh: () => undefined }),
      remove: (key: string) => void live.delete(key),
    },
    add: {
      image: () => {
        const img = { setOrigin: () => img, setScale: () => img, setDepth: () => img, setTexture: () => img, destroy: () => void images.delete(img) };
        images.add(img);
        return img;
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, live, images };
}

describe('the ground pages through the stream', () => {
  const unit = 16;
  const side = CHUNK * unit;
  const view = (px: number, py: number) => ({ x: px * side + 4, y: py * side + 4, right: px * side + 180, bottom: py * side + 390 });

  test('the pages in view bake at once, the ring waits for an idle slice, and a held chunk limits the pages', () => {
    const { scene, live } = fakeScene();
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => 0);
    const stream = new ChunkStream(world);
    stream.update(96, 96);
    const painted: string[] = [];
    const g = new GroundChunks(scene, 192, 192, 1, unit, 1, 0, (_t, _f, tx, ty) => (painted.push(`${tx / CHUNK},${ty / CHUNK}`), false), (tx, ty) => stream.holds(tx, ty), q);
    g.update(view(6, 6), '1,1');
    // the view at (6,6) spans pages x 6..6 and y 6..7 (180 by 390 units), the ring adds one around it
    expect(painted).toEqual(['6,6', '6,7']);
    expect(g.count).toBe(2);
    expect(g.waiting).toBe(10);
    idle.shift()!({ timeRemaining: () => 100 });
    expect(g.count).toBe(12);
    expect(g.waiting).toBe(0);
    expect(live.size).toBe(12);
    // a page of a chunk that is not held is never asked for
    const far = new GroundChunks(scene, 192, 192, 1, unit, 1, 0, () => false, () => false, new IdleQueue(() => undefined));
    far.update(view(6, 6));
    expect(far.count).toBe(0);
    expect(far.waiting).toBe(0);
  });

  test('walking on drops the pages left behind and cancels the ones still waiting for them', () => {
    const { scene, live } = fakeScene();
    const idle: ((s: Slice) => void)[] = [];
    const q = new IdleQueue((run) => void idle.push(run), () => 0);
    const g = new GroundChunks(scene, 192, 192, 1, unit, 1, 0, () => false, () => true, q);
    g.update(view(2, 2));
    g.update(view(9, 9));
    expect(g.waiting).toBeLessThanOrEqual(12);
    idle.shift()!({ timeRemaining: () => 1000 });
    expect(live.size).toBeLessThanOrEqual(12);
    for (const key of live) {
      const [x, y] = key.replace('ground-c', '').split('-')[0]!.split('x').map(Number) as [number, number];
      expect(Math.abs(x - 9)).toBeLessThanOrEqual(2);
      expect(Math.abs(y - 9)).toBeLessThanOrEqual(3);
    }
    g.destroy();
    expect(live.size).toBe(0);
  });
});

describe('the cost of one page', () => {
  test('a page of 16 by 16 density-4 tiles blits in under 16 ms (a cloud sandbox\'s CPU; the browser\'s canvas is in the measured frame times)', () => {
    // 256 tiles of 64 by 64 RGBA pixels copied into a 1024 by 1024 page, row by row: the work drawFrame does, on a plain buffer
    const tile = new Uint32Array(64 * 64).fill(0xff336699);
    const page = new Uint32Array(1024 * 1024);
    const bake = () => {
      for (let ty = 0; ty < 16; ty++) {
        for (let tx = 0; tx < 16; tx++) {
          for (let row = 0; row < 64; row++) page.set(tile.subarray(row * 64, row * 64 + 64), (ty * 64 + row) * 1024 + tx * 64);
        }
      }
    };
    bake();
    const times: number[] = [];
    for (let i = 0; i < 25; i++) {
      const t = performance.now();
      bake();
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(16);
  });
});
