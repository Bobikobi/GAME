/**
 * One decode per PNG per process. The checks (kit.json against the sheet, the colour measure, the holes)
 * each read the same sheets, and the redrawn clip sheets are large, so reading each file once is most of what
 * keeps `pnpm check` and every test that assembles the content quick. A file that changes on disk is read again.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { PNG } from 'pngjs';

const cache = new Map<string, { stamp: string; png: PNG }>();
/**
 * The decode itself, shared by content: a test world copies the whole kit into a new folder each time, and keying the decode by
 * path alone kept one more full set of decoded sheets (about 200 MB of off-heap buffers, never freed) per world, which grew a
 * vitest worker to several GB. Copies of one picture at any path are one decode.
 */
const byContent = new Map<string, PNG>();

/** The decoded PNG at `abs`; throws as `PNG.sync.read` does when the file is missing or not a PNG. */
export function readPng(abs: string): PNG {
  const stat = statSync(abs);
  const stamp = `${stat.mtimeMs}:${stat.size}`;
  const hit = cache.get(abs);
  if (hit !== undefined && hit.stamp === stamp) return hit.png;
  const bytes = readFileSync(abs);
  const digest = createHash('sha1').update(bytes).digest('hex');
  let png = byContent.get(digest);
  if (png === undefined) {
    png = PNG.sync.read(bytes);
    byContent.set(digest, png);
  }
  cache.set(abs, { stamp, png });
  return png;
}

/** The distinct opaque-or-partly-opaque colours of a picture, each as `r * 65536 + g * 256 + b`, and how many pixels are half-transparent. */
export function packedColors(data: Uint8Array | Buffer): { colors: Set<number>; soft: number } {
  const colors = new Set<number>();
  let soft = 0;
  let last = -1;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha === 0) continue;
    if (alpha !== 255) soft++;
    const packed = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    if (packed === last) continue; // runs of one colour are common in drawn art
    last = packed;
    colors.add(packed);
  }
  return { colors, soft };
}

/** A packed colour as the palette writes it, lower case. */
export function hexOfPacked(packed: number): string {
  return `#${packed.toString(16).padStart(6, '0')}`;
}
