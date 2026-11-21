/**
 * The parity rows of a craft family (SKILL_FAMILIES 2.3, F1 to F5; #769): the real content passes them, and each row
 * refuses a bundle made to break it, naming the row.
 */
import { beforeAll, describe, expect, test } from 'vitest';
import type { Bundle } from '@game/kernel';
import { STEPS_MAX, checkFamilies, familyRows, medianX2, stepsOf, workOf } from '../src/families';
import { loadBundle } from './helpers/world';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

const copy = () => structuredClone(b);
const rule = (x: Bundle, code: string) => checkFamilies(x, {}).filter((i) => i.message.includes(`${code})`));
const handcraft = (x: Bundle) => Object.values(x.schools).find((s) => s.profession === 'core/handcraft')!;

describe('the real content', () => {
  test('passes F1 to F5 with no error; the one note is wear at tier 3, which holds one recipe', () => {
    const issues = checkFamilies(b, {});
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.map((i) => i.message)).toEqual(['wear holds 1 recipe at tier 3, fewer than the 2 an open tier should (F5)']);
  });

  test('work and steps are read down the chain: the tier-1 hood is flakes, scrape and tan, thread and sewing', () => {
    expect(stepsOf(b, 'core/hare-fur-hood')).toBe(3);
    expect(stepsOf(b, 'core/herb')).toBe(0);
    expect(workOf(b, 'core/herb')).toBe(0);
    const hood = b.recipes['core/hare-fur-hood']!;
    expect(workOf(b, 'core/hare-fur-hood')).toBeGreaterThan(hood.active_ms);
    expect(medianX2([3, 1, 2])).toBe(4);
    expect(medianX2([1, 2, 3, 10])).toBe(5);
  });

  test('the table: wear holds 4 / 4 / 1 recipes by tier and tools 3 / 2 / 2, within the steps cap', () => {
    const rows = familyRows(b).map((r) => `${r.family}${r.tier}:${r.pieces.length}`);
    expect(rows).toEqual(['tools1:3', 'tools2:2', 'tools3:2', 'wear1:4', 'wear2:4', 'wear3:1']);
    for (const r of familyRows(b)) expect(Math.max(...r.steps)).toBeLessThanOrEqual(STEPS_MAX);
  });
});

describe('each row refuses its break', () => {
  test('F1: a family with a third small node, a wrong value, a wrong hanger, or one lone major', () => {
    let x = copy();
    handcraft(x).nodes.push({ ...structuredClone(handcraft(x).nodes.find((n) => n.id === 'quick-seams')!), id: 'extra' });
    expect(rule(x, 'F1')).toHaveLength(1);
    x = copy();
    handcraft(x).nodes.find((n) => n.id === 'steady-needle')!.value = 6;
    expect(rule(x, 'F1')[0]!.message).toContain('steady-needle');
    x = copy();
    handcraft(x).nodes.find((n) => n.id === 'deft-grip')!.needs = ['sure-hands'];
    expect(rule(x, 'F1')[0]!.message).toContain('deft-grip');
    x = copy();
    handcraft(x).nodes.push({ ...structuredClone(handcraft(x).nodes.find((n) => n.id === 'careful-work')!), id: 'lone', family: 'wear', needs: ['steady-needle'] });
    expect(rule(x, 'F1')[0]!.message).toContain('1 major');
  });

  test('F1: a declared family with no group at all', () => {
    const x = copy();
    handcraft(x).nodes = handcraft(x).nodes.filter((n) => n.family !== 'tools');
    expect(rule(x, 'F1')[0]!.message).toContain('"tools" has no group');
  });

  test('F2: a craft profession on another curve', () => {
    const x = copy();
    x.professions['core/cooking']!.xp_levels = [5, 40, 150, 360, 720, 1400, 2400, 3800];
    expect(rule(x, 'F2')).toHaveLength(1);
  });

  test('F3: a family whose pieces take more than twice the work of the others at a tier', () => {
    const x = copy();
    x.recipes['core/hare-fur-hood']!.active_ms = 60000;
    x.recipes['core/hare-leather-shoes']!.active_ms = 60000;
    x.recipes['core/roe-leather-jerkin']!.active_ms = 60000;
    x.recipes['core/roe-leather-leggings']!.active_ms = 60000;
    const hit = rule(x, 'F3');
    expect(hit).toHaveLength(1);
    expect(hit[0]!.message).toContain('wear pieces of tier 1');
  });

  test('F4: a piece of four recipe steps', () => {
    const x = copy();
    x.recipes['core/tan-hare-fur']!.inputs = [{ item: 'core/sinew-thread', qty: 1 }, { item: 'core/herb', qty: 1 }];
    x.recipes['core/sinew-thread']!.inputs = [{ item: 'core/stone-blade', qty: 1 }];
    const hit = rule(x, 'F4');
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.every((i) => i.message.includes('more than the 3'))).toBe(true);
  });

  test('F5: a family more than three times the smallest at a tier, and a lone recipe at a tier is a note, not an error', () => {
    const x = copy();
    for (const id of ['core/hammerstone', 'core/fishing-rod']) delete x.recipes[id]!.family;
    const hit = rule(x, 'F5').filter((i) => i.level === 'error');
    expect(hit).toHaveLength(1);
    expect(hit[0]!.message).toContain('wear holds 4 recipes at tier 1, more than 3 times the 1');
    expect(rule(x, 'F5').filter((i) => i.level === 'warning').length).toBeGreaterThan(0);
  });
});
