/**
 * The kit's sprites packed into a few sheets for the client (public #919): a phone on 4G paid the latency of each of some 230 small files, a few at a time, before the
 * world could start. `pnpm bundle` writes `game/public/kit/atlas-<n>.png` and `atlas.json` beside the copied kits; the boot fetches the sheets and cuts every sprite back
 * into its own texture under its own key (game/src/kit-atlas.ts), so nothing that reads a sprite changes. Only the sprites the boot loads go in: a clip's sheet (a figure's
 * drawn moves) waits for the world, which loads the ones of the player's race (game/src/clips.ts `raceClips`). The loose files stay too: without `atlas.json` the boot
 * loads them one by one.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

/** a sheet's side: every phone decodes a 2048 square, and the cut reads it once */
export const ATLAS_SIDE = 2048;

export interface AtlasRect {
  /** the sheet's index */
  s: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasFile {
  format: 1;
  sheets: { file: string; w: number; h: number }[];
  /** by the sprite's url as the bundle writes it (kit/<kit>/<path>.png) */
  rects: Record<string, AtlasRect>;
}

/** Shelf packing, tallest first: places each size in a sheet of `side` x `side`, opening a new sheet when one is full. Sizes wider or taller than a sheet are left out. */
export function packShelves(sizes: readonly { id: string; w: number; h: number }[], side = ATLAS_SIDE): { rects: Map<string, AtlasRect>; sheets: { w: number; h: number }[]; left: string[] } {
  const order = [...sizes].sort((a, b) => b.h - a.h || b.w - a.w || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rects = new Map<string, AtlasRect>();
  const sheets: { w: number; h: number; shelfY: number; shelfH: number; x: number }[] = [];
  const left: string[] = [];
  for (const it of order) {
    if (it.w > side || it.h > side) {
      left.push(it.id);
      continue;
    }
    let placed = false;
    for (let s = 0; s < sheets.length && !placed; s++) {
      const sh = sheets[s]!;
      if (sh.x + it.w <= side && sh.shelfY + it.h <= side && it.h <= sh.shelfH) {
        rects.set(it.id, { s, x: sh.x, y: sh.shelfY, w: it.w, h: it.h });
        sh.x += it.w;
        sh.w = Math.max(sh.w, sh.x);
        placed = true;
      } else if (sh.shelfY + sh.shelfH + it.h <= side) {
        // a new shelf under the last one
        sh.shelfY += sh.shelfH;
        sh.shelfH = it.h;
        sh.x = it.w;
        rects.set(it.id, { s, x: 0, y: sh.shelfY, w: it.w, h: it.h });
        sh.w = Math.max(sh.w, sh.x);
        sh.h = sh.shelfY + sh.shelfH;
        placed = true;
      }
    }
    if (!placed) {
      sheets.push({ w: it.w, h: it.h, shelfY: 0, shelfH: it.h, x: it.w });
      rects.set(it.id, { s: sheets.length - 1, x: 0, y: 0, w: it.w, h: it.h });
    }
  }
  return { rects, sheets: sheets.map((s) => ({ w: s.w, h: s.h })), left };
}

/** Packs every sprite file the boot loads (urls relative to `publicDir`; a clip's sheet is left out) and writes the sheets and `atlas.json` into `publicDir/kit`. */
export function writeAtlas(sprites: Record<string, { url: string; clip?: unknown }>, publicDir: string): { sheets: number; files: number; left: number } {
  const urls = [...new Set(Object.values(sprites).filter((s) => s.clip === undefined).map((s) => s.url))].sort();
  const pngs = new Map<string, PNG>();
  for (const url of urls) pngs.set(url, PNG.sync.read(readFileSync(join(publicDir, url))));
  const { rects, sheets, left } = packShelves(urls.map((id) => ({ id, w: pngs.get(id)!.width, h: pngs.get(id)!.height })));
  const out = sheets.map((s) => new PNG({ width: s.w, height: s.h }));
  for (const [url, r] of rects) PNG.bitblt(pngs.get(url)!, out[r.s]!, 0, 0, r.w, r.h, r.x, r.y);
  const file: AtlasFile = { format: 1, sheets: [], rects: Object.fromEntries([...rects].sort(([a], [b]) => (a < b ? -1 : 1))) };
  out.forEach((png, i) => {
    const name = `kit/atlas-${i}.png`;
    writeFileSync(join(publicDir, name), PNG.sync.write(png, { colorType: 6, deflateLevel: 9, deflateStrategy: 0, filterType: -1 }));
    file.sheets.push({ file: name, w: png.width, h: png.height });
  });
  writeFileSync(join(publicDir, 'kit', 'atlas.json'), JSON.stringify(file));
  return { sheets: out.length, files: rects.size, left: left.length };
}
