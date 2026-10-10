/**
 * The sections of the hub-data document that come from GitHub: requests, proposals, votes, reviewers and the weekly
 * summary (docs/team/GRUNT.md, item 3). Read-only: every call goes through the loop's client, and every rule is the
 * loop's own function, so the hub shows what the loop decided and never decides anything itself.
 */
import type { HubProposal, HubRequest, HubReviewer, HubSummary, HubVote, MergeStateName, RequestKindName } from '@game/schema/hub';
import type { LoopConfig } from '../loop/config';
import type { LoopClient } from '../loop/github';
import { applyCompetition, collectProposals, readVote, type ProposalState, type RunOptions } from '../loop/run';
import { support } from '../loop/requests';
import type { Comment, Issue, PullRequest, Review } from '../loop/types';
import { decideVote, parseVoteMarker } from '../loop/vote';
import type { AccountDate } from '../loop/vote';

export interface GitHubSections {
  requests: HubRequest[];
  proposals: HubProposal[];
  votes: HubVote[];
  reviewers: HubReviewer[];
  summary: HubSummary | null;
}

interface ClosedIssue extends Issue {
  state_reason?: string | null;
}

/** The dropdown of .github/ISSUE_TEMPLATE/request.yml, mapped to the document's words. */
const KINDS: Record<string, RequestKindName> = {
  'A plant or other resource': 'resource',
  'A recipe': 'recipe',
  'A ruin or a treasure to dig': 'treasure',
  'A character or a quest': 'character',
  'A building or a place': 'place',
};

/** The kind picked in the request form; `other` when the answer is missing or unknown. */
export function requestKind(body: string | null): RequestKindName {
  const answer = body?.match(/###\s*What kind of thing is it\?\s*\n+([^\n]+)/)?.[1]?.trim();
  return (answer && KINDS[answer]) || 'other';
}

/** A GitHub login in the document's form: lowercase, without a bot suffix. */
export const handle = (login: string): string => login.toLowerCase().replace(/\[bot\]$/, '').replace(/[^a-z0-9_-]/g, '-').slice(0, 39);

const cut = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The trial world of a proposal: the game on the preview Vercel's bot links in its comment. */
export function previewOf(comments: Comment[]): string | undefined {
  const bot = comments.find((c) => c.user?.login === 'vercel[bot]');
  const host = bot?.body.match(/https:\/\/[a-z0-9-]+\.vercel\.app/)?.[0];
  return host ? `${host}/play/` : undefined;
}

const repo = (repository: string, suffix: string): string => `/repos/${repository}${suffix}`;
const hasLabel = (issue: Issue, name: string): boolean => issue.labels.some((l) => l.name === name);

function mergeState(proposal: ProposalState): MergeStateName {
  const rules = proposal.evaluation.rules;
  if (rules.every((r) => r.state === 'pass')) return 'pass';
  return rules.some((r) => r.state === 'fail') ? 'fail' : 'pending';
}

async function proposals(options: RunOptions, voteIssues: Issue[]): Promise<HubProposal[]> {
  const states = await collectProposals(options, false);
  await applyCompetition(options, states, voteIssues, false);
  const out: HubProposal[] = [];
  for (const p of states) {
    const comments = await options.client.list<Comment>(repo(options.repository, `/issues/${p.number}/comments?per_page=100`));
    const preview = previewOf(comments);
    out.push({
      number: p.number,
      title: cut(p.pr.title, 200),
      url: p.pr.html_url,
      author: handle(p.pr.user.login),
      state: 'open',
      slots: p.slots,
      ...(p.request !== undefined ? { answers: p.request } : {}),
      merge_rule: mergeState(p),
      checks: p.evaluation.rules.map((r) => ({ rule: cut(r.name, 240), state: r.state, detail: cut(r.text, 240) })),
      approvals: p.evaluation.approvalCount,
      reviewers: p.evaluation.approvals.map(handle),
      competing: p.competitors,
      ...(p.voteIssue !== undefined ? { vote: p.voteIssue } : {}),
      ...(preview ? { preview } : {}),
      created_at: p.pr.created_at,
      updated_at: p.pr.updated_at ?? p.pr.created_at,
    });
  }
  return out;
}

async function requests(options: RunOptions, open: HubProposal[]): Promise<HubRequest[]> {
  const issues = (await options.client.list<Issue>(repo(options.repository, '/issues?state=open&labels=request&per_page=100'))).filter((i) => !i.pull_request);
  return issues.map((issue) => {
    const backing = support(issue);
    const openCall = hasLabel(issue, 'open call') || backing >= options.config.open_call_votes;
    return {
      number: issue.number,
      title: cut(issue.title, 200),
      url: issue.html_url,
      author: handle(issue.user.login),
      kind: requestKind(issue.body),
      support: backing,
      open_call: openCall,
      capability: openCall && hasLabel(issue, 'capability'),
      created_at: issue.created_at,
      proposals: open.filter((p) => p.answers === issue.number).map((p) => p.number),
    };
  });
}

async function votes(options: RunOptions, issues: ClosedIssue[]): Promise<HubVote[]> {
  const accounts = new Map<string, AccountDate>();
  const out: HubVote[] = [];
  for (const issue of issues) {
    const marker = parseVoteMarker(issue.body);
    if (!marker) continue;
    const counted = await readVote(options, issue, accounts);
    if (counted.options.length === 0) continue;
    const total = counted.options.reduce((sum, o) => sum + o.votes, 0);
    const lead = Math.max(0, ...counted.options.map((o) => o.votes));
    const state: HubVote['state'] = issue.state !== 'closed' ? 'open' : issue.state_reason === 'not_planned' ? 'postponed' : 'decided';
    const decision = state === 'decided' ? decideVote(counted.options, options.config.min_votes_to_decide) : undefined;
    out.push({
      number: issue.number,
      title: cut(issue.title, 200),
      url: issue.html_url,
      kind: marker.kind === 'proposals' ? 'proposal' : 'discovery',
      state,
      opened_at: issue.created_at,
      closes_at: new Date(marker.closes).toISOString(),
      options: counted.options.map((o) => ({
        key: o.key,
        title: cut(o.label, 200),
        ...(marker.kind === 'proposals' && /^\d+$/.test(o.key) ? { url: `https://github.com/${options.repository}/pull/${o.key}` } : {}),
        // the loop's display rule: a bar relative to the leading option, an exact share only past the minimum; with no
        // choice made yet every option is level with the lead
        bar: lead === 0 ? 100 : Math.round((o.votes * 100) / lead),
        percent: total >= options.config.min_votes_for_percent ? Math.round((o.votes * 100) / total) : null,
      })),
      ...(decision?.kind === 'winner' && decision.winner ? { winner: decision.winner } : {}),
    });
  }
  return out;
}

async function reviewers(options: RunOptions, perApproval: number): Promise<HubReviewer[]> {
  const closed = await options.client.list<PullRequest>(repo(options.repository, '/pulls?state=closed&per_page=100'));
  const approvals = new Map<string, number>();
  for (const pr of closed.filter((p) => p.merged_at && hasLabel(p, 'proposal'))) {
    const reviews = await options.client.list<Review>(repo(options.repository, `/pulls/${pr.number}/reviews?per_page=100`));
    const author = pr.user.login.toLowerCase();
    const who = new Set(
      reviews
        .filter((r) => r.state === 'APPROVED' && r.user && r.commit_id === pr.head.sha && r.user.login.toLowerCase() !== author)
        .map((r) => handle(r.user!.login)),
    );
    for (const h of who) approvals.set(h, (approvals.get(h) ?? 0) + 1);
  }
  return [...approvals]
    .map(([h, n]) => ({ handle: h, approvals: n, points: perApproval * n, url: `https://github.com/${h}` }))
    .sort((a, b) => b.points - a.points || a.handle.localeCompare(b.handle));
}

async function summary(options: RunOptions): Promise<HubSummary | null> {
  const issues = (await options.client.list<Issue>(repo(options.repository, '/issues?state=all&labels=weekly%20summary&per_page=100'))).filter((i) => !i.pull_request);
  const newest = [...issues].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const week = newest?.title.match(/\d{4}-W\d{2}/)?.[0];
  return newest && week ? { week, number: newest.number, url: newest.html_url, posted_at: newest.created_at } : null;
}

export async function githubSections(client: LoopClient, repository: string, config: LoopConfig, perApproval: number, now: Date): Promise<GitHubSections> {
  const options: RunOptions = { client, repository, config, now, log: () => {} };
  const voteIssues = (await client.list<ClosedIssue>(repo(repository, '/issues?state=all&labels=vote&per_page=100'))).filter((i) => !i.pull_request);
  const open = await proposals(options, voteIssues.filter((i) => i.state !== 'closed'));
  return {
    requests: await requests(options, open),
    proposals: open,
    votes: await votes(options, voteIssues),
    reviewers: await reviewers(options, perApproval),
    summary: await summary(options),
  };
}
