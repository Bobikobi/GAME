/**
 * The hazard rules in the content check (GAME_RULES G30, G34): the shipped valley has none, and each
 * mistake a creator can make with a hazard prop gets an error that names the rule.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkHazards } from '../src/hazards';

type Prop = Bundle['map']['props'][number];

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

function prop(id: string | undefined, x: number, y: number, hazard: Prop['hazard'], solid = false): Prop {
  return { ...(id === undefined ? {} : { id }), sprite: 'core/base-kit:props/standing_stone', x, y, w: 1, h: 1, solid, hazard };
}

function withProps(props: Prop[]): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props, ...props];
  return b;
}

describe('hazard rules', () => {
  it('the shipped valley has no hazard and no complaint', () => {
    expect(checkHazards(base, {})).toEqual([]);
  });

  it('a hazard without an id is refused', () => {
    const issues = checkHazards(withProps([prop(undefined, 8, 8, { kind: 'pit', window: ['night'] })]), {});
    expect(issues.map((i) => i.message).join('\n')).toContain('needs an id');
  });

  it('a reach belongs to a predator only', () => {
    const issues = checkHazards(withProps([prop('t/pit', 8, 8, { kind: 'pit', window: ['night'], reach: 3 })]), {});
    expect(issues.map((i) => i.message).join('\n')).toContain('only a predator has a reach');
  });

  it('a solid pit cannot be stepped on', () => {
    const issues = checkHazards(withProps([prop('t/pit', 8, 8, { kind: 'pit', window: ['night'] }, true)]), {});
    expect(issues.map((i) => i.message).join('\n')).toContain('must not be solid');
  });

  it('a hazard in the town square is refused by G30', () => {
    const issues = checkHazards(withProps([prop('t/pit', 26, 7, { kind: 'pit', window: ['night'] })]), {});
    expect(issues.map((i) => i.message).join('\n')).toContain('G30');
  });

  it('a predator whose run to a safe place is longer than a whole fall is refused by G34', () => {
    const b = withProps([prop('t/wolf', 6, 17, { kind: 'predator', window: ['night'], reach: 12 })]);
    b.params.hazard.predator.bite_pct = 60;
    const text = checkHazards(b, {}).map((i) => i.message).join('\n');
    expect(text).toContain('G34');
  });

  it('a predator right at the edge of the town leaves a short run and passes', () => {
    const b = withProps([prop('t/wolf', 20, 11, { kind: 'predator', window: ['night'], reach: 2 })]);
    expect(checkHazards(b, {})).toEqual([]);
  });
});
