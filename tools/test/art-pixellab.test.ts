import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { type Http } from '../src/art/pixellab/api.js';
import { cutSheet } from '../src/art/pixellab/cut.js';
import { Ledger, parseLedger } from '../src/art/pixellab/ledger.js';
import { findImages, findUrls, shapeOf } from '../src/art/pixellab/payload.js';
import { Pool, nightlyIndexes, parsePoolConfig, type PoolConfig } from '../src/art/pixellab/pool.js';
import { gridVariants, parseRef, plan, seedFor, type JobSpec, type PlanContext } from '../src/art/pixellab/recipes.js';
import { jobKey, orderJobs, parseSpec, runSpec, type RunDeps, type RunOptions } from '../src/art/pixellab/run.js';
import { REPO_ROOT } from '../src/load.js';

const TOKENS = ['tk-FAKE-aaaa-0000', 'tk-FAKE-bbbb-1111', 'tk-FAKE-cccc-2222'];
const scratch = mkdtempSync(join(tmpdir(), 'art-pixellab-'));
const realFetch = globalThis.fetch;

beforeAll(() => {
  // a test that reaches the real network would spend the owner's generations: any unmocked call stops the test
  globalThis.fetch = (() => {
    throw new Error('network is not allowed in tests');
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  rmSync(scratch, { recursive: true, force: true });
});

let counter = 0;
function folder(name: string): string {
  const dir = join(scratch, `${name}-${(counter += 1)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function png(w: number, h: number, colour: [number, number, number] = [200, 50, 50]): Buffer {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i += 1) {
    p.data[i * 4] = colour[0];
    p.data[i * 4 + 1] = colour[1];
    p.data[i * 4 + 2] = colour[2];
    p.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(p);
}

/* ---- a PixelLab that lives in memory ---- */

interface Call { method: string; path: string; body: Record<string, unknown> | null; token: string }

class FakeApi {
  balances = new Map<string, number>();
  usd = new Map<string, number>();
  calls: Call[] = [];
  clock = 0;
  sleeps: number[] = [];
  /** Answers 429 to this many posts before accepting one. */
  slot429 = 0;
  /** The next post is charged and then the network drops. */
  dropAfterCharge = 0;
  /** The next post fails with 500 without being charged. */
  fail500 = 0;
  /** Downloads that fail (all of them, for good) while true. */
  downloadsDown = false;
  /** The response of a background job reports this many USD charged. */
  chargeUsd = 0;
  private jobs = new Map<string, { kind: string; polls: number; images: string[]; failed: boolean }>();
  private characters = new Map<string, { token: string; animations: { animation_group_id: string; directions: { direction: string; frames: string[] }[] }[] }>();
  private next = 0;

  constructor(balances: Record<string, number>) {
    for (const [t, n] of Object.entries(balances)) this.balances.set(t, n);
  }

  readonly http: Http = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => this.handle(String(input), init)) as typeof fetch,
    sleep: async (ms) => {
      this.sleeps.push(ms);
      this.clock += ms;
    },
    now: () => this.clock,
  };

  posts(path?: string): Call[] {
    return this.calls.filter((c) => c.method === 'POST' && (path === undefined || c.path === path));
  }

  private respond(status: number, body: unknown): Response {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }

  private charge(token: string, n: number): void {
    this.balances.set(token, (this.balances.get(token) ?? 0) - n);
  }

  private async handle(url: string, init?: RequestInit): Promise<Response> {
    const method = init?.method ?? 'GET';
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const token = (headers['Authorization'] ?? '').replace('Bearer ', '');
    if (url.startsWith('https://storage.test/')) {
      this.calls.push({ method, path: url, body: null, token: '' });
      if (this.downloadsDown) throw new Error(`connection reset by peer (${token})`);
      return new Response(new Uint8Array(png(8, 8)), { status: 200 });
    }
    const path = url.replace('https://api.pixellab.ai/v2', '');
    const body = init?.body === undefined ? null : (JSON.parse(String(init.body)) as Record<string, unknown>);
    this.calls.push({ method, path, body, token });
    if (!this.balances.has(token)) return this.respond(401, { detail: 'bad token' });
    if (method === 'GET' && path === '/balance') {
      return this.respond(200, { credits: { type: 'usd', usd: this.usd.get(token) ?? 0 }, subscription: { type: 'generations', generations: this.balances.get(token), plan: 'trial', status: 'active' } });
    }
    if (method === 'GET' && path.startsWith('/background-jobs/')) {
      const job = this.jobs.get(path.split('/').pop() as string);
      if (job === undefined) return this.respond(404, { detail: 'no job' });
      job.polls += 1;
      if (job.polls < 2) return this.respond(200, { status: 'processing' });
      if (job.failed) return this.respond(200, { status: 'failed', last_response: { detail: 'model error' } });
      return this.respond(200, { status: 'completed', last_response: { images: job.images }, usage: { generations: 0, usd: this.chargeUsd } });
    }
    if (method === 'GET' && path.startsWith('/characters/')) {
      const c = this.characters.get(path.split('/').pop() as string);
      if (c === undefined) return this.respond(404, { detail: 'no character' });
      return this.respond(200, { id: path.split('/').pop(), rotations: { south: 'https://storage.test/c/south.png', east: 'https://storage.test/c/east.png' }, animations: c.animations });
    }
    if (method === 'POST') {
      if (this.slot429 > 0) {
        this.slot429 -= 1;
        return this.respond(429, { detail: 'Not enough concurrent job slots' });
      }
      if (this.fail500 > 0) {
        this.fail500 -= 1;
        return this.respond(500, { detail: 'oops' });
      }
      const id = `job${(this.next += 1)}`;
      const price = ({ '/create-image-pixflux': 1, '/rotate': 3, '/generate-image-v2': 10, '/create-character-v3': 2, '/animate-character': (body?.['directions'] as unknown[] | undefined)?.length ?? 1, '/generate-8-rotations-v3': 4 } as Record<string, number>)[path] ?? 1;
      this.charge(token, price);
      if (this.dropAfterCharge > 0) {
        this.dropAfterCharge -= 1;
        throw new Error(`socket hang up (${token})`);
      }
      const sync = path === '/create-image-pixflux' || path === '/rotate' || path === '/image-to-pixelart';
      if (sync) return this.respond(200, { image: { type: 'base64', base64: png(16, 16).toString('base64') }, usage: { usd: this.chargeUsd } });
      this.jobs.set(id, { kind: path, polls: 0, images: path === '/generate-image-v2' ? [png(8, 8).toString('base64'), png(8, 8, [10, 200, 10]).toString('base64')] : [png(8, 8).toString('base64')], failed: false });
      if (path === '/create-character-v3') {
        this.characters.set('char1', { token, animations: [] });
        return this.respond(200, { character_id: 'char1', background_job_id: id });
      }
      if (path === '/animate-character') {
        const character = this.characters.get(String(body?.['character_id']));
        if (character === undefined || character.token !== token) return this.respond(404, { detail: 'character not found on this account' });
        const group = `group${this.next}`;
        const directions = (body?.['directions'] as string[]).map((d) => ({ direction: d, frames: [0, 1, 2].map((n) => `https://storage.test/anim/${group}/${d}-${n}.png`) }));
        character.animations.push({ animation_group_id: group, directions });
        return this.respond(200, { background_job_ids: directions.map((_, n) => `${id}-${n}`), animation_group_id: group }).also(() => directions.forEach((_, n) => this.jobs.set(`${id}-${n}`, { kind: path, polls: 0, images: [], failed: false })));
      }
      return this.respond(200, { background_job_id: id });
    }
    return this.respond(404, { detail: 'unknown route' });
  }
}

declare global {
  interface Response { also: (f: () => void) => Response }
}
Response.prototype.also = function also(this: Response, f: () => void): Response {
  f();
  return this;
};

/* ---- a run in a temporary repo ---- */

interface Rig {
  dir: string;
  api: FakeApi;
  ledgerPath: string;
  said: string[];
  pushed: string[];
  deps: RunDeps;
  spec: (name: string, jobs: JobSpec[], extra?: Record<string, unknown>) => string;
}

const OPTIONS: RunOptions = { dryRun: false, push: true, maxGenerations: null, only: null, retryPaidFailures: false };

function rig(balances: number[], config?: Partial<PoolConfig>): Rig {
  const dir = folder('rig');
  const api = new FakeApi(Object.fromEntries(balances.map((n, i) => [TOKENS[i] as string, n])));
  const said: string[] = [];
  const pushed: string[] = [];
  const poolConfig: PoolConfig = config?.accounts === undefined
    ? { dir: 'unused', accounts: balances.map((_, i) => ({ file: `acct${i}.txt`, label: `acct${i}`, slots: 1 })) }
    : { dir: 'unused', accounts: config.accounts };
  const deps: RunDeps = {
    http: api.http,
    config: poolConfig,
    readToken: (_c, account) => TOKENS[Number(/acct(\d)/.exec(account.file)?.[1])] ?? null,
    ledgerPath: join(dir, 'ledger.jsonl'),
    root: dir,
    push: (folderPath, label, provenance) => void pushed.push(`${folderPath}|${label}|${provenance}`),
    say: (t) => void said.push(t),
    clock: () => new Date('2026-11-02T10:00:00Z'),
    client: { pollIntervalMs: 10, slotBackoffMs: [10_000, 20_000, 30_000], slotWaitMs: 600_000 },
  };
  const spec = (name: string, jobs: JobSpec[], extra: Record<string, unknown> = {}): string => {
    const path = join(dir, `${name}.json`);
    writeFileSync(path, JSON.stringify({ name, jobs, ...extra }));
    return path;
  };
  return { dir, api, ledgerPath: deps.ledgerPath, said, pushed, deps, spec };
}

const fill = (id = 'f1', extra: Record<string, unknown> = {}): JobSpec => ({ id, recipe: 'fill', inputs: { description: 'a stone well', size: 64, ...extra } });

function everything(r: Rig): string {
  return [r.said.join('\n'), existsSync(r.ledgerPath) ? readFileSync(r.ledgerPath, 'utf8') : ''].join('\n');
}

describe('recipes: what a spec may ask for', () => {
  const ctx = (jobs: JobSpec[], base = scratch, measured: PlanContext['measured'] = () => null): PlanContext => ({ base, jobs: new Map(jobs.map((j) => [j.id, j])), measured });

  test('a fill from a picture at the API default strength is refused unless the job says it is the same family', () => {
    const dir = folder('init');
    writeFileSync(join(dir, 'grid.png'), png(8, 8));
    const bare = fill('f', { init_image: 'grid.png' });
    const refused = plan(bare, ctx([bare], dir));
    expect(refused.issues.join(' ')).toMatch(/init strength 300 .*API default.* over 150/);
    expect(refused.issues.join(' ')).toMatch(/allow_strong_init/);
    const low = fill('f', { init_image: 'grid.png', init_strength: 120 });
    expect(plan(low, ctx([low], dir)).issues).toEqual([]);
    const strongOk: JobSpec = { ...fill('f', { init_image: 'grid.png', init_strength: 250 }), allow_strong_init: true };
    expect(plan(strongOk, ctx([strongOk], dir)).issues).toEqual([]);
    const strongNo = fill('f', { init_image: 'grid.png', init_strength: 250 });
    expect(plan(strongNo, ctx([strongNo], dir)).issues).toHaveLength(1);
  });

  test('sizes over the API limits and pictures that are not on disk are caught before any money moves', () => {
    expect(plan(fill('f', { size: 401 }), ctx([])).issues.join(' ')).toMatch(/400/);
    const missing = fill('f', { init_image: 'nope.png', init_strength: 100 });
    expect(plan(missing, ctx([missing])).issues.join(' ')).toMatch(/not on disk/);
    const kf: JobSpec = { id: 'k', recipe: 'keyframes', inputs: { first_frame: 'a.png', action: 'walk', frame_count: 16 } };
    const dir = folder('kf');
    writeFileSync(join(dir, 'a.png'), png(200, 200));
    expect(plan(kf, ctx([kf], dir)).issues.join(' ')).toMatch(/524288/);
  });

  test('costs: measured and published numbers, and "unknown" is never zero', () => {
    const grid: JobSpec = { id: 'g', recipe: 'grid', inputs: { description: 'x', cell: 64 } };
    expect(plan(grid, ctx([grid])).cost).toMatchObject({ gens: 10, basis: 'measured' });
    expect(plan(fill(), ctx([])).cost.gens).toBe(1);
    const fx: JobSpec = { id: 'e', recipe: 'effect', inputs: { description: 'flash', artist: 'pro' } };
    expect(plan(fx, ctx([fx])).cost.gens).toBe(6);
    const chScratch: JobSpec = { id: 'c', recipe: 'character', inputs: { description: 'a man', size: 64 } };
    expect(plan(chScratch, ctx([chScratch])).cost).toMatchObject({ gens: 2, basis: 'published' });
    const rot: JobSpec = { id: 'r', recipe: 'rotate', inputs: { from_image: 'x.png', size: 128, from_view: 'side', to_view: 'high top-down' } };
    const dir = folder('rot');
    writeFileSync(join(dir, 'x.png'), png(128, 128));
    expect(plan(rot, ctx([rot], dir)).cost).toMatchObject({ gens: null, basis: 'unknown' });
    expect(plan(rot, ctx([rot], dir, (r) => (r === 'rotate' ? 3 : null))).cost).toMatchObject({ gens: 3, basis: 'measured' });
  });

  test('a Pro grid returns as many variants as the API table says', () => {
    expect([32, 64, 128, 200, 85, 50, 40, 34, 70].map(gridVariants)).toEqual([64, 16, 4, 1, 16, 25, 36, 49, 9]);
  });

  test('a motion on a character reads the character job: the account pin and the canvas set its price', () => {
    const jobs: JobSpec[] = [
      { id: 'c', recipe: 'character', inputs: { description: 'a man', size: 128 } },
      { id: 'walk', recipe: 'motion', inputs: { character: '@c.character', action: 'walk', directions: ['south', 'east'] } },
    ];
    const planned = plan(jobs[1] as JobSpec, ctx(jobs));
    expect(planned.characterOf).toBe('c');
    expect(planned.cost).toMatchObject({ gens: 4, basis: 'measured' });
    expect(parseRef('@c#2')).toEqual({ job: 'c', index: 2, character: false });
    expect(parseRef('@c#*')).toEqual({ job: 'c', index: 'all', character: false });
    expect(parseRef('a.png')).toBeNull();
  });

  test('the seed follows the key, and the key follows what the job asks', () => {
    const dir = folder('key');
    writeFileSync(join(dir, 'a.png'), png(8, 8));
    const job = fill('f', { init_image: 'a.png', init_strength: 100 });
    const a = jobKey('s', job, dir, []);
    expect(jobKey('s', job, dir, [])).toBe(a);
    writeFileSync(join(dir, 'a.png'), png(8, 8, [1, 2, 3]));
    expect(jobKey('s', job, dir, [])).not.toBe(a);
    expect(jobKey('s', fill('f', { description: 'other' }), dir, [])).not.toBe(jobKey('s', fill('f'), dir, []));
    expect(seedFor(a)).toBe(seedFor(a));
    expect(seedFor(a)).toBeLessThan(2_147_483_647);
  });

  test('spec parsing: duplicate ids, unknown recipes and read-each-other circles are named', () => {
    expect(() => parseSpec('{"name":"x","jobs":[{"id":"a","recipe":"fill","inputs":{}},{"id":"a","recipe":"fill","inputs":{}}]}')).toThrow(/two jobs are called "a"/);
    expect(() => parseSpec('{"name":"x","jobs":[{"id":"a","recipe":"paint","inputs":{}}]}')).toThrow(/recipes are/);
    const jobs: JobSpec[] = [{ id: 'a', recipe: 'fill', inputs: {} }, { id: 'b', recipe: 'fill', inputs: {} }];
    expect(() => orderJobs(jobs, (j) => (j.id === 'a' ? ['b'] : ['a']))).toThrow(/circle: a -> b -> a/);
  });
});

describe('payload readers', () => {
  test('pictures are found wherever the answer keeps them, and their key structure is kept without the data', () => {
    const data = png(2, 2).toString('base64');
    const answer = { last_response: { images: [{ base64: data }, { image: `data:image/png;base64,${data}x` }], links: { a: 'https://storage.test/a.png' } } };
    expect(findImages(answer)).toHaveLength(2);
    expect(findUrls(answer)).toEqual([{ path: 'last_response.links.a', url: 'https://storage.test/a.png' }]);
    expect(shapeOf(answer).join(' ')).not.toContain(data);
    expect(shapeOf(answer)).toContain('last_response.images[].base64:string');
  });
});

describe('the pool', () => {
  const account = (index: number, left: number, slots = 1) => ({ index, label: `a${index}`, slots, client: null as never, left, usd: 0, busy: 0, dead: null });

  test('the account with the fewest generations that still covers the job takes it; a full account waits; a poor pool is "no room"', () => {
    const a = account(0, 50);
    const b = account(1, 12);
    const c = account(2, 3);
    const pool = Pool.of([a, b, c]);
    expect(pool.choose(10)).toMatchObject({ ok: true, account: b });
    expect(pool.choose(1)).toMatchObject({ ok: true, account: c });
    pool.admit(b, 10);
    expect(pool.choose(2)).toMatchObject({ ok: true, account: c });
    expect(pool.choose(40)).toMatchObject({ ok: true, account: a });
    pool.admit(a, 40);
    expect(pool.choose(5)).toEqual({ ok: false, reason: 'busy' });
    expect(pool.choose(60)).toMatchObject({ ok: false, reason: 'no-room' });
    pool.release(a, 40, 40);
    expect(a.left).toBe(10);
    expect(pool.choose(5, 2)).toEqual({ ok: false, reason: 'no-room', best: 3, pinned: 3 });
  });

  test('the config lists accounts in a fixed order with slots, and a missing token file is skipped, not guessed', async () => {
    const config = parsePoolConfig(JSON.stringify({ accounts: [{ file: 'acct0.txt', label: 'main', slots: 10 }, { file: 'acct1.txt' }] }));
    expect(config.accounts.map((a) => [a.label, a.slots])).toEqual([['main', 10], ['acct1', 1]]);
    expect(() => parsePoolConfig('{"accounts":[]}')).toThrow(/at least one/);
    const r = rig([5]);
    const pool = await Pool.open(config, (_c, a) => (a.file === 'acct0.txt' ? TOKENS[0] as string : null), r.api.http, {}, (t) => r.said.push(t));
    expect(pool.accounts.map((a) => a.index)).toEqual([0]);
    expect(r.said.join(' ')).toMatch(/account 1 \(acct1\): no token file, skipped/);
  });

  test('an account is paid unless the config says free, and only a free one can be a nightly account', () => {
    const config = parsePoolConfig(JSON.stringify({ accounts: [{ file: 'a.txt' }, { file: 'b.txt', plan: 'free', nightly: true }, { file: 'c.txt', plan: 'free' }, { file: 'd.txt', plan: 'paid', slots: 10 }] }));
    expect(config.accounts.map((a) => [a.plan, a.nightly])).toEqual([['paid', false], ['free', true], ['free', false], ['paid', false]]);
    expect(nightlyIndexes(config)).toEqual([1]);
    expect(() => parsePoolConfig(JSON.stringify({ accounts: [{ file: 'a.txt', nightly: true }] }))).toThrow(/paid account and cannot be marked "nightly"/);
    expect(() => parsePoolConfig(JSON.stringify({ accounts: [{ file: 'a.txt', plan: 'paid', nightly: true }] }))).toThrow(/cannot be marked "nightly"/);
    expect(() => parsePoolConfig(JSON.stringify({ accounts: [{ file: 'a.txt', plan: 'pro' }] }))).toThrow(/expected "free" or "paid"/);
  });

  test('the config of the repo marks the paid account as paid and keeps it out of the nightly set', () => {
    const config = parsePoolConfig(readFileSync(join(REPO_ROOT, 'tools/kit-gen/pixellab/pool.json'), 'utf8'));
    const paid = config.accounts.filter((a) => a.plan === 'paid');
    expect(paid.map((a) => a.label)).toEqual(['trial1']);
    expect(paid[0]?.slots).toBe(10);
    expect(nightlyIndexes(config).map((i) => config.accounts[i]?.label)).toEqual(['current', 'trial2', 'trial3']);
  });
});

describe('the ledger', () => {
  test('it folds by key: the last phase wins, ids and files survive, the measured cost is the median of exact charges', () => {
    const path = join(folder('ledger'), 'l.jsonl');
    const ledger = new Ledger(path, () => new Date('2026-11-02T10:00:00Z'));
    const base = { key: 'k#1', spec: 's', job: 'j', recipe: 'motion', account: 1, label: 'a1' };
    ledger.append({ ...base, phase: 'started', before: 9 });
    ledger.append({ ...base, phase: 'submitted', ids: { background_job_ids: ['x'], animation_group_id: 'g' } });
    expect(ledger.state('k#1')).toMatchObject({ phase: 'submitted', before: 9, account: 1, ids: { animation_group_id: 'g' } });
    ledger.append({ ...base, phase: 'done', files: ['a.png'], spent: 2, exact: true });
    ledger.append({ ...base, key: 'k#2', phase: 'done', spent: 1, exact: true });
    ledger.append({ ...base, key: 'k#3', phase: 'done', spent: 7, exact: false });
    ledger.append({ ...base, key: 'k#4', phase: 'done', spent: null, exact: false });
    expect(new Ledger(path).state('k#1')).toMatchObject({ phase: 'done', files: ['a.png'] });
    expect(ledger.measured('motion')).toBe(1);
    expect(ledger.measured('rotate')).toBeNull();
    expect(parseLedger(readFileSync(path, 'utf8'))).toHaveLength(6);
  });
});

describe('--dry-run: the only live call is the balance, and nothing is written', () => {
  test('it prints generations per account and in total with "?" for a cost no one has measured, and writes no file', async () => {
    const r = rig([30, 4]);
    const dir = folder('dry');
    writeFileSync(join(dir, 'face.png'), png(32, 32));
    const spec = r.spec('dry', [
      { id: 'g', recipe: 'grid', inputs: { description: 'a well', cell: 64 } },
      fill('f'),
      { id: 'rot', recipe: 'rotate', inputs: { from_image: join(dir, 'face.png'), size: 32, from_view: 'side', to_view: 'high top-down' } },
    ]);
    const report = await runSpec(spec, r.deps, { ...OPTIONS, dryRun: true });
    const text = r.said.join('\n');
    expect(r.api.calls.every((c) => c.method === 'GET' && c.path === '/balance')).toBe(true);
    expect(r.api.calls).toHaveLength(2);
    expect(text).toMatch(/rotate\s+\? gen/);
    expect(text).toMatch(/holds\s+30 generations/);
    expect(text).toMatch(/total: 11 generations measured or published, plus 1 job of unknown cost \(\?\)/);
    expect(text).toMatch(/A live run needs --max-generations/);
    expect(report.ok).toBe(true);
    expect(existsSync(r.ledgerPath)).toBe(false);
    expect(existsSync(join(r.dir, '.scratch'))).toBe(false);
    expect(r.pushed).toEqual([]);
  });

  test('it reports a job no account can pay for and a spec that is wrong, and still calls nothing but the balance', async () => {
    const r = rig([5]);
    const spec = r.spec('dry2', [{ id: 'g', recipe: 'grid', inputs: { description: 'x', cell: 64 } }, fill('bad', { size: 999 })]);
    const report = await runSpec(spec, r.deps, { ...OPTIONS, dryRun: true });
    expect(report.ok).toBe(false);
    expect(r.said.join('\n')).toMatch(/SHORT: g needs 10 generations: no account has room/);
    expect(r.said.join('\n')).toMatch(/SPEC: bad: inputs.size is 999/);
    expect(r.api.posts()).toEqual([]);
  });
});

describe('a live run', () => {
  test('a fill is posted once, its picture and sidecar land on disk with the seed, the ledger keeps started and done, and no token is written anywhere', async () => {
    const r = rig([5]);
    const report = await runSpec(r.spec('live', [fill('f1')]), r.deps, OPTIONS);
    expect(report.ok).toBe(true);
    expect(report.spent).toBe(1);
    expect(r.api.posts()).toHaveLength(1);
    const body = r.api.posts()[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ view: 'high top-down', outline: 'lineless', shading: 'detailed shading', detail: 'highly detailed', image_size: { width: 64, height: 64 } });
    const out = join(r.dir, '.scratch/pixellab/live/f1');
    expect(readdirSync(out).sort()).toEqual(['f1.json', 'f1.png']);
    const side = JSON.parse(readFileSync(join(out, 'f1.json'), 'utf8')) as Record<string, unknown>;
    expect(side).toMatchObject({ prompt: 'a stone well', date: '2026-11-02', seed: body['seed'] });
    expect(String(side['tool'])).toMatch(/^pixellab \/create-image-pixflux \{/);
    const lines = parseLedger(readFileSync(r.ledgerPath, 'utf8'));
    expect(lines.map((l) => l.phase)).toEqual(['started', 'done']);
    expect(lines[1]).toMatchObject({ before: 5, after: 4, spent: 1, exact: true, account: 0, label: 'acct0', result: 'ok' });
    expect(r.pushed).toHaveLength(1);
    for (const token of TOKENS) {
      expect(everything(r)).not.toContain(token);
      expect(readFileSync(join(out, 'f1.json'), 'utf8')).not.toContain(token);
    }
  });

  test('a job whose cost no one has measured needs --max-generations, and nothing is posted without it', async () => {
    const r = rig([20]);
    writeFileSync(join(r.dir, 'a.png'), png(32, 32));
    const spec = r.spec('unk', [{ id: 'rot', recipe: 'rotate', inputs: { from_image: 'a.png', size: 32, from_view: 'side', to_view: 'high top-down' } }]);
    const refused = await runSpec(spec, r.deps, OPTIONS);
    expect(refused.ok).toBe(false);
    expect(r.said.join('\n')).toMatch(/no measured cost\. Run with --max-generations/);
    expect(r.api.posts()).toEqual([]);
    const low = await runSpec(spec, r.deps, { ...OPTIONS, maxGenerations: 1 });
    expect(low.ok).toBe(true);
    // the real cost (3 in the fake) is now in the ledger, and the next estimate reads it
    expect(new Ledger(r.ledgerPath).measured('rotate')).toBe(3);
  });

  test('an unknown-cost job runs alone and first; the others wait for it', async () => {
    const r = rig([30, 30]);
    writeFileSync(join(r.dir, 'a.png'), png(32, 32));
    const spec = r.spec('order', [fill('f1'), { id: 'rot', recipe: 'rotate', inputs: { from_image: 'a.png', size: 32, from_view: 'side', to_view: 'high top-down' } }, fill('f2', { description: 'another' })]);
    const report = await runSpec(spec, r.deps, { ...OPTIONS, maxGenerations: 10 });
    expect(report.ok).toBe(true);
    expect(r.api.posts().map((c) => c.path)).toEqual(['/rotate', '/create-image-pixflux', '/create-image-pixflux']);
  });

  test('--max-generations stops a run that would spend more than it allows', async () => {
    const r = rig([50]);
    const spec = r.spec('cap', [{ id: 'g', recipe: 'grid', inputs: { description: 'x', cell: 64 } }]);
    const report = await runSpec(spec, r.deps, { ...OPTIONS, maxGenerations: 5 });
    expect(report.ok).toBe(false);
    expect(r.api.posts()).toEqual([]);
  });

  test('a 429 (no free job slot) is waited out with growing pauses, not failed', async () => {
    const r = rig([5]);
    r.api.slot429 = 3;
    const report = await runSpec(r.spec('slots', [fill()]), r.deps, OPTIONS);
    expect(report.ok).toBe(true);
    expect(r.api.sleeps.filter((s) => s >= 10_000)).toEqual([10_000, 20_000, 30_000]);
    expect(r.api.posts()).toHaveLength(4);
    expect(parseLedger(readFileSync(r.ledgerPath, 'utf8')).at(-1)).toMatchObject({ spent: 1 });
  });

  test('a slot that never frees up gives up after the wait limit and says so', async () => {
    const r = rig([5]);
    r.api.slot429 = 1000;
    const report = await runSpec(r.spec('stuck', [fill()]), r.deps, OPTIONS);
    expect(report.ok).toBe(false);
    expect(report.outcomes[0]?.message).toMatch(/429/);
    expect(parseLedger(readFileSync(r.ledgerPath, 'utf8')).at(-1)).toMatchObject({ phase: 'failed', spent: 0 });
  });

  test('a response that charges dollars stops the run', async () => {
    const r = rig([5]);
    r.api.chargeUsd = 0.4;
    const report = await runSpec(r.spec('usd', [fill('a'), fill('b', { description: 'second' })]), r.deps, OPTIONS);
    expect(report.ok).toBe(false);
    expect(report.aborted).toMatch(/charged 0.4 USD/);
    expect(r.api.posts()).toHaveLength(1);
    expect(r.pushed).toEqual([]);
  });

  test('two jobs on two accounts run side by side; one account runs one job at a time', async () => {
    const r = rig([5, 5]);
    const report = await runSpec(r.spec('two', [fill('a'), fill('b', { description: 'two' })]), r.deps, OPTIONS);
    expect(report.outcomes.map((o) => o.account).sort()).toEqual([0, 1]);
    const solo = rig([5]);
    const second = await runSpec(solo.spec('solo', [fill('a'), fill('b', { description: 'two' })]), solo.deps, OPTIONS);
    expect(second.outcomes.map((o) => o.account)).toEqual([0, 0]);
    expect(parseLedger(readFileSync(solo.ledgerPath, 'utf8')).filter((l) => l.phase === 'done').every((l) => l.exact === true)).toBe(true);
  });

  test('a job done in the ledger is skipped on the next run: no post, no spend', async () => {
    const r = rig([5]);
    const spec = r.spec('again', [fill()]);
    await runSpec(spec, r.deps, OPTIONS);
    const before = r.api.posts().length;
    const again = await runSpec(spec, r.deps, OPTIONS);
    expect(again.outcomes[0]?.status).toBe('skipped');
    expect(r.api.posts()).toHaveLength(before);
    expect(r.api.balances.get(TOKENS[0] as string)).toBe(4);
  });

  test('an edited job is a new job: its old ledger line does not stand in for it', async () => {
    const r = rig([5]);
    await runSpec(r.spec('edit', [fill('f', { description: 'one' })]), r.deps, OPTIONS);
    const again = await runSpec(r.spec('edit', [fill('f', { description: 'two' })]), r.deps, OPTIONS);
    expect(again.outcomes[0]?.status).toBe('done');
    expect(r.api.posts()).toHaveLength(2);
  });
});

describe('characters and motions', () => {
  const chain = (): JobSpec[] => [
    { id: 'c', recipe: 'character', inputs: { description: 'a woman', size: 128 } },
    { id: 'walk', recipe: 'motion', inputs: { character: '@c.character', action: 'walk', directions: ['south', 'east'], size: 128 } },
  ];

  test('a motion runs on the account that made the character and its frames are collected by animation group', async () => {
    const r = rig([20, 3]);
    const report = await runSpec(r.spec('chain', chain()), r.deps, OPTIONS);
    expect(report.ok).toBe(true);
    const made = r.api.posts('/create-character-v3')[0] as Call;
    const moved = r.api.posts('/animate-character')[0] as Call;
    expect(moved.token).toBe(made.token);
    expect(moved.body).toMatchObject({ character_id: 'char1', mode: 'v3', directions: ['south', 'east'] });
    const files = readdirSync(join(r.dir, '.scratch/pixellab/chain/walk')).filter((f) => f.endsWith('.png'));
    expect(files).toEqual(['walk-east-00.png', 'walk-east-01.png', 'walk-east-02.png', 'walk-south-00.png', 'walk-south-01.png', 'walk-south-02.png']);
    expect(readdirSync(join(r.dir, '.scratch/pixellab/chain/c')).filter((f) => f.endsWith('.png')).sort()).toEqual(['c-east.png', 'c-south.png']);
  });

  test('a character goes to an account with room for the motions that use it, and when none has, nothing is posted', async () => {
    const r = rig([6, 30]);
    const jobs = chain();
    (jobs[0] as JobSpec).account = 0;
    const report = await runSpec(r.spec('poor', jobs), r.deps, OPTIONS);
    expect(report.ok).toBe(false);
    expect(report.outcomes.find((o) => o.id === 'c')?.message).toMatch(/account 0 holds 6, the job needs 7 generations \(3 for the character and 4 for the jobs that use it\)/);
    const bare = rig([7]);
    const dry = await runSpec(bare.spec('poor2', chain()), bare.deps, { ...OPTIONS, dryRun: true });
    expect(dry.ok).toBe(true);
    const tight = rig([6]);
    const tightDry = await runSpec(tight.spec('poor3', chain()), tight.deps, { ...OPTIONS, dryRun: true });
    expect(tightDry.ok).toBe(false);
    expect(tight.said.join('\n')).toMatch(/c needs 3 generations and 4 more for the jobs that use its character/);
    expect(r.api.posts()).toEqual([]);
  });

  test('a download that fails after the job was charged is collected on the next run: the job is never posted or paid twice', async () => {
    const r = rig([20]);
    const spec = r.spec('lost', chain());
    await runSpec(spec, r.deps, { ...OPTIONS, only: ['c'] });
    r.api.downloadsDown = true;
    const first = await runSpec(spec, r.deps, OPTIONS);
    expect(first.ok).toBe(false);
    const moves = r.api.posts('/animate-character').length;
    const charged = 20 - 3 - (r.api.balances.get(TOKENS[0] as string) as number);
    expect(moves).toBe(1);
    const stuck = new Ledger(r.ledgerPath);
    expect(stuck.lines.at(-1)?.phase).toBe('submitted');
    r.api.downloadsDown = false;
    const second = await runSpec(spec, r.deps, OPTIONS);
    expect(second.ok).toBe(true);
    expect(r.api.posts('/animate-character')).toHaveLength(moves);
    expect(r.api.posts('/create-character-v3')).toHaveLength(1);
    expect(r.api.balances.get(TOKENS[0] as string)).toBe(20 - 3 - charged);
    expect(readdirSync(join(r.dir, '.scratch/pixellab/lost/walk')).filter((f) => f.endsWith('.png'))).toHaveLength(6);
  });
});

describe('a post whose outcome is unknown', () => {
  test('charged and then the network dropped: it is written as ambiguous and never posted again', async () => {
    const r = rig([5]);
    r.api.dropAfterCharge = 1;
    const report = await runSpec(r.spec('drop', [fill()]), r.deps, OPTIONS);
    expect(report.ok).toBe(false);
    expect(r.api.posts()).toHaveLength(1);
    const phases = parseLedger(readFileSync(r.ledgerPath, 'utf8')).map((l) => l.phase);
    expect(phases).toContain('ambiguous');
    expect(everything(r)).not.toContain(TOKENS[0] as string);
    // the next run sees the balance fell since the post was written and stops instead of posting
    const again = await runSpec(r.spec('drop', [fill()]), r.deps, OPTIONS);
    expect(again.ok).toBe(false);
    expect(r.said.join('\n')).toMatch(/may have been charged/);
    expect(r.api.posts()).toHaveLength(1);
  });

  test('a server error that charged nothing is tried again, a couple of times, and then reported', async () => {
    const r = rig([5]);
    r.api.fail500 = 1;
    const ok = await runSpec(r.spec('flaky', [fill()]), r.deps, OPTIONS);
    expect(ok.ok).toBe(true);
    expect(r.api.posts()).toHaveLength(2);
    const bad = rig([5]);
    bad.api.fail500 = 99;
    const failed = await runSpec(bad.spec('down', [fill()]), bad.deps, OPTIONS);
    expect(failed.ok).toBe(false);
    expect(bad.api.posts()).toHaveLength(3);
    expect(bad.api.balances.get(TOKENS[0] as string)).toBe(5);
  });
});

describe('cutting a sheet into pieces', () => {
  test('pieces come out left to right, specks are dropped, and a piece with a gap stays whole', () => {
    const sheet = new PNG({ width: 40, height: 20 });
    for (let i = 0; i < 40 * 20; i += 1) {
      sheet.data[i * 4] = 255;
      sheet.data[i * 4 + 1] = 0;
      sheet.data[i * 4 + 2] = 255;
      sheet.data[i * 4 + 3] = 255;
    }
    const paint = (x0: number, y0: number, w: number, h: number): void => {
      for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) {
        const i = (y * 40 + x) * 4;
        sheet.data[i] = 20;
        sheet.data[i + 1] = 180;
        sheet.data[i + 2] = 30;
      }
    };
    paint(2, 2, 8, 8);
    paint(11, 2, 3, 8);
    paint(30, 4, 8, 10);
    paint(20, 18, 2, 1);
    const pieces = cutSheet(sheet);
    expect(pieces.map((p) => [p.width, p.height])).toEqual([[12, 8], [8, 10]]);
  });
});
