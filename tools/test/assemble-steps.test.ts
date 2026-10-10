/**
 * The assembler refuses what the find and riddle steps cannot point at
 * (GRUNT P-2): a prop id that is not on the map, a dig spot or slot that does
 * not exist, a find of something sold or grown in more than one place, and a
 * prop id used twice. A place reward (reward.opens) must name a restore, and a
 * restore with no inputs must be opened by some quest.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

const file = (id: string, steps: unknown[]) => ({
  format: 1,
  type: 'quest',
  id,
  title: 'A test',
  creator: 'tester',
  quest: { giver: 'core/trader', type: 'discovery', summary: 'For the test.', steps, reward: { rep: 1, recipes: ['core/herb-tea'] } },
});

describe('find and riddle references', () => {
  const root = mkdtempSync(join(tmpdir(), 'openfold-steps-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  // three props get a note: two share one id, the third has its own
  const mapPath = join(root, 'core', 'map.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { map: { props: Record<string, unknown>[] } };
  const plain = map.map.props.map((p, i) => (p.note === undefined && p.id === undefined && p.sign === undefined ? i : -1)).filter((i) => i >= 0);
  for (const [k, id] of ['core/stone-a', 'core/stone-a', 'core/stone-b'].entries()) {
    const prop = map.map.props[plain[k]!]!;
    prop.id = id;
    prop.note = 'Marks are cut into it.';
  }
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const dir = join(root, 'extensions', 'tester', 'quests');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'bad-riddle.json'),
    JSON.stringify(file('tester/bad-riddle', [{ kind: 'riddle', clue: 'Nowhere.', props: ['core/nowhere', 'core/stone-b'], answer: { kind: 'dig', treasure: 'core/nowhere' } }])),
  );
  writeFileSync(
    join(dir, 'bad-place.json'),
    JSON.stringify(file('tester/bad-place', [{ kind: 'riddle', clue: 'Nowhere.', props: ['core/stone-b'], answer: { kind: 'visit', slot: 'core/nowhere', at: 'night' } }])),
  );
  writeFileSync(join(dir, 'bad-find.json'), JSON.stringify(file('tester/bad-find', [{ kind: 'find', item: 'core/herb', clue: 'It grows in the grove.' }])));
  writeFileSync(join(dir, 'good-find.json'), JSON.stringify(file('tester/good-find', [{ kind: 'find', item: 'core/old-coin', clue: 'Under the gate stones.' }])));
  writeFileSync(join(dir, 'timed-find.json'), JSON.stringify(file('tester/timed-find', [{ kind: 'find', item: 'core/sunleaf', clue: 'Where the mist is thin at noon.' }])));

  const result = runCheck(root);
  const errors = result.issues.filter((i) => i.level === 'error');
  const messages = errors.map((i) => `${i.where}: ${i.message}`);

  it('refuses a prop id that is not on the map and a dig spot that does not exist', () => {
    expect(messages).toContainEqual('quest.steps.0.props.0: no map prop with id "core/nowhere"');
    expect(messages).toContainEqual('quest.steps.0.answer: no dig spot "core/nowhere"');
    expect(messages.filter((m) => m.includes('core/stone-b'))).toEqual([]);
  });

  it('refuses a slot that does not exist', () => {
    expect(messages).toContainEqual('quest.steps.0.answer: no slot "core/nowhere"');
  });

  it('refuses a find of something that grows anywhere, and accepts a dig-only item or a timed plant', () => {
    expect(messages).toContainEqual('quest.steps.0: "core/herb" is sold, made or grows in more than one place: a find must be found, dug up or picked in one timed place');
    expect(errors.filter((i) => i.file.includes('good-find'))).toEqual([]);
    expect(errors.filter((i) => i.file.includes('timed-find'))).toEqual([]);
  });

  it('refuses a prop id used twice', () => {
    expect(messages).toContainEqual(`map.props.${plain[1]}.id: prop id "core/stone-a" is used twice`);
  });

  it('reports the cited note by nothing and the uncited one by id (G8)', () => {
    const g8 = result.issues.filter((i) => i.message.includes('G8,'));
    expect(g8.some((i) => i.where === 'map.props.core/stone-a')).toBe(true);
    expect(g8.some((i) => i.where === 'map.props.core/stone-b')).toBe(false);
  });
});

describe('place rewards', () => {
  const root = mkdtempSync(join(tmpdir(), 'mistvale-opens-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  const read = () => runCheck(root).issues.filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`);

  it('accepts the core arch, opened by the night arch quest', () => {
    expect(read()).toEqual([]);
  });

  it('refuses an opens that names no restore, and a restore with no inputs that nothing opens', () => {
    const questPath = join(root, 'core', 'quests', 'the-night-arch.json');
    const quest = JSON.parse(readFileSync(questPath, 'utf8')) as { quest: { reward: { opens?: string[] } } };
    quest.quest.reward.opens = ['core/nowhere'];
    writeFileSync(questPath, JSON.stringify(quest, null, 2));
    const messages = read();
    expect(messages).toContainEqual('quest.reward.opens.0: no restore "core/nowhere"');
    expect(messages).toContainEqual('restore.inputs: no inputs and no quest opens it: it could never open');
  });
});
