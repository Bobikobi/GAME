/**
 * The world lock (G59, EXPERIENCE_AUDIT.md gap M6): the committed lock says what the content walks and pays, and a
 * change to a leg or a pay is refused until it is re-anchored.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR, WORLD_LOCK_FILE } from '../src/load';
import { LADDER_QUESTS, checkLock, lockText, measureLock, type WorldLock } from '../src/lock';

const lockLines = (issues: { message: string; where: string }[]) => issues.filter((i) => i.message.includes('world lock') || i.message.includes('the lock says') || i.where === 'world lock');

describe('the core content', () => {
  const b = runCheck().assembled.bundle!;

  it('walks every leg of the opening: one per wake pocket and one per shared rung', () => {
    const { legs, pays } = measureLock(b);
    expect(Object.keys(legs).sort()).toEqual([...Object.keys(b.pockets), ...LADDER_QUESTS].sort());
    for (const leg of Object.values(legs)) expect(leg.steps).toBeGreaterThan(0);
    for (const p of Object.keys(b.pockets)) expect(legs[p]!.to).toBe('core/old-bridge');
    expect(pays['core/fix-the-bridge']).toEqual({ gold_mg: 30000, rep: 0 });
  });

  it('matches the committed lock, which is what "pnpm world:lock" writes', () => {
    expect(readFileSync(WORLD_LOCK_FILE, 'utf8')).toBe(lockText(b));
    expect(checkLock(b, {})).toEqual([]);
  });
});

describe('a content folder with a lock of its own', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-lock-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  const b = runCheck(root).assembled.bundle!;
  const lock = JSON.parse(lockText(b)) as WorldLock;
  const write = (change: (l: WorldLock) => void) => {
    const l = structuredClone(lock);
    change(l);
    writeFileSync(join(root, 'world.lock.json'), JSON.stringify(l));
  };

  it('is not checked when the folder holds no lock', () => {
    expect(lockLines(runCheck(root).issues)).toEqual([]);
  });

  it('refuses a leg longer than the lock, and warns on a shorter one', () => {
    write((l) => {
      l.legs['core/north-meadow']!.steps -= 1;
      l.legs['core/into-town']!.steps += 1;
    });
    const issues = checkLock(b, {}, root);
    expect(issues.filter((i) => i.level === 'error').map((i) => i.message)).toEqual([expect.stringContaining('core/north-meadow')]);
    expect(issues.filter((i) => i.level === 'warning').map((i) => i.message)).toEqual([expect.stringContaining('core/into-town')]);
    expect(issues[0]!.message).toContain('pnpm world:lock');
  });

  it('refuses a leg that runs from another place', () => {
    write((l) => {
      l.legs['core/first-fire']!.from = 'core/somewhere-else';
    });
    expect(checkLock(b, {}, root).map((i) => i.message)).toEqual([expect.stringContaining('runs from core/old-bridge')]);
  });

  it('refuses a changed pay, read from the quest file, and is read by pnpm check', () => {
    write(() => {});
    const quest = join(root, 'core', 'quests', 'fix-the-bridge.json');
    const json = JSON.parse(readFileSync(quest, 'utf8'));
    json.quest.reward.gold_mg = 45000;
    writeFileSync(quest, JSON.stringify(json, null, 2));
    const lines = lockLines(runCheck(root).issues).filter((i) => i.message.includes('core/fix-the-bridge'));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.message).toContain('the lock says {"gold_mg":30000,"rep":0}');
  });
});
