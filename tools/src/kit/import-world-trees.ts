// Reimport a preserved tree draft for the existing connected world study; no art is drawn.
// Run: pnpm exec tsx tools/src/kit/import-world-trees.ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importSprite } from './import.js';
import { paletteWithRamps } from './palette.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-trees-2026-10-26/', import.meta.url));
const sourceName = 'oak-broad-source.png';
const outputName = 'oak-broad.png';
const source = readFileSync(`${folder}${sourceName}`);
const sourceSha256 = createHash('sha256').update(source).digest('hex');
const expectedSource = '8318a0aeffc8bcf958f874691e1c7c55b7b0523985b7f006a162d6264490dbe1';
if (sourceSha256 !== expectedSource) throw new Error('Preserved broad oak source differs from its recorded draft');
const ramps = ['green', 'moss', 'wood'];
const width = 320, height = 320, padding = 2;
const imported = importSprite(source, {
  width, height, padding, anchor: 'bottom', outline: false, dither: true,
  palette: paletteWithRamps(ramps),
});

// The shared importer only shrinks. As in import-world-expansion-study, fit its
// visible bounds with nearest sampling, keeping the draft's aspect and root.
const image = PNG.sync.read(imported.png);
let left = image.width, top = image.height, right = -1, bottom = -1;
for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
  if (image.data[(y * image.width + x) * 4 + 3]! < 128) continue;
  left = Math.min(left, x); right = Math.max(right, x);
  top = Math.min(top, y); bottom = Math.max(bottom, y);
}
if (right < left || bottom < top) throw new Error('Imported broad oak has no visible pixels');
const sourceWidth = right - left + 1, sourceHeight = bottom - top + 1;
const scale = Math.min((width - padding * 2) / sourceWidth, (height - padding * 2) / sourceHeight);
const drawWidth = Math.round(sourceWidth * scale), drawHeight = Math.round(sourceHeight * scale);
const offsetX = Math.floor((width - drawWidth) / 2), offsetY = height - padding - drawHeight;
const rooted = new PNG({ width, height });
for (let y = 0; y < drawHeight; y += 1) for (let x = 0; x < drawWidth; x += 1) {
  const sx = left + Math.min(sourceWidth - 1, Math.floor((x + .5) * sourceWidth / drawWidth));
  const sy = top + Math.min(sourceHeight - 1, Math.floor((y + .5) * sourceHeight / drawHeight));
  const from = (sy * image.width + sx) * 4, to = ((offsetY + y) * width + offsetX + x) * 4;
  rooted.data.set(image.data.subarray(from, from + 4), to);
}
const output = PNG.sync.write(rooted);
writeFileSync(`${folder}${outputName}`, output);
const report = {
  density: 4,
  method: 'Existing importSprite and paletteWithRamps; visible bounds fitted by nearest sampling, with aspect preserved.',
  reports: [{
    name: 'oak-broad', source: sourceName, sourceSha256,
    file: outputName, sha256: createHash('sha256').update(output).digest('hex'),
    ramps, frame: [width, height], anchor: 'bottom', padding,
    outline: false, dither: true, sourceGrid: imported.logical, colors: imported.colors,
    visibleBounds: { x: offsetX, y: offsetY, width: drawWidth, height: drawHeight },
    normalization: 'Uniform nearest fit of visible imported pixels within 316×316; bottom-centred with 2px root padding.',
    status: 'Reused draft for the visual study only; owner visual approval pending.',
  }],
};
writeFileSync(`${folder}imports.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
