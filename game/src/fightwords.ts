import type { FightOutcome } from '@game/kernel';

export const FIGHT_WORD_MS = 600;
const HEAD_GAP = 4;
const RISE = 16;
// 16px line height, up to 1.25× for a critical, plus room for the outline.
const STACK_STEP = 24;

function textOf({ kind, number }: FightOutcome): string {
  switch (kind) {
    case 'attack': return String(number);
    case 'critical': return `CRIT ${number}`;
    case 'guard': return `BLOCK ${number}`;
    case 'miss': return 'MISS';
    case 'dodge': return 'DODGE';
  }
}

/** The label's bottom in CSS pixels above the top of the recipient's figure. */
export function fightWordOffset(progress: number, stack: number): number {
  return HEAD_GAP + stack * STACK_STEP + progress * RISE;
}

/** One sample of the label's flight. The oldest word goes highest. */
export function fightWordAt(outcome: FightOutcome, ageMs: number, stack = 0) {
  if (ageMs < 0 || ageMs >= FIGHT_WORD_MS) return undefined;
  const progress = ageMs / FIGHT_WORD_MS;
  return {
    text: textOf(outcome),
    scale: outcome.kind === 'critical' ? 1.25 : 1,
    offset: fightWordOffset(progress, stack),
    alpha: 1 - progress,
  };
}
