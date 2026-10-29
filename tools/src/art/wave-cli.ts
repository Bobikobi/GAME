/**
 * pnpm art:wave <pool> [--size N] [--dry] [--prompts]
 *
 * Cut a wave from a pool (up to N entries, 12 by default) and queue it under `.scratch/art-queue/`; `--dry` only prints the
 * plan (entries, recipes, seeds, estimated GPU minutes against the week's meter) and writes nothing. `--prompts` adds the
 * prompts the kernels would read. `pnpm art:run` works the queue. See `wave.ts`.
 */
import { waveCli } from './wave.js';

try {
  const { text, code } = waveCli(process.argv.slice(2));
  process.stdout.write(text);
  process.exitCode = code;
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
