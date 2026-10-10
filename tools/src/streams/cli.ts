/**
 * pnpm streams: the live picture of parallel work, printed on demand and never
 * committed. It reads refs and GitHub only: no worktree is opened, no branch is
 * touched, the one write is `git fetch`. Flags: --no-fetch, --local (read
 * docs/team/streams.json from this checkout instead of origin/develop), --json.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  buildReport,
  ciOf,
  render,
  type BranchFact,
  type Collision,
  type Facts,
  type PrFact,
  type Stray,
  type StreamDef,
} from './report';

const STREAMS_FILE = 'docs/team/streams.json';
const args = process.argv.slice(2);

interface Run {
  code: number;
  out: string;
}

function git(argv: string[], okCodes: number[] = [0]): Run {
  try {
    return { code: 0, out: execFileSync('git', argv, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    if (failure.status !== undefined && okCodes.includes(failure.status)) return { code: failure.status, out: failure.stdout ?? '' };
    throw error;
  }
}

function rev(ref: string): string | undefined {
  const { out } = git(['rev-parse', '--verify', '--quiet', ref], [0, 1]);
  return out.trim() || undefined;
}

function isAncestor(a: string, b: string): boolean {
  return git(['merge-base', '--is-ancestor', a, b], [0, 1]).code === 0;
}

/** Files that conflict when b merges into a, without touching any worktree or ref. */
function conflictsOf(a: string, b: string): string[] {
  const { code, out } = git(['merge-tree', '--write-tree', '--name-only', '--no-messages', a, b], [0, 1]);
  return code === 0 ? [] : out.split('\n').slice(1).filter(Boolean);
}

/** Commits that no branch on GitHub holds: work that exists only on this machine. */
function onNoRemote(tip: string): number {
  return Number(git(['rev-list', '--count', tip, '--not', '--remotes=origin']).out.trim());
}

/** The branch's own tip: the local one when it holds everything on GitHub, otherwise GitHub's. */
function tipOf(branch: string): { rev: string; unpushed: number } | undefined {
  const remote = rev(`refs/remotes/origin/${branch}`);
  const local = rev(`refs/heads/${branch}`);
  if (!remote && !local) return undefined;
  if (!local) return { rev: remote!, unpushed: 0 };
  if (!isAncestor(remote ?? local, local)) return { rev: remote!, unpushed: 0 };
  return { rev: local, unpushed: onNoRemote(local) };
}

function readStreams(): StreamDef[] {
  let text: string;
  if (args.includes('--local')) text = readFileSync(STREAMS_FILE, 'utf8');
  else {
    const shown = git(['show', `origin/develop:${STREAMS_FILE}`], [0, 128]);
    if (shown.code !== 0) throw new Error(`${STREAMS_FILE} is not on origin/develop yet; run with --local from the branch that adds it.`);
    text = shown.out;
  }
  const parsed = JSON.parse(text) as { streams?: StreamDef[] };
  if (!Array.isArray(parsed.streams)) throw new Error(`${STREAMS_FILE} must hold a "streams" array.`);
  return parsed.streams;
}

interface GhPr {
  number: number;
  title: string;
  headRefName: string;
  isDraft: boolean;
  url: string;
  statusCheckRollup: { status?: string; conclusion?: string; state?: string }[];
}

function readPrs(): GhPr[] | undefined {
  try {
    const raw = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--base', 'develop', '--limit', '100', '--json', 'number,title,headRefName,isDraft,url,statusCheckRollup'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return JSON.parse(raw) as GhPr[];
  } catch {
    console.error('GitHub is not reachable with gh: the pull request and CI columns are empty.');
    return undefined;
  }
}

function gather(): Facts {
  if (!args.includes('--no-fetch')) git(['fetch', 'origin', '--prune']);
  const develop = rev('origin/develop');
  if (!develop) throw new Error('origin/develop does not exist: fetch the repository first.');
  const streams = readStreams();
  const prs = readPrs() ?? [];
  const prOf = new Map(prs.map((p) => [p.headRefName, p] as const));

  const mapped = streams.filter((s) => !s.parked).flatMap((s) => s.branches);
  const tips = new Map<string, { rev: string; unpushed: number }>();
  const branches: BranchFact[] = mapped.map((branch) => {
    const tip = tipOf(branch);
    const pr = prOf.get(branch);
    const prFact: PrFact | undefined = pr
      ? { number: pr.number, title: pr.title, url: pr.url, draft: pr.isDraft, ci: ciOf(pr.statusCheckRollup) }
      : undefined;
    if (!tip) return { branch, exists: false, ahead: 0, behind: 0, unpushed: 0, files: 0, pr: prFact, contains: [], conflicts: [] };
    tips.set(branch, tip);
    const [behind, ahead] = git(['rev-list', '--left-right', '--count', `origin/develop...${tip.rev}`]).out.trim().split(/\s+/).map(Number);
    const files = git(['diff', '--name-only', `origin/develop...${tip.rev}`]).out.split('\n').filter(Boolean).length;
    return {
      branch,
      exists: true,
      ahead: ahead ?? 0,
      behind: behind ?? 0,
      unpushed: tip.unpushed,
      files,
      pr: prFact,
      contains: [],
      conflicts: ahead ? conflictsOf('origin/develop', tip.rev) : [],
    };
  });

  const live = branches.filter((b) => b.exists && b.ahead > 0);
  for (const fact of live) {
    const mine = tips.get(fact.branch)!.rev;
    fact.contains = live
      .filter((other) => other.branch !== fact.branch && tips.get(other.branch)!.rev !== mine && isAncestor(tips.get(other.branch)!.rev, mine))
      .map((other) => other.branch);
  }

  const collisions: Collision[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!;
      const b = live[j]!;
      if (a.contains.includes(b.branch) || b.contains.includes(a.branch)) continue;
      const files = conflictsOf(tips.get(a.branch)!.rev, tips.get(b.branch)!.rev);
      if (files.length > 0) collisions.push({ a: a.branch, b: b.branch, files });
    }
  }

  const listed = new Set(streams.flatMap((s) => s.branches));
  const strays: Stray[] = prs
    .filter((p) => !listed.has(p.headRefName))
    .map((p) => ({ number: p.number, title: p.title, branch: p.headRefName, draft: p.isDraft }));

  return { develop: develop.slice(0, 7), streams, branches, collisions, strays };
}

try {
  const report = buildReport(gather());
  console.log(args.includes('--json') ? JSON.stringify(report, null, 2) : render(report));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
