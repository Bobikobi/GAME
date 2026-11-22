import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { type Draft, DraftIndex, type Gh, foldIndex, isRemoved } from '../src/art/drafts.js';
import { type ListRow, coldCopy, deleteFromStore, parseList, rowsThatFail } from '../src/art/prune-apply.js';
import { type Choice, type PickClose, type PruneInput, planPrune, protectedBy, sampleFor } from '../src/art/prune.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-prune-test-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const NOW = new Date('2026-11-22T12:00:00Z');

function draft(seed: string, over: Partial<Draft> = {}): Draft {
  const h = sha(seed);
  return {
    id: h.slice(0, 16), pool: null, name: seed, spec: null, round: null, route: 'codex', recipe: 'codex', model: null, model_version: null, seed: null,
    denoise: null, canvas: [64, 64], asked: [64, 64], ramps: null, prompt: 'p', negative: null, warnings: [], errors: [], run: null,
    files: { raw: { sha256: h, bytes: 100 }, full: null, imported: null },
    stored: { repo: 'x/y', tag: 'run-20261001-aaaaaa', assets: { raw: `${h.slice(0, 16)}.png` } },
    review: 'unreviewed', at: '2026-10-25T10:00:00.000Z',
    sources: [{ label: 'a-wave', spec: null, run: 'run-1', file: `${seed}.png`, at: '2026-10-25T10:00:00.000Z', provenance: null }],
    ...over,
  };
}

function input(drafts: Draft[], over: Partial<PruneInput> = {}): PruneInput {
  return {
    drafts, owner: new Map<string, Choice>(), uses: new Map(), closes: [], hubOk: () => true, retired: [], nameHits: () => [], present: null,
    objects: new Set(), now: NOW, ...over,
  };
}

const removedIds = (p: ReturnType<typeof planPrune>, rule: string): string[] => p.remove.filter((v) => v.rule === rule).map((v) => v.id);

describe('R1 owner-archive', () => {
  test('the owner\'s page archive is removed; an agent\'s archive is not', () => {
    const mine = draft('mine');
    const agents = draft('agents', { review: 'archive', review_by: 'claude-sonnet-5-5 (agent suggestion)' });
    const plan = planPrune(input([mine, agents], { owner: new Map([[mine.id, { review: 'archive', at: '2026-11-02T09:00:00Z' }]]) }));
    expect(removedIds(plan, 'R1')).toEqual([mine.id]);
  });
  test('an index review archive stamped by the owner is removed, unless the page changed his mind', () => {
    const a = draft('a', { review: 'archive', review_by: 'owner' });
    const b = draft('b', { review: 'archive', review_by: 'elad' });
    const plan = planPrune(input([a, b], { owner: new Map([[b.id, { review: 'unreviewed', at: '2026-11-03T09:00:00Z' }]]) }));
    expect(removedIds(plan, 'R1')).toEqual([a.id]);
  });
  test('kept: archived on the page but reviewed keep in the index, or used by a file, or a wrong draw kept for another role', () => {
    const keep = draft('keep', { review: 'keep' });
    const used = draft('used');
    const wrong = draft('wrong', { review: 'archive', review_by: 'owner', looks_like: 'a cutting board' });
    const archive: Choice = { review: 'archive', at: '2026-11-02T09:00:00Z' };
    const plan = planPrune(input([keep, used, wrong], { owner: new Map([[keep.id, archive], [used.id, archive]]), uses: new Map([[used.id, ['content/kit/core/props/x.png']]]) }));
    expect(plan.remove).toEqual([]);
    expect(plan.held.map((h) => h.by)).toEqual(expect.arrayContaining(['reviewed keep', 'used by content/kit/core/props/x.png', 'a wrong draw kept for another role']));
  });
  test('the owner\'s page keep beats an index archive', () => {
    const d = draft('d', { review: 'archive', review_by: 'owner' });
    expect(planPrune(input([d], { owner: new Map([[d.id, { review: 'keep', at: '2026-11-03T09:00:00Z' }]]) })).remove).toEqual([]);
  });
  test('an archived object with no kept draft and no sprite is the doubtful one', () => {
    const lonely = draft('lonely_thing');
    const homed = draft('homed_thing');
    const twin = draft('twin', { name: 'homed_thing_keep', review: 'keep' });
    void twin;
    const archive: Choice = { review: 'archive', at: '2026-11-02T09:00:00Z' };
    const plan = planPrune(input([lonely, homed], { owner: new Map([[lonely.id, archive], [homed.id, archive]]), objects: new Set(['homed_thing']) }));
    const by = new Map(plan.remove.map((v) => [v.id, v.sure]));
    expect(by.get(lonely.id)).toBeLessThan(by.get(homed.id)!);
  });
});

describe('R2 pick-lost', () => {
  const close: PickClose = {
    id: 'trial', closed: '2026-11-22', decision: 'x', hub: 'trial',
    lost: [{ label: 'trial', run: '^R1-walk(8|15)$' }],
    scratch: [{ label: 'trial', run: '^(frames|walk8)$' }],
    keep: [{ label: 'trial', run: '(bite|R2b)' }],
  };
  const src = (run: string, label = 'trial'): Draft['sources'][number] => ({ label, spec: null, run, file: 'f.png', at: null, provenance: null });
  test('a draft whose only homes are lost options (and the trial\'s working folders) is removed, even when young', () => {
    const lost = draft('lost', { at: '2026-11-21T00:00:00Z', sources: [src('R1-walk8'), src('walk8')] });
    expect(removedIds(planPrune(input([lost], { closes: [close], now: new Date('2026-11-22T12:00:00Z') })), 'R2')).toEqual([lost.id]);
  });
  test('kept: a frame the winner also holds, a bite, or an option of another pick', () => {
    const shared = draft('shared', { sources: [src('R1-walk8'), src('R1c-walk8')] });
    const bite = draft('bite', { sources: [src('R1-walk8'), src('R1c-bite8')] });
    const other = draft('other', { sources: [src('R1c-walk8')] });
    const elsewhere = draft('elsewhere', { sources: [src('R1-walk8', 'other-bench')] });
    expect(planPrune(input([shared, bite, other, elsewhere], { closes: [close] })).remove).toEqual([]);
  });
  test('a missing hub answer makes the verdict doubtful', () => {
    const lost = draft('lost2', { sources: [src('R1-walk15')] });
    const plan = planPrune(input([lost], { closes: [close], hubOk: () => false }));
    expect(plan.remove[0]?.sure).toBeLessThan(0.5);
  });
});

describe('R3 old-era', () => {
  test('a draft made before the 64 px decision at 32 px, or named at the old scale, is removed', () => {
    const early = draft('early', { at: '2026-10-17T10:00:00Z', asked: [32, 32] });
    const named = draft('named', { name: 'campfire-16px', canvas: [16, 16], at: null, sources: [{ label: 'campfire-unlit-16px', spec: null, run: null, file: 'c-16px.png', at: null, provenance: null }] });
    expect(removedIds(planPrune(input([early, named])), 'R3').sort()).toEqual([early.id, named.id].sort());
  });
  test('kept: a 32 px draft of the 64 px era, a 64 px draft, a reviewed or used one', () => {
    const later = draft('later', { at: '2026-11-02T10:00:00Z', asked: [32, 32] });
    const big = draft('big', { at: '2026-10-17T10:00:00Z', asked: [64, 64] });
    const reviewed = draft('reviewed', { at: '2026-10-17T10:00:00Z', asked: [32, 32], review: 'rework' });
    const used = draft('usedone', { at: '2026-10-17T10:00:00Z', asked: [32, 32] });
    const plan = planPrune(input([later, big, reviewed, used], { uses: new Map([[used.id, ['content/kit/core/x.png']]]) }));
    expect(plan.remove).toEqual([]);
  });
});

describe('R4 retired-subject', () => {
  const retired = [{ name: 'old_hero', why: 'retired by decision 43' }];
  test('removed when the pools retire the subject and nothing names it', () => {
    const d = draft('old_hero');
    expect(removedIds(planPrune(input([d], { retired })), 'R4')).toEqual([d.id]);
  });
  test('kept while a file of content/ or docs/design/ still names it, or it is 3D', () => {
    const d = draft('old_hero');
    const plan = planPrune(input([d], { retired, nameHits: () => ['content/kit/core/kit.json'] }));
    expect(plan.remove).toEqual([]);
    expect(plan.held[0]?.by).toContain('still names it');
    const glb = draft('old_hero_3d', { name: 'old_hero_3d', files: { raw: { sha256: sha('g'), bytes: 9, ext: '.glb' }, full: null, imported: null } });
    expect(planPrune(input([glb], { retired: [{ name: 'old_hero_3d', why: 'x' }] })).remove).toEqual([]);
  });
});

describe('R5 duplicate', () => {
  test('a draft whose raw picture is another draft\'s imported file goes when the other ranks higher', () => {
    const imported = sha('shared bytes');
    const keeper = draft('keeper', { review: 'keep', files: { raw: { sha256: sha('keeper'), bytes: 9 }, full: null, imported: { sha256: imported, bytes: 9 } } });
    const dup = draft('dup', { files: { raw: { sha256: imported, bytes: 9 }, full: null, imported: null } });
    // a draft id is the first 16 hex of its raw hash
    dup.id = imported.slice(0, 16);
    expect(removedIds(planPrune(input([keeper, dup])), 'R5')).toEqual([dup.id]);
  });
  test('kept: when the other is the one being removed by another rule, when it ranks lower, or when the draft has a file nobody else holds', () => {
    const imported = sha('shared 2');
    const archived = draft('archived', { files: { raw: { sha256: sha('a2'), bytes: 9 }, full: null, imported: { sha256: imported, bytes: 9 } } });
    const dup = draft('dup2', { files: { raw: { sha256: imported, bytes: 9 }, full: null, imported: null } });
    dup.id = imported.slice(0, 16);
    const plan = planPrune(input([archived, dup], { owner: new Map([[archived.id, { review: 'archive', at: '2026-11-02T09:00:00Z' }]]) }));
    expect(removedIds(plan, 'R5')).toEqual([]);
    const own = draft('own', { files: { raw: { sha256: imported, bytes: 9 }, full: null, imported: { sha256: sha('only mine'), bytes: 9 } } });
    own.id = imported.slice(0, 16);
    const keeper = draft('keeper2', { review: 'keep', files: { raw: { sha256: sha('k2'), bytes: 9 }, full: null, imported: { sha256: imported, bytes: 9 } } });
    expect(removedIds(planPrune(input([keeper, own])), 'R5')).toEqual([]);
  });
});

describe('R6 broken', () => {
  test('errors set, an empty file, or a file missing from the store are removed', () => {
    const errored = draft('errored', { errors: ['import: nothing on its magenta'] });
    const empty = draft('empty', { files: { raw: { sha256: sha('empty'), bytes: 0 }, full: null, imported: null } });
    const gone = draft('gone');
    const here = draft('here');
    const plan = planPrune(input([errored, empty, gone, here], { present: new Set([`${here.id}.png`, `${errored.id}.png`, `${empty.id}.png`]) }));
    expect(removedIds(plan, 'R6').sort()).toEqual([errored.id, empty.id, gone.id].sort());
  });
  test('kept: a sound draft, a reviewed one, a young one', () => {
    const fine = draft('fine');
    const reviewed = draft('rev', { errors: ['x'], review: 'reuse-parts' });
    const young = draft('young', { errors: ['x'], at: '2026-11-20T00:00:00Z', sources: [] });
    expect(planPrune(input([fine, reviewed, young], { present: null })).remove).toEqual([]);
  });
});

describe('the protections', () => {
  test('a draft under 7 days old is kept, except by a pick that closed on it', () => {
    const young = draft('young2', { errors: ['x'], at: '2026-11-20T00:00:00Z', sources: [] });
    expect(planPrune(input([young])).remove).toEqual([]);
    expect(protectedBy(young, input([young]))).toBeNull();
  });
  test('the 3D door is never removed', () => {
    const glb = draft('model', { files: { raw: { sha256: sha('m'), bytes: 0, ext: '.glb' }, full: null, imported: null } });
    expect(planPrune(input([glb])).remove).toEqual([]);
  });
  test('an undated draft is kept by the rules that need an age', () => {
    const d = draft('undated', { at: null, sources: [], errors: [], asked: null });
    expect(planPrune(input([d])).remove).toEqual([]);
  });
  test('the sample is deterministic and puts the least sure first', () => {
    const vs = Array.from({ length: 80 }, (_, i) => ({ id: i.toString(16).padStart(16, '0'), rule: 'R1' as const, code: 'owner-archive', why: '', sure: i === 79 ? 0.4 : 1, bytes: 1 }));
    const a = sampleFor(vs, 812);
    expect(a.doubtful[0]?.id).toBe(vs[79]!.id);
    expect(sampleFor(vs, 812)).toEqual(a);
    expect(a.doubtful.length + a.sample.length).toBe(48);
  });
});

describe('the removal', () => {
  function store(...drafts: Draft[]): { gh: Gh; calls: string[][]; blobs: Map<string, string> } {
    const calls: string[][] = [];
    const blobs = new Map<string, string>();
    const gh: Gh = (args) => {
      calls.push([...args]);
      if (args[0] === 'release' && args[1] === 'download') {
        const dir = args[args.indexOf('--dir') + 1]!;
        for (let i = 0; i < args.length; i += 1) if (args[i] === '-p') { const body = blobs.get(args[i + 1]!); if (body !== undefined) writeFileSync(join(dir, args[i + 1]!), body); }
      }
      return { status: 0, stdout: '', stderr: '' };
    };
    for (const d of drafts) blobs.set(d.stored!.assets.raw!, d.name);
    return { gh, calls, blobs };
  }
  const rowOf = (d: Draft): ListRow => ({ id: d.id, rule: 'R1', code: 'owner-archive', name: d.name, tag: d.stored!.tag, assets: Object.values(d.stored!.assets), bytes: 1 });
  // the file's bytes are the draft's name, so its hash is the draft's raw hash
  const mk = (name: string): Draft => { const d = draft(name); return d; };

  test('a cold copy is checked against the index and kept under tag/asset', () => {
    const d = mk('one');
    const s = store(d);
    const dest = join(scratch, 'cold-ok');
    const r = coldCopy([rowOf(d)], new Map([[d.id, d]]), dest, s.gh);
    expect(r.failures).toEqual([]);
    expect(r.copied).toBe(1);
    expect(readFileSync(join(dest, d.stored!.tag, d.stored!.assets.raw!), 'utf8')).toBe('one');
  });
  test('a file that fails its check is a failure and is not kept', () => {
    const d = mk('two');
    const s = store(d);
    s.blobs.set(d.stored!.assets.raw!, 'tampered');
    const dest = join(scratch, 'cold-bad');
    const r = coldCopy([rowOf(d)], new Map([[d.id, d]]), dest, s.gh);
    expect(r.failures[0]).toContain('sha256');
    expect(existsSync(join(dest, d.stored!.tag, d.stored!.assets.raw!))).toBe(false);
  });
  test('a missing download is a failure', () => {
    const d = mk('three');
    const s = store(d);
    s.blobs.delete(d.stored!.assets.raw!);
    expect(coldCopy([rowOf(d)], new Map([[d.id, d]]), join(scratch, 'cold-missing'), s.gh).failures[0]).toContain('not downloaded');
  });
  test('deletes go by asset id, and a release left empty is deleted too', () => {
    const a = mk('four');
    const b = mk('five');
    b.stored!.tag = 'run-other';
    const c = mk('six');
    const s = store();
    const listing = [
      { id: 1, name: a.stored!.assets.raw!, tag: a.stored!.tag },
      { id: 2, name: c.stored!.assets.raw!, tag: a.stored!.tag },
      { id: 3, name: b.stored!.assets.raw!, tag: 'run-other' },
    ];
    const r = deleteFromStore([rowOf(a), rowOf(b)], new Map([[a.id, a], [b.id, b]]), listing, s.gh);
    expect(r.deleted).toBe(2);
    expect(r.releasesDeleted).toEqual(['run-other']);
    expect(s.calls.map((x) => x.join(' '))).toEqual(expect.arrayContaining([expect.stringContaining('releases/assets/1'), expect.stringContaining('releases/assets/3'), expect.stringContaining('release delete run-other')]));
    expect(s.calls.some((x) => x.join(' ').includes('releases/assets/2'))).toBe(false);
  });
  test('rows that no longer hold stop the run', () => {
    const d = draft('seven');
    const plan = planPrune(input([d]));
    expect(rowsThatFail([rowOf(d)], plan)[0]).toContain('no longer removes it');
    expect(rowsThatFail([], plan)).toEqual([]);
  });
  test('the list parses and refuses a line that is not a row', () => {
    expect(parseList(`${JSON.stringify(rowOf(draft('eight')))}\n`)).toHaveLength(1);
    expect(() => parseList('{"id":"x"}\n')).toThrow();
  });
  test('the amendment folds into `removed` and the index only grows', () => {
    const d = draft('nine');
    const path = join(scratch, 'idx.jsonl');
    writeFileSync(path, `${JSON.stringify(d)}\n`);
    const index = DraftIndex.open(path);
    expect(index.markRemoved(d.id, 'owner-archive', '2026-11-22T12:00:00Z')).toBe(true);
    expect(index.markRemoved(d.id, 'owner-archive', '2026-11-22T13:00:00Z')).toBe(false);
    const text = readFileSync(path, 'utf8');
    expect(text.startsWith(`${JSON.stringify(d)}\n`)).toBe(true);
    const line = JSON.parse(text.trim().split('\n').at(-1)!) as Record<string, unknown>;
    expect(line).toEqual({ id: d.id, amend: true, removed: 'owner-archive', at: '2026-11-22T12:00:00Z' });
    const folded = foldIndex(text.trim().split('\n').map((l) => JSON.parse(l) as never)).get(d.id)!;
    expect(isRemoved(folded)).toBe(true);
    expect(folded.removed_at).toBe('2026-11-22T12:00:00Z');
    expect(readdirSync(scratch).length).toBeGreaterThan(0);
    mkdirSync(join(scratch, 'x'), { recursive: true });
  });
});
