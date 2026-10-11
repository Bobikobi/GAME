/** Selects supported requests and supplies the shared request-board link. */
import type { Issue } from './types';

/** A request's support: the thumbs up on its first post. */
export function support(issue: Issue): number {
  return issue.reactions?.['+1'] ?? 0;
}

export function requestsToOpen(issues: Issue[], threshold: number): Issue[] {
  return issues.filter((issue) => support(issue) >= threshold && !issue.labels.some((label) => label.name === 'open call'));
}

export function requestBoardUrl(repository: string): string {
  const query = encodeURIComponent('is:issue is:open label:request sort:reactions-+1-desc');
  return `https://github.com/${repository}/issues?q=${query}`;
}
