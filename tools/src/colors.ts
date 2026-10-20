/**
 * How much colour an art asset and a phone screen actually carry (ART_SYSTEM section 3, the
 * measure behind the ramp rule). The 20.10 finding was that the study's water held 8 colours
 * per 64 px tile against a reference's 41 to 44, and that no number in the repository could see
 * the difference. This module is that number.
 *
 * It reads the art, not the drawing code: the colours of each sprite are decoded from its PNG,
 * so a redraw moves the count and a comment does not. Warnings only, like richness: the owner
 * decides if one becomes an error.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

import type { Bundle } from '@game/kernel';
import type { Assembled } from './assemble';
import type { Issue } from './load';
import { richnessWindows } from './richness';

/** A colour as the palette writes it, lower case. */
export type Hex = string;

const hexOf = (r: number, g: number, b: number): Hex =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** Every colour a PNG draws with, as the palette writes it. */
export function pngColors(png: PNG): Set<Hex> {
  const colors = new Set<Hex>();
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    colors.add(hexOf(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!));
  }
  return colors;
}

/** The colours of every sprite of every kit, by sprite reference (`kit:group/name`). */
export function spriteColors(a: Assembled): Map<string, Set<Hex>> {
  const out = new Map<string, Set<Hex>>();
  for (const [kitId, kit] of Object.entries(a.kits)) {
    for (const [name, s] of Object.entries(kit.sprites)) {
      try {
        out.set(`${kitId}:${name}`, pngColors(PNG.sync.read(readFileSync(join(kit.dir, s.file)))));
      } catch {
        // a missing or unreadable PNG is checkKits' error to report, not this measure's
      }
    }
  }
  return out;
}

/** How many colours each sprite of the `tiles/` group carries, which is the per-tile measure. */
export function tileColorCounts(
  a: Assembled,
  colors: Map<string, Set<Hex>> | undefined = undefined,
): { ref: string; colors: number; density: number }[] {
  const bySprite = colors ?? spriteColors(a);
  const out: { ref: string; colors: number; density: number }[] = [];
  for (const kitId of Object.keys(a.kits)) {
    for (const [name, s] of Object.entries(a.kits[kitId]!.sprites)) {
      if (!name.startsWith('tiles/')) continue;
      const set = bySprite.get(`${kitId}:${name}`);
      if (set) out.push({ ref: `${kitId}:${name}`, colors: set.size, density: s.density });
    }
  }
  return out.sort((x, y) => x.colors - y.colors);
}

/** How many distinct colours the sprites under one phone window carry together. */
export function windowColors(b: Bundle, colors: Map<string, Set<Hex>>): { x: number; y: number; w: number; h: number; colors: number; sprites: number }[] {
  const windows = richnessWindows(b).filter((w) => w.judged);
  const out: { x: number; y: number; w: number; h: number; colors: number; sprites: number }[] = [];
  for (const win of windows) {
    const used = new Set<string>();
    for (let y = win.y; y < win.y + win.h; y += 1) {
      for (let x = win.x; x < win.x + win.w; x += 1) {
        const tile = b.map.legend[b.map.ground[y]?.[x] ?? ''];
        if (tile) used.add(tile.sprite);
      }
    }
    for (const pr of b.map.props) {
      if (pr.x < win.x + win.w && pr.x + pr.w > win.x && pr.y < win.y + win.h && pr.y + pr.h > win.y) used.add(pr.sprite);
    }
    const union = new Set<Hex>();
    let sprites = 0;
    for (const ref of used) {
      const set = colors.get(ref);
      if (!set) continue;
      sprites += 1;
      for (const hex of set) union.add(hex);
    }
    out.push({ x: win.x, y: win.y, w: win.w, h: win.h, colors: union.size, sprites });
  }
  return out;
}

/** The median of a list of numbers, rounded down, or 0 for none. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** The advisory lines: what the art carries today, and the thickest phone windows. */
export function checkColors(a: Assembled): Issue[] {
  const b = a.bundle;
  if (!b) return [];
  const colors = spriteColors(a);
  const tiles = tileColorCounts(a, colors);
  const windows = windowColors(b, colors);
  const issues: Issue[] = [];
  if (tiles.length > 0) {
    const counts = tiles.map((t) => t.colors);
    const thin = tiles.filter((t) => t.colors <= 5).length;
    const at64 = tiles.filter((t) => t.density === 4).length;
    issues.push({
      file: 'content/kit',
      where: 'art.tileColors',
      message: `colours per tile sprite (${tiles.length} sprites, ${at64} at 64 px): median ${median(counts)}, ${counts[0]} at the thin end, ${counts[counts.length - 1]} at the rich end, ${thin} at five colours or fewer`,
      level: 'warning',
    });
  }
  if (windows.length > 0) {
    const counts = windows.map((w) => w.colors);
    const richest = [...windows].sort((x, y) => y.colors - x.colors).slice(0, 3);
    issues.push({
      file: 'content/kit',
      where: 'art.windowColors',
      message: `colours per phone window over ${windows.length} windows: median ${median(counts)}, richest ${richest.map((w) => `${w.colors} at tiles (${w.x},${w.y})`).join(', ')}`,
      level: 'warning',
    });
  }
  return issues;
}
