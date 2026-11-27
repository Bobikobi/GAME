/**
 * Keyboard and touch in one place. Directions are held: the walk reads them as
 * one vector (two arrows at once walk a diagonal, the phone's stick any angle),
 * and a menu reads the last one pressed. Buttons are presses that the app routes
 * to whatever is on top: a dialogue, a menu, or the world.
 */
import type { Gait } from '@game/kernel';

import { type Ask, type WalkMode, stickGait, walkMode } from './walkfeel';

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Button = 'a' | 'b' | 'bag' | 'journal' | 'menu' | 'up' | 'down' | 'jump';

export const DIRS: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Inside this share of the pad's width from its center the stick reads nothing. */
export const STICK_DEAD = 0.12;
/** At this share of the pad's width from its center the stick walks at full speed. */
export const STICK_FULL = 0.4;

/** The stick's vector for a finger `dx, dy` from the center of a pad `width` wide: a length of 0 to 1. */
export function stickFrom(dx: number, dy: number, width: number): [number, number] {
  const r = Math.hypot(dx, dy);
  const dead = width * STICK_DEAD;
  if (r <= dead) return [0, 0];
  const speed = Math.min(1, (r - dead) / (width * STICK_FULL - dead));
  return [(dx / r) * speed, (dy / r) * speed];
}

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

const KEY_BUTTON: Record<string, Button> = {
  Space: 'a',
  Enter: 'a',
  KeyE: 'a',
  KeyZ: 'a',
  Escape: 'b',
  KeyX: 'b',
  Backspace: 'b',
  KeyI: 'bag',
  KeyJ: 'journal',
  KeyM: 'menu',
  // the jump (DECISIONS 2026-11-22): one hop ahead, or across a gap of water
  KeyC: 'jump',
};

/** The dialogue, menu or title screen that has the player's attention. */
function topWindow(): Element | null {
  const layers = document.querySelectorAll('#ui > .layer');
  return layers[layers.length - 1] ?? document.querySelector('#ui > .title-screen');
}

/** How long the thumb holds the stick before the walk becomes a run. */
export const RUN_HOLD_MS = 400;

export class Controls {
  private paused = false;
  private held: Dir[] = [];
  /** the phone's stick, with a length of 0 to 1; null while no finger is on it */
  private stick: readonly [number, number] | null = null;
  /** when the thumb began pushing the stick, in ms of the page clock; null while it rests */
  private pushedAt: number | null = null;
  /** Shift held: the keyboard's run, since a key held down is also how a walk is made */
  private shift = false;
  /** the sneak button, a toggle */
  private sneaking = false;
  private handlers = new Set<(b: Button) => boolean | void>();
  private upHandlers = new Set<(b: Button) => void>();

  /** whether the stick's last frame ran: the run's hysteresis (walkfeel.ts `stickGait`) */
  private running = false;
  /** `old` keeps the walk as it was before #641 (the 400 ms hold); the standard follows the push (walkfeel.ts) */
  readonly mode: WalkMode;

  constructor(mode: WalkMode = walkMode(window.location?.search ?? '')) {
    this.mode = mode;
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => {
      this.held = [];
      this.stick = null;
      this.pushedAt = null;
      this.running = false;
      this.shift = false;
    });
  }

  /** The direction being held right now, if any: the stick's leading axis, or the last key pressed. */
  direction(): Dir | null {
    if (this.paused) return null;
    if (this.stick) {
      const [x, y] = this.stick;
      if (x === 0 && y === 0) return null;
      return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
    }
    return this.held[this.held.length - 1] ?? null;
  }

  /**
   * The walk's input: the stick as it is, or the held keys as eight directions, a diagonal as long as a straight
   * line (NEXT 22 a). Opposite keys cancel. A length of 1 is full speed.
   */
  vector(): [number, number] {
    if (this.paused) return [0, 0];
    if (this.stick) return [this.stick[0], this.stick[1]];
    const on = (d: Dir) => (this.held.includes(d) ? 1 : 0);
    const x = on('right') - on('left');
    const y = on('down') - on('up');
    const length = Math.hypot(x, y);
    return length === 0 ? [0, 0] : [x / length, y / length];
  }

  /**
   * What the hands ask of this frame in the standard walk (walkfeel.ts): the unit direction, the gait, and the share of the
   * gait's pace. The stick's length picks the gait (a gentle push walks, a firm one runs) and the share; held keys are a full
   * walk, a run with Shift. `vector()` and `gait()` stay as they were, for `?walk=old` and for the rooms and the 3D door.
   */
  ask(): Ask {
    const none: Ask = { dir: [0, 0], share: 0, gait: 'walk' };
    if (this.paused) return none;
    if (this.stick) {
      const length = Math.hypot(this.stick[0], this.stick[1]);
      if (length === 0) {
        this.running = false;
        return none;
      }
      const { gait, share } = stickGait(length, this.running, this.sneaking, this.shift);
      this.running = gait === 'run';
      return { dir: [this.stick[0] / length, this.stick[1] / length], share, gait };
    }
    this.running = false;
    const [x, y] = this.vector();
    if (x === 0 && y === 0) return none;
    return { dir: [x, y], share: 1, gait: this.sneaking ? 'sneak' : this.shift ? 'run' : 'walk' };
  }

  /** The phone's stick: a vector of length 0 to 1, or null when the finger lifts. */
  setStick(v: readonly [number, number] | null): void {
    if (this.paused) return;
    const pushing = v !== null && (v[0] !== 0 || v[1] !== 0);
    if (!pushing) this.pushedAt = null;
    else if (this.pushedAt === null) this.pushedAt = performance.now();
    this.stick = v ? [v[0], v[1]] : null;
  }

  /** The sneak toggle: on, every step is a sneak until it is turned off (a thumb is busy steering). */
  setSneak(on: boolean): void {
    if (this.paused) return;
    this.sneaking = on;
  }

  /** Stops every game control while a modal outside the ordinary window stack has the screen. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) return;
    this.held = [];
    this.stick = null;
    this.pushedAt = null;
    this.running = false;
    this.shift = false;
  }

  get sneak(): boolean {
    return this.sneaking;
  }

  /**
   * The gait of the step being taken: a sneak when the toggle is on, a run when the thumb has pushed the stick
   * for `RUN_HOLD_MS` (or Shift is down), a walk otherwise.
   */
  gait(now: number): Gait {
    if (this.paused) return 'walk';
    if (this.sneaking) return 'sneak';
    if (this.shift) return 'run';
    return this.pushedAt !== null && now - this.pushedAt >= RUN_HOLD_MS ? 'run' : 'walk';
  }

  onButton(fn: (b: Button) => boolean | void): void {
    this.handlers.add(fn);
  }

  /** A button's key or touch rose: the app routes it like a press, but only the world listens for it now. */
  onButtonUp(fn: (b: Button) => void): void {
    this.upHandlers.add(fn);
  }

  press(button: Button): void {
    if (this.paused) return;
    for (const fn of this.handlers) if (fn(button) === true) return;
  }

  release(button: Button): void {
    if (this.paused) return;
    for (const fn of this.upHandlers) fn(button);
  }

  private typing(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private keyDown(e: KeyboardEvent): void {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = true;
    if (this.typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_DIR[e.code];
    if (dir) {
      e.preventDefault();
      if (!this.held.includes(dir)) this.held.push(dir);
      if (dir === 'up' || dir === 'down') this.press(dir);
      return;
    }
    const button = KEY_BUTTON[e.code];
    if (!button || e.repeat) return;
    // Enter and Space on a focused button are the button's own click, but only
    // in the window on top: a HUD button clicked earlier must not swallow A
    const focused = document.activeElement as HTMLElement | null;
    if ((e.code === 'Enter' || e.code === 'Space') && focused?.tagName === 'BUTTON') {
      if (topWindow()?.contains(focused)) return;
      focused.blur();
    }
    e.preventDefault();
    this.press(button);
  }

  private keyUp(e: KeyboardEvent): void {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = false;
    const dir = KEY_DIR[e.code];
    if (dir) {
      this.held = this.held.filter((d) => d !== dir);
      return;
    }
    const button = KEY_BUTTON[e.code];
    if (button) this.release(button);
  }
}
