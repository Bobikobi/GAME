/**
 * The assembler refuses a passage that points at nothing (docs/design/SEA_CROSSING.md section 5, measurable 5): an
 * exit the map plan does not hold, or an item the content does not have.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

const event = {
  id: 'core/knock',
  title: 'A knock',
  type: 'discovery',
  weight: 1,
  sign: ['Something knocks against the hull.'],
  window: 2,
  act: { kind: 'find' },
  miss: 'on',
  met: ['You catch it.'],
  missed: ['It is gone.'],
  reward: { items: [{ item: 'core/log', qty: 1 }] },
};

const file = (body: Record<string, unknown>, ev: Record<string, unknown> = event) => ({
  format: 1,
  type: 'passage',
  id: 'core/test-crossing',
  title: 'A test crossing',
  creator: 'core',
  passage: { from: 'core/ferry', hours: [6, 19], segments: 8, segment_ms: 10000, board: ['Off.'], land: ['In.'], back: ['Back.'], events: [ev], ...body },
});

describe('a passage\'s references', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-passage-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  mkdirSync(join(root, 'core', 'passages'), { recursive: true });

  const errors = (passage: unknown): string[] => {
    writeFileSync(join(root, 'core', 'passages', 'test-crossing.json'), JSON.stringify(passage));
    return runCheck(root)
      .issues.filter((i) => i.level === 'error')
      .map((i) => `${i.where}: ${i.message}`);
  };

  it('takes a passage from an exit of the plan', () => {
    expect(errors(file({}))).toEqual([]);
  });

  it('refuses an exit the map plan does not hold, at either end', () => {
    expect(errors(file({ from: 'core/nowhere' }))).toContainEqual('passage.from: no exit "core/nowhere" in the map plan');
    expect(errors(file({ to: 'core/nowhere' }))).toContainEqual('passage.to: no exit "core/nowhere" in the map plan');
  });

  it('refuses a fare, a thing asked for or a reward the content does not have', () => {
    const missing = (e: string[]) => e.filter((m) => m.includes('core/no-such-item'));
    expect(missing(errors(file({ fare: { item: 'core/no-such-item', qty: 1 } })))).toHaveLength(1);
    expect(missing(errors(file({}, { ...event, act: { kind: 'bring', item: 'core/no-such-item', qty: 1 } })))).toHaveLength(1);
    expect(missing(errors(file({}, { ...event, reward: { items: [{ item: 'core/no-such-item', qty: 1 }] } })))).toHaveLength(1);
  });

  it('refuses a weight of 0 and a step kind outside the closed list', () => {
    expect(errors(file({}, { ...event, weight: 0 })).length).toBeGreaterThan(0);
    expect(errors(file({}, { ...event, act: { kind: 'swim' } })).length).toBeGreaterThan(0);
  });
});
