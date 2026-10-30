import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Credit } from '@game/kernel';
import { boardIsCurrent, boardText, computeBoard, creatorsOf, readCommits, readPoints, squashedCommits, type Commit, type PointsConfig } from '../src/board';
import { REPO_ROOT } from '../src/load';

/** A scratch repository: `git(cwd, ...args)`, and `commit(cwd, message, ...files)` writes each file and commits it. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], { cwd, encoding: 'utf8' });
}
function commit(cwd: string, message: string, ...files: string[]): void {
  for (const f of files) {
    mkdirSync(dirname(join(cwd, f)), { recursive: true });
    writeFileSync(join(cwd, f), `${message}\n`);
  }
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
}

describe('board and points', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'loomvale-points-test-'));
  afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

  it('reads points from .github/points.json correctly', () => {
    const points = readPoints(REPO_ROOT);
    expect(points.per_record).toBe(10);
    expect(points.per_commit).toBe(1);
    expect(points.per_approval).toBe(5);
    expect(points.weekly_pool).toBe(1000);
    expect(points.weekly_pool_active).toBe(false);
  });

  it('refuses a points file with an unknown key', () => {
    const customDir = join(tempDir, 'unknown-key');
    mkdirSync(join(customDir, '.github'), { recursive: true });
    writeFileSync(
      join(customDir, '.github', 'points.json'),
      JSON.stringify({
        per_record: 10,
        per_commit: 1,
        per_approval: 5,
        weekly_pool: 1000,
        weekly_pool_active: false,
        extra_key: 123,
      }),
    );
    expect(() => readPoints(customDir)).toThrow(/Invalid key "extra_key"/);
  });

  it('refuses a points file with a missing key', () => {
    const customDir = join(tempDir, 'missing-key');
    mkdirSync(join(customDir, '.github'), { recursive: true });
    writeFileSync(
      join(customDir, '.github', 'points.json'),
      JSON.stringify({
        per_record: 10,
        per_commit: 1,
        per_approval: 5,
        weekly_pool: 1000,
      }),
    );
    expect(() => readPoints(customDir)).toThrow(/Missing key/);
  });

  it('a fixture of commits gives points equal to per_record * records + per_commit * commits', () => {
    const points: PointsConfig = {
      per_record: 10,
      per_commit: 2,
      per_approval: 5,
      weekly_pool: 1000,
      weekly_pool_active: false,
    };

    const commits: Commit[] = [
      { at: 1000, files: ['content/extensions/alice/plum.json'] },
      { at: 2000, files: ['content/kit/alice/sprites.png'] },
      { at: 3000, files: ['content/extensions/bob/quest.json'] },
    ];

    const credits: Credit[] = [
      { id: 'plum', type: 'item', title: 'Plum', creator: 'alice', file: 'content/extensions/alice/plum.json', ai_tools: [] },
      { id: 'plum_bush', type: 'resource', title: 'Bush', creator: 'alice', file: 'content/extensions/alice/bush.json', ai_tools: [] },
      { id: 'quest1', type: 'quest', title: 'Quest', creator: 'bob', file: 'content/extensions/bob/quest.json', ai_tools: [] },
    ];

    const board = computeBoard(commits, credits, points);

    // alice: 2 records * 10 + 2 commits * 2 = 20 + 4 = 24 points
    expect(board['alice']).toEqual({
      points: 24,
      records: 2,
      commits: 2,
    });

    // bob: 1 record * 10 + 1 commit * 2 = 10 + 2 = 12 points
    expect(board['bob']).toEqual({
      points: 12,
      records: 1,
      commits: 1,
    });

    // core: every commit counts for core (3 commits * 2 = 6 points)
    expect(board['core']).toEqual({
      points: 6,
      records: 0,
      commits: 3,
    });
  });

  it('a board file is current only when it is byte for byte what the board writes', () => {
    const file = join(tempDir, 'current', 'board.json');
    mkdirSync(dirname(file), { recursive: true });
    const board = { core: { points: 7, records: 0, commits: 7 } };
    expect(boardIsCurrent(board, file)).toBe(false);
    writeFileSync(file, boardText(board));
    expect(boardIsCurrent(board, file)).toBe(true);
    // the hand edit the check exists for: one number
    writeFileSync(file, boardText(board).replace('"points": 7', '"points": 700'));
    expect(boardIsCurrent(board, file)).toBe(false);
  });

  it('a branch counts as the one commit develop gets from its squash, a board-only branch as none', () => {
    const repo = join(tempDir, 'squash');
    mkdirSync(repo, { recursive: true });
    git(repo, 'init', '-q', '-b', 'main');
    commit(repo, 'core', 'content/core/a.json');
    commit(repo, 'alice', 'content/extensions/alice/plum.json');
    expect(readCommits(repo)).toHaveLength(2);

    // two commits by bob on a branch, one of them also rewriting the board
    git(repo, 'checkout', '-q', '-b', 'feat/bob');
    commit(repo, 'bob 1', 'content/extensions/bob/quest.json');
    commit(repo, 'bob 2', 'content/extensions/bob/quest.json', 'content/board.json');
    expect(readCommits(repo)).toHaveLength(4);
    const squashed = squashedCommits('main', repo);
    expect(squashed).toHaveLength(3);
    expect(squashed[2]!.files.sort()).toEqual(['content/board.json', 'content/extensions/bob/quest.json']);
    expect([...creatorsOf(squashed[2]!)].sort()).toEqual(['bob', 'core']);
    expect(squashed[2]!.at).toBeGreaterThan(squashed[1]!.at);

    // a branch that only rewrote the board adds nothing, like such a commit in the history
    git(repo, 'checkout', '-q', '-b', 'chore/board', 'main');
    commit(repo, 'board only', 'content/board.json');
    expect(readCommits(repo)).toHaveLength(2);
    expect(squashedCommits('main', repo)).toHaveLength(2);

    // work not committed yet counts the same: a new file, not even added, is the branch's one commit
    mkdirSync(join(repo, 'content/extensions/cara'), { recursive: true });
    writeFileSync(join(repo, 'content/extensions/cara/herb.json'), '{}\n');
    const pending = squashedCommits('main', repo);
    expect(pending).toHaveLength(3);
    expect([...creatorsOf(pending[2]!)].sort()).toEqual(['cara', 'core']);
  });
});
