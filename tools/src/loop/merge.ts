/** Pure evaluation of proposal ownership, checks, reviews, vetoes, and quota. */
import type { LoopConfig } from './config';
import type { CheckRun, Review } from './types';

export type RuleState = 'pass' | 'pending' | 'fail';

export interface RuleResult {
  name: string;
  state: RuleState;
  text: string;
}

export interface MergeInput {
  author: string;
  headSha: string;
  files: string[];
  labels: string[];
  checks: CheckRun[];
  reviews: Review[];
  accepted: number;
  quotaPassing: number;
  overQuota: boolean;
  config: LoopConfig;
}

export interface MergeEvaluation {
  rules: RuleResult[];
  ready: boolean;
  state: 'success' | 'pending' | 'failure';
  description: string;
  approvals: string[];
  approvalCount: number;
  allowed: number;
}

export function evaluateMerge(input: MergeInput): MergeEvaluation {
  const rules: RuleResult[] = [];
  const author = input.author.toLowerCase();
  const outside = input.files.filter((file) => {
    const match = file.match(/^content\/(?:extensions|kit)\/([^/]+)\//);
    return !match || match[1]!.toLowerCase() !== author || match[1] !== author;
  });
  rules.push(outside.length === 0
    ? pass('Files', `All files are in content folders owned by @${input.author}`)
    : fail('Files', `Files outside your own folders: ${outside.join(', ')}`));

  const byName = new Map(input.checks.map((check) => [check.name, check]));
  const pendingChecks = input.config.required_checks.filter((name) => {
    const check = byName.get(name);
    return !check || check.status !== 'completed';
  });
  const failedChecks = input.config.required_checks.filter((name) => {
    const check = byName.get(name);
    return check?.status === 'completed' && check.conclusion !== 'success';
  });
  if (failedChecks.length > 0) rules.push(fail('Checks', `Checks failed: ${failedChecks.join(', ')}`));
  else if (pendingChecks.length > 0) rules.push(pending('Checks', `Checks pending: ${pendingChecks.join(', ')}`));
  else rules.push(pass('Checks', 'All required checks passed'));

  const latest = latestReviews(input.reviews, author);
  const changes = [...latest.values()].filter((review) => review.state === 'CHANGES_REQUESTED');
  rules.push(changes.length === 0
    ? pass('Review problems', 'No reviewer has an outstanding change request')
    : fail('Review problems', `A reviewer reported a problem: ${changes.map((review) => `@${review.user!.login}`).join(', ')}`));

  const approvals = [...latest.values()].filter((review) => review.state === 'APPROVED');
  const current = approvals.filter((review) => !input.config.approvals_must_match_head || review.commit_id === input.headSha);
  const older = approvals.length - current.length;
  if (current.length >= input.config.approvals_to_merge) {
    rules.push(pass('Approvals', `${current.length} of ${input.config.approvals_to_merge} approvals`));
  } else {
    const text = older > 0
      ? `${current.length} of ${input.config.approvals_to_merge} approvals; ${older} approvals on an older commit; reviewers should play the new version`
      : `${current.length} of ${input.config.approvals_to_merge} approvals`;
    rules.push(pending('Approvals', text));
  }

  rules.push(input.labels.includes('veto')
    ? fail('Veto', 'Vetoed by a maintainer, for a reason from the closed list in CONTRIBUTING.md')
    : pass('Veto', 'No maintainer veto'));

  const allowed = Math.min(input.config.quota.cap, input.config.quota.new_creator + input.config.quota.per_accepted * input.accepted);
  rules.push(input.overQuota
    ? fail('Quota', `Over the submission quota: ${input.quotaPassing} open proposals passed the check, ${allowed} allowed`)
    : pass('Quota', `${input.quotaPassing} checked open proposal${input.quotaPassing === 1 ? '' : 's'}, ${allowed} allowed`));

  if (input.labels.includes('vote lost')) rules.push(fail('Vote', 'This proposal lost its vote'));
  else if (input.labels.includes('vote won')) rules.push(pass('Vote', 'This proposal won its vote'));

  const ready = rules.every((rule) => rule.state === 'pass');
  const state = ready ? 'success' : rules.some((rule) => rule.state === 'fail') ? 'failure' : 'pending';
  return {
    rules,
    ready,
    state,
    description: ready ? 'Ready to merge' : shortDescription(rules),
    approvals: current.map((review) => review.user!.login),
    approvalCount: current.length,
    allowed,
  };
}

export function latestReviews(reviews: Review[], authorLower: string): Map<string, Review> {
  const latest = new Map<string, Review>();
  for (const review of [...reviews].sort((a, b) => reviewTime(a) - reviewTime(b))) {
    const login = review.user?.login;
    if (!login || login.toLowerCase() === authorLower) continue;
    latest.set(login.toLowerCase(), review);
  }
  return latest;
}

export function quotaAllowed(config: LoopConfig, accepted: number): number {
  return Math.min(config.quota.cap, config.quota.new_creator + config.quota.per_accepted * accepted);
}

export function quotaOverflow(items: { number: number; createdAt: string }[], allowed: number): Set<number> {
  const ordered = [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.number - b.number);
  return new Set(ordered.slice(allowed).map((item) => item.number));
}

function reviewTime(review: Review): number {
  return review.submitted_at ? Date.parse(review.submitted_at) : review.id ?? 0;
}

function shortDescription(rules: RuleResult[]): string {
  const first = rules.find((rule) => rule.state === 'fail') ?? rules.find((rule) => rule.state === 'pending');
  if (!first) return 'Ready to merge';
  if (first.name === 'Approvals') return first.text.split(';')[0]!.slice(0, 139);
  return first.text.slice(0, 139);
}

function pass(name: string, text: string): RuleResult {
  return { name, state: 'pass', text };
}

function pending(name: string, text: string): RuleResult {
  return { name, state: 'pending', text };
}

function fail(name: string, text: string): RuleResult {
  return { name, state: 'fail', text };
}
