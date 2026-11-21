import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_SHEET_PX, frameRect, sheetGrid } from '@game/kernel';
import { validateFile, type ExtensionFile } from '@game/schema';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';
import { assemble, type Assembled } from '../src/assemble.js';
import { readBoard } from '../src/board.js';
import { drawnHeight } from '../src/art/scale.js';
import { checkKits } from '../src/check.js';
import { REPO_ROOT, loadAll } from '../src/load.js';
import { enclosedPockets } from '../src/kit/holes.js';
import { applyInk, inkShare } from '../src/kit/ink.js';
import { CORE_PALETTE, hexToRgb } from '../src/kit/palette.js';
import { withoutClips } from './fixtures/clips/without-clips.js';

/**
 * A long clip is a wrapped sheet: 45 frames of 128 px laid in rows of `cols`, because one row of them is 5760 px, wider than the 4096 px a
 * browser's graphics card is promised to take. The layout rule is `sheetGrid`/`frameRect` (kernel); the game's Phaser spritesheet loader
 * cuts a picture into cells row by row, which is the same rule, so a wrapped sheet needs no code in the client beyond the number the kit says.
 */
const W = 128;
const H = 128;
const FRAMES = 45;
const COLS = 16;
const FIXTURE = join(REPO_ROOT, 'tools', 'test', 'fixtures', 'clips', 'kit.json');
const STRIKE = 'chars/human_strike_left';
const fixture = (): { kit: { sprites: Record<string, Record<string, unknown>> } } & ExtensionFile => JSON.parse(readFileSync(FIXTURE, 'utf8'));

const INK = hexToRgb('#1b1a2e');
const FILL = hexToRgb(CORE_PALETTE[3]!);

/** Frame `i`: a solid block whose height is 20 + i and whose left edge is 10 + i, so no two frames are alike. */
function frameBlock(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 10 + i, y: H - 4 - (20 + i), w: 30, h: 20 + i };
}

/** The 45 frames drawn into one picture of the given grid, each at its own cell. */
function sheet(cols: number, hole?: number): PNG {
  const grid = sheetGrid({ w: W, h: H, frames: FRAMES, cols });
  const png = new PNG({ width: grid.width, height: grid.height });
  for (let i = 0; i < FRAMES; i++) {
    const cell = frameRect({ w: W, h: H, frames: FRAMES, cols }, i);
    const b = frameBlock(i);
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
        const at = ((cell.y + y) * png.width + cell.x + x) * 4;
        png.data.set([...(edge ? INK : FILL), 255], at);
        if (hole === i && x >= b.x + 10 && x < b.x + 13 && y >= b.y + 10 && y < b.y + 13) png.data[at + 3] = 0;
      }
    }
  }
  return png;
}

/** The pixels of frame `i`, cut out of a picture by the layout rule. */
function cut(png: PNG, cols: number, i: number): Buffer {
  const r = frameRect({ w: W, h: H, frames: FRAMES, cols }, i);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) png.data.copy(out, y * W * 4, ((r.y + y) * png.width + r.x) * 4, ((r.y + y) * png.width + r.x + W) * 4);
  return out;
}

describe('the sheet grid', () => {
  test('a sheet that does not wrap is one row of its frames', () => {
    expect(sheetGrid({ w: 128, h: 128, frames: 4 })).toEqual({ cols: 4, rows: 1, width: 512, height: 128 });
    expect(frameRect({ w: 128, h: 128, frames: 4 }, 3)).toEqual({ x: 384, y: 0, w: 128, h: 128 });
  });

  test('45 frames of 128 px wrap at 16 to a row into 3 rows, 2048 x 384; in one row they are 5760 px, over the limit', () => {
    expect(sheetGrid({ w: W, h: H, frames: FRAMES, cols: COLS })).toEqual({ cols: 16, rows: 3, width: 2048, height: 384 });
    expect(sheetGrid({ w: W, h: H, frames: FRAMES }).width).toBe(5760);
    expect(5760).toBeGreaterThan(MAX_SHEET_PX);
    expect(frameRect({ w: W, h: H, frames: FRAMES, cols: COLS }, 16)).toEqual({ x: 0, y: 128, w: W, h: H });
    expect(frameRect({ w: W, h: H, frames: FRAMES, cols: COLS }, 44)).toEqual({ x: 12 * 128, y: 256, w: W, h: H });
  });

  test('a wrapped sheet over 4096 px slices back to the same frames, whatever the row length', () => {
    const one = sheet(FRAMES);
    expect(one.width).toBeGreaterThan(MAX_SHEET_PX);
    for (const cols of [8, 12, COLS, 32]) {
      const wrapped = sheet(cols);
      expect(wrapped.width).toBeLessThanOrEqual(MAX_SHEET_PX);
      for (let i = 0; i < FRAMES; i++) expect(cut(wrapped, cols, i).equals(cut(one, FRAMES, i)), `frame ${i} at ${cols} to a row`).toBe(true);
    }
  });
});

describe('the checks read a wrapped sheet frame by frame', () => {
  test('the drawn height of a frame in the second and third row is that frame\'s own', () => {
    const wrapped = sheet(COLS);
    expect(drawnHeight(wrapped, W, FRAMES, H, COLS)).toBe(20 + FRAMES - 1);
    expect(drawnHeight(sheet(FRAMES), W, FRAMES)).toBe(20 + FRAMES - 1);
  });

  test('a see-through pocket in frame 20 is found there, and the pocket of a one-row sheet is found at the same frame and place', () => {
    const at = (cols: number) => enclosedPockets(sheet(cols, 20), W, FRAMES, H, cols);
    expect(at(COLS)).toEqual(at(FRAMES));
    expect(at(COLS)).toEqual([{ frame: 20, size: 9, x: frameBlock(20).x + 10, y: frameBlock(20).y + 10 }]);
  });

  test('the ink edge is read per frame down the rows, and inking a wrapped sheet equals inking its frames', () => {
    const wrapped = PNG.sync.write(sheet(COLS));
    const one = PNG.sync.write(sheet(FRAMES));
    expect(inkShare(wrapped, W, H)).toBe(1); // every block is drawn with its ink edge already
    const inked = PNG.sync.read(applyInk(wrapped, W, H));
    const plain = PNG.sync.read(applyInk(one, W));
    for (let i = 0; i < FRAMES; i++) expect(cut(inked, COLS, i).equals(cut(plain, FRAMES, i)), `frame ${i}`).toBe(true);
  });
});

describe('the kit says how a sheet is laid out, and the check holds the picture to it', () => {
  const kit = (dir: string, sprite: Record<string, unknown>): Assembled =>
    ({
      kits: { 'core/cols-test': { dir, rel: 'tmp/cols-test', sprites: { 'chars/long_clip': { file: 'chars/long_clip.png', w: W, h: H, density: 4, frames: FRAMES, ...sprite } } } },
    }) as unknown as Assembled;
  const run = (png: PNG, sprite: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), 'cols-'));
    mkdirSync(join(dir, 'chars'));
    writeFileSync(join(dir, 'chars', 'long_clip.png'), PNG.sync.write(png));
    return checkKits(kit(dir, sprite)).filter((i) => /the kit says|wider or taller|wraps nothing/.test(i.message));
  };

  test('45 frames in rows of 16 at 2048 x 384 is as the kit says', () => {
    expect(run(sheet(COLS), { cols: COLS })).toEqual([]);
  });

  test('a picture that is not the wrapped size is named with the size the kit asks for', () => {
    const issues = run(sheet(12), { cols: COLS });
    expect(issues.length).toBe(1);
    expect(issues[0]!.message).toMatch(/is 1536x512, the kit says 2048x384 \(45 frames of 128x128, 16 to a row\)/);
  });

  test('one row of 45 frames is refused for its width, and cols that wrap nothing are refused', () => {
    const wide = run(sheet(FRAMES), {});
    expect(wide.length).toBe(1);
    expect(wide[0]!.message).toMatch(/5760x128, wider or taller than 4096 px.*Wrap it into rows with cols/);
    const none = run(sheet(FRAMES), { cols: FRAMES });
    expect(none.some((i) => /wraps nothing/.test(i.message))).toBe(true);
  });
});

describe('the schema and the assembler carry cols', () => {
  const withCols = (cols: unknown, frames: unknown = FRAMES) => {
    const data = fixture();
    const s = data.kit.sprites[STRIKE]!;
    s.frames = frames;
    if (cols === undefined) delete s.cols;
    else s.cols = cols;
    return data;
  };

  test('45 frames in rows of 16 is valid; 0 or 33 to a row, a fraction, and 65 frames are refused naming the field', () => {
    expect(validateFile(withCols(COLS))).toEqual([]);
    for (const bad of [0, 33, 2.5, '16']) expect(validateFile(withCols(bad)).some((i) => i.path.endsWith('/cols')), JSON.stringify(bad)).toBe(true);
    expect(validateFile(withCols(COLS, 65)).some((i) => i.path.endsWith('/frames'))).toBe(true);
  });

  test('the bundle carries cols for the client and leaves it out for a sheet that does not wrap', () => {
    const run = (data: ReturnType<typeof fixture>) => assemble([...withoutClips(loadAll().files), { rel: 'kit/core/clip-fixture.json', abs: FIXTURE, data }], readBoard());
    const wrapped = run(withCols(COLS));
    expect(wrapped.issues.filter((i) => i.level === 'error')).toEqual([]);
    const info = wrapped.bundle!.sprites[`core/clip-fixture:${STRIKE}`]!;
    expect(info).toMatchObject({ frames: FRAMES, cols: COLS, w: W, h: H });
    const plain = run(withCols(undefined, 4)).bundle!.sprites[`core/clip-fixture:${STRIKE}`]!;
    expect('cols' in plain).toBe(false);
  });
});
