/**
 * The play rules (docs/design/GAME_RULES.md section 8): the core content
 * passes them with no line since P-3, and a fixture that breaks each one
 * gets an error that cites the rule. The opening chain may repeat a verb.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';
import { OPENING_QUESTS, PLAY_LEVEL, RULES_PAGE, checkPlay, findableItems } from '../src/play';

describe('the core content', () => {
  let result: ReturnType<typeof runCheck>;

  beforeAll(() => {
    result = runCheck();
    if (!result.assembled.bundle) throw new Error('Content did not assemble into a bundle.');
  });

  it('passes the play rules with no line, and pnpm check with 0 errors and 0 warnings', () => {
    expect(checkPlay(result.assembled.bundle!, result.assembled.origin)).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('names a type on every quest, at least four of the palette, and never the same twice in a row', () => {
    const quests = Object.values(result.assembled.bundle!.quests);
    expect(quests.length).toBeGreaterThanOrEqual(6);
    const types = new Set(quests.map((q) => q.type));
    expect(types.has(undefined)).toBe(false);
    expect(types.size).toBeGreaterThanOrEqual(4);
  });

  it('counts what only digging or one timed plant gives as findable, never what is sold or grows anywhere', () => {
    const findable = findableItems(result.assembled.bundle!);
    for (const id of ['core/maru-coin', 'core/old-coin', 'core/bellberry', 'core/sunleaf']) expect(findable.has(id), id).toBe(true);
    for (const id of ['core/berry', 'core/herb', 'core/stone', 'core/herb-tea']) expect(findable.has(id), id).toBe(false);
  });
});

describe('the play rules on a fixture that breaks each one', () => {
  const root = mkdtempSync(join(tmpdir(), 'openfold-play-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  // two inscriptions no riddle cites: one on a prop without an id, one on a prop with an id
  const mapPath = join(root, 'core', 'map.json');
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { map: { props: Record<string, unknown>[] } };
  const plain = map.map.props.filter((p) => p.note === undefined && p.id === undefined && p.sign === undefined);
  plain[0]!.note = 'Someone tied fresh grass to it. Recently.';
  plain[1]!.id = 'core/old-post';
  plain[1]!.note = 'Names are scratched into it, one under another.';
  writeFileSync(mapPath, JSON.stringify(map, null, 2));

  const ext = join(root, 'extensions', 'tester');
  const write = (dir: string, name: string, body: unknown) => {
    mkdirSync(join(ext, dir), { recursive: true });
    writeFileSync(join(ext, dir, `${name}.json`), JSON.stringify(body));
  };
  const quest = (id: string, body: Record<string, unknown>) => ({ format: 1, type: 'quest', id, title: id, creator: 'tester', quest: body });

  // G10: a build that opens nothing
  write('camp', 'shelf', {
    format: 1,
    type: 'camp',
    id: 'tester/shelf',
    title: 'A shelf',
    creator: 'tester',
    camp: { slot: 'shelf', inputs: [{ item: 'core/branch', qty: 4 }], active_ms: 5000, sprite: 'core/base-kit:props/shelf' },
  });
  // G2 and G4: a counter that pays gold only
  write('quests', 'counter', quest('tester/counter', { giver: 'core/trader', type: 'errand', summary: 'Bring herbs.', steps: [{ kind: 'bring', item: 'core/herb', qty: 4 }], reward: { rep: 5, gold_mg: 1000 } }));
  // G4: a place opened is something the player can newly do
  write('quests', 'opener', quest('tester/opener', { giver: 'core/trader', type: 'discovery', summary: 'A way.', steps: [{ kind: 'find', item: 'core/old-coin', clue: 'Under the gate stones.' }], reward: { rep: 0, opens: ['core/arch-way'] } }));
  // G17: the same type right after, and no type at all
  write('quests', 'again', quest('tester/again', { giver: 'core/trader', type: 'errand', summary: 'More herbs.', requires: ['tester/counter'], steps: [{ kind: 'find', item: 'core/old-coin', clue: 'Under the gate stones.' }], reward: { rep: 5, recipes: ['core/herb-tea'] } }));
  write('quests', 'untyped', quest('tester/untyped', { giver: 'core/trader', summary: 'A coin.', steps: [{ kind: 'find', item: 'core/old-coin', clue: 'Under the gate stones.' }], reward: { rep: 5, recipes: ['core/herb-tea'] } }));
  // G14 and G21: a long first meeting, three standing boxes, one box over two phone lines
  write('npcs', 'talker', {
    format: 1,
    type: 'npc',
    id: 'tester/talker',
    title: 'A talker',
    creator: 'tester',
    npc: {
      name: 'Tam',
      sprite: 'core/base-kit:chars/trader',
      place: { slot: 'core/town-corner' },
      dialogue: {
        first: ['One.', 'Two.', 'Three.', 'Four.'],
        stranger: ['One.', 'Two.', 'Three.'],
        friend: ['A box that runs on and on past the two lines a phone shows at the dialogue size, with nothing to stop it.'],
      },
    },
  });

  const result = runCheck(root);
  const play = result.issues.filter((i) => i.message.includes(RULES_PAGE));
  const about = (name: string) => play.filter((i) => i.file.endsWith(`${name}.json`));
  const cites = (name: string, rule: string) => about(name).some((i) => i.message.includes(`${RULES_PAGE} ${rule},`));

  it('reports every breach as an error that cites the rules page', () => {
    expect(PLAY_LEVEL).toBe('error');
    expect(play.length).toBeGreaterThan(0);
    for (const i of play) expect(i.level).toBe('error');
  });

  it('G10: a build with no station and no bag bonus', () => {
    expect(cites('shelf', 'G10')).toBe(true);
  });

  it('G2 and G4: a counter that pays gold only', () => {
    expect(cites('counter', 'G2')).toBe(true);
    expect(cites('counter', 'G4')).toBe(true);
    expect(cites('again', 'G2')).toBe(false);
    expect(cites('again', 'G4')).toBe(false);
    expect(cites('opener', 'G4')).toBe(false);
  });

  it('G17: the same type twice in a row, and a quest with no type', () => {
    const again = about('again').filter((i) => i.where === 'quest.type');
    expect(again).toHaveLength(1);
    expect(again[0]!.message).toContain('"tester/counter"');
    const untyped = about('untyped').filter((i) => i.where === 'quest.type');
    expect(untyped).toHaveLength(1);
    expect(untyped[0]!.message).toContain('no type');
    expect(untyped[0]!.message).toContain('errand');
  });

  it('G14 and G21: the long first meeting and the long box, counted per character', () => {
    expect(cites('talker', 'G21')).toBe(true);
    expect(cites('talker', 'G14')).toBe(true);
    const lines = about('talker').filter((i) => i.where === 'npc.dialogue');
    expect(lines).toHaveLength(2);
    expect(lines.map((i) => i.message).join(' ')).toContain('first meeting 4 boxes');
    expect(lines.map((i) => i.message).join(' ')).toContain('stranger 3 boxes');
  });

  it('G8: the uncited note by its id, the unnamed one in a count line', () => {
    const g8 = play.filter((i) => i.message.includes(`${RULES_PAGE} G8,`));
    expect(g8.map((i) => i.where)).toEqual(['map.props.core/old-post', 'map.props']);
    expect(g8[1]!.message).toContain('1 inscription on props without an id');
  });

  it('lets the opening chain teach a verb by repetition', () => {
    const origin = result.assembled.origin;
    for (const id of OPENING_QUESTS) expect(play.filter((i) => i.file === origin[id])).toEqual([]);
  });
});
