/**
 * pnpm tree:coverage: the tree's thin spots (docs/design/PROGRESSION.md 4.9),
 * the first thing the quest designer reads. Read-only; it informs and never
 * fails. Flags: --json; --proposals <path> (a design page whose tables propose
 * schools and nodes; default docs/design/PROGRESSION.md when it exists).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { assemble } from '../assemble';
import { loadAll } from '../load';
import { coverage, formatCoverage } from './coverage';
import { builtSchools, contentTouches, proposedSchools, readEffects } from './sources';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2);
const json = args.includes('--json');
const p = args.indexOf('--proposals');
const proposals = p >= 0 ? args[p + 1] : join(ROOT, 'docs/design/PROGRESSION.md');

const { files } = loadAll();
const b = assemble(files).bundle;
if (!b) {
  console.error('The content does not assemble; run "pnpm check" first.');
  process.exit(1);
}

const builtEffects = Object.values(b.schools).flatMap((s) => s.nodes.map((n) => n.effect));
const read = readEffects([join(ROOT, 'kernel/src'), join(ROOT, 'game/src')], [...new Set(builtEffects)].sort());
const built = builtSchools(b, read);
const md = proposals !== undefined && existsSync(proposals) ? readFileSync(proposals, 'utf8') : '';
const proposed = proposedSchools(md, new Set(built.map((s) => s.name)));
const report = coverage([...built, ...proposed], contentTouches(b));

if (json) console.log(JSON.stringify(report, null, 2));
else {
  if (md === '') console.log('No proposals page found: the built schools only.\n');
  console.log(formatCoverage(report));
}
