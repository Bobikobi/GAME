/**
 * The carcass on its tile (public #930): after a take it shows where the animal fell, it shrinks as it is dressed and once
 * the meat has spoiled, and it is gone once it is dressed. Pure, in the manner of throw-charge.test.ts. The picture is a
 * stand-in (the animal's own still on its side), so these tests hold the rule it follows, not a drawing.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type State, type Tile, DRESS_PARTS, newState, placeCarcass, step, walkableFor } from '@game/kernel';
import { BARE_SHARE, CARCASS_STEP, carcassLooks, carcassScale } from '../src/carcass-look';
import { loadBundle } from '../../tools/test/helpers/world';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

function started(): State {
  const r = step(b, newState(b, 930), { t: 'start', race: 'core/human', name: 'Eye' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.bag = { [b.params.hunt.throw_item]: 3 };
  return r.state;
}

/** The sure short throw at the first hare's spot from a tile beside it, as the kernel's own take test does it. */
function takeHare(s: State): { state: State; tile: Tile; tick: number } {
  const i = b.map.creatures!.spots.findIndex((sp) => sp.kind === 'core/hare');
  const sp = b.map.creatures!.spots[i]!;
  const walk = walkableFor(b);
  const at = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [sp.x + dx, sp.y + dy] as Tile).find(([x, y]) => walk(x, y, s.player))!;
  s.player.at = at;
  const act: Action = { t: 'throw', at, aim: [sp.x, sp.y], kind: b.params.hunt.throw_item, power: b.params.stones.throw_min_power, prey: i };
  const r = step(b, s, act, 0);
  if (!r.ok) throw new Error(r.error);
  return { state: r.state, tile: [sp.x, sp.y], tick: r.state.player.busyUntil };
}

describe('the carcass on its tile', () => {
  test('a take lays it where the animal stood, whole, on its side; the label of its target is the kernel\'s own', () => {
    const { state, tile, tick } = takeHare(started());
    const looks = carcassLooks(b, state, tick);
    expect(looks).toHaveLength(1);
    expect(looks[0]).toMatchObject({ kind: 'core/hare', tile, scale: 1 });
    expect(Math.abs(looks[0]!.angle)).toBe(90);
  });

  test('it is gone from the screen once it is dressed', () => {
    const { state, tick } = takeHare(started());
    const id = state.player.carcasses![0]!.id;
    const r = step(b, state, { t: 'dress', carcass: id, at: state.player.at }, tick);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.carcasses ?? []).toHaveLength(0);
    expect(carcassLooks(b, r.state, r.state.player.busyUntil)).toEqual([]);
  });

  test('it shrinks in quarter steps with the dressing: a roe of two parts is half drawn after the first', () => {
    const s = started();
    const c = placeCarcass(b, s, 'core/roe', s.player.at, 1, 0);
    expect(DRESS_PARTS.medium).toBe(2);
    expect(carcassScale(b, c, 0)).toBe(1);
    c.dressed = 1;
    expect(carcassScale(b, c, 0)).toBe(0.5);
  });

  test('once the meat has spoiled only the hide and bones are drawn, half the size; it is gone with the hide', () => {
    const s = started();
    const c = placeCarcass(b, s, 'core/hare', s.player.at, 1, 0);
    const day = b.params.day_length_ms;
    const { meat_spoil_d, hide_spoil_d } = b.params.hunt;
    expect(carcassScale(b, c, meat_spoil_d * day - 1)).toBe(1);
    expect(carcassScale(b, c, meat_spoil_d * day)).toBe(BARE_SHARE);
    expect(carcassScale(b, c, hide_spoil_d * day - 1)).toBe(BARE_SHARE);
    expect(carcassScale(b, c, hide_spoil_d * day)).toBe(0);
    // a half-dressed one that has spoiled is a quarter of the whole, never smaller than one step
    const roe = placeCarcass(b, s, 'core/roe', s.player.at, 1, 0);
    roe.dressed = 1;
    expect(carcassScale(b, roe, meat_spoil_d * day)).toBe(CARCASS_STEP);
  });

  test('the same save draws the same ground: the turn follows the carcass number', () => {
    const s = started();
    const a = placeCarcass(b, s, 'core/hare', [3, 3], 1, 0);
    const c = placeCarcass(b, s, 'core/hare', [4, 3], 1, 0);
    const looks = carcassLooks(b, s, 0);
    expect(looks.map((l) => l.id)).toEqual([a.id, c.id]);
    expect(looks[0]!.angle).not.toBe(looks[1]!.angle);
  });
});
