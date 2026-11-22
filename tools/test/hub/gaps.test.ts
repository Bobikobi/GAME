/**
 * The three "still missing" rules of the developers' home (#727, stage 1; bar F2): each has a fixture where its line
 * must appear and one where it must not, and the lines on the real content name files that exist.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../../src/check';
import { REPO_ROOT } from '../../src/load';
import { figureNoQuest, findGaps, noPicture, questNoPlace, viewOf, type GapView } from '../../src/hub/gaps';

const view = (over: Partial<GapView> = {}): GapView => ({
  sprites: { 'kit:a': { density: 4 } },
  things: [{ id: 'x/fig', file: 'content/extensions/x/fig.json', sprites: ['kit:a'] }],
  figures: [{ id: 'x/fig', file: 'content/extensions/x/fig.json' }],
  quests: [{ id: 'x/q', file: 'content/extensions/x/q.json', giver: 'x/fig', steps: ['find'] }],
  ...over,
});

describe('a thing with no picture', () => {
  it('is named when its picture is in no kit, with its file', () => {
    const found = noPicture(view({ things: [{ id: 'x/bush', file: 'content/extensions/x/bush.json', sprites: ['kit:gone'] }] }));
    expect(found).toEqual([expect.objectContaining({ rule: 'no_picture', id: 'x/bush', file: 'content/extensions/x/bush.json', line: expect.stringContaining('kit:gone') })]);
  });
  it('is named when the picture is still the old 16 px one', () => {
    const found = noPicture(view({ sprites: { 'kit:a': { density: 1 } } }));
    expect(found).toHaveLength(1);
    expect(found[0]!.line).toContain('16 px');
  });
  it('is not named when every picture is in a kit at the rich density', () => {
    expect(noPicture(view())).toEqual([]);
  });
});

describe('a figure with no quest', () => {
  it('is named when no quest has it as giver', () => {
    const found = figureNoQuest(view({ quests: [] }));
    expect(found).toEqual([expect.objectContaining({ rule: 'figure_no_quest', id: 'x/fig', file: 'content/extensions/x/fig.json' })]);
  });
  it('is named when the quests belong to another figure', () => {
    expect(figureNoQuest(view({ quests: [{ id: 'x/q', file: 'f', giver: 'x/other', steps: ['find'] }] }))).toHaveLength(1);
  });
  it('is not named when a quest names it as giver', () => {
    expect(figureNoQuest(view())).toEqual([]);
  });
});

describe('a quest with no place', () => {
  const bare = { id: 'x/q', file: 'content/extensions/x/q.json', steps: ['find', 'bring', 'make'] };
  it('is named when it has no giver, no pocket and no step tied to the map', () => {
    expect(questNoPlace(view({ quests: [bare] }))).toEqual([expect.objectContaining({ rule: 'quest_no_place', id: 'x/q', file: 'content/extensions/x/q.json' })]);
  });
  it('is not named with a giver, a pocket, or a visit, restore, riddle, build or tend step', () => {
    for (const q of [{ ...bare, giver: 'x/fig' }, { ...bare, pocket: 'x/glade' }, ...['visit', 'restore', 'riddle', 'build', 'tend'].map((s) => ({ ...bare, steps: ['find', s] }))]) {
      expect(questNoPlace(view({ quests: [q] })), JSON.stringify(q)).toEqual([]);
    }
  });
});

describe('findGaps on the real content', () => {
  const real = runCheck().assembled.bundle!;
  const gaps = findGaps(viewOf(real), 'Bobikobi/GAME');
  it('names records and files that exist, each with a link to its file', () => {
    for (const g of gaps) {
      expect(existsSync(join(REPO_ROOT, g.file)), g.file).toBe(true);
      expect(g.url).toBe(`https://github.com/Bobikobi/GAME/blob/develop/${g.file}`);
      expect(g.id, g.id).toMatch(/^[a-z0-9_-]+\/[a-z0-9_-]+$/);
    }
  });
  it('is in a fixed order, so the same content gives the same list', () => {
    expect(findGaps(viewOf(real), 'Bobikobi/GAME')).toEqual(gaps);
    const keys = gaps.map((g) => `${g.rule} ${g.id}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});
