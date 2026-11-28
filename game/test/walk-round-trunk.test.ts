import { describe, expect, test } from 'vitest';
import { roundTrunk } from '../e2e/walk';
import { BODY_BOX } from '../src/walking';

// The e2e walker's way round a trunk's disc on a painted land: the cases are the two the phone opening met on the painted
// valley (a disc inside 30,10 left of the middle; a disc at the corner of 16,11), with the body's box from walking.ts.
describe('roundTrunk', () => {
  test('a disc left of the way up steps the feet right, inside the target tile', () => {
    expect(roundTrunk([1950, 675], [0, -1], [30, 9], [{ x: 1941, y: 658, r: 9 }])).toEqual([1, 0]);
  });

  test('a disc at the right corner steps the feet left, the right side being outside the tile', () => {
    expect(roundTrunk([1011, 704], [0, -1], [15, 10], [{ x: 1023, y: 687, r: 9 }])).toEqual([-1, 0]);
  });

  test('a disc the box clears across, behind the feet, or too far ahead leaves the push alone', () => {
    const clear = BODY_BOX.w / 2 + 9;
    expect(roundTrunk([1011, 704], [0, -1], [15, 10], [{ x: 1011 + clear, y: 687, r: 9 }])).toBeUndefined();
    expect(roundTrunk([1011, 704], [0, -1], [15, 10], [{ x: 1011, y: 720, r: 9 }])).toBeUndefined();
    expect(roundTrunk([1011, 704], [0, -1], [15, 10], [{ x: 1011, y: 600, r: 9 }])).toBeUndefined();
  });

  test('a walk along x goes round on y, and a diagonal is never steered', () => {
    expect(roundTrunk([1000, 700], [1, 0], [16, 10], [{ x: 1020, y: 705, r: 9 }])).toEqual([0, -1]);
    expect(roundTrunk([1000, 700], [1, -1], [16, 10], [{ x: 1020, y: 705, r: 9 }])).toBeUndefined();
  });
});
