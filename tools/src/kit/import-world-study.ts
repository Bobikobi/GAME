// Reproduce the material study imports; no artwork is drawn by this script.
// Run: pnpm exec tsx tools/src/kit/import-world-study.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importTile } from './gen.js';
import { importSprite } from './import.js';
import { paletteWithRamps } from './palette.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-2026-10-25/', import.meta.url));
const materials: Record<string, string[]> = {
  water: ['water', 'teal'], forest: ['moss', 'green', 'wood'],
  city: ['stone', 'moss', 'wood'], ruins: ['stone', 'moss', 'wood'],
};
const report = [];
for (const [name, ramps] of Object.entries(materials)) {
  const palette = paletteWithRamps(ramps);
  const source = name === 'water' ? 'water-quiet-source.png' : `${name}-source.png`;
  const result = importTile(readFileSync(`${folder}${source}`), 128, 128, palette);
  writeFileSync(`${folder}${name}.png`, result.png);
  const field = PNG.sync.read(result.png);
  for (let index = 0; index < 4; index += 1) {
    const tile = new PNG({ width: 64, height: 64 });
    PNG.bitblt(field, tile, (index % 2) * 64, Math.floor(index / 2) * 64, 64, 64, 0, 0);
    writeFileSync(`${folder}${name}-${index}.png`, PNG.sync.write(tile));
  }
  report.push({ name, ramps, colors: result.colors, sourceGrid: result.logical, field: [128, 128], tile: [64, 64], variants: 4, density: 4, status: 'study: edge compatibility and runtime use not approved' });
}
writeFileSync(`${folder}imports.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
const foam = importSprite(readFileSync(`${folder}foam-source.png`), {
  width: 64, height: 32, anchor: 'center', padding: 6, outline: false,
  palette: paletteWithRamps(['water', 'teal']),
});
writeFileSync(`${folder}foam.png`, foam.png);
