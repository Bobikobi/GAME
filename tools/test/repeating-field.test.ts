import { expect, test } from 'vitest';
import { PNG } from 'pngjs';
import { reconcileStudyField, studyFieldEdgeMismatches } from '../src/kit/repeating-field';

test('sealing a field closes both border directions while preserving its authored central pixels', () => {
  const image = new PNG({ width: 32, height: 32 });
  const palette = ['#1b1a2e', '#8f94a8', '#f5f4ef'];
  const colors = [[27, 26, 46], [143, 148, 168], [245, 244, 239]];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    image.data.set([...colors[(x + y * 2) % 3]!, 255], (y * 32 + x) * 4);
  }
  const original = Buffer.from(image.data);
  expect(studyFieldEdgeMismatches(image).horizontal).toBeGreaterThan(0);
  reconcileStudyField(image, palette);
  expect(studyFieldEdgeMismatches(image)).toEqual({ horizontal: 0, vertical: 0 });
  for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) {
    const at = (y * 32 + x) * 4;
    expect(image.data.subarray(at, at + 4)).toEqual(original.subarray(at, at + 4));
  }
  for (let at = 0; at < image.data.length; at += 4) {
    expect(colors).toContainEqual([...image.data.subarray(at, at + 3)]);
    expect(image.data[at + 3]).toBe(255);
  }
});
