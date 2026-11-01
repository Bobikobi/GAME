/**
 * `pnpm map:playtest [--json] [--seed <n>]`: the balance playtest (NEXT 19 b). The simulated
 * player plays its session on the kernel from each start it knows, with the world seed given (1
 * when none), and the places it reaches are printed against the difficulty reckoning, as a table
 * or as JSON. It writes nothing; it exits 1 when a run did not finish.
 */
import { formatPlaytest, playtest } from './playtest';
import { reckon } from './reckon';
import { loadWorld } from './world';

const argv = process.argv.slice(2);
const seedAt = argv.indexOf('--seed');
const seed = seedAt >= 0 ? Number(argv[seedAt + 1]) : undefined;
if (seed !== undefined && !Number.isSafeInteger(seed)) {
  console.error('--seed takes a whole number.');
  process.exit(2);
}

const { bundle, rules } = loadWorld();
const rows = reckon(bundle, rules);
const runs = await playtest(bundle, rules, rows, { seed });
if (argv.includes('--json')) console.log(JSON.stringify(runs, null, 2));
else console.log(formatPlaytest(runs, bundle, rules));
if (runs.some((run) => run.failed)) process.exitCode = 1;
