/**
 * Keyboard and touch in one place. Directions are held (the last one pressed
 * wins, like a real d-pad); buttons are presses that the app routes to
 * whatever is on top: the minigame, a dialogue, a menu, or the world.
 */
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Button = 'a' | 'b' | 'bag' | 'journal' | 'menu' | 'up' | 'down';

export const DIRS: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

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
};

/** The dialogue, menu or title screen that has the player's attention. */
function topWindow(): Element | null {
  const layers = document.querySelectorAll('#ui > .layer');
  return layers[layers.length - 1] ?? document.querySelector('#ui > .title-screen');
}

export class Controls {
  private held: Dir[] = [];
  private touchDir: Dir | null = null;
  private handlers = new Set<(b: Button) => boolean | void>();

  constructor() {
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => {
      this.held = [];
      this.touchDir = null;
    });
  }

  /** The direction being held right now, if any. */
  direction(): Dir | null {
    return this.touchDir ?? this.held[this.held.length - 1] ?? null;
  }

  setTouchDir(dir: Dir | null): void {
    this.touchDir = dir;
  }

  onButton(fn: (b: Button) => boolean | void): void {
    this.handlers.add(fn);
  }

  press(button: Button): void {
    for (const fn of this.handlers) if (fn(button) === true) return;
  }

  private typing(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private keyDown(e: KeyboardEvent): void {
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
    const dir = KEY_DIR[e.code];
    if (dir) this.held = this.held.filter((d) => d !== dir);
  }
}
