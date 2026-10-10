/**
 * `buildHubData`: the hub-data document from the checkout and, when a client is given, GitHub (docs/team/GRUNT.md,
 * item 3; DECISIONS.md 2026-10-07, "One hub-data document, built by a tool, read by everything"). Without a client
 * the GitHub sections are empty and `sources.github` is null; a section whose source is missing is never guessed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORMAT_VERSION } from '@game/schema';
import { HUB_FORMAT, type HubData } from '@game/schema/hub';
import { readPoints } from '../board';
import { runCheck } from '../check';
import { loadConfig } from '../loop/config';
import type { LoopClient } from '../loop/github';
import { REPO_ROOT } from '../load';
import { addedTimes, contentSections, head, parameters } from './content';
import { githubSections, type GitHubSections } from './github';

export const DEFAULT_REPOSITORY = 'Bobikobi/GAME';

export interface HubBuildOptions {
  /** the repository root */
  root?: string;
  /** GitHub, read-only; null builds without it */
  client: LoopClient | null;
  now: Date;
  /** read the preview links Vercel's bot leaves on proposals */
  previews: boolean;
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
  return {
    format: HUB_FORMAT,
    built_at: options.now.toISOString(),
    source: {
      repository,
      ref: options.ref ?? commit.branch,
      sha: commit.sha,
      content_tag: bundle.tag,
      kernel_version: kernel.version,
      schema_format: FORMAT_VERSION,
    },
    sources: {
      git: { commits, newest_at: commit.at },
      github: fetched ? { fetched_at: fetched } : null,
      vercel: fetched && options.previews ? { fetched_at: fetched } : null,
      usage: null,
    },
    ...contentSections(bundle, check.assembled.kits, points, repository, addedTimes(root)),
    reviewers: github.reviewers,
    requests: github.requests,
    proposals: github.proposals,
    votes: github.votes,
    summary: github.summary,
    parameters: parameters(root, loop, points),
    players: null,
    usage: null,
  };
}
