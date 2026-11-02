import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';

import { afterAll, describe, expect, test } from 'vitest';

import { type Draft, DraftIndex, REVIEW_STATES, sha256Hex } from '../src/art/drafts.js';
import { buildLibrary } from '../src/art/library-cli.js';
import { type Run, landChoices, landReviews, prBody, realRun, worktreeDir } from '../src/art/library-land.js';
import { IDS_FILE, REVIEWS_FILE, isMine, parseReviews } from '../src/art/library-reviews.js';
import { type Row } from '../src/art/library.js';
import { renderLibrary } from '../src/art/library.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-library-reviews-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function draft(seed: string, over: Partial<Draft> = {}): Draft {
  const sha = sha256Hex(Buffer.from(seed));
  return {
    id: sha.slice(0, 16), pool: null, name: seed, spec: null, round: null, route: 'codex', recipe: 'codex', model: null, model_version: null, seed: null,
    denoise: null, canvas: null, asked: null, ramps: null, prompt: 'a prompt', negative: null, warnings: [], errors: [], run: null,
    files: { raw: { sha256: sha, bytes: 10 }, full: null, imported: null },
    stored: { repo: 'x/y', tag: 'run-20261030-abcdef', assets: { raw: `${sha.slice(0, 16)}.png` } },
    review: 'unreviewed', at: null, sources: [], ...over,
  };
}

let n = 0;
function indexFile(lines: object[]): string {
  n += 1;
  const path = join(scratch, `idx-${n}.jsonl`);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return path;
}

const rowsOf = (html: string): Row[] => JSON.parse(/<script type="application\/json" id="data">(.*?)<\/script>/s.exec(html)?.[1] ?? '[]') as Row[];

const a = draft('a');
const b = draft('b');
const c = draft('c');
const choice = (id: string, review: string, extra: object = {}): string => JSON.stringify({ id, review, note: '', at: '2026-11-02T10:00:00.000Z', ...extra });

describe('reading reviews.jsonl', () => {
  test('the last line per id wins; a torn, foreign or unknown line is skipped and counted', () => {
    const known = new Set([a.id, b.id]);
    const text = [
      choice(a.id, 'keep'), choice(a.id, 'archive', { note: 'later' }), choice(b.id, 'not-a-state'), choice(c.id, 'keep'),
      'not json at all', JSON.stringify({ id: b.id, review: 'rework', note: 7 }), '{"id":"' + b.id + '","rev', 
    ].join('\n');
    const read = parseReviews(text, known);
    expect(read.choices.size).toBe(1);
    expect(read.choices.get(a.id)).toMatchObject({ review: 'archive', note: 'later' });
    expect(read.skipped).toBe(5);
    expect(read.lines).toBe(7);
  });

  test('every state the page offers is a state the store knows', () => {
    for (const state of REVIEW_STATES) expect(parseReviews(choice(a.id, state), null).choices.get(a.id)?.review).toBe(state);
  });

  test('sorted by hand means the owner gave a state; his way back to unreviewed is not a sort', () => {
    expect(isMine('keep', 'owner')).toBe(true);
    expect(isMine('keep', 'elad')).toBe(true);
    expect(isMine('keep', 'claude-sonnet-5-5 (agent suggestion)')).toBe(false);
    expect(isMine('keep', 'measure')).toBe(false);
    expect(isMine('unreviewed', 'owner')).toBe(false);
    expect(isMine('keep', undefined)).toBe(false);
  });
});

describe('the build lays the owner\'s choices over the index', () => {
  const agent = 'claude-sonnet-5-5 (agent suggestion; the owner delegated the sort, 2026-10-30)';

  test('his choice beats an agent\'s state, even an amendment that came later; the rest stays as the index has it', () => {
    const index = DraftIndex.open(indexFile([
      a, b, c,
      { id: a.id, amend: true, review: 'keep', review_by: agent, review_note: 'agent says keep' },
      { id: b.id, amend: true, review: 'keep', review_by: agent },
      { id: a.id, amend: true, review: 'rework', review_by: agent, review_note: 'agent changed its mind later' },
    ]));
    const out = join(scratch, 'out-merge');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, REVIEWS_FILE), [choice(a.id, 'archive', { note: 'mine' }), choice(b.id, 'unreviewed'), 'torn'].join('\n'));
    const result = buildLibrary(index, out, { fetch: false });
    const rows = rowsOf(readFileSync(join(out, 'index.html'), 'utf8'));
    const row = (id: string): Row => rows.find((r) => r.id === id) as Row;
    expect(row(a.id)).toMatchObject({ r: 'archive', note: 'mine', by: 'owner', o: true, sa: '2026-11-02T10:00:00.000Z' });
    expect(row(b.id)).toMatchObject({ r: 'unreviewed', o: false });
    expect(row(c.id)).toMatchObject({ r: 'unreviewed', note: '', o: false });
    expect(result.reviews).toEqual({ applied: 2, skipped: 1 });
    expect(JSON.parse(readFileSync(join(out, IDS_FILE), 'utf8')) as string[]).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
  });

  test('a rebuild keeps the choices: building twice, and with the index changed, gives the same sort', () => {
    const lines = [a, b, { id: a.id, amend: true, review: 'keep', review_by: agent }];
    const out = join(scratch, 'out-rebuild');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, REVIEWS_FILE), choice(b.id, 'reuse-parts'));
    buildLibrary(DraftIndex.open(indexFile(lines)), out, { fetch: false });
    buildLibrary(DraftIndex.open(indexFile([...lines, { id: b.id, amend: true, review: 'archive', review_by: agent }])), out, { fetch: false });
    const rows = rowsOf(readFileSync(join(out, 'index.html'), 'utf8'));
    expect(rows.find((r) => r.id === b.id)).toMatchObject({ r: 'reuse-parts', o: true });
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ r: 'keep', o: false });
    expect(readFileSync(join(out, REVIEWS_FILE), 'utf8')).toContain(b.id);
  });

  test('landing a choice in the index does not change what the page counts as sorted by hand', () => {
    const path = indexFile([a, b]);
    const choices = parseReviews([choice(a.id, 'keep', { note: 'x' }), choice(b.id, 'unreviewed')].join('\n'), null).choices;
    const before = join(scratch, 'out-before');
    const after = join(scratch, 'out-after');
    for (const out of [before, after]) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, REVIEWS_FILE), [choice(a.id, 'keep', { note: 'x' }), choice(b.id, 'unreviewed')].join('\n')); }
    buildLibrary(DraftIndex.open(path), before, { fetch: false });
    landChoices(DraftIndex.open(path), choices);
    // after the landing the choices are in the index; the page of a folder with no reviews.jsonl reads the same sort
    rmSync(join(after, REVIEWS_FILE));
    buildLibrary(DraftIndex.open(path), after, { fetch: false });
    const pick = (out: string): unknown => rowsOf(readFileSync(join(out, 'index.html'), 'utf8')).map((r) => [r.id, r.r, r.o, r.note]).sort();
    expect(pick(after)).toEqual(pick(before));
  });
});

describe('the page script', () => {
  test('compiles, and the rendered page holds the elements it drives', () => {
    const html = renderLibrary([], { builtAt: '2026-11-02T10:00:00.000Z' });
    const script = /<script>([\s\S]*)<\/script><\/body>/.exec(html)?.[1] ?? '';
    expect(script.length).toBeGreaterThan(1000);
    expect(() => new Script(script)).not.toThrow();
    for (const id of ['cnt', 'bar', 'sv', 'nosrv', 'tools', 'q', 'rv', 'from', 'to', 'quick', 'sel', 'm', 'lb', 'data', 'cfg', 'upd']) expect(html).toContain(`id="${id}"`);
    for (const key of ['ArrowLeft', 'ArrowRight', "'1':'keep'", "'4':'archive'", 'לא מוין ידנית']) expect(script).toContain(key);
  });
});

describe('landing the choices in the index', () => {
  const choicesOf = (...lines: string[]): ReturnType<typeof parseReviews>['choices'] => parseReviews(lines.join('\n'), null).choices;

  test('writes amendment lines in the index\'s format, and a second landing writes nothing', () => {
    const path = indexFile([a, b, { id: b.id, amend: true, review: 'keep', review_by: 'claude (agent)', review_note: 'agent note' }]);
    const choices = choicesOf(choice(a.id, 'keep', { note: 'good' }), choice(b.id, 'archive'));
    const first = landChoices(DraftIndex.open(path), choices);
    expect(first.written.sort()).toEqual([a.id, b.id].sort());
    const lines = readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.slice(-2)).toEqual([
      { id: a.id, amend: true, review: 'keep', review_by: 'owner', review_note: 'good' },
      // an agent's note must not stay on his choice
      { id: b.id, amend: true, review: 'archive', review_by: 'owner', review_note: '' },
    ]);
    const size = readFileSync(path, 'utf8').length;
    const second = landChoices(DraftIndex.open(path), choices);
    expect(second.written).toEqual([]);
    expect(second.same).toBe(2);
    expect(readFileSync(path, 'utf8')).toHaveLength(size);
  });

  test('the last choice for an id wins, and a changed mind lands as one new line', () => {
    const path = indexFile([a]);
    expect(landChoices(DraftIndex.open(path), choicesOf(choice(a.id, 'keep'), choice(a.id, 'rework'))).written).toEqual([a.id]);
    expect(DraftIndex.open(path).drafts.get(a.id)).toMatchObject({ review: 'rework', review_by: 'owner' });
    expect(landChoices(DraftIndex.open(path), choicesOf(choice(a.id, 'keep'))).written).toEqual([a.id]);
    expect(DraftIndex.open(path).drafts.get(a.id)?.review).toBe('keep');
  });

  test('"unreviewed" on a draft nobody sorted writes nothing; on a sorted one it takes the state back', () => {
    const path = indexFile([a, b, { id: b.id, amend: true, review: 'keep', review_by: 'claude (agent)' }]);
    const result = landChoices(DraftIndex.open(path), choicesOf(choice(a.id, 'unreviewed'), choice(b.id, 'unreviewed')));
    expect(result.written).toEqual([b.id]);
    expect(DraftIndex.open(path).drafts.get(b.id)?.review).toBe('unreviewed');
  });

  test('the index only grows', () => {
    const path = indexFile([a]);
    const before = readFileSync(path, 'utf8');
    landChoices(DraftIndex.open(path), choicesOf(choice(a.id, 'keep')));
    expect(readFileSync(path, 'utf8').startsWith(before)).toBe(true);
  });
});

describe('the landing branch and pull request', () => {
  function fake(open: object[] = []): { run: Run; calls: string[] } {
    const calls: string[] = [];
    const run: Run = (cmd, args, cwd) => {
      const line = `${cmd} ${args.join(' ')}`;
      calls.push(cwd === undefined ? line : `${line} @${cwd}`);
      if (cmd === 'git' && args[0] === 'show') return { status: 0, stdout: [a, b].map((d) => JSON.stringify(d)).join('\n') + '\n', stderr: '' };
      if (cmd === 'gh' && args[1] === 'list') return { status: 0, stdout: JSON.stringify(open), stderr: '' };
      if (cmd === 'git' && args[0] === 'worktree') { mkdirSync(args[args.length - 2] as string, { recursive: true }); writeFileSync(join(args[args.length - 2] as string, 'drafts.jsonl'), ''); return { status: 0, stdout: '', stderr: '' }; }
      if (cmd === 'git' && args[0] === 'branch') return { status: 0, stdout: `${args.length > 1 ? '' : 'art/library-reviews-20261102-1000'}\n`, stderr: '' };
      if (cmd === 'gh' && args[1] === 'create') return { status: 0, stdout: 'https://github.com/x/y/pull/1\n', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    };
    return { run, calls };
  }
  const reviews = (): string => { const f = join(scratch, `rv-${(n += 1)}.jsonl`); writeFileSync(f, choice(a.id, 'keep') + '\n'); return f; };

  test('a dry run counts against origin/develop and touches no branch', () => {
    const { run, calls } = fake();
    const result = landReviews({ reviewsFile: reviews(), apply: false, pr: false, run, root: scratch });
    expect(result.written).toEqual([a.id]);
    expect(calls.some((c) => c.includes('worktree') || c.includes('push') || c.includes('commit'))).toBe(false);
  });

  test('a landing pull request that is still open refuses another one', () => {
    const { run } = fake([{ number: 700, headRefName: 'art/library-reviews-20261101-0900' }]);
    expect(() => landReviews({ reviewsFile: reviews(), apply: true, pr: true, run, root: scratch })).toThrow(/#700/);
  });

  test('the worktree sits beside the repo and is named for the branch', () => {
    expect(worktreeDir('/work/Projects/GAME', 'art/library-reviews-20261102-1000')).toBe('/work/Projects/GAME.worktrees/art-library-reviews-20261102-1000');
    expect(worktreeDir('/work/Projects/GAME.worktrees/feat-x', 'art/y')).toBe('/work/Projects/GAME.worktrees/art-y');
  });

  test('the body names the issue and the tree line CI asks for', () => {
    const body = prBody(3, ['1', '2', '3']);
    expect(body).toMatch(/^Issue #658$/m);
    expect(body).toMatch(/^Tree: none: .{10,}/m);
  });
});

describe('landing on a real branch', () => {
  test('--apply makes a branch from origin/develop in a worktree beside the repo, with one commit that touches only the index, and the open-pull-request check, not the index, stops a repeat', () => {
    const home = mkdtempSync(join(scratch, 'git-'));
    const git = (cwd: string, ...args: string[]): string => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
    const origin = join(home, 'origin.git');
    git(home, 'init', '--bare', '-b', 'develop', origin);
    const repo = join(home, 'GAME');
    git(home, 'clone', '-q', origin, repo);
    // the landing command commits through plain git: a CI runner has no global identity (worktrees inherit the repo's)
    git(repo, 'config', 'user.name', 't');
    git(repo, 'config', 'user.email', 't@t');
    mkdirSync(join(repo, 'tools/kit-gen'), { recursive: true });
    writeFileSync(join(repo, 'tools/kit-gen/drafts.jsonl'), [a, b].map((d) => JSON.stringify(d)).join('\n') + '\n');
    git(repo, 'checkout', '-q', '-b', 'develop');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'index');
    git(repo, 'push', '-q', 'origin', 'develop');
    const reviewsFile = join(home, 'reviews.jsonl');
    writeFileSync(reviewsFile, [choice(a.id, 'keep', { note: 'good' }), choice(b.id, 'archive')].join('\n') + '\n');
    const run: Run = (cmd, args, cwd) => (cmd === 'gh' ? { status: 0, stdout: '[]', stderr: '' } : realRun(cmd, args, cwd));
    const result = landReviews({ reviewsFile, apply: true, pr: false, run, root: repo, now: new Date('2026-11-02T10:05:00Z') });
    expect(result.branch).toBe('art/library-reviews-20261102-1005');
    expect(result.dir).toBe(join(home, 'GAME.worktrees', 'art-library-reviews-20261102-1005'));
    expect(git(result.dir as string, 'branch', '--show-current').trim()).toBe(result.branch);
    expect(git(result.dir as string, 'diff', '--name-only', 'origin/develop', 'HEAD').trim()).toBe('tools/kit-gen/drafts.jsonl');
    expect(git(result.dir as string, 'rev-list', '--count', 'origin/develop..HEAD').trim()).toBe('1');
    // the branch never tracks develop
    expect(() => git(result.dir as string, 'rev-parse', '--abbrev-ref', '@{upstream}')).toThrow(/no upstream/);
    const landed = DraftIndex.open(join(result.dir as string, 'tools/kit-gen/drafts.jsonl'));
    expect(landed.drafts.get(a.id)).toMatchObject({ review: 'keep', review_by: 'owner', review_note: 'good' });
    // nothing is on develop yet, so a second run against it still sees the choices: the open-pull-request check is what stops a repeat
    expect(landReviews({ reviewsFile, apply: false, pr: false, run, root: repo }).written).toHaveLength(2);
  });
});
