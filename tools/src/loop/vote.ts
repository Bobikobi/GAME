/** Pure vote counting, private-result display, markers, option comments, and close decisions. */
import type { Comment, Issue, Reaction } from './types';

export interface VoteOption {
  key: string;
  label: string;
  reactions: Reaction[];
}

export interface CountedOption {
  key: string;
  label: string;
  votes: number;
}

export interface AccountDate {
  login: string;
  createdAt: string;
}

export interface VoteMarker {
  closes: string;
  group: string;
  kind: 'proposals' | 'discovery';
  /** the keys of the option comments the loop posted when it opened the vote; absent on votes opened before 27.10.2026 */
  options?: string[];
}

export function countVotes(options: VoteOption[], accounts: AccountDate[], openedAt: Date, minimumAgeDays: number): CountedOption[] {
  const accountMap = new Map(accounts.map((account) => [account.login.toLowerCase(), account]));
  const first = new Map<string, { option: string; at: number }>();
  for (const option of options) {
    for (const reaction of option.reactions) {
      const login = reaction.user.login.toLowerCase();
      if (reaction.user.type === 'Bot') continue;
      const account = accountMap.get(login);
      if (!account || openedAt.getTime() - Date.parse(account.createdAt) < minimumAgeDays * 86_400_000) continue;
      const at = Date.parse(reaction.created_at);
      const old = first.get(login);
      if (!old || at < old.at || (at === old.at && option.key < old.option)) first.set(login, { option: option.key, at });
    }
  }
  return options.map((option) => ({
    key: option.key,
    label: option.label,
    votes: [...first.values()].filter((choice) => choice.option === option.key).length,
  }));
}

export function showResults(options: CountedOption[], minimumForPercent: number): string {
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const max = Math.max(1, ...options.map((option) => option.votes));
  const lines = options.map((option) => {
    if (total >= minimumForPercent) {
      const percent = total === 0 ? 0 : Math.round(option.votes * 100 / total);
      return `- ${option.label}: ${percent}%`;
    }
    const filled = option.votes === 0 ? 0 : Math.max(1, Math.round(option.votes * 10 / max));
    return `- ${option.label}: ${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
  });
  return lines.join('\n');
}

export function decideVote(options: CountedOption[], minimum: number): { kind: 'open' | 'postpone' | 'winner'; winner?: string; reason?: string } {
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  if (total < minimum) return { kind: 'postpone', reason: 'The vote did not reach the minimum participation.' };
  const highest = Math.max(0, ...options.map((option) => option.votes));
  const leaders = options.filter((option) => option.votes === highest);
  if (leaders.length !== 1) return { kind: 'postpone', reason: 'The vote ended in a tie.' };
  return { kind: 'winner', winner: leaders[0]!.key };
}

export function voteMarker(marker: VoteMarker): string {
  return `<!-- loop:vote ${JSON.stringify(marker)} -->`;
}

export function parseVoteMarker(body: string | null): VoteMarker | undefined {
  const match = body?.match(/<!-- loop:vote (\{[^\n]+\}) -->/);
  if (!match) return undefined;
  try {
    const value = JSON.parse(match[1]!) as VoteMarker;
    const options = value.options === undefined || (Array.isArray(value.options) && value.options.every((key) => typeof key === 'string'));
    if ((value.kind === 'proposals' || value.kind === 'discovery') && typeof value.closes === 'string' && typeof value.group === 'string' && options) return value;
  } catch {
    return undefined;
  }
  return undefined;
}

export function replaceResults(body: string | null, results: string): string {
  const block = `<!-- loop:results -->\n${results}\n<!-- /loop:results -->`;
  const text = body ?? '';
  if (/<!-- loop:results -->[\s\S]*?<!-- \/loop:results -->/.test(text)) {
    return text.replace(/<!-- loop:results -->[\s\S]*?<!-- \/loop:results -->/, block);
  }
  return `${text.trimEnd()}\n\n${block}\n`;
}

export function optionKey(body: string): string | undefined {
  return body.match(/<!-- loop:option:([^ ]+) -->/)?.[1];
}

/**
 * The key of the option a comment is, or undefined for any other comment. An option is a comment the loop
 * itself posted when it opened the vote: written by the vote's own author, under one of the keys the marker
 * recorded at the opening. A comment anyone else writes with the marker in it is a reply, not an option: it
 * adds no choice, counts no reaction and labels nothing. A vote opened before the marker held its keys has
 * the author rule alone.
 */
export function optionOf(comment: Comment, issue: Issue, marker: VoteMarker | undefined): string | undefined {
  const key = optionKey(comment.body);
  if (key === undefined) return undefined;
  if (comment.user?.login.toLowerCase() !== issue.user.login.toLowerCase()) return undefined;
  if (marker?.options && !marker.options.includes(key)) return undefined;
  return key;
}
