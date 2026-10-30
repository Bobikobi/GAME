/**
 * Holes in a drawing (DECISIONS.md, 2026-10-23): the check reports a see-through speck of at most 24 px that a
 * density 4 sprite's drawing encloses, and names the command that imports the sprite again from its raw drawing.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { enclosedPockets, holeProblems, type HoleSprite, type Picture, SPECK_MAX } from '../src/kit/holes';
import { CONTENT_DIR } from '../src/load';

type Rect = readonly [x: number, y: number, w: number, h: number];

/** A `width` by `height` strip, see-through, with the `solid` rectangles painted and the `clear` ones cut back out. */
function picture(width: number, height: number, solid: readonly Rect[], clear: readonly Rect[] = []): Picture {
  const data = new Uint8Array(width * height * 4);
  const paint = ([x0, y0, w, h]: Rect, alpha: number) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) data.set([90, 60, 40, alpha], (y * width + x) * 4);
    }
  };
  for (const rect of solid) paint(rect, 255);
  for (const rect of clear) paint(rect, 0);
  return { width, height, data };
}

const AXE: HoleSprite = { w: 64, frames: 1, density: 4, source: { spec: 'tools/kit-gen/rich-items.json', manifest: 'tools/kit-gen/rich-wave.manifest.jsonl:1' } };
const BODY: Rect = [10, 10, 40, 40];

describe('enclosed pockets', () => {
  it('finds a speck the drawing encloses, its size and its first pixel', () => {
    expect(enclosedPockets(picture(64, 64, [BODY], [[20, 30, 3, 3]]), 64, 1)).toEqual([{ frame: 0, size: 9, x: 20, y: 30 }]);
  });

  it('lets a pocket that meets the outside at a corner out: a notch, not a hole', () => {
    // the body's top-left pixel is cut, and the pocket inside touches it corner to corner only
    const notch = picture(64, 64, [BODY], [[10, 10, 1, 1], [11, 11, 2, 2]]);
    expect(enclosedPockets(notch, 64, 1)).toEqual([]);
    expect(holeProblems(AXE, notch, 'content/kit/core/items/axe.png')).toEqual([]);
  });

  it('reads each frame on its own: an edge between two frames is an edge', () => {
    // frame 1 is cut at its right edge, which is inside the strip; frame 2 holds a one-pixel speck
    const strip = picture(32, 16, [[0, 0, 32, 16]], [[15, 4, 1, 8], [24, 8, 1, 1]]);
    expect(enclosedPockets(strip, 16, 2)).toEqual([{ frame: 1, size: 1, x: 8, y: 8 }]);
    const [message] = holeProblems({ ...AXE, w: 16, frames: 2 }, strip, 'content/kit/core/chars/x.png');
    expect(message).toContain('a see-through pocket of 1 px in frame 2 at 8,8');
  });
});

describe('the hole check', () => {
  it(`reports a speck of at most ${SPECK_MAX} px at density 4 and names the re-import from its raw drawing`, () => {
    const problems = holeProblems(AXE, picture(64, 64, [BODY], [[20, 30, 4, 6], [40, 20, 1, 1]]), 'content/kit/core/items/axe.png');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('2 see-through pockets of at most 24 px, 25 px in all, the largest (24 px) at 20,30');
    expect(problems[0]).toContain('"pnpm kit:gen tools/kit-gen/rich-items.json --only axe --reimport --out <run>" from the repository root');
    expect(problems[0]).toContain('the one holding raw/axe-2026-10-23T08-05-27-471Z.png (tools/kit-gen/rich-wave.manifest.jsonl:1)');
    expect(problems[0]).toContain('then copy <run>/axe.png over content/kit/core/items/axe.png');
  });

  it('passes an opening larger than that', () => {
    expect(holeProblems(AXE, picture(64, 64, [BODY], [[20, 30, 5, 5]]), 'content/kit/core/items/axe.png')).toEqual([]);
  });

  it('leaves density 1 out', () => {
    expect(holeProblems({ ...AXE, density: 1 }, picture(64, 64, [BODY], [[20, 30, 1, 1]]), 'content/kit/core/items/axe.png')).toEqual([]);
  });

  it('names the command with its blanks when the sprite names no source', () => {
    const [message] = holeProblems({ w: 64, frames: 1, density: 4 }, picture(64, 64, [BODY], [[20, 30, 1, 1]]), 'content/kit/core/items/x.png');
    expect(message).toContain('"pnpm kit:gen <spec> --only <entry> --reimport --out <run>"');
    expect(message).toContain('the sprite names no "source" in kit.json');
  });
});

describe('holes in the kit', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-holes-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  // a 2x2 speck in the middle of the axe's drawing, where every pixel around it is solid
  const axePath = join(root, 'kit', 'core', 'items', 'axe.png');
  const axe = PNG.sync.read(readFileSync(axePath));
  const solid = (x: number, y: number) => (axe.data[(y * axe.width + x) * 4 + 3] ?? 0) >= 128;
  const spot = Array.from({ length: axe.width * axe.height }, (_, i) => [i % axe.width, Math.floor(i / axe.width)] as const).find(([x, y]) => {
    if (x < 1 || y < 1 || x + 2 >= axe.width || y + 2 >= axe.height) return false;
    for (let dy = -1; dy <= 2; dy += 1) {
      for (let dx = -1; dx <= 2; dx += 1) {
        if (!solid(x + dx, y + dy)) return false;
      }
    }
    return true;
  });
  if (spot === undefined) throw new Error('the axe has no solid 4x4 block');
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) axe.data[((spot[1] + dy) * axe.width + spot[0] + dx) * 4 + 3] = 0;
  writeFileSync(axePath, PNG.sync.write(axe));

  const holes = runCheck(root).issues.filter((i) => i.message.includes('see-through pocket'));

  it('reports the punched speck at error level, with the command for the axe', () => {
    expect(holes).toHaveLength(1);
    expect(holes[0]?.level).toBe('error');
    expect(holes[0]?.where).toBe('kit.sprites.items/axe');
    expect(holes[0]?.file.endsWith('kit/core/items/axe.png')).toBe(true);
    expect(holes[0]?.message).toContain(`a see-through pocket of 4 px at ${spot[0]},${spot[1]}`);
    expect(holes[0]?.message).toContain('pnpm kit:gen tools/kit-gen/rich-items.json --only axe --reimport');
    expect(holes[0]?.message).toContain('raw/axe-2026-10-23T08-05-27-471Z.png');
  });
});
