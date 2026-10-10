/** The live picture of parallel work: stacks, prefixes, collisions folded per stream and the merge order. */
import { describe, expect, it } from 'vitest';
import {
  buildReport,
  ciOf,
  classify,
  render,
  type BranchFact,
  type Facts,
  type PrFact,
  type StreamDef,
} from '../src/streams/report';

const pr = (number: number, over: Partial<PrFact> = {}): PrFact => ({ number, title: `pr ${number}`, url: `u/${number}`, draft: false, ci: 'pass', ...over });

const branch = (name: string, over: Partial<BranchFact> = {}): BranchFact => ({
  branch: name,
  exists: true,
  ahead: 2,
  behind: 0,
  unpushed: 0,
  files: 3,
  contains: [],
  conflicts: [],
  ...over,
});

const stream = (id: string, branches: string[], over: Partial<StreamDef> = {}): StreamDef => ({ id, title: id, plan: ['x'], branches, owner: null, ...over });

const facts = (over: Partial<Facts>): Facts => ({ develop: 'abc1234', streams: [], branches: [], collisions: [], strays: [], ...over });

describe('classify', () => {
  it('tells what a person settles from what a command rewrites', () => {
    expect(classify('schema/json/quest.schema.json')).toBe('generated');
    expect(classify('content/values.lock.json')).toBe('generated');
    expect(classify('CREDITS.md')).toBe('generated');
    expect(classify('content/board.json')).toBe('generated');
    expect(classify('DECISIONS.md')).toBe('append');
    expect(classify('kernel/src/step.ts')).toBe('hand');
  });
});

describe('ciOf', () => {
  it('adds a rollup up to one word', () => {
    expect(ciOf([])).toBe('none');
    expect(ciOf([{ conclusion: 'SUCCESS' }, { conclusion: 'SKIPPED' }, { state: 'SUCCESS' }])).toBe('pass');
    expect(ciOf([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }])).toBe('fail');
    expect(ciOf([{ conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS', conclusion: '' }])).toBe('pending');
    expect(ciOf([{ state: 'PENDING' }])).toBe('pending');
  });
});

describe('buildReport', () => {
  it('puts a stack base before the branches built on it, and keeps the stacked ones out of the order', () => {
    const report = buildReport(
      facts({
        streams: [stream('craft', ['wave3', 'wave4'])],
        branches: [
          branch('wave4', { pr: pr(48), contains: ['wave3'] }),
          branch('wave3', { pr: pr(45) }),
        ],
      }),
    );
    expect(report.order.map((e) => e.branch)).toEqual(['wave3']);
    const wave4 = report.entries.find((e) => e.branch === 'wave4')!;
    expect(wave4.state).toBe('waiting-on-base');
    expect(wave4.stackedOn).toEqual(['wave3']);
  });

  it('does not call a branch with no pull request a base: it is an earlier point of the one that holds it', () => {
    const report = buildReport(
      facts({
        streams: [stream('starts', ['axe', 'three'])],
        branches: [branch('axe', { pr: pr(52), contains: ['three'] }), branch('three', { unpushed: 0 })],
      }),
    );
    const axe = report.entries.find((e) => e.branch === 'axe')!;
    const three = report.entries.find((e) => e.branch === 'three')!;
    expect(axe.state).toBe('ready');
    expect(axe.stackedOn).toEqual([]);
    expect(three.state).toBe('inside');
    expect(three.actions[0]).toContain('sits inside axe');
  });

  it('forgets a base that has landed: nothing is ahead of develop any more', () => {
    const report = buildReport(
      facts({
        streams: [stream('s', ['base', 'top'])],
        branches: [branch('base', { ahead: 0, pr: pr(1) }), branch('top', { pr: pr(2), contains: ['base'] })],
      }),
    );
    expect(report.entries.find((e) => e.branch === 'top')!.state).toBe('ready');
    expect(report.entries.find((e) => e.branch === 'base')!.state).toBe('empty');
  });

  it('keeps drafts, failing CI and branches without a pull request out of the order, with the reason', () => {
    const report = buildReport(
      facts({
        streams: [stream('a', ['draft', 'red', 'none', 'ok'])],
        branches: [
          branch('draft', { pr: pr(1, { draft: true }) }),
          branch('red', { pr: pr(2, { ci: 'fail' }) }),
          branch('none', { unpushed: 2 }),
          branch('ok', { pr: pr(4) }),
          branch('gone', { exists: false, ahead: 0 }),
        ],
      }),
    );
    expect(report.order.map((e) => e.branch)).toEqual(['ok']);
    const state = (b: string) => report.entries.find((e) => e.branch === b)!.state;
    expect([state('draft'), state('red'), state('none'), state('gone')]).toEqual(['draft', 'ci-failing', 'no-pr', 'missing']);
    expect(report.entries.find((e) => e.branch === 'none')!.actions.join(' ')).toContain('only on this machine');
  });

  it('folds collisions into one line per pair of streams and sorts the files by who settles them', () => {
    const report = buildReport(
      facts({
        streams: [stream('a', ['a1', 'a2']), stream('b', ['b1'])],
        branches: [branch('a1', { pr: pr(1) }), branch('a2', { pr: pr(2) }), branch('b1', { pr: pr(3) })],
        collisions: [
          { a: 'a1', b: 'b1', files: ['kernel/src/state.ts', 'DECISIONS.md', 'content/values.lock.json'] },
          { a: 'a2', b: 'b1', files: ['kernel/src/state.ts', 'game/src/ui/ui.ts'] },
          { a: 'a1', b: 'a2', files: ['kernel/src/step.ts'] },
        ],
      }),
    );
    expect(report.overlaps).toEqual([
      {
        a: 'a',
        b: 'b',
        hand: ['game/src/ui/ui.ts', 'kernel/src/state.ts'],
        generated: ['content/values.lock.json'],
        append: ['DECISIONS.md'],
      },
    ]);
  });

  it('says nothing about two streams that only both append to DECISIONS.md', () => {
    const report = buildReport(
      facts({
        streams: [stream('a', ['a1']), stream('b', ['b1'])],
        branches: [branch('a1', { pr: pr(1) }), branch('b1', { pr: pr(2) })],
        collisions: [{ a: 'a1', b: 'b1', files: ['DECISIONS.md'] }],
      }),
    );
    expect(report.overlaps).toEqual([]);
    expect(report.order.every((e) => e.collidesWith.length === 0)).toBe(true);
  });

  it('orders by cross-cutting, then base, then the fewest collisions, then the pull request number', () => {
    const report = buildReport(
      facts({
        streams: [stream('quiet', ['q']), stream('busy', ['b']), stream('rename', ['r'], { cross_cutting: true }), stream('base', ['base', 'top'])],
        branches: [
          branch('q', { pr: pr(10) }),
          branch('b', { pr: pr(5) }),
          branch('r', { pr: pr(20) }),
          branch('base', { pr: pr(30) }),
          branch('top', { pr: pr(31), contains: ['base'] }),
        ],
        collisions: [{ a: 'b', b: 'r', files: ['schema/src/index.ts'] }],
      }),
    );
    // the cross-cutting rename leads, then the base that others wait on, then the quiet stream before the busy one
    expect(report.order.map((e) => e.branch)).toEqual(['r', 'base', 'q', 'b']);
  });

  it('lists open pull requests that no stream names', () => {
    const report = buildReport(facts({ strays: [{ number: 53, title: 'docs: a hook', branch: 'docs/hook', draft: false }] }));
    expect(render(report)).toContain('#53 docs/hook');
  });

  it('tells how to merge develop: by hand for source, regenerate for the generated files', () => {
    const report = buildReport(
      facts({
        streams: [stream('a', ['a1'])],
        branches: [
          branch('a1', {
            pr: pr(1),
            behind: 4,
            conflicts: ['kernel/src/state.ts', 'schema/json/quest.schema.json', 'content/values.lock.json', 'DECISIONS.md'],
          }),
        ],
      }),
    );
    const text = report.entries[0]!.actions.join(' ');
    expect(text).toContain('resolve by hand: kernel/src/state.ts');
    expect(text).toContain('pnpm schemas && pnpm values');
    expect(text).not.toContain('DECISIONS.md');
  });
});
