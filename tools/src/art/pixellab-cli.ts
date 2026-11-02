/**
 * pnpm art:pixellab <spec.json> [--dry-run] [--max-generations N] [--only id,id] [--no-push] [--retry-paid]
 *
 * The PixelLab route (docs/art/DRAWERS.md, "The PixelLab route"). A spec lists jobs, each with a recipe, its inputs and
 * where its pictures go. `--dry-run` reads each account's /balance, prints the estimated generations per account and in
 * total, checks the whole spec, and calls nothing else and writes nothing. A live run spends the owner's generations:
 * it needs `--max-generations N` when any job's cost has not been measured, and every result goes to the drafts store
 * with its prompt, seed and tool (`--no-push` keeps them on disk only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { realHttp } from './pixellab/api.js';
import { parsePoolConfig, readTokenFile } from './pixellab/pool.js';
import { runSpec } from './pixellab/run.js';
import { runCli as draftsCli } from './drafts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const POOL_CONFIG = join(ROOT, 'tools/kit-gen/pixellab/pool.json');
const LEDGER = join(ROOT, 'tools/kit-gen/pixellab-ledger.jsonl');

const USAGE = 'Usage: pnpm art:pixellab <spec.json> [--dry-run] [--max-generations N] [--only id,id] [--no-push] [--retry-paid]';

async function main(argv: readonly string[]): Promise<number> {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (!a.startsWith('--')) positional.push(a);
    else if (a === '--max-generations' || a === '--only') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value\n${USAGE}`);
      values.set(a, v);
      i += 1;
    } else if (['--dry-run', '--no-push', '--retry-paid'].includes(a)) flags.add(a);
    else throw new Error(`unknown option ${a}\n${USAGE}`);
  }
  const [spec] = positional;
  if (spec === undefined || positional.length > 1) throw new Error(USAGE);
  const max = values.get('--max-generations');
  if (max !== undefined && (!/^\d+$/.test(max) || Number(max) < 1)) throw new Error('--max-generations takes a whole number of 1 or more');
  const report = await runSpec(resolve(spec), {
    http: realHttp,
    config: parsePoolConfig(readFileSync(POOL_CONFIG, 'utf8')),
    readToken: readTokenFile,
    ledgerPath: LEDGER,
    root: ROOT,
    push: (folder, label, provenance) => {
      const code = draftsCli(['push', folder, '--label', label, '--route', 'pixellab', '--provenance', provenance]);
      if (code !== 0) throw new Error(`art:drafts push exited ${code}`);
    },
    say: (t) => void process.stdout.write(`${t}\n`),
  }, {
    dryRun: flags.has('--dry-run'),
    push: !flags.has('--no-push'),
    maxGenerations: max === undefined ? null : Number(max),
    only: values.get('--only')?.split(',').filter((x) => x !== '') ?? null,
    retryPaidFailures: flags.has('--retry-paid'),
  });
  if (report.aborted !== null) process.stderr.write(`aborted: ${report.aborted}\n`);
  return report.ok ? 0 : 1;
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}, (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
