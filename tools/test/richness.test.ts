/** The richness warning: windows over the core map, three counts each, thresholds from the params file. */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkRichness, readRichnessParams, richnessWindows } from '../src/richness';

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

describe('richness', () => {
  it('prints one summary line with the three percentages, as warnings only', () => {
    const issues = checkRichness(base, {});
    expect(issues[0]!.message).toMatch(/\d+% have 3\+ kinds to act on, \d+% have 2\+ movers, \d+% have 1\+ reacting/);
    expect(issues.every((i) => i.level === 'warning')).toBe(true);
  });

  it('the windows cover every tile of the map', () => {
    const { width, height } = base.map;
    const seen = new Uint8Array(width * height);
    for (const w of richnessWindows(base)) for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) seen[y * width + x] = 1;
    expect(seen.every((v) => v === 1)).toBe(true);
  });

  it('a stricter threshold from the params makes more windows thin', () => {
    const p = readRichnessParams();
    const thin = (n: number) => richnessWindows(base, { ...p, min_kinds_to_act_on: n }).filter((w) => w.judged && !w.passA).length;
    expect(thin(99)).toBeGreaterThan(thin(1));
  });

  it('a window holding a predator counts it as moving and as reacting', () => {
    const wolves = base.map.props.filter((p) => p.hazard?.kind === 'predator');
    expect(wolves.length).toBeGreaterThan(0);
    for (const wolf of wolves) {
      const w = richnessWindows(base).find((q) => wolf.x >= q.x && wolf.x < q.x + q.w && wolf.y >= q.y && wolf.y < q.y + q.h)!;
      expect(w.moves).toContain('predator');
      expect(w.reacts).toContain(wolf.id);
    }
  });

  it('a window holding a creature spot counts the kind as moving, and as reacting when it flees a player', () => {
    const spots = base.map.creatures?.spots ?? [];
    expect(spots.length).toBeGreaterThan(0);
    const windows = richnessWindows(base);
    for (const spot of spots) {
      const kind = `creature:${spot.kind}`;
      const inside = windows.filter((q) => spot.x >= q.x && spot.x < q.x + q.w && spot.y >= q.y && spot.y < q.y + q.h);
      for (const w of inside) {
        expect(w.moves).toContain(kind);
        if (base.map.creatures!.kinds[spot.kind]!.alert_tiles > 0) expect(w.reacts).toContain(kind);
      }
      // counted at its spot only: a window that does not hold the spot does not count it for this spot
      const away = windows.filter((q) => !inside.includes(q) && !spots.some((o) => o.kind === spot.kind && o.x >= q.x && o.x < q.x + q.w && o.y >= q.y && o.y < q.y + q.h));
      for (const w of away) expect(w.moves).not.toContain(kind);
    }
  });
});
