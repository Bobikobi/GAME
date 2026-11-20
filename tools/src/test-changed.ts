import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type Stage = 'build' | 'handover' | 'all';

export type TestRun = {
  id: string;
  command: string;
  args: string[];
  reason: string;
};

const ROOT_TESTS = ['kernel', 'tools', 'schema', 'mcp', 'game', 'server'] as const;
const ROOT_SOURCE = new Set(ROOT_TESTS);

function unique(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort();
}

function allRuns(reason: string): TestRun[] {
  return [
    { id: 'root:all', command: 'pnpm', args: ['exec', 'vitest', 'run', '--maxWorkers=1'], reason },
    { id: 'web:all', command: 'pnpm', args: ['--filter', '@game/web', 'exec', 'vitest', 'run', '--maxWorkers=1'], reason },
  ];
}

export function routeChangedTests(changedPaths: readonly string[], stage: Stage): TestRun[] {
  const paths = unique(changedPaths);
  if (stage === 'all') return allRuns('stage all runs every Vitest suite');
  if (paths.length === 0) return [];

  const packages = new Set<string>();
  const relatedRoot: string[] = [];
  const relatedWeb: string[] = [];
  const directRoot: string[] = [];
  const directWeb: string[] = [];
  const unknown: string[] = [];

  for (const path of paths) {
    const [top] = path.split('/');
    const isTest = /(?:^|\/)test\/.*\.test\.[cm]?[jt]sx?$/.test(path);
    if (top === 'web') {
      packages.add('web');
      (isTest ? directWeb : relatedWeb).push(path);
    } else if (top !== undefined && ROOT_SOURCE.has(top as (typeof ROOT_TESTS)[number])) {
      packages.add(top);
      (isTest ? directRoot : relatedRoot).push(path);
    } else {
      unknown.push(path);
    }
  }

  if (unknown.length > 0) {
    return allRuns(`${unknown.length} changed path(s) have no known test link; widening the run`);
  }

  if (stage === 'handover') {
    const runs: TestRun[] = [];
    const rootPackages = [...packages].filter((name) => name !== 'web').sort();
    if (rootPackages.length > 0) {
      runs.push({
        id: 'root:packages',
        command: 'pnpm',
        args: ['exec', 'vitest', 'run', ...rootPackages.map((name) => `${name}/test`), '--maxWorkers=1'],
        reason: `handover runs the full suite of touched package(s): ${rootPackages.join(', ')}`,
      });
    }
    if (packages.has('web')) {
      runs.push({
        id: 'web:package',
        command: 'pnpm',
        args: ['--filter', '@game/web', 'exec', 'vitest', 'run', '--maxWorkers=1'],
        reason: 'handover runs the full suite of touched package: web',
      });
    }
    return runs;
  }

  const runs: TestRun[] = [];
  if (directRoot.length > 0) {
    runs.push({ id: 'root:changed-tests', command: 'pnpm', args: ['exec', 'vitest', 'run', ...directRoot, '--maxWorkers=1'], reason: 'changed root test files run directly' });
  }
  if (relatedRoot.length > 0) {
    runs.push({ id: 'root:related', command: 'pnpm', args: ['exec', 'vitest', 'related', ...relatedRoot, '--run', '--maxWorkers=1'], reason: 'build runs tests related to changed root source files' });
  }
  if (directWeb.length > 0) {
    runs.push({ id: 'web:changed-tests', command: 'pnpm', args: ['--filter', '@game/web', 'exec', 'vitest', 'run', ...directWeb, '--maxWorkers=1'], reason: 'changed web test files run directly' });
  }
  if (relatedWeb.length > 0) {
    runs.push({ id: 'web:related', command: 'pnpm', args: ['--filter', '@game/web', 'exec', 'vitest', 'related', ...relatedWeb.map((path) => path.slice(4)), '--run', '--maxWorkers=1'], reason: 'build runs tests related to changed web source files' });
  }
  return runs;
}

export function parseStage(argv: readonly string[]): { stage: Stage; planOnly: boolean } {
  let stage: Stage = 'build';
  let planOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--plan') planOnly = true;
    else if (arg === '--stage' || arg.startsWith('--stage=')) {
      const value = arg === '--stage' ? argv[++i] : arg.slice('--stage='.length);
      if (value !== 'build' && value !== 'handover' && value !== 'all') throw new Error('stage must be build, handover or all');
      stage = value;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return { stage, planOnly };
}

export function changedPaths(root = process.cwd()): string[] {
  const tracked = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRD', 'origin/develop', '--'], { cwd: root, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  return unique([...tracked.split('\n'), ...untracked.split('\n')].filter(Boolean));
}

function show(run: TestRun): string {
  return `${run.id}: ${run.command} ${run.args.join(' ')} — ${run.reason}`;
}

export function main(argv = process.argv.slice(2)): number {
  const { stage, planOnly } = parseStage(argv);
  const paths = changedPaths();
  const runs = routeChangedTests(paths, stage);
  console.log(`test:changed stage=${stage}, ${paths.length} changed path(s) against origin/develop`);
  if (runs.length === 0) console.log('none: no changed paths; nothing to run');
  else for (const run of runs) console.log(show(run));
  if (planOnly) return 0;
  for (const run of runs) {
    const result = spawnSync(run.command, run.args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
