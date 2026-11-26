/**
 * The hunt balance prover (tools/src/balance/hunt-ladder.ts, BESTIARY_LANDS 4): the habitat tiles counted by danger
 * band, the standing count in a kind's own region band, the takes a day, and the players at which the kind empties in
 * one day; a d0 kind goes red when it empties under 8 players.
 */
import { describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { huntBalance, onMap, readLadder, standingInRegion } from '../src/balance/hunt-ladder';
import { loadBundle } from './helpers/world';

const base = loadBundle();

/** A meadow-only bundle: width x height tiles of the valley's meadow, each rectangle an area slot of its danger band. */
function regionBundle(width: number, height: number, areas: { x: number; y: number; w: number; h: number; danger: number }[]): Bundle {
  const meadow = Object.entries(base.map.legend).find(([, v]) => v.tag === 'meadow')![0];
  const map: Bundle['map'] = {
    ...base.map,
    width,
    height,
    ground: Array.from({ length: height }, () => meadow.repeat(width)),
    slots: areas.map((a, i) => ({ id: `test/area-${i}`, kind: 'area' as const, x: a.x, y: a.y, w: a.w, h: a.h, danger: a.danger })),
    props: [],
  };
  return { ...base, map };
}

describe('the hunt balance (BESTIARY_LANDS 4)', () => {
  it('counts a kind\'s habitat in its own danger band, and prints the three numbers', () => {
    const bundle = regionBundle(50, 40, [
      { x: 0, y: 0, w: 25, h: 40, danger: 0 },
      { x: 25, y: 0, w: 25, h: 40, danger: 1 },
    ]);
    const ladder = onMap(readLadder(), bundle);
    expect(ladder.kinds.find((k) => k.id === 'hare')!.region_habitat_tiles).toEqual([1000, 1000, 0]);
    const rows = huntBalance(ladder);
    expect(rows.find((r) => r.id === 'hare')).toMatchObject({ region: 0, standing: 12, takes: { num: 12, den: 1 }, players: 12, red: false });
    // a d1 kind reads only the d1 band, not the whole map
    expect(rows.find((r) => r.id === 'wild-boar')).toMatchObject({ region: 1, standing: 8, takes: { num: 8, den: 2 }, players: 8, red: false });
  });

  it('the doc\'s example: a d0 kind on 2000 tiles of its habitat stands at 24', () => {
    const rows = huntBalance(onMap(readLadder(), regionBundle(50, 40, [{ x: 0, y: 0, w: 50, h: 40, danger: 0 }])));
    expect(rows.find((r) => r.id === 'hare')).toMatchObject({ standing: 24, takes: { num: 24, den: 1 }, players: 24, red: false });
  });

  it('a d0 kind goes red when it empties under 8 players, and not at 8', () => {
    const ladder = readLadder();
    const hare = ladder.kinds.find((k) => k.id === 'hare')!;
    const row = (tiles: [number, number, number]) => huntBalance({ ...ladder, kinds: [{ ...hare, region_habitat_tiles: tiles }] })[0]!;
    expect(row([600, 0, 0])).toMatchObject({ standing: 7, takes: { num: 7, den: 1 }, players: 7, red: true });
    expect(row([700, 0, 0])).toMatchObject({ standing: 8, takes: { num: 8, den: 1 }, players: 8, red: false });
  });

  it('a d0 kind with no habitat in its own band is none, not ok or red; a kind with no tag has no standing', () => {
    const ladder = readLadder();
    const hare = ladder.kinds.find((k) => k.id === 'hare')!;
    const empty = huntBalance({ ...ladder, kinds: [{ ...hare, region_habitat_tiles: [0, 1000, 0] }] })[0]!;
    expect(empty).toMatchObject({ standing: 0, players: 0, none: true, red: false });
    expect(standingInRegion(ladder.kinds.find((k) => k.habitat_tag === null)!)).toBeNull();
  });
});
