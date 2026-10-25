// Import generated artwork, register sheets and cut cells; never paint terrain pixels.
// pnpm exec tsx tools/src/kit/import-river-study.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importSprite, paletteColourAt } from './import.js';
import { importTile } from './gen.js';
import { hexToRgb, paletteWithRamps } from './palette.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-river-kit-2026-10-25/', import.meta.url));
const banks = ['green', 'moss', 'wood', 'stone'];
const reports: object[] = [];
const tiles = new Map<number, PNG>();
// Marching-squares bits clockwise: NW=1, NE=2, SE=4, SW=8. Diagonal-only cases wait.
const outerMasks = [4, 12, 8, 6, 15, 9, 2, 3, 1];
const innerMasks = [14, 13, 7, 11];
// Keep the source sheet's empty upper half: trimming it would destroy the shoreline anchor.
const variantsSource = PNG.sync.read(readFileSync(`${folder}bank-variants-source.png`));
const variants = new PNG({ width: 192, height: 64 });
const palette = paletteWithRamps(banks).map(hexToRgb);
for (let y = 0; y < 64; y += 1) for (let x = 0; x < 192; x += 1) {
  const sx = Math.min(variantsSource.width - 1, Math.floor((x + 0.5) * variantsSource.width / 192));
  const sy = Math.min(variantsSource.height - 1, Math.floor((y + 0.5) * variantsSource.height / 64));
  const input = (sy * variantsSource.width + sx) * 4;
  if ((variantsSource.data[input + 3] ?? 0) < 128) continue;
  const color = paletteColourAt(variantsSource.data[input]!, variantsSource.data[input + 1]!, variantsSource.data[input + 2]!, x, y, palette, false);
  if (!color) throw new Error('Empty bank palette');
  const out = (y * 192 + x) * 4;
  variants.data.set([...color, 255], out);
}
writeFileSync(`${folder}bank-variants.png`, PNG.sync.write(variants));
for (let index = 0; index < 3; index += 1) {
  const tile = new PNG({ width: 64, height: 64 });
  PNG.bitblt(variants, tile, index * 64, 0, 64, 64, 0, 0);
  writeFileSync(`${folder}bank-n-variant-${index}.png`, PNG.sync.write(tile));
}
reports.push({ name: 'bank-variants', cells: 3, ramps: banks, registration: 'nearest sample of full192x64 canvas; hard alpha and palette snap; no trimming', status: 'alternatives need endpoint review before substitution' });
for (const name of ['bank-outer', 'bank-inner']) {
  const imported = importSprite(readFileSync(`${folder}${name}-quiet-source.png`), {
    width: 128, height: 128, anchor: 'center', padding: 0,
    palette: paletteWithRamps(banks), outline: false, dither: true,
  });
  const art = PNG.sync.read(imported.png);
  const outer = name === 'bank-outer';
  const sheet = new PNG({ width: outer ? 192 : 128, height: outer ? 192 : 128 });
  PNG.bitblt(art, sheet, 0, 0, 128, 128, outer ? 32 : 0, outer ? 32 : 0);
  writeFileSync(`${folder}${name}.png`, PNG.sync.write(sheet));
  const masks = outer ? outerMasks : innerMasks;
  const across = outer ? 3 : 2;
  masks.forEach((mask, index) => {
    const tile = new PNG({ width: 64, height: 64 });
    PNG.bitblt(sheet, tile, (index % across) * 64, Math.floor(index / across) * 64, 64, 64, 0, 0);
    tiles.set(mask, tile);
    writeFileSync(`${folder}bank-${mask}.png`, PNG.sync.write(tile));
  });
  reports.push({ name, colors: imported.colors, ramps: banks, sourceGrid: imported.logical, cells: masks.length, registration: outer ? 'fit alpha artwork to128 square; pad32 on all sides; cut3x3' : 'fit128 square; cut2x2', status: 'candidate: seams need visual review' });
}
for (const [name, ramps] of [['riverbed', ['wood', 'stone', 'teal', 'moss']], ['depth-transition', ['water', 'teal', 'wood', 'stone']]] as const) {
  const imported = importTile(readFileSync(`${folder}${name}-source.png`), 128, 128, paletteWithRamps(ramps));
  writeFileSync(`${folder}${name}.png`, imported.png);
  reports.push({ name, colors: imported.colors, ramps, sourceGrid: imported.logical, status: 'candidate: repeat seams need visual review' });
}
const fixtures = {
  island: ['0000000', '0111110', '0111110', '0111110', '0111110', '0111110', '0000000'],
  inlet: ['0000000', '0111110', '0111110', '0111000', '0111000', '0111110', '0000000'],
};
const seams: { name: string; vertices: string[]; grid: number[][]; alphaBoundaryMismatches: number; productionReady: boolean }[] = [];
for (const [name, vertices] of Object.entries(fixtures)) {
  const width = vertices[0]!.length - 1;
  const height = vertices.length - 1;
  const output = new PNG({ width: width * 64, height: height * 64 });
  const grid: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const mask = Number(vertices[y]![x]) + Number(vertices[y]![x + 1]) * 2 + Number(vertices[y + 1]![x + 1]) * 4 + Number(vertices[y + 1]![x]) * 8;
      row.push(mask);
      if (mask === 0) continue;
      const tile = tiles.get(mask);
      if (!tile) throw new Error(`Unsupported diagonal topology ${mask} at ${name}:${x},${y}`);
      PNG.bitblt(tile, output, 0, 0, 64, 64, x * 64, y * 64);
    }
    grid.push(row);
  }
  // Alpha continuity reports catch geometric holes; colour seams still require the eye.
  const alpha = (mask: number, x: number, y: number) => (tiles.get(mask)?.data[(y * 64 + x) * 4 + 3] ?? 0) >= 128;
  let mismatchedPixels = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const mask = grid[y]![x]!;
    for (let p = 0; p < 64; p += 1) {
      if (x + 1 < width && alpha(mask, 63, p) !== alpha(grid[y]![x + 1]!, 0, p)) mismatchedPixels += 1;
      if (y + 1 < height && alpha(mask, p, 63) !== alpha(grid[y + 1]![x]!, p, 0)) mismatchedPixels += 1;
    }
  }
  writeFileSync(`${folder}${name}-assembly.png`, PNG.sync.write(output));
  seams.push({ name, vertices, grid, alphaBoundaryMismatches: mismatchedPixels, productionReady: false });
}
writeFileSync(`${folder}imports.json`, `${JSON.stringify({ reports, seams, supportedMasks: [...tiles.keys()], unsupportedMasks: [5, 10], density: 4 }, null, 2)}\n`);
console.log(JSON.stringify(seams.map(({ name, alphaBoundaryMismatches }) => ({ name, alphaBoundaryMismatches }))));
