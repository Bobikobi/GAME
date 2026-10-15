/** A tended fire is a named map prop, and every tending or fire-lit reference points to one (G48). */
import { beforeAll, describe, expect, it } from 'vitest';

import type { Bundle, QuestDef } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkPlay } from '../src/play';

type Prop = Bundle['map']['props'][number];

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

function prop(id: string | undefined, fields: Partial<Prop> = {}): Prop {
  return {
    ...(id === undefined ? {} : { id }),
    sprite: 'core/base-kit:props/standing_stone',
    x: 8,
    y: 8,
    w: 1,
    h: 1,
    solid: true,
    ...fields,
  };
}

function world(props: Prop[], step?: QuestDef['steps'][number]): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props, ...props];
  if (step) {
    const source = Object.values(b.quests)[0]!;
    b.quests['test/tending'] = { ...source, id: 'test/tending', steps: [step] };
  }
  return b;
}

function messages(b: Bundle): string {
  return checkPlay(b, {}).map((issue) => issue.message).join('\n');
}

describe('fire rules', () => {
  it('accepts a named fire, its tending step and a prop lit by it', () => {
    const b = world(
      [prop('test/fire', { fire: true }), prop('test/sign', { lit_by: 'test/fire' })],
      { kind: 'tend', fire: 'test/fire' },
    );
    expect(checkPlay(b, {})).toEqual([]);
  });

  it('refuses a tending step that names a prop which is not a fire', () => {
    const text = messages(world([prop('test/stone')], { kind: 'tend', fire: 'test/stone' }));
    expect(text).toContain('"test/stone" is not a fire prop');
    expect(text).toContain('G48');
  });

  it('refuses a fire prop without an id', () => {
    expect(messages(world([prop(undefined, { fire: true })]))).toContain('a fire needs an id');
  });

  it('refuses lit_by when its id is not a fire', () => {
    expect(messages(world([prop('test/stone'), prop('test/sign', { lit_by: 'test/stone' })]))).toContain(
      '"test/stone" is not a fire prop',
    );
  });
});
