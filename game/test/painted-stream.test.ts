import { describe, expect, test } from 'vitest';

import { PaintedStream, STREAM, layerKey, type StreamConfig, type StreamLayerMeta, type StreamPort, type StreamUnitMeta } from '../src/painted-stream.js';

/** a land of `cols` x `rows` units of 1280 x 896 (20 x 14 cells), six layers each of the unit's size */
function land(cols: number, rows: number, uw = 1280, uh = 896): StreamUnitMeta[] {
  const out: StreamUnitMeta[] = [];
  for (let uy = 0; uy < rows; uy++)
    for (let ux = 0; ux < cols; ux++) {
      const layers: StreamLayerMeta[] = ['ground', 'walls', 'objects', 'ground-n', 'walls-n', 'objects-n'].map((name) => ({ name, file: `tiles/${name}-${ux}-${uy}.png`, w: uw, h: uh, bytes: 1000 }));
      out.push({ ux, uy, x: ux * uw, y: uy * uh, w: uw, h: uh, layers });
    }
  return out;
}

/** a port whose fetches and decodes resolve when the test says so */
function rig(units: StreamUnitMeta[], cfg: Partial<StreamConfig> = {}, bands = 0) {
  let t = 0;
  const pending: { url: string; done: () => void; fail: () => void }[] = [];
  const decodes: { key: string; done: () => void }[] = [];
  const uploads: string[] = [];
  const drops: string[] = [];
  const lit: string[] = [];
  /** per key laid by bands, the bands still to go; each band call is logged in `uploads` as `key#band` */
  const left = new Map<string, number>();
  const dropped: [string, boolean][] = [];
  const port: StreamPort<string, string> = {
    fetch: (url) =>
      new Promise((res, rej) => {
        pending.push({ url, done: () => res(url), fail: () => rej(new Error('net')) });
      }),
    decode: (blob) =>
      new Promise((res) => {
        decodes.push({ key: blob, done: () => res(blob) });
      }),
    upload: (key) => {
      uploads.push(key);
      if (!bands) return;
      left.set(key, bands);
      return 'bands';
    },
    band: (key) => {
      uploads.push(`${key}#band`);
      const n = left.get(key)! - 1;
      left.set(key, n);
      return n === 0;
    },
    drop: (key, _l, _u, was) => {
      drops.push(key);
      dropped.push([key, was]);
    },
    lit: (u) => lit.push(`${u.ux},${u.uy}`),
  };
  const s = new PaintedStream(units, 'scene', port, () => t, { ...STREAM, ...cfg });
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));
  /** runs every fetch and decode to its end, ticking at the given view between */
  const settle = async (v: Parameters<typeof s.tick>[0], ticks = 200) => {
    for (let i = 0; i < ticks; i++) {
      s.tick(v);
      while (pending.length) pending.shift()!.done();
      while (decodes.length) decodes.shift()!.done();
      await flush();
      t += 16;
    }
  };
  return { s, pending, decodes, uploads, drops, dropped, lit, settle, flush, advance: (ms: number) => (t += ms) };
}

/** the phone's camera (844 x 390) centred on a point */
const at = (x: number, y: number) => ({ player: [x, y] as const, view: { x: x - 422, y: y - 195, w: 844, h: 390 } });

describe('the painted stream (V5b)', () => {
  test('the standing unit lights first: its three first layers are the first fetched, two at once, and the relief comes after', async () => {
    const r = rig(land(2, 2));
    r.s.tick(at(600, 450));
    expect(r.pending.map((p) => p.url)).toEqual(['scene/tiles/ground-0-0.png', 'scene/tiles/walls-0-0.png']);
    expect(r.s.peakFetches).toBe(2);
    await r.settle(at(600, 450));
    expect(r.lit[0]).toBe('0,0');
    expect(r.uploads.slice(0, 3)).toEqual([layerKey({ ux: 0, uy: 0 }, 'ground'), layerKey({ ux: 0, uy: 0 }, 'walls'), layerKey({ ux: 0, uy: 0 }, 'objects')]);
    expect(r.s.peakFetches).toBeLessThanOrEqual(2);
  });

  test('nearLit: a player outside every unit, near one that is lit, may start the land\'s work after first light (B4c); inside one the standing unit is what counts', async () => {
    const r = rig(land(2, 1));
    r.s.tick(at(-300, 450));
    expect(r.s.standing).toBeUndefined();
    expect(r.s.standingLit()).toBe(false);
    expect(r.s.nearLit()).toBe(false);
    await r.settle(at(-300, 450));
    expect(r.s.standingLit()).toBe(false);
    expect(r.s.nearLit()).toBe(true);
    // too far from every unit (the ring is 12 tiles): nothing is near
    const far = rig(land(2, 1));
    await far.settle(at(-3000, 450), 40);
    expect(far.s.nearLit()).toBe(false);
    // inside a unit the standing unit counts and nearLit stands down
    r.s.tick(at(600, 450));
    expect(r.s.standing?.ux).toBe(0);
    expect(r.s.nearLit()).toBe(false);
  });

  test('one upload a tick, never two', async () => {
    const r = rig(land(2, 2));
    for (let i = 0; i < 60; i++) {
      const before = r.uploads.length;
      r.s.tick(at(600, 450));
      expect(r.uploads.length - before).toBeLessThanOrEqual(1);
      while (r.pending.length) r.pending.shift()!.done();
      while (r.decodes.length) r.decodes.shift()!.done();
      await r.flush();
    }
  });

  test('one decode at a time', async () => {
    const r = rig(land(2, 2));
    r.s.tick(at(600, 450));
    while (r.pending.length) r.pending.shift()!.done();
    await r.flush();
    r.s.tick(at(600, 450));
    r.s.tick(at(600, 450));
    expect(r.decodes.length).toBe(1);
  });

  test('every unit the padded view touches is pinned, and the standing unit always', () => {
    const r = rig(land(2, 2));
    // on the seam's corner the padded view touches all four
    r.s.tick(at(1280, 896));
    expect(r.s.pinnedKeys().sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
    // deep in one unit, far from both seams, the padded view touches that one alone
    const s = rig(land(3, 3));
    s.s.tick(at(1280 + 640, 896 + 448));
    expect(s.s.pinnedKeys()).toEqual(['1,1']);
  });

  test('the standing unit changes only once she is two tiles into the next', () => {
    const r = rig(land(2, 1));
    r.s.tick(at(1200, 450));
    expect(r.s.standing?.ux).toBe(0);
    r.s.tick(at(1290, 450));
    expect(r.s.standing?.ux).toBe(0);
    r.s.tick(at(1280 + 128, 450));
    expect(r.s.standing?.ux).toBe(1);
    // back across the seam by a step: still the new one
    r.s.tick(at(1270, 450));
    expect(r.s.standing?.ux).toBe(1);
  });

  test('the resident bytes stay under the cap on a long walk, and the unit evicted is the farthest, only after its linger', async () => {
    // 4 x 1 units of 6 layers of 1280 x 896 x 4 = 27.5 MB each; a cap of 60 MB holds two
    const cap = 60 * 1024 * 1024;
    const r = rig(land(4, 1), { cap, ring: 0 });
    for (let x = 600; x <= 4500; x += 40) await r.settle(at(x, 450), 3);
    await r.settle(at(4500, 450), 400);
    expect(r.s.bytes).toBeLessThanOrEqual(cap);
    expect(r.s.evictions.map((e) => e.unit).slice(0, 2)).toEqual(['0,0', '1,0']);
    expect(r.s.isLit({ ux: 3, uy: 0 })).toBe(true);
  });

  test('a unit that left the view is not evicted before its linger', async () => {
    const r = rig(land(3, 1), { cap: 30 * 1024 * 1024, ring: 0, linger: 5000 });
    await r.settle(at(600, 450), 100);
    // she walks on into the next unit; the first leaves the padded view
    await r.settle(at(1280 + 900, 450), 20);
    expect(r.s.evictions.length).toBe(0);
    r.advance(5000);
    await r.settle(at(1280 + 900, 450), 5);
    expect(r.s.evictions.map((e) => e.unit)).toEqual(['0,0']);
  });

  test('a pinned unit is never evicted, though the cap is passed', async () => {
    const r = rig(land(2, 2), { cap: 1, ring: 0, linger: 0 });
    await r.settle(at(1280, 896), 300);
    expect(r.s.evictions.length).toBe(0);
    expect(r.s.complete()).toBe(true);
  });

  test('the prefetch ring is fetched only when it fits under the cap', async () => {
    const unit = 1280 * 896 * 4 * 6;
    const r = rig(land(3, 1), { cap: unit * 2, ring: 12 * 64 });
    await r.settle(at(600, 450), 300);
    // the standing unit and its eastern neighbour (within 12 tiles) fit; the third does not lie in the ring
    expect(r.s.isLit({ ux: 1, uy: 0 })).toBe(true);
    expect(r.s.isLit({ ux: 2, uy: 0 })).toBe(false);
    const tight = rig(land(3, 1), { cap: unit, ring: 12 * 64 });
    await tight.settle(at(600, 450), 300);
    expect(tight.s.isLit({ ux: 1, uy: 0 })).toBe(false);
  });

  test('the step waits at the edge of a unit that is not lit, and goes once it is', async () => {
    const r = rig(land(2, 1), { ring: 0 });
    await r.settle(at(1100, 450), 200);
    expect(r.s.isLit({ ux: 1, uy: 0 })).toBe(true);
    const far = rig(land(3, 1), { ring: 0, pad: 0 });
    // 100 px from the second unit's edge, her own unit lit and nothing of the next resident (a narrow view that touches her unit alone)
    await far.settle({ player: [1180, 450], view: { x: 1170, y: 440, w: 20, h: 20 } }, 200);
    expect(far.s.isLit({ ux: 0, uy: 0 })).toBe(true);
    expect(far.s.holdStep(1, 0)).toBe(true);
    expect(far.s.holdStep(-1, 0)).toBe(false);
    await far.settle(at(1180, 450), 200);
    expect(far.s.holdStep(1, 0)).toBe(false);
  });

  test('a failed fetch is asked again', async () => {
    const r = rig(land(1, 1));
    r.s.tick(at(600, 450));
    r.pending.shift()!.fail();
    await r.flush();
    expect(r.s.state(layerKey({ ux: 0, uy: 0 }, 'ground'))).toBe('absent');
    await r.settle(at(600, 450), 100);
    expect(r.s.complete()).toBe(true);
  });

  test('a fetch that lands after its unit was evicted is dropped, not uploaded', async () => {
    const r = rig(land(3, 1), { cap: 10, ring: 0, linger: 0, pad: 0 });
    r.s.tick(at(600, 450));
    const late = r.pending.splice(0);
    // she is carried far away: unit 0 leaves the view and is evicted
    for (let i = 0; i < 10; i++) {
      r.s.tick(at(3200, 450));
      await r.flush();
    }
    expect(r.s.evictions.some((e) => e.unit === '0,0')).toBe(true);
    for (const p of late) p.done();
    await r.flush();
    r.s.tick(at(3200, 450));
    expect(r.decodes.some((d) => d.key.includes('-0-0'))).toBe(false);
  });
  test('a texture laid by bands: its bands take the ticks one by one, nothing else uploads meanwhile, and its unit lights only after the last band', async () => {
    const r = rig(land(1, 1), {}, 3);
    const ground = layerKey({ ux: 0, uy: 0 }, 'ground');
    for (let i = 0; i < 400 && !r.lit.length; i++) {
      const before = r.uploads.length;
      r.s.tick(at(600, 450));
      expect(r.uploads.length - before).toBeLessThanOrEqual(1);
      while (r.pending.length) r.pending.shift()!.done();
      while (r.decodes.length) r.decodes.shift()!.done();
      await r.flush();
    }
    const first = r.uploads.indexOf(ground);
    expect(r.uploads.slice(first, first + 4)).toEqual([ground, `${ground}#band`, `${ground}#band`, `${ground}#band`]);
    // the three first layers, each made and then laid in three bands, before the unit lights
    expect(r.uploads.length).toBe(12);
    expect(r.s.isLit({ ux: 0, uy: 0 })).toBe(true);
  });

  test('a unit dropped while a texture of it is laid by bands lets that texture go as made', async () => {
    const r = rig(land(3, 1), { cap: 1000 * 1000 * 4 * 6, ring: 0, linger: 0, pad: 0 }, 50);
    for (let i = 0; i < 20; i++) {
      r.s.tick(at(600, 450));
      while (r.pending.length) r.pending.shift()!.done();
      while (r.decodes.length) r.decodes.shift()!.done();
      await r.flush();
    }
    const ground = layerKey({ ux: 0, uy: 0 }, 'ground');
    expect(r.s.state(ground)).toBe('uploading');
    for (let i = 0; i < 40 && !r.s.evictions.length; i++) {
      r.s.tick(at(3200, 450));
      while (r.pending.length) r.pending.shift()!.done();
      while (r.decodes.length) r.decodes.shift()!.done();
      await r.flush();
    }
    expect(r.s.evictions.some((e) => e.unit === '0,0')).toBe(true);
    expect(r.dropped).toContainEqual([ground, true]);
  });
});
