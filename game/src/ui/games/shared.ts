/**
 * Pure rules and shared contracts for the one-button gathering minigames.
 *
 * Every game grades 0..4. Grade 4, the jackpot, needs play better than
 * perfect: the same goods as perfect and three times the experience. A miss
 * (0) still keeps one unit now and then; the kernel draws that, not the game.
 */
import type { Grade } from '@game/kernel';
import type { UI } from '../ui';

export interface GameOptions {
  /** Short action label shown above the game. */
  title: string;
  /** How wide every window is, in percent of the base: 100 plus agility and techniques. */
  scalePct: number;
  /** Kit sprite ref for the gathered object. */
  sprite?: string;
  /** Lets the world animate and play sound for each attempted beat. */
  onBeat?: (i: number, grade: Grade) => void;
  /** Injectable randomness keeps item sequences deterministic in tests. */
  random?: () => number;
}

export type Minigame = (ui: UI, opts: GameOptions) => Promise<Grade | null>;

export const GRADE_NAMES = ['Miss', 'OK', 'Good', 'Perfect!', 'Jackpot!'] as const;

/** A base window widened by the player's scale, never past its cap. */
export function widen(base: number, scalePct: number, cap: number): number {
  return Math.min(cap, (base * Math.max(100, scalePct)) / 100);
}

// ------------------------------------------------------------ strike: three hammer blows

export type StrikeWindows = readonly [perfect: number, good: number, ok: number];

export function strikeWindows(scalePct: number): StrikeWindows {
  return [widen(55, scalePct, 120), widen(110, scalePct, 220), widen(170, scalePct, 320)];
}

export function strikeGrade(errMs: number, windows: StrikeWindows): Grade {
  if (errMs <= windows[0]) return 3;
  if (errMs <= windows[1]) return 2;
  if (errMs <= windows[2]) return 1;
  return 0;
}

/** Three perfect blows are the jackpot. */
export function strikeTotal(grades: readonly Grade[]): Grade {
  const total = grades.reduce<number>((sum, grade) => sum + Math.min(3, grade), 0);
  if (total >= 9) return 4;
  if (total >= 7) return 3;
  if (total >= 5) return 2;
  if (total >= 3) return 1;
  return 0;
}

// ------------------------------------------------------------ pick: only the ripe ones

export function pickSequence(random: () => number = Math.random): boolean[] {
  const remaining = [true, true, true, false, false];
  for (let i = remaining.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [remaining[i], remaining[j]] = [remaining[j]!, remaining[i]!];
  }
  return [true, ...remaining];
}

export function pickWindow(scalePct: number): number {
  return widen(750, scalePct, 1400);
}

/** A ripe one taken this soon after it shows counts as quick. */
export const PICK_QUICK_MS = 380;

/** All four ripe ones, no mistakes, every one quick: the jackpot. */
export function pickGrade(correct: number, mistakes: number, quick = 0): Grade {
  const score = Math.max(0, correct - mistakes);
  if (score >= 4 && mistakes === 0 && quick >= 4) return 4;
  if (score >= 4) return 3;
  if (score === 3) return 2;
  if (score === 2) return 1;
  return 0;
}

// ------------------------------------------------------------ snap: press fast

export type SnapLimits = readonly [perfect: number, good: number, ok: number, timeUp: number];

export function snapLimits(scalePct: number): SnapLimits {
  return [widen(1900, scalePct, 3800), widen(2600, scalePct, 5200), widen(3500, scalePct, 7000), widen(4500, scalePct, 9000)];
}

/** Snapping in under 70% of the perfect limit is the jackpot. */
export function snapGrade(ms: number, limits: SnapLimits, done: boolean): Grade {
  if (!done) return 0;
  if (ms <= limits[0] * 0.7) return 4;
  if (ms <= limits[0]) return 3;
  if (ms <= limits[1]) return 2;
  if (ms <= limits[2]) return 1;
  return 0;
}

// ------------------------------------------------------------ timing: stop the marker

/** Width of the stopping marker, as a share of the bar. */
export const MARKER_W = 0.025;
/** The jackpot strip is two markers wide and does not widen with agility. */
export const JACKPOT_W = 2 * MARKER_W;

export type TimingZones = readonly [perfect: number, good: number, ok: number];

/** Half-widths of the zones, as a share of the bar. */
export function timingZones(scalePct: number): TimingZones {
  return [widen(0.06, scalePct, 0.14), widen(0.11, scalePct, 0.24), widen(0.17, scalePct, 0.36)];
}

/**
 * The marker touching the jackpot strip is a jackpot; outside the widest zone
 * gives 0 or 1 randomly (a consolation roll, not a guaranteed miss).
 */
export function timingGrade(
  pos: number,
  center: number,
  z: TimingZones,
  random: () => number = () => 0,
): Grade {
  const d = Math.abs(pos - center);
  if (d <= JACKPOT_W / 2 + MARKER_W / 2) return 4;
  if (d <= z[0]) return 3;
  if (d <= z[1]) return 2;
  if (d <= z[2]) return 1;
  return random() < 0.5 ? 0 : 1;
}
