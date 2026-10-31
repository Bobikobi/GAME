/** Covers request selection, proposal metadata, and every merge-rule outcome. */
import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/loop/config';
import { evaluateMerge, quotaAllowed, quotaOverflow, type MergeInput } from '../../src/loop/merge';
import { answeredRequest, collectSlots, competingGroups, competitionRule } from '../../src/loop/proposals';
import { requestBoardUrl, requestsToOpen } from '../../src/loop/requests';
import { isProposal } from '../../src/loop/run';
import type { Issue } from '../../src/loop/types';
import { config } from './helpers';

describe('requests and proposal metadata', () => {
  it('selects only supported requests that are not already open calls', () => {
    const issues = [issue(1, 5), issue(2, 4), issue(3, 20, ['open call'])];
    expect(requestsToOpen(issues, 5).map((item) => item.number)).toEqual([1]);
    expect(requestBoardUrl('mist/vale')).toContain('sort%3Areactions-%2B1-desc');
  });

  it('finds the first answered request and place slots at any depth', () => {
    expect(answeredRequest('Hello\nFixes #42\nAnswers #99')).toBe(42);
    expect(collectSlots({ node: { place: { slot: 'west' } }, nested: [{ place: { slot: 'ruins' } }] })).toEqual(['ruins', 'west']);
  });

  it('drops slot names that are not plain ids, since they are quoted in a bot comment', () => {
    const value = [{ place: { slot: 'core/west-gate' } }, { place: { slot: '`x` @someone' } }, { place: { slot: '' } }, { place: { slot: 'a'.repeat(81) } }];
    expect(collectSlots(value)).toEqual(['core/west-gate']);
  });

  it('detects competition by slot and by request, including connected groups', () => {
    const groups = competingGroups([
      { number: 1, slots: ['west'] },
      { number: 2, slots: ['west'], request: 9 },
      { number: 3, slots: ['river'], request: 9 },
      { number: 4, slots: ['hill'] },
    ]);
    expect(groups.map((group) => group.map((item) => item.number))).toEqual([[1, 2, 3]]);
  });

  it('lets a single ready competitor enter and sends two ready proposals to a vote', () => {
    expect(competitionRule(1, [1], [])).toEqual(expect.objectContaining({ state: 'pass' }));
    expect(competitionRule(2, [1], [])).toBeUndefined();
    expect(competitionRule(1, [1, 2], [], 55)).toEqual(expect.objectContaining({ state: 'fail', text: 'Waiting for the vote in #55' }));
    expect(competitionRule(1, [1, 2], ['vote won'], 55)).toBeUndefined();
  });
});

describe('merge rule', () => {
  it('is ready when every rule passes', () => {
    const result = evaluateMerge(base());
    expect(result.ready).toBe(true);
    expect(result.state).toBe('success');
    expect(result.description).toBe('Ready to merge');
  });

  it.each([
    ['files', { files: ['game/src/main.ts'] }, 'Files outside your own folders'],
    ['failed check', { checks: [{ name: config.required_checks[0]!, status: 'completed', conclusion: 'failure' }] }, 'Checks failed'],
    ['change request', { reviews: [...base().reviews, review('dana', 'CHANGES_REQUESTED')] }, 'A reviewer reported a problem'],
    ['veto', { labels: ['veto'] }, 'Vetoed by a maintainer'],
    ['quota', { quotaPassing: 2, overQuota: true }, 'Over the submission quota'],
    ['lost vote', { labels: ['vote lost'] }, 'This proposal lost its vote'],
  ])('blocks on %s', (_name, change, message) => {
    const result = evaluateMerge({ ...base(), ...change } as MergeInput);
    expect(result.ready).toBe(false);
    expect(result.state).toBe('failure');
    expect(result.rules.some((rule) => rule.text.includes(message))).toBe(true);
  });

  it('keeps missing checks and approvals pending', () => {
    const missingCheck = evaluateMerge({ ...base(), checks: [] });
    expect(missingCheck.state).toBe('pending');
    expect(missingCheck.rules).toContainEqual(expect.objectContaining({ text: expect.stringContaining('Checks pending') }));
    const approvals = evaluateMerge({ ...base(), reviews: [review('bob', 'APPROVED')] });
    expect(approvals.state).toBe('pending');
    expect(approvals.description).toBe('1 of 3 approvals');
  });

  it('reports approvals on an older head without counting them', () => {
    const result = evaluateMerge({ ...base(), reviews: [review('bob', 'APPROVED', 'old'), review('cara', 'APPROVED'), review('dana', 'APPROVED')] });
    expect(result.approvalCount).toBe(2);
    expect(result.rules).toContainEqual(expect.objectContaining({ text: expect.stringContaining('1 approvals on an older commit') }));
  });

  it('uses only each reviewer latest state and ignores the author', () => {
    const result = evaluateMerge({
      ...base(),
      reviews: [
        review('bob', 'CHANGES_REQUESTED', 'head', 1),
        review('bob', 'APPROVED', 'head', 2),
        review('Alice', 'CHANGES_REQUESTED', 'head', 3),
        review('cara', 'APPROVED'),
        review('dana', 'APPROVED'),
      ],
    });
    expect(result.ready).toBe(true);
  });

  it('calculates quota growth and its cap', () => {
    expect(quotaAllowed(config, 0)).toBe(1);
    expect(quotaAllowed(config, 2)).toBe(3);
    expect(quotaAllowed(config, 100)).toBe(5);
    expect([...quotaOverflow([
      { number: 3, createdAt: '2026-03-01T00:00:00Z' },
      { number: 1, createdAt: '2026-01-01T00:00:00Z' },
      { number: 2, createdAt: '2026-02-01T00:00:00Z' },
    ], 2)]).toEqual([3]);
  });

  it('validates configuration with readable errors', () => {
    expect(validateConfig(config)).toEqual(config);
    expect(() => validateConfig({ ...config, vote_days: 0 })).toThrow('vote_days must be a positive integer');
  });
});

function base(): MergeInput {
  return {
    author: 'Alice',
    headSha: 'head',
    files: ['content/extensions/alice/fruit.json', 'content/kit/alice/items/fruit.png'],
    labels: [],
    checks: [{ name: config.required_checks[0]!, status: 'completed', conclusion: 'success' }],
    reviews: [review('bob', 'APPROVED'), review('cara', 'APPROVED'), review('dana', 'APPROVED')],
    accepted: 0,
    quotaPassing: 1,
    overQuota: false,
    config,
  };
}

function review(login: string, state: string, commit = 'head', id = 1) {
  return { user: { login }, state, commit_id: commit, submitted_at: `2026-01-0${id}T00:00:00Z`, id };
}

function issue(number: number, support: number, labels: string[] = []): Issue {
  return {
    number,
    title: `Request ${number}`,
    body: '',
    html_url: `https://github.test/issues/${number}`,
    created_at: '2026-01-01T00:00:00Z',
    labels: labels.map((name) => ({ name })),
    user: { login: 'player' },
    reactions: { '+1': support },
  };
}

describe('who proposes', () => {
  const edit = [{ filename: 'content/extensions/fig/tree.json', status: 'modified' }];
  const add = [{ filename: 'content/extensions/fig/tree.json', status: 'added' }];

  it('a builder account that edits an extension (#509 declaring the fig scale) is not a proposal', () => {
    expect(isProposal('Bobikobi', edit)).toBe(false);
    expect(isProposal('claude', edit)).toBe(false);
  });

  it('a builder that adds a file under an extension, and any creator who touches one, is a proposal', () => {
    expect(isProposal('Bobikobi', add)).toBe(true);
    expect(isProposal('alice', edit)).toBe(true);
  });

  it('a pull request that touches no extension path is never one', () => {
    expect(isProposal('alice', [{ filename: 'game/src/x.ts', status: 'added' }])).toBe(false);
  });
});
