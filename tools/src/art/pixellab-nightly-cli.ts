/**
 * pnpm art:nightly [--dry-run] [--out DIR] [--state DIR] [--max-per-account N] [--no-push] [--date YYYY-MM-DD]
 *
 * The nightly PixelLab job (docs/art/DRAWERS.md, "The nightly job"; tools/art-pixellab/ has the script and units that
 * run it). It spends the free accounts' daily generations on the next pieces of `tools/kit-gen/pixellab/daily-queue.json`,
 * pushes the pictures to the drafts store as unreviewed, and appends a line to `tools/kit-gen/pixellab/nightly-log.jsonl`
 * (what each account gave, so the real allowance is measured). It never touches the paid account.
 *
 * `--dry-run` reads the three files, prints the accounts and the next pieces, and calls nothing: not even /balance.
 * The exit code is 1 when anything failed (a refusal for lack of credit is not a failure) and 0 otherwise.
 * The last line of a live run is `RESULT {json}` for the script that opens the pull request.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { realHttp, type Http } from './pixellab/api.js';
import { runNightly, parseQueue, type NightlyResult } from './pixellab/nightly.js';
import { nightlyIndexes, parsePoolConfig, readTokenFile, type TokenReader } from './pixellab/pool.js';
import { runCli as draftsCli } from './drafts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const KIT = 'tools/kit-gen/pixellab';
const USAGE = 'Usage: pnpm art:nightly [--dry-run] [--out DIR] [--state DIR] [--max-per-account N] [--no-push] [--date YYYY-MM-DD]';

export const MAX_PER_ACCOUNT = 25;

export interface NightlyIo {
  http: Http;
  readToken: TokenReader;
  root: string;
  push: (folder: string, label: string, provenance: string) => number;
  say: (text: string) => void;
  /** Today in Israel, `YYYY-MM-DD`. */
  today: () => string;
}

export const realIo: NightlyIo = {
  http: realHttp,
  readToken: readTokenFile,
  root: ROOT,
  push: (folder, label, provenance) => draftsCli(['push', folder, '--label', label, '--route', 'pixellab', '--provenance', provenance]),
  say: (t) => void process.stdout.write(`${t}\n`),
  today: () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' }),
};

function idsFrom(path: string, pick: (line: Record<string, unknown>) => unknown[]): string[] {
  if (!existsSync(path)) return [];
  const ids: string[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      for (const v of pick(JSON.parse(line) as Record<string, unknown>)) if (typeof v === 'string') ids.push(v);
    } catch {
      // a half-written line (power cut) is skipped: the piece it named is drawn again at worst
    }
  }
  return ids;
}

/** Pieces made on a night that has landed (the tracked log) or on one still waiting for its pull request (the state). */
export function doneIds(root: string, stateDir: string): Set<string> {
  const landed = idsFrom(join(root, KIT, 'nightly-log.jsonl'), (l) => (Array.isArray(l['made']) ? l['made'] : []));
  const local = idsFrom(join(stateDir, 'done.jsonl'), (l) => [l['id']]);
  return new Set([...landed, ...local]);
}

function parseArgs(argv: readonly string[]): { flags: Set<string>; values: Map<string, string> } {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (a === '--dry-run' || a === '--no-push') flags.add(a);
    else if (a === '--out' || a === '--state' || a === '--max-per-account' || a === '--date') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value\n${USAGE}`);
      values.set(a, v);
      i += 1;
    } else throw new Error(`unknown argument ${a}\n${USAGE}`);
  }
  return { flags, values };
}

export function logLine(r: NightlyResult): string {
  return JSON.stringify({
    date: r.date,
    accounts: r.accounts.map((a) => ({ label: a.label, given: a.given, outcome: a.outcome, apiBalance: a.apiBalance, ...(a.error === null ? {} : { error: a.error }) })),
    made: r.made.map((m) => m.id),
  });
}

export async function nightlyMain(argv: readonly string[], io: NightlyIo = realIo, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const { flags, values } = parseArgs(argv);
  const date = values.get('--date') ?? io.today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date is YYYY-MM-DD');
  const stateDir = resolve(values.get('--state') ?? env['ART_PIXELLAB_STATE'] ?? join(homedir(), '.local', 'state', 'art-pixellab'));
  const out = resolve(values.get('--out') ?? join(io.root, '.scratch', 'pixellab-nightly', date));
  const cap = Number(values.get('--max-per-account') ?? MAX_PER_ACCOUNT);
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) throw new Error('--max-per-account is a whole number from 1 to 100');

  const config = parsePoolConfig(readFileSync(join(io.root, KIT, 'pool.json'), 'utf8'));
  const queue = parseQueue(readFileSync(join(io.root, KIT, 'daily-queue.json'), 'utf8'));
  const done = doneIds(io.root, stateDir);
  const labels = nightlyIndexes(config).map((i) => config.accounts[i]?.label ?? '?');

  if (flags.has('--dry-run')) {
    const todo = queue.pieces.filter((p) => !done.has(p.id));
    io.say(`nightly dry run ${date}: accounts ${labels.join(', ') || '(none)'}, up to ${cap} generations each`);
    io.say(`queue: ${queue.pieces.length} pieces, ${done.size} made, ${todo.length} to go; next: ${todo.slice(0, 5).map((p) => p.id).join(', ') || '(none)'}`);
    io.say('nothing is called and nothing is written');
    return labels.length === 0 ? 1 : 0;
  }

  const result = await runNightly({ http: io.http, config, readToken: io.readToken, queue, done, out, date, say: io.say }, { maxPerAccount: cap });

  // the state first: a picture that was paid for is never drawn twice, whatever happens to the push after it
  mkdirSync(stateDir, { recursive: true });
  for (const m of result.made) appendFileSync(join(stateDir, 'done.jsonl'), `${JSON.stringify({ id: m.id, date, account: m.account })}\n`);

  let pushFailed = false;
  if (result.made.length > 0 && !flags.has('--no-push')) {
    const code = io.push(out, `pixellab-nightly-${date}`, `The nightly PixelLab job of ${date}: ${result.made.length} small pieces from tools/kit-gen/pixellab/daily-queue.json, one generation each on the free accounts, unreviewed`);
    if (code !== 0) {
      pushFailed = true;
      result.failures.push(`art:drafts push exited ${code}`);
    }
  }
  appendFileSync(join(io.root, KIT, 'nightly-log.jsonl'), `${logLine(result)}\n`);
  io.say(`night ${date}: ${result.made.length} made; ${result.accounts.map((a) => `${a.label} ${a.given} (${a.outcome})`).join(', ')}`);
  io.say(`RESULT ${JSON.stringify({ date, made: result.made.length, failures: result.failures, pushFailed })}`);
  return result.failures.length > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  nightlyMain(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(2);
    },
  );
}
