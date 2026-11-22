/**
 * The developers' home's feed (#727, stage 1; bar F1): the feed is built from a recorded answer of GitHub, every open
 * pull request in it appears once with its real author and state, and nothing closed gets in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HubGap } from '@game/schema/hub';
import { buildFeed, gapsOf, readFeed } from '../../src/hub/feed';
import type { LoopClient } from '../../src/loop/github';
import type { PullRequest } from '../../src/loop/types';

const recorded = JSON.parse(readFileSync(join(import.meta.dirname, '../fixtures/hub/pulls.json'), 'utf8')) as { open: PullRequest[]; closed: PullRequest[] };
const REPO = 'Bobikobi/GAME';
const TEAM = new Set(['bobikobi']);

/** GitHub as it answered, but sloppier: every pull-request query gets the open and the closed ones together. */
class Recorded implements LoopClient {
  readonly dryRun = true;
  readonly asked: string[] = [];
  async get<T>(path: string): Promise<T> {
    throw new Error(`Unexpected GET ${path}`);
  }
  async list<T>(path: string): Promise<T[]> {
    this.asked.push(path);
    if (path.includes('/files')) return [{ filename: 'content/core/npcs/elder.json' }] as T[];
    if (path.includes('/pulls?')) return [...recorded.closed, ...recorded.open] as T[];
    throw new Error(`Unexpected LIST ${path}`);
  }
  async write<T>(method: string, path: string): Promise<T | undefined> {
    throw new Error(`The feed must not write: ${method} ${path}`);
  }
}

describe('the feed (F1)', () => {
  it('has every open pull request of the recording once, with its real author and state', async () => {
    const feed = await readFeed(new Recorded(), REPO, [], TEAM);
    expect(recorded.open.length).toBeGreaterThanOrEqual(8);
    expect(feed.map((i) => i.number).sort((a, b) => a - b)).toEqual(recorded.open.map((p) => p.number).sort((a, b) => a - b));
    for (const pr of recorded.open) {
      const item = feed.filter((i) => i.number === pr.number);
      expect(item, `#${pr.number} once`).toHaveLength(1);
      expect(item[0]).toEqual(expect.objectContaining({ author: pr.user.login.toLowerCase(), state: pr.draft ? 'draft' : 'review', url: pr.html_url, title: pr.title }));
    }
  });

  it('holds no closed or merged pull request, even when the answer carries them', async () => {
    const feed = await readFeed(new Recorded(), REPO, [], TEAM);
    const closed = new Set(recorded.closed.map((p) => p.number));
    expect(recorded.closed.length).toBeGreaterThan(0);
    expect(feed.filter((i) => closed.has(i.number))).toEqual([]);
  });

  it('asks GitHub for open ones and never writes', async () => {
    const client = new Recorded();
    await readFeed(client, REPO, [], TEAM);
    expect(client.asked[0]).toBe(`/repos/${REPO}/pulls?state=open&per_page=100`);
  });

  it('shows the owner account as the development team and keeps its handle; an outside account stays itself', () => {
    const feed = buildFeed(recorded.open, new Map(), [], TEAM);
    const mine = feed.find((i) => i.author === 'bobikobi')!;
    const theirs = feed.find((i) => i.author === 'ceosisrael')!;
    expect(mine.maker).toBe('team');
    expect(theirs.maker).toBe('person');
    expect(feed.every((i) => i.author === i.author.toLowerCase())).toBe(true);
  });

  it('lists the newest change first, and the same input gives the same feed', () => {
    const a = buildFeed(recorded.open, new Map(), [], TEAM);
    const b = buildFeed([...recorded.open].reverse(), new Map(), [], TEAM);
    expect(b).toEqual(a);
    const times = a.map((i) => Date.parse(i.updated_at));
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });
});

describe('the gaps a pull request touches', () => {
  const gap = (id: string, file: string): HubGap => ({ rule: 'no_picture', id, file, url: `https://github.com/${REPO}/blob/develop/${file}`, line: 'no picture yet' });
  const gaps = [gap('a/one', 'content/a/one.json'), gap('a/two', 'content/a/two.json'), gap('a/three', 'content/a/three.json'), gap('a/four', 'content/a/four.json')];

  it('are the ones in the files it changes, three at most', () => {
    expect(gapsOf(['README.md', 'content/a/two.json'], gaps).map((g) => g.id)).toEqual(['a/two']);
    expect(gapsOf(gaps.map((g) => g.file), gaps)).toHaveLength(3);
    expect(gapsOf(['README.md'], gaps)).toEqual([]);
  });

  it('end up on the item of the pull request that changes the file', () => {
    const [first] = recorded.open;
    const feed = buildFeed(recorded.open, new Map([[first!.number, ['content/a/one.json']]]), gaps, TEAM);
    expect(feed.find((i) => i.number === first!.number)!.missing.map((g) => g.id)).toEqual(['a/one']);
    expect(feed.filter((i) => i.number !== first!.number).every((i) => i.missing.length === 0)).toBe(true);
  });
});
