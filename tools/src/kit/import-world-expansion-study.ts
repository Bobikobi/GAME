// Import generated artwork for the connected visual study; never draw organic terrain.
// pnpm exec tsx tools/src/kit/import-world-expansion-study.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importTile } from './gen.js';
import { importSprite, paletteColourAt } from './import.js';
import { hexToRgb, paletteWithRamps } from './palette.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-expansion-2026-10-26/', import.meta.url));
const ramps = ['green', 'moss', 'wood'];
const palette = paletteWithRamps(ramps);
const rgb = palette.map(hexToRgb);
const fields = ['meadow-a', 'meadow-b', 'meadow-c', 'path', 'woodland'];
const edgeWidth = 8;

for (const name of [...fields, 'oak']) {
  if (!existsSync(`${folder}${name}-source.png`)) throw new Error(`Missing generated source: ${folder}${name}-source.png`);
}

/** Blend only matching opposite border strips. The registered central 2×2 field stays in place. */
function reconcileEdges(image: PNG): void {
  for (const horizontal of [true, false]) {
    const source = Buffer.from(image.data);
    const span = horizontal ? image.width : image.height;
    const across = horizontal ? image.height : image.width;
    for (let row = 0; row < across; row += 1) for (let d = 0; d < edgeWidth; d += 1) {
      const a = horizontal ? (row * image.width + d) * 4 : (d * image.width + row) * 4;
      const b = horizontal ? (row * image.width + span - 1 - d) * 4 : ((span - 1 - d) * image.width + row) * 4;
      const blend = (1 - d / edgeWidth) * .5;
      for (const [out, other] of [[a, b], [b, a]]) {
        const channels = [0, 1, 2].map(c => Math.round(source[out! + c]! * (1 - blend) + source[other! + c]! * blend));
        // No ordered dithering here: equal border colours must snap identically on both sides.
        const color = paletteColourAt(channels[0]!, channels[1]!, channels[2]!, 0, 0, rgb, false);
        if (!color) throw new Error('Empty study palette');
        image.data.set([...color, 255], out!);
      }
    }
  }
}

function edgeMismatches(image: PNG): { horizontal: number; vertical: number } {
  const same = (a: number, b: number) => [0, 1, 2, 3].every(c => image.data[a + c] === image.data[b + c]);
  let horizontal = 0, vertical = 0;
  for (let y = 0; y < image.height; y += 1) {
    if (!same(y * image.width * 4, (y * image.width + image.width - 1) * 4)) horizontal += 1;
  }
  for (let x = 0; x < image.width; x += 1) {
    if (!same(x * 4, ((image.height - 1) * image.width + x) * 4)) vertical += 1;
  }
  return { horizontal, vertical };
}

function colorCount(image: PNG): number {
  const colors = new Set<number>();
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3]! >= 128) colors.add((image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!);
  }
  return colors.size;
}

/** The common importer only shrinks. Fit its palette-snapped visible sprite into this larger frame. */
function fitRootedSprite(image: PNG, width: number, height: number, padding: number): PNG {
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    if (image.data[(y * image.width + x) * 4 + 3]! < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error('Imported tree has no visible pixels');
  const sourceWidth = right - left + 1, sourceHeight = bottom - top + 1;
  const scale = Math.min((width - padding * 2) / sourceWidth, (height - padding * 2) / sourceHeight);
  const drawWidth = Math.round(sourceWidth * scale), drawHeight = Math.round(sourceHeight * scale);
  const offsetX = Math.floor((width - drawWidth) / 2), offsetY = height - padding - drawHeight;
  const result = new PNG({ width, height });
  for (let y = 0; y < drawHeight; y += 1) for (let x = 0; x < drawWidth; x += 1) {
    const sx = left + Math.min(sourceWidth - 1, Math.floor((x + .5) * sourceWidth / drawWidth));
    const sy = top + Math.min(sourceHeight - 1, Math.floor((y + .5) * sourceHeight / drawHeight));
    const from = (sy * image.width + sx) * 4, to = ((offsetY + y) * width + offsetX + x) * 4;
    result.data.set(image.data.subarray(from, from + 4), to);
  }
  return result;
}

const reports: object[] = [];
for (const name of fields) {
  const imported = importTile(readFileSync(`${folder}${name}-source.png`), 128, 128, palette);
  const image = PNG.sync.read(imported.png);
  const before = edgeMismatches(image);
  reconcileEdges(image);
  const after = edgeMismatches(image);
  if (after.horizontal || after.vertical) throw new Error(`Opposite borders still mismatch: ${name}`);
  writeFileSync(`${folder}${name}.png`, PNG.sync.write(image));
  reports.push({
    name, source: `${name}-source.png`, file: `${name}.png`, ramps,
    field: [128, 128], tile: [64, 64], sourceGrid: imported.logical,
    colors: colorCount(image),
    registration: 'Original 128×128 field retained; four 64×64 quadrants are never shuffled.',
    repeat: { borderBlendPixels: edgeWidth, edgePairsBefore: before, edgePairsAfter: after },
  });
}

// The shared importer infers a key colour even on alpha images. Keep already-transparent
// pixels invisible, but give their RGB a distinct key so dark foliage is not mistaken for it.
const oakInput = PNG.sync.read(readFileSync(`${folder}oak-source.png`));
for (let i = 0; i < oakInput.data.length; i += 4) {
  if (oakInput.data[i + 3]! < 128) oakInput.data.set([255, 0, 255], i);
}
const oak = importSprite(PNG.sync.write(oakInput), {
  width: 192, height: 320, anchor: 'bottom', padding: 2,
  palette, outline: false, dither: true,
});
const rootedOak = fitRootedSprite(PNG.sync.read(oak.png), 192, 320, 2);
writeFileSync(`${folder}oak.png`, PNG.sync.write(rootedOak));
reports.push({
  name: 'oak', source: 'oak-source.png', file: 'oak.png', ramps,
  frame: [192, 320], anchor: 'bottom', padding: 2,
  outline: false, dither: true, sourceGrid: oak.logical, colors: oak.colors,
  alphaPreparation: 'Only RGB of already-transparent source pixels keyed to magenta; visible source pixels and alpha retained.',
  normalization: 'Visible imported alpha bounds fitted within188×316 by nearest sampling, aspect ratio retained; root centred with2px bottom padding.',
  status: 'Separate transparent rooted tree; no ground or shadow painted during import.',
});

writeFileSync(`${folder}imports.json`, `${JSON.stringify({
  density: 4,
  method: 'Existing importTile/importSprite, shared palette snap; source-image border reconciliation only.',
  reports,
  review: 'Exact opposite-edge equality is verified by the importer; material richness, internal motifs and in-engine transitions still require visual review.',
}, null, 2)}\n`);
console.log(`Imported ${fields.length} repeating 128×128 ground fields and one 192×320 oak; opposite-edge mismatches: 0.`);
