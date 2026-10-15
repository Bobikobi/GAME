// The stage-1 endpoints on a fake store (docs/team/GRUNT.md, item 17).
import { describe, expect, it } from 'vitest';
import { S1_RATE_LIMIT, s1Keys, s1Window } from '@game/schema/s1';
import { handleS1, type S1Call, type S1Store } from '../src/s1/handler';

class FakeStore implements S1Store {
  counts = new Map<string, number>();
  sets = new Map<string, Set<string>>();
  lists = new Map<string, string[]>();
  ttls = new Map<string, number>();
  async incr(key: string, ttl: number) {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    if (n === 1) this.ttls.set(key, ttl);
    return n;
  }
  async sadd(key: string, member: string, ttl: number) {
    this.sets.set(key, (this.sets.get(key) ?? new Set()).add(member));
    this.ttls.set(key, ttl);
  }
  async push(key: string, value: string, keep: number) {
    this.lists.set(key, [value, ...(this.lists.get(key) ?? [])].slice(0, keep));
  }
}

const NOW = new Date('2026-10-11T12:00:00Z');
const call = (endpoint: string, body: unknown, over: Partial<S1Call> = {}): S1Call => ({
  endpoint,
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
  ip: '203.0.113.7',
  origin: null,
  self: 'https://site.example',
  now: NOW,
  ...over,
});

describe('the stage-1 endpoints', () => {
  it('a visit increments its counter in this week\'s window and answers 204', async () => {
    const store = new FakeStore();
    expect((await handleS1(store, call('visit', { id: 'core/berry' }))).status).toBe(204);
    await handleS1(store, call('visit', { id: 'core/berry' }, { ip: '198.51.100.1' }));
    expect(s1Window(NOW)).toBe('2026-W41');
    expect(store.counts.get(s1Keys.visits('2026-W41', 'core/berry'))).toBe(2);
  });

  it('a pickup, a stop and a report each write their own key', async () => {
    const store = new FakeStore();
    await handleS1(store, call('pickup', { id: 'core/berry' }));
    await handleS1(store, call('stop', { step: 'core/fix-the-bridge' }));
    await handleS1(store, call('report', { id: 'core/berry', text: 'looks wrong' }));
    expect(store.counts.get(s1Keys.pickups('2026-W41', 'core/berry'))).toBe(1);
    expect(store.counts.get(s1Keys.stops('2026-W41', 'core/fix-the-bridge'))).toBe(1);
    expect([...(store.sets.get(s1Keys.steps('2026-W41')) ?? [])]).toEqual(['core/fix-the-bridge']);
    expect(store.lists.get(s1Keys.reports('core/berry'))).toEqual(['looks wrong']);
  });

  it('keeps only the newest 50 reports', async () => {
    const store = new FakeStore();
    for (let i = 0; i < 60; i++) await handleS1(store, call('report', { id: 'core/berry', text: `n${i}` }, { ip: `10.0.0.${i}` }));
    const list = store.lists.get(s1Keys.reports('core/berry'))!;
    expect(list).toHaveLength(50);
    expect(list[0]).toBe('n59');
  });

  it('refuses a report over 240 characters and writes nothing', async () => {
    const store = new FakeStore();
    const res = await handleS1(store, call('report', { id: 'core/berry', text: 'x'.repeat(241) }));
    expect(res.status).toBe(400);
    expect(store.lists.size).toBe(0);
    expect(store.counts.size).toBe(0);
    expect((await handleS1(store, call('report', { id: 'core/berry', text: 'x'.repeat(240) }))).status).toBe(204);
  });

  it('refuses a bad id, an extra field, bad JSON and a big body', async () => {
    const store = new FakeStore();
    expect((await handleS1(store, call('visit', { id: 'Core/Berry' }))).status).toBe(400);
    expect((await handleS1(store, call('visit', { id: 'core/berry', who: 'me' }))).status).toBe(400);
    expect((await handleS1(store, call('visit', '{nope'))).status).toBe(400);
    expect((await handleS1(store, call('visit', 'x'.repeat(2000)))).status).toBe(413);
    expect(store.counts.size).toBe(0);
  });

  it('answers 405 to anything but POST and 404 to an unknown endpoint', async () => {
    const store = new FakeStore();
    const get = await handleS1(store, call('visit', '', { method: 'GET' }));
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    expect((await handleS1(store, call('nothing', { id: 'core/berry' }))).status).toBe(404);
  });

  it('allows the same origin and refuses another', async () => {
    const store = new FakeStore();
    const ok = await handleS1(store, call('visit', { id: 'core/berry' }, { origin: 'https://site.example' }));
    expect(ok.status).toBe(204);
    for (const origin of ['https://evil.example', 'http://site.example', 'null', 'not a url']) {
      expect((await handleS1(store, call('visit', { id: 'core/berry' }, { origin }))).status).toBe(403);
    }
  });

  it('the 31st call in a minute from one address is 429, and the next minute is free', async () => {
    const store = new FakeStore();
    for (let i = 0; i < S1_RATE_LIMIT; i++) expect((await handleS1(store, call('visit', { id: 'core/berry' }))).status).toBe(204);
    const over = await handleS1(store, call('visit', { id: 'core/berry' }));
    expect(over.status).toBe(429);
    expect(store.counts.get(s1Keys.visits('2026-W41', 'core/berry'))).toBe(S1_RATE_LIMIT);
    expect((await handleS1(store, call('visit', { id: 'core/berry' }, { ip: '198.51.100.2' }))).status).toBe(204);
    const later = new Date(NOW.getTime() + 60_000);
    expect((await handleS1(store, call('visit', { id: 'core/berry' }, { now: later }))).status).toBe(204);
  });

  it('never stores the address: only its hash, with a minute-long expiry', async () => {
    const store = new FakeStore();
    await handleS1(store, call('visit', { id: 'core/berry' }));
    const keys = [...store.counts.keys()].filter((k) => k.startsWith('s1:rl:'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain('203.0.113.7');
    expect(store.ttls.get(keys[0]!)).toBe(60);
  });

  it('without a store a valid request is 503, an invalid one still 400', async () => {
    expect((await handleS1(null, call('visit', { id: 'core/berry' }))).status).toBe(503);
    expect((await handleS1(null, call('visit', { id: '' }))).status).toBe(400);
  });
});
