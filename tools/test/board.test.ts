import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Credit } from '@game/kernel';
import { computeBoard, readPoints, type Commit, type PointsConfig } from '../src/board';
import { REPO_ROOT } from '../src/load';

describe('board and points', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'openfold-points-test-'));
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
});
