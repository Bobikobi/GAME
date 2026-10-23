/** The reaction rules of `pnpm check` (docs/design/REACTIONS.md, section 6). */
import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, type ReactionDef, activitiesOf } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkReactions } from '../src/reactions';

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

const reaction = (body: Pick<ReactionDef, 'on' | 'when' | 'then'>, id = 'test/reaction'): ReactionDef => ({ id, creator: 'test', title: id, file: 'test', ...body });
const node = (extra: object = {}) => ({
  output: 'core/berry',
  yield: 1,
  active_ms: 1500,
  respawn_ms: 240_000,
  level: 1,
  sprite: 'core/base-kit:items/berry',
  at: 'below' as const,
  ...extra,
});

function messages(...rs: ReactionDef[]): string {
  const b = structuredClone(base);
  b.reactions = Object.fromEntries(rs.map((r) => [r.id, r]));
  return checkReactions(b, {}).map((i) => `${i.where}: ${i.message}`).join('\n');
}

/** The check over the core content with one more item, of a class nothing else gives. */
function withLoneClass(...rs: ReactionDef[]): string {
  const b = structuredClone(base);
  b.items['test/rain-pearl'] = { ...b.items['core/berry']!, id: 'test/rain-pearl', class: 'test/pearl' };
  b.reactions = { ...b.reactions, ...Object.fromEntries(rs.map((r) => [r.id, r])) };
  return checkReactions(b, {}).map((i) => `${i.where}: ${i.message}`).join('\n');
}

describe('the reaction check', () => {
  it('passes a windfall below the bushes, birds over a find and fish on the water', () => {
    expect(
      messages(
        reaction({ on: { resource: 'core/berry-bushes' }, when: { ready_for_ms: 240_000 }, then: { appear: node() } }, 'test/windfall'),
        reaction({ on: { treasure: '*' }, when: { player_within: 8, unseen: true }, then: { cue: 'birds_lift', spread: 2 } }, 'test/birds'),
        reaction({ on: { tag: 'water' }, when: { hours: [18, 21], chance_pct: 8 }, then: { cue: 'fish_rise' } }, 'test/fish'),
      ),
    ).toBe('');
  });

  it('refuses what it hangs on when that does not exist, or is not on the map', () => {
    expect(messages(reaction({ on: { resource: 'test/none' }, when: { night: true }, then: { wait: 1500 } }))).toMatch(/no resource "test\/none"/);
    expect(messages(reaction({ on: { treasure: 'test/none' }, when: { night: true }, then: { cue: 'birds_lift' } }))).toMatch(/no treasure "test\/none"/);
    expect(messages(reaction({ on: { tag: 'interior' }, when: { night: true }, then: { cue: 'fish_rise' } }))).toMatch(/hangs on nothing/);
  });

  it('refuses a condition that does not fit the thing', () => {
    expect(messages(reaction({ on: { tag: 'water' }, when: { ready_for_ms: 1000 }, then: { cue: 'fish_rise' } }))).toMatch(/a tile is never full/);
    expect(messages(reaction({ on: { resource: 'core/berry-bushes' }, when: { unseen: true }, then: { cue: 'birds_lift' } }))).toMatch(/only a treasure lies hidden/);
    expect(messages(reaction({ on: { tag: 'water' }, when: { on_tag: 'water' }, then: { cue: 'fish_rise' } }))).toMatch(/on that tag already/);
  });

  it('refuses an appear node that is no fair node or has no free tile', () => {
    const appear = (extra: object, on: ReactionDef['on'] = { resource: 'core/berry-bushes' }) =>
      messages(reaction({ on, when: { ready_for_ms: 240_000 }, then: { appear: node(extra) } }));
    expect(appear({ output: 'test/none' })).toMatch(/no item "test\/none"/);
    expect(appear({ sprite: 'core/base-kit:items/none' })).toMatch(/no sprite/);
    expect(appear({ active_ms: 10 })).toMatch(/active time 10 ms is outside/);
    expect(appear({ at: 'here' })).toMatch(/would lie on core\/berry-bushes#/);
    expect(appear({}, { treasure: '*' })).toMatch(/beside a resource node only/);
    // two reactions may not drop their nodes on the same tile
    expect(
      messages(
        reaction({ on: { resource: 'core/berry-bushes' }, when: { ready_for_ms: 240_000 }, then: { appear: node() } }, 'test/one'),
        reaction({ on: { resource: 'core/berry-bushes' }, when: { night: true }, then: { appear: node() } }, 'test/two'),
      ),
    ).toMatch(/would lie on test\/one@core\/berry-bushes#0/);
  });

  it('passes the core rows, and a node of the rain whose class is found in every weather', () => {
    expect(checkReactions(base, {})).toEqual([]);
    expect(Object.values(base.reactions).some((r) => r.when.weather === 'rain' && 'appear' in r.then)).toBe(true);
    expect(messages(reaction({ on: { resource: 'core/berry-bushes' }, when: { weather: 'fog' }, then: { appear: node() } }))).toBe('');
  });

  it('refuses a node that shows in one weather only and gives a class found in no other', () => {
    const lone = reaction({ on: { resource: 'core/berry-bushes' }, when: { weather: 'rain' }, then: { appear: node({ output: 'test/rain-pearl', at: 'above' }) } });
    expect(withLoneClass(lone)).toMatch(/"test\/rain-pearl" shows only in rain: its class must also be found in every weather/);
    // the same node with no weather is found every day, so it passes
    expect(withLoneClass(reaction({ on: { resource: 'core/berry-bushes' }, when: { ready_for_ms: 1000 }, then: { appear: node({ output: 'test/rain-pearl', at: 'above' }) } }))).toBe('');
  });

  it('refuses a wait on a tile, and a quicker respawn of a node that carries a rarity bonus', () => {
    expect(messages(reaction({ on: { tag: 'grove' }, when: { night: true }, then: { wait: 1500 } }))).toMatch(/a tile does not grow back/);
    const rare = activitiesOf(base).find((a) => a.b > 0 && base.resources[a.id])!.id;
    const plain = Object.keys(base.resources).find((id) => !activitiesOf(base).some((a) => a.id === id && a.b > 0))!;
    expect(messages(reaction({ on: { resource: rare }, when: { night: true }, then: { wait: 2000 } }))).toBe('');
    expect(messages(reaction({ on: { resource: rare }, when: { night: true }, then: { wait: 500 } }))).toMatch(/bring a rare node back sooner/);
    expect(messages(reaction({ on: { resource: '*' }, when: { night: true }, then: { wait: 500 } }))).toMatch(new RegExp(rare));
    expect(messages(reaction({ on: { resource: plain }, when: { night: true }, then: { wait: 500 } }))).toBe('');
  });
});
