/**
 * The difficulty reckoning (NEXT 19 b): steps from the wakes by the map's own
 * walk, the level a player brings to each place from the quests before it and
 * the grinding on the way, and the recommendation on the 9.10 scale.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { levelOf } from '../src/balance/curve';
import { type PlaceRow, formatReckoning, reckon, wakes, walkFrom } from '../src/balance/reckon';
import type { Rules } from '../src/balance/rules';
import { loadWorld } from '../src/balance/world';

let bundle: Bundle;
let rules: Rules;
let rows: PlaceRow[];

beforeAll(() => {
  ({ bundle, rules } = loadWorld());
  rows = reckon(bundle, rules);
});

describe('the walk', () => {
  it('on open ground the steps are the four-way distance', () => {
    const { width, height } = bundle.map;
    const dist = walkFrom(bundle, new Uint8Array(width * height).fill(1), [0, 0]);
    expect(dist[0]).toBe(0);
    expect(dist[3 * width + 4]).toBe(7);
    expect(dist[(height - 1) * width + (width - 1)]).toBe(width - 1 + height - 1);
  });

  it('a wall with one gap sends the walk round by the gap; a closed wall stops it', () => {
    const { width, height } = bundle.map;
    const open = new Uint8Array(width * height).fill(1);
    for (let y = 0; y < height; y++) open[y * width + 2] = 0;
    expect(walkFrom(bundle, open, [0, 0])[4]).toBe(-1);
    open[5 * width + 2] = 1;
    expect(walkFrom(bundle, open, [0, 0])[4]).toBe(5 + 4 + 5);
  });

  it('every place is reckoned from the wakes', () => {
    expect(wakes(bundle).length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.steps === null)).toEqual([]);
  });
});

describe('the level a player brings', () => {
  it('stays on the curve, rises with the road, and starts at 1 next to a wake', () => {
    for (const r of rows) {
      expect(r.level, r.slot).toBeGreaterThanOrEqual(1);
      expect(r.level, r.slot).toBeLessThanOrEqual(r.levelMax);
      expect(r.levelMax, r.slot).toBeLessThanOrEqual(rules.steps + 1);
    }
    const nearest = Math.min(...rows.map((r) => r.steps ?? Infinity));
    expect(rows.filter((r) => r.steps === nearest).every((r) => r.level === 1)).toBe(true);
    expect(Math.max(...rows.map((r) => r.level))).toBeGreaterThan(1);
  });

  it('is computed, never typed: the same map gives the same table, and more grinding never lowers a level', () => {
    expect(reckon(bundle, rules)).toEqual(rows);
    const more = reckon(bundle, { ...rules, grindPassesMax: rules.grindPassesMax + 2 });
    for (const r of rows) expect(more.find((m) => m.slot === r.slot)!.level, r.slot).toBeGreaterThanOrEqual(r.level);
  });

  it('each pocket reads its level off the curve from its quest and grind time', () => {
    for (const r of rows) for (const p of r.byPocket) if (p.steps !== null) expect(p.level).toBeLessThanOrEqual(levelOf(rules, p.questXpMs + p.grindXpMs));
  });
});

describe('the recommendation', () => {
  it('safe ground stays at danger 0 with no monsters; elsewhere the danger is the level', () => {
    for (const r of rows) {
      if (r.dNow === 0) {
        expect(r.dRec, r.slot).toBe(0);
        expect(r.monsters, r.slot).toBeNull();
      } else {
        expect(r.dRec, r.slot).toBe(r.level);
        expect(r.monsters!.tier, r.slot).toBe(`T${r.band}`);
        expect(r.monsters!.oneInMinutes, r.slot).toBe(Math.ceil(10_000 / (rules.hazardBp * r.dRec)));
      }
    }
  });

  it('asks for one to six quests of a few minutes each', () => {
    for (const r of rows) {
      expect(r.quests.count, r.slot).toBeGreaterThanOrEqual(1);
      expect(r.quests.count, r.slot).toBeLessThanOrEqual(rules.questsMax);
      expect(r.quests.kinds, r.slot).toHaveLength(r.quests.count);
      expect(r.quests.eachMs, r.slot).toBeLessThanOrEqual(rules.questMinutesMax * 60_000);
    }
  });

  it('prints a line for every place', () => {
    const text = formatReckoning(rows, rules);
    for (const r of rows) expect(text).toContain(r.slot.slice(r.slot.indexOf('/') + 1));
  });
});
