// The boards page (docs/team/GRUNT.md, item 11). Run after the site build, which writes web/dist. Without a built
// hub-data document the builders come from content/board.json (web/src/data/boards.ts), so the numbers checked
// here are read from it, not from the fixture.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const html = readFileSync(join(ROOT, 'web/dist/hub/boards/index.html'), 'utf8');
const board = JSON.parse(readFileSync(join(ROOT, 'content/board.json'), 'utf8')) as {
  board: Record<string, { points: number; records: number; commits: number }>;
};
const weights = JSON.parse(readFileSync(join(ROOT, '.github/points.json'), 'utf8')) as Record<string, unknown>;
const table = html.match(/<table class="board-table".*?<\/table>/s)?.[0] ?? '';
const cell = (n: number): string => `>${n}</td>`;

describe('the boards page', () => {
  it('heads the builders table with Points, Records and Commits, and never hours', () => {
    const heads = [...table.matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => m[1]!.replace(/<[^>]+>/g, '').trim());
    expect(heads).toEqual(expect.arrayContaining(['Points', 'Records', 'Commits']));
    expect(html.toLowerCase()).not.toContain('hours');
  });

  it('shows every builder with their points, records and commits, most points first', () => {
    const rows = Object.entries(board.board).sort((a, b) => b[1].points - a[1].points || a[0].localeCompare(b[0]));
    expect(rows.length).toBeGreaterThan(0);
    let at = 0;
    for (const [handle, counts] of rows) {
      const found = table.indexOf(`>${handle}</a>`, at);
      expect(found, handle).toBeGreaterThan(at - 1);
      const row = table.slice(found, table.indexOf('</tr>', found));
      for (const n of [counts.points, counts.records, counts.commits]) expect(row, handle).toContain(cell(n));
      at = found;
    }
  });

  it('draws a signature the way the game does: a style class and a glyph', () => {
    // the page's scoped style adds data-astro-cid attributes, hence [^>]*
    expect(table).toMatch(/<span class="signature sig-(carved|painted|ink|gold|moss)"[^>]*><i class="glyph g-[a-z]+"/);
  });

  it('prints the formula with the weights of .github/points.json, and the players line', () => {
    expect(html).toContain(
      `points = ${weights['per_record']} x records + ${weights['per_commit']} x commits; reviewer points = ${weights['per_approval']} x approvals`,
    );
    expect(html).toContain('href="https://github.com/Bobikobi/GAME/blob/develop/.github/points.json"');
    expect(html).toContain('opens with accounts');
  });

  it('does not mention the weekly pool while it is off', () => {
    if (weights['weekly_pool_active'] === true) return;
    expect(html.toLowerCase()).not.toContain('pool');
  });
});
