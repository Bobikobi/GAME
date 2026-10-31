/**
 * `buildHubData`: the hub-data document from the checkout and, when a client is given, GitHub (docs/team/GRUNT.md,
 * item 3; DECISIONS.md 2026-10-07, "One hub-data document, built by a tool, read by everything"). Without a client
 * the GitHub sections are empty and `sources.github` is null; a section whose source is missing is never guessed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORMAT_VERSION } from '@game/schema';
import { HUB_FORMAT, validateHubData, type HubData } from '@game/schema/hub';
import { readPoints } from '../board';
import { runCheck } from '../check';
import { loadConfig } from '../loop/config';
import type { LoopClient } from '../loop/github';
import { REPO_ROOT } from '../load';
import { addedTimes, contentSections, head, parameters } from './content';
import { githubSections, type GitHubSections } from './github';
import type { AccountsReader } from './accounts';
import { readUsage, type UsageReader } from './usage';

export const DEFAULT_REPOSITORY = 'Bobikobi/GAME';

export interface HubBuildOptions {
  /** the repository root */
  root?: string;
  /** GitHub, read-only; null builds without it */
  client: LoopClient | null;
  now: Date;
  /** read the preview links Vercel's bot leaves on proposals */
  previews: boolean;
  /** the stage-1 counters, read-only; null leaves `usage` null */
  usage?: UsageReader | null;
  /** the game server's players counter; null leaves `accounts` null */
  accounts?: AccountsReader | null;
  /** "owner/name"; defaults to the build's own repository */
  repository?: string;
  /** the branch or tag the document names; defaults to the checkout's */
  ref?: string;
  log?: (line: string) => void;
}

const EMPTY: GitHubSections = { requests: [], proposals: [], votes: [], reviewers: [], summary: null };

/** The repository and branch the build runs for, from the host's variables when it has them. */
export function buildTarget(env: NodeJS.ProcessEnv = process.env): { repository: string; ref?: string } {
  const vercel = env['VERCEL_GIT_REPO_OWNER'] && env['VERCEL_GIT_REPO_SLUG'] ? `${env['VERCEL_GIT_REPO_OWNER']}/${env['VERCEL_GIT_REPO_SLUG']}` : undefined;
  const ref = env['VERCEL_GIT_COMMIT_REF'] || env['GITHUB_HEAD_REF'] || env['GITHUB_REF_NAME'] || undefined;
  return { repository: vercel ?? env['GITHUB_REPOSITORY'] ?? DEFAULT_REPOSITORY, ...(ref ? { ref } : {}) };
}

export async function buildHubData(options: HubBuildOptions): Promise<HubData> {
  const root = options.root ?? REPO_ROOT;
  const repository = options.repository ?? DEFAULT_REPOSITORY;
  const log = options.log ?? console.log;
  const check = runCheck(root === REPO_ROOT ? undefined : join(root, 'content'));
  const assembled = check.assembled.bundle;
  if (!assembled) throw new Error('The content does not assemble; run "pnpm check" first.');
  // the board of the checkout being read, also when it is not this repository (runCheck reads it only for this one)
  const board = JSON.parse(readFileSync(join(root, 'content/board.json'), 'utf8')) as { board: typeof assembled.board };
  const bundle = { ...assembled, board: board.board };
  const points = readPoints(root);
  const loop = loadConfig(join(root, '.github', 'loop.json'));
  const commit = head(root, options.now);
  const kernel = JSON.parse(readFileSync(join(root, 'kernel/package.json'), 'utf8')) as { version: string };

  let github = EMPTY;
  let fetched: string | null = null;
  if (options.client) {
    try {
      github = await githubSections(options.client, repository, loop, points.per_approval, options.now);
      fetched = options.now.toISOString();
    } catch (error) {
      // a deploy must not fail because GitHub is slow or the token expired: the sections stay empty and say why
      log(`warning: GitHub could not be read, so requests, proposals, votes, reviewers and the summary are empty: ${error instanceof Error ? error.message : String(error)}`);
      github = EMPTY;
    }
  }
  if (!options.previews) github = { ...github, proposals: github.proposals.map(({ preview: _preview, ...rest }) => rest) };

  // core counts every commit (tools/src/board.ts), so its count is the history the board was computed from
  const commits = bundle.board['core']?.commits ?? 0;
  const content = contentSections(bundle, check.assembled.kits, points, repository, addedTimes(root));
  let usage: Awaited<ReturnType<typeof readUsage>> | null = null;
  if (options.usage) {
    try {
      usage = await readUsage(options.usage, content.extensions.map((e) => e.id), options.now);
    } catch (error) {
      log(`warning: the stage-1 counters could not be read, so usage is empty: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let accounts: HubData['accounts'] = null;
  if (options.accounts) {
    try {
      accounts = await options.accounts();
    } catch (error) {
      // unknown is said as unknown: the hub never shows a guessed 0
      log(`warning: the game server's players counter could not be read, so accounts is null: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const compose = (gh: GitHubSections, at: string | null): HubData => ({
    format: HUB_FORMAT,
    built_at: options.now.toISOString(),
    source: {
      repository,
      ref: (options.ref ?? commit.branch).slice(0, 120),
      sha: commit.sha,
      content_tag: bundle.tag,
      kernel_version: kernel.version,
      schema_format: FORMAT_VERSION,
    },
    sources: {
      git: { commits, newest_at: commit.at },
      github: at ? { fetched_at: at } : null,
      vercel: at && options.previews ? { fetched_at: at } : null,
      usage: usage ? { fetched_at: options.now.toISOString(), window_days: usage.window_days } : null,
      accounts: accounts ? { fetched_at: options.now.toISOString() } : null,
    },
    ...content,
    reviewers: gh.reviewers,
    requests: gh.requests,
    proposals: gh.proposals,
    votes: gh.votes,
    summary: gh.summary,
    parameters: parameters(root, loop, points),
    players: null,
    accounts,
    usage: usage?.usage ?? null,
  });
  const doc = compose(github, fetched);
  if (fetched === null) return doc;
  // what people write on GitHub is not ours to vouch for: a document it would break is published without it
  const issues = validateHubData(doc);
  if (issues.length === 0) return doc;
  log(`warning: what GitHub returned does not fit the document, so its sections are left out: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`);
  return compose(EMPTY, null);
}
