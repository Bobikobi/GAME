/** Pure rules and shared contracts for the one-button gathering minigames. */
import type { Grade } from '@game/kernel';
import type { UI } from '../ui';

export interface GameOptions {
  /** Short action label shown above the game. */
  title: string;
  /** Player attribute in the inclusive range 0..10. */
  agility: number;
  /** Extra leniency supplied by techniques, as a percentage. */
  widenPct: number;
  /** Kit sprite ref for the gathered object. */
  sprite?: string;
  /** Lets the world animate and play sound for each attempted beat. */
  onBeat?: (i: number, grade: Grade) => void;
  /** Injectable randomness keeps item sequences deterministic in tests. */
  random?: () => number;
}

export type Minigame = (ui: UI, opts: GameOptions) => Promise<Grade | null>;

export const GRADE_NAMES = ['Miss', 'OK', 'Good', 'Perfect!'] as const;

export type StrikeWindows = readonly [perfect: number, good: number, ok: number];

export function strikeWindows(agility: number, widenPct: number): StrikeWindows {
  const k = (1 + 0.06 * agility) * ((100 + widenPct) / 100);
  return [Math.min(120, 70 * k), Math.min(220, 140 * k), Math.min(320, 230 * k)];
}

export function strikeGrade(errMs: number, windows: StrikeWindows): Grade {
  if (errMs <= windows[0]) return 3;
  if (errMs <= windows[1]) return 2;
  if (errMs <= windows[2]) return 1;
  return 0;
}

export function strikeTotal(grades: readonly Grade[]): Grade {
  const total = grades.reduce<number>((sum, grade) => sum + grade, 0);
  if (total >= 8) return 3;
  if (total >= 5) return 2;
  if (total >= 2) return 1;
  return 0;
}

export function pickSequence(random: () => number = Math.random): boolean[] {
  const remaining = [true, true, true, false, false];
  for (let i = remaining.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [remaining[i], remaining[j]] = [remaining[j]!, remaining[i]!];
  }
  return [true, ...remaining];
}

export function pickWindow(agility: number, widenPct: number): number {
  return Math.min(1500, 900 * (1 + 0.04 * agility) * ((100 + widenPct) / 100));
}

export function pickGrade(correct: number, mistakes: number): Grade {
  const score = Math.max(0, correct - mistakes);
  if (score >= 4) return 3;
  if (score === 3) return 2;
  if (score === 2) return 1;
  return 0;
}

export type SnapLimits = readonly [perfect: number, good: number, ok: number, timeUp: number];

export function snapLimits(agility: number, widenPct: number): SnapLimits {
  const k = (1 + 0.04 * agility) * ((100 + widenPct) / 100);
  return [2200 * k, 3000 * k, 4200 * k, 5000 * k];
}

export function snapGrade(ms: number, limits: SnapLimits, done: boolean): Grade {
  if (!done) return 0;
  if (ms <= limits[0]) return 3;
  if (ms <= limits[1]) return 2;
  if (ms <= limits[2]) return 1;
  return 0;
}
