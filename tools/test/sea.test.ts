/**
 * What `pnpm check` holds every passage to (docs/design/SEA_CROSSING.md section 5, measurable 5; tools/src/sea.ts):
 * an event that warns before it strikes and fits inside the crossing, an answer that can be given, and a reward
 * no larger than the minutes the crossing takes.
 */
import { describe, expect, it } from 'vitest';
import type { Bundle, PassageDef } from '@game/kernel';
import { runCheck } from '../src/check';
import { checkSea } from '../src/sea';

const b = runCheck().assembled.bundle!;
const BAY = 'core/bay-crossing';

/** The check on a copy of the bay's passage, changed by `change`. */
function check(change: (p: PassageDef) => void): { errors: string[]; warnings: string[] } {
  const passage = structuredClone(b.passages[BAY]!);
  change(passage);
  const bundle: Bundle = { ...b, passages: { [BAY]: passage } };
  const issues = checkSea(bundle, {});
  const lines = (level: string) => issues.filter((i) => i.level === level).map((i) => `${i.where}: ${i.message}`);
  return { errors: lines('error'), warnings: lines('warning') };
}

describe('the sea check', () => {
  it('passes the bay as it stands, with no warning', () => {
    expect(check(() => undefined)).toEqual({ errors: [], warnings: [] });
  });

  it('refuses a window with no segment for the sign or the sea after it', () => {
    const { errors } = check((p) => {
      p.segments = 4;
      p.events[0]!.window = 4;
    });
    expect(errors.some((m) => m.includes('leaves no segment for the sign'))).toBe(true);
  });

  it('refuses a tend that does not fit its window', () => {
    const { errors } = check((p) => {
      const e = p.events.find((x) => x.act.kind === 'tend')!;
      e.window = 1;
    });
    expect(errors.some((m) => m.includes('do not fit a window'))).toBe(true);
  });

  it('refuses a riddle whose answer is not among its choices', () => {
    const { errors } = check((p) => {
      const act = p.events.find((x) => x.act.kind === 'riddle')!.act;
      if (act.kind === 'riddle') act.answer = 2;
      if (act.kind === 'riddle') act.choices = act.choices.slice(0, 2);
    });
    expect(errors.some((m) => m.includes('is not one of the 2 choices'))).toBe(true);
  });

  it('refuses a reward over what the crossing\'s time is worth', () => {
    const { errors } = check((p) => {
      p.events[0]!.reward = { gold_mg: 10_000_000, items: [{ item: 'core/reed-cord', qty: 1 }] };
    });
    expect(errors.some((m) => m.includes('at the trader\'s share'))).toBe(true);
  });

  it('warns of two events of one type, a box too long and a gold-only reward', () => {
    const { errors, warnings } = check((p) => {
      p.events[1]!.type = p.events[0]!.type;
      p.board = ['x'.repeat(200)];
      p.events[2]!.reward = { gold_mg: 1000 };
    });
    expect(errors).toEqual([]);
    expect(warnings.some((m) => m.includes('pays the same feeling'))).toBe(true);
    expect(warnings.some((m) => m.startsWith('passage.board.0'))).toBe(true);
    expect(warnings.some((m) => m.includes('gold only'))).toBe(true);
  });
});
