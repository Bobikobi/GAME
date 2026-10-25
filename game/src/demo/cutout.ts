/**
 * DEMO ONLY - the new cast moving by cut-out animation (a throwaway branch, never merged).
 *
 * Each still drawing of the new cast was cut into parts on the rest pose of its own body's rig, and each part follows
 * its rig bone frame by frame. The sheets in public/demo-cutout/ are shown as the player's look, and a small menu (or
 * the number keys) plays each new rig action. Off unless the page asks for it with ?cutout=1, or this demo build turns
 * it on (DEMO_BUILD); ?cutout=0 turns it off. Test runs (?debug) see normal play unless they ask. When it is off,
 * nothing here runs: no sheet loads, no key is read, no element is added.
 */
import type { Bundle } from '@game/kernel';
import type * as Phaser from 'phaser';
import type { Dir } from '../input';
import { baseOf, retex } from '../kitart';
import type { Facing8 } from '../walking';
import type { AutoKind } from '../work';
import index from './cutout-index.json';

/** This branch is the demo build: its preview opens with the cut-out cast. */
const DEMO_BUILD = true;

export const CUTOUT: boolean = (() => {
  if (typeof location === 'undefined') return false;
  const q = new URLSearchParams(location.search);
  const asked = q.get('cutout');
  if (asked !== null) return asked !== '0';
  return DEMO_BUILD && !q.has('debug');
})();

type Body = 'human_man' | 'human_woman' | 'elf_man' | 'elf_woman' | 'skeleton';
const BODIES: readonly Body[] = ['human_man', 'human_woman', 'elf_man', 'elf_woman', 'skeleton'];
const NAME: Record<Body, string> = { human_man: 'Human man', human_woman: 'Human woman', elf_man: 'Elf man', elf_woman: 'Elf woman', skeleton: 'Skeleton' };
type Mode = '' | 'torch' | 'lantern' | 'carry';
type Action = 'torch' | 'lantern' | 'carry' | 'fish' | 'eat' | 'kindle' | 'sit' | 'sleep' | 'talk' | 'stop' | 'body' | 'view';

/**
 * The size question (Z): (0) native, as drawn; (1) the character bigger, about 1.5 times, each body by its rig height
 * (human man 84, human woman 80, elf man 88, elf woman 84, skeleton 76), nearest-neighbour; (2) the camera closer, by
 * the game's own whole zoom steps (art pixels stay whole device pixels): the step nearest 1.5 times at or above it.
 */
const VIEWS = ['native', 'character bigger', 'camera closer'] as const;
const HEIGHT: Record<Body, number> = { human_man: 84, human_woman: 80, elf_man: 88, elf_woman: 84, skeleton: 76 };

const KEYS: Record<string, Action> = {
  Digit1: 'torch', Digit2: 'lantern', Digit3: 'carry', Digit4: 'fish', Digit5: 'eat',
  Digit6: 'kindle', Digit7: 'sit', Digit8: 'sleep', Digit9: 'talk', Digit0: 'stop', KeyB: 'body', KeyZ: 'view',
};
const LABEL: Record<Action, string> = {
  torch: '1 Torch', lantern: '2 Lantern', carry: '3 Carry', fish: '4 Fish', eat: '5 Eat',
  kindle: '6 Kindle', sit: '7 Sit', sleep: '8 Sleep', talk: '9 Talk', stop: '0 Stop', body: 'B Body', view: 'Z View',
};

interface Step { clip: string; loop: boolean }
interface Index {
  cell: [number, number];
  feet: [number, number];
  bodies: Record<string, { url: string; frames: number; strips: Record<string, [number, number]> }>;
  clips: Record<string, { ms: number[] }>;
}
const IX = index as unknown as Index;
const keyOf = (body: Body): string => `demo-cutout:${body}`;

/** Adds one sheet per body to the bundle's sprites, before the boot scene loads them. */
export function registerCutout(bundle: Bundle): void {
  if (!CUTOUT) return;
  for (const body of BODIES) {
    const b = IX.bodies[body]!;
    bundle.sprites[keyOf(body)] = { url: b.url, w: IX.cell[0], h: IX.cell[1], frames: b.frames, density: 4 };
  }
}

/** The race and look the player picked, as a body of the new cast. */
function bodyFor(race: string, look: number): Body {
  if (race === 'core/skeleton') return 'skeleton';
  if (race === 'core/elf') return look === 1 ? 'elf_woman' : 'elf_man';
  return look === 1 ? 'human_woman' : 'human_man';
}

/** A facing the sheets hold, and whether it is mirrored: the right-hand facings are the left ones flipped. */
function sheetFacing(f: Facing8): { f: string; flip: boolean } {
  if (f === 'right') return { f: 'left', flip: true };
  if (f === 'down_right') return { f: 'down_left', flip: true };
  if (f === 'up_right') return { f: 'up_left', flip: true };
  return { f, flip: false };
}

export interface DemoFrame {
  moving: boolean;
  falling: boolean;
  facing: Dir;
  look: Facing8;
  race: string;
  lookIndex: number;
  work: AutoKind | undefined;
  now: number;
}

export class CutoutDemo {
  private mode: Mode = '';
  private queue: Step[] = [];
  private fishing = 0;
  private picked: Body | null = null;
  private shown = '';
  private since = 0;
  private bodyLabel?: HTMLElement;
  private onStage = false;
  private view = 0;
  private shownScale = 1;
  /** a test hook (?debug only): every clip holds this frame, so stills of the three views show the same pose */
  private pinned: number | null = null;

  constructor() {
    if (!CUTOUT) return;
    // before the game's own keys: Z is the game's A button too, and in the demo it only switches the view
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select')) return;
      const a = KEYS[e.code];
      if (!a) return;
      if (a === 'view') {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      if (!e.repeat) this.act(a);
    }, true);
    this.panel();
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __cutout: CutoutDemo }).__cutout = this;
  }

  private act(a: Action): void {
    if (a === 'torch' || a === 'lantern' || a === 'carry') {
      this.mode = this.mode === a ? '' : a;
      this.queue = [];
      this.fishing = 0;
    } else if (a === 'fish') {
      this.fishing = (this.fishing + 1) % 3;
      this.queue = this.fishing === 1 ? [{ clip: 'fish_cast', loop: false }, { clip: 'fish_wait', loop: true }]
        : this.fishing === 2 ? [{ clip: 'fish_bite', loop: false }, { clip: 'fish_reel', loop: true }] : [];
    } else if (a === 'eat' || a === 'kindle') {
      this.queue = [{ clip: a, loop: false }];
      this.fishing = 0;
    } else if (a === 'sit' || a === 'sleep' || a === 'talk') {
      this.queue = [{ clip: a, loop: true }];
      this.fishing = 0;
    } else if (a === 'view') {
      this.view = (this.view + 1) % VIEWS.length;
    } else if (a === 'stop') {
      this.queue = [];
      this.mode = '';
      this.fishing = 0;
    } else {
      const at = this.picked ? BODIES.indexOf(this.picked) : -1;
      this.picked = at + 1 < BODIES.length ? BODIES[at + 1]! : null;
    }
    this.shown = '';
  }

  /** Every frame, after the scene drew the player: the cut-out frame takes its place. */
  apply(p: Phaser.GameObjects.Sprite, f: DemoFrame): void {
    if (f.falling) {
      if (this.onStage) p.setOrigin(0.5, 1).setScale(baseOf(p));
      this.onStage = false;
      this.shownScale = 1;
      return;
    }
    const body = this.picked ?? bodyFor(f.race, f.lookIndex);
    if (this.bodyLabel) this.bodyLabel.textContent = `${NAME[body]}${this.picked ? '' : ' (from your look)'} - view: ${VIEWS[this.view]}`;
    const strips = IX.bodies[body]!.strips;
    if (f.moving || f.work) {
      this.queue = [];
      this.fishing = 0;
    }
    let clip: string;
    let face: Facing8 = f.look;
    if (f.work) {
      clip = f.work;
      face = f.facing;
    } else if (f.moving) clip = this.mode ? `walk_${this.mode}` : 'walk';
    else if (this.queue.length) clip = this.queue[0]!.clip;
    else clip = this.mode ? `idle_${this.mode}` : 'idle';
    // the side view is the only one that reads as lying down
    if (clip === 'sleep') face = f.facing === 'right' || f.look.endsWith('right') ? 'right' : 'left';
    let { f: sf, flip } = sheetFacing(face);
    if (!strips[`${sf}_${clip}`]) ({ f: sf, flip } = sheetFacing(f.facing));
    const strip = strips[`${sf}_${clip}`];
    if (!strip) return;
    const name = `${body}/${sf}_${clip}`;
    if (name !== this.shown) {
      this.shown = name;
      this.since = f.now;
    }
    const ms = IX.clips[clip]?.ms ?? [150];
    const [start, count] = strip;
    let t = f.now - this.since;
    let i = 0;
    const loop = !this.queue.length || this.queue[0]!.loop;
    for (;;) {
      const d = ms[i % ms.length]!;
      if (t < d) break;
      t -= d;
      i += 1;
      if (i >= count) {
        if (!loop) {
          this.queue.shift();
          this.shown = '';
          i = count - 1;
          break;
        }
        i = 0;
      }
    }
    if (this.pinned !== null) i = Math.min(this.pinned, count - 1);
    retex(p, keyOf(body), start + i);
    p.setFlipX(flip).setOrigin(0.5, IX.feet[1] / IX.cell[1]);
    const k = this.view === 1 ? (1.5 * HEIGHT[body]) / HEIGHT.human_man : 1;
    if (k !== 1 || this.shownScale !== 1) p.setScale(baseOf(p) * k);
    this.shownScale = k;
    this.onStage = true;
  }

  /**
   * The camera for the size question: the screen's own zoom, or for "camera closer" the whole step nearest 1.5 times
   * (at or above it). Leaves a camera held on the stone alone. True when it changed the zoom.
   */
  camera(cam: Phaser.Cameras.Scene2D.Camera, base: number, held: boolean): boolean {
    if (held) return false;
    const want = this.view === 2 ? 4 * Math.ceil((1.5 * base) / 4) : base;
    if (cam.zoom === want) return false;
    cam.setZoom(want);
    return true;
  }

  /** Test hook: hold every clip on one frame (null lets them play). */
  pin(frame: number | null): void {
    this.pinned = frame;
  }

  /** A small fixed menu: a button opens the actions, each one the same as its number key. */
  private panel(): void {
    const css = document.createElement('style');
    css.textContent = `.cutout-demo{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:60;font:13px/1.3 system-ui,sans-serif;color:#f5f4ef;text-align:center}
.cutout-demo button{font:inherit;color:inherit;background:#26243dcc;border:1px solid #6b6688;border-radius:6px;padding:4px 8px;margin:2px;cursor:pointer;min-height:28px}
.cutout-demo .acts{display:flex;flex-wrap:wrap;justify-content:center;max-width:340px;background:#1b1a2ee6;border-radius:8px;padding:4px;margin-top:4px}
.cutout-demo .acts[hidden]{display:none}.cutout-demo .who{width:100%;padding:2px}`;
    document.head.append(css);
    const root = document.createElement('div');
    root.className = 'cutout-demo';
    const toggle = document.createElement('button');
    toggle.textContent = 'Cut-out demo';
    const acts = document.createElement('div');
    acts.className = 'acts';
    acts.hidden = true;
    toggle.addEventListener('click', () => {
      acts.hidden = !acts.hidden;
      toggle.blur();
    });
    this.bodyLabel = document.createElement('div');
    this.bodyLabel.className = 'who';
    acts.append(this.bodyLabel);
    for (const a of Object.keys(LABEL) as Action[]) {
      const b = document.createElement('button');
      b.textContent = LABEL[a];
      b.addEventListener('click', () => {
        this.act(a);
        b.blur();
      });
      acts.append(b);
    }
    root.append(toggle, acts);
    document.body.append(root);
  }
}
