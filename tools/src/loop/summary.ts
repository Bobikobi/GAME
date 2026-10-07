/** Renders the weekly community summary from already collected plain data. */
import { requestBoardUrl } from './requests';

export interface SummaryLink {
  number: number;
  title: string;
  url: string;
}

export interface SummaryRequest extends SummaryLink {
  support: number;
}

export interface SummaryProposal extends SummaryLink {
  author: string;
  approvals: number;
}

export interface MergedProposal extends SummaryLink {
  author: string;
  reviewers: string[];
}

export interface SummaryVote extends SummaryLink {
  display: string;
}

export interface SummaryData {
  repository: string;
  week: string;
  newRequests: SummaryRequest[];
  topRequests: SummaryRequest[];
  openCalls: SummaryRequest[];
  capabilities: SummaryRequest[];
  waiting: SummaryProposal[];
  ready: SummaryProposal[];
  votes: SummaryVote[];
  merged: MergedProposal[];
}

export function renderSummary(data: SummaryData): string {
  const lines = [`# Weekly summary: ${data.week}`, ''];
  section(lines, 'New requests this week', data.newRequests.map(requestLine));
  section(lines, 'Top open requests', data.topRequests.slice(0, 10).map(requestLine));
  section(lines, 'Open calls', data.openCalls.map(linkLine));
  section(lines, 'Requested capabilities', data.capabilities.map(linkLine));
  section(lines, 'Waiting for reviewers', data.waiting.map((item) => `${linkLine(item)} - ${item.approvals} approval${item.approvals === 1 ? '' : 's'}`));
  section(lines, 'Ready to merge', data.ready.map(linkLine));
  lines.push('## Open votes', '');
  if (data.votes.length === 0) lines.push('Nothing this week.', '');
  else for (const vote of data.votes) lines.push(`### [${vote.title}](${vote.url})`, '', vote.display, '');
  section(lines, 'Merged this week', data.merged.map((item) => {
    const credit = item.reviewers.length > 0 ? `; reviewed by ${item.reviewers.map((name) => `@${name}`).join(', ')}` : '';
    return `${linkLine(item)} - by @${item.author}${credit}`;
  }));
  lines.push(`[See the request board](${requestBoardUrl(data.repository)})`, '');
  return lines.join('\n');
}

export function isoWeek(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function section(lines: string[], title: string, items: string[]): void {
  lines.push(`## ${title}`, '', ...(items.length > 0 ? items : ['Nothing this week.']), '');
}

function requestLine(item: SummaryRequest): string {
  return `${linkLine(item)} - 👍 ${item.support}`;
}

function linkLine(item: SummaryLink): string {
  return `- [#${item.number} ${item.title}](${item.url})`;
}
