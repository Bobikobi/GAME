import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { hexOfPacked, packedColors, readPng } from '../src/pngcache.js';

function picture(rgba: number[][]): Buffer {
  const png = new PNG({ width: rgba.length, height: 1 });
  rgba.forEach((px, i) => px.forEach((v, k) => (png.data[i * 4 + k] = v)));
  return PNG.sync.write(png);
}

describe('one decode per PNG', () => {
  test('a file is decoded once, and read again when it changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pngcache-'));
    try {
      const file = join(dir, 'a.png');
      writeFileSync(file, picture([[1, 2, 3, 255]]));
      const first = readPng(file);
      expect(readPng(file)).toBe(first);
      writeFileSync(file, picture([[1, 2, 3, 255], [9, 9, 9, 255]]));
      expect(readPng(file).width).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('colours are the distinct drawn ones, clear pixels skipped, half-transparent ones counted', () => {
    const { data } = PNG.sync.read(picture([[27, 26, 46, 255], [27, 26, 46, 255], [245, 244, 239, 255], [0, 0, 0, 0], [5, 5, 5, 100]]));
    const { colors, soft } = packedColors(data);
    expect([...colors].map(hexOfPacked).sort()).toEqual(['#050505', '#1b1a2e', '#f5f4ef']);
    expect(soft).toBe(1);
  });
});
