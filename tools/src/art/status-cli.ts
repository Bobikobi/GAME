/**
 * pnpm art:status [--json] [--next N]
 *
 * The art pools (tools/kit-gen/pools/) and the status of every entry, derived from files by `status.ts`:
 * counts by status per pool, what blocks, the next N missing entries in rank order (default 5 a pool), the
 * GPU minutes of the week. Plain text; `--json` for a tool. Reads; it writes nothing.
 */
import { statusCli } from './status.js';

process.stdout.write(statusCli(process.argv.slice(2)));
