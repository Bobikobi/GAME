// The hub-data document the site publishes (docs/team/GRUNT.md, item 3): the site build writes it with
// `pnpm hub:data` before the pages, so every page reads it and /api/hub-data.json serves it. Run after the site build.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateHubData, type HubData } from '@game/schema/hub';

const ROOT = join(import.meta.dirname, '../..');
const file = join(ROOT, 'web/dist/api/hub-data.json');

describe('the published hub-data document', () => {
  it('is served at /api/hub-data.json and validates', () => {
    expect(existsSync(file), 'no web/dist/api/hub-data.json: the site build runs pnpm hub:data first').toBe(true);
    expect(validateHubData(JSON.parse(readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('carries the board of content/board.json, so a page and the document agree', () => {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as HubData;
    const board = JSON.parse(readFileSync(join(ROOT, 'content/board.json'), 'utf8')) as {
      board: Record<string, { points: number; records: number; commits: number }>;
    };
    for (const [handle, counts] of Object.entries(board.board)) {
      expect(doc.creators.find((c) => c.handle === handle), handle).toEqual(expect.objectContaining(counts));
    }
  });

  it('is what the pages were built from: no page says "(fixture)"', () => {
    for (const page of ['index.html', 'hub/index.html', 'hub/boards/index.html', 'api/index.html']) {
      expect(readFileSync(join(ROOT, 'web/dist', page), 'utf8'), page).not.toContain('(fixture)');
    }
  });
});
