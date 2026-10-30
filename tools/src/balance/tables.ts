/**
 * The tables the owner's page reads, from the same rules as the proofs:
 * time to zero in a harsh place (BODY_CLOCKS 5.3) by grade, answer and band,
 * and the window of lengths that makes a wall at each band and grade.
 */
import { idiv } from '@game/kernel';
import type { Catalogue } from './catalogue';
import { type Window, fit, windowOf } from './prove';
import { type Rules, ceilingOf } from './rules';

export interface TimeToZero {
  grade: number;
  answer: number;
  remaining: number;
  /** real milliseconds to zero health with no food; null: never */
  bareMs: number | null;
  /** by band 1-5, food carried (sustain at the band's ceiling); null: never */
  fedMs: (number | null)[];
}

/** Real milliseconds from a full cap to zero at a net drain in percent of the cap a game hour; null when nothing drains. */
export function toZeroMs(rules: Rules, netPct: number): number | null {
  return netPct <= 0 ? null : idiv(100 * rules.gameHourMs, netPct);
}

export function timeToZero(rules: Rules): TimeToZero[] {
  const out: TimeToZero[] = [];
  const top = rules.gradeDrainPct.length - 1;
  for (let grade = 1; grade <= top; grade++) {
    for (let answer = 0; answer <= top; answer++) {
      const remaining = Math.max(0, grade - answer);
      const drain = rules.gradeDrainPct[remaining] ?? 0;
      out.push({
        grade,
        answer,
        remaining,
        bareMs: toZeroMs(rules, drain),
        fedMs: Array.from({ length: rules.bands }, (_, i) => toZeroMs(rules, drain - ceilingOf(rules, 'sustain', i + 1))),
      });
    }
  }
  return out;
}

export const WINDOW_SETS: string[][] = [['frost'], ['frost', 'storm'], ['deep_snow', 'ice']];

export function windows(rules: Rules, cat: Catalogue): Window[] {
  const out: Window[] = [];
  const known = new Set(cat.traits.map((t) => t.answers));
  for (const set of WINDOW_SETS.filter((s) => s.every((c) => known.has(c)))) {
    for (let band = 2; band <= rules.bands; band++) for (let grade = 1; grade < rules.gradeDrainPct.length; grade++) out.push(windowOf(rules, cat, band, grade, set));
  }
  return out;
}

/** A new player (band 1) in calm snow: frost and deep snow at grade 1, bare, with a hood only, and with the common hood and snowshoes (PROGRESSION 5.7). */
export function calmSnow(rules: Rules, cat: Catalogue): { what: string; remaining: number; bareMs: number | null; fedMs: number | null }[] {
  const find = (id: string) => cat.pieces.find((p) => p.id === id);
  const hood = find('head.t1.common.cold_proof');
  const shoes = find('feet.t1.common.snow_shod');
  const sets: [string, typeof hood[]][] = [
    ['bare', []],
    ['a common wool hood', [hood]],
    ['a common wool hood and common snowshoes', [hood, shoes]],
  ];
  return sets.map(([what, list]) => {
    const pieces = list.filter((p): p is NonNullable<typeof p> => p !== undefined);
    const f = fit(rules, cat, 1, ['frost', 'deep_snow'], 1, 'move', { pieces, dishes: [] });
    const drain = rules.gradeDrainPct[f.r] ?? 0;
    return { what, remaining: f.r, bareMs: toZeroMs(rules, drain), fedMs: toZeroMs(rules, drain - ceilingOf(rules, 'sustain', 1)) };
  });
}
