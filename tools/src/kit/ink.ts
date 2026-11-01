/**
 * The ink edge (owner's decision of 23.10, PR #305): "The outline is the one-pixel ink line #1b1a2e, on
 * every sprite." Every opaque pixel of a sprite frame that touches a transparent pixel (4-neighbours), or
 * the border of its frame, becomes ink. The pass recolours the sprite's own edge pixels: it adds no ring
 * outside the silhouette and never changes the size. It is idempotent.
 *
 * `pnpm kit:ink` applies it in place to the density 4 sprites of the core kit (not the ground tiles).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

import { CORE_PALETTE, hexToRgb } from './palette.js';

/** The ink colour: the first colour of the core palette, the outline of every sprite. */
export const INK_HEX: string = CORE_PALETTE[0]!;
const INK = hexToRgb(INK_HEX);

/** RGBA rows, as pngjs reads them; the anim tool's `Picture` has the same shape. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * The one definition of the ink edge, used by the kit check, `kit:ink` and the anim tool: an opaque pixel is
 * solid, and a frame's border counts as outside. `frameWidth` splits a strip into frames (a single picture:
 * its width).
 */
const solidAt = (r: Raster, x: number, y: number, x0: number, frameWidth: number): boolean =>
  x >= x0 && x < x0 + frameWidth && y >= 0 && y < r.height && r.data[(y * r.width + x) * 4 + 3] === 255;

function frameCheck(r: Raster, frameWidth: number): void {
  if (!Number.isInteger(frameWidth) || frameWidth <= 0 || r.width % frameWidth !== 0) {
    throw new Error(`frame width ${frameWidth} does not divide the image width ${r.width}`);
  }
}

/** Edge pixels of a frame: solid pixels with a 4-neighbour that is not solid or lies outside the frame. */
export function edgePixels(r: Raster, frameWidth: number = r.width): number[] {
  frameCheck(r, frameWidth);
  const out: number[] = [];
  for (let x0 = 0; x0 < r.width; x0 += frameWidth) {
    for (let y = 0; y < r.height; y++) {
      for (let x = x0; x < x0 + frameWidth; x++) {
        if (!solidAt(r, x, y, x0, frameWidth)) continue;
        if (!solidAt(r, x - 1, y, x0, frameWidth) || !solidAt(r, x + 1, y, x0, frameWidth) || !solidAt(r, x, y - 1, x0, frameWidth) || !solidAt(r, x, y + 1, x0, frameWidth)) out.push(y * r.width + x);
      }
    }
  }
  return out;
}

/** The pixels just outside a silhouette (clear, with a solid 4-neighbour in the frame): where a ring of ink goes. */
export function ringPixels(r: Raster, frameWidth: number = r.width): number[] {
  frameCheck(r, frameWidth);
  const out: number[] = [];
  for (let x0 = 0; x0 < r.width; x0 += frameWidth) {
    for (let y = 0; y < r.height; y++) {
      for (let x = x0; x < x0 + frameWidth; x++) {
        if (solidAt(r, x, y, x0, frameWidth)) continue;
        if (solidAt(r, x - 1, y, x0, frameWidth) || solidAt(r, x + 1, y, x0, frameWidth) || solidAt(r, x, y - 1, x0, frameWidth) || solidAt(r, x, y + 1, x0, frameWidth)) out.push(y * r.width + x);
      }
    }
  }
  return out;
}

/** Whether pixel `p` of the raster is exactly the ink colour. */
export const isInk = (r: Raster, p: number): boolean => r.data[p * 4] === INK[0] && r.data[p * 4 + 1] === INK[1] && r.data[p * 4 + 2] === INK[2];

/** Paint pixel `p` the ink colour, fully opaque. */
export function paintInk(r: Raster, p: number): void {
  r.data[p * 4] = INK[0];
  r.data[p * 4 + 1] = INK[1];
  r.data[p * 4 + 2] = INK[2];
  r.data[p * 4 + 3] = 255;
}

/** The PNG with its edge pixels recoloured to ink, frame by frame. Returns the new bytes. */
export function applyInk(buffer: Buffer, frameWidth: number): Buffer {
  const png = PNG.sync.read(buffer);
  for (const p of edgePixels(png, frameWidth)) paintInk(png, p);
  return PNG.sync.write(png);
}

/** The share (0 to 1) of a sprite's edge pixels that are ink. A sprite with no opaque pixel has no edge: 1. */
export function inkShare(buffer: Buffer, frameWidth: number): number {
  const png = PNG.sync.read(buffer);
  const edge = edgePixels(png, frameWidth);
  if (edge.length === 0) return 1;
  const ink = edge.filter((p) => isInk(png, p)).length;
  return ink / edge.length;
}

interface KitFile {
  kit: { sprites: Record<string, { file: string; w: number; density?: number }> };
}

/** The sprites `kit:ink` and the check cover: density 4, and neither seamless ground (`tiles/`) nor an animal (`creatures/`, pick C of 31.10). */
export function inkSprites(sprites: KitFile['kit']['sprites']): [string, { file: string; w: number }][] {
  return Object.entries(sprites).filter(([name, s]) => s.density === 4 && !name.startsWith('tiles/') && !name.startsWith('creatures/'));
}

/** Apply the pass in place to the kit at `kitDir`. Returns the files it changed. */
export function inkKit(kitDir: string): string[] {
  const kit = JSON.parse(readFileSync(join(kitDir, 'kit.json'), 'utf8')) as KitFile;
  const changed: string[] = [];
  for (const [, s] of inkSprites(kit.kit.sprites)) {
    const path = join(kitDir, s.file);
    const before = readFileSync(path);
    const after = applyInk(before, s.w);
    if (!PNG.sync.read(before).data.equals(PNG.sync.read(after).data)) {
      writeFileSync(path, after);
      changed.push(s.file);
    }
  }
  return changed;
}

function runCli(args: readonly string[]): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(args[0] ?? join(here, '../../../content/kit/core'));
  const changed = inkKit(dir);
  process.stdout.write(`${changed.length} sprite(s) changed${changed.length > 0 ? `: ${changed.join(', ')}` : ''}\n`);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) runCli(process.argv.slice(2));
