/** The players counter in hub-data (DECISIONS.md, 2026-10-31): the game server's GET /stats, or null, never a guessed 0. */
import { describe, expect, it } from 'vitest';
import { accountsReader, serverOrigin, statsReader } from '../../src/hub/accounts';

const answer = (status: number, body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status });

describe('serverOrigin', () => {
  it('takes a bare https origin and nothing else, without printing the value', () => {
    expect(serverOrigin({ GAME_SERVER_ORIGIN: ' https://play.example.org ' })).toEqual({ origin: 'https://play.example.org' });
    expect(serverOrigin({ GAME_SERVER_ORIGIN: 'https://play.example.org/' })).toEqual({ origin: 'https://play.example.org' });
    expect(serverOrigin({})).toEqual({ origin: null, reason: 'GAME_SERVER_ORIGIN is not set' });
    // a workflow passes an unset variable as ''
    expect(serverOrigin({ GAME_SERVER_ORIGIN: '' }).origin).toBeNull();
    for (const bad of ['play.example.org', 'http://play.example.org', 'https://play.example.org/stats', 'https://play.example.org/?a=1', 'https://u:p@play.example.org']) {
      const named = serverOrigin({ GAME_SERVER_ORIGIN: bad });
      expect(named.origin, bad).toBeNull();
      expect(JSON.stringify(named), bad).not.toContain('example');
    }
  });

  it('gives no reader, and a line saying why, when no server is named', () => {
    const lines: string[] = [];
    expect(accountsReader({}, (l) => lines.push(l))).toBeNull();
    expect(lines).toEqual(['note: the players count is unknown: GAME_SERVER_ORIGIN is not set']);
    expect(accountsReader({ GAME_SERVER_ORIGIN: 'https://play.example.org' }, () => {})).not.toBeNull();
  });
});

describe('statsReader', () => {
  it('reads the two counts from /stats at the origin', async () => {
    const asked: string[] = [];
    const read = statsReader('https://play.example.org', async (url) => {
      asked.push(String(url));
      return new Response(JSON.stringify({ accounts: 12, new_7d: 3 }), { status: 200 });
    });
    expect(await read()).toEqual({ open: 12, new_7d: 3 });
    expect(asked).toEqual(['https://play.example.org/stats']);
  });

  it('throws on an error status or another shape, so the build keeps the count null', async () => {
    await expect(statsReader('https://a.example', answer(503, { error: 'x' }))()).rejects.toThrow('answered 503');
    for (const body of [{}, { accounts: -1, new_7d: 0 }, { accounts: 1.5, new_7d: 0 }, { accounts: '3', new_7d: 0 }, { accounts: 2, new_7d: 3 }, null]) {
      await expect(statsReader('https://a.example', answer(200, body))(), JSON.stringify(body)).rejects.toThrow();
    }
  });

  it('gives up after the time limit', async () => {
    const slow: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    await expect(statsReader('https://a.example', slow, 20)()).rejects.toThrow();
  });
});
