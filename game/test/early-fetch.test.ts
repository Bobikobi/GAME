import { describe, expect, test } from 'vitest';

import { EarlyImages } from '../src/early-fetch.js';

function rig(atOnce = 2) {
  const pending: { url: string; done: () => void; fail: () => void }[] = [];
  const early = new EarlyImages<string, string>(
    {
      fetch: (url) => new Promise((res, rej) => pending.push({ url, done: () => res(url), fail: () => rej(new Error('net')) })),
      decode: async (b) => `img:${b}`,
    },
    atOnce,
  );
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));
  return { early, pending, flush };
}

describe('the early fetch of a painted land (V5b)', () => {
  test('fetches in the order asked, two at once, the next as one lands', async () => {
    const r = rig();
    r.early.want(['a', 'b', 'c', 'd'].map((k) => ({ key: k, url: `${k}.png` })));
    expect(r.pending.map((p) => p.url)).toEqual(['a.png', 'b.png']);
    r.pending.shift()!.done();
    await r.flush();
    expect(r.pending.map((p) => p.url)).toEqual(['b.png', 'c.png']);
    expect(await r.early.get('a')).toBe('img:a.png');
  });

  test('a key asked twice is fetched once; a key never asked has nothing', () => {
    const r = rig();
    r.early.want([{ key: 'a', url: 'a.png' }]);
    r.early.want([{ key: 'a', url: 'a.png' }]);
    expect(r.pending.length).toBe(1);
    expect(r.early.has('z')).toBe(false);
    expect(r.early.get('z')).toBeUndefined();
  });

  test('a failed fetch fails its own key and the queue goes on', async () => {
    const r = rig(1);
    r.early.want(['a', 'b'].map((k) => ({ key: k, url: `${k}.png` })));
    const a = r.early.get('a')!;
    r.pending.shift()!.fail();
    await expect(a).rejects.toThrow('net');
    await r.flush();
    expect(r.pending.map((p) => p.url)).toEqual(['b.png']);
  });
});
