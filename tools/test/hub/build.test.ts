/** `pnpm hub:data` (docs/team/GRUNT.md, item 3): the document from the checkout and an in-memory GitHub. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateHubData } from '@game/schema/hub';
import { buildHubData } from '../../src/hub/build';
import { head } from '../../src/hub/content';
import { requestKind } from '../../src/hub/github';
import type { LoopClient } from '../../src/loop/github';
import type { Comment, Issue, PullRequest, Review } from '../../src/loop/types';
import { config } from '../loop/helpers';

const NOW = new Date('2026-10-10T12:00:00Z');
const REPO = 'mist/vale';

describe('buildHubData', () => {
  it('builds a valid document without GitHub, with the GitHub sections empty', async () => {
    const doc = await buildHubData({ client: null, now: NOW, previews: true, repository: REPO });
    expect(validateHubData(doc)).toEqual([]);
    expect(doc.sources.github).toBeNull();
    expect(doc.sources.vercel).toBeNull();
    expect([doc.requests, doc.proposals, doc.votes, doc.reviewers]).toEqual([[], [], [], []]);
    expect(doc.summary).toBeNull();
  });

  it('takes the board from content/board.json and the records from the content', async () => {
    const doc = await buildHubData({ client: null, now: NOW, previews: false, repository: REPO });
    const core = doc.creators.find((c) => c.handle === 'core')!;
    const board = JSON.parse(readFileSync(join(import.meta.dirname, '../../../content/board.json'), 'utf8')) as { board: Record<string, { records: number }> };
    expect(core.records).toBe(board.board['core']!.records);
    expect(core.points).toBe(doc.parameters.points.per_record * core.records + doc.parameters.points.per_commit * core.commits);
    expect(doc.sources.git.commits).toBe(core.commits);
    expect(doc.slots.find((s) => s.id === 'core/old-bridge')?.filled_by).toBe('core/old-bridge');
    expect(doc.parameters.game['k_permille']).toEqual(expect.objectContaining({ value: expect.any(Number), min: expect.any(Number) }));
  });

  it('reads requests, proposals, votes, reviewers and the summary the way the loop does', async () => {
    const doc = await buildHubData({ client: new FakeGitHub(), now: NOW, previews: true, repository: REPO });
    expect(validateHubData(doc)).toEqual([]);
    expect(doc.sources.github).toEqual({ fetched_at: NOW.toISOString() });

    expect(doc.requests).toEqual([
      expect.objectContaining({ number: 1, kind: 'resource', support: 6, open_call: true, capability: false, author: 'player', proposals: [2, 3] }),
    ]);

    expect(doc.proposals.map((p) => [p.number, p.author, p.merge_rule, p.approvals])).toEqual([
      [2, 'alice', 'fail', 3],
      [3, 'bob', 'fail', 3],
    ]);
    const plum = doc.proposals[0]!;
    expect(plum).toEqual(expect.objectContaining({ answers: 1, slots: ['core/west-glade'], competing: [3], vote: 900, preview: 'https://vale-git-plum.vercel.app/play/' }));
    expect(plum.reviewers).toEqual(['cara', 'dana', 'eli']);
    expect(plum.checks.find((c) => c.rule === 'Competing')).toEqual({ rule: 'Competing', state: 'fail', detail: 'Waiting for the vote in #900' });
    expect(doc.proposals[1]!.preview).toBeUndefined();

    expect(doc.votes).toEqual([
      expect.objectContaining({
        number: 900,
        kind: 'proposal',
        state: 'open',
        options: [
          { key: '2', title: 'Plum bushes', url: 'https://github.com/mist/vale/pull/2', bar: 100, percent: null },
          { key: '3', title: 'Pear trees', url: 'https://github.com/mist/vale/pull/3', bar: 50, percent: null },
        ],
      }),
    ]);
    expect(doc.reviewers).toEqual([{ handle: 'cara', approvals: 1, points: 5, url: 'https://github.com/cara' }]);
    expect(doc.summary).toEqual({ week: '2026-W41', number: 41, url: 'https://github.test/issues/41', posted_at: '2026-10-09T06:00:00Z' });
  });

  it('leaves the previews out when asked to', async () => {
    const doc = await buildHubData({ client: new FakeGitHub(), now: NOW, previews: false, repository: REPO });
    expect(validateHubData(doc)).toEqual([]);
    expect(doc.sources.vercel).toBeNull();
    expect(doc.proposals.every((p) => p.preview === undefined)).toBe(true);
  });

  it('builds without GitHub, and says so, when GitHub fails', async () => {
    const lines: string[] = [];
    const broken: LoopClient = {
      get: () => Promise.reject(new Error('rate limited')),
      list: () => Promise.reject(new Error('rate limited')),
      write: () => Promise.reject(new Error('read-only')),
    };
    const doc = await buildHubData({ client: broken, now: NOW, previews: true, repository: REPO, log: (l) => lines.push(l) });
    expect(validateHubData(doc)).toEqual([]);
    expect(doc.sources.github).toBeNull();
    expect(lines.join('\n')).toContain('rate limited');
  });
});

describe('buildHubData with GitHub data that does not fit', () => {
  it('publishes the document without the GitHub sections, and says why', async () => {
    const lines: string[] = [];
    const odd = new FakeGitHub();
    const list = odd.list.bind(odd);
    odd.list = async <T,>(path: string): Promise<T[]> => {
      const rows = await list<T>(path);
      // a date GitHub would never send, standing in for anything the schema refuses
      return path.includes('labels=request') ? (rows.map((r) => ({ ...r, created_at: 'yesterday' })) as T[]) : rows;
    };
    const doc = await buildHubData({ client: odd, now: NOW, previews: true, repository: REPO, log: (l) => lines.push(l) });
    expect(validateHubData(doc)).toEqual([]);
    expect(doc.sources.github).toBeNull();
    expect(doc.requests).toEqual([]);
    expect(lines.join('\n')).toContain('/requests/0/created_at');
  });
});

describe('head', () => {
  it('names the commit from the host when the files come without their history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-'));
    try {
      expect(head(dir, NOW, { VERCEL_GIT_COMMIT_SHA: 'abc1234', VERCEL_GIT_COMMIT_REF: 'main' })).toEqual({ sha: 'abc1234', at: NOW.toISOString(), branch: 'main' });
      expect(() => head(dir, NOW, {})).toThrow(/VERCEL_GIT_COMMIT_SHA/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('requestKind', () => {
  it('maps the form answer, and anything else to other', () => {
    expect(requestKind('### What kind of thing is it?\n\nA recipe\n\n### Why')).toBe('recipe');
    expect(requestKind('### What kind of thing is it?\n\n_No response_')).toBe('other');
    expect(requestKind(null)).toBe('other');
  });
});

function pull(number: number, title: string, login: string, sha: string, extra: Partial<PullRequest> = {}): PullRequest {
  return {
    number,
    title,
    body: 'Answers #1',
    html_url: `https://github.test/pull/${number}`,
    created_at: `2026-10-0${number}T00:00:00Z`,
    updated_at: `2026-10-0${number}T01:00:00Z`,
    labels: [{ name: 'proposal' }],
    user: { login },
    draft: false,
    head: { sha, repo: { full_name: REPO } },
    ...extra,
  };
}

const approve = (login: string, sha: string, day: number): Review => ({ user: { login }, state: 'APPROVED', commit_id: sha, submitted_at: `2026-10-0${day}T00:00:00Z` });

/** A read-only GitHub with one request, two proposals for one slot, their vote, one merged proposal and two summaries. */
class FakeGitHub implements LoopClient {
  readonly dryRun = true;
  private readonly request: Issue = {
    number: 1,
    title: 'A night fruit',
    body: '### What would you like to find in the valley?\n\nA plum\n\n### What kind of thing is it?\n\nA plant or other resource\n',
    html_url: 'https://github.test/issues/1',
    created_at: '2026-10-06T00:00:00Z',
    labels: [{ name: 'request' }],
    user: { login: 'Player' },
    reactions: { '+1': 6 },
  };
  private readonly vote: Issue = {
    number: 900,
    title: 'Vote: core/west-glade',
    body: '<!-- loop:vote {"closes":"2026-10-14T12:00:00.000Z","group":"request-1","kind":"proposals"} -->',
    html_url: 'https://github.test/issues/900',
    created_at: '2026-10-07T12:00:00Z',
    state: 'open',
    labels: [{ name: 'vote' }],
    user: { login: 'github-actions[bot]', type: 'Bot' },
  };
  private readonly open = [pull(2, 'Plum bushes', 'alice', 'head-a'), pull(3, 'Pear trees', 'bob', 'head-b')];
  private readonly merged = pull(5, 'Fig tree', 'fern', 'head-f', { merged_at: '2026-10-08T00:00:00Z' });

  async get<T>(path: string): Promise<T> {
    if (path.includes('/contents/')) {
      return { content: Buffer.from(JSON.stringify({ node: { place: { slot: 'core/west-glade' } } })).toString('base64'), encoding: 'base64' } as T;
    }
    if (path.includes('/check-runs')) return { check_runs: [{ name: config.required_checks[0], status: 'completed', conclusion: 'success' }] } as T;
    if (path.startsWith('/search/issues')) return { total_count: 0 } as T;
    if (path.startsWith('/users/')) return { login: path.split('/').at(-1), created_at: '2020-01-01T00:00:00Z' } as T;
    throw new Error(`Unexpected GET ${path}`);
  }

  async list<T>(path: string): Promise<T[]> {
    const r = `/repos/${REPO}`;
    if (path === `${r}/issues?state=all&labels=vote&per_page=100`) return [this.vote] as T[];
    if (path === `${r}/issues?state=open&labels=request&per_page=100`) return [this.request] as T[];
    if (path === `${r}/pulls?state=open&per_page=100`) return this.open as T[];
    if (path === `${r}/pulls?state=closed&per_page=100`) return [this.merged, pull(6, 'Closed', 'gil', 'head-g')] as T[];
    if (path === `${r}/issues?state=all&labels=weekly%20summary&per_page=100`) {
      const summary = (number: number, week: string, at: string): Issue => ({
        number,
        title: `Weekly summary: ${week}`,
        body: '',
        html_url: `https://github.test/issues/${number}`,
        created_at: at,
        labels: [{ name: 'weekly summary' }],
        user: { login: 'github-actions[bot]' },
      });
      return [summary(40, '2026-W40', '2026-10-02T06:00:00Z'), summary(41, '2026-W41', '2026-10-09T06:00:00Z')] as T[];
    }
    const files = path.match(/\/pulls\/(\d+)\/files/);
    if (files) return [{ filename: `content/extensions/${files[1] === '2' ? 'alice' : 'bob'}/fruit.json` }] as T[];
    const reviews = path.match(/\/pulls\/(\d+)\/reviews/);
    if (reviews) {
      const n = reviews[1];
      if (n === '5') return [approve('cara', 'head-f', 1), approve('dana', 'old-f', 2), approve('fern', 'head-f', 3)] as T[];
      const sha = n === '2' ? 'head-a' : 'head-b';
      return ['cara', 'dana', 'eli'].map((login, i) => approve(login, sha, i + 1)) as T[];
    }
    if (path === `${r}/issues/2/comments?per_page=100`) {
      return [{ id: 1, body: '[vc]: #x\n**Preview:** [Visit](https://vale-git-plum.vercel.app)', user: { login: 'vercel[bot]' } }] as T[];
    }
    if (path === `${r}/issues/3/comments?per_page=100`) return [] as T[];
    if (path === `${r}/issues/900/comments?per_page=100`) {
      const option = (id: number, key: string, title: string): Comment => ({ id, body: `<!-- loop:option:${key} -->\n## ${title}\n\nReact.` });
      return [option(11, '2', 'Plum bushes'), option(12, '3', 'Pear trees')] as T[];
    }
    const reactions = path.match(/\/issues\/comments\/(\d+)\/reactions/);
    if (reactions) {
      const voters = reactions[1] === '11' ? ['hana', 'ivo'] : ['jon'];
      return voters.map((login) => ({ user: { login }, created_at: '2026-10-08T00:00:00Z' })) as T[];
    }
    throw new Error(`Unexpected LIST ${path}`);
  }

  async write<T>(method: string, path: string): Promise<T | undefined> {
    throw new Error(`The hub must not write: ${method} ${path}`);
  }
}
