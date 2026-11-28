/**
 * pnpm valley:inventory [--print] [--painted-base]
 *
 * Writes docs/design/VALLEY_INVENTORY.md and VALLEY_INVENTORY.json from the content and the kit, and prints the summary line.
 * With `--print` it writes nothing and prints the summary and the counts by kind. With `--painted-base` it counts what a player meets when
 * the map lies under a painted land in base mode (no ground tiles, edges or crowns). Never fails on a state: it counts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runCheck } from './check';
import { REPO_ROOT } from './load';
import { buildInventory, JSON_PATH, MD_PATH, renderJson, renderMarkdown, summaryLine } from './valley-inventory';

const result = runCheck();
if (!result.assembled.bundle) {
  console.error('The content does not assemble; run "pnpm check" first.');
  process.exit(1);
}
const inv = buildInventory(result.assembled, { paintedBase: process.argv.includes('--painted-base') });
if (process.argv.includes('--print')) {
  console.log(summaryLine(inv));
  for (const [kind, k] of Object.entries(inv.byKind).sort()) console.log(`  ${kind}: ${Object.entries(k).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${s}`).join(', ')}`);
} else {
  for (const [file, text] of [[MD_PATH, renderMarkdown(inv)], [JSON_PATH, renderJson(inv)]] as const) {
    const abs = join(REPO_ROOT, file);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    console.log(`wrote ${file}`);
  }
  console.log(summaryLine(inv));
}
