/**
 * Carry what a round's warnings taught into the spec (DECISIONS 2026-10-27).
 *
 *   pnpm kit:notes --runs <run manifest.jsonl>... <spec.json>
 *
 * Reads the manifests `kit:gen` wrote in earlier rounds (`.scratch/kit-gen/<spec>/manifest.jsonl`). A warning that
 * came back on two or more draws of one entry (numbers ignored: 53x83 and 54x83 are one complaint) becomes a clause
 * in that entry's `notes`, which every prompt builder appends after the entry's `detail`. A warning seen once is
 * noise and is not copied. Existing notes are kept and nothing is added twice, so running it again changes nothing;
 * a spec with nothing new is not rewritten at all.
 */
import { pathToFileURL } from 'node:url';

import { writeNotes } from './picks.js';

export function parseNotesArgs(args: readonly string[]): { runs: string[]; spec: string } {
  const usage = 'Usage: notes.ts --runs <run manifest.jsonl>... <spec.json>';
  const at = args.indexOf('--runs');
  const rest = args.filter((a) => a !== '--runs');
  if (at < 0 || rest.some((a) => a.startsWith('--'))) throw new Error(usage);
  const spec = rest[rest.length - 1];
  const runs = rest.slice(0, -1);
  if (spec === undefined || runs.length === 0) throw new Error(usage);
  return { runs, spec };
}

function runCli(args: readonly string[]): void {
  const { runs, spec } = parseNotesArgs(args);
  const added = writeNotes(spec, runs);
  const names = Object.keys(added);
  if (names.length === 0) process.stdout.write('no new notes\n');
  for (const name of names) process.stdout.write(`${name}: ${(added[name] ?? []).join('; ')}\n`);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) runCli(process.argv.slice(2));
