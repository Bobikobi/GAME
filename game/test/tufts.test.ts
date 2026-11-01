import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PER_100, PERIOD_MS, scatterTufts, tuftFrame, tuftTiles, type TuftMap } from '../src/tufts';

const root = resolve(__dirname, '../..');
const map = (JSON.parse(readFileSync(resolve(root, 'content/core/map.json'), 'utf8')) as { map: TuftMap }).map;

describe('grass tufts: where they stand', () => {
  const tufts = scatterTufts(map);
  it('are the same on every call (the map alone decides)', () => {
    expect(scatterTufts(map)).toEqual(tufts);
  });
  it('match the density the plan asked for, per hundred tiles a tuft may stand in', () => {
    const per100 = (tufts.length / tuftTiles(map).length) * 100;
    expect(per100).toBeGreaterThan(PER_100 - 5);
    expect(per100).toBeLessThan(PER_100 + 5);
  });
  it('never stand on a path, a route, a solid tile or within one tile of a prop', () => {
    const bad = new Set<string>();
    for (const q of [...(map.plan?.paths ?? []), ...(map.plan?.routes ?? [])]) {
      let [x, y] = q.via[0] as [number, number];
      bad.add(`${x},${y}`);
      for (const [px, py] of q.via.slice(1) as [number, number][]) {
        while (x !== px || y !== py) {
          if (x !== px) x += Math.sign(px - x);
          else y += Math.sign(py - y);
          bad.add(`${x},${y}`);
        }
      }
    }
    for (const t of tufts) {
      expect(bad.has(`${t.tx},${t.ty}`)).toBe(false);
      const tile = map.legend[map.ground[t.ty]![t.tx]!]!;
      expect(tile.solid).toBe(false);
      expect(tile.tag).toBe('meadow');
      for (const p of map.props) expect(t.tx >= p.x - 1 && t.tx <= p.x + p.w && t.ty >= p.y - 1 && t.ty <= p.y + p.h).toBe(false);
    }
  });
  it('stand inside their own tile', () => {
    for (const t of tufts) {
      expect(Math.floor(t.x / 16)).toBe(t.tx);
      expect(Math.floor((t.y - 1) / 16)).toBe(t.ty);
    }
  });
});

describe('grass tufts: how they move', () => {
  it('lean in a wave: neighbours are a step apart, not in lockstep', () => {
    const a = { tx: 10, ty: 10, look: 1 };
    const b = { tx: 13, ty: 10, look: 1 };
    const frames = new Set<number>();
    for (let ms = 0; ms < 1500; ms += 50) if (tuftFrame(a, ms) !== tuftFrame(b, ms)) frames.add(ms);
    expect(frames.size).toBeGreaterThan(10);
  });
  it('run all four frames in one period, each look in its own 1.2 to 1.8 s', () => {
    for (const look of [0, 1, 2]) {
      const seen = new Set<number>();
      for (let ms = 0; ms < PERIOD_MS[look]!; ms += 20) seen.add(tuftFrame({ tx: 0, ty: 0, look }, ms));
      expect(seen.size).toBe(4);
      expect(PERIOD_MS[look]).toBeGreaterThanOrEqual(1200);
      expect(PERIOD_MS[look]).toBeLessThanOrEqual(1800);
    }
  });
});
