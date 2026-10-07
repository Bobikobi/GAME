/** Command line entry point for the GitHub community loop. */
import { loadConfig } from './config';
import { GitHubClient } from './github';
import { ensureLabels, runAll, runDiscovery, runProposals, runRequests, runSummary, runVotes } from './run';

const args = process.argv.slice(2);
const command = args[0];
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token) fail('GITHUB_TOKEN is required.');
if (!repository) fail('GITHUB_REPOSITORY is required.');
if (!command || !['requests', 'proposals', 'votes', 'discovery', 'summary', 'all'].includes(command)) {
  fail('usage: pnpm loop requests|proposals|votes|discovery|summary|all [--dry-run] [--now <ISO>] [--post]');
}

const nowIndex = args.indexOf('--now');
const now = nowIndex < 0 ? new Date() : new Date(args[nowIndex + 1] ?? '');
if (Number.isNaN(now.getTime())) fail('--now must be a valid ISO date.');

try {
  const client = new GitHubClient(token, args.includes('--dry-run'));
  const options = {
    client,
    repository,
    config: loadConfig(),
    now,
    stepSummary: process.env.GITHUB_STEP_SUMMARY,
  };
  if (command === 'all') await runAll(options);
  else if (command === 'summary' && !args.includes('--post')) await runSummary(options, false);
  else {
    await ensureLabels(options);
    if (command === 'requests') await runRequests(options);
    if (command === 'proposals') await runProposals(options);
    if (command === 'votes') await runVotes(options);
    if (command === 'discovery') await runDiscovery(options);
    if (command === 'summary') await runSummary(options, true);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
