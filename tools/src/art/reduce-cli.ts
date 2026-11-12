/**
 * pnpm art:reduce <picture.png | folder> --height N | --width N [--colours N] [--frame N] [--no-key] --out <file | folder>
 *
 * The clean reduction of a draft to game size (src/art/reduce.ts). A folder is reduced picture by picture into the
 * output folder, keeping the names. Nothing is written outside `--out`.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { DEFAULT_COLOURS, distinct, reduce, type ReduceOptions } from './reduce.js';

const USAGE = 'Usage: pnpm art:reduce <picture.png | folder> --height N | --width N [--colours N (0 keeps all, default 48)] [--frame N] [--no-key] --out <file | folder>';

export function reduceCli(argv: readonly string[]): string {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (!a.startsWith('--')) positional.push(a);
    else if (a === '--no-key') flags.add(a);
    else if (['--height', '--width', '--colours', '--frame', '--out'].includes(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value\n${USAGE}`);
      values.set(a, v);
      i += 1;
    } else throw new Error(`unknown option ${a}\n${USAGE}`);
  }
  const [input] = positional;
  const out = values.get('--out');
  if (input === undefined || positional.length > 1 || out === undefined) throw new Error(USAGE);
  const number = (name: string): number | undefined => {
    const v = values.get(name);
    if (v === undefined) return undefined;
    if (!/^\d+$/.test(v)) throw new Error(`${name} takes a whole number`);
    return Number(v);
  };
  const options: ReduceOptions = { colours: number('--colours') ?? DEFAULT_COLOURS, key: !flags.has('--no-key') };
  const height = number('--height');
  const width = number('--width');
  const frame = number('--frame');
  if (height !== undefined) options.height = height;
  if (width !== undefined) options.width = width;
  if (frame !== undefined) options.frame = frame;

  const files = statSync(input).isDirectory()
    ? readdirSync(input).filter((f) => f.toLowerCase().endsWith('.png')).sort().map((f) => ({ from: join(input, f), to: join(out, f) }))
    : [{ from: input, to: out }];
  const lines: string[] = [];
  for (const f of files) {
    const result = reduce(PNG.sync.read(readFileSync(f.from)), options);
    mkdirSync(dirname(resolve(f.to)), { recursive: true });
    writeFileSync(f.to, PNG.sync.write(result));
    lines.push(`${basename(f.from)} -> ${f.to}  ${result.width}x${result.height}, ${distinct(result)} colours`);
  }
  return `${lines.join('\n')}\n`;
}

try {
  process.stdout.write(reduceCli(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
