// Reuse preserved ground sources, keeping whole 128px fields and reconciling only their borders.
// pnpm exec tsx tools/src/kit/import-world-ground-materials.ts
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importTile } from './gen.js';
import { coreRamp, paletteWithRamps } from './palette.js';
import { reconcileStudyField, studyFieldEdgeMismatches } from './repeating-field.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-ground-2026-10-27/', import.meta.url));
const currentFolder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-motion-2026-10-29/', import.meta.url));
mkdirSync(currentFolder, { recursive: true });
const reports = [];
const entries = [
  { name: 'paving', source: '../rich-world-2026-10-25/city-source.png', ramps: ['stone', 'moss', 'wood'], originalPrompt: '../rich-world-2026-10-25/prompts.json:jobs[name=city]' },
  { name: 'worn', source: '../rich-world-2026-10-25/ruins-source.png', ramps: ['stone', 'moss', 'wood'], originalPrompt: '../rich-world-2026-10-25/prompts.json:jobs[name=ruins]' },
  { name: 'sand', source: '../rich-world-motion-2026-10-29/sand-source.png', ramps: ['wood', 'stone'], originalPrompt: 'sand-prompt.txt' },
];
for (const { name, source, ramps, originalPrompt } of entries) {
  // Keep warm crest pixels on the earth ramp instead of snapping them to the core skin ramp.
  const palette = name === 'sand'
    ? [...new Set([...coreRamp('wood')!.steps, ...coreRamp('stone')!.steps, '#5d6177', '#8f94a8', '#c6cad6', '#f5f4ef'])]
    : paletteWithRamps(ramps);
  const bytes = readFileSync(`${folder}${source}`);
  // The new sand source fills its square; use the fill importer rather than sprite background removal.
  const imported = importTile(bytes, 128, 128, palette);
  const field = PNG.sync.read(imported.png);
  for (let at = 3; at < field.data.length; at += 4) if (field.data[at] !== 255) throw new Error(`Ground fill must be opaque: ${name}`);
  const before = studyFieldEdgeMismatches(field);
  reconcileStudyField(field, palette);
  const after = studyFieldEdgeMismatches(field);
  if (after.horizontal || after.vertical) throw new Error(`Material border mismatch: ${name}`);
  const output = PNG.sync.write(field);
  const destination = name === 'sand' ? currentFolder : folder;
  const outputFile = `${name}.png`;
  writeFileSync(`${destination}${outputFile}`, output);
  reports.push({ name, source: relative(currentFolder, `${folder}${source}`), sourceSha256: createHash('sha256').update(bytes).digest('hex'), file: relative(currentFolder, `${destination}${outputFile}`), sha256: createHash('sha256').update(output).digest('hex'), ramps, palette, field: [128, 128], sourceGrid: imported.logical, importer: 'importTile', repeat: { borderBlendPixels: 8, before, after }, originalPrompt });
}
writeFileSync(`${currentFolder}imports.json`, `${JSON.stringify({ method: 'Existing importTile and palette, followed by the established border-strip reconciliation; no motif painting or crop shuffling. Previous sand sources, imports and reports remain unchanged.', reports }, null, 2)}\n`);
console.log(`Reused ${entries.length} ground fields; opposite-edge mismatches: 0.`);
