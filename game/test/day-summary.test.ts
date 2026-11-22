import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type GameEvent, newState, openDoor, step } from '@game/kernel';
import { SUMMARY_NAMES, dayRows, describe as describeEvent, doorLine, morning, rowLine } from '../src/text';
import { eventToasts } from '../src/toasts';
import { loadBundle } from '../../tools/test/helpers/world';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

describe('the day summary lines', () => {
  test('names what the content calls each id, and counts every id', () => {
    const rows = dayRows(b, { found: ['core/herb', 'core/log'], built: ['core/old-bridge'], learned: [] });
    expect(rows.map((r) => [r.kind, r.count])).toEqual([['found', 2], ['built', 1], ['learned', 0]]);
    expect(rowLine(rows[0]!)).toMatch(/^Found 2: /);
    expect(rowLine(rows[1]!)).toBe(`Built 1: ${b.restores['core/old-bridge']!.title}`);
    expect(rowLine(rows[2]!)).toBe('Learned: nothing yet');
  });

  test('spells out the first few names and counts the rest', () => {
    const ids = Object.keys(b.items).slice(0, SUMMARY_NAMES + 2);
    const row = dayRows(b, { found: ids, built: [], learned: [] })[0]!;
    const more = ids.length - SUMMARY_NAMES;
    expect(ids.length).toBeGreaterThan(SUMMARY_NAMES);
    expect(rowLine(row)).toContain(`and ${more} more`);
  });

  test('the open door is one line, from the quest state', () => {
    const s = step(b, newState(b, 3), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
    if (!s.ok) throw new Error(s.error);
    const door = openDoor(b, s.state);
    const line = doorLine(b, door);
    expect(line.length).toBeGreaterThan(10);
    expect(line).not.toContain('\n');
    expect(doorLine(b, undefined)).toBe('Nothing waits. The valley is yours to walk.');
  });
});

describe('the morning toast', () => {
  test('tells the day, what was worked once it is ready again, and the bell; the narrator tells nothing of the past', () => {
    expect(morning(2, 3)).toEqual({ text: 'Day 2. What you gathered is ready again.', second: 'A bell rang below the ruins in the night.', tone: 'info' });
    expect(morning(2, 0).text).toBe('Day 2.');
  });

  test('a dawn event is one toast with two lines; a step across several dawns tells the last', () => {
    const s = step(b, newState(b, 3), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
    if (!s.ok) throw new Error(s.error);
    const events: GameEvent[] = [
      { e: 'dawn', day: 2, renewed: 0 },
      { e: 'dawn', day: 3, renewed: 2 },
    ];
    const toasts = eventToasts(b, s.state, events);
    const lines = toasts.flatMap((t) => t.lines);
    expect(lines).toEqual(['Day 3. What you gathered is ready again.', 'A bell rang below the ruins in the night.']);
    expect(describeEvent(b, s.state, events[1]!)?.second).toBe('A bell rang below the ruins in the night.');
  });
});
