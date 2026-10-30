/**
 * The collapsed hall's road since the height rule (G68, makeStepRule): from each wake the hall is reachable on foot,
 * and so is the town from the hall, with the ready log of the road standing and with it felled. A fallen log is not
 * solid (only a tree is, DECISIONS 2026-10-10), so felling it moves no foot; this test keeps that true.
 */
import { describe, expect, it } from 'vitest';
import type { Bundle, Rect } from '@game/kernel';
import { walkBitmap } from '../src/reach';
import { walkFrom, wakes } from '../src/balance/reckon';
import { loadBundle } from './helpers/world';

const base = loadBundle();

/** The copy of the bundle with every ready log node taken off the map, as a player who felled them all. */
function felled(b: Bundle): Bundle {
  const instances = Object.fromEntries(Object.entries(b.instances).filter(([, i]) => !i.source.startsWith('core/fallen-logs')));
  return { ...b, instances };
}

function slot(b: Bundle, id: string): Rect {
  const s = (b.map.slots as readonly (Rect & { id: string })[]).find((r) => r.id === id);
  if (!s) throw new Error(`no slot ${id}`);
  return s;
}

/** Fewest steps to stand beside the slot, or -1. */
function steps(b: Bundle, from: readonly [number, number], to: Rect): number {
  const dist = walkFrom(b, walkBitmap(b), from);
  let best = -1;
  for (let y = to.y - 1; y <= to.y + to.h; y++) {
    for (let x = to.x - 1; x <= to.x + to.w; x++) {
      const d = dist[y * b.map.width + x] ?? -1;
      const edge = (x < to.x || x >= to.x + to.w) !== (y < to.y || y >= to.y + to.h);
      const inside = x >= to.x && x < to.x + to.w && y >= to.y && y < to.y + to.h;
      if (d >= 0 && (edge || inside) && (best < 0 || d < best)) best = d;
    }
  }
  return best;
}

describe("the collapsed hall's road", () => {
  const hall = slot(base, 'core/ruins-hall');
  const town = slot(base, 'core/town-square');
  for (const [name, b] of [['log standing', base], ['log felled', felled(base)]] as const) {
    it(`reaches the hall from every wake, ${name}`, () => {
      for (const w of wakes(b)) expect(steps(b, w.at, hall), `from ${w.pocket}`).toBeGreaterThanOrEqual(0);
    });
    it(`reaches the town from the hall, ${name}`, () => {
      // stand on the open tile beside the hall that the first wake reaches soonest, then walk to the town
      const open = walkBitmap(b);
      const dist = walkFrom(b, open, wakes(b)[0]!.at);
      let at: [number, number] | undefined;
      for (let y = hall.y - 1; y <= hall.y + hall.h; y++) {
        for (let x = hall.x - 1; x <= hall.x + hall.w; x++) {
          const d = dist[y * b.map.width + x] ?? -1;
          if (d >= 0 && (!at || d < dist[at[1] * b.map.width + at[0]]!)) at = [x, y];
        }
      }
      expect(at, 'a tile beside the hall').toBeDefined();
      expect(steps(b, at!, town)).toBeGreaterThanOrEqual(0);
    });
  }
  it('felling the log changes no distance', () => {
    const b = felled(base);
    for (const w of wakes(base)) expect(steps(b, w.at, hall)).toBe(steps(base, w.at, hall));
  });
});
