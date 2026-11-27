/**
 * `pnpm art:held`: the table of #874 (clip, frame, the held object's size as a share of its size in the world) for every clip of the core kit
 * that draws an object in the hands, and the rule's verdict (tools/src/kit/held.ts). Read-only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR } from '../load';
import { heldProblems, heldRows } from '../kit/held';

const dir = join(CONTENT_DIR, 'kit', 'core');
const kit = JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8')) as { kit: { sprites: Parameters<typeof heldRows>[1] } };
const rows = heldRows(dir, kit.kit.sprites);
const lines = ['clip | frame | ratio'];
for (const r of rows) lines.push(`${r.clip} | ${r.frame} | ${r.ratio === undefined ? 'no stone found' : r.ratio.toFixed(2)}`);
console.log(lines.join('\n'));
const problems = heldProblems(rows);
console.log(`\n${rows.length} frames in ${new Set(rows.map((r) => r.clip)).size} clips; ${problems.length} clips out of the rule`);
for (const p of problems) console.log(`${p.clip}: ${p.message}`);
