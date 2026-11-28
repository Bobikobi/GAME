/**
 * The pack a fall left, as the player meets it (public #922): the box after a fall says the owner's words (TONE.md section 4), the
 * pack is a target "Take your pack" while its day lasts, the target's action is the kernel's `takepack`, and the picture it is drawn
 * as is a kit picture of the bundle (no new art). Pure; the drawing itself is proved by the e2e (game/e2e/pack.ts).
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, newState, packsAt, step } from '@game/kernel';
import { fallLines } from '../src/ui/ui';
import { PACK_SPRITE } from '../src/scenes/packs';
import { packAt } from '../src/targets';
import { loadBundle } from '../../tools/test/helpers/world';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

function started(): State {
  const r = step(b, newState(b, 922), { t: 'start', race: 'core/human', name: 'Eye' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('the box after a fall', () => {
  test('says "You died." and, when the outing left a pack, "Your pack lies where you died."', () => {
    const lines = fallLines(b as never, 'core/town-square', [{ item: 'core/berry', qty: 2 }]);
    expect(lines[0]).toBe('You died.');
    expect(lines).toContain('Your pack lies where you died.');
    expect(lines.join(' ')).not.toContain('gone');
    expect(lines.join(' ')).not.toContain('dark');
  });

  test('says there was nothing to lose, and names no pack, when the outing brought nothing', () => {
    const lines = fallLines(b as never, 'core/town-square', []);
    expect(lines[0]).toBe('You died.');
    expect(lines.join(' ')).not.toContain('pack');
    expect(lines.join(' ')).toContain('nothing is lost');
  });

  test('has no em dash (the game\'s text rule)', () => {
    for (const lost of [[], [{ item: 'core/berry', qty: 1 }]]) expect(fallLines(b as never, 'core/town-square', lost).join(' ')).not.toContain('—');
  });
});

describe('the target that takes the pack', () => {
  /** A state with one pack lying on a tile beside the player, laid at tick 1000. */
  function withPack(): { s: State; tile: [number, number]; stand: [number, number]; until: number } {
    const s = started();
    const tile: [number, number] = [s.player.at[0] + 1, s.player.at[1]];
    const until = 1000 + b.params.day_length_ms;
    s.player.packs = [{ id: 4, at: tile, items: { 'core/berry': 2 }, until }];
    return { s, tile, stand: [s.player.at[0], s.player.at[1]], until };
  }

  test('"Take your pack" on the pack\'s tile, and nowhere else, while its day lasts', () => {
    const { s, tile, stand, until } = withPack();
    expect(packAt(s, 2000, stand, tile)).toMatchObject({ label: 'Take your pack', tile, action: { t: 'takepack', pack: 4, at: stand } });
    expect(packAt(s, 2000, stand, stand)).toBeUndefined();
    // the tick its day is over it is not offered, and the kernel does not draw it either
    expect(packAt(s, until - 1, stand, tile)).toBeDefined();
    expect(packAt(s, until, stand, tile)).toBeUndefined();
    expect(packsAt(s, until)).toHaveLength(0);
  });

  test('its action is one the kernel allows: the berries go into the bag and the pack is gone', () => {
    const { s, tile, stand } = withPack();
    const target = packAt(s, 2000, stand, tile)!;
    const r = step(b, s, target.action, 2000);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag['core/berry']).toBe((s.player.bag['core/berry'] ?? 0) + 2);
    expect(r.state.player.packs).toBeUndefined();
  });
});

describe('the picture of the pack', () => {
  test('is a kit picture the bundle has, the basket the finds are carried in', () => {
    expect(b.sprites[PACK_SPRITE]).toBeDefined();
    expect(Object.values(b.items).some((it) => it.sprite === PACK_SPRITE)).toBe(true);
  });
});
