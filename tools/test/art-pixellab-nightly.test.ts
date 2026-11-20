import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { type Http } from '../src/art/pixellab/api.js';
import { bodyFor, parseQueue, promptFor, runNightly, type NightlyDeps, type Queue } from '../src/art/pixellab/nightly.js';
import { nightlyIndexes, parsePoolConfig, type PoolConfig } from '../src/art/pixellab/pool.js';
import { doneIds, logLine, nightlyMain, type NightlyIo } from '../src/art/pixellab-nightly-cli.js';
import { REPO_ROOT } from '../src/load.js';

/** Fake tokens, one per account of the pool in the repo: the paid one is the second. Not real, and printed nowhere. */
const TOKENS: Record<string, string> = {
  'pixellab-token.txt': 'tk-FAKE-current-0001',
  'pixellab-token-trial1.txt': 'tk-FAKE-PAID-trial1-0002',
  'pixellab-token-trial2.txt': 'tk-FAKE-trial2-0003',
  'pixellab-token-trial3.txt': 'tk-FAKE-trial3-0004',
};
const PAID = 'tk-FAKE-PAID-trial1-0002';

const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (() => {
    throw new Error('the nightly tests must not reach the network');
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const dirs: string[] = [];
function folder(name: string): string {
  const d = mkdtempSync(join(tmpdir(), `nightly-${name}-`));
  dirs.push(d);
  return d;
}

function png(): string {
  const p = new PNG({ width: 8, height: 8 });
  for (let i = 0; i < 64; i += 1) {
    p.data[i * 4] = 90;
    p.data[i * 4 + 1] = 140;
    p.data[i * 4 + 2] = 60;
    p.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(p).toString('base64');
}

interface Call {
  method: string;
  path: string;
  token: string;
}

/** A PixelLab that answers `/balance` with 0 on a free account (as the real one did) and 5,000 on the paid one. */
class Night {
  calls: Call[] = [];
  sleeps: number[] = [];
  clock = 0;
  /** Pictures a token still gives before the server answers 402. */
  gives = new Map<string, number>();
  /** The next posts of a token answer this status, once each. */
  failWith = new Map<string, number[]>();
  /** 429s to answer before the first post is accepted. */
  slot429 = 0;
  bodies: Record<string, unknown>[] = [];

  readonly http: Http = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => this.handle(String(input), init)) as typeof fetch,
    sleep: async (ms) => {
      this.sleeps.push(ms);
      this.clock += ms;
    },
    now: () => this.clock,
  };

  posts(token?: string): Call[] {
    return this.calls.filter((c) => c.method === 'POST' && (token === undefined || c.token === token));
  }

  private reply(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
  }

  private handle(url: string, init?: RequestInit): Response {
    const method = init?.method ?? 'GET';
    const path = url.replace('https://api.pixellab.ai/v2', '');
    const token = (((init?.headers ?? {}) as Record<string, string>)['Authorization'] ?? '').replace('Bearer ', '');
    this.calls.push({ method, path, token });
    if (path === '/balance') return this.reply(200, { subscription: { generations: token === PAID ? 5000 : 0, plan: 'x' }, credits: { usd: 0 } });
    const scripted = this.failWith.get(token)?.shift();
    if (scripted !== undefined) return this.reply(scripted, { detail: scripted === 402 ? 'Insufficient credits' : `fault ${token}` });
    if (this.slot429 > 0) {
      this.slot429 -= 1;
      return this.reply(429, { detail: 'Not enough concurrent job slots' });
    }
    this.bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const left = this.gives.get(token) ?? 0;
    if (left <= 0) return this.reply(402, { detail: 'Insufficient credits' });
    this.gives.set(token, left - 1);
    return this.reply(200, { image: { type: 'base64', base64: png() }, usage: { type: 'generations', generations: 1 } });
  }
}

const POOL: PoolConfig = parsePoolConfig(readFileSync(join(REPO_ROOT, 'tools/kit-gen/pixellab/pool.json'), 'utf8'));
const QUEUE: Queue = parseQueue(readFileSync(join(REPO_ROOT, 'tools/kit-gen/pixellab/daily-queue.json'), 'utf8'));

function deps(night: Night, over: Partial<NightlyDeps> = {}): { deps: NightlyDeps; said: string[]; read: string[]; out: string } {
  const said: string[] = [];
  const read: string[] = [];
  const out = folder('out');
  return {
    deps: {
      http: night.http,
      config: POOL,
      readToken: (_c, a) => {
        read.push(a.file);
        return TOKENS[a.file] ?? null;
      },
      queue: QUEUE,
      done: new Set(),
      out,
      date: '2026-11-03',
      say: (t) => said.push(t),
      clientOptions: { slotBackoffMs: [10_000, 20_000], slotWaitMs: 600_000 },
      ...over,
    },
    said,
    read,
    out,
  };
}

describe('the queue file of the repo', () => {
  test('it holds at least 30 distinct small pieces, each with a source, and none the kit already has', () => {
    expect(QUEUE.pieces.length).toBeGreaterThanOrEqual(30);
    expect(new Set(QUEUE.pieces.map((p) => p.id)).size).toBe(QUEUE.pieces.length);
    const kit = (JSON.parse(readFileSync(join(REPO_ROOT, 'content/kit/core/kit.json'), 'utf8')) as { kit: { sprites: Record<string, unknown> } }).kit.sprites;
    // hyphen and underscore are one name here: the kit's `old-coin` and a queue id `old_coin` are the same piece
    const names = new Set(Object.keys(kit).map((k) => (k.split('/').pop() as string).replace(/-/g, '_')));
    expect(names.has('old_coin') || names.size > 100).toBe(true);
    for (const p of QUEUE.pieces) {
      expect(names.has(p.id), `${p.id} is already a sprite of the kit`).toBe(false);
      expect(p.source.length).toBeGreaterThan(3);
    }
    expect(QUEUE.view).toBe('high top-down');
  });

  test('a piece cannot name an account, repeat, or leave out what it needs', () => {
    const base = { size: 64, view: 'high top-down', outline: 'lineless', shading: 'detailed shading', detail: 'highly detailed' };
    const piece = { id: 'a_b', what: 'x', class: 'prop', source: 's' };
    expect(() => parseQueue(JSON.stringify({ ...base, pieces: [{ ...piece, account: 1 }] }))).toThrow(/has the key "account"/);
    expect(() => parseQueue(JSON.stringify({ ...base, pieces: [piece, piece] }))).toThrow(/listed twice/);
    expect(() => parseQueue(JSON.stringify({ ...base, pieces: [{ ...piece, class: 'tree' }] }))).toThrow(/expected pickup or prop/);
    expect(() => parseQueue(JSON.stringify({ ...base, pieces: [{ ...piece, id: 'Bad Id' }] }))).toThrow(/lowercase/);
    expect(() => parseQueue(JSON.stringify({ ...base, pieces: [] }))).toThrow(/at least one/);
    expect(() => parseQueue(JSON.stringify({ ...base, size: 1000, pieces: [piece] }))).toThrow(/16 to 400/);
  });

  test('a piece becomes the repository\'s own fill request at the game\'s camera, on a transparent ground', () => {
    const { body } = bodyFor(QUEUE.pieces[0]!, QUEUE, 7);
    expect(body).toMatchObject({ image_size: { width: 64, height: 64 }, view: 'high top-down', outline: 'lineless', no_background: true, seed: 7 });
    expect(String(body['description'])).toBe(promptFor(QUEUE.pieces[0]!));
    expect(body).not.toHaveProperty('init_image');
  });
});

describe('who the nightly job may spend on', () => {
  test('the repository\'s pool gives three free accounts and never the paid one', () => {
    expect(nightlyIndexes(POOL).map((i) => POOL.accounts[i]?.label)).toEqual(['current', 'trial2', 'trial3']);
  });

  test('every free account refused and the paid one holding 5,000: no call carries the paid token and its file is never read', async () => {
    const night = new Night();
    const r = deps(night);
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.made).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(result.accounts.map((a) => [a.label, a.outcome])).toEqual([['current', 'refused'], ['trial2', 'refused'], ['trial3', 'refused']]);
    expect(night.calls.some((c) => c.token === PAID)).toBe(false);
    expect(r.read).toEqual(['pixellab-token.txt', 'pixellab-token-trial2.txt', 'pixellab-token-trial3.txt']);
    expect(r.read).not.toContain('pixellab-token-trial1.txt');
    // the free accounts were tried although the balance read 0: the balance is not trusted
    expect(night.posts()).toHaveLength(3);
  });

  test('a config that marks the paid account nightly does not parse, and a hand-built one that does is stopped in the loop', async () => {
    const bad = JSON.stringify({ accounts: [{ file: 'pixellab-token-trial1.txt', label: 'trial1', slots: 10, plan: 'paid', nightly: true }] });
    expect(() => parsePoolConfig(bad)).toThrow(/cannot be marked "nightly"/);
    const night = new Night();
    night.gives.set(PAID, 50);
    const forged: PoolConfig = { dir: 'x', accounts: [{ file: 'pixellab-token-trial1.txt', label: 'trial1', slots: 10, plan: 'paid', nightly: true }] };
    // nightlyIndexes already leaves it out, so the run finds no account at all and makes nothing
    const r = deps(night, { config: forged });
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.made).toEqual([]);
    expect(result.failures[0]).toMatch(/no account marked nightly/);
    expect(night.calls).toEqual([]);
    expect(r.read).toEqual([]);
  });
});

describe('a night', () => {
  test('each free account gives until the server answers 402, and a piece is drawn once, in queue order', async () => {
    const night = new Night();
    night.gives.set('tk-FAKE-current-0001', 3);
    night.gives.set('tk-FAKE-trial2-0003', 2);
    const r = deps(night);
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.failures).toEqual([]);
    expect(result.made.map((m) => m.id)).toEqual(QUEUE.pieces.slice(0, 5).map((p) => p.id));
    expect(result.accounts.map((a) => [a.label, a.given, a.outcome, a.apiBalance])).toEqual([['current', 3, 'refused', 0], ['trial2', 2, 'refused', 0], ['trial3', 0, 'refused', 0]]);
    const first = result.made[0]!;
    expect(first.account).toBe('current');
    expect(existsSync(first.file)).toBe(true);
    const side = JSON.parse(readFileSync(first.file.replace(/\.png$/, '.json'), 'utf8')) as Record<string, unknown>;
    expect(side).toMatchObject({ date: '2026-11-03', seed: first.seed });
    expect(String(side['tool'])).toMatch(/^pixellab \/create-image-pixflux \{/);
    expect(String(side['prompt'])).toContain(QUEUE.pieces[0]!.what);
    for (const f of readdirSync(r.out)) expect(readFileSync(join(r.out, f)).toString('latin1')).not.toContain('tk-FAKE');
  });

  test('pieces already made are skipped, so a night after a night continues the queue', async () => {
    const night = new Night();
    night.gives.set('tk-FAKE-current-0001', 2);
    const done = new Set(QUEUE.pieces.slice(0, 4).map((p) => p.id));
    const r = deps(night, { done });
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.made.map((m) => m.id)).toEqual(QUEUE.pieces.slice(4, 6).map((p) => p.id));
  });

  test('the cap per account stops a loop that would otherwise spend a stored 20 and more', async () => {
    const night = new Night();
    night.gives.set('tk-FAKE-current-0001', 500);
    const r = deps(night);
    const result = await runNightly(r.deps, { maxPerAccount: 6 });
    expect(result.accounts[0]).toMatchObject({ label: 'current', given: 6, outcome: 'cap' });
    expect(night.posts('tk-FAKE-current-0001')).toHaveLength(6);
  });

  test('a 429 (no free slot) is waited out and the piece is made; it is not "none today" and not a failure', async () => {
    const night = new Night();
    night.gives.set('tk-FAKE-current-0001', 1);
    night.slot429 = 2;
    const r = deps(night);
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.failures).toEqual([]);
    expect(result.made).toHaveLength(1);
    expect(night.sleeps).toEqual([10_000, 20_000]);
  });

  test('anything but 402 is a failure that ends that account only: the others still run', async () => {
    const night = new Night();
    night.gives.set('tk-FAKE-current-0001', 5);
    night.gives.set('tk-FAKE-trial3-0004', 1);
    night.failWith.set('tk-FAKE-current-0001', [401]); // the first post of the first account
    const r = deps(night);
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.accounts.map((a) => [a.label, a.outcome])).toEqual([['current', 'failed'], ['trial2', 'refused'], ['trial3', 'refused']]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('current');
    // the piece the failed account could not draw went to the next account that gave
    expect(result.made.map((m) => [m.id, m.account])).toEqual([[QUEUE.pieces[0]!.id, 'trial3']]);
    expect(night.calls.some((c) => c.token === PAID)).toBe(false);
  });

  test('a server error is a failure too: it may have been charged, so the account stops', async () => {
    const night = new Night();
    night.gives.set('tk-FAKE-current-0001', 5);
    night.failWith.set('tk-FAKE-current-0001', [503]);
    const r = deps(night);
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.accounts[0]).toMatchObject({ outcome: 'failed' });
    expect(night.posts('tk-FAKE-current-0001')).toHaveLength(1);
  });

  test('an account with no token file is skipped and said', async () => {
    const night = new Night();
    const r = deps(night, { readToken: (_c, a) => (a.file === 'pixellab-token-trial2.txt' ? null : TOKENS[a.file] ?? null) });
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(result.accounts.map((a) => a.outcome)).toEqual(['refused', 'no-token', 'refused']);
    expect(r.said.join('\n')).toMatch(/trial2: no token file, skipped/);
    expect(result.failures).toEqual(['trial2: no token file']);
  });

  test('a free-labelled account whose balance reads more than a free account stores gets no post (a swapped token file)', async () => {
    const night = new Night();
    night.gives.set(PAID, 50);
    // the second nightly account's file holds the paid token: it reads 5000
    const r = deps(night, { readToken: (_c, a) => (a.file === 'pixellab-token-trial2.txt' ? PAID : TOKENS[a.file] ?? null) });
    const result = await runNightly(r.deps, { maxPerAccount: 25 });
    expect(night.posts(PAID)).toEqual([]);
    expect(result.accounts[1]).toMatchObject({ label: 'trial2', outcome: 'failed', apiBalance: 5000 });
    expect(result.failures.some((f) => /more than a free account stores/.test(f))).toBe(true);
    expect(result.made).toEqual([]);
  });
});

describe('the command', () => {
  function rig(): { root: string; state: string; io: NightlyIo; night: Night; said: string[]; pushed: { folder: string; label: string }[] } {
    const root = folder('root');
    const state = folder('state');
    mkdirSync(join(root, 'tools/kit-gen/pixellab'), { recursive: true });
    for (const f of ['pool.json', 'daily-queue.json']) copyFileSync(join(REPO_ROOT, 'tools/kit-gen/pixellab', f), join(root, 'tools/kit-gen/pixellab', f));
    const night = new Night();
    const said: string[] = [];
    const pushed: { folder: string; label: string }[] = [];
    const io: NightlyIo = {
      http: night.http,
      readToken: (_c, a) => TOKENS[a.file] ?? null,
      root,
      push: (f, label) => {
        pushed.push({ folder: f, label });
        return 0;
      },
      say: (t) => said.push(t),
      today: () => '2026-11-03',
    };
    return { root, state, io, night, said, pushed };
  }

  test('--dry-run calls nothing, not even /balance, and writes nothing', async () => {
    const r = rig();
    const before = readdirSync(r.root, { recursive: true }).sort();
    const code = await nightlyMain(['--dry-run', '--state', r.state], r.io);
    expect(code).toBe(0);
    expect(r.night.calls).toEqual([]);
    expect(readdirSync(r.root, { recursive: true }).sort()).toEqual(before);
    expect(readdirSync(r.state)).toEqual([]);
    expect(r.said.join('\n')).toMatch(/accounts current, trial2, trial3/);
    expect(r.said.join('\n')).toMatch(/nothing is called and nothing is written/);
  });

  test('a live night writes the state, the log and the push, ends 0 when every account was only refused, and the next night continues', async () => {
    const r = rig();
    r.night.gives.set('tk-FAKE-current-0001', 2);
    r.night.gives.set('tk-FAKE-trial2-0003', 1);
    const code = await nightlyMain(['--state', r.state], r.io);
    expect(code).toBe(0);
    expect(r.pushed).toHaveLength(1);
    expect(r.pushed[0]!.label).toBe('pixellab-nightly-2026-11-03');
    expect(readdirSync(r.pushed[0]!.folder).filter((f) => f.endsWith('.png'))).toHaveLength(3);
    const logPath = join(r.root, 'tools/kit-gen/pixellab/nightly-log.jsonl');
    const log = readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ date: '2026-11-03', made: QUEUE.pieces.slice(0, 3).map((p) => p.id) });
    expect((log[0]!['accounts'] as { label: string; given: number }[]).map((a) => [a.label, a.given])).toEqual([['current', 2], ['trial2', 1], ['trial3', 0]]);
    expect(readFileSync(logPath, 'utf8')).not.toContain('tk-FAKE');
    expect(doneIds(r.root, r.state).size).toBe(3);
    expect(r.said.at(-1)).toMatch(/^RESULT \{"date":"2026-11-03","made":3,"failures":\[\],"pushFailed":false\}$/);

    r.night.gives.set('tk-FAKE-current-0001', 1);
    await nightlyMain(['--state', r.state, '--date', '2026-11-04'], r.io);
    expect(doneIds(r.root, r.state).has(QUEUE.pieces[3]!.id)).toBe(true);
    expect(doneIds(r.root, r.state).size).toBe(4);
    expect(r.night.calls.some((c) => c.token === PAID)).toBe(false);
  });

  test('a night that gave nothing is a refusal, not a failure: exit 0, nothing pushed, and the log still says what each account gave', async () => {
    const r = rig();
    const code = await nightlyMain(['--state', r.state], r.io);
    expect(code).toBe(0);
    expect(r.pushed).toEqual([]);
    const log = JSON.parse(readFileSync(join(r.root, 'tools/kit-gen/pixellab/nightly-log.jsonl'), 'utf8').trim()) as { made: string[]; accounts: { outcome: string }[] };
    expect(log.made).toEqual([]);
    expect(log.accounts.map((a) => a.outcome)).toEqual(['refused', 'refused', 'refused']);
  });

  test('a real failure ends 1, and the pictures made by the other accounts are still kept and pushed', async () => {
    const r = rig();
    r.night.gives.set('tk-FAKE-trial2-0003', 1);
    r.night.failWith.set('tk-FAKE-current-0001', [401]);
    const code = await nightlyMain(['--state', r.state], r.io);
    expect(code).toBe(1);
    expect(r.pushed).toHaveLength(1);
    expect(r.said.at(-1)).toMatch(/"failures":\["current on /);
  });

  test('the log line of a night carries the outcome of each account and no token', () => {
    const line = logLine({ date: 'd', made: [{ id: 'x', account: 'a', file: 'f', seed: 1 }], failures: [], accounts: [{ label: 'a', given: 1, outcome: 'refused', error: null, apiBalance: 0 }] });
    expect(JSON.parse(line)).toEqual({ date: 'd', accounts: [{ label: 'a', given: 1, outcome: 'refused', apiBalance: 0 }], made: ['x'] });
  });
});

describe('the files that install it', () => {
  const dir = join(REPO_ROOT, 'tools/art-pixellab');
  test('the timer is 02:30 Israel time, persistent, and never wakes the machine', () => {
    const timer = readFileSync(join(dir, 'art-pixellab-nightly.timer'), 'utf8');
    expect(timer).toMatch(/^OnCalendar=\*-\*-\* 02:30:00 Asia\/Jerusalem$/m);
    expect(timer).toMatch(/^Persistent=true$/m);
    expect(timer).not.toMatch(/^WakeSystem=/m);
    const service = readFileSync(join(dir, 'art-pixellab-nightly.service'), 'utf8');
    expect(service).toMatch(/^ExecStart=%h\/\.local\/share\/art-pixellab\/nightly\.sh$/m);
  });

  test('the script works in a checkout of its own and does not switch the GitHub account of the machine', () => {
    const sh = readFileSync(join(dir, 'nightly.sh'), 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
    expect(sh).toContain('CHECKOUT=${ART_PIXELLAB_CHECKOUT:-$HOME/.cache/art-pixellab/checkout}');
    expect(sh).not.toMatch(/gh auth switch/);
    expect(sh).toContain('gh auth token --user');
    expect(sh).not.toMatch(/trial1/);
  });
});
