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
 * A script that fails and then passes on its retry is written to <out-dir>/flakes.jsonl (one JSON line: group,
 * script, the first error, both durations, the commit, the time; a script that fails twice is marked `red`), so
 * CI can list "Passed only on retry" in the job summary and keep the records (tools/src/flakes.ts reads them).
 *
 * Runs with plain node too (`node game/e2e/run.ts --list`): it imports nothing but node itself.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const E2E_DIR = dirname(fileURLToPath(import.meta.url));

/** Every script, in the order `pnpm e2e` plays them. A new script goes here and into one group below. */
const ALL = ['opening', 'stealth', 'tending', 'hud', 'camera', 'play3d', 'map', 'shop', 'shop-stock', 'shop-interior', 'fishing', 'signin', 'load', 'tree', 'landscape', 'controls', 'sea', 'clips', 'jump', 'stones', 'effects', 'wildlife', 'pack', 'handskill'];

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
  // landscape plays the 2D game on a phone turned sideways, so it rides with the HUD's scripts, not the 3D door's
  'night-and-hud': { entries: ['stealth', 'tending', 'hud', 'tree', 'landscape', 'controls', 'sea', 'clips'].map(plain), minutes: 19 },
  // the only scripts that serve game/dist-3d: play3d, and load for its bag button
  '3d-and-load': { entries: ['play3d', 'load', 'camera'].map(plain), minutes: 14, build3d: true },
  // the jump and the fall on a phone on its side, the valley's animals that move away from the figure (#916), and the pack a fall leaves (#922): three short scripts
  'jump-phone': { entries: ['jump', 'wildlife', 'pack'].map(plain), minutes: 14 },
  // the loose stones on a phone on its side: lift, throw, bounce, pile, carry
  'stones-phone': { entries: ['stones', 'handskill'].map(plain), minutes: 20 },
  // the first effects on a phone on its side: a spark, a starburst, dust on a landing, the camp fire's loop
  'effects-phone': { entries: ['effects'].map(plain), minutes: 8 },
  'map-and-shop': { entries: ['map', 'shop', 'fishing'].map(plain), minutes: 10 },
  'shop-rooms-and-signin': { entries: ['shop-stock', 'shop-interior', 'signin'].map(plain), minutes: 10 },
};

/**
 * How much faster the game's clock runs while a script only waits on it (cdp.ts, WARP): the openings wait on digs,
 * fellings, cookings and dusk. E2E_WARP=1 in the shell turns it off, to debug a run at the game's own pace.
 */
const WARP: Record<string, number> = { opening: 4, sea: 4, jump: 4, pack: 4 };

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
function play(entry: Entry, out: string | undefined): PlayResult {
  const run = spawnSync('tsx', [join(E2E_DIR, `${entry.script}.ts`), ...(out ? [out] : [])], {
    // stdout goes straight to the log; stderr is also kept, to say what the first attempt failed on
    stdio: ['inherit', 'inherit', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, E2E_WARP: process.env.E2E_WARP ?? String(WARP[entry.script] ?? 1), ...entry.env },
  });
  const stderr = run.stderr ?? '';
  if (stderr) process.stderr.write(stderr);
  if (run.status === 0) return { ok: true };
  const text = stderr.trim() || run.error?.message || `exit ${run.status ?? run.signal}`;
  // an uncaught throw prints its source line first: the message is the first line that says Error, fail, timeout or expected
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return { ok: false, error: lines.find((l) => /error|fail|timeout|expect/i.test(l)) ?? lines[lines.length - 1] ?? text };
}

function summary(line: string): void {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

/** The ledger of a retry: one line per script that failed its first attempt. */
export interface FlakeRecord {
  group: string;
  script: string;
  /** `retry_pass` passed on the second attempt; `red` failed twice. */
  result: 'retry_pass' | 'red';
  /** The first 300 characters of what the first attempt said it failed on. */
  error: string;
  first_seconds: number;
  retry_seconds: number;
  commit: string;
  time: string;
}

/** What a play returns: whether it passed, and the end of what it said when it did not. */
export interface PlayResult {
  ok: boolean;
  error?: string;
}

export const FLAKES_FILE = 'flakes.jsonl';

/** Plays one entry; with retry, once more when it fails, and writes the ledger line of a failed first attempt. */
export function playEntry(
  group: string,
  entry: Entry,
  out: string | undefined,
  retry: boolean,
  playFn: (entry: Entry, dir: string | undefined) => PlayResult,
  now: () => number = Date.now,
): { result: string; seconds: number } {
  const t0 = now();
  const dir = retry && out ? join(out, entry.name) : out;
  const first = playFn(entry, dir);
  let result = first.ok ? 'passed' : '';
  if (!first.ok && retry && out && dir) {
    const t1 = now();
    console.log(`::warning::e2e ${entry.name} failed on attempt 1; it is played once more alone (its screenshots are kept)`);
    const kept = join(`${out}-attempt1`, entry.name);
    rmSync(kept, { recursive: true, force: true });
    mkdirSync(dirname(kept), { recursive: true });
    if (existsSync(dir)) renameSync(dir, kept);
    const second = playFn(entry, dir);
    result = second.ok ? 'passed on attempt 2 (a flake)' : '';
    const record: FlakeRecord = {
      group,
      script: entry.name,
      result: second.ok ? 'retry_pass' : 'red',
      error: (first.error ?? '').slice(0, 300),
      first_seconds: Math.round((t1 - t0) / 1000),
      retry_seconds: Math.round((now() - t1) / 1000),
      commit: process.env.GITHUB_SHA ?? '',
      time: new Date().toISOString(),
    };
    mkdirSync(out, { recursive: true });
    appendFileSync(join(out, FLAKES_FILE), `${JSON.stringify(record)}\n`);
  }
  return { result, seconds: Math.round((now() - t0) / 1000) };
}

/** Plays a group's entries; with retry, each in its own folder and once more when it fails. */
function playGroup(name: string, entries: Entry[], out: string | undefined, retry: boolean): boolean {
  const failed: string[] = [];
  summary(`### e2e: ${name}\n`);
  for (const entry of entries) {
    const { result, seconds } = playEntry(name, entry, out, retry, play);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
