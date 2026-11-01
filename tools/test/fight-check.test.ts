/**
 * The fight's rows in the check (docs/design/COMBAT.md sections 4.1 and 4.9). Each failing world is the core with the
 * wolf's fight block changed one way; the core itself must pass, and the numbers of the cost gate are printed.
 */
import type { Bundle } from '@game/kernel';
import { feltMs } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkFight, dropsPay } from '../src/fight';
import { loadBundle } from './helpers/world.js';

let core: Bundle;
beforeAll(() => {
  core = loadBundle();
});

type Fight = NonNullable<NonNullable<Bundle['map']['creatures']>['kinds'][string]['fight']>;

/** The check's messages for the core with the wolf's fight edited. */
function rows(edit: (f: Fight, b: Bundle) => void): string[] {
  const b = structuredClone(core);
  const f = b.map.creatures!.kinds['core/wolf']!.fight!;
  edit(f, b);
  return checkFight(b, {}).map((i) => `${i.where}: ${i.message}`);
}

describe('the fight rows', () => {
  it('pass for the core, where the wolf is ready and not switched on', () => {
    expect(checkFight(core, {}).filter((i) => i.level === 'error')).toEqual([]);
    expect(core.params.combat.enabled).toBe(0);
  });

  it('refuse a wind-up outside the band', () => {
    expect(rows((f) => (f.moves[0]!.windup_t = 1)).join('\n')).toMatch(/winds up 1 ticks/);
    expect(rows((f) => (f.moves[0]!.windup_t = 11)).join('\n')).toMatch(/winds up 11 ticks/);
  });

  it('refuse a pattern that names a move the foe lacks, and a weakness that is not a move', () => {
    expect(rows((f) => f.patterns[0]!.push('roar')).join('\n')).toMatch(/does not have/);
    expect(rows((f) => (f.weak = { after: 'roar' })).join('\n')).toMatch(/weak move "roar"/);
  });

  it('refuse a pattern that never opens a window', () => {
    const out = rows((f) => {
      for (const m of f.moves) m.recover_t = 1;
    });
    expect(out.join('\n')).toMatch(/leaves the foe open long enough/);
  });

  it('refuse a pattern whose one run takes the whole bar', () => {
    const out = rows((f) => {
      for (const m of f.moves) m.harm_div = 2;
    });
    expect(out.join('\n')).toMatch(/must be able to win by reading it/);
  });

  it('refuse a tier that does not fit its hits', () => {
    expect(rows((f) => (f.hp = 100)).join('\n')).toMatch(/tier 1 falls in 2 to 2 hits/);
    expect(rows((f) => (f.tier = 2)).join('\n')).toMatch(/tier 2 falls in 6 to 8/);
  });

  it('refuse a chase quicker than the walk', () => {
    expect(rows((f) => (f.pace_ms = 100)).join('\n')).toMatch(/escaped by walking/);
  });

  it('refuse a move the foe has no breath for', () => {
    expect(rows((f) => (f.breath = 5)).join('\n')).toMatch(/could never start it/);
  });

  it('refuse a foe that is protected or has nothing to leave', () => {
    const b = structuredClone(core);
    b.map.creatures!.kinds['core/wolf']!.protected = true;
    expect(checkFight(b, {}).map((i) => i.message).join('\n')).toMatch(/never struck/);
    const c = structuredClone(core);
    delete c.map.creatures!.kinds['core/wolf']!.hunt;
    expect(checkFight(c, {}).map((i) => i.message).join('\n')).toMatch(/carries hunt fields/);
  });

  it('warn, with the two numbers, when drops pass pay_per_s_mg times the pattern seconds', () => {
    const wolf = core.map.creatures!.kinds['core/wolf']!;
    expect(dropsPay(core, 'core/wolf')).toBeGreaterThan(0);
    expect(feltMs(core.params, wolf.fight!, wolf.fight!.patterns[0]!)).toBeGreaterThan(0);
    const w = checkFight(core, {}).filter((i) => i.level === 'warning');
    expect(w.map((i) => i.message).join('\n')).toMatch(/cap of \d+ mg/);
  });

  it('refuse combat numbers that contradict each other', () => {
    const b = structuredClone(core);
    b.params.combat.windup_min_t = 12;
    b.params.combat.swing_quick_t = 13;
    const out = checkFight(b, {}).map((i) => i.message).join('\n');
    expect(out).toMatch(/windup_min_t to windup_max_t/);
    expect(out).toMatch(/swing_floor_t <= quick/);
  });
});
