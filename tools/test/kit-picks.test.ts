import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from 'vitest';

import { clipTokenEstimate, kaggleSentencePrompt, kagglePrompt, localPrompt } from '../src/kit/drawers.js';
import { type GenEntry, buildPrompt, entryPlan, kaggleWaveGroups, parseArgs, parseSpec } from '../src/kit/gen.js';
import { parseNotesArgs } from '../src/kit/notes.js';
import {
  type PickContext, type PickLine, describePick, mergeNotes, noteFor, parsePickLines, pickPlan, repeatedWarnings, warningKey, writeNotes,
} from '../src/kit/picks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'kit-picks-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const SPEC = 'tools/kit-gen/rich-items.json';
const stone: GenEntry = { name: 'stone', ref: 'items/stone', what: 'rounded grey stone', width: 64, height: 64, style: 'rich', detail: 'one smooth heavy grey rock' };
const log: GenEntry = { name: 'log', ref: 'items/log', what: 'cut log', width: 64, height: 64, style: 'rich', detail: 'a pale cut end' };
const grass: GenEntry = { name: 'grass', ref: 'tiles/grass', what: 'grass', width: 16, height: 16, kind: 'tile', route: 'grid' };

const picks: PickLine[] = [
  { name: 'stone', spec: SPEC, picked: 'the owner, by eye, 2026-10-23', drawer: 'kaggle', model_key: 'qwen', seed: 2, round: 5 },
  { name: 'log', spec: SPEC, picked: 'the owner, by eye, 2026-10-23', drawer: 'kaggle', seed: 22, round: 3 },
  { name: 'mushroom', spec: SPEC, drawer: 'kaggle', seed: 42, round: 4 },
  { name: 'pebbles', spec: SPEC, picked: 'the owner, by eye, 2026-10-24', drawer: 'codex', candidate: 1, round: 5 },
];
const ctx = (over: Partial<PickContext> = {}): PickContext => ({ spec: SPEC, drawer: 'kaggle', env: {}, ...over });
const refOf = (e: GenEntry): string => `ref/${e.name}.png`;

describe('the picks', () => {
  test('a picked entry carries its seed and recipe', () => {
    expect(pickPlan('stone', picks, ctx())).toEqual({ from: 'the owner, by eye, 2026-10-23', seed: 2, recipe: 'qwen' });
    // a line with a seed and no recipe key (rounds 1-4) carries the seed alone
    expect(pickPlan('log', picks, ctx())).toEqual({ from: 'the owner, by eye, 2026-10-23', seed: 22 });
  });

  test('no pick, a line the owner did not pick, another spec, or a draw with no seed: nothing changes', () => {
    expect(pickPlan('basket', picks, ctx())).toBeNull();
    expect(pickPlan('mushroom', picks, ctx())).toBeNull();
    expect(pickPlan('stone', picks, ctx({ spec: 'tools/kit-gen/other.json' }))).toBeNull();
    expect(pickPlan('pebbles', picks, ctx())).toBeNull();
    expect(pickPlan('stone', [], ctx())).toBeNull();
  });

  test('the explicit recipe wins over the picked one; the seed still carries', () => {
    expect(pickPlan('stone', picks, ctx({ env: { KAGGLE_MODEL: 'sdxl' } }))).toEqual({ from: 'the owner, by eye, 2026-10-23', seed: 2 });
    expect(pickPlan('stone', picks, ctx({ env: { KAGGLE_RECIPE: 'sd15' } }))?.recipe).toBeUndefined();
    expect(pickPlan('stone', picks, ctx({ env: { KAGGLE_MODEL: '  ' } }))?.recipe).toBe('qwen');
  });

  test('a seed means something only on the route that drew it; local takes the seed and no recipe', () => {
    expect(pickPlan('stone', picks, ctx({ drawer: 'local' }))).toBeNull();
    expect(pickPlan('stone', picks, ctx({ drawer: 'codex' }))).toBeNull();
    const local: PickLine[] = [{ name: 'stone', picked: 'the owner, by eye, 2026-10-22', drawer: 'local', seed: 11, model_key: 'flux' }];
    expect(pickPlan('stone', local, ctx({ drawer: 'local' }))?.seed).toBe(11);
    expect(pickPlan('stone', local, ctx({ drawer: 'local' }))?.recipe).toBeUndefined();
  });

  test('the last pick of a name wins, and an unknown recipe is ignored', () => {
    const lines: PickLine[] = [
      { name: 'stone', picked: 'a', drawer: 'kaggle', seed: 1 },
      { name: 'stone', picked: 'b', drawer: 'kaggle', seed: 9, model_key: 'nonsense' },
    ];
    expect(pickPlan('stone', lines, ctx())).toEqual({ from: 'b', seed: 9 });
  });

  test('a grid or scatter entry has no pick to carry', () => {
    expect(entryPlan(grass, [{ name: 'grass', picked: 'x', drawer: 'kaggle', seed: 3 }], ctx())).toBeNull();
    expect(entryPlan(stone, picks, ctx())?.seed).toBe(2);
  });

  test('the dry line names the seed and the recipe', () => {
    expect(describePick('stone', { from: 'the owner, by eye, 2026-10-23', seed: 2, recipe: 'qwen' })).toBe('stone: pick of 2026-10-23: seed 2, recipe qwen');
  });

  test('the committed picks manifest reads, every line of it a pick', () => {
    const lines = parsePickLines(readFileSync(join(root, 'tools/kit-gen/rich-wave.manifest.jsonl'), 'utf8'));
    expect(lines.length).toBeGreaterThan(30);
    expect(lines.every((l) => typeof l.picked === 'string')).toBe(true);
    expect(pickPlan('branch', lines, ctx({ spec: SPEC }))).toMatchObject({ seed: 1, recipe: 'flux' });
  });

  test('--picks, --no-picks and the default', () => {
    expect(parseArgs(['s.json'], {}).picksPath).toMatch(/tools\/kit-gen\/rich-wave\.manifest\.jsonl$/);
    expect(parseArgs(['s.json', '--no-picks'], {}).picksPath).toBeNull();
    expect(parseArgs(['s.json', '--picks', 'p.jsonl'], {}).picksPath).toMatch(/p\.jsonl$/);
    expect(() => parseArgs(['s.json', '--picks'], {})).toThrow(/manifest path/);
    expect(() => parseArgs(['s.json', '--picks', 'p.jsonl', '--no-picks'], {})).toThrow(/together/);
  });
});

describe('the first request of a wave', () => {
  test('a pick puts its seed and recipe in the request, and its prompt is the recipe\'s', () => {
    const [group] = kaggleWaveGroups([stone], picks, ctx(), refOf);
    expect(group?.recipe).toBe('qwen');
    expect(group?.env['KAGGLE_MODEL']).toBe('qwen');
    expect(group?.requests[0]).toMatchObject({ name: 'stone', seed: 2, prompt: kagglePrompt(stone, 'qwen'), reference: 'ref/stone.png', expect: 'stone.png' });
  });

  test('no pick: one group, the environment\'s recipe, no seed in the request', () => {
    const groups = kaggleWaveGroups([stone, log], [], ctx(), refOf);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.recipe).toBe('sd15');
    expect(groups[0]?.env).toEqual({});
    expect(groups[0]?.requests.map((r) => 'seed' in r)).toEqual([false, false]);
    expect(groups[0]?.requests[0]?.prompt).toBe(kagglePrompt(stone, 'sd15'));
  });

  test('entries that pick another recipe go up in their own run; a seed alone stays in the default run', () => {
    const groups = kaggleWaveGroups([log, stone], picks, ctx(), refOf);
    expect(groups.map((g) => [g.recipe, g.requests.map((r) => [r.name, r.seed])])).toEqual([
      ['sd15', [['log', 22]]],
      ['qwen', [['stone', 2]]],
    ]);
  });

  test('an explicit recipe keeps the whole wave in one run, seeds kept', () => {
    const groups = kaggleWaveGroups([log, stone], picks, ctx({ env: { KAGGLE_MODEL: 'sdxl' } }), refOf);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.recipe).toBe('sdxl');
    expect(groups[0]?.requests.map((r) => r.seed)).toEqual([22, 2]);
  });

  test('grid and scatter entries are not in the wave', () => {
    expect(kaggleWaveGroups([grass], [], ctx(), refOf)).toEqual([]);
  });
});

describe('the notes', () => {
  const coarse = (w: number): string => `drawn on a coarser grid: ${w}x83 art pixels for 64x64; spell out more detail`;

  test('a warning seen on two draws of an entry is a note, one is not', () => {
    const notes = repeatedWarnings([
      { name: 'stone', at: '1', warnings: [coarse(53)] },
      { name: 'stone', at: '2', warnings: [coarse(54), 'seam on the left edge'] },
      { name: 'log', at: '1', warnings: [coarse(50)] },
    ]);
    expect([...notes]).toEqual([['stone', ['more fine detail']]]);
  });

  test('a warning twice on one line, or one draw named twice, counts once', () => {
    expect(repeatedWarnings([{ name: 'stone', at: '1', warnings: [coarse(53), coarse(54)] }]).size).toBe(0);
    const same = { name: 'stone', at: '1', warnings: [coarse(53)] };
    expect(repeatedWarnings([same, same]).size).toBe(0);
  });

  test('the warnings of two entries do not add up', () => {
    expect(repeatedWarnings([{ name: 'stone', at: '1', warnings: ['x'] }, { name: 'log', at: '2', warnings: ['x'] }]).size).toBe(0);
  });

  test('an unknown warning is kept as it is, the importer\'s two grid warnings become prompt clauses', () => {
    expect(noteFor('seam on the left edge')).toBe('seam on the left edge');
    expect(noteFor('drawn on 70x70, between one and two times the grid: small shapes break up when voted to 64x64; draw it again with fewer, bigger details')).toBe('fewer, bigger details');
    expect(warningKey('53x83 for 64x64')).toBe('NxN for NxN');
  });

  const basket: GenEntry = { name: 'basket', ref: 'items/basket', what: 'wicker basket', width: 64, height: 64 };
  const text = `${JSON.stringify({ note: 'the wave', entries: [basket, { ...stone, detail: 'a rock' }] }, null, 2)}\n`;
  const runs = [
    { name: 'stone', at: '1', warnings: ['seam on the left edge'] },
    { name: 'stone', at: '2', warnings: ['seam on the left edge'] },
  ];

  test('merging writes notes, keeps the note and the order, and is idempotent', () => {
    const once = mergeNotes(text, repeatedWarnings(runs));
    const json = JSON.parse(once.text) as { note: string; entries: { name: string; notes?: string[] }[] };
    expect(json.note).toBe('the wave');
    expect(json.entries.map((e) => e.name)).toEqual(['basket', 'stone']);
    expect(json.entries[1]?.notes).toEqual(['seam on the left edge']);
    expect(once.text.endsWith('}\n')).toBe(true);
    expect(once.text).toContain('\n  "entries": [\n    {');
    const twice = mergeNotes(once.text, repeatedWarnings(runs));
    expect(twice.text).toBe(once.text);
    expect(twice.added).toEqual({});
  });

  test('a note written by hand stays, and a spec with nothing new is returned untouched', () => {
    const hand = text.replace('"detail": "a rock"', '"detail": "a rock", "notes": ["a hand note"]');
    const merged = JSON.parse(mergeNotes(hand, repeatedWarnings(runs)).text) as { entries: { notes?: string[] }[] };
    expect(merged.entries[1]?.notes).toEqual(['a hand note', 'seam on the left edge']);
    const compact = '{"entries":[{"name":"stone"}]}';
    expect(mergeNotes(compact, new Map()).text).toBe(compact);
  });

  test('the command reads run manifests from files and rewrites the spec once', () => {
    const specPath = join(scratch, 'spec.json');
    const runPath = join(scratch, 'run.jsonl');
    const other = join(scratch, 'run2.jsonl');
    writeFileSync(specPath, text);
    writeFileSync(runPath, `${JSON.stringify(runs[0])}\n`);
    writeFileSync(other, `${JSON.stringify(runs[1])}\n\n`);
    expect(writeNotes(specPath, [runPath])).toEqual({});
    expect(readFileSync(specPath, 'utf8')).toBe(text);
    expect(writeNotes(specPath, [runPath, other])).toEqual({ stone: ['seam on the left edge'] });
    const after = readFileSync(specPath, 'utf8');
    expect(writeNotes(specPath, [runPath, other])).toEqual({});
    expect(readFileSync(specPath, 'utf8')).toBe(after);
    expect(parseSpec(after)[1]?.notes).toEqual(['seam on the left edge']);
  });

  test('the arguments: runs first, the spec last', () => {
    expect(parseNotesArgs(['--runs', 'a.jsonl', 'b.jsonl', 'spec.json'])).toEqual({ runs: ['a.jsonl', 'b.jsonl'], spec: 'spec.json' });
    expect(() => parseNotesArgs(['spec.json'])).toThrow(/Usage/);
    expect(() => parseNotesArgs(['--runs', 'spec.json'])).toThrow(/Usage/);
  });

  test('parseSpec takes notes and refuses a bad shape', () => {
    expect(parseSpec(JSON.stringify({ entries: [{ ...stone, notes: ['more fine detail'] }] }))[0]?.notes).toEqual(['more fine detail']);
    for (const bad of ['text', [1], [''], [' ']]) {
      expect(() => parseSpec(JSON.stringify({ entries: [{ ...stone, notes: bad }] }))).toThrow(/notes/);
    }
  });
});

describe('the notes reach every prompt, after the detail', () => {
  const noted: GenEntry = { ...stone, notes: ['fewer, bigger details'] };
  const reference = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) };

  test('the agent prompt', () => {
    expect(buildPrompt(noted, reference, 'stone.png')).toContain('with one smooth heavy grey rock, fewer, bigger details');
    expect(buildPrompt(stone, reference, 'stone.png')).toBe(buildPrompt({ ...stone, notes: [] }, reference, 'stone.png'));
  });

  test('a notes-only entry has a detail of its own', () => {
    expect(buildPrompt({ ...stone, detail: undefined, notes: ['fewer, bigger details'] }, reference, 'stone.png')).toContain('with fewer, bigger details');
  });

  test('the Stable Diffusion prompt (and the local one)', () => {
    const prompt = kagglePrompt(noted, 'sd15');
    expect(prompt.indexOf('one smooth heavy grey rock')).toBeGreaterThan(-1);
    expect(prompt.indexOf('fewer')).toBeGreaterThan(prompt.indexOf('one smooth heavy grey rock'));
    expect(prompt.indexOf('fewer')).toBeLessThan(prompt.indexOf('thick dark navy outline'));
    expect(kagglePrompt(stone, 'sd15')).not.toContain('fewer');
    expect(localPrompt(noted)).toContain('one smooth heavy grey rock, fewer, bigger details, thick dark navy outline');
  });

  test('the sentence prompt', () => {
    const prompt = kaggleSentencePrompt(noted);
    expect(prompt.indexOf('fewer, bigger details')).toBeGreaterThan(prompt.indexOf('one smooth heavy grey rock'));
    expect(prompt).toContain('One smooth heavy grey rock, fewer, bigger details.');
    expect(kagglePrompt(noted, 'qwen')).toBe(prompt);
  });

  test('under the 77-token window the notes are cut first', () => {
    const long = 'a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z, aa, bb, cc, dd, ee, ff, gg, hh, ii, jj, kk, ll';
    const entry = { ...stone, detail: `${long}, last spec clause`, notes: ['a repeated warning note'] };
    const prompt = kagglePrompt(entry, 'sd15');
    expect(clipTokenEstimate(prompt)).toBeLessThanOrEqual(75);
    expect(prompt).not.toContain('repeated warning');
    expect(prompt).not.toContain('last spec clause');
    expect(prompt).toContain(', q,');
  });
});
