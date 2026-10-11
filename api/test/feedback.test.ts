import { beforeEach, describe, expect, test, vi } from 'vitest';

import { handle, issueFrom, parse, resetRateLimit } from '../_feedback';

const good = {
  kind: 'feedback',
  text: 'The bridge is hard to find @someone',
  context: { map: 'core/world', tile: [12, 7], quest: 'core/first', hour: '18:30', build: 'content abcd1234 kernel 1.0.0' },
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://x.test/api/feedback', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });
const github = (status = 201) => vi.fn(async () => new Response('{"secret":"nope"}', { status }));
const asFetch = (f: ReturnType<typeof github>) => f as unknown as typeof fetch;

beforeEach(() => resetRateLimit());

describe('POST /api/feedback', () => {
  test('without the token it answers 503 and calls nothing', async () => {
    const f = github();
    const res = await handle(post(good), {}, asFetch(f));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
    expect(f).not.toHaveBeenCalled();
  });

  test('without its own token it uses the hub token, and its own token wins when both are set', async () => {
    const f = github();
    expect((await handle(post(good), { HUB_GITHUB_TOKEN: 'hub-1' }, asFetch(f))).status).toBe(200);
    expect((((f.mock.calls[0] as unknown as [string, RequestInit])[1]).headers as Record<string, string>)['authorization']).toBe('Bearer hub-1');
    resetRateLimit();
    await handle(post(good), { FEEDBACK_GITHUB_TOKEN: 'own-1', HUB_GITHUB_TOKEN: 'hub-1' }, asFetch(f));
    expect((((f.mock.calls[1] as unknown as [string, RequestInit])[1]).headers as Record<string, string>)['authorization']).toBe('Bearer own-1');
  });

  test('with the token it opens one labelled issue with the context as a table', async () => {
    const f = github();
    const res = await handle(post(good), { FEEDBACK_GITHUB_TOKEN: 'tok-123' }, asFetch(f));
    expect(res.status).toBe(200);
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/Bobikobi/GAME/issues');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer tok-123');
    const issue = JSON.parse(init.body as string) as { title: string; body: string; labels: string[] };
    expect(issue.labels).toEqual(['feedback']);
    expect(issue.body).toContain('| Tile | 12, 7 |');
    expect(issue.body).toContain('| Open quest | core/first |');
    expect(issue.body).toContain('| Valley hour | 18:30 |');
    expect(issue.body).not.toContain('@someone'); // mentions are broken so nobody is pinged
  });

  test('a GitHub failure is a 502 that leaks neither the token nor GitHub text', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handle(post(good), { FEEDBACK_GITHUB_TOKEN: 'tok-123' }, asFetch(github(401)));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/secret|tok-123/);
    expect(JSON.stringify(err.mock.calls)).not.toContain('tok-123');
    err.mockRestore();
  });

  test('refuses other methods, bad JSON, bad shapes and oversized bodies', async () => {
    const env = { FEEDBACK_GITHUB_TOKEN: 't' };
    const f = github();
    expect((await handle(new Request('https://x.test/', { method: 'GET' }), env, asFetch(f))).status).toBe(405);
    expect((await handle(post('{nope'), env, asFetch(f))).status).toBe(400);
    expect((await handle(post({ ...good, text: 'x'.repeat(1201) }), env, asFetch(f))).status).toBe(400);
    expect((await handle(post({ ...good, context: { ...good.context, tile: ['a', 1] } }), env, asFetch(f))).status).toBe(400);
    expect((await handle(post({ ...good, text: '  ' }), env, asFetch(f))).status).toBe(400);
    expect((await handle(post('x'.repeat(9000)), env, asFetch(f))).status).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });

  test('rate limits one address to 5 a minute', async () => {
    const env = { FEEDBACK_GITHUB_TOKEN: 't' };
    const f = github();
    const h = { 'x-forwarded-for': '1.2.3.4' };
    for (let i = 0; i < 5; i++) expect((await handle(post(good, h), env, asFetch(f), 1000 + i)).status).toBe(200);
    expect((await handle(post(good, h), env, asFetch(f), 1010)).status).toBe(429);
    expect((await handle(post(good, h), env, asFetch(f), 1000 + 61_000)).status).toBe(200);
  });
});

describe('the issue text', () => {
  test('a review lists rating and chips; table cells cannot break out', () => {
    const p = parse({ kind: 'review', text: '', rating: 4, liked: ['The look'], confused: ['a|b\nc'], context: good.context })!;
    const { title, body } = issueFrom(p);
    expect(title).toBe('Review 4/5');
    expect(body).toContain('| Rating | 4/5 |');
    expect(body).toContain('| Confused | a b c |');
  });
});
