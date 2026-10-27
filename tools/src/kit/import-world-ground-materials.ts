// Reuse preserved ground sources, keeping whole 128px fields and reconciling only their borders.
// pnpm exec tsx tools/src/kit/import-world-ground-materials.ts
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { importTile } from './gen.js';
import { paletteWithRamps } from './palette.js';
import { reconcileStudyField, studyFieldEdgeMismatches } from './repeating-field.js';

const folder = fileURLToPath(new URL('../../../docs/design/frames/rich-world-ground-2026-10-27/', import.meta.url));
mkdirSync(folder, { recursive: true });
const ramps = ['stone', 'moss', 'wood'];
const palette = paletteWithRamps(ramps);
const reports = [];
for (const [name, original] of [['paving', 'city'], ['worn', 'ruins']]) {
  const source = `../rich-world-2026-10-25/${original}-source.png`;
  const bytes = readFileSync(`${folder}${source}`);
  const imported = importTile(bytes, 128, 128, palette);
  const field = PNG.sync.read(imported.png);
  const before = studyFieldEdgeMismatches(field);
  reconcileStudyField(field, palette);
  const after = studyFieldEdgeMismatches(field);
  if (after.horizontal || after.vertical) throw new Error(`Material border mismatch: ${name}`);
  const output = PNG.sync.write(field);
  writeFileSync(`${folder}${name}.png`, output);
  reports.push({ name, source, sourceSha256: createHash('sha256').update(bytes).digest('hex'), file: `${name}.png`, sha256: createHash('sha256').update(output).digest('hex'), ramps, field: [128, 128], sourceGrid: imported.logical, repeat: { borderBlendPixels: 8, before, after }, originalPrompt: `../rich-world-2026-10-25/prompts.json:jobs[name=${original}]` });
}
writeFileSync(`${folder}imports.json`, `${JSON.stringify({ method: 'Existing importTile and palette, followed by the established border-strip reconciliation; no motif painting or crop shuffling.', reports }, null, 2)}\n`);
console.log('Reused two ground fields; opposite-edge mismatches: 0.');
