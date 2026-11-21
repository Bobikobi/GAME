/** Runs the community loop against a replaceable GitHub client. */
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { LoopConfig } from './config';
import type { LoopClient } from './github';
import { evaluateMerge, quotaAllowed, quotaOverflow, type MergeEvaluation, type RuleResult } from './merge';
import { answeredRequest, collectSlots, competingGroups, competitionRule, groupKey, groupTitle, type ProposalIdentity } from './proposals';
import { requestBoardUrl, requestsToOpen, support } from './requests';
import { isoWeek, renderSummary, type SummaryData } from './summary';
import type { Account, ChangedFile, CheckRun, Comment, Issue, PullRequest, Reaction, Review } from './types';
import {
  countVotes,
  decideVote,
  optionOf,
  parseVoteMarker,
  replaceResults,
  showResults,
  voteMarker,
  type AccountDate,
  type CountedOption,
  type VoteOption,
} from './vote';

const LABELS: Record<string, { description: string; color: string }> = {
  request: { description: 'A request from the community', color: 'bfdadc' },
  'open call': { description: 'A supported request that creators may answer', color: '0e8a16' },
  capability: { description: 'An open call that needs core code', color: '5319e7' },
  proposal: { description: 'A content proposal for the valley', color: '1d76db' },
  competing: { description: 'A proposal sharing a request or slot', color: 'fbca04' },
  vote: { description: 'A community vote', color: 'd4c5f9' },
  'vote won': { description: 'The proposal selected by a vote', color: '0e8a16' },
  'vote lost': { description: 'A proposal not selected by a vote', color: 'b60205' },
  veto: { description: 'A maintainer veto under the contribution rules', color: 'b60205' },
  'weekly summary': { description: 'The weekly community loop report', color: 'c5def5' },
  'next discovery': { description: 'A vote for the next discovery', color: 'f9d0c4' },
};

export interface RunOptions {
  client: LoopClient;
  repository: string;
  config: LoopConfig;
  now: Date;
  log?: (line: string) => void;
  discoveryDir?: string;
  stepSummary?: string;
}

export interface ProposalState extends ProposalIdentity {
  pr: PullRequest;
  files: string[];
  checks: CheckRun[];
  reviews: Review[];
  evaluation: MergeEvaluation;
  competitors: number[];
  voteIssue?: number;
}

export async function ensureLabels(options: RunOptions): Promise<void> {
  const existing = new Set((await options.client.list<{ name: string }>(repoPath(options, '/labels?per_page=100'))).map((label) => label.name));
  for (const [name, details] of Object.entries(LABELS)) {
    if (!existing.has(name)) await options.client.write('POST', repoPath(options, '/labels'), { name, ...details });
  }
}

export async function runRequests(options: RunOptions): Promise<void> {
  const issues = (await options.client.list<Issue>(repoPath(options, '/issues?state=open&labels=request&per_page=100')))
    .filter((issue) => !issue.pull_request);
  for (const issue of requestsToOpen(issues, options.config.open_call_votes)) {
    await addLabels(options, issue.number, ['open call']);
    const body = [
      `This request is now an open call. Any creator may answer it with a pull request that says \`Answers #${issue.number}\`. Competing proposals are welcome.`,
      '',
      `[See all open requests, sorted by support.](${requestBoardUrl(options.repository)})`,
    ].join('\n');
    await options.client.write('POST', repoPath(options, `/issues/${issue.number}/comments`), { body });
  }
}

export async function runProposals(options: RunOptions): Promise<ProposalState[]> {
  const states = await collectProposals(options);
  const voteIssues = await openVoteIssues(options);
  await applyCompetition(options, states, voteIssues, true);
  for (const proposal of states) await reportProposal(options, proposal);
  return states;
}

export async function applyCompetition(options: RunOptions, states: ProposalState[], voteIssues: Issue[], writeLabels: boolean): Promise<void> {
  for (const group of competingGroups(states)) {
    const key = groupKey(group);
    const vote = voteIssues.find((item) => parseVoteMarker(item.body)?.group === key);
    const otherwiseReady = group.filter((item) => state(states, item.number).evaluation.ready);
    for (const member of group) {
      const current = state(states, member.number);
      current.competitors = group.filter((item) => item.number !== member.number).map((item) => item.number);
      current.voteIssue = vote?.number;
      if (writeLabels && !current.pr.labels.some((label) => label.name === 'competing')) await addLabels(options, current.number, ['competing']);
      const rule = competitionRule(member.number, otherwiseReady.map((item) => item.number), current.pr.labels.map((label) => label.name), vote?.number);
      if (rule) current.evaluation = withRule(current.evaluation, rule);
    }
  }
}

export async function runVotes(options: RunOptions): Promise<void> {
  const proposals = await collectProposals(options);
  let open = await openVoteIssues(options);
  const accounts = new Map<string, AccountDate>();
  for (const group of competingGroups(proposals)) {
    const ready = group.filter((item) => state(proposals, item.number).evaluation.ready);
    const key = groupKey(group);
    if (ready.length < 2 || open.some((issue) => parseVoteMarker(issue.body)?.group === key)) continue;
    const closes = new Date(options.now.getTime() + options.config.vote_days * 86_400_000).toISOString();
    const body = proposalVoteBody(key, closes, options.config, ready.map((member) => String(member.number)));
    const created = await options.client.write<Issue>('POST', repoPath(options, '/issues'), {
      title: `Vote: ${groupTitle(group)}`,
      body,
      labels: ['vote'],
    });
    if (created) {
      for (const member of ready) {
        const proposal = state(proposals, member.number);
        await options.client.write('POST', repoPath(options, `/issues/${created.number}/comments`), {
          body: `<!-- loop:option:${proposal.number} -->\n## ${proposal.pr.title}\n\nBy @${proposal.pr.user.login}. [Open proposal #${proposal.number}](${proposal.pr.html_url}) and react 👍 to this comment to choose it.`,
        });
      }
      open = [...open, created];
    } else if (options.client.dryRun) {
      for (const member of ready) {
        const proposal = state(proposals, member.number);
        await options.client.write('POST', repoPath(options, '/issues/{new-vote}/comments'), {
          body: `<!-- loop:option:${proposal.number} -->\n## ${proposal.pr.title}\n\nBy @${proposal.pr.user.login}. [Open proposal #${proposal.number}](${proposal.pr.html_url}) and react 👍 to this comment to choose it.`,
        });
      }
    }
  }
  for (const issue of open) await updateVote(options, issue, accounts);
  if (!options.client.dryRun) {
    const refreshed = await collectProposals(options);
    await applyCompetition(options, refreshed, await openVoteIssues(options), true);
    for (const proposal of refreshed) await reportProposal(options, proposal);
  }
}

export async function runDiscovery(options: RunOptions): Promise<void> {
  const open = await openVoteIssues(options);
  if (open.some((issue) => issue.labels.some((label) => label.name === 'next discovery'))) return;
  const dir = options.discoveryDir ?? join(process.cwd(), 'docs', 'loop', 'discovery');
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.md')).sort() : [];
  if (files.length === 0) {
    (options.log ?? console.log)('No discovery files found in docs/loop/discovery; no vote opened.');
    return;
  }
  const repository = await options.client.get<{ default_branch: string }>(repoPath(options, ''));
  const closes = new Date(options.now.getTime() + options.config.vote_days * 86_400_000).toISOString();
  const body = discoveryVoteBody(closes, options.config, files.map((file) => basename(file, '.md')));
  const created = await options.client.write<Issue>('POST', repoPath(options, '/issues'), {
    title: 'Vote: the next discovery',
    body,
    labels: ['vote', 'next discovery'],
  });
  const issueNumber: number | string | undefined = created?.number ?? (options.client.dryRun ? '{new-vote}' : undefined);
  if (issueNumber === undefined) return;
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    const title = text.match(/^#\s+(.+)$/m)?.[1] ?? basename(file, '.md');
    const paragraph = firstParagraph(text);
    const key = basename(file, '.md');
    const url = `https://github.com/${options.repository}/blob/${repository.default_branch}/docs/loop/discovery/${file}`;
    await options.client.write('POST', repoPath(options, `/issues/${issueNumber}/comments`), {
      body: `<!-- loop:option:${key} -->\n## ${title}\n\n${paragraph}\n\n[Read this discovery](${url}) and react 👍 to this comment to choose it.`,
    });
  }
}

export async function runSummary(options: RunOptions, post: boolean): Promise<string> {
  const start = new Date(options.now.getTime() - 7 * 86_400_000);
  const issues = (await options.client.list<Issue>(repoPath(options, '/issues?state=open&per_page=100'))).filter((issue) => !issue.pull_request);
  const requests = issues.filter((issue) => hasLabel(issue, 'request'));
  const proposalStates = await collectProposals(options, false);
  const votes = issues.filter((issue) => hasLabel(issue, 'vote'));
  await applyCompetition(options, proposalStates, votes, false);
  const voteDisplays = [];
  const accounts = new Map<string, AccountDate>();
  for (const issue of votes) voteDisplays.push({ ...link(issue), display: (await readVote(options, issue, accounts)).display });
  const closed = await options.client.list<PullRequest>(repoPath(options, '/pulls?state=closed&sort=updated&direction=desc&per_page=100'));
  const merged = [];
  for (const pr of closed.filter((item) => item.merged_at && Date.parse(item.merged_at) >= start.getTime() && hasLabel(item, 'proposal'))) {
    const reviews = await options.client.list<Review>(repoPath(options, `/pulls/${pr.number}/reviews?per_page=100`));
    const reviewers = [...new Set(reviews.filter((review) => review.state === 'APPROVED' && review.user).map((review) => review.user!.login))];
    merged.push({ ...link(pr), author: pr.user.login, reviewers });
  }
  const data: SummaryData = {
    repository: options.repository,
    week: isoWeek(options.now),
    newRequests: requests.filter((issue) => Date.parse(issue.created_at) >= start.getTime()).map(summaryRequest),
    topRequests: requests.map(summaryRequest).sort((a, b) => b.support - a.support || a.number - b.number),
    openCalls: requests.filter((issue) => hasLabel(issue, 'open call')).map(summaryRequest),
    capabilities: requests.filter((issue) => hasLabel(issue, 'open call') && hasLabel(issue, 'capability')).map(summaryRequest),
    waiting: proposalStates.filter((item) => item.evaluation.approvalCount < options.config.approvals_to_merge).map(summaryProposal),
    ready: proposalStates.filter((item) => item.evaluation.ready).map(summaryProposal),
    votes: voteDisplays,
    merged,
  };
  const markdown = renderSummary(data);
  if (post) {
    const older = issues.filter((issue) => hasLabel(issue, 'weekly summary'));
    const title = `Weekly summary: ${data.week}`;
    const current = older.find((issue) => issue.title === title);
    for (const issue of older.filter((item) => item.number !== current?.number)) {
      await options.client.write('PATCH', repoPath(options, `/issues/${issue.number}`), { state: 'closed', state_reason: 'completed' });
    }
    if (current) await options.client.write('PATCH', repoPath(options, `/issues/${current.number}`), { body: markdown });
    else await options.client.write('POST', repoPath(options, '/issues'), { title, body: markdown, labels: ['weekly summary'] });
  } else (options.log ?? console.log)(markdown);
  if (options.stepSummary) appendFileSync(options.stepSummary, `${markdown}\n`);
  return markdown;
}

export async function runAll(options: RunOptions): Promise<void> {
  await ensureLabels(options);
  await runRequests(options);
  await runProposals(options);
  await runVotes(options);
}

export async function collectProposals(options: RunOptions, addProposalLabels = true): Promise<ProposalState[]> {
  const pulls = await options.client.list<PullRequest>(repoPath(options, '/pulls?state=open&per_page=100'));
  const raw: Omit<ProposalState, 'evaluation'>[] = [];
  for (const pr of pulls.filter((item) => !item.draft)) {
    const changed = await options.client.list<ChangedFile>(repoPath(options, `/pulls/${pr.number}/files?per_page=100`));
    const files = changed.map((file) => file.filename);
    if (!isProposal(pr.user.login, changed)) continue;
    if (addProposalLabels && !hasLabel(pr, 'proposal')) await addLabels(options, pr.number, ['proposal']);
    const slots = new Set<string>();
    for (const file of files.filter((path) => path.endsWith('.json') && path.startsWith('content/extensions/'))) {
      if (!pr.head.repo) throw new Error(`Cannot read proposal #${pr.number}: its head repository is unavailable.`);
      const content = await options.client.get<{ content: string; encoding: string }>(`/repos/${pr.head.repo.full_name}/contents/${encodePath(file)}?ref=${encodeURIComponent(pr.head.sha)}`);
      const text = content.encoding === 'base64' ? Buffer.from(content.content.replace(/\n/g, ''), 'base64').toString('utf8') : content.content;
      for (const slot of collectSlots(JSON.parse(text) as unknown)) slots.add(slot);
    }
    const checkResponse = await options.client.get<{ check_runs: CheckRun[] }>(repoPath(options, `/commits/${pr.head.sha}/check-runs?per_page=100`));
    const reviews = await options.client.list<Review>(repoPath(options, `/pulls/${pr.number}/reviews?per_page=100`));
    raw.push({
      number: pr.number,
      pr,
      slots: [...slots].sort(),
      request: answeredRequest(pr.body),
      files,
      checks: checkResponse.check_runs,
      reviews,
      competitors: [],
    });
  }
  const accepted = new Map<string, number>();
  for (const author of new Set(raw.map((item) => item.pr.user.login.toLowerCase()))) {
    const q = encodeURIComponent(`repo:${options.repository} is:pr is:merged label:proposal author:${author}`);
    const result = await options.client.get<{ total_count: number }>(`/search/issues?q=${q}&per_page=1`);
    accepted.set(author, result.total_count);
  }
  const checkPassed = (item: Omit<ProposalState, 'evaluation'>) => options.config.required_checks.every((name) => item.checks.some((check) => check.name === name && check.status === 'completed' && check.conclusion === 'success'));
  const passingByAuthor = new Map<string, Omit<ProposalState, 'evaluation'>[]>();
  for (const item of raw.filter(checkPassed)) {
    const author = item.pr.user.login.toLowerCase();
    passingByAuthor.set(author, [...(passingByAuthor.get(author) ?? []), item]);
  }
  const overflowByAuthor = new Map<string, Set<number>>();
  for (const [author, list] of passingByAuthor) {
    const allowed = quotaAllowed(options.config, accepted.get(author) ?? 0);
    overflowByAuthor.set(author, quotaOverflow(list.map((item) => ({ number: item.number, createdAt: item.pr.created_at })), allowed));
  }
  return raw.map((item) => {
    const author = item.pr.user.login.toLowerCase();
    const acceptedCount = accepted.get(author) ?? 0;
    const passing = passingByAuthor.get(author) ?? [];
    return {
      ...item,
      evaluation: evaluateMerge({
        author: item.pr.user.login,
        headSha: item.pr.head.sha,
        files: item.files,
        labels: item.pr.labels.map((label) => label.name),
        checks: item.checks,
        reviews: item.reviews,
        accepted: acceptedCount,
        quotaPassing: passing.length,
        overQuota: overflowByAuthor.get(author)?.has(item.number) ?? false,
        config: options.config,
      }),
    };
  });
}

async function reportProposal(options: RunOptions, proposal: ProposalState): Promise<void> {
  // post a status and touch the comment only when they change, so an hourly run stays quiet
  const description = proposal.evaluation.description.slice(0, 139);
  const combined = await options.client.get<{ statuses?: { context: string; state: string; description: string | null }[] }>(repoPath(options, `/commits/${proposal.pr.head.sha}/status`));
  const last = combined.statuses?.find((status) => status.context === 'merge rule');
  if (last?.state !== proposal.evaluation.state || last.description !== description) {
    await options.client.write('POST', repoPath(options, `/statuses/${proposal.pr.head.sha}`), {
      state: proposal.evaluation.state,
      context: 'merge rule',
      description,
    });
  }
  const marker = '<!-- loop:merge-rule -->';
  const body = renderMergeComment(proposal);
  const comments = await options.client.list<Comment>(repoPath(options, `/issues/${proposal.number}/comments?per_page=100`));
  const old = comments.find((comment) => comment.body.includes(marker));
  if (old) {
    if (old.body !== body) await options.client.write('PATCH', repoPath(options, `/issues/comments/${old.id}`), { body });
  }
  else await options.client.write('POST', repoPath(options, `/issues/${proposal.number}/comments`), { body });
}

function renderMergeComment(proposal: ProposalState): string {
  const icon = { pass: '✅', pending: '⏳', fail: '❌' } as const;
  const lines = ['<!-- loop:merge-rule -->', '## Merge rule', '', ...proposal.evaluation.rules.map((rule) => `- ${icon[rule.state]} **${rule.name}:** ${rule.text}`), ''];
  lines.push(`**Slots:** ${proposal.slots.length > 0 ? proposal.slots.map((slot) => `\`${slot}\``).join(', ') : 'None found'}`);
  lines.push(`**Request:** ${proposal.request === undefined ? 'None linked' : `#${proposal.request}`}`);
  lines.push(`**Competing proposals:** ${proposal.competitors.length > 0 ? proposal.competitors.map((number) => `#${number}`).join(', ') : 'None'}`);
  return `${lines.join('\n')}\n`;
}

async function openVoteIssues(options: RunOptions): Promise<Issue[]> {
  return (await options.client.list<Issue>(repoPath(options, '/issues?state=open&labels=vote&per_page=100'))).filter((issue) => !issue.pull_request);
}

async function updateVote(options: RunOptions, issue: Issue, accounts: Map<string, AccountDate>): Promise<void> {
  const marker = parseVoteMarker(issue.body);
  if (!marker) return;
  const counted = await readVote(options, issue, accounts);
  const closed = options.now.getTime() >= Date.parse(marker.closes);
  const decision = closed ? decideVote(counted.options, options.config.min_votes_to_decide) : { kind: 'open' as const };
  const display = closed ? showResults(counted.options, 0) : counted.display;
  const body = replaceResults(issue.body, display);
  if (body !== issue.body) await options.client.write('PATCH', repoPath(options, `/issues/${issue.number}`), { body });
  if (!closed) return;
  if (decision.kind === 'postpone') {
    await options.client.write('POST', repoPath(options, `/issues/${issue.number}/comments`), { body: `${decision.reason} The choice is postponed; nobody wins by default.` });
    await options.client.write('PATCH', repoPath(options, `/issues/${issue.number}`), { state: 'closed', state_reason: 'not_planned', body });
    return;
  }
  if (decision.kind !== 'winner' || !decision.winner) return;
  if (marker.kind === 'proposals') {
    for (const option of counted.options) {
      const number = Number(option.key);
      if (!Number.isInteger(number)) continue;
      if (option.key === decision.winner) await addLabels(options, number, ['vote won']);
      else {
        await addLabels(options, number, ['vote lost']);
        await options.client.write('POST', repoPath(options, `/issues/${number}/comments`), {
          body: 'Thank you for this proposal. Its extension stays in the proposals archive and may compete for another slot later.',
        });
      }
    }
  } else {
    const winner = counted.options.find((option) => option.key === decision.winner)?.label ?? decision.winner;
    await options.client.write('POST', repoPath(options, `/issues/${issue.number}/comments`), { body: `The community chose **${winner}** as the next discovery.` });
  }
  await options.client.write('PATCH', repoPath(options, `/issues/${issue.number}`), { state: 'closed', state_reason: 'completed', body });
}

export async function readVote(options: RunOptions, issue: Issue, users: Map<string, AccountDate>): Promise<{ options: CountedOption[]; display: string }> {
  const marker = parseVoteMarker(issue.body);
  const comments = await options.client.list<Comment>(repoPath(options, `/issues/${issue.number}/comments?per_page=100`));
  const voteOptions: VoteOption[] = [];
  for (const comment of comments) {
    const key = optionOf(comment, issue, marker);
    // the loop posts each option once; a later comment under a key the vote already has is not a second option
    if (key === undefined || voteOptions.some((option) => option.key === key)) continue;
    voteOptions.push({
      key,
      label: comment.body.match(/^##\s+(.+)$/m)?.[1] ?? key,
      reactions: await options.client.list<Reaction>(repoPath(options, `/issues/comments/${comment.id}/reactions?content=%2B1&per_page=100`)),
    });
  }
  for (const reaction of voteOptions.flatMap((option) => option.reactions)) {
    const login = reaction.user.login.toLowerCase();
    if (reaction.user.type === 'Bot' || users.has(login)) continue;
    const account = await options.client.get<Account>(`/users/${encodeURIComponent(reaction.user.login)}`);
    users.set(login, { login: account.login, createdAt: account.created_at });
  }
  const counted = countVotes(voteOptions, [...users.values()], new Date(issue.created_at), options.config.min_account_age_days);
  return { options: counted, display: showResults(counted, options.config.min_votes_for_percent) };
}

function proposalVoteBody(group: string, closes: string, config: LoopConfig, voteOptions: string[]): string {
  return [
    `# Choose a proposal`,
    '',
    `React 👍 to one option comment. Your earliest reaction is final. Bot votes and accounts younger than ${config.min_account_age_days} days when this vote opened do not count.`,
    '',
    `The vote closes at ${closes}. It needs ${config.min_votes_to_decide} eligible choices and no tie for first place.`,
    '',
    voteMarker({ closes, group, kind: 'proposals', options: voteOptions }),
    '<!-- loop:results -->',
    'Results will appear here.',
    '<!-- /loop:results -->',
  ].join('\n');
}

function discoveryVoteBody(closes: string, config: LoopConfig, voteOptions: string[]): string {
  return [
    '# Choose the next discovery',
    '',
    `React 👍 to one option comment. Your earliest reaction is final. Bot votes and accounts younger than ${config.min_account_age_days} days when this vote opened do not count.`,
    '',
    `The vote closes at ${closes}. It needs ${config.min_votes_to_decide} eligible choices and no tie for first place.`,
    '',
    voteMarker({ closes, group: 'next-discovery', kind: 'discovery', options: voteOptions }),
    '<!-- loop:results -->',
    'Results will appear here.',
    '<!-- /loop:results -->',
  ].join('\n');
}

function withRule(evaluation: MergeEvaluation, rule: RuleResult): MergeEvaluation {
  const rules = [...evaluation.rules, rule];
  const ready = rules.every((item) => item.state === 'pass');
  const stateValue = ready ? 'success' : rules.some((item) => item.state === 'fail') ? 'failure' : 'pending';
  const blocker = rules.find((item) => item.state === 'fail') ?? rules.find((item) => item.state === 'pending');
  return { ...evaluation, rules, ready, state: stateValue, description: ready ? 'Ready to merge' : (blocker?.text ?? rule.text).split(';')[0]!.slice(0, 139) };
}

function state(states: ProposalState[], number: number): ProposalState {
  const found = states.find((item) => item.number === number);
  if (!found) throw new Error(`Missing proposal #${number}.`);
  return found;
}

/** The repo's own builder accounts: their pull requests edit extensions (a scale, a fix) without proposing content. */
const BUILDERS = ['bobikobi', 'justarandomguyfromtheinternet', 'claude'];

/**
 * A pull request is a proposal when it touches an extension path and its author is not one of the repo's builders,
 * or when it adds a file under an extension (a builder's new extension is a proposal too, an edit to one is not).
 */
export function isProposal(author: string, changed: ChangedFile[]): boolean {
  const touched = changed.filter((file) => isProposalPath(file.filename));
  if (touched.length === 0) return false;
  return !BUILDERS.includes(author.toLowerCase()) || touched.some((file) => file.status === 'added');
}

function isProposalPath(path: string): boolean {
  return path.startsWith('content/extensions/') || (path.startsWith('content/kit/') && !path.startsWith('content/kit/core/'));
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function addLabels(options: RunOptions, number: number, labels: string[]): Promise<void> {
  await options.client.write('POST', repoPath(options, `/issues/${number}/labels`), { labels });
}

function repoPath(options: RunOptions, suffix: string): string {
  return `/repos/${options.repository}${suffix}`;
}

function hasLabel(issue: Issue, name: string): boolean {
  return issue.labels.some((label) => label.name === name);
}

function link(issue: Issue): { number: number; title: string; url: string } {
  return { number: issue.number, title: issue.title, url: issue.html_url };
}

function summaryRequest(issue: Issue) {
  return { ...link(issue), support: support(issue) };
}

function summaryProposal(item: ProposalState) {
  return { ...link(item.pr), author: item.pr.user.login, approvals: item.evaluation.approvalCount };
}

function firstParagraph(text: string): string {
  return text.replace(/^#\s+.+$/m, '').trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() || 'No description yet.';
}
