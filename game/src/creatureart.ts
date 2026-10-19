/**
 * The pixels of the ambient creatures (creatures.ts), drawn at the world's 64 px per
 * tile (docs/design/STYLE.md): a few frames each, in the kit's colours with the one
 * ink outline, alpha 0 or 255. They are built from a few filled shapes and an
 * outline pass, not painted by hand, so a frame is a dozen lines and a creature
 * keeps the same outline whatever its pose. Every frame faces right (the scene
 * flips it) and is shown at `CREATURE_SCALE`, a quarter of a world unit to a
 * texture pixel, as every density-4 sprite is.
 */
import Phaser from 'phaser';

export const CREATURE_SCALE = 0.25;

const INK = 0x1b1a2e;
const C = {
  cream: 0xebd3a2,
  paper: 0xf5f4ef,
  coat: 0x9e6b3c,
  shade: 0x6e4226,
  gold: 0xeda83a,
  grey: 0x5d6177,
  grey2: 0x8f94a8,
  red: 0xe2533f,
};

/** A small raster of palette colours (-1 is clear), with the few shapes the creatures need. */
class Raster {
  readonly px: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Int32Array(w * h).fill(-1);
  }

  dot(x: number, y: number, color: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = color;
  }

  rect(x: number, y: number, w: number, h: number, color: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, color);
    return this;
  }

  /** An ellipse around (cx, cy), whole pixels. */
  ell(cx: number, cy: number, rx: number, ry: number, color: number): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.dot(x, y, color);
      }
    }
    return this;
  }

  /** A line `t` pixels thick. */
  line(x0: number, y0: number, x1: number, y1: number, t: number, color: number): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      this.rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, color);
    }
    return this;
  }

  /** The one outline: every clear pixel that touches the shape on a side becomes ink; one pixel of margin all round. */
  outlined(): Raster {
    const out = new Raster(this.w + 2, this.h + 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.px[(y + 1) * out.w + x + 1] = this.px[y * this.w + x]!;
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < out.w && y < out.h && out.px[y * out.w + x] !== -1;
    const ink: number[] = [];
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        if (!filled(x, y) && (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1))) ink.push(y * out.w + x);
      }
    }
    for (const i of ink) out.px[i] = INK;
    return out;
  }
}

// ---------------------------------------------------------------- bird

function bird(coat: number, shade: number, belly: number, beak: number, headDown = false): Raster {
  const r = new Raster(36, 28);
  const dy = headDown ? 3 : 0;
  r.line(8, 17, 1, 21, 3, shade); // tail
  r.ell(17, 17, 11, 7, coat);
  r.ell(15, 14, 8, 3, shade);
  r.ell(19, 20, 8, 4, belly);
  r.ell(15, 17, 6, 3, shade); // wing
  r.ell(26, 11 + dy, 6, 5, coat);
  r.rect(31, 11 + dy, 4, 2, beak);
  r.rect(28, 9 + dy, 2, 2, INK); // eye
  r.rect(15, 24, 2, 4, beak).rect(20, 24, 2, 4, beak); // legs
  return r;
}

function birdFlying(coat: number, shade: number, belly: number, beak: number, up: boolean): Raster {
  const r = new Raster(36, 28);
  r.line(9, 15, 2, 17, 3, shade);
  r.ell(17, 15, 10, 5, coat);
  r.ell(19, 17, 7, 3, belly);
  r.ell(26, 12, 5, 4, coat);
  r.rect(30, 12, 4, 2, beak);
  r.rect(27, 10, 2, 2, INK);
  if (up) r.line(15, 12, 10, 1, 5, shade).line(20, 12, 19, 0, 5, shade);
  else r.line(15, 17, 9, 27, 5, shade).line(20, 17, 18, 27, 5, shade);
  return r;
}

// ---------------------------------------------------------------- fish

function fish(tailUp: boolean): Raster {
  const r = new Raster(40, 16);
  r.ell(23, 8, 13, 5, C.grey2);
  r.ell(23, 5, 12, 2, C.grey);
  r.ell(23, 11, 10, 2, C.paper);
  r.rect(20, 7, 2, 1, C.red).rect(26, 8, 2, 1, C.red);
  if (tailUp) r.line(10, 8, 2, 2, 3, C.grey).line(10, 8, 2, 8, 3, C.grey);
  else r.line(10, 8, 2, 14, 3, C.grey).line(10, 8, 2, 8, 3, C.grey);
  r.rect(32, 6, 2, 2, INK);
  return r;
}

// ---------------------------------------------------------------- hare

function hareSit(flick: boolean): Raster {
  const r = new Raster(44, 40);
  r.ell(6, 27, 3, 3, C.paper); // tail
  r.ell(20, 28, 14, 9, C.coat);
  r.ell(14, 29, 8, 7, C.shade); // haunch
  r.ell(27, 31, 5, 5, C.cream); // chest
  r.rect(26, 34, 3, 5, C.coat); // front leg
  r.ell(15, 38, 6, 2, C.shade); // hind foot
  r.ell(33, 22, 7, 6, C.coat);
  r.ell(31, 9, 2, 7, C.coat).ell(31, 10, 1, 5, C.cream);
  const ex = flick ? 3 : 0;
  r.ell(36 + ex, flick ? 11 : 10, 2, flick ? 6 : 7, C.coat).ell(36 + ex, 11, 1, 4, C.cream);
  r.rect(36, 20, 2, 2, INK); // eye
  r.rect(40, flick ? 24 : 23, 2, 2, C.red); // nose
  return r;
}

function hareLeap(stretched: boolean): Raster {
  const r = new Raster(48, 40);
  if (stretched) {
    r.ell(6, 22, 3, 3, C.paper);
    r.ell(22, 22, 15, 7, C.coat);
    r.ell(15, 23, 8, 5, C.shade);
    r.ell(29, 25, 5, 4, C.cream);
    r.line(36, 26, 45, 31, 3, C.coat); // reaching forelegs
    r.line(12, 25, 2, 33, 4, C.shade); // pushing hind legs
    r.ell(39, 19, 6, 5, C.coat);
    r.line(36, 14, 27, 11, 3, C.coat); // ears laid back
    r.rect(41, 18, 2, 2, INK);
    r.rect(44, 20, 2, 2, C.red);
  } else {
    r.ell(7, 24, 3, 3, C.paper);
    r.ell(21, 26, 13, 8, C.coat);
    r.ell(14, 28, 8, 6, C.shade);
    r.ell(28, 29, 5, 4, C.cream);
    r.line(30, 32, 33, 38, 3, C.coat);
    r.line(14, 32, 20, 37, 4, C.shade);
    r.ell(34, 20, 6, 5, C.coat);
    r.line(32, 15, 26, 8, 3, C.coat);
    r.line(36, 15, 33, 5, 3, C.coat);
    r.rect(36, 19, 2, 2, INK);
    r.rect(40, 21, 2, 2, C.red);
  }
  return r;
}

// ---------------------------------------------------------------- deer

function deer(pose: 'stand' | 'graze' | 'walk0' | 'walk1'): Raster {
  const r = new Raster(84, 68);
  const walk = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;
  // legs first, so the body covers their tops
  const legs: [number, number][] = [
    [50, 6 * walk],
    [45, -5 * walk],
    [26, -5 * walk],
    [31, 6 * walk],
  ];
  legs.forEach(([x, swing], i) => {
    r.line(x, 42, x + swing, 62, 4, i % 2 === 1 ? C.shade : C.coat);
    r.rect(x + swing - 2, 62, 5, 3, INK);
  });
  r.ell(38, 34, 24, 11, C.coat);
  r.ell(38, 40, 18, 4, C.cream);
  r.ell(15, 33, 5, 6, C.cream); // the roe's pale rump
  r.line(14, 28, 11, 25, 3, C.shade); // tail
  if (pose === 'graze') {
    r.line(55, 30, 66, 42, 9, C.coat);
    r.ell(71, 46, 8, 6, C.coat);
    r.ell(78, 49, 3, 3, C.shade);
    r.rect(78, 47, 2, 2, INK);
    r.ell(66, 38, 2, 4, C.coat);
  } else {
    r.line(54, 27, 62, 15, 9, C.coat);
    r.ell(68, 12, 8, 6, C.coat);
    r.ell(76, 15, 4, 3, C.shade); // muzzle
    r.rect(78, 14, 2, 2, INK); // nose
    r.rect(70, 9, 2, 2, INK); // eye
    r.ell(63, 5, 2, 5, C.coat).ell(63, 6, 1, 3, C.cream); // ear
  }
  return r;
}

// ---------------------------------------------------------------- the sets

interface Set {
  look: string;
  variant: string;
  frames: Record<string, () => Raster>;
}

const SPARROW = [C.coat, C.shade, C.cream, C.gold] as const;
const CROW = [C.grey, INK, C.grey2, C.cream] as const;

const SETS: Set[] = [
  {
    look: 'bird',
    variant: 'plain',
    frames: {
      sit0: () => bird(...SPARROW),
      sit1: () => bird(...SPARROW, true),
      move0: () => birdFlying(...SPARROW, true),
      move1: () => birdFlying(...SPARROW, false),
    },
  },
  {
    look: 'bird',
    variant: 'dark',
    frames: {
      sit0: () => bird(...CROW),
      sit1: () => bird(...CROW, true),
      move0: () => birdFlying(...CROW, true),
      move1: () => birdFlying(...CROW, false),
    },
  },
  { look: 'fish', variant: 'plain', frames: { sit0: () => fish(true), sit1: () => fish(false) } },
  {
    look: 'rabbit',
    variant: 'plain',
    frames: { sit0: () => hareSit(false), sit1: () => hareSit(true), move0: () => hareLeap(true), move1: () => hareLeap(false) },
  },
  {
    look: 'deer',
    variant: 'plain',
    frames: { sit0: () => deer('stand'), sit1: () => deer('graze'), move0: () => deer('walk0'), move1: () => deer('walk1') },
  },
];

/** Texture keys follow `creature-<look>-<variant>-<pose><n>`; pose is 'sit' or 'move'. */
export function creatureKey(look: string, variant: string, pose: string, n: number): string {
  return `creature-${look}-${variant}-${pose}${n}`;
}

/** Draw every frame into a texture. Called once, only under RICH.motion. */
export function makeCreatureTextures(scene: Phaser.Scene): void {
  for (const set of SETS) {
    for (const [name, frame] of Object.entries(set.frames)) {
      const r = frame().outlined();
      const key = creatureKey(set.look, set.variant, name.slice(0, -1), Number(name.slice(-1)));
      const tex = scene.textures.createCanvas(key, r.w, r.h);
      if (!tex) continue;
      const data = new ImageData(r.w, r.h);
      for (let i = 0; i < r.px.length; i++) {
        const c = r.px[i]!;
        if (c === -1) continue;
        data.data[i * 4] = (c >> 16) & 255;
        data.data[i * 4 + 1] = (c >> 8) & 255;
        data.data[i * 4 + 2] = c & 255;
        data.data[i * 4 + 3] = 255;
      }
      tex.getContext().putImageData(data, 0, 0);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
