/**
 * pnpm art:pick --from picks.json [--dry]
 * pnpm art:pick <pool> <name> <draft-id> [--by who] [--dry]
 *
 * Apply the owner's pick: see `pick.ts`. `--dry` prints what would change and writes nothing.
 */
import { pickCli } from './pick.js';

try {
  const { text, code } = pickCli(process.argv.slice(2));
  process.stdout.write(text);
  process.exitCode = code;
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
