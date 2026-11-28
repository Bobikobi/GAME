/**
 * The check over a quest shut by its content (`shut_until`): the schema takes the field, `pnpm check` names each shut
 * quest and each quest after one with a warning, and the hand (`pnpm quests`) leaves them out. The world is the pixel
 * valley; the quest the tangle.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';
import { hands } from '../src/quests/hand';
import { checkShut } from '../src/shut';
import { loadPixelBundle, pinPixelValley } from './helpers/world';

const TANGLE = 'core/the-tangle';
const UNTIL = 'a painted tangle (public #944)';

describe('a shut quest in the content check', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-shut-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  pinPixelValley(root);
  const file = join(root, 'core', 'quests', 'the-tangle.json');
  const quest = JSON.parse(readFileSync(file, 'utf8')) as { quest: Record<string, unknown> };
  quest.quest.shut_until = UNTIL;
  writeFileSync(file, `${JSON.stringify(quest, null, 2)}\n`);
  const result = runCheck(root);

  it('takes the field and names the quest in one warning', () => {
    const mine = result.issues.filter((i) => i.file.endsWith('quests/the-tangle.json'));
    expect(mine.filter((i) => i.level === 'error')).toEqual([]);
    expect(mine.filter((i) => i.where === 'quest.shut_until').map((i) => [i.level, i.message])).toEqual([
      ['warning', `${TANGLE} is shut until ${UNTIL}: nobody offers it, and a save that took it keeps it`],
    ]);
    expect(result.assembled.bundle?.quests[TANGLE]?.shut_until).toBe(UNTIL);
  });
});

describe('what comes after a shut quest', () => {
  // the baseline is a valley with no quest shut: the tangle ships shut on the painted valley (public #944)
  const base = loadPixelBundle();
  for (const q of Object.values(base.quests)) delete q.shut_until;

  it('says nothing when no quest is shut', () => {
    expect(checkShut(base, {})).toEqual([]);
  });

  it('names every quest after it through the requires links, by the shut one', () => {
    const b = structuredClone(base);
    b.quests[TANGLE] = { ...b.quests[TANGLE]!, shut_until: UNTIL };
    b.quests['test/after'] = { ...structuredClone(b.quests[TANGLE]!), id: 'test/after', requires: [TANGLE] };
    delete b.quests['test/after'].shut_until;
    b.quests['test/later'] = { ...structuredClone(b.quests['test/after']), id: 'test/later', requires: ['test/after'] };
    expect(checkShut(b, {}).map((i) => [i.where, i.message])).toEqual([
      ['quest.shut_until', `${TANGLE} is shut until ${UNTIL}: nobody offers it, and a save that took it keeps it`],
      ['quest.requires', `test/after comes after the shut quest ${TANGLE}: no new character reaches it until that opens`],
      ['quest.requires', `test/later comes after the shut quest ${TANGLE}: no new character reaches it until that opens`],
    ]);
  });

  it('is out of every wake pocket\'s hand, and so is a quest after it', () => {
    const b = structuredClone(base);
    expect(hands(b).some((h) => h.quests.includes(TANGLE))).toBe(true);
    b.quests[TANGLE] = { ...b.quests[TANGLE]!, shut_until: UNTIL };
    b.quests['test/after'] = { ...structuredClone(base.quests[TANGLE]!), id: 'test/after', requires: [TANGLE] };
    for (const h of hands(b)) {
      expect(h.quests, h.pocket).not.toContain(TANGLE);
      expect(h.quests, h.pocket).not.toContain('test/after');
    }
  });
});
