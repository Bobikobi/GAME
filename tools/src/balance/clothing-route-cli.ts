/**
 * `pnpm exec tsx tools/src/balance/clothing-route-cli.ts [--seeds 1,2,3] [--found]`: the clothing route played on the kernel
 * (docs/design/CLOTHING_BALANCE.md, Loomvale's row). It prints, per world seed, the minutes from the end of the opening
 * to the first worn piece, the tier-1 kit and the first set, and where the time went; `--found` digs the tier-2
 * recipes' scraps at the gate rubble, as CLOTHING's appendix designs, in place of knowing them from the start. It writes nothing; it exits 1
 * when a run stopped.
 */
import { formatRoute, playRoute } from './clothing-route';
import { loadWorld } from './world';

const argv = process.argv.slice(2);
const at = argv.indexOf('--seeds');
const seeds = at >= 0 ? argv[at + 1]!.split(',').map(Number) : [1, 2, 3, 4, 5];
const { bundle } = loadWorld();
const runs = [];
const teach = argv.includes('--found') ? 'found' : 'start';
for (const seed of seeds) runs.push(await playRoute(bundle, seed, teach));
console.log(formatRoute(runs));
if (runs.some((r) => r.failed)) process.exitCode = 1;
