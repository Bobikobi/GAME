import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { type Job, QUEUE_DIR, finishJob, queuedNames, waitingJobs } from '../src/art/queue.js';
import {
  BUDGET, DEFAULT_SIZE, capMinutes, cutWave, estimateMinutes, formatPlan, planJobs, planWave, seedBase, waveCli, weeklyMeter,
} from '../src/art/wave.js';
import { loadEvidence, readPool } from '../src/art/status.js';
import type { Draft } from '../src/art/drafts.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-wave-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const NOW = new Date('2026-10-28T20:00:00Z');
const idOf = (n: number): string => n.toString(16).padStart(16, '0');

function draftLine(name: string, n: number, extra: Partial<Draft> = {}): object {
  const sha = idOf(n).repeat(4);
  return {
    id: idOf(n), pool: null, name, spec: null, round: null, route: 'kaggle', recipe: 'qwen', model: null, model_version: null, seed: 7, denoise: 1,
    canvas: null, asked: null, ramps: null, prompt: null, negative: null, warnings: [], errors: [], run: null,
    files: { raw: { sha256: sha, bytes: 1 }, full: null, imported: null }, stored: null, review: 'unreviewed', at: '2026-10-27T10:00:00.000Z', sources: [], ...extra,
  };
}

/** A root with a props pool of every kind of entry a wave meets, and a drafts index. */
function fixture(extraIndex: object[] = []): string {
  const dir = mkdtempSync(join(scratch, 'root-'));
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const entry = (name: string, extra: object = {}): object => ({
    name, ref: `props/${name}`, kit_id: `props/${name}`, what: 'wrought iron lamp post', width: 64, height: 192, kind: 'sprite', ...extra,
  });
  write('tools/kit-gen/pools/props.json', JSON.stringify({
    entries: [
      entry('late_one'),
      entry('missing_b', { rank: 5 }),
      entry('missing_a', { rank: 2, blocked_by: '#328 open 4' }),
      entry('sent_back', { rank: 3 }),
      entry('sent_back_blocked', { rank: 3, blocked_by: '#328 open 4' }),
      entry('not_sent_back', { rank: 4 }),
      entry('imported_one', { rank: 1, width: 64, height: 64 }),
      entry('retired_one', { rank: 6, retired: 'A title' }),
      entry('as_text', { rank: 7, kind: 'tile', route: 'grid' }),
      entry('square', { rank: 8, width: 64, height: 64 }),
    ],
  }));
  write('tools/kit-gen/pools/cast.json', JSON.stringify({ entries: [entry('walker')] }));
  write('content/kit/core/kit.json', JSON.stringify({
    kit: { sprites: { 'props/imported_one': { w: 64, h: 64, density: 4, source: { manifest: 'tools/kit-gen/x.manifest.jsonl:1' } } } },
  }));
  write('tools/kit-gen/x.manifest.jsonl', `${JSON.stringify({ sprite: 'props/imported_one', picked: 'the owner' })}\n`);
  write('tools/kit-gen/drafts.jsonl', [
    draftLine('sent_back', 1, { round: 2 }),
    { id: idOf(1), amend: true, review: 'rework', review_note: 'darker' },
    draftLine('sent_back_blocked', 2),
    { id: idOf(2), amend: true, review: 'rework' },
    draftLine('not_sent_back', 3),
    ...extraIndex,
  ].map((l) => JSON.stringify(l)).join('\n'));
  return dir;
}

function names(dir: string, size = DEFAULT_SIZE, queued: ReadonlySet<string> = new Set()): string[] {
  return cutWave('props', readPool('props', dir), loadEvidence(dir), size, queued).candidates.map((c) => c.entry.name);
}

describe('cutting a wave', () => {
  test('missing entries first in rank order, then the ones sent back; every other state is left out with its reason', () => {
    const dir = fixture();
    const cut = cutWave('props', readPool('props', dir), loadEvidence(dir), 12, new Set());
    // rank 2 missing_a (blocked but never drawn: one round of stills), rank 5 missing_b, no row last; then sent_back (round 3 after its round 2)
    expect(cut.candidates.map((c) => `${c.entry.name}:${c.kind}:${c.round}`)).toEqual([
      'missing_a:new:1', 'missing_b:new:1', 'square:new:1', 'late_one:new:1', 'sent_back:again:3',
    ]);
    expect([...cut.skipped.keys()].sort()).toEqual([
      'already imported', 'drafted, and held by an open owner call (one round of stills only)', 'drafted, not sent back', 'retired', 'written as text by Codex, not drawn on the GPU',
    ]);
    expect(cut.skipped.get('drafted, not sent back')).toEqual(['not_sent_back']);
    expect(cut.skipped.get('drafted, and held by an open owner call (one round of stills only)')).toEqual(['sent_back_blocked']);
  });

  test('--unheld leaves out the entries an owner call holds, even ones never drawn', () => {
    const dir = fixture();
    const cut = cutWave('props', readPool('props', dir), loadEvidence(dir), 12, new Set(), true);
    expect(cut.candidates.map((c) => c.entry.name)).toEqual(['missing_b', 'square', 'late_one', 'sent_back']);
    expect(cut.skipped.get('held by an open owner call (--unheld)')).toEqual(['missing_a', 'sent_back_blocked']);
  });

  test('--redo cuts an imported entry that carries a rework draft, as another round, and only then', () => {
    const dir = fixture([draftLine('imported_one', 7, { round: 1, pool: 'props' }), { id: idOf(7), amend: true, review: 'rework' }]);
    const pool = readPool('props', dir);
    const without = cutWave('props', pool, loadEvidence(dir), 12, new Set());
    expect(without.candidates.map((c) => c.entry.name)).not.toContain('imported_one');
    expect(without.skipped.get('already imported')).toEqual(['imported_one']);
    const cut = cutWave('props', pool, loadEvidence(dir), 12, new Set(), false, true);
    expect(cut.candidates.find((c) => c.entry.name === 'imported_one')).toMatchObject({ kind: 'again', round: 2 });
    expect(cut.skipped.get('already imported')).toBeUndefined();
    // once a later round exists, the same rework mark no longer asks for another
    const answered = fixture([draftLine('imported_one', 7, { round: 1, pool: 'props' }), { id: idOf(7), amend: true, review: 'rework' }, draftLine('imported_one', 8, { round: 2, pool: 'props' })]);
    expect(cutWave('props', readPool('props', answered), loadEvidence(answered), 12, new Set(), false, true).candidates.map((c) => c.entry.name)).not.toContain('imported_one');
  });

  test('a wave is at most N, and entries already in the queue are not cut twice', () => {
    const dir = fixture();
    expect(names(dir, 2)).toEqual(['missing_a', 'missing_b']);
    expect(names(dir, 12, new Set(['missing_a', 'sent_back']))).toEqual(['missing_b', 'square', 'late_one']);
  });

  test('the ground entries written as text and the cast are never cut', () => {
    const dir = fixture();
    expect(names(dir)).not.toContain('as_text');
    expect(() => planWave(dir, 'cast', { now: NOW })).toThrow(/tracked only/);
  });
});

describe('the jobs of a wave', () => {
  const cand = (dir: string): ReturnType<typeof cutWave>['candidates'] => cutWave('props', readPool('props', dir), loadEvidence(dir), 12, new Set()).candidates;

  test('qwen on one seed and flux on two, each spelling its recipe and seed in the environment and refusing picks', () => {
    const dir = fixture();
    const first = cand(dir).filter((c) => c.round === 1);
    const jobs = planJobs('props-x', 'props', first, '2026-10-28T20:00:00.000Z');
    expect(jobs.map((j) => `${j.recipe}:${j.seed}`)).toEqual(['qwen:7', 'flux:8', 'flux:9']);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(3);
    for (const job of jobs) {
      expect(job.env).toEqual({ KAGGLE_MODEL: job.recipe, KAGGLE_SEED: String(job.seed) });
      expect(job.args).toContain('--no-picks');
      expect(job.args).toContain('kaggle');
      expect(job.kind).toBe('new');
      expect(job.entries).toEqual(first.map((c) => c.entry.name));
      expect(job.spec).toBe(`${QUEUE_DIR}/waves/props-x/spec.json`);
    }
  });

  test('a redraw round draws on new seeds and a different cap', () => {
    const dir = fixture();
    const jobs = planJobs('props-x', 'props', cand(dir), 'now');
    const again = jobs.filter((j) => j.round === 3);
    expect(again.map((j) => `${j.recipe}:${j.seed}`)).toEqual(['qwen:13', 'flux:14', 'flux:15']);
    expect(again.every((j) => j.kind === 'again')).toBe(true);
    expect(seedBase(1)).toBe(7);
    expect(new Set(jobs.map((j) => j.seed)).size).toBe(6);
  });

  test('the estimate is the formula of the plan: qwen 5 + 1.8 N, flux 6 + 0.4 N', () => {
    expect(estimateMinutes('qwen', 12)).toBeCloseTo(26.6);
    expect(estimateMinutes('flux', 12)).toBeCloseTo(10.8);
    expect(estimateMinutes('qwen', 5)).toBeCloseTo(14);
  });

  test('a first draw stays under 20 hours, a re-draw may use the floor, never the spare', () => {
    expect(capMinutes('new')).toBe(1200);
    expect(capMinutes('again')).toBe((BUDGET.weekHours - BUDGET.spareHours) * 60);
    expect(capMinutes('again')).toBe(1560);
  });
});

describe('the plan and the command', () => {
  test('--dry prints the plan and writes nothing, and the text names no path on this machine', () => {
    const dir = fixture();
    const { text, code } = waveCli(['props', '--size', '3', '--dry'], dir, NOW);
    expect(code).toBe(0);
    expect(text).toContain('dry run (nothing written, no network)');
    expect(text).toContain('missing_a');
    expect(text).toContain('qwen  seed 7');
    expect(text).toContain('flux  seed 8');
    expect(text).toContain('flux  seed 9');
    expect(text).toContain('an estimate');
    expect(text).toContain('fits');
    expect(text).not.toContain(dir);
    expect(existsSync(join(dir, QUEUE_DIR))).toBe(false);
  });

  test('--prompts shows the prompt each kernel reads, with the shape words of the asked size', () => {
    const dir = fixture();
    const { text } = waveCli(['props', '--size', '1', '--dry', '--prompts'], dir, NOW);
    expect(text).toContain('qwen and flux read the same sentences');
    expect(text).toContain('Pixel art game sprite: wrought iron lamp post.');
    expect(text).toContain('tall and narrow, filling the height of the picture');
  });

  test('a real cut writes the cut spec, the wave file and one job file a kernel run', () => {
    const dir = fixture();
    const { text, code } = waveCli(['props', '--size', '2'], dir, NOW);
    expect(code).toBe(0);
    expect(text).toContain('queued as props-20261028T200000: 3 jobs');
    const folder = join(dir, QUEUE_DIR, 'waves', 'props-20261028T200000');
    const spec = JSON.parse(readFileSync(join(folder, 'spec.json'), 'utf8')) as { entries: { name: string }[] };
    expect(spec.entries.map((e) => e.name)).toEqual(['missing_a', 'missing_b']);
    expect(existsSync(join(folder, 'wave.json'))).toBe(true);
    expect(readdirSync(join(dir, QUEUE_DIR, 'jobs'))).toHaveLength(3);
    expect(waitingJobs(dir).map((j) => j.recipe)).toEqual(['qwen', 'flux', 'flux']);
    expect(queuedNames(dir, 'props')).toEqual(new Set(['missing_a', 'missing_b']));
    // the next wave takes the entries after them
    expect(planWave(dir, 'props', { now: new Date('2026-10-28T21:00:00Z'), size: 2 }).candidates.map((c) => c.entry.name)).toEqual(['square', 'late_one']);
  });

  test('a wave that does not fit the week is not queued', () => {
    // 1190 minutes in one run, so a wave of ~30 would pass 1200
    const dir = fixture([draftLine('elsewhere', 9, { run: { id: 'big', gpu_seconds: 71_400 }, at: '2026-10-28T10:00:00.000Z' })]);
    const dry = waveCli(['props', '--size', '3', '--dry'], dir, NOW);
    expect(dry.text).toContain('DOES NOT FIT');
    const real = waveCli(['props', '--size', '3'], dir, NOW);
    expect(real.code).toBe(1);
    expect(real.text).toContain('not queued');
    expect(existsSync(join(dir, QUEUE_DIR))).toBe(false);
  });

  test('bad arguments are refused', () => {
    const dir = fixture();
    expect(() => waveCli([], dir, NOW)).toThrow(/Usage/);
    expect(() => waveCli(['nowhere'], dir, NOW)).toThrow(/Usage/);
    expect(() => waveCli(['props', '--size', '0'], dir, NOW)).toThrow(/--size/);
    expect(() => waveCli(['props', '--size', 'x'], dir, NOW)).toThrow(/--size/);
    expect(() => waveCli(['props', '--now'], dir, NOW)).toThrow(/Usage/);
  });

  test('nothing to draw says so and queues nothing', () => {
    const dir = fixture();
    const { text, code } = waveCli(['props', '--size', '50'], dir, NOW);
    expect(code).toBe(0);
    expect(text).toContain('queued');
    const again = waveCli(['props', '--size', '50'], dir, NOW);
    expect(again.text).toContain('nothing to draw');
    expect(again.code).toBe(0);
  });

  test('formatPlan on an empty cut', () => {
    const dir = fixture();
    expect(formatPlan({ ...planWave(dir, 'props', { now: NOW, size: 1 }), candidates: [], jobs: [] }, { dry: true })).toContain('nothing to draw');
  });
});

describe('the weekly meter', () => {
  const job = { id: 'j' } as Job;

  test('adds the kernel runs the queue recorded that drew nothing, once, and not the ones the index already counts', () => {
    const dir = fixture([draftLine('x', 9, { run: { id: 'run-in-index', gpu_seconds: 600 }, at: '2026-10-28T10:00:00.000Z' })]);
    expect(weeklyMeter(dir, loadEvidence(dir).drafts, NOW)).toEqual({ minutes: 10, index_minutes: 10, extra_minutes: 0 });
    mkdirSync(join(dir, QUEUE_DIR, 'done'), { recursive: true });
    finishJob(dir, {
      job, outcome: 'failed', attempts: 2, drawn: [], failed: [], drafts_added: 0, drafts_seen: 0,
      kernels: [{ id: 'run-in-index', seconds: 600 }, { id: 'died-1', seconds: 300 }, { id: 'died-2', seconds: 120 }], gpu_minutes: 0, releases: [], upload_error: null,
      notes: [], gallery: '', started: '2026-10-28T11:00:00.000Z', finished: '2026-10-28T12:00:00.000Z',
    });
    expect(weeklyMeter(dir, loadEvidence(dir).drafts, NOW)).toEqual({ minutes: 17, index_minutes: 10, extra_minutes: 7 });
    // a record older than the week is forgotten
    expect(weeklyMeter(dir, loadEvidence(dir).drafts, new Date('2026-11-10T00:00:00Z')).minutes).toBe(0);
  });
});
