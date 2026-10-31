/**
 * `pnpm exec tsx tools/src/balance/hunt-ladder-cli.ts [--write] [--json]`: the hunt ladder's matrices (HUNTING 5, 8
 * and 9; HUNT_FAMILIES 3a). It prints the page as markdown; `--write` writes it to docs/design/HUNT_LADDER.md and the
 * proposed experience table to tools/src/balance/xp-proposed.json; `--json` prints the computed rows. The package.json
 * script waits for the pull request that wires the ladder to content.
 */
import { writeFileSync } from 'node:fs';
import { MARKDOWN_FILE, XP_FILE, ladderOutputs } from './hunt-ladder';
import { loadWorld } from './world';

const { bundle, rules } = loadWorld();
const { report, markdown, xpJson } = ladderOutputs(bundle, rules);
if (process.argv.includes('--write')) {
  writeFileSync(MARKDOWN_FILE, markdown);
  writeFileSync(XP_FILE, xpJson);
  console.log(`Wrote ${MARKDOWN_FILE} and ${XP_FILE}.`);
} else if (process.argv.includes('--json')) {
  const { ladder: _ladder, params, ...rest } = report;
  const { solver: _solver, ...hunt } = params;
  console.log(JSON.stringify({ params: hunt, ...rest }, null, 2));
} else {
  process.stdout.write(markdown);
}
