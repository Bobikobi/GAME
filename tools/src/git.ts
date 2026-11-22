/**
 * The shared way board, hub and streams run git: arguments as a list (no shell), the output as text, a buffer big enough for a
 * full history, and the error's `status` and `stdout` kept for a caller that treats some exit codes as an answer.
 * `cwd` is the checkout to ask; undefined asks the checkout the process runs in.
 */
import { execFileSync } from 'node:child_process';

export const GIT_BUFFER = 64 * 1024 * 1024;

export function git(cwd: string | undefined, args: readonly string[]): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8', maxBuffer: GIT_BUFFER, stdio: ['ignore', 'pipe', 'pipe'] });
}
