// Crop and palette-import generated art only; no artwork is synthesized here.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importTile } from './gen.js';
import { paletteWithRamps } from './palette.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-layered-water-2026-10-25/', import.meta.url));
const source = PNG.sync.read(readFileSync(`${folder}source.png`));
const half = Math.floor(source.width / 2);
const report = ['bed', 'body', 'light', 'foam'].map((name, i) => {
  const crop = new PNG({ width: half, height: half });
  PNG.bitblt(source, crop, i % 2 * half, Math.floor(i / 2) * half, half, half, 0, 0);
  const result = importTile(PNG.sync.write(crop), 128, 128, paletteWithRamps(['water', 'teal', 'stone']));
  writeFileSync(`${folder}${name}.png`, result.png);
  return { name, colors: result.colors, size: [128, 128], source: 'source.png', quadrant: i };
});
writeFileSync(`${folder}imports.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(report);
