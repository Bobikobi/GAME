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
    const flat = (o: Record<string, unknown>, key: string): unknown => key.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], o);
    const shown = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v));
    const points = json('.github/points.json');
    for (const [file, key] of [...keys.map((k) => [loop, k] as const), ...Object.keys(points).map((k) => [points, k] as const)]) {
      expect(html, key).toMatch(new RegExp(`<code>${key.replace(/\./g, '\\.')}</code></td><td[^>]*>${shown(flat(file, key))}</td>`));
    }
  });

  it('gives every loop key a sentence from the loop README', () => {
    const rows = [...html.matchAll(/<tr><td><code>([a-z_.]+)<\/code><\/td><td[^>]*>[^<]*<\/td><td>([^<]*)<\/td><\/tr>/g)];
    expect(rows.length).toBeGreaterThan(0);
    for (const [, key, says] of rows) expect(says!.trim(), key).not.toBe('');
  });

  it('lists the value of every anchored item', () => {
    const values = (json('content/values.lock.json')['values'] ?? {}) as Record<string, number>;
    for (const [id, value] of Object.entries(values)) expect(text, id).toContain(`${id} ${value}`);
  });

  it('says "credits" only in the sentence about the fund', () => {
    const uses = (text.match(/[^.]*\bcredits\b[^.]*\./gi) ?? []).map((u) => u.trim());
    expect(uses).toEqual(['Nothing is called credits until the fund has a formula; the fund is 40% of net income; there is no income yet.']);
  });

  it('carries the conduct section of CONTRIBUTING.md', () => {
    const conduct = html.match(/<section[^>]*aria-labelledby="conduct-h".*?<\/section>/s)?.[0] ?? '';
    const source = readFileSync(join(ROOT, 'CONTRIBUTING.md'), 'utf8').split('\n## Conduct\n')[1]!.split('\n## ')[0]!;
    const first = source.trim().split(/\n\s*\n/)[0]!.replace(/\s+/g, ' ').slice(0, 60);
    expect(conduct.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toContain(first);
  });
});
