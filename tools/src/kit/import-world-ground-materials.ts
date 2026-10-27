// Reuse preserved ground sources, keeping whole 128px fields and reconciling only their borders.
// pnpm exec tsx tools/src/kit/import-world-ground-materials.ts
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importTile } from './gen.js';
import { importSprite } from './import.js';
import { paletteWithRamps } from './palette.js';
import { reconcileStudyField, studyFieldEdgeMismatches } from './repeating-field.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-ground-2026-10-27/', import.meta.url));
mkdirSync(folder, { recursive: true });
const reports = [];
const entries = [
  { name: 'paving', source: '../rich-world-2026-10-25/city-source.png', ramps: ['stone', 'moss', 'wood'], originalPrompt: '../rich-world-2026-10-25/prompts.json:jobs[name=city]' },
  { name: 'worn', source: '../rich-world-2026-10-25/ruins-source.png', ramps: ['stone', 'moss', 'wood'], originalPrompt: '../rich-world-2026-10-25/prompts.json:jobs[name=ruins]' },
  { name: 'sand', source: 'sand-source.png', ramps: ['wood', 'stone'], originalPrompt: 'sand-source-manifest.jsonl:1' },
];
for (const { name, source, ramps, originalPrompt } of entries) {
  const palette = paletteWithRamps(ramps);
  const bytes = readFileSync(`${folder}${source}`);
  const imported = name === 'sand'
    ? importSprite(bytes, { width: 128, height: 128, padding: 0, anchor: 'center', outline: false, dither: true, palette })
    : importTile(bytes, 128, 128, palette);
  const field = PNG.sync.read(imported.png);
  for (let at = 3; at < field.data.length; at += 4) if (field.data[at] !== 255) throw new Error(`Ground fill must be opaque: ${name}`);
  const before = studyFieldEdgeMismatches(field);
  reconcileStudyField(field, palette);
  const after = studyFieldEdgeMismatches(field);
  if (after.horizontal || after.vertical) throw new Error(`Material border mismatch: ${name}`);
  const output = PNG.sync.write(field);
  writeFileSync(`${folder}${name}.png`, output);
  reports.push({ name, source, sourceSha256: createHash('sha256').update(bytes).digest('hex'), file: `${name}.png`, sha256: createHash('sha256').update(output).digest('hex'), ramps, field: [128, 128], sourceGrid: imported.logical, importer: name === 'sand' ? 'importSprite: existing ordered dither, no padding or outline' : 'importTile', repeat: { borderBlendPixels: 8, before, after }, originalPrompt });
}
writeFileSync(`${folder}imports.json`, `${JSON.stringify({ method: 'Existing importTile/importSprite and palette, followed by the established border-strip reconciliation; no motif painting or crop shuffling.', reports }, null, 2)}\n`);
console.log(`Reused ${entries.length} ground fields; opposite-edge mismatches: 0.`);
