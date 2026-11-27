import { describe, expect, test } from 'vitest';
import { PNG } from 'pngjs';

import { HELD_OBJECTS, HELD_TOLERANCE, HELD_WAIVERS, type HeldRow, heldProblems, sizeOf, heldBody } from '../src/kit/held.js';
import { STONE_SCALE } from '../../game/src/stone-art';

/** One frame `w` x `h` with a grey rectangle `bw` x `bh` at (x, y) and a skin-coloured pixel row that is no stone. */
function frame(w: number, h: number, box?: { x: number; y: number; bw: number; bh: number }): PNG {
  const png = new PNG({ width: w, height: h });
  if (box) for (let y = box.y; y < box.y + box.bh; y++) for (let x = box.x; x < box.x + box.bw; x++) png.data.set([143, 148, 168, 255], (y * w + x) * 4);
  // a skin patch far from the stone: not grey, never counted
  png.data.set([237, 168, 58, 255], (0 * w + 0) * 4);
  return png;
}
const view = (png: PNG) => ({ data: png.data, sheetW: png.width, x0: 0, w: png.width, h: png.height });

describe('the stone body in a frame', () => {
  test('is the grey body at the hand point, by its box and its pixels', () => {
    const b = heldBody(view(frame(40, 40, { x: 10, y: 12, bw: 20, bh: 15 })), [20, 20]);
    expect(b).toEqual({ w: 20, h: 15, area: 300 });
  });
  test('is nothing where the hand holds no grey, and skin is not stone', () => {
    expect(heldBody(view(frame(40, 40)), [20, 20])).toBeUndefined();
    expect(heldBody(view(frame(40, 40, { x: 30, y: 30, bw: 8, bh: 8 })), [2, 2])).toBeUndefined();
  });
  test('ink and half-transparent pixels are not grey', () => {
    const png = frame(20, 20, { x: 4, y: 4, bw: 10, bh: 10 });
    png.data.set([27, 26, 46, 255], (4 * 20 + 4) * 4); // the ink corner leaves the body
    png.data.set([143, 148, 168, 100], (13 * 20 + 13) * 4); // a soft pixel too
    expect(heldBody(view(png), [8, 8])).toMatchObject({ w: 10, h: 10, area: 98 });
  });
});

describe('the size of a stone', () => {
  test('is its longer side at the scale it shows at over its density', () => {
    expect(sizeOf({ w: 40, h: 30 }, 0.7, 4)).toBeCloseTo(7);
    expect(sizeOf({ w: 20, h: 30 }, 1, 1)).toBe(30);
  });
  test('the held stone is the large one at the one scale the game draws it at (game/src/stone-art.ts)', () => {
    expect(HELD_OBJECTS.lift!.scale).toBe(STONE_SCALE.large);
    expect(HELD_OBJECTS.carry!.world).toBe('items/stone');
  });
});

const rows = (clip: string, ratios: (number | undefined)[]): HeldRow[] => ratios.map((ratio, frame) => ({ clip, verb: 'carry', frame, ratio }));

describe('the rule: an object keeps its size in the hands', () => {
  test('holds at the world size within the tolerance', () => {
    expect(HELD_TOLERANCE).toBe(0.1);
    expect(heldProblems(rows('chars/a_carry_front', [0.95, 1, 1.05, 1.1]), {})).toEqual([]);
  });
  test('a frame bigger than the world stone names the clip, the frame and the ratio', () => {
    const p = heldProblems(rows('chars/a_carry_front', [1, 1, 1.25]), {});
    expect(p).toHaveLength(1);
    expect(p[0]!.clip).toBe('chars/a_carry_front');
    expect(p[0]!.message).toContain('frame 2');
    expect(p[0]!.message).toContain('125%');
  });
  test('a clip whose largest frame is under the tolerance is too small, with that frame and its ratio', () => {
    const p = heldProblems(rows('chars/a_carry_front', [0.6, 0.62, 0.59]), {});
    expect(p[0]!.message).toContain('largest frame (1)');
    expect(p[0]!.message).toContain('62%');
  });
  test('a frame where the body hides the stone does not fail a clip that shows it whole elsewhere', () => {
    expect(heldProblems(rows('chars/a_lift_back', [0.3, 0.5, 1, undefined]), {})).toEqual([]);
  });
  test('a clip that shows no stone at its hand point cannot be held', () => {
    expect(heldProblems(rows('chars/a_carry_front', [undefined, undefined]), {})[0]!.message).toContain('no frame shows');
  });
  test('a waiver hides a failing clip, and is refused once the clip passes or the clip is gone', () => {
    const bad = rows('chars/a_carry_front', [0.5]);
    expect(heldProblems(bad, { 'chars/a_carry_front': 'art lane' })).toEqual([]);
    expect(heldProblems(rows('chars/a_carry_front', [1]), { 'chars/a_carry_front': 'art lane' })[0]!.message).toContain('take it off HELD_WAIVERS');
    expect(heldProblems([], { 'chars/gone': 'art lane' })[0]!.message).toContain('draws no held object');
  });
  test('the waiver list names only clips of the kit', () => {
    for (const name of Object.keys(HELD_WAIVERS)) expect(name).toMatch(/^chars\/[a-z]+_(lift|carry)_(front|back|left)$/);
  });
});
