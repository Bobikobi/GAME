/**
 * Wind by a mask of height (ANIMATION.md 3.1, #660): the sway shader (motion.ts) moves pixels by exact colour, so a
 * picture drawn in other colours (a PixelLab tree) stood still. A sprite named in `MASKED` is moved by its own shape
 * instead: the gust of richground.ts leans its rows to the right, none at its foot, up to the whole gust at its top.
 *
 * The mask is a function of the picture's own opaque rows, so no tree is marked by hand and no image is added: the
 * picture is sheared once into three frames (lean 0, 1, 2 art px at the top) and the scene shows the frame the gust
 * asks for. Whole art pixels, the same grid and the same gust as the grass beside it. Pure here; `bake` and `MaskSway`
 * are the thin glue to the scene.
 */
import type * as Phaser from 'phaser';
import { gustAt } from './richground';

/**
 * The kit sprites that sway by the mask rather than by colour. Empty until a tree of another palette is in the kit:
 * with it empty every sprite looks and moves exactly as before. Single-frame sprites only.
 */
export const MASKED: ReadonlySet<string> = new Set();

/** The most art px the top of a picture leans: the gust's own heart. */
export const MAX_LEAN = 2;
/** The share of a picture's height, from its foot up, that holds still (the trunk and what stands on the ground). */
export const HOLD = 0.3;

/** The first and last opaque rows of an RGBA picture (the foot is the last), or undefined for an empty one. */
export function opaqueRows(data: ArrayLike<number>, width: number, height: number): { top: number; foot: number } | undefined {
  let top = -1;
  let foot = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[4 * (y * width + x) + 3] ?? 0) < 128) continue;
      if (top < 0) top = y;
      foot = y;
      break;
    }
  }
  return top < 0 ? undefined : { top, foot };
}

/** How much of the lean row `y` takes, 0 to 1: nothing through the held foot band, then rising to the whole at the top row. */
export function rowWeight(y: number, rows: { top: number; foot: number }): number {
  const span = rows.foot - rows.top;
  if (span <= 0) return 0;
  const up = Math.min(1, Math.max(0, (rows.foot - y) / span));
  return Math.max(0, (up - HOLD) / (1 - HOLD));
}

/** Whole art px the row `y` leans at gust `lean` (0 to MAX_LEAN). */
export function rowShift(y: number, rows: { top: number; foot: number }, lean: number): number {
  return Math.round(lean * rowWeight(y, rows));
}

/**
 * One frame of the sheared picture: each row moved right by its shift (left, with `toLeft`), on a canvas `pad` px wider
 * so nothing is cut: the pad is on the right of a right lean and on the left of a left one.
 */
export function shear(data: ArrayLike<number>, width: number, height: number, lean: number, pad: number, toLeft = false): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray((width + pad) * height * 4);
  const rows = opaqueRows(data, width, height);
  for (let y = 0; y < height; y++) {
    const by = rows ? rowShift(y, rows, lean) : 0;
    for (let x = 0; x < width; x++) {
      const from = 4 * (y * width + x);
      const to = 4 * (y * (width + pad) + x + (toLeft ? pad - by : by));
      for (let c = 0; c < 4; c++) out[to + c] = data[from + c] ?? 0;
    }
  }
  return out;
}

/** The texture key of a sprite's sheared copy. */
export const maskKey = (ref: string): string => `${ref}~mask`;

/**
 * Makes (once) the sheared copy of a loaded single-frame texture: frames 0, 1, 2 for the lean, each MAX_LEAN px wider
 * to the right than the picture, then frames 3, 4, 5 sheared to the left, for a sprite the scene mirrors (a mirrored
 * picture leaning left shows leaning right). Returns its key, or undefined when the texture is not loaded or has more than one frame.
 */
export function bake(textures: Phaser.Textures.TextureManager, ref: string): string | undefined {
  const key = maskKey(ref);
  if (textures.exists(key)) return key;
  if (!textures.exists(ref)) return undefined;
  const src = textures.get(ref);
  if (src.getFrameNames().length > 1) return undefined;
  const w = src.getSourceImage().width;
  const h = src.getSourceImage().height;
  const tex = textures.createCanvas(key, (w + MAX_LEAN) * (MAX_LEAN + 1) * 2, h);
  if (!tex) return undefined;
  tex.drawFrame(ref, undefined, 0, 0, false);
  const picture = tex.getData(0, 0, w, h).data;
  tex.clear();
  const ctx = tex.getContext();
  for (const toLeft of [false, true]) {
    for (let lean = 0; lean <= MAX_LEAN; lean++) {
      const n = lean + (toLeft ? MAX_LEAN + 1 : 0);
      const frame = new ImageData(shear(picture, w, h, lean, MAX_LEAN, toLeft), w + MAX_LEAN, h);
      ctx.putImageData(frame, n * (w + MAX_LEAN), 0);
      tex.add(n, 0, n * (w + MAX_LEAN), 0, w + MAX_LEAN, h);
    }
  }
  tex.refresh();
  return key;
}

interface Leaner {
  spr: Phaser.GameObjects.Sprite;
  /** the frame shown now, and the picture's width, for the origin of a mirrored sprite */
  shown: number;
  width: number;
}

/** The sprites that lean now, and the clock that sets their frame. */
export class MaskSway {
  private readonly all: Leaner[] = [];
  /** art px per world unit: 4 on the game's grid (64 per 16-unit tile), as the sway shader's `artPx` is a quarter of the zoom */
  private static readonly ART = 4;

  /**
   * A sprite from `ref` that leans by the mask, its foot at (x, bottom). `density` is the picture's art px per tile side / 16
   * (the kit's, 4 for a 64 px tile). Undefined when the picture cannot be sheared; the caller draws it plain.
   */
  add(scene: Phaser.Scene, ref: string, x: number, bottom: number, density: number): Phaser.GameObjects.Sprite | undefined {
    const key = bake(scene.textures, ref);
    if (!key) return undefined;
    const w = scene.textures.get(ref).getSourceImage().width;
    const spr = scene.add.sprite(x, bottom, key, 0);
    // the picture's own centre and foot stay where the plain sprite's would: the pad is on the right
    spr.setOrigin(w / 2 / (w + MAX_LEAN), 1);
    const base = 1 / density;
    spr.setData('base', base);
    spr.setScale(base);
    this.all.push({ spr, shown: 0, width: w });
    return spr;
  }

  /** Sets each leaner's frame from the gust at its top, in the same art-pixel grid and clock as the grass (`gustAt`). */
  update(timeMs: number, view: Phaser.Geom.Rectangle): void {
    const t = timeMs / 1000;
    for (const l of this.all) {
      const s = l.spr;
      const seen = s.x + s.displayWidth > view.x && s.x - s.displayWidth < view.right && s.y > view.y && s.y - s.displayHeight < view.bottom;
      if (!seen) continue;
      const lean = gustAt(Math.floor(s.x * MaskSway.ART), Math.floor((s.y - s.displayHeight) * MaskSway.ART), t);
      // a sprite the scene mirrors (`flipX`) takes the left-sheared frames, so its lean still goes with the wind, and its
      // origin moves to the picture's centre in them (the pad is on their left)
      const frame = s.flipX ? lean + MAX_LEAN + 1 : lean;
      if (frame === l.shown) continue;
      l.shown = frame;
      s.setOrigin(((s.flipX ? MAX_LEAN : 0) + l.width / 2) / (l.width + MAX_LEAN), 1);
      s.setFrame(frame);
    }
  }
}
