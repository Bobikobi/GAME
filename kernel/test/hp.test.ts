/**
 * The health bar is `player.hp` (NEXT 1, item 7): it began as a food bar named satiety, kept lazily
 * against a tick for a hunger drain. The drain is gone (G28), so the bar is one stored number, its top
 * is `hpCap` (`params.hp_cap` plus stamina), and a save from before kernel 0.19 carries its satiety over.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, KERNEL_VERSION, hpCap, migrateState, newState, serialize, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

function started(): State {
  const r = step(b, newState(b, 1), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('the health bar is hp', () => {
  test('a start fills it to the cap, and the state holds no satiety and no clock for it', () => {
    const s = started();
    expect(s.player.hp).toBe(hpCap(b, s));
    expect(hpCap(b, s)).toBe((b.params.hp_cap + b.params.per_point.stamina * s.player.attrs.stamina) * 1000);
    const saved = JSON.parse(serialize(s)) as { player: Record<string, unknown> };
    expect(saved.player).not.toHaveProperty('satiety');
    expect(saved.player).not.toHaveProperty('satietyAt');
    expect(KERNEL_VERSION).toBe('0.24.0');
  });

  test('a save from before kernel 0.19 carries its satiety over as hp, and the old fields go', () => {
    const s = started();
    const old = structuredClone(s) as unknown as { player: Record<string, unknown> };
    delete old.player.hp;
    old.player.satiety = 37_500;
    old.player.satietyAt = 120_000;
    const now = migrateState(old as unknown as State);
    expect(now.player.hp).toBe(37_500);
    expect(now.player).not.toHaveProperty('satiety');
    expect(now.player).not.toHaveProperty('satietyAt');
    // a save of today passes through unchanged
    expect(migrateState(s)).toEqual(s);
  });

  test('the params carry hp_cap and no hunger drain', () => {
    expect(b.params.hp_cap).toBeGreaterThan(0);
    expect(b.params).not.toHaveProperty('satiety_cap');
    expect(b.params).not.toHaveProperty('satiety_drain_per_min');
  });
});
