import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { PNG } from 'pngjs';
import { afterAll, describe, expect, test } from 'vitest';

import { DraftIndex, type Gh, noteDraft } from '../src/art/drafts.js';
import { QUEUE_DIR, doneRecords, formatQueue, queuePath, queueSummary, readJson, readState, takeLock, waitingJobs, writeJson } from '../src/art/queue.js';
import { type Exec, type KaggleProbe, type RunDeps, clearStop, describeDone, pauseReason, readProbe, runCli, runQueue } from '../src/art/run.js';
import { waveCli } from '../src/art/wave.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-run-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const NOW = new Date('2026-10-28T20:00:00Z');

/** A root with a props pool of three entries and a wave of them in the queue (3 jobs). */
function queued(entries = 3): string {
  const dir = mkdtempSync(join(scratch, 'root-'));
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const names = ['lamp_a', 'lamp_b', 'lamp_c', 'lamp_d'].slice(0, entries);
  write('tools/kit-gen/pools/props.json', JSON.stringify({
    entries: names.map((name, i) => ({ name, ref: `props/${name}`, kit_id: `props/${name}`, what: 'wrought iron lamp post', width: 64, height: 192, kind: 'sprite', rank: i + 1 })),
  }));
  write('content/kit/core/kit.json', JSON.stringify({ kit: { sprites: {} } }));
  write('tools/kit-gen/drafts.jsonl', '');
  expect(waveCli(['props'], dir, NOW).code).toBe(0);
  return dir;
}

function picture(seed: number): Buffer {
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < 16; i += 1) {
    png.data[i * 4] = (seed * 37 + i * 11) % 256;
    png.data[i * 4 + 1] = (seed * 53 + i) % 256;
    png.data[i * 4 + 2] = (seed >> 4) % 256;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

type Script = (call: { jobId: string; recipe: string; seed: number; attempt: number; name: string }) => 'ok' | 'black' | 'refused' | 'crash';

interface Fake {
  deps: RunDeps;
  calls: { job: string; only: string[] }[];
  store: Map<string, Map<string, Buffer>>;
  sleeps: number[];
  probes: { up: KaggleProbe[] };
  ghFails: { on: boolean };
}

function fakeGh(store: Map<string, Map<string, Buffer>>, fails: { on: boolean }): Gh {
  const ok = (stdout = ''): { status: number; stdout: string; stderr: string } => ({ status: 0, stdout, stderr: '' });
  return (args) => {
    if (fails.on) return { status: 1, stdout: '', stderr: 'gh is down' };
    const [, verb, tag = ''] = args;
    if (verb === 'view') {
      const release = store.get(tag);
      return release === undefined ? { status: 1, stdout: '', stderr: 'release not found' } : ok(JSON.stringify({ assets: [...release.keys()].map((name) => ({ name })) }));
    }
    if (verb === 'create') {
      store.set(tag, store.get(tag) ?? new Map());
      return ok();
    }
    if (verb === 'upload') {
      const release = store.get(tag);
      if (release === undefined) return { status: 1, stdout: '', stderr: 'no release' };
      for (const file of args.slice(5)) release.set(basename(file), readFileSync(file));
      return ok();
    }
    return { status: 1, stdout: '', stderr: 'unknown verb' };
  };
}

let drawCounter = 100;
let runCounter = 0;

/** Runs deps whose `exec` behaves as `kit:gen --drawer kaggle` does: one kernel run, a raw and an imported picture a name, a manifest line, the index line. */
function fake(dir: string, script: Script = () => 'ok', options: { probes?: KaggleProbe[]; seconds?: number; wrongSeed?: boolean } = {}): Fake {
  const calls: Fake['calls'] = [];
  const store = new Map<string, Map<string, Buffer>>();
  const ghFails = { on: false };
  const probes = { up: [...(options.probes ?? [])] };
  const attempts = new Map<string, number>();
  const sleeps: number[] = [];
  const indexPath = join(dir, 'tools/kit-gen/drafts.jsonl');
  const exec = (job: { id: string; recipe: string; seed: number; out: string; spec: string }, only: readonly string[]): Exec => {
    const attempt = (attempts.get(job.id) ?? 0) + 1;
    attempts.set(job.id, attempt);
    calls.push({ job: job.id, only: [...only] });
    const folder = join(dir, job.out);
    for (const sub of ['raw', 'out', 'log', 'ref']) mkdirSync(join(folder, sub), { recursive: true });
    const results = only.map((name) => ({ name, result: script({ jobId: job.id, recipe: job.recipe, seed: job.seed, attempt, name }) }));
    if (results.some((r) => r.result === 'crash')) return { status: 1, tail: 'tsx: spec could not be read' };
    runCounter += 1;
    const runId = `2026-10-28T20-${String(runCounter).padStart(2, '0')}-00-000Z-1`;
    const kernel = join(folder, 'kaggle', runId);
    mkdirSync(join(kernel, 'kernel'), { recursive: true });
    mkdirSync(join(kernel, 'output'), { recursive: true });
    const wave = { settings: { recipe: job.recipe }, requests: only.map((name) => ({ name, file: `${name}.png`, seed: options.wrongSeed === true ? job.seed + 50 : job.seed, width: 1024, height: 1536 })) };
    writeFileSync(join(kernel, 'kernel/kitgen_wave.py'), `WAVE_B64 = "${Buffer.from(JSON.stringify(wave)).toString('base64')}"\n`);
    if (!results.some((r) => r.result === 'refused')) writeFileSync(join(kernel, 'output/kitgen-manifest.json'), JSON.stringify({ device: 'T4', seconds: options.seconds ?? 600, images: [] }));
    for (const { name, result } of results) {
      drawCounter += 1;
      const at = new Date(NOW.getTime() + drawCounter * 1000).toISOString();
      const stamp = at.replace(/[:.]/g, '-');
      const bad = result !== 'ok';
      const line: Record<string, unknown> = {
        name, spec: job.spec, ref: `props/${name}`, refSize: [16, 48], kind: 'sprite', route: 'image', width: 64, height: 192, prompt: 'a lamp', drawer: 'kaggle',
        codex: { version: 'x', exit: 0, seconds: 100, tokens: null, log: `log/${name}-${stamp}.txt` },
        raw: bad ? null : `raw/${name}-${stamp}.png`, out: bad ? null : `out/${name}-${stamp}.png`, grid: null, logical: null, colors: null,
        warnings: [], error: result === 'black' ? 'the picture came back black (a NaN in fp16)' : result === 'refused' ? 'Kaggle refused the kernel: GPU quota exceeded for this week' : null, at,
      };
      writeFileSync(join(folder, 'log', `${name}-${stamp}.txt`), `kernel kaggle/${runId}/kernel\nrecipe ${job.recipe}\n`);
      if (!bad) {
        writeFileSync(join(folder, `raw/${name}-${stamp}.png`), picture(drawCounter));
        writeFileSync(join(folder, `out/${name}-${stamp}.png`), picture(drawCounter + 5000));
      }
      appendFileSync(join(folder, 'manifest.jsonl'), `${JSON.stringify(line)}\n`);
      noteDraft(folder, line as never, indexPath);
    }
    return { status: results.some((r) => r.result !== 'ok') ? 1 : 0, tail: '' };
  };
  const deps: RunDeps = {
    root: dir, now: () => NOW, sleep: (s) => void sleeps.push(s), pid: 4_000_001, indexPath, say: () => undefined, gh: fakeGh(store, ghFails),
    probe: () => probes.up.shift() ?? { up: true, reason: null },
    exec: (job, only) => exec(job, only),
  };
  return { deps, calls, store, sleeps, probes, ghFails };
}

const index = (dir: string): ReturnType<typeof DraftIndex.open> => DraftIndex.open(join(dir, 'tools/kit-gen/drafts.jsonl'));

describe('a wave run to its end', () => {
  test('three kernel runs draw the five pictures a kernel, index them with their pool and round, and upload a release a run', () => {
    const dir = queued();
    const f = fake(dir);
    expect(runQueue(f.deps)).toBe(0);
    expect(f.calls.map((c) => c.job.replace(/^props-\d{8}T\d{6}-/, ''))).toEqual(['01-qwen-s7', '02-flux-s8', '03-flux-s9']);
    expect(f.calls.every((c) => c.only.join() === 'lamp_a,lamp_b,lamp_c')).toBe(true);
    const drafts = [...index(dir).drafts.values()];
    expect(drafts).toHaveLength(9);
    expect(drafts.every((d) => d.pool === 'props' && d.round === 1)).toBe(true);
    expect(new Set(drafts.map((d) => `${d.recipe}:${d.seed}`))).toEqual(new Set(['qwen:7', 'flux:8', 'flux:9']));
    expect(drafts.every((d) => d.stored !== null)).toBe(true);
    expect(f.store.size).toBe(3);
    const done = doneRecords(dir);
    expect(done).toHaveLength(3);
    expect(done.every((r) => r.outcome === 'ok' && r.attempts === 1 && r.drafts_added === 3 && r.notes.length === 0 && r.releases.length === 1)).toBe(true);
    expect(done.map((r) => r.gpu_minutes)).toEqual([10, 10, 10]);
    expect(readState(dir).status).toBe('idle');
    expect(waitingJobs(dir)).toEqual([]);
    expect(existsSync(queuePath(dir, 'running', 'x.json'))).toBe(false);
    expect(readdirSync(queuePath(dir, 'running'))).toEqual([]);
    // a second run has nothing to do
    expect(runQueue(fake(dir).deps)).toBe(0);
  });

  test('--no-upload keeps the drafts in the index and calls no gh', () => {
    const dir = queued(2);
    const f = fake(dir);
    expect(runCli(['--no-upload'], f.deps)).toBe(0);
    expect(f.store.size).toBe(0);
    expect([...index(dir).drafts.values()].every((d) => d.stored === null && d.pool === 'props')).toBe(true);
  });

  test('a drafts repo that is down does not fail the job: the pictures are drafts, the upload is told and can be redone', () => {
    const dir = queued(2);
    const f = fake(dir);
    f.ghFails.on = true;
    expect(runQueue(f.deps)).toBe(0);
    const [first] = doneRecords(dir);
    expect(first?.outcome).toBe('ok');
    expect(first?.upload_error).toMatch(/could not create release/);
    expect(describeDone(first as never)).toContain('pnpm art:drafts push will redo it');
  });

  test('an index line whose recipe or seed is not the job\'s is told in the record', () => {
    const dir = queued(2);
    const f = fake(dir, () => 'ok', { wrongSeed: true });
    runQueue(f.deps);
    const [first] = doneRecords(dir);
    expect(first?.notes[0]).toMatch(/lamp_a: the index records qwen seed 57, the job asked for qwen seed 7/);
  });
});

describe('failure', () => {
  test('a picture that failed is drawn once more, alone, on the same seed; the job is then done', () => {
    const dir = queued();
    const f = fake(dir, (c) => (c.name === 'lamp_b' && c.attempt === 1 && c.recipe === 'qwen' ? 'black' : 'ok'));
    expect(runQueue(f.deps)).toBe(0);
    expect(f.calls.slice(0, 2).map((c) => c.only.join())).toEqual(['lamp_a,lamp_b,lamp_c', 'lamp_b']);
    const first = doneRecords(dir).find((r) => r.job.recipe === 'qwen');
    expect(first).toMatchObject({ outcome: 'ok', attempts: 2 });
    expect(first?.drawn.sort()).toEqual(['lamp_a', 'lamp_b', 'lamp_c']);
    expect(first?.kernels).toHaveLength(2);
  });

  test('a second failure stops the queue, the rest waits, and the stop holds until it is cleared', () => {
    const dir = queued();
    const f = fake(dir, (c) => (c.name === 'lamp_c' && c.recipe === 'qwen' ? 'black' : 'ok'));
    expect(runQueue(f.deps)).toBe(1);
    const state = readState(dir);
    expect(state.status).toBe('stopped');
    expect(state.reason).toMatch(/failed twice: lamp_c: the picture came back black/);
    expect(waitingJobs(dir)).toHaveLength(2);
    const [failed] = doneRecords(dir);
    expect(failed).toMatchObject({ outcome: 'failed', attempts: 2, drawn: ['lamp_a', 'lamp_b'] });
    // the next run refuses until the stop is cleared
    const again = fake(dir);
    expect(runQueue(again.deps)).toBe(1);
    expect(again.calls).toEqual([]);
    expect(runCli(['--clear-stop'], again.deps)).toBe(0);
    expect(readState(dir).status).toBe('idle');
    expect(clearStop(dir, NOW)).toMatch(/not stopped/);
    expect(runQueue(again.deps)).toBe(0);
    expect(waitingJobs(dir)).toEqual([]);
  });

  test('a kit:gen that dies with no result fails every entry and is tried once more', () => {
    const dir = queued(2);
    const f = fake(dir, (c) => (c.jobId.endsWith('01-qwen-s7') ? 'crash' : 'ok'));
    expect(runQueue(f.deps)).toBe(1);
    expect(f.calls).toHaveLength(2);
    const [failed] = doneRecords(dir);
    expect(failed?.failed.map((x) => x.name)).toEqual(['lamp_a', 'lamp_b']);
    expect(failed?.failed[0]?.error).toMatch(/no result for it.*spec could not be read/);
  });

  test('a kernel that ran and drew nothing still counts against the week', () => {
    const dir = queued(1);
    const f = fake(dir, (c) => (c.recipe === 'qwen' ? 'black' : 'ok'), { seconds: 900 });
    expect(runQueue(f.deps)).toBe(1);
    const [failed] = doneRecords(dir);
    expect(failed?.kernels.map((k) => k.seconds)).toEqual([900, 900]);
    expect(failed?.gpu_minutes).toBe(30);
  });
});

describe('Kaggle down', () => {
  const down: KaggleProbe = { up: false, reason: 'Kaggle did not answer (exit 1): connection refused' };

  test('--once pauses with the reason and touches nothing', () => {
    const dir = queued();
    const f = fake(dir, () => 'ok', { probes: [down] });
    expect(runCli(['--once'], f.deps)).toBe(2);
    expect(readState(dir)).toMatchObject({ status: 'paused', reason: down.reason });
    expect(waitingJobs(dir)).toHaveLength(3);
    expect(f.calls).toEqual([]);
  });

  test('without --once it waits, polls again and then draws; the state is idle at the end', () => {
    const dir = queued(1);
    const f = fake(dir, () => 'ok', { probes: [down, down] });
    expect(runCli(['--poll-seconds', '30'], f.deps)).toBe(0);
    expect(f.sleeps).toEqual([30, 30]);
    expect(f.calls).toHaveLength(3);
    expect(readState(dir).status).toBe('idle');
  });

  test('it gives up waiting after --max-wait-hours and leaves the pause', () => {
    const dir = queued(1);
    const f = fake(dir, () => 'ok', { probes: Array.from({ length: 50 }, () => down) });
    expect(runCli(['--poll-seconds', '1800', '--max-wait-hours', '1'], f.deps)).toBe(2);
    expect(f.sleeps).toEqual([1800, 1800]);
    expect(readState(dir).status).toBe('paused');
  });

  test('a refused kernel (the GPU hours) pauses the queue and does not use up the retry', () => {
    const dir = queued(2);
    const f = fake(dir, (c) => (c.jobId.endsWith('01-qwen-s7') && c.attempt === 1 ? 'refused' : 'ok'));
    expect(runCli(['--once'], f.deps)).toBe(2);
    expect(readState(dir)).toMatchObject({ status: 'paused' });
    expect(readState(dir).reason).toMatch(/Kaggle refused the kernel/);
    expect(waitingJobs(dir)).toHaveLength(3);
    expect(doneRecords(dir)).toEqual([]);
    // the next run picks the same job up whole and finishes the wave
    expect(runQueue(f.deps)).toBe(0);
    expect(doneRecords(dir)).toHaveLength(3);
    expect(doneRecords(dir).every((r) => r.attempts === 1)).toBe(true);
  });
});

describe('the budget and the queue itself', () => {
  test('a job that would take the week past its cap pauses the queue and does not wait', () => {
    const dir = queued(2);
    appendFileSync(join(dir, 'tools/kit-gen/drafts.jsonl'), `${JSON.stringify({
      id: '00000000000000aa', pool: null, name: 'elsewhere', spec: null, round: null, route: 'kaggle', recipe: 'qwen', model: null, model_version: null, seed: 1, denoise: 1,
      canvas: null, asked: null, ramps: null, prompt: null, negative: null, warnings: [], errors: [], run: { id: 'big', gpu_seconds: 71_500 },
      files: { raw: { sha256: `${'00000000000000aa'.repeat(4)}`, bytes: 1 }, full: null, imported: null }, stored: null, review: 'unreviewed', at: '2026-10-28T10:00:00.000Z', sources: [],
    })}\n`);
    const f = fake(dir);
    expect(runQueue(f.deps)).toBe(3);
    expect(readState(dir).reason).toMatch(/the week's GPU budget: 1191.7 min used of 1200/);
    expect(f.calls).toEqual([]);
    expect(f.sleeps).toEqual([]);
  });

  test('--dry lists the queue and changes nothing', () => {
    const dir = queued(2);
    const said: string[] = [];
    const f = fake(dir);
    f.deps.say = (t) => void said.push(t);
    expect(runCli(['--dry'], f.deps)).toBe(0);
    expect(said[0]).toBe('3 jobs waiting:');
    expect(said.join('\n')).toContain('qwen seed 7');
    expect(f.calls).toEqual([]);
    expect(existsSync(queuePath(dir, 'run.lock'))).toBe(false);
  });

  test('another live runner holds the queue', () => {
    const dir = queued(1);
    expect(takeLock(dir, process.pid).ok).toBe(true);
    const f = fake(dir);
    expect(runQueue(f.deps)).toBe(4);
    expect(f.calls).toEqual([]);
  });

  test('a job a dead runner left running goes back to the queue', () => {
    const dir = queued(1);
    const [job] = waitingJobs(dir);
    if (job === undefined) throw new Error('no job');
    rmSync(queuePath(dir, 'jobs', `${job.id}.json`));
    writeJson(queuePath(dir, 'running', `${job.id}.json`), { job, pid: 4_194_000, started: NOW.toISOString(), attempt: 1 });
    const f = fake(dir);
    expect(runQueue(f.deps)).toBe(0);
    expect(f.calls).toHaveLength(3);
    expect(readJson(queuePath(dir, 'running', `${job.id}.json`))).toBeNull();
  });

  test('bad arguments are refused', () => {
    const f = fake(queued(1));
    expect(() => runCli(['--wave'], f.deps)).toThrow(/Usage/);
    expect(() => runCli(['--poll-seconds', 'x'], f.deps)).toThrow(/--poll-seconds/);
  });

  test('the queue lives under .scratch/art-queue', () => {
    expect(QUEUE_DIR).toBe('.scratch/art-queue');
  });
});

describe('art:status shows the queue', () => {
  test('nothing is added when there is no queue; a waiting, a paused and a failed queue are told', () => {
    const empty = mkdtempSync(join(scratch, 'root-'));
    expect(formatQueue(queueSummary(empty))).toBe('');
    const dir = queued(2);
    const waiting = formatQueue(queueSummary(dir));
    expect(waiting).toContain('art queue: idle');
    expect(waiting).toContain('3 waiting, 0 running, 0 finished');
    expect(waiting).toMatch(/waiting {2}props-\d{8}T\d{6}-01-qwen-s7 {2}~\d+(\.\d+)? min {2}lamp_a, lamp_b/);
    runCli(['--once'], fake(dir, () => 'ok', { probes: [{ up: false, reason: 'Kaggle did not answer' }] }).deps);
    expect(formatQueue(queueSummary(dir))).toContain('art queue: paused (Kaggle did not answer)');
    runQueue(fake(dir, (c) => (c.name === 'lamp_b' && c.recipe === 'qwen' ? 'black' : 'ok')).deps);
    const stopped = formatQueue(queueSummary(dir));
    expect(stopped).toContain('art queue: stopped (');
    expect(stopped).toMatch(/last {5}props-\S+-01-qwen-s7: failed, 1 of 2 drawn/);
    expect(stopped).toMatch(/failed lamp_b: the picture came back black/);
  });
});

describe('reading Kaggle', () => {
  test('a kernel that is working is busy, one that is done or never pushed means Kaggle is up, a CLI that did not run is down', () => {
    expect(readProbe(0, 'kitgen-drawer has status "KernelWorkerStatus.COMPLETE"', null)).toEqual({ up: true, reason: null });
    expect(readProbe(0, 'x has status "KernelWorkerStatus.ERROR"\nFailure message: boom', null).up).toBe(true);
    expect(readProbe(0, 'x has status "KernelWorkerStatus.RUNNING"', null)).toMatchObject({ up: false });
    expect(readProbe(0, 'x has status "KernelWorkerStatus.RUNNING"', null).reason).toMatch(/busy \(running\).*KAGGLE_KERNEL/);
    expect(readProbe(1, '404 Client Error: Not Found', null)).toEqual({ up: true, reason: null });
    expect(readProbe(1, 'Max retries exceeded: Connection refused', null)).toMatchObject({ up: false });
    expect(readProbe(null, '', 'spawn kaggle ENOENT').reason).toMatch(/set KAGGLE_CLI/);
  });

  test('which errors are Kaggle being unavailable and which are a picture going wrong', () => {
    expect(pauseReason('Kaggle refused the kernel: GPU quota exceeded')).toMatch(/refused/);
    expect(pauseReason('the kaggle CLI did not run (kaggle; set KAGGLE_CLI): spawn')).toMatch(/CLI/);
    expect(pauseReason('429 Too Many Requests')).toMatch(/unreachable/);
    expect(pauseReason('the picture came back black (a NaN in fp16)')).toBeNull();
    expect(pauseReason('import: no subject found')).toBeNull();
    expect(pauseReason('the kaggle run did not finish in 4000 s')).toBeNull();
  });
});
