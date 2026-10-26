/**
 * `pnpm map:difficulty [--json]`: the difficulty reckoning of every place on
 * the map (NEXT 19 b). It prints a table, or the rows as JSON, and writes
 * nothing.
 */
import { formatReckoning, reckon } from './reckon';
import { loadWorld } from './world';

const { bundle, rules } = loadWorld();
const rows = reckon(bundle, rules);
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else console.log(formatReckoning(rows, rules));
