/** The arithmetic of a fight that content is held to (COMBAT 4.9), on the core's wolf. */
import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, cycleHarm, cycleTicks, feltMs, hitsToFell, moveHarm, windowsPerCycle } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

describe('fight arithmetic', () => {
  it('counts the wolf in hits of a starter hand', () => {
    const f = b.map.creatures!.kinds['core/wolf']!.fight!;
    expect(hitsToFell(b.params, f)).toBe(2);
  });

  it('takes a bite as a sixth of the bar and a lunge as a quarter', () => {
    const f = b.map.creatures!.kinds['core/wolf']!.fight!;
    const cap = b.params.hp_cap * 1000;
    expect(moveHarm(b.params, cap, f.moves[0]!)).toBe(Math.floor(cap / 6));
    expect(moveHarm(b.params, cap, f.moves[1]!)).toBe(Math.floor(cap / 4));
  });

  it('sums a pattern in ticks, harm and windows, all integers', () => {
    const f = b.map.creatures!.kinds['core/wolf']!.fight!;
    const p = f.patterns[0]!;
    expect(cycleTicks(b.params, f, p)).toBe(15 + 15 + 19);
    expect(windowsPerCycle(b.params, f, p)).toBe(3);
    for (const n of [cycleHarm(b.params, b.params.hp_cap * 1000, f, p), feltMs(b.params, f, p)]) expect(Number.isInteger(n)).toBe(true);
    expect(feltMs(b.params, f, p)).toBe(49 * b.params.wild.tick_ms);
  });

  it('never fells a foe whose pattern opens no window', () => {
    const f = structuredClone(b.map.creatures!.kinds['core/wolf']!.fight!);
    for (const m of f.moves) m.recover_t = 1;
    expect(feltMs(b.params, f, f.patterns[0]!)).toBe(Number.POSITIVE_INFINITY);
  });
});
