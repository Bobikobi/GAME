// The rules page (docs/team/GRUNT.md, item 12). Run after the site build, which writes web/dist.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const html = readFileSync(join(ROOT, 'web/dist/hub/rules/index.html'), 'utf8');
const json = (path: string): Record<string, unknown> => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Record<string, unknown>;
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the rules page', () => {
  it('shows every key of the loop and the points files, each with its value', () => {
    const loop = json('.github/loop.json');
    const keys = Object.entries(loop).flatMap(([k, v]) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.keys(v).map((n) => `${k}.${n}`) : [k]));
    for (const key of [...keys, ...Object.keys(json('.github/points.json'))]) expect(html, key).toContain(`<code>${key}</code>`);
    expect(text).toContain(`per_record ${json('.github/points.json')['per_record']}`);
  });

  it('gives every loop key a sentence from the loop README', () => {
    const rows = [...html.matchAll(/<tr><td><code>([a-z_.]+)<\/code><\/td><td[^>]*>[^<]*<\/td><td>([^<]*)<\/td><\/tr>/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, key, says] of rows) expect(says!.trim(), key).not.toBe('');
  });

  it('lists the value of every anchored item', () => {
    const values = (json('content/values.lock.json')['values'] ?? {}) as Record<string, number>;
    for (const id of Object.keys(values)) expect(html, id).toContain(`<code>${id}</code>`);
  });

  it('says "credits" only in the sentence about the fund', () => {
    const uses = (text.match(/[^.]*\bcredits\b[^.]*\./gi) ?? []).map((u) => u.trim());
    expect(uses).toEqual(['Nothing is called credits until the fund has a formula; the fund is 40% of net income; there is no income yet.']);
  });

  it('carries the conduct section of CONTRIBUTING.md', () => {
    expect(html).toContain('id="conduct-h"');
  });
});
