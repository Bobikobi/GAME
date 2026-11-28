import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { type AtlasFile, packShelves, writeAtlas } from '../src/kit/atlas.js';

describe('the kit atlas packing (public #919)', () => {
  test('every size is placed inside its sheet, none overlaps, and a full sheet opens the next', () => {
    const sizes = Array.from({ length: 300 }, (_, i) => ({ id: `s${i}`, w: 16 + ((i * 37) % 200), h: 16 + ((i * 53) % 180) }));
    const side = 512;
    const { rects, sheets, left } = packShelves(sizes, side);
    expect(left).toEqual([]);
    expect(rects.size).toBe(300);
    expect(sheets.length).toBeGreaterThan(1);
    const occ = sheets.map((s) => new Uint8Array(s.w * s.h));
    for (const s of sizes) {
      const r = rects.get(s.id)!;
      expect([r.w, r.h]).toEqual([s.w, s.h]);
      const sh = sheets[r.s]!;
      expect(r.x + r.w).toBeLessThanOrEqual(sh.w);
      expect(r.y + r.h).toBeLessThanOrEqual(sh.h);
      expect(sh.w).toBeLessThanOrEqual(side);
      expect(sh.h).toBeLessThanOrEqual(side);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) occ[r.s]![y * sh.w + x]! += 1;
    }
    expect(occ.every((o) => o.every((v) => v <= 1))).toBe(true);
  });

  test('a size larger than a sheet is left out, not cut', () => {
    const { rects, left } = packShelves([{ id: 'big', w: 600, h: 10 }, { id: 'ok', w: 10, h: 10 }], 512);
    expect(left).toEqual(['big']);
    expect(rects.has('ok')).toBe(true);
  });
});

describe('the kit atlas sheets', () => {
  test('every sprite the boot loads is cut back equal to its file, byte for byte; a clip sheet stays out', () => {
    const root = mkdtempSync(join(tmpdir(), 'kit-atlas-'));
    try {
      mkdirSync(join(root, 'kit', 'k'), { recursive: true });
      // pictures of random pixels with every alpha, so a premultiplied or smoothed copy shows; one wide sheet of frames
      let seed = 7;
      const rnd = (): number => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24;
      const sprites: Record<string, { url: string; clip?: unknown }> = {};
      const sizes: [number, number][] = [[16, 16], [64, 96], [33, 7], [256, 64], [5, 300], [128, 128]];
      sizes.forEach(([w, h], i) => {
        const png = new PNG({ width: w, height: h });
        for (let p = 0; p < png.data.length; p++) png.data[p] = rnd();
        const url = `kit/k/s${i}.png`;
        writeFileSync(join(root, url), PNG.sync.write(png));
        sprites[`k:s${i}`] = { url };
      });
      // a second key on the same file is one rect; a clip's sheet waits for the world and is not packed
      sprites['k:again'] = { url: 'kit/k/s0.png' };
      sprites['k:clip'] = { url: 'kit/k/s3.png', clip: { race: 'human' } };
      const clipOnly = new PNG({ width: 8, height: 8 });
      writeFileSync(join(root, 'kit', 'k', 'clip.png'), PNG.sync.write(clipOnly));
      sprites['k:cliponly'] = { url: 'kit/k/clip.png', clip: { race: 'human' } };

      const made = writeAtlas(sprites, root);
      expect(made).toEqual({ sheets: 1, files: sizes.length, left: 0 });
      const file = JSON.parse(readFileSync(join(root, 'kit', 'atlas.json'), 'utf8')) as AtlasFile;
      expect(Object.keys(file.rects)).not.toContain('kit/k/clip.png');
      const sheets = file.sheets.map((s) => PNG.sync.read(readFileSync(join(root, s.file))));
      file.sheets.forEach((s, i) => expect([sheets[i]!.width, sheets[i]!.height]).toEqual([s.w, s.h]));
      for (const [url, r] of Object.entries(file.rects)) {
        const own = PNG.sync.read(readFileSync(join(root, url)));
        expect([r.w, r.h]).toEqual([own.width, own.height]);
        const cut = new PNG({ width: r.w, height: r.h });
        PNG.bitblt(sheets[r.s]!, cut, r.x, r.y, r.w, r.h, 0, 0);
        expect(Buffer.compare(cut.data, own.data), url).toBe(0);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
