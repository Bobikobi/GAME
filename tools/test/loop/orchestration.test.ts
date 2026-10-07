/** Runs the full loop against an in-memory GitHub repository and checks every write. */
import { describe, expect, it } from 'vitest';
import type { LoopClient } from '../../src/loop/github';
import { runAll } from '../../src/loop/run';
import type { Comment, Issue, PullRequest } from '../../src/loop/types';
import { config } from './helpers';

describe('loop orchestration', () => {
  it('plans the exact labels, statuses, comments, and vote issue for a fixture repository', async () => {
    const client = new FakeClient();
    await runAll({
      client,
      repository: 'mist/vale',
      config,
      now: new Date('2026-10-07T12:00:00Z'),
    });

    expect(client.writes.map(compactWrite)).toEqual([
      ['POST', '/repos/mist/vale/issues/1/labels', ['open call']],
      ['POST', '/repos/mist/vale/issues/1/comments', 'open-call comment'],
      ['POST', '/repos/mist/vale/issues/2/labels', ['proposal']],
      ['POST', '/repos/mist/vale/issues/3/labels', ['proposal']],
      ['POST', '/repos/mist/vale/issues/2/labels', ['competing']],
      ['POST', '/repos/mist/vale/issues/3/labels', ['competing']],
      ['POST', '/repos/mist/vale/statuses/head-a', { context: 'merge rule', state: 'failure', description: 'Waiting for a vote to open' }],
      ['POST', '/repos/mist/vale/issues/2/comments', 'merge-rule comment'],
      ['POST', '/repos/mist/vale/statuses/head-b', { context: 'merge rule', state: 'failure', description: 'Waiting for a vote to open' }],
      ['POST', '/repos/mist/vale/issues/3/comments', 'merge-rule comment'],
      ['POST', '/repos/mist/vale/issues', { title: 'Vote: core/west-glade', labels: ['vote'] }],
      ['POST', '/repos/mist/vale/issues/900/comments', 'option:2'],
      ['POST', '/repos/mist/vale/issues/900/comments', 'option:3'],
      ['PATCH', '/repos/mist/vale/issues/900', 'vote results'],
      ['POST', '/repos/mist/vale/statuses/head-a', { context: 'merge rule', state: 'failure', description: 'Waiting for the vote in #900' }],
      ['PATCH', '/repos/mist/vale/issues/comments/101', 'merge-rule comment'],
      ['POST', '/repos/mist/vale/statuses/head-b', { context: 'merge rule', state: 'failure', description: 'Waiting for the vote in #900' }],
      ['PATCH', '/repos/mist/vale/issues/comments/102', 'merge-rule comment'],
    ]);
    expect(client.writes[1]!.body).toEqual({
      body: 'This request is now an open call. Any creator may answer it with a pull request that says `Answers #1`. Competing proposals are welcome.\n\n[See all open requests, sorted by support.](https://github.com/mist/vale/issues?q=is%3Aissue%20is%3Aopen%20label%3Arequest%20sort%3Areactions-%2B1-desc)',
    });
    expect(client.writes[10]!.body).toEqual(expect.objectContaining({
      title: 'Vote: core/west-glade',
      labels: ['vote'],
      body: expect.stringContaining('<!-- loop:vote {"closes":"2026-10-14T12:00:00.000Z","group":"slot-core/west-glade","kind":"proposals"} -->'),
    }));
  });

  it('writes nothing on a rerun when nothing changed', async () => {
    const client = new FakeClient();
    const options = { client, repository: 'mist/vale', config, now: new Date('2026-10-07T12:00:00Z') };
    await runAll(options);
    client.writes.length = 0;
    await runAll({ ...options, now: new Date('2026-10-07T13:00:00Z') });
    expect(client.writes.map(compactWrite)).toEqual([]);
  });
});

interface Write {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

class FakeClient implements LoopClient {
  readonly writes: Write[] = [];
  private readonly comments = new Map<number, Comment[]>();
  private readonly statuses = new Map<string, { context: string; state: string; description: string }[]>();
  private readonly voteIssues: Issue[] = [];
  private nextComment = 100;
  private readonly request: Issue = {
    number: 1,
    title: 'A night fruit',
    body: '',
    html_url: 'https://github.test/issues/1',
    created_at: '2026-10-06T00:00:00Z',
    labels: [{ name: 'request' }],
    user: { login: 'player' },
    reactions: { '+1': 8 },
  };
  private readonly pulls: PullRequest[] = [
    proposal(2, 'Plum bushes', 'alice', 'head-a'),
    proposal(3, 'Pear trees', 'bob', 'head-b'),
  ];

  async get<T>(path: string): Promise<T> {
    if (path.includes('/contents/')) {
      return { content: Buffer.from(JSON.stringify({ node: { place: { slot: 'core/west-glade' } } })).toString('base64'), encoding: 'base64' } as T;
    }
    if (path.includes('/check-runs')) {
      return { check_runs: [{ name: config.required_checks[0], status: 'completed', conclusion: 'success' }] } as T;
    }
    const status = path.match(/\/commits\/([^/]+)\/status$/);
    if (status) return { statuses: this.statuses.get(status[1]!) ?? [] } as T;
    if (path.startsWith('/search/issues')) return { total_count: 0 } as T;
    if (path.startsWith('/users/')) return { login: path.split('/').at(-1), created_at: '2020-01-01T00:00:00Z' } as T;
    throw new Error(`Unexpected GET ${path}`);
  }

  async list<T>(path: string): Promise<T[]> {
    if (path.endsWith('/labels?per_page=100')) return Object.keys(allLabels).map((name) => ({ name })) as T[];
    if (path.endsWith('/issues?state=open&labels=request&per_page=100')) return [this.request] as T[];
    if (path.endsWith('/pulls?state=open&per_page=100')) return this.pulls as T[];
    if (path.match(/\/pulls\/\d+\/files/)) {
      const number = Number(path.match(/\/pulls\/(\d+)/)?.[1]);
      const author = number === 2 ? 'alice' : 'bob';
      return [{ filename: `content/extensions/${author}/fruit.json` }] as T[];
    }
    if (path.match(/\/pulls\/\d+\/reviews/)) {
      return ['cara', 'dana', 'eli'].map((login, index) => ({
        user: { login },
        state: 'APPROVED',
        commit_id: path.includes('/2/') ? 'head-a' : 'head-b',
        submitted_at: `2026-10-0${index + 1}T00:00:00Z`,
      })) as T[];
    }
    if (path.endsWith('/issues?state=open&labels=vote&per_page=100')) return this.voteIssues as T[];
    const issueComments = path.match(/\/issues\/(\d+)\/comments/);
    if (issueComments) return (this.comments.get(Number(issueComments[1])) ?? []) as T[];
    if (path.includes('/reactions?')) return [];
    throw new Error(`Unexpected LIST ${path}`);
  }

  async write<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T | undefined> {
    const object = body as Record<string, unknown>;
    this.writes.push({ method, path, body: object });
    const labels = path.match(/\/issues\/(\d+)\/labels$/);
    if (method === 'POST' && labels) {
      const number = Number(labels[1]);
      const target = number === 1 ? this.request : this.pulls.find((pull) => pull.number === number);
      for (const name of object.labels as string[]) target?.labels.push({ name });
    }
    if (method === 'POST' && path === '/repos/mist/vale/issues') {
      const issue: Issue = {
        number: 900,
        title: String(object.title),
        body: String(object.body),
        html_url: 'https://github.test/issues/900',
        created_at: '2026-10-07T12:00:00Z',
        labels: (object.labels as string[]).map((name) => ({ name })),
        user: { login: 'loop-bot', type: 'Bot' },
      };
      this.voteIssues.push(issue);
      return issue as T;
    }
    const commentPath = path.match(/\/issues\/(\d+)\/comments$/);
    if (method === 'POST' && commentPath) {
      const number = Number(commentPath[1]);
      const comment = { id: this.nextComment++, body: String(object.body), created_at: '2026-10-07T12:00:00Z' };
      this.comments.set(number, [...(this.comments.get(number) ?? []), comment]);
      return comment as T;
    }
    const statusPath = path.match(/\/statuses\/([^/]+)$/);
    if (method === 'POST' && statusPath) {
      const latest = { context: String(object.context), state: String(object.state), description: String(object.description) };
      this.statuses.set(statusPath[1]!, [latest, ...(this.statuses.get(statusPath[1]!) ?? []).filter((item) => item.context !== latest.context)]);
    }
    const edited = path.match(/\/issues\/comments\/(\d+)$/);
    if (method === 'PATCH' && edited) {
      for (const list of this.comments.values()) for (const comment of list) if (comment.id === Number(edited[1])) comment.body = String(object.body);
    }
    if (method === 'PATCH' && path.endsWith('/issues/900')) this.voteIssues[0]!.body = String(object.body);
    return undefined;
  }
}

const allLabels = {
  request: true,
  'open call': true,
  capability: true,
  proposal: true,
  competing: true,
  vote: true,
  'vote won': true,
  'vote lost': true,
  veto: true,
  'weekly summary': true,
  'next discovery': true,
};

function proposal(number: number, title: string, author: string, sha: string): PullRequest {
  return {
    number,
    title,
    body: null,
    html_url: `https://github.test/pulls/${number}`,
    created_at: `2026-10-0${number}T00:00:00Z`,
    labels: [],
    user: { login: author },
    draft: false,
    head: { sha, repo: { full_name: `${author}/game` } },
  };
}

function compactWrite(write: Write): unknown[] {
  if (write.path.endsWith('/labels')) return [write.method, write.path, write.body.labels];
  if (write.path.includes('/statuses/')) return [write.method, write.path, { context: write.body.context, state: write.body.state, description: write.body.description }];
  if (write.path === '/repos/mist/vale/issues') return [write.method, write.path, { title: write.body.title, labels: write.body.labels }];
  const body = String(write.body.body ?? '');
  if (body.includes('<!-- loop:merge-rule -->')) return [write.method, write.path, 'merge-rule comment'];
  if (body.includes('<!-- loop:option:')) return [write.method, write.path, `option:${body.match(/loop:option:([^ ]+)/)?.[1]}`];
  if (body.includes('<!-- loop:results -->')) return [write.method, write.path, 'vote results'];
  if (body.includes('now an open call')) return [write.method, write.path, 'open-call comment'];
  return [write.method, write.path, write.body];
}
