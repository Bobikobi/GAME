/** Lines that wait for the world and lines on the quest and the place (GRUNT S-1, S-2) validate; the limits hold. */
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, validateFile } from '../src/index';

const npc = (extra: Record<string, unknown>) => ({
  format: FORMAT_VERSION,
  type: 'npc',
  id: 'tester/n',
  title: 'A test',
  creator: 'tester',
  npc: { name: 'Tam', sprite: 'core/base-kit:chars/trader', place: { slot: 'core/town-corner' }, dialogue: { stranger: ['Hello.'] }, ...extra },
});

describe('remarks and topics with a when', () => {
  it('accept a remark on every field, and a topic that waits', () => {
    const when = {
      done: ['core/a'],
      active: ['core/b'],
      not_done: ['core/c'],
      restored: ['core/old-bridge'],
      built: ['core/campfire'],
      has: ['core/stone'],
      visited: ['core/town-corner'],
      time: 'night',
    };
    const remarks = [{ when, say: ['One box.', 'Two boxes.'], priority: 9 }];
    const topics = [{ ask: 'About it', lines: ['Yes.'], when: { done: ['core/a'] } }];
    expect(validateFile(npc({ remarks, topics }))).toEqual([]);
  });

  it('refuse an empty when, an unknown field, three boxes and a priority of ten', () => {
    expect(validateFile(npc({ remarks: [{ when: {}, say: ['x'] }] }))).not.toEqual([]);
    expect(validateFile(npc({ remarks: [{ when: { level: 3 }, say: ['x'] }] }))).not.toEqual([]);
    expect(validateFile(npc({ remarks: [{ when: { time: 'dusk' }, say: ['x'] }] }))).not.toEqual([]);
    expect(validateFile(npc({ remarks: [{ when: { done: ['core/a'] }, say: ['1', '2', '3'] }] }))).not.toEqual([]);
    expect(validateFile(npc({ remarks: [{ when: { done: ['core/a'] }, say: ['x'], priority: 10 }] }))).not.toEqual([]);
  });

  it('take eight topics and refuse nine', () => {
    const topics = (n: number) => Array.from({ length: n }, (_, i) => ({ ask: `T${i}`, lines: ['Yes.'] }));
    expect(validateFile(npc({ topics: topics(8) }))).toEqual([]);
    expect(validateFile(npc({ topics: topics(9) }))).not.toEqual([]);
  });
});

describe('lines on the quest and the place', () => {
  const quest = (talk: unknown) => ({
    format: FORMAT_VERSION,
    type: 'quest',
    id: 'tester/q',
    title: 'A test',
    creator: 'tester',
    quest: { summary: 'For the test.', steps: [{ kind: 'visit', slot: 'core/town-corner' }], talk, reward: { rep: 1 } },
  });

  it('accept offer, waiting and done, and refuse a four-box thanks or a field of another name', () => {
    expect(validateFile(quest({ offer: ['a', 'b', 'c'], waiting: ['a', 'b'], done: ['a'] }))).toEqual([]);
    expect(validateFile(quest({ done: ['a', 'b', 'c', 'd'] }))).not.toEqual([]);
    expect(validateFile(quest({ waiting: ['a', 'b', 'c'] }))).not.toEqual([]);
    expect(validateFile(quest({ thanks: ['a'] }))).not.toEqual([]);
  });

  it('accept a restore with the narrator\'s line', () => {
    const restore = (done: unknown) => ({
      format: FORMAT_VERSION,
      type: 'restore',
      id: 'tester/r',
      title: 'A test',
      creator: 'tester',
      restore: {
        place: { slot: 'core/old-bridge' },
        before: 'core/base-kit:tiles/bridge_broken',
        after: 'core/base-kit:tiles/bridge',
        inputs: [{ item: 'core/stone', qty: 1 }],
        active_ms: 1000,
        passable: true,
        done,
      },
    });
    expect(validateFile(restore(['The bridge holds.']))).toEqual([]);
    expect(validateFile(restore(['1', '2', '3']))).not.toEqual([]);
  });
});

describe('lines at an expedition\'s climax', () => {
  const expedition = (climax: unknown) => ({
    format: FORMAT_VERSION,
    type: 'expedition',
    id: 'tester/x',
    title: 'A test',
    creator: 'tester',
    expedition: {
      place: 'core/ruins-gate',
      window: { bells: [20, 23, 2, 4] },
      exit: 'core/night-threshold',
      chain: ['tester/a', 'tester/b', 'tester/c'],
      climax,
      reward: { opens: ['core/arch-way'] },
      on_miss: 'wait',
    },
  });

  it('accept a climax with no lines or with one to three, and refuse none, four or a field of another name', () => {
    expect(validateFile(expedition({ slot: 'core/ruins-hall' }))).toEqual([]);
    expect(validateFile(expedition({ slot: 'core/ruins-hall', lines: ['One box.'] }))).toEqual([]);
    expect(validateFile(expedition({ slot: 'core/ruins-hall', lines: ['1', '2', '3'] }))).toEqual([]);
    expect(validateFile(expedition({ slot: 'core/ruins-hall', lines: [] }))).not.toEqual([]);
    expect(validateFile(expedition({ slot: 'core/ruins-hall', lines: ['1', '2', '3', '4'] }))).not.toEqual([]);
    expect(validateFile(expedition({ slot: 'core/ruins-hall', say: ['x'] }))).not.toEqual([]);
  });
});
