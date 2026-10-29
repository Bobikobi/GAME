/**
 * pnpm art:run [--once] [--dry] [--no-upload] [--clear-stop] [--max-wait-hours N] [--poll-seconds N]
 *
 * Work the queue `art:wave` filled, one kernel run at a time: draw on Kaggle, import, index the drafts, upload them to the
 * drafts repo. It retries a failed job once, stops the queue on a second failure, and pauses while Kaggle is down. See `run.ts`.
 * Start it in the background: a wave takes the better part of an hour.
 */
import { runCli } from './run.js';

try {
  process.exitCode = runCli(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
