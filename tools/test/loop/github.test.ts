/** Checks pagination, dry-run writes, warnings, and clear REST failures. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../../src/loop/github';

describe('GitHub client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paginates through Link headers with the required API headers', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), {
        headers: { Link: '<https://api.test/items?page=2>; rel="next"' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2 }])));
    vi.stubGlobal('fetch', fetcher);
    const client = new GitHubClient('secret', false, () => undefined, 'https://api.test');
    expect(await client.list<{ id: number }>('/items')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.test/items', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer secret', 'X-GitHub-Api-Version': '2022-11-28' }),
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.test/items?page=2', expect.anything());
  });

  it('prints dry-run writes without fetching', async () => {
    const fetcher = vi.fn();
    const lines: string[] = [];
    vi.stubGlobal('fetch', fetcher);
    const client = new GitHubClient('secret', true, (line) => lines.push(line));
    await client.write('POST', '/repos/mist/vale/issues', { title: 'Vote' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(lines).toEqual(['[dry-run] POST /repos/mist/vale/issues {"title":"Vote"}']);
  });

  it('warns and continues when a write is forbidden', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    const lines: string[] = [];
    const client = new GitHubClient('secret', false, (line) => lines.push(line));
    expect(await client.write('POST', '/blocked', {})).toBeUndefined();
    expect(lines).toEqual(['::warning::GitHub denied POST /blocked with 403; continuing with read-only access.']);
  });

  it('reports the method, path, and status for other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gone', { status: 404 })));
    const client = new GitHubClient('secret');
    await expect(client.get('/missing')).rejects.toThrow('GitHub GET /missing failed with 404: gone');
  });
});
