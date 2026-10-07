/** Covers discovery vote creation from the checked-in Markdown fixtures. */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LoopClient } from '../../src/loop/github';
import { runDiscovery } from '../../src/loop/run';
import type { Issue } from '../../src/loop/types';
import { config } from './helpers';

describe('next discovery', () => {
  it('opens one vote with one option per discovery file', async () => {
    const writes: { path: string; body: Record<string, unknown> }[] = [];
    const client: LoopClient = {
      async get<T>() {
        return { default_branch: 'main' } as T;
      },
      async list<T>() {
        return [] as T[];
      },
      async write<T>(_method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown): Promise<T | undefined> {
        writes.push({ path, body: body as Record<string, unknown> });
        if (path.endsWith('/issues')) {
          return {
            number: 50,
            title: 'Vote: the next discovery',
            body: (body as { body: string }).body,
            html_url: 'u',
            created_at: '2026-10-07T00:00:00Z',
            labels: [{ name: 'vote' }, { name: 'next discovery' }],
            user: { login: 'bot' },
          } as T;
        }
        return undefined;
      },
    };
    await runDiscovery({
      client,
      repository: 'mist/vale',
      config,
      now: new Date('2026-10-07T00:00:00Z'),
      discoveryDir: join(process.cwd(), 'tools', 'test', 'loop', 'fixtures', 'discovery'),
    });
    expect(writes.map((write) => write.path)).toEqual([
      '/repos/mist/vale/issues',
      '/repos/mist/vale/issues/50/comments',
      '/repos/mist/vale/issues/50/comments',
    ]);
    expect(writes[0]!.body).toEqual(expect.objectContaining({ title: 'Vote: the next discovery', labels: ['vote', 'next discovery'] }));
    expect(String(writes[1]!.body.body)).toContain('<!-- loop:option:moon-garden -->');
    expect(String(writes[1]!.body.body)).toContain('Find flowers that open only under moonlight.');
    expect(String(writes[2]!.body.body)).toContain('/blob/main/docs/loop/discovery/old-mill.md');
  });

  it('does nothing when a next-discovery vote is already open', async () => {
    let writes = 0;
    const existing: Issue = {
      number: 9,
      title: 'Vote: the next discovery',
      body: '',
      html_url: 'u',
      created_at: '2026-10-01T00:00:00Z',
      labels: [{ name: 'vote' }, { name: 'next discovery' }],
      user: { login: 'bot' },
    };
    const client: LoopClient = {
      async get<T>(): Promise<T> { throw new Error('No read expected'); },
      async list<T>(): Promise<T[]> { return [existing] as T[]; },
      async write<T>(): Promise<T | undefined> { writes++; return undefined; },
    };
    await runDiscovery({ client, repository: 'mist/vale', config, now: new Date('2026-10-07T00:00:00Z') });
    expect(writes).toBe(0);
  });

  it('prints a clear message for a missing discovery folder', async () => {
    const lines: string[] = [];
    const client: LoopClient = {
      async get<T>(): Promise<T> { throw new Error('No read expected'); },
      async list<T>(): Promise<T[]> { return []; },
      async write<T>(): Promise<T | undefined> { throw new Error('No write expected'); },
    };
    await runDiscovery({
      client,
      repository: 'mist/vale',
      config,
      now: new Date('2026-10-07T00:00:00Z'),
      discoveryDir: join(process.cwd(), 'tools', 'test', 'loop', 'fixtures', 'missing'),
      log: (line) => lines.push(line),
    });
    expect(lines).toEqual(['No discovery files found in docs/loop/discovery; no vote opened.']);
  });
});
