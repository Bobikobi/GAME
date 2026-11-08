/**
 * The ways through in the content check: the shipped valley has none, and each mistake a creator can make
 * with a `portal` prop gets an error that says what to change.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, makeWalkable } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkPortals } from '../src/portals';

type Prop = Bundle['map']['props'][number];
type Tile = [number, number];

let base: Bundle;
let open: Tile;
let open2: Tile;
let wall: Tile;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
  const walkable = makeWalkable(base);
  const view = { restored: [] as string[], camp: [] as string[] };
  const opens: Tile[] = [];
  for (let y = 1; y < base.map.height - 1 && opens.length < 2; y++) {
    for (let x = 1; x < base.map.width - 1 && opens.length < 2; x++) if (walkable(x, y, view)) opens.push([x, y]);
  }
  [open, open2] = [opens[0]!, opens[1]!];
  for (let y = 0; y < base.map.height; y++) for (let x = 0; x < base.map.width; x++) if (!walkable(x, y, view)) wall ??= [x, y];
});

function way(id: string | undefined, at: Tile, to: Tile, solid = false): Prop {
  return { ...(id === undefined ? {} : { id }), sprite: 'core/base-kit:props/ruin_arch', x: at[0], y: at[1], w: 1, h: 1, solid, portal: { x: to[0], y: to[1] } };
}

function withProps(props: Prop[]): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props, ...props];
  return b;
}

const messages = (props: Prop[]) => checkPortals(withProps(props), {}).map((i) => i.message).join('\n');

describe('the ways through', () => {
  it('the shipped valley has no way and no complaint, and a sound way passes', () => {
    expect(checkPortals(base, {})).toEqual([]);
    expect(messages([way('core/t-door', open, open2)])).toBe('');
  });

  it('a way needs an id and may not be solid', () => {
    expect(messages([way(undefined, open, open2)])).toContain('needs an id');
    expect(messages([way('core/t-door', open, open2, true)])).toContain('is solid');
  });

  it('a way leads to a tile inside the map where somebody can stand, and not to its own tile', () => {
    expect(messages([way('core/t-door', open, [base.map.width, 0])])).toContain('outside the map');
    expect(messages([way('core/t-door', open, open)])).toContain('its own tile');
    expect(messages([way('core/t-door', open, wall)])).toContain('nobody can stand');
  });

  it('a way never leads onto another way: one way per step', () => {
    const issues = messages([way('core/t-door', open, open2), way('core/t-up', open2, open)]);
    expect(issues).toContain('leads onto another way, core/t-up');
    expect(issues).toContain('leads onto another way, core/t-door');
  });
});
