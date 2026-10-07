/** Selects supported requests and supplies the shared request-board link. */
import type { Issue } from './types';

export function requestsToOpen(issues: Issue[], threshold: number): Issue[] {
  return issues.filter((issue) => (issue.reactions?.['+1'] ?? 0) >= threshold && !issue.labels.some((label) => label.name === 'open call'));
}

export function requestBoardUrl(repository: string): string {
  const query = encodeURIComponent('is:issue is:open label:request sort:reactions-+1-desc');
  return `https://github.com/${repository}/issues?q=${query}`;
}
