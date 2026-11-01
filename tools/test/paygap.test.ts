/**
 * The pay-gap check (G62): the allowance from the params, a corridor just under and just over the cap, each kind of
 * pay, a sign that fails G8, the height rule, and the baseline on the valley.
 */
import { describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { checkPayGap, measurePayGap, payGapCap } from '../src/paygap';
import { loadBundle } from './helpers/world';

const base = loadBundle();
const SPRITE = 'core/base-kit:props/rock';

/** A corridor `length` long and one row high, with a slot on its first tile as the only pay unless told otherwise. */
function corridor(length: number, over: Partial<Bundle['map']> = {}): Bundle {
  const map = {
    ...base.map,
    width: length,
    height: 1,
    ground: ['.'.repeat(length)],
    levels: undefined,
    regions: undefined,
    props: [],
    slots: [{ id: 'test/pay', kind: 'area', x: 0, y: 0, w: 1, h: 1 }],
    spawn: { x: 0, y: 0 },
    ...over,
  };
  return { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {}, quests: {} } as unknown as Bundle;
}

const CAP = 241;
const FILE = 'content/test/map.json';

function lines(b: Bundle) {
  return checkPayGap(b, { [b.map.id]: FILE });
}

describe('the allowance', () => {
  it('is 241 steps at 190 ms a step, by the draft\'s numbers where the params are absent', () => {
    const params = { ...base.params, walk_step_ms: 190 } as Bundle['params'] & { pay_gap_ms?: number; pay_sight_tiles?: number };
    delete params.pay_gap_ms;
    delete params.pay_sight_tiles;
    expect(payGapCap({ ...base, params })).toBe(CAP);
  });

  it('reads the params when they carry their own', () => {
    expect(payGapCap({ ...base, params: { ...base.params, walk_step_ms: 100, pay_gap_ms: 60000, pay_sight_tiles: 3 } as Bundle['params'] })).toBe(303);
  });
});

describe('a corridor', () => {
  const at190 = (b: Bundle): Bundle => ({ ...b, params: { ...b.params, walk_step_ms: 190, pay_gap_ms: 90000, pay_sight_tiles: 5 } as Bundle['params'] });

  it('at half the cap says nothing', () => {
    const half = Math.floor(CAP / 2);
    expect(lines(at190(corridor(half + 1)))).toEqual([]);
  });

  it('one step past half the cap is a warning that cites the rule', () => {
    const issues = lines(at190(corridor(Math.floor(CAP / 2) + 2)));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('warning');
    expect(issues[0]!.file).toBe(FILE);
    expect(issues[0]!.message).toContain('docs/design/OPEN_WORLD.md G62');
  });

  it('at the cap is still only a warning', () => {
    const issues = lines(at190(corridor(CAP + 1)));
    expect(issues.map((i) => i.level)).toEqual(['warning']);
  });

  it('one step past the cap is an error naming the worst tile and its file', () => {
    const issues = lines(at190(corridor(CAP + 2)));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
    expect(issues[0]!.file).toBe(FILE);
    expect(issues[0]!.message).toContain(`(${CAP + 1}, 0) is ${CAP + 1} steps`);
    expect(issues[0]!.message).toContain('docs/design/OPEN_WORLD.md G62');
  });

  it('a crossing halfway shortens it back under the cap', () => {
    const crossing = { id: 'test/ramp', sprite: SPRITE, x: 120, y: 0, w: 1, h: 1, solid: false, crossing: true as const };
    const gap = measurePayGap(at190(corridor(CAP + 2, { props: [crossing] } as Partial<Bundle['map']>)));
    expect(gap.worst!.steps).toBe(CAP + 1 - 120);
  });
});

describe('what counts as a pay', () => {
  const worst = (b: Bundle) => measurePayGap(b).worst?.steps;

  it('a live instance pays, from the tile beside it when it stands in the way', () => {
    const b = corridor(11, { slots: [] } as Partial<Bundle['map']>);
    expect(worst({ ...b, instances: { 'test/a#1': { source: 'test/a', kind: 'treasure', x: 5, y: 0 } } })).toBe(5);
    const solid = { ...b, resources: { 'test/oak': { ...Object.values(base.resources)[0]!, id: 'test/oak', solid: true } } } as Bundle;
    const tree = measurePayGap({ ...solid, instances: { 'test/oak#1': { source: 'test/oak', kind: 'resource', x: 5, y: 0 } } });
    expect(tree.pays).toBe(2);
    expect(tree.worst!.steps).toBe(4);
  });

  it('a slot on blocked ground pays from beside it, a slot on open ground from inside it', () => {
    const wall = { id: 'test/wall', sprite: SPRITE, x: 5, y: 0, w: 1, h: 1, solid: true };
    const slot = { id: 'test/spot', kind: 'area', x: 5, y: 0, w: 1, h: 1 };
    expect(measurePayGap(corridor(11, { props: [wall], slots: [slot] } as Partial<Bundle['map']>)).pays).toBe(2);
    expect(measurePayGap(corridor(11, { slots: [slot] } as Partial<Bundle['map']>)).pays).toBe(1);
  });

  it('a note counts only when a riddle cites it (G8)', () => {
    const note = { id: 'test/sign', sprite: SPRITE, x: 10, y: 0, w: 1, h: 1, solid: false, note: 'A line.' };
    const b = corridor(11, { props: [note] } as Partial<Bundle['map']>);
    expect(worst(b)).toBe(10);
    const riddle = { id: 'test/q', steps: [{ kind: 'riddle', props: ['test/sign'] }] };
    expect(worst({ ...b, quests: { 'test/q': riddle } } as unknown as Bundle)).toBe(5);
  });

  it('a region pays where a walker can come in, and not along the map\'s edge', () => {
    const whole = corridor(21, { slots: [], regions: [{ id: 'all', x: 0, y: 0, w: 21, h: 1 }] } as Partial<Bundle['map']>);
    expect(measurePayGap(whole).pays).toBe(0);
    expect(lines(whole).map((i) => i.level)).toEqual(['error']);
    const half = corridor(21, { slots: [], regions: [{ id: 'east', x: 10, y: 0, w: 11, h: 1 }] } as Partial<Bundle['map']>);
    const gap = measurePayGap(half);
    expect(gap.pays).toBe(1);
    expect(gap.worst).toEqual({ x: 0, y: 0, steps: 10 });
  });

  it('a face stops the walk unless a crossing opens it', () => {
    const faced = (props: unknown[]) => corridor(10, { levels: ['0000011111'], props } as unknown as Partial<Bundle['map']>);
    expect(worst(faced([]))).toBe(4);
    const ramp = { id: 'test/ramp', sprite: SPRITE, x: 4, y: 0, w: 1, h: 1, solid: false, crossing: true as const };
    expect(worst(faced([ramp]))).toBe(5);
  });
});

describe('the valley', () => {
  it('stays under half the cap: no line from the check', () => {
    const gap = measurePayGap(base);
    expect(gap.worst!.steps).toBeLessThanOrEqual(Math.floor(gap.cap / 2));
    expect(checkPayGap(base, {})).toEqual([]);
  });
});
