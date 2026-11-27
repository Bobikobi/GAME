/** pnpm slots: the map's slots, one per line, from the same listing the MCP `slots` tool answers (tools/src/hub/content.ts). */
import { describe, expect, it } from 'vitest';
import { assemble } from '../src/assemble';
import { loadAll } from '../src/load';
import { mapSlots } from '../src/hub/content';

const bundle = assemble(loadAll().files).bundle;

describe('mapSlots', () => {
  it('lists the free townsperson places', () => {
    const slots = mapSlots(bundle!);
    const freeNpc = slots
      .filter((s) => s.kind === 'npc' && s.filled_by === null && s.reserved === undefined)
      .map((s) => s.id)
      .sort();
    expect(freeNpc).toEqual(['core/trainers-stall']);
  });

  it('names who fills each occupied npc slot', () => {
    const slots = mapSlots(bundle!);
    const filled = Object.fromEntries(slots.filter((s) => s.kind === 'npc' && s.filled_by !== null).map((s) => [s.id, s.filled_by]));
    expect(filled).toEqual({
      'core/elder-house': 'core/elder',
      'core/trader-stall': 'core/trader',
    });
  });

  it('marks the two decided slots reserved, not free', () => {
    const slots = mapSlots(bundle!);
    const reserved = Object.fromEntries(slots.filter((s) => s.reserved !== undefined).map((s) => [s.id, s.reserved]));
    expect(reserved).toEqual({
      'core/grove-clearing': 'The grove clearing is the traveller\'s ember camp (decision 35 of 22.10)',
      'core/town-corner': 'A player places a stall at the town\'s free corner (the owner\'s answer)',
    });
  });

  it('carries id, kind and a filler or null for every slot', () => {
    for (const s of mapSlots(bundle!)) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.kind).toBe('string');
      expect(s.filled_by === null || typeof s.filled_by === 'string').toBe(true);
    }
  });
});
