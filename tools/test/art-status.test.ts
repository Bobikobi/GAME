import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from 'vitest';

import { type Draft, gpuSecondsSince } from '../src/art/drafts.js';
import { DRAFTS_INDEX, POOLS, POOL_DIR, STATUSES, type PoolEntry, artStatus, draftsOf, formatStatus, loadEvidence, parsePool, readPool, statusCli } from '../src/art/status.js';
import { parseSpec } from '../src/kit/gen.js';
import { SIXTEEN_PX_LEFT } from '../src/kit/rich.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'art-status-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const kitIds = new Set(Object.keys((JSON.parse(readFileSync(join(root, 'content/kit/core/kit.json'), 'utf8')) as { kit: { sprites: object } }).kit.sprites));
const decisionTitles = new Set(
  readFileSync(join(root, 'DECISIONS.md'), 'utf8').split('\n').flatMap((line) => {
    const m = /^## \d{4}-\d{2}-\d{2} \S+ (.+)$/.exec(line);
    return m?.[1] === undefined ? [] : [m[1]];
  }),
);

describe('the pool files', () => {
  test.each(POOLS)('%s parses as a kit:gen spec and as a pool', (pool) => {
    const text = readFileSync(join(root, POOL_DIR, `${pool}.json`), 'utf8');
    expect(() => parseSpec(text)).not.toThrow();
    const entries = parsePool(text);
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.name)).size).toBe(entries.length);
  });

  test('a kit id is in one pool only, and is in the kit unless the entry says new', () => {
    const seen = new Map<string, string>();
    for (const pool of POOLS) {
      for (const entry of readPool(pool, root)) {
        expect(seen.get(entry.kit_id), `${entry.kit_id} is in ${seen.get(entry.kit_id)} and ${pool}`).toBeUndefined();
        seen.set(entry.kit_id, pool);
        if (entry.new === true) expect(kitIds.has(entry.kit_id), `${entry.kit_id} is new but the kit holds it`).toBe(false);
        else expect(kitIds.has(entry.kit_id), `${entry.kit_id} is not in the kit`).toBe(true);
        expect(kitIds.has(entry.ref), `${entry.name}.ref ${entry.ref} is not in the kit`).toBe(true);
      }
    }
  });

  test('every sprite still waiting at 16 px is in a pool (#328 seeds the pools)', () => {
    const inPools = new Set(POOLS.flatMap((pool) => readPool(pool, root).map((e) => e.kit_id)));
    expect(SIXTEEN_PX_LEFT.filter((id) => !inPools.has(id))).toEqual([]);
  });

  test('a block or a retirement names an open call of #328 or a DECISIONS title', () => {
    for (const pool of POOLS) {
      for (const entry of readPool(pool, root)) {
        if (entry.blocked_by !== undefined) expect(/^#328 open [1-8]$/.test(entry.blocked_by) || decisionTitles.has(entry.blocked_by), `${entry.name}: ${entry.blocked_by}`).toBe(true);
        if (entry.retired !== undefined) expect(decisionTitles.has(entry.retired), `${entry.name}: ${entry.retired}`).toBe(true);
      }
    }
  });

  test('sizes follow STYLE.md section 1b at density 4', () => {
    const size = (pool: (typeof POOLS)[number], name: string): [number, number] => {
      const e = readPool(pool, root).find((x) => x.name === name);
      if (e === undefined) throw new Error(`no ${name} in ${pool}`);
      return [e.width, e.height];
    };
    expect(size('trees', 'tree_oak')).toEqual([192, 320]);
    expect(size('trees', 'young_tree')).toEqual([128, 192]);
    expect(size('trees', 'dead_tree')).toEqual([192, 256]);
    expect(size('trees', 'canopy_1')).toEqual([192, 192]);
    expect(size('props', 'house_small')).toEqual([192, 320]);
    expect(size('props', 'market_stall')).toEqual([128, 192]);
    expect(size('props', 'well_old')).toEqual([128, 128]);
    expect(size('props', 'lantern_post')).toEqual([64, 192]);
    expect(size('props', 'rubble')).toEqual([128, 64]);
    expect(size('cast', 'elder')).toEqual([64, 96]);
    expect(size('cast', 'explorer_work_down')).toEqual([128, 128]);
    for (const e of readPool('ground', root)) expect([e.width, e.height], e.name).toEqual([64, 64]);
    for (const e of readPool('items', root)) expect([e.width, e.height], e.name).toEqual([64, 64]);
  });

  test('the pools are seeded in #328 order: rows never go back, entries with no row come last', () => {
    for (const pool of POOLS) {
      const ranks = readPool(pool, root).map((e) => e.rank ?? Number.MAX_SAFE_INTEGER);
      expect(ranks, pool).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});

describe('a pool entry', () => {
  const base = { name: 'a', ref: 'props/a', kit_id: 'props/a', what: 'a thing', width: 64, height: 64 };
  const spec = (entry: object): string => JSON.stringify({ entries: [{ ...base, ...entry }] });

  test('reads with its pool fields', () => {
    const [entry] = parsePool(spec({ rank: 3, blocked_by: '#328 open 4', retired: 'A title', new: true, anchor_sprite: 'props/b' }));
    expect(entry).toMatchObject({ kit_id: 'props/a', rank: 3, blocked_by: '#328 open 4', retired: 'A title', new: true });
  });

  test.each([
    [{ kit_id: 'a' }, /kit_id/],
    [{ kit_id: 'Props/A' }, /kit_id/],
    [{ rank: 0 }, /rank/],
    [{ rank: 1.5 }, /rank/],
    [{ blocked_by: ' ' }, /blocked_by/],
    [{ retired: 4 }, /retired/],
    [{ new: 'yes' }, /new/],
    [{ width: 0 }, /width/],
  ])('refuses %j', (bad, message) => {
    expect(() => parsePool(spec(bad))).toThrow(message);
  });

  test('refuses a kit id twice', () => {
    expect(() => parsePool(JSON.stringify({ entries: [base, { ...base, name: 'b' }] }))).toThrow(/appears twice/);
  });
});

/** The Monday the fixture's meter is read at; its drafts are dated in the days before. */
const NOW = new Date('2026-10-28T12:00:00Z');

/** An index line for a draft of `name`; the id is the first 16 hex of the raw hash, as `parseIndex` checks. */
const idOf = (n: number): string => n.toString(16).padStart(16, '0');

function draftLine(name: string, n: number, extra: Partial<Draft> = {}): object {
  const sha = idOf(n).repeat(4);
  return {
    id: idOf(n), pool: null, name, spec: null, round: null, route: 'kaggle', recipe: 'qwen', model: null, model_version: null, seed: 1, denoise: 1,
    canvas: null, asked: null, ramps: null, prompt: null, negative: null, warnings: [], errors: [], run: null,
    files: { raw: { sha256: sha, bytes: 1 }, full: null, imported: null }, stored: null, review: 'unreviewed', at: '2026-10-27T10:00:00.000Z', sources: [], ...extra,
  };
}

/** A repository root with one entry of each status, a drafts index and a picks manifest. */
function fixture(): string {
  const dir = mkdtempSync(join(scratch, 'root-'));
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const entry = (name: string, extra: Partial<PoolEntry> = {}): object => ({
    name, ref: `props/${name}`, kit_id: `props/${name}`, what: `a ${name}`, width: 64, height: 64, kind: 'sprite', ...extra,
  });
  const pool = (entries: object[]): string => JSON.stringify({ entries });
  write(`${POOL_DIR}/props.json`, pool([
    entry('imported_one', { rank: 2 }),
    entry('picked_one', { rank: 1 }),
    entry('drafted_one', { rank: 3 }),
    entry('missing_late'),
    entry('missing_b', { rank: 5, blocked_by: '#328 open 4' }),
    entry('missing_a', { rank: 5 }),
    entry('retired_one', { retired: 'A title' }),
    entry('retired_imported', { retired: 'A title' }),
    entry('small_in_kit', { rank: 6 }),
    entry('wrong_cite', { rank: 6 }),
    entry('failed_draft', { rank: 7 }),
  ]));
  write(`${POOL_DIR}/ground.json`, pool([{ ...entry('moss'), kind: 'tile', ref: 'props/moss', kit_id: 'tiles/moss', rank: 4 }]));
  write(`${POOL_DIR}/trees.json`, pool([entry('oak', { width: 192, height: 320, kit_id: 'props/oak', rank: 1, blocked_by: '#328 open 4' })]));
  write(`${POOL_DIR}/items.json`, pool([entry('coin', { kit_id: 'items/coin', ref: 'items/coin' })]));
  write(`${POOL_DIR}/cast.json`, pool([entry('walker', { kit_id: 'chars/walker', ref: 'chars/walker', width: 64, height: 96, rank: 1 })]));
  write('content/kit/core/kit.json', JSON.stringify({
    kit: {
      sprites: {
        // imported: density 4, the asked size, and its manifest cite names the same sprite (line 3, a blank line between)
        'props/imported_one': { w: 64, h: 64, density: 4, source: { manifest: 'tools/kit-gen/x.manifest.jsonl:3' } },
        // retired although the kit holds it as imported
        'props/retired_imported': { w: 64, h: 64, density: 4, source: { manifest: 'tools/kit-gen/x.manifest.jsonl:7' } },
        // picked, not imported: still 16 px
        'props/small_in_kit': { w: 16, h: 16 },
        // picked, not imported: the cite is another sprite's line
        'props/wrong_cite': { w: 64, h: 64, density: 4, source: { manifest: 'tools/kit-gen/x.manifest.jsonl:1' } },
      },
    },
  }));
  write('tools/kit-gen/x.manifest.jsonl', [
    JSON.stringify({ sprite: 'props/picked_one', picked: 'the owner, by eye' }),
    '',
    JSON.stringify({ sprite: 'props/imported_one', picked: 'the owner, by eye' }),
    JSON.stringify({ sprite: 'props/small_in_kit', picked: 'the owner, by eye' }),
    JSON.stringify({ sprite: 'props/wrong_cite', picked: 'the owner, by eye' }),
    JSON.stringify({ sprite: 'props/never_picked' }),
    JSON.stringify({ sprite: 'props/retired_imported', picked: 'the owner, by eye' }),
    '',
  ].join('\n'));
  const run = (id: string, seconds: number): Pick<Draft, 'run'> => ({ run: { id, gpu_seconds: seconds } });
  write(DRAFTS_INDEX, [
    // drafted_one: two draws of one kernel run (600 s), one of them sent back for another round by an amendment line
    draftLine('drafted_one', 1, run('run-a', 600)),
    draftLine('drafted_one', 2, run('run-a', 600)),
    { id: idOf(2), amend: true, review: 'rework', review_by: 'owner', review_note: 'darker' },
    // failed_draft: its only draw was a wrong object, archived, so the entry is still missing
    draftLine('failed_draft', 3, run('run-b', 300)),
    { id: idOf(3), amend: true, review: 'archive', looks_like: 'a cutting board' },
    // a draft of a name in no pool, a run too old for the meter, and a props draft of a name the ground pool also has
    draftLine('nowhere', 4, run('run-c', 120)),
    draftLine('nowhere', 5, { ...run('run-old', 9000), at: '2026-10-01T10:00:00.000Z' }),
    draftLine('moss', 6, { pool: 'props' }),
  ].map((l) => JSON.stringify(l)).join('\n'));
  return dir;
}

describe('the status', () => {
  const dir = fixture();
  const props = (status = artStatus(dir)) => status.pools.find((p) => p.pool === 'props');
  const statusOf = (name: string): string | undefined => props()?.entries.find((e) => e.name === name)?.status;

  test('one entry of each status, derived from files', () => {
    expect(statusOf('imported_one')).toBe('imported');
    expect(statusOf('picked_one')).toBe('picked');
    expect(statusOf('drafted_one')).toBe('drafted');
    expect(statusOf('missing_a')).toBe('missing');
    expect(statusOf('retired_one')).toBe('retired');
  });

  test('imported needs the kit at density 4, the asked size and a cite of the same sprite; a pick alone is picked', () => {
    expect(statusOf('small_in_kit')).toBe('picked');
    expect(statusOf('wrong_cite')).toBe('picked');
  });

  test('an archived draw is no draft, and a pick line without a pick is no pick', () => {
    expect(statusOf('failed_draft')).toBe('missing');
    expect(loadEvidence(dir).drafts).toHaveLength(6);
  });

  test('a draft that names a pool counts only in that pool', () => {
    const evidence = loadEvidence(dir);
    const moss = readPool('ground', dir).find((e) => e.name === 'moss');
    if (moss === undefined) throw new Error('no moss in the fixture');
    expect(draftsOf(moss, 'ground', evidence)).toEqual([]);
    expect(draftsOf(moss, 'props', evidence)).toHaveLength(1);
    expect(artStatus(dir, { now: NOW }).pools.find((p) => p.pool === 'ground')?.counts.drafted).toBe(0);
  });

  test('retired wins over every other file', () => {
    expect(statusOf('retired_imported')).toBe('retired');
    expect(statusOf('retired_one')).toBe('retired');
  });

  test('counts, the blocked list and the next missing entries in rank order', () => {
    const p = props();
    expect(p?.total).toBe(11);
    expect(p?.counts).toEqual({ missing: 4, drafted: 1, picked: 3, imported: 1, retired: 2 });
    expect(p?.blocked).toEqual([{ blocked_by: '#328 open 4', count: 1 }]);
    // rank 5 twice keeps the file's order (b before a); an entry with no row comes last; failed_draft is missing at row 7
    expect(p?.next.map((e) => e.name)).toEqual(['missing_b', 'missing_a', 'failed_draft', 'missing_late']);
    expect(props(artStatus(dir, { next: 2 }))?.next.map((e) => e.name)).toEqual(['missing_b', 'missing_a']);
  });

  test('the drafts of a pool are counted by review state, archived ones included', () => {
    expect(props()?.reviews).toEqual({ unreviewed: 1, keep: 0, 'reuse-parts': 0, rework: 1, archive: 1 });
    expect(artStatus(dir, { now: NOW }).pools.find((p) => p.pool === 'ground')?.reviews).toEqual({ unreviewed: 0, keep: 0, 'reuse-parts': 0, rework: 0, archive: 0 });
  });

  test('the GPU meter counts each kernel run once, and only the last seven days', () => {
    const status = artStatus(dir, { now: NOW });
    // run-a 600 s (two draws), run-b 300 s, run-c 120 s = 1020 s = 17 min; run-old is 27 days back; the sum per draft would be 27 min
    expect(status.gpu_minutes_week).toBe(17);
    expect(status.gpu_runs_week).toBe(3);
    expect(artStatus(dir, { now: new Date('2026-11-03T10:00:00Z') }).gpu_minutes_week).toBe(17);
    // a draft dated after `now` is not in the week, and a week that has moved on forgets the runs
    expect(artStatus(dir, { now: new Date('2026-10-27T09:00:00Z') }).gpu_minutes_week).toBe(0);
    expect(artStatus(dir, { now: new Date('2026-11-04T12:00:00Z') }).gpu_minutes_week).toBe(0);
  });

  test('the cast is tracked only: counted, never listed as next', () => {
    const cast = artStatus(dir).pools.find((p) => p.pool === 'cast');
    expect(cast?.counts.missing).toBe(1);
    expect(cast?.next).toEqual([]);
  });

  test('the text report', () => {
    expect(formatStatus(artStatus(dir, { now: NOW }))).toBe([
      'art pools',
      'ground    1 entries: 1 missing, 0 drafted, 0 picked, 0 imported, 0 retired',
      'trees     1 entries: 1 missing, 0 drafted, 0 picked, 0 imported, 0 retired',
      'props    11 entries: 4 missing, 1 drafted, 3 picked, 1 imported, 2 retired',
      'items     1 entries: 1 missing, 0 drafted, 0 picked, 0 imported, 0 retired',
      'cast      1 entries: 1 missing, 0 drafted, 0 picked, 0 imported, 0 retired',
      '',
      'blocked (missing or drafted entries held by an open call):',
      '  #328 open 4: trees 1, props 1',
      '',
      'gpu minutes, last 7 days: 17 from 3 kernel runs, each run counted once',
      "drafts: 6 in the index (tools/kit-gen/drafts.jsonl); of the pools' entries:",
      '  props   1 unreviewed, 1 rework, 1 archive',
      '',
      'next missing, in rank order, 5 a pool (the cast is tracked only):',
      '  ground  moss          64x64    row 4',
      '  trees   oak           192x320  row 1   blocked: #328 open 4',
      '  props   missing_b     64x64    row 5   blocked: #328 open 4',
      '  props   missing_a     64x64    row 5',
      '  props   failed_draft  64x64    row 7',
      '  props   missing_late  64x64    no row',
      '  items   coin          64x64    no row',
      '',
    ].join('\n'));
  });

  test('with no drafts index the report says a draft cannot be known', () => {
    const bare = fixture();
    rmSync(join(bare, DRAFTS_INDEX));
    const status = artStatus(bare, { now: NOW });
    expect(status.drafts).toEqual({ source: DRAFTS_INDEX, count: 0, known: false });
    expect(status.gpu_minutes_week).toBeNull();
    expect(formatStatus(status)).toContain('so a draft cannot be known');
    expect(formatStatus(status)).toContain('gpu minutes, last 7 days: not known');
    expect(props(status)?.counts.drafted).toBe(0);
  });

  test('--json has the shape a tool reads', () => {
    const json = JSON.parse(statusCli(['--json', '--next', '1'], dir, NOW)) as ReturnType<typeof artStatus>;
    expect(Object.keys(json)).toEqual(['pools', 'next_per_pool', 'gpu_minutes_week', 'gpu_runs_week', 'drafts']);
    expect(json.pools.map((p) => p.pool)).toEqual([...POOLS]);
    expect(json.gpu_minutes_week).toBe(17);
    expect(json.drafts).toEqual({ source: DRAFTS_INDEX, count: 6, known: true });
    expect(json.next_per_pool).toBe(1);
    for (const p of json.pools) {
      expect(Object.keys(p)).toEqual(['pool', 'total', 'counts', 'blocked', 'reviews', 'next', 'entries']);
      expect(Object.keys(p.counts)).toEqual([...STATUSES]);
      expect(p.entries).toHaveLength(p.total);
    }
    expect(json.pools[2]?.entries[0]).toEqual({ name: 'picked_one', kit_id: 'props/picked_one', status: 'picked', rank: 1, width: 64, height: 64, blocked_by: null });
    expect(json.pools[2]?.next).toHaveLength(1);
  });

  test('the same files give the same report twice, and a bad argument stops', () => {
    expect(statusCli([], dir, NOW)).toBe(statusCli([], dir, NOW));
    expect(() => statusCli(['--next', 'x'], dir)).toThrow(/--next/);
    expect(() => statusCli(['--wave'], dir)).toThrow(/Usage/);
  });
});

describe('the real repository', () => {
  test('every entry has a status, and the kit-backed ones read as imported', () => {
    const status = artStatus(root);
    for (const p of status.pools) expect(Object.values(p.counts).reduce((a, b) => a + b, 0)).toBe(p.total);
    const items = status.pools.find((p) => p.pool === 'items');
    expect(items?.counts.imported).toBe(items?.total);
  });

  test('the backfilled drafts read as drafted, and the meter counts each kernel run once', () => {
    const now = new Date('2026-10-28T20:00:00Z');
    const status = artStatus(root, { now });
    expect(status.drafts.known).toBe(true);
    expect(status.pools.reduce((n, p) => n + p.counts.drafted, 0)).toBeGreaterThan(0);
    const drafts = loadEvidence(root).drafts.filter((d) => d.at !== null && Date.parse(d.at) <= now.getTime());
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const perDraft = drafts.filter((d) => d.at !== null && Date.parse(d.at) >= since.getTime()).reduce((n, d) => n + (d.run?.gpu_seconds ?? 0), 0);
    // the 27.10 index: 32 kernel runs in the week; adding the seconds draft by draft would say 2332.7 minutes
    expect(status.gpu_runs_week).toBe(32);
    expect(status.gpu_minutes_week).toBe(198.2);
    expect(perDraft / 60).toBeGreaterThan(2300);
    expect(gpuSecondsSince(drafts, since) / 60).toBeCloseTo(198.2, 1);
  });
});
