/**
 * The walk an e2e makes (NEXT 22 d). Free movement turns a press into a distance rather than a step, so a test
 * holds the input until the feet's centre stands on a tile and lets go there, with a timeout, in place of
 * counting presses. Both doors keep the feet at art-pixel precision (`walking.ts`), so the same helper walks
 * the pixel game and the 3D one; on a phone the pad is a stick and it is pushed, not tapped.
 *
 * The input is started from here and let go in the page: a frame can be a quarter of a second on a machine
 * rendering in software, and a release sent over the wire lands a frame late, which walks the body a tile further.
 */
import { type Page, sleep } from './cdp';

export type Dir = 'up' | 'down' | 'left' | 'right';

export const VEC: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const ARROW: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

/** Art pixels per tile, and the middle of one (`walking.ts` ART_PX). */
export const ART_PX = 64;
const MIDDLE = ART_PX / 2;
/** How far out on the pad the stick is pushed: past the 40% of its width that walks at full speed (`input.ts`). */
const STICK_OUT = 0.45;
/** How often the feet are read while a direction is held, in ms. */
const POLL = 25;

/** In the page: let go of the walk on the frame the feet's centre stands on the tile, or the player faces the way asked. */
const IN_PAGE = `window.__walk = (() => {
  const g = () => window.__game;
  const tileOf = () => {
    const b = g().world.body;
    return [Math.floor(b.x / 64), Math.floor(b.y / 64)];
  };
  const letGo = (touch) => {
    if (touch) g().controls.setStick(null);
    else for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  };
  const watch = (touch, done) => {
    const gen = (window.__walkGen = (window.__walkGen ?? 0) + 1);
    window.__walkDone = false;
    const look = () => {
      if (window.__walkGen !== gen) return;
      if (done()) {
        window.__walkDone = true;
        letGo(touch);
        return;
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  };
  return {
    /** Let go once the feet's centre is on the tile. */
    until(tile, touch) { watch(touch, () => { const t = tileOf(); return t[0] === tile[0] && t[1] === tile[1]; }); },
    /** Let go once the player faces a direction. */
    turn(dir, touch) { watch(touch, () => g().session.facing === dir); },
    /** True once the page has let go. */
    done() { return window.__walkDone === true; },
    feet() { const b = g().world.body; return [b.x, b.y]; },
    /**
     * The feet's place, the tile under them, and whether a window holds the world: a box must not be pushed past
     * by the walk. Work under way is not a stop: a held direction is what takes the work back (world.ts workTick).
     */
    now() {
      const g2 = g(), s = g2.session;
      const peek = !!(g2.world.peek && g2.world.peek.active);
      return {
        feet: [g2.world.body.x, g2.world.body.y],
        tile: tileOf(),
        stop: s.paused || g2.ui.blocking || peek,
        why: {
          paused: s.pauses,
          blocking: g2.ui.blocking,
          peek,
          busy: s.busy,
          can: g2.world.canControl(s),
          layers: [...document.querySelectorAll('#ui > .layer')].map((e) => e.className),
        },
      };
    },
  };
})();
true`;

/** The middle of a tile, in art pixels. */
export function middleOf(tile: readonly number[]): [number, number] {
  return [tile[0]! * ART_PX + MIDDLE, tile[1]! * ART_PX + MIDDLE];
}

/** Whether the feet's centre stands on `tile`: the tile under it is the player's tile (NEXT 22 a). */
export function onTile(feet: readonly [number, number], tile: readonly number[]): boolean {
  return inSpan(feet[0], tile[0]) && inSpan(feet[1], tile[1]);
}

/** Whether a coordinate falls inside tile `k`'s span on its axis. */
function inSpan(v: number, k: number | undefined): boolean {
  return k !== undefined && v >= k * ART_PX && v < (k + 1) * ART_PX;
}

/** What the page says about the walk just now. */
interface Sample {
  feet: [number, number];
  tile: [number, number];
  stop: boolean;
  why: Record<string, unknown>;
}

/** The walk a test holds: one direction at a time, or two for a diagonal, until the feet stand where wanted. */
export class FreeWalk {
  /** the directions whose keys are down now */
  private held = new Set<Dir>();
  /** the stick's push, while a finger is on the pad */
  private pushed: [number, number] | null = null;
  private pad: { cx: number; cy: number; w: number } | null = null;
  private installed = false;

  constructor(
    readonly page: Page,
    readonly touch: boolean,
  ) {}

  /** The feet's centre, in art pixels. */
  async feet(): Promise<[number, number]> {
    return this.page.eval<[number, number]>('window.__walk.feet()');
  }

  /** The way the player faces: the axis of the last motion. */
  facing(): Promise<Dir> {
    return this.page.eval<Dir>('window.__game.session.facing');
  }

  /** Let go of everything: no key down, no finger on the pad. */
  async release(): Promise<void> {
    for (const dir of [...this.held]) await this.page.key(ARROW[dir], 'keyUp');
    this.held.clear();
    await this.push(0, 0);
  }

  /**
   * Hold toward `tile` until the feet's centre stands on it, then let go there. The axes are steered apart, so
   * the body walks a diagonal as a diagonal, and the page lets go on the frame the tile is reached. A window
   * opening under the walk ends it where it stands (the word in town stops the walk), and a timeout throws.
   */
  async holdTo(tile: readonly number[], what: string, timeoutMs = 10_000): Promise<void> {
    await this.install();
    await this.page.eval(`window.__walk.until([${tile[0]}, ${tile[1]}], ${this.touch})`);
    const [tx, ty] = middleOf(tile);
    const end = Date.now() + timeoutMs;
    const start = await this.feet();
    try {
      for (;;) {
        const now = await this.page.eval<Sample>('window.__walk.now()');
        const [fx, fy] = now.feet;
        const there = now.tile[0] === tile[0] && now.tile[1] === tile[1];
        if (there && (await this.page.eval<boolean>('window.__walk.done()'))) return;
        // a box opening under the walk ends it where it stands (the word in town stops the walk); before the
        // walk has moved, a world held by something else is waited out and the walk goes on when it lets go
        if (now.stop) {
          if (Math.hypot(fx - start[0], fy - start[1]) > 1) return;
          if (Date.now() > end) throw new Error(`walking to ${what} at ${tile.join(',')} waited out a world that took no input: ${JSON.stringify(now.why)}`);
          await sleep(POLL);
          continue;
        }
        // an axis whose span the feet are already in needs no push: a step then walks the one axis it names,
        // and the facing it draws is that axis's own (a diagonal only when the tile is off both spans)
        const ax = inSpan(fx, tile[0]) ? 0 : Math.sign(tx - fx);
        const ay = inSpan(fy, tile[1]) ? 0 : Math.sign(ty - fy);
        if (ax !== 0 || ay !== 0) await this.steer(ax, ay);
        if (Date.now() > end) {
          throw new Error(`walking to ${what} at ${tile.join(',')} timed out: the feet stand at ${fx.toFixed(1)},${fy.toFixed(1)}`);
        }
        await sleep(POLL);
      }
    } finally {
      await this.release();
    }
  }

  /**
   * Face `dir` while standing on `tile` (NEXT 22 a: the facing is the motion's, so a body turns by moving).
   * Into a wall the held input only turns it; otherwise the body steps one tile back and comes back, and the
   * walk onto the tile is the last motion, which leaves the facing as the way it came.
   */
  async turnTo(dir: Dir, tile: readonly number[], what: string): Promise<void> {
    await this.install();
    if (!onTile(await this.feet(), tile)) await this.holdTo(tile, `the tile facing ${what}`);
    if ((await this.facing()) === dir && onTile(await this.feet(), tile)) return;
    const [dx, dy] = VEC[dir];
    const ahead = [tile[0]! + dx, tile[1]! + dy];
    const behind = [tile[0]! - dx, tile[1]! - dy];
    if (!(await this.open(ahead))) {
      await this.holdTurn(dir, what);
    } else if (await this.open(behind)) {
      await this.holdTo(behind, `the tile behind for ${what}`);
      await this.holdTo(tile, `the tile facing ${what}`);
    } else {
      throw new Error(`cannot turn toward ${what} at ${tile.join(',')}: both tiles beside it are closed`);
    }
    if ((await this.facing()) !== dir || !onTile(await this.feet(), tile)) {
      throw new Error(`could not stand on ${tile.join(',')} facing ${dir} for ${what}`);
    }
  }

  /** Hold a direction until the player faces it, the page letting go on that frame; a wall stops the body there. */
  private async holdTurn(dir: Dir, what: string): Promise<void> {
    await this.page.eval(`window.__walk.turn(${JSON.stringify(dir)}, ${this.touch})`);
    const [x, y] = VEC[dir];
    await this.steer(x, y);
    try {
      await this.page.waitFor('window.__walk.done()', `the turn toward ${what}`, 3000);
    } finally {
      await this.release();
    }
  }

  /** Whether the walk may enter a tile, by the world's own rule. */
  private open(at: readonly number[]): Promise<boolean> {
    return this.page.eval<boolean>(`window.__game.world.canWalk(window.__game.session, ${at[0]}, ${at[1]})`);
  }

  /** Hold the axes wanted: two keys on a keyboard, the stick pushed that way on a phone. */
  private async steer(ax: number, ay: number): Promise<void> {
    if (this.touch) return this.push(ax, ay);
    const want = new Set<Dir>();
    if (ax > 0) want.add('right');
    if (ax < 0) want.add('left');
    if (ay > 0) want.add('down');
    if (ay < 0) want.add('up');
    for (const dir of [...this.held]) {
      if (want.has(dir)) continue;
      await this.page.key(ARROW[dir], 'keyUp');
      this.held.delete(dir);
    }
    for (const dir of want) {
      if (this.held.has(dir)) continue;
      await this.page.key(ARROW[dir], 'keyDown');
      this.held.add(dir);
    }
  }

  /** The phone's stick: a finger at 45% of the pad's width, in the axes' direction; a direction change starts a new one. */
  private async push(ax: number, ay: number): Promise<void> {
    if (ax === 0 && ay === 0) {
      if (!this.pushed) return;
      this.pushed = null;
      await this.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      return;
    }
    const length = Math.hypot(ax, ay);
    const ux = ax / length;
    const uy = ay / length;
    if (this.pushed && Math.abs(this.pushed[0] - ux) < 1e-9 && Math.abs(this.pushed[1] - uy) < 1e-9) return;
    if (!this.pad) {
      this.pad = await this.page.eval<{ cx: number; cy: number; w: number }>(
        `(() => { const r = document.querySelector('.pad').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width }; })()`,
      );
    }
    if (this.pushed) await this.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    this.pushed = [ux, uy];
    const out = this.pad.w * STICK_OUT;
    await this.page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: this.pad.cx + ux * out, y: this.pad.cy + uy * out, id: 1 }],
    });
  }

  /** The page's own hook that lets go of the walk on the right frame. */
  private async install(): Promise<void> {
    if (this.installed) return;
    await this.page.eval(IN_PAGE);
    this.installed = true;
  }
}
