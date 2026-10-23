/** base-available: the base of the checks against develop, on a throwaway git repository. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitReader, mergedPullRequests, resolveBase } from '../src/decisions/base';

let dir = '';
let plain = '';
const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const commit = (file: string, text: string, subject: string): string => {
  writeFileSync(join(dir, file), text);
  git('add', file);
  git('commit', '-q', '-m', subject);
  return git('rev-parse', 'HEAD');
};

let baseTip = '';
let start = '';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'decisions-base-'));
  plain = join(dir, 'not-git');
  git('init', '-q', '-b', 'develop');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  start = commit('a.txt', 'one\n', 'first (#1)');
  git('checkout', '-q', '-b', 'feat');
  commit('b.txt', 'branch\n', 'the branch');
  git('checkout', '-q', 'develop');
  baseTip = commit('a.txt', 'two\n', 'second (#2)');
  git('merge', '-q', '--no-ff', '-m', 'Merge pull request #3 from someone/feat', 'feat');
  git('update-ref', 'refs/remotes/origin/develop', start);
  mkdirSync(plain);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('base-available', () => {
  it('skip runs no base check and prints nothing', () => {
    expect(resolveBase({ DECISIONS_BASE: 'skip', CI: 'true' }, dir)).toEqual({ ref: null, issues: [] });
  });

  it('HEAD^1 of a merge commit reads the base tip', () => {
    const base = resolveBase({ DECISIONS_BASE: 'HEAD^1' }, dir);
    expect(base).toEqual({ ref: baseTip, issues: [] });
    expect(gitReader(base.ref ?? '', ['a.txt', 'b.txt'], dir)).toEqual(
      new Map([
        ['a.txt', 'two\n'],
        ['b.txt', null],
      ]),
    );
  });

  it('unset takes the merge base with origin/develop', () => {
    expect(resolveBase({}, dir).ref).toBe(start);
  });

  it('an unreadable base is an error in CI and a warning on a machine', () => {
    const ci = resolveBase({ DECISIONS_BASE: 'no-such-ref', CI: 'true' }, dir);
    expect(ci.ref).toBeNull();
    expect(ci.issues).toEqual([expect.objectContaining({ level: 'error', message: expect.stringMatching(/cannot be read.*\[base-available\]$/) })]);
    expect(resolveBase({ DECISIONS_BASE: 'no-such-ref' }, dir).issues[0].level).toBe('warning');
  });

  it('no git here is one warning and no base', () => {
    const base = resolveBase({ CI: 'true' }, plain, () => null);
    expect(base.ref).toBeNull();
    expect(base.issues).toEqual([expect.objectContaining({ level: 'warning', message: expect.stringMatching(/not a git checkout/) })]);
  });

  it('reads the pull request numbers of the history', () => {
    expect(mergedPullRequests(dir)).toEqual(new Set([1, 2, 3]));
    expect(mergedPullRequests(dir, () => null)).toBeNull();
  });
});
