/** Import the retained footprint drawing; no organic shape is painted in code. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importSprite } from './import.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-footprints-2026-10-29/', import.meta.url));
const source = readFileSync(folder + 'footprint-source.png');
const palette = ['#9e6b3c'];
const imported = importSprite(source, { width: 8, height: 12, padding: 0, anchor: 'center', outline: false, palette });
const png = PNG.sync.read(imported.png);
let solidPixels = 0;
for (let at = 0; at < png.data.length; at += 4) {
  const alpha = png.data[at + 3];
  if (alpha !== 0 && alpha !== 255) throw Error('Footprint alpha must be binary');
  if (!alpha) continue;
  if (png.data[at] !== 0x9e || png.data[at + 1] !== 0x6b || png.data[at + 2] !== 0x3c) throw Error('Footprint left its sand ramp');
  solidPixels++;
}
if (!solidPixels) throw Error('The imported footprint is empty');
writeFileSync(folder + 'footprint.png', imported.png);
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
writeFileSync(folder + 'import.json', JSON.stringify({ source: 'footprint-source.png', sourceSha256: hash(source), file: 'footprint.png', sha256: hash(imported.png), importer: 'Existing importSprite; no outline, padding or dithering', palette, dimensions: [png.width, png.height], sourceGrid: imported.logical, solidPixels, binaryAlpha: true }, null, 2) + '\n');
console.log(`Imported8x12 footprint: ${solidPixels} opaque pixels, one sand colour and binary alpha.`);
