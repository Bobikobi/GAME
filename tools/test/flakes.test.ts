/** The flake ledger: the writer in game/e2e/run.ts and the reader tools/src/flakes.ts. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FLAKES_FILE, playEntry, type FlakeRecord, type PlayResult } from '../../game/e2e/run';
import { count, parseRecords, readFolder, report, summaryTable } from '../src/flakes';

let out: string;
beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'flakes-'));
});
afterEach(() => rmSync(out, { recursive: true, force: true }));

const entry = { name: 'hud', script: 'hud' };
const ledger = (): FlakeRecord[] => (existsSync(join(out, FLAKES_FILE)) ? readFileSync(join(out, FLAKES_FILE), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as FlakeRecord) : []);
/** A fake script: plays the given results one after another. */
const fake = (...results: PlayResult[]) => {
  let i = 0;
  return () => results[i++] ?? { ok: false, error: 'played too often' };
};

describe('the record writer', () => {
  it('writes one retry_pass record for a script that fails once, then passes', () => {
    const { result } = playEntry('g', entry, out, true, fake({ ok: false, error: 'x'.repeat(500) }, { ok: true }));
    expect(result).toContain('passed on attempt 2');
    const rows = ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ group: 'g', script: 'hud', result: 'retry_pass' });
    expect(rows[0]?.error).toHaveLength(300);
  });

  it('writes one red record for a script that fails twice', () => {
    const { result } = playEntry('g', entry, out, true, fake({ ok: false, error: 'a' }, { ok: false, error: 'b' }));
    expect(result).toBe('');
    const rows = ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ result: 'red', error: 'a' });
  });

  it('writes nothing for a script that passes first time, or fails without a retry', () => {
    playEntry('g', entry, out, true, fake({ ok: true }));
    playEntry('g', entry, out, false, fake({ ok: false, error: 'a' }));
    expect(ledger()).toEqual([]);
  });
});

describe('the summary script', () => {
  const rows = readFolder(join(__dirname, 'fixtures', 'flakes'));

  it('reads every ledger in a folder, a downloaded artifact in its own subfolder too, and skips a torn line', () => {
    expect(rows).toHaveLength(5);
  });

  it('counts per script the retry passes, the red runs and the most common first error', () => {
    const by = Object.fromEntries(count(rows).map((c) => [c.script, c]));
    expect(by.opening).toMatchObject({ retryPass: 2, red: 1, topError: 'day-end timeout waiting for summary' });
    expect(by.hud).toMatchObject({ retryPass: 1, red: 0 });
    expect(by.sea).toMatchObject({ retryPass: 1, red: 0 });
    expect(count(rows)[0]?.script).toBe('opening');
    expect(report(rows)).toContain('opening-phone/opening: 2 passed only on retry, 1 red');
  });

  it('prints a table titled "Passed only on retry", and nothing for an empty ledger', () => {
    const table = summaryTable(rows);
    expect(table.startsWith('### Passed only on retry')).toBe(true);
    expect(table).toContain('expected wave \\| pipe');
    expect(summaryTable([])).toBe('');
    expect(parseRecords('not json\n')).toEqual([]);
  });
});
