import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { parseReviews } from '../src/art/library-reviews.js';

const SERVE = join(import.meta.dirname, '../art-library/serve.py');
const A = 'aaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbb';
const GONE = 'cccccccccccccccc';

const dir = mkdtempSync(join(tmpdir(), 'art-library-serve-'));
let port = 0;
let child: ChildProcess;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => resolve(p));
    });
  });
}

interface Reply { status: number; body: string; headers: Record<string, string | string[] | undefined> }

/** node:http, not fetch: the tests set Host and Origin themselves. */
function call(method: string, path: string, opts: { headers?: Record<string, string>; body?: string; host?: string } = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: { Host: `127.0.0.1:${port}`, ...opts.headers } }, (res) => {
      const parts: Buffer[] = [];
      res.on('data', (d: Buffer) => parts.push(d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(parts).toString('utf8'), headers: res.headers }));
    });
    req.on('error', reject);
    req.end(opts.body);
  });
}

const post = (body: unknown, headers: Record<string, string> = {}): Promise<Reply> => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return call('POST', '/review', { body: text, headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(text)), ...headers } });
};

const reviewsPath = join(dir, 'reviews.jsonl');
const saved = (): string => (existsSync(reviewsPath) ? readFileSync(reviewsPath, 'utf8') : '');

beforeAll(async () => {
  mkdirSync(join(dir, 'thumb'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>page</title>');
  writeFileSync(join(dir, 'thumb', `${A}.webp`), 'x');
  writeFileSync(join(dir, 'ids.json'), JSON.stringify([A, B]));
  writeFileSync(join(dir, '.hidden'), 'secret');
  port = await freePort();
  child = spawn('python3', ['-I', SERVE, '--port', String(port), '--dir', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('serve.py did not start')), 10_000);
    child.stderr?.on('data', (d: Buffer) => { if (d.toString().includes('serving')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (code) => reject(new Error(`serve.py exited ${code}`)));
  });
});

afterAll(() => {
  child.removeAllListeners('exit');
  child.kill('SIGKILL');
  rmSync(dir, { recursive: true, force: true });
});

describe('serve.py, reading', () => {
  test('serves the page and the thumbnails, never the store, the id list or a dotfile', async () => {
    expect((await call('GET', '/')).status).toBe(200);
    expect((await call('GET', '/thumb/' + A + '.webp')).status).toBe(200);
    for (const p of ['/reviews.jsonl', '/ids.json', '/.hidden', '/thumb/', '/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd']) expect((await call('GET', p)).status, p).toBeGreaterThanOrEqual(400);
  });

  test('the page and the choices are never cached', async () => {
    expect((await call('GET', '/')).headers['cache-control']).toBe('no-store');
    expect((await call('GET', '/reviews')).headers['cache-control']).toBe('no-store');
  });

  test('a request whose Host is not this server is refused, GET and POST alike (DNS rebinding)', async () => {
    expect((await call('GET', '/reviews', { headers: { Host: 'evil.example:' + port } })).status).toBe(403);
    expect((await call('GET', '/', { headers: { Host: `127.0.0.1:${port + 1}` } })).status).toBe(403);
    expect((await post({ id: A, review: 'keep' }, { Host: 'evil.example' })).status).toBe(403);
    expect((await call('GET', '/reviews', { headers: { Host: `localhost:${port}` } })).status).toBe(200);
  });
});

describe('serve.py, saving', () => {
  test('a known id and a known state is saved to reviews.jsonl before the answer', async () => {
    const reply = await post({ id: A, review: 'keep', note: 'the good one' });
    expect(reply.status).toBe(200);
    const body = JSON.parse(reply.body) as { saved: number; at: string };
    expect(body.saved).toBe(1);
    const line = JSON.parse(saved().trim().split('\n').pop() as string) as Record<string, string>;
    expect(line).toEqual({ id: A, review: 'keep', note: 'the good one', at: body.at });
    expect(body.at).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
  });

  test('GET /reviews returns the last line per id, as the build reads it', async () => {
    await post({ id: A, review: 'archive', note: '' });
    await post({ ids: [A, B], review: 'rework', note: 'both' });
    await post({ id: B, review: 'unreviewed' });
    const got = JSON.parse((await call('GET', '/reviews')).body) as Record<string, { review: string; note: string; at: string }>;
    expect(Object.keys(got).sort()).toEqual([A, B]);
    expect(got[A]).toMatchObject({ review: 'rework', note: 'both' });
    expect(got[B]).toMatchObject({ review: 'unreviewed', note: '' });
    // the same file, read by the build's reader, gives the same choices: the page and a rebuild never disagree
    const built = parseReviews(saved(), new Set([A, B])).choices;
    for (const id of [A, B]) expect(built.get(id)).toMatchObject({ review: got[id]?.review, note: got[id]?.note, at: got[id]?.at });
  });

  test('a batch is one request: one line per id, one timestamp, all or nothing, up to the whole library', async () => {
    const many = Array.from({ length: 3200 }, (_, i) => i.toString(16).padStart(16, '0'));
    writeFileSync(join(dir, 'ids.json'), JSON.stringify([A, B, ...many]));
    const before = saved().split('\n').filter(Boolean).length;
    const reply = await post({ ids: many, review: 'archive', note: 'the whole batch' });
    expect(reply.status).toBe(200);
    const lines = saved().split('\n').filter(Boolean).slice(before).map((l) => JSON.parse(l) as { id: string; review: string; note: string; at: string });
    expect(lines).toHaveLength(3200);
    expect(new Set(lines.map((l) => l.at)).size).toBe(1);
    expect(lines.every((l) => l.review === 'archive' && l.note === 'the whole batch')).toBe(true);
    // one unknown id among them: nothing at all is written
    const mixed = await post({ ids: [A, B, GONE], review: 'keep' });
    expect(mixed.status).toBe(422);
    expect(saved().split('\n').filter(Boolean)).toHaveLength(before + 3200);
    // a duplicate id inside a batch is written once
    const dup = await post({ ids: [A, A, B], review: 'keep' });
    expect(JSON.parse(dup.body)).toMatchObject({ saved: 2 });
    expect((await post({ ids: Array.from({ length: 5001 }, () => A), review: 'keep' })).status).toBe(400);
    writeFileSync(join(dir, 'ids.json'), JSON.stringify([A, B]));
  });

  test('an unknown or malformed id is refused and writes nothing', async () => {
    const before = saved();
    for (const body of [{ id: GONE, review: 'keep' }, { id: 'zz', review: 'keep' }, { id: 7, review: 'keep' }, { ids: [A, GONE], review: 'keep' }, { ids: [], review: 'keep' }, { id: A, ids: [B], review: 'keep' }, {}]) {
      const reply = await post(body);
      expect(reply.status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
      expect(reply.status).toBeLessThan(500);
    }
    expect(saved()).toBe(before);
  });

  test('an unknown state is refused and writes nothing', async () => {
    const before = saved();
    for (const review of ['delete', 'Keep', '', null, 1]) expect((await post({ id: A, review })).status, String(review)).toBe(422);
    expect((await post({ id: A })).status).toBe(422);
    expect(saved()).toBe(before);
  });

  test('a body over the cap is refused without being read; a long note is refused', async () => {
    const before = saved();
    const big = JSON.stringify({ id: A, review: 'keep', note: 'x'.repeat(300_000) });
    expect((await post(big)).status).toBe(413);
    expect((await post({ id: A, review: 'keep', note: 'x'.repeat(301) })).status).toBe(400);
    expect((await call('POST', '/review', { body: '{"id":"' + A + '"}', headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } })).status).toBe(411);
    expect(saved()).toBe(before);
  });

  test('a request from another origin is refused, and so is one with no Origin or a wrong content type', async () => {
    const before = saved();
    for (const origin of ['http://evil.example', 'https://127.0.0.1:' + port, `http://127.0.0.1:${port + 1}`, 'null', `http://127.0.0.1:${port}.evil.example`]) {
      expect((await post({ id: A, review: 'keep' }, { Origin: origin })).status, origin).toBe(403);
    }
    const text = JSON.stringify({ id: A, review: 'keep' });
    expect((await call('POST', '/review', { body: text, headers: { 'Content-Type': 'application/json', 'Content-Length': String(text.length) } })).status).toBe(403);
    expect((await post({ id: A, review: 'keep' }, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await post('{not json')).status).toBe(400);
    expect(saved()).toBe(before);
  });

  test('other methods and paths are not served; no CORS header is ever sent', async () => {
    for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS']) expect((await call(method, '/review', { headers: { Origin: 'http://evil.example' } })).status, method).toBeGreaterThanOrEqual(400);
    const reply = await post({ id: A, review: 'keep' });
    expect(Object.keys(reply.headers).some((h) => h.startsWith('access-control'))).toBe(false);
    expect((await call('POST', '/elsewhere', { body: '{}', headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', 'Content-Length': '2' } })).status).toBe(404);
  });

  test('a torn last line from a crash does not swallow the next choice', async () => {
    writeFileSync(reviewsPath, saved() + '{"id":"' + A + '","rev');
    expect((await post({ id: B, review: 'keep' })).status).toBe(200);
    const got = JSON.parse((await call('GET', '/reviews')).body) as Record<string, { review: string }>;
    expect(got[B]?.review).toBe('keep');
  });

  test('a new id list is picked up without a restart', async () => {
    expect((await post({ id: GONE, review: 'keep' })).status).toBe(422);
    writeFileSync(join(dir, 'ids.json'), JSON.stringify([A, B, GONE]));
    expect((await post({ id: GONE, review: 'keep' })).status).toBe(200);
  });

  test('without an id list the server refuses to save', async () => {
    rmSync(join(dir, 'ids.json'));
    expect((await post({ id: A, review: 'keep' })).status).toBe(503);
    writeFileSync(join(dir, 'ids.json'), JSON.stringify([A, B]));
  });
});

