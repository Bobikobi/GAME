/**
 * Runs the browser tests.
 *
 *   pnpm build && pnpm e2e [out-dir]               (every script, one after another; stops at the first failure)
 *   pnpm e2e:group <group> [out-dir] [--retry]     (one group, as a CI job plays it)
 *   pnpm e2e:group --list                          (the groups as JSON: CI's matrix is read from here)
 *
 * CI plays each group in its own job, side by side (.github/workflows/ci.yml), so the run takes as long as
 * its longest group, the phone opening, and not the sum. A group that serves the 3D door says so (build3d), and
 * only its job builds game/dist-3d. With --retry a script that fails is played once
 * more on its own, and the screenshots of its first attempt move to <out-dir>-attempt1/<entry>, so a flake
 * costs one script and stays countable; a script that fails twice fails the group, after the rest of it ran.
 *
 * Runs with plain node too (`node game/e2e/run.ts --list`): it imports nothing but node itself.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));

/** Every script, in the order `pnpm e2e` plays them. A new script goes here and into one group below. */
const ALL = ['opening', 'stealth', 'tending', 'hud', 'music', 'camera', 'play3d', 'map', 'shop', 'shop-stock', 'shop-interior', 'fishing', 'signin', 'load', 'tree'];

interface Entry {
  name: string;
  script: string;
  env?: Record<string, string>;
}

interface Group {
  entries: Entry[];
  /** The job's timeout: about three times its green time on a runner (30.10: a slow evening cancelled jobs at twice), which leaves room for one retry. */
  minutes: number;
  /** Whether a script of the group serves game/dist-3d (the 3D door): only then does CI build it for the job. */
  build3d?: boolean;
}

const plain = (script: string): Entry => ({ name: script, script });

// balanced by the times of run 41084544483 (30.10): the phone opening alone is 550 s, the desktop and slid-bank
// openings 150 s, and each of the other groups 120-200 s. A group is a job, and the jobs run side by side.
const GROUPS: Record<string, Group> = {
  'opening-phone': { entries: [{ name: 'opening-phone', script: 'opening', env: { E2E_ONLY: 'phone' } }], minutes: 30 },
  // every other opening run, so a run added to opening.ts is played here without a change to this file
  'opening-desktop': { entries: [{ name: 'opening-desktop', script: 'opening', env: { E2E_SKIP: 'phone' } }], minutes: 11 },
  'night-and-hud': { entries: ['stealth', 'tending', 'hud', 'tree', 'music'].map(plain), minutes: 12 },
  // the only scripts that serve game/dist-3d: play3d, and load for its bag button
  '3d-and-load': { entries: ['play3d', 'load', 'camera'].map(plain), minutes: 14, build3d: true },
  'map-and-shop': { entries: ['map', 'shop', 'fishing'].map(plain), minutes: 10 },
  'shop-rooms-and-signin': { entries: ['shop-stock', 'shop-interior', 'signin'].map(plain), minutes: 10 },
};

/**
 * How much faster the game's clock runs while a script only waits on it (cdp.ts, WARP): the openings wait on digs,
 * fellings, cookings and dusk. E2E_WARP=1 in the shell turns it off, to debug a run at the game's own pace.
 */
const WARP: Record<string, number> = { opening: 4 };

/** Throws when a script is in no group or a plain script is in two: CI would skip it or play it twice. */
function checkGroups(): void {
  const plays = Object.values(GROUPS).flatMap((g) => g.entries.filter((e) => e.script !== 'opening').map((e) => e.script));
  const twice = plays.filter((s, i) => plays.indexOf(s) !== i);
  const missing = ALL.filter((s) => s !== 'opening' && !plays.includes(s));
  const unknown = plays.filter((s) => !ALL.includes(s));
  if (twice.length + missing.length + unknown.length > 0) {
    throw new Error(`e2e groups: in two groups [${twice.join(', ')}], in none [${missing.join(', ')}], not in ALL [${unknown.join(', ')}]`);
  }
}

/** Plays one script; without an out-dir it writes where the script itself chooses (.scratch/e2e mostly). */
function play(entry: Entry, out: string | undefined): boolean {
  const run = spawnSync('tsx', [join(E2E_DIR, `${entry.script}.ts`), ...(out ? [out] : [])], {
    stdio: 'inherit',
    env: { ...process.env, E2E_WARP: process.env.E2E_WARP ?? String(WARP[entry.script] ?? 1), ...entry.env },
  });
  return run.status === 0;
}

function summary(line: string): void {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

/** Plays a group's entries; with retry, each in its own folder and once more when it fails. */
function playGroup(name: string, entries: Entry[], out: string | undefined, retry: boolean): boolean {
  const failed: string[] = [];
  summary(`### e2e: ${name}\n`);
  for (const entry of entries) {
    const t0 = Date.now();
    const dir = retry && out ? join(out, entry.name) : out;
    let result = play(entry, dir) ? 'passed' : '';
    if (!result && retry && out && dir) {
      console.log(`::warning::e2e ${entry.name} failed on attempt 1; it is played once more alone (its screenshots are kept)`);
      const kept = join(`${out}-attempt1`, entry.name);
      rmSync(kept, { recursive: true, force: true });
      mkdirSync(dirname(kept), { recursive: true });
      if (existsSync(dir)) renameSync(dir, kept);
      result = play(entry, dir) ? 'passed on attempt 2 (a flake)' : '';
    }
    const seconds = Math.round((Date.now() - t0) / 1000);
    summary(`- ${entry.name}: ${result || 'failed'} in ${seconds} s`);
    console.log(`e2e ${entry.name}: ${result || 'failed'} in ${seconds} s`);
    if (!result) {
      failed.push(entry.name);
      if (!retry) break;
    }
  }
  if (failed.length > 0) console.error(`e2e ${name}: failed: ${failed.join(', ')}`);
  return failed.length === 0;
}

function main(): void {
  checkGroups();
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    console.log(JSON.stringify(Object.entries(GROUPS).map(([group, g]) => ({ group, minutes: g.minutes, build3d: g.build3d === true }))));
    return;
  }
  const retry = args.includes('--retry');
  const [name, outArg] = args.filter((a) => !a.startsWith('--'));
  // a retry needs a folder of its own per script, to move aside when it fails
  const out = outArg ? resolve(outArg) : retry ? join(E2E_DIR, '..', '..', '.scratch', 'e2e') : undefined;
  const group = name ? GROUPS[name] : undefined;
  let ok: boolean;
  if (name === 'all') {
    ok = playGroup('all', ALL.map(plain), out, retry);
  } else if (name && group) {
    ok = playGroup(name, group.entries, out, retry);
  } else {
    throw new Error(`usage: run.ts <all|${Object.keys(GROUPS).join('|')}> [out-dir] [--retry] | --list`);
  }
  process.exit(ok ? 0 : 1);
}

main();
