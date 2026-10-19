/**
 * `pnpm rules` (docs/design/RULES_REVIEW.md, section 6): one current-rules page
 * from DECISIONS.md and the rule pages. A fixture proves the fold of a line a
 * later entry superseded; the real repository proves every rule id is read.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/load';
import { buildModel, loadModel, parseDecisions, parseRulePage, renderCurrent, resolveRef } from '../src/rules';

const FIXTURE = join(REPO_ROOT, 'tools', 'test', 'fixtures', 'rules');

describe('the fixture', () => {
  const model = loadModel(FIXTURE);
  const rule = (id: string) => model.rules.find((r) => r.id === id)!;

  it('reads every entry with its date, status, title and meta lines', () => {
    expect(model.entries.map((e) => e.date)).toEqual(['2026-10-09', '2026-10-19', '2026-10-10', '2026-10-11']);
    expect(model.entries[0]!.status).toBe('✅');
    expect(model.entries[3]!.status).toBe('⏸');
    expect(model.entries[0]!.supersededInPart).toHaveLength(1);
    expect(model.entries[0]!.retry).toMatch(/^never/);
    expect(model.entries[2]!.supersedes).toHaveLength(1);
    expect(model.entries[0]!.body).not.toMatch(/Superseded in part/);
  });

  it('resolves "the entry on ..." to the entry it names, and reports what it cannot', () => {
    const fire = resolveRef('a fire anywhere', model.entries)!;
    expect(fire.date).toBe('2026-10-19');
    expect(model.entries[0]!.supersededInPart[0]!.by).toEqual([fire.title]);
    expect(resolveRef('the world that was never written', model.entries)).toBeUndefined();
    expect(model.unresolved).toEqual([]);
  });

  it('reads the rule pages by id and never takes G30 for G300', () => {
    expect(model.rules.map((r) => r.id)).toEqual(['G30', 'G47', 'G48', 'G300', 'S1']);
    expect(rule('G30').text).toBe('Level-0 ground is safe at every hour. A wrapped line joins it.');
    expect(rule('G30').line).toBe(3);
    expect(rule('G300').mentions).toEqual([]);
  });

  it('lists the latest word first and folds the superseded entry', () => {
    const g30 = rule('G30').mentions;
    expect(g30.map((m) => m.entry.date)).toEqual(['2026-10-19', '2026-10-09']);
    expect(g30[0]!.folded).toBe(false);
    expect(g30[1]!.folded).toBe(true);
    expect(rule('G47').mentions.map((m) => m.entry.date)).toEqual(['2026-10-19']);
    expect(rule('S1').mentions.map((m) => m.entry.date)).toEqual(['2026-10-11']);
  });

  it('renders a page whose folded lines sit under the rule, and renders the same page twice', () => {
    const page = renderCurrent(model);
    expect(page).toContain('### G30 The town and a burning camp are safe');
    expect(page).toMatch(/Latest word:\n- 2026-10-19 ✅ A fire anywhere/);
    expect(page).toMatch(/Folded: 1 superseded[^\n]*\n\n- 2026-10-09 ✅ A camp outside the town is a tent[^\n]*\n {2}- superseded \(19\.10\): no tent[^\n]*-> A fire anywhere/);
    expect(renderCurrent(loadModel(FIXTURE))).toBe(page);
  });

  it('parses a bare page and a bare decisions text without the file system', () => {
    const rules = parseRulePage('X', '**R1. Event time, pure step.** No clock.\n| CR-7 | a problem | file | when |\n');
    expect(rules.map((r) => [r.id, r.title])).toEqual([
      ['R1', 'Event time, pure step'],
      ['CR-7', 'a problem'],
    ]);
    const entries = parseDecisions('## 2026-10-01 ✅ One\nR1 and CR-7 hold.\n');
    const m = buildModel(rules, entries);
    expect(m.rules.map((r) => r.mentions.length)).toEqual([1, 1]);
  });
});

describe('the repository', () => {
  const model = loadModel();
  const ids = new Set(model.rules.map((r) => r.id));

  it('reads every rule id of the pages the review covers', () => {
    for (let n = 1; n <= 69; n++) expect(ids.has(`G${n}`), `G${n}`).toBe(true);
    for (let n = 1; n <= 12; n++) expect(ids.has(`R${n}`), `R${n}`).toBe(true);
    for (let n = 1; n <= 6; n++) expect(ids.has(`S${n}`), `S${n}`).toBe(true);
    expect(ids.has('CR-12')).toBe(true);
    expect(model.rules.filter((r) => r.page === 'GRUNT').length).toBeGreaterThan(50);
    expect(model.entries.length).toBeGreaterThan(200);
  });

  it('folds the tent of 9.10 under the fire of 19.10 on G30', () => {
    const g30 = model.rules.find((r) => r.id === 'G30' && r.page === 'GAME_RULES')!;
    const tent = g30.mentions.find((m) => m.entry.title.startsWith('A camp outside the town is a tent'))!;
    expect(tent.folded).toBe(true);
    const fire = g30.mentions.find((m) => m.entry.title.startsWith('A fire anywhere outside the town'))!;
    expect(fire.folded).toBe(false);
    expect(g30.mentions.indexOf(fire)).toBeLessThan(g30.mentions.indexOf(tent));
  });

  it('resolves most "the entry on ..." references by title', () => {
    const lines = model.entries.flatMap((e) => e.supersededInPart);
    const resolved = lines.flatMap((s) => s.by).length;
    expect(resolved).toBeGreaterThanOrEqual(lines.length);
    expect(model.unresolved.length).toBeLessThan(lines.length / 2);
  });
});
