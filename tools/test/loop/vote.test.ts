/** Covers private interim vote counting, display, option comments, markers, and close decisions. */
import { describe, expect, it } from 'vitest';
import type { Comment, Issue } from '../../src/loop/types';
import { countVotes, decideVote, optionOf, parseVoteMarker, showResults, voteMarker, type VoteOption } from '../../src/loop/vote';

describe('votes', () => {
  const opened = new Date('2026-10-01T00:00:00Z');
  const accounts = [
    { login: 'early', createdAt: '2020-01-01T00:00:00Z' },
    { login: 'single', createdAt: '2020-01-01T00:00:00Z' },
    { login: 'young', createdAt: '2026-09-15T00:00:00Z' },
  ];

  it('counts one earliest reaction and ignores bots and young accounts', () => {
    const options: VoteOption[] = [
      { key: 'a', label: 'Alpha', reactions: [reaction('early', '2026-10-02'), reaction('single', '2026-10-03'), reaction('young', '2026-10-02'), reaction('robot', '2026-10-01', 'Bot')] },
      { key: 'b', label: 'Beta', reactions: [reaction('early', '2026-10-01')] },
    ];
    expect(countVotes(options, accounts, opened, 30)).toEqual([
      { key: 'a', label: 'Alpha', votes: 1 },
      { key: 'b', label: 'Beta', votes: 1 },
    ]);
  });

  it('shows bars before the threshold and percentages after it without a voter count', () => {
    const counted = [{ key: 'a', label: 'Alpha', votes: 2 }, { key: 'b', label: 'Beta', votes: 1 }];
    const bars = showResults(counted, 10);
    expect(bars).toContain('█');
    expect(bars).not.toMatch(/[0-9%]/);
    expect(bars.toLowerCase()).not.toMatch(/votes|voters|people/);
    const percentages = showResults(counted, 3);
    expect(percentages).toContain('Alpha: 67%');
    expect(percentages).toContain('Beta: 33%');
    expect(percentages.toLowerCase()).not.toMatch(/votes|voters|people/);
  });

  it('postpones for too few choices and for a tie', () => {
    expect(decideVote([{ key: 'a', label: 'Alpha', votes: 4 }], 5)).toEqual(expect.objectContaining({ kind: 'postpone', reason: expect.stringContaining('minimum') }));
    expect(decideVote([{ key: 'a', label: 'Alpha', votes: 3 }, { key: 'b', label: 'Beta', votes: 3 }], 5)).toEqual(expect.objectContaining({ kind: 'postpone', reason: expect.stringContaining('tie') }));
  });

  it('selects the sole first-place option', () => {
    expect(decideVote([{ key: 'a', label: 'Alpha', votes: 4 }, { key: 'b', label: 'Beta', votes: 2 }], 5)).toEqual({ kind: 'winner', winner: 'a' });
  });

  it('an option is the vote author\'s own comment under a key the marker lists; anything else is a reply', () => {
    const issue: Issue = { number: 900, title: 'Vote', body: '', html_url: 'u', created_at: '2026-10-07T00:00:00Z', labels: [], user: { login: 'github-actions[bot]', type: 'Bot' } };
    const marker = { closes: '2026-10-14T00:00:00Z', group: 'g', kind: 'proposals' as const, options: ['2', '3'] };
    const own = (key: string): Comment => ({ id: 1, body: `<!-- loop:option:${key} -->\n## Option`, user: { login: 'github-actions[bot]', type: 'Bot' } });
    expect(optionOf(own('2'), issue, marker)).toBe('2');
    expect(optionOf(own('7'), issue, marker)).toBeUndefined();
    expect(optionOf({ ...own('2'), user: { login: 'mallory' } }, issue, marker)).toBeUndefined();
    expect(optionOf({ ...own('2'), user: undefined }, issue, marker)).toBeUndefined();
    expect(optionOf({ id: 2, body: 'A reply, with no marker', user: issue.user }, issue, marker)).toBeUndefined();
    // a vote opened before the marker listed its keys: the author rule alone
    expect(optionOf(own('7'), issue, { ...marker, options: undefined })).toBe('7');
    expect(optionOf({ ...own('7'), user: { login: 'mallory' } }, issue, { ...marker, options: undefined })).toBeUndefined();
  });

  it('the marker carries the option keys, and is no marker with a list that is not one of strings', () => {
    expect(parseVoteMarker(voteMarker({ closes: 'c', group: 'g', kind: 'proposals', options: ['2', '3'] }))).toEqual({ closes: 'c', group: 'g', kind: 'proposals', options: ['2', '3'] });
    expect(parseVoteMarker('<!-- loop:vote {"closes":"c","group":"g","kind":"discovery"} -->')).toEqual({ closes: 'c', group: 'g', kind: 'discovery' });
    expect(parseVoteMarker('<!-- loop:vote {"closes":"c","group":"g","kind":"proposals","options":[2]} -->')).toBeUndefined();
  });
});

function reaction(login: string, day: string, type = 'User') {
  return { user: { login, type }, created_at: `${day}T00:00:00Z` };
}
