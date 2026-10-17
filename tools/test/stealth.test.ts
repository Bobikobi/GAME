/** G47 content checks for a predator's watched road and the stealth target placed inside it. */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkHazards } from '../src/hazards';

type Prop = Bundle['map']['props'][number];
type Quest = Bundle['quests'][string];
type QuestStep = Quest['steps'][number];

const CLOSED = [
  [8, 22],
  [9, 22],
  [9, 23],
  [8, 23],
] as [number, number][];

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

function predator(round: [number, number][] = CLOSED): Prop {
  return {
    id: 'test/wolf',
    sprite: 'core/base-kit:props/standing_stone',
    x: 8,
    y: 22,
    w: 1,
    h: 1,
    solid: false,
    hazard: { kind: 'predator', window: ['night'], round, pace_ms: 600, eyes: 5 },
  };
}

function cover(x = 10, y = 22): Prop {
  return { sprite: 'core/base-kit:props/standing_stone', x, y, w: 1, h: 1, solid: false, cover: true };
}

function withProps(props: Prop[]): Bundle {
  const b = structuredClone(base);
  // the bank's covers go and these tests build a round of their own; the night ruins keep theirs (x 30 and up)
  b.map.props = [...b.map.props.filter((p) => p.cover !== true || p.x >= 30), ...props];
  return b;
}

function stealth(step: QuestStep): Quest {
  return {
    ...structuredClone(base.quests['core/the-tangle']!),
    id: 'test/stealth',
    type: 'stealth',
    steps: [step],
  };
}

const messages = (b: Bundle): string => checkHazards(b, {}).map((i) => i.message).join('\n');

describe('a watched road', () => {
  it('refuses an open loop', () => {
    const b = withProps([predator([[8, 22], [9, 22], [9, 23], [8, 24]]), cover()]);
    expect(messages(b)).toContain('not a closed loop');
  });

  it('refuses a loop over safe ground', () => {
    const b = withProps([predator(), cover()]);
    const source = b.map.slots.find((s) => s.id === 'core/west-glade')!;
    b.map.slots.push({ ...source, id: 'test/safe', x: 9, y: 23, w: 1, h: 1, safe: true });
    expect(messages(b)).toContain('round tile (9, 23) is on safe ground');
  });

  it('refuses a round with no cover in its watch', () => {
    expect(messages(withProps([predator()]))).toContain("round's watch contains no cover tile");
  });

  it('refuses pace_ms or eyes on a hazard with no round', () => {
    const still = predator();
    still.hazard = { kind: 'predator', window: ['night'], eyes: 5 };
    expect(messages(withProps([still]))).toContain('belong to a predator with a round');
  });

  it('refuses solid cover', () => {
    const solid = cover();
    solid.solid = true;
    expect(messages(withProps([predator(), solid]))).toContain('cover must be non-solid');
  });

  it('refuses a stealth quest whose target is outside every round watch', () => {
    const b = withProps([predator(), cover()]);
    b.quests['test/stealth'] = stealth({ kind: 'visit', slot: 'core/tangle-heart' });
    expect(messages(b)).toContain('outside every predator round\'s watch');
  });

  it('refuses a stealth quest with nothing to watch', () => {
    const b = withProps([predator(), cover()]);
    b.quests['test/stealth'] = stealth({ kind: 'bring', item: 'core/reed', qty: 1 });
    expect(messages(b)).toContain('needs a find or visit step');
  });

  it('accepts a closed walkable round with cover and a stealth target in its watch', () => {
    const b = withProps([predator(), cover()]);
    b.resources['test/moon-reeds'] = {
      ...structuredClone(base.resources['core/reed-bank']!),
      id: 'test/moon-reeds',
      output: 'test/moonreed',
      place: { slot: 'core/west-glade' },
    };
    b.quests['test/stealth'] = stealth({ kind: 'find', item: 'test/moonreed', clue: 'Where the wolf watches.' });
    expect(checkHazards(b, {}).filter((i) => i.message.includes('G47'))).toEqual([]);
  });
});
