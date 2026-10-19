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
});
