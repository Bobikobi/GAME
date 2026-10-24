/**
 * The hand as a check (tools/src/quests/hand.ts, the same report `pnpm quests` prints): two quests of one type that a
 * character can finish back to back by its own choice, or that can be open at once. Warnings only. A pair along a
 * requires link is G17's error and is left to it. The report is pure and reads the bundle in a few milliseconds.
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';
import { hands } from './quests/hand';

export function checkHands(b: Bundle, origin: Record<string, string>): Issue[] {
  const found = new Map<string, { type: string; first: string; then: string; how: 'open' | 'needs'; pockets: string[] }>();
  for (const h of hands(b)) {
    for (const s of h.same) {
      if (s.how === 'requires') continue;
      const key = `${s.how}|${s.type}|${s.first}|${s.then}`;
      const seen = found.get(key);
      if (seen) seen.pockets.push(h.pocket);
      else found.set(key, { type: s.type, first: s.first, then: s.then, how: s.how, pockets: [h.pocket] });
    }
  }
  return [...found.values()].map((s) => {
    const where = b.pockets && Object.keys(b.pockets).length === s.pockets.length ? 'every wake pocket' : s.pockets.join(', ');
    const how =
      s.how === 'open'
        ? `${s.first} and ${s.then} (both ${s.type}) can be open at once, done in either order`
        : `${s.then} (${s.type}) can come right after ${s.first} (${s.type}), which finds or opens what it needs`;
    return {
      file: origin[s.then] ?? b.quests[s.then]?.file ?? '',
      where: `quests.hand.${s.then}`,
      message: `${how} (${where}): give one of them another type (G17, pnpm quests)`,
      level: 'warning' as const,
    };
  });
}
