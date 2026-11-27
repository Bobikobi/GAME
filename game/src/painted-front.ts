/**
 * One window of a piece of the wood's mass, drawn again over the figure (13.11, round four, figure presence #16, order 5).
 *
 * The mass is drawn under everything that stands (painted.ts). A `FrontCut` is a small lit sprite whose picture is made as pixels: the piece's own colour and normal map, kept only where the pixel's foot
 * row (the join's foot-line map) is in front of the foot row it is asked for (see `cutFront`). So it is lit and coloured exactly as the mass is, and costs one plain draw: no mask pass, no extra render target.
 * It is drawn just over the one it covers. The window is a fixed size and moves with a corner; its two canvases (colour, normal) are the size of the window and are made again only when the window moves or
 * the foot row changes.
 */
import * as Phaser from 'phaser';
import { cutFront, premultiplyRound, windowAt, type FootLine, type SheetPixels } from './painted-depth';

export interface CutPiece {
  /** the piece's rectangle in the land's art px, and its place on the sheet */
  i: number;
  x0: number;
  y0: number;
  w: number;
  h: number;
  sx: number;
  sy: number;
}

/** what the front windows cost the CPU, summed over every window: cuts made, ms in the cut loop, ms in the two uploads, bytes uploaded (a rig reads and zeroes it; one pair of clock reads per cut, none on a still call); `direct` false is the rig's lever for the old canvas upload */
export const frontStats = { cuts: 0, cutMs: 0, uploadMs: 0, bytes: 0, direct: true };

export class FrontCut {
  readonly spr: Phaser.GameObjects.Sprite;
  readonly bw: number;
  readonly bh: number;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly ctxC: CanvasRenderingContext2D;
  private readonly ctxN: CanvasRenderingContext2D;
  private readonly imgC: ImageData;
  private readonly imgN: ImageData;
  private readonly key: string;
  private wx: number | undefined;
  private wy: number | undefined;
  private keyAt = '';
  /** the colour premultiplied, for the direct upload */
  private pm: Uint8Array | undefined;
  /** the foot rows between which the last cut stays the same */
  private range = { lo: -1, hi: Infinity };
  /** how many pixels the last cut kept (0: nothing of this window stands in front, the sprite is not drawn) */
  count = 0;
  /** how many times the window was cut (a still view adds none) */
  made = 0;

  constructor(private readonly world: Phaser.Scene, private readonly piece: CutPiece, private readonly origin: readonly [number, number], private readonly art: number, private readonly src: SheetPixels, bw: number, bh: number, tag: string) {
    this.bw = Math.min(bw, piece.w);
    this.bh = Math.min(bh, piece.h);
    this.key = `painted:front:${tag}:${piece.i}`;
    const t = world.textures.createCanvas(this.key, this.bw, this.bh);
    if (!t) throw new Error('painted: the front window refused its canvas');
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);   // one texel is one art pixel
    const nc = document.createElement('canvas');
    nc.width = this.bw;
    nc.height = this.bh;
    t.setDataSource(nc);
    this.tex = t;
    this.ctxC = t.getContext();
    this.ctxN = nc.getContext('2d')!;
    this.imgC = this.ctxC.createImageData(this.bw, this.bh);
    this.imgN = this.ctxN.createImageData(this.bw, this.bh);
    this.spr = world.add.sprite(0, 0, this.key).setOrigin(0, 0).setScale(1 / art).setLighting(true).setVisible(false);
  }

  /**
   * Show the pixels in front of `row` under `box` (land art px). The window is `slack` px larger than the box all round and keeps its place while the box stays inside it; it is cut again
   * only when the box leaves it, when `row` leaves the range of foot rows that cut the same pixels, or when `key` (what thins it) changes. A call that changes nothing costs nothing.
   * Draws nothing when no pixel of the window stands in front.
   */
  show(box: { x: number; y: number; w: number; h: number }, slack: number, row: number, fl: FootLine, see: ((x: number, y: number) => number) | undefined, key: string): number {
    const p = this.piece;
    const fits = (lo: number, span: number, win: number, at: number, c: number, len: number): boolean => (c >= at || at <= lo) && (c + len <= at + win || at + win >= lo + span);
    let { wx, wy } = this;
    const moved = wx === undefined || wy === undefined || !fits(p.x0, p.w, this.bw, wx, box.x, box.w) || !fits(p.y0, p.h, this.bh, wy, box.y, box.h);
    if (moved) {
      wx = windowAt(box.x - slack, p.x0, p.w, this.bw);
      wy = windowAt(box.y - slack, p.y0, p.h, this.bh);
    }
    const same = !moved && key === this.keyAt && row >= this.range.lo && row < this.range.hi;
    if (same) return this.count;
    this.wx = wx;
    this.wy = wy;
    this.keyAt = key;
    this.made++;
    const t0 = performance.now();
    this.count = cutFront(this.imgC.data, this.imgN.data, wx!, wy!, this.bw, this.bh, p, p.sx, p.sy, this.src, fl, row, see, this.range);
    const t1 = performance.now();
    frontStats.cuts++;
    frontStats.cutMs += t1 - t0;
    if (this.count > 0) {
      if (frontStats.direct && this.uploadDirect()) { /* typed arrays straight into the textures' storage */ } else {
        this.ctxC.putImageData(this.imgC, 0, 0);
        this.tex.refresh();
        this.ctxN.putImageData(this.imgN, 0, 0);
        this.tex.dataSource[0]?.update();
      }
      this.spr.setPosition(this.origin[0] + wx! / this.art, this.origin[1] + wy! / this.art);
      frontStats.uploadMs += performance.now() - t1;
      frontStats.bytes += this.bw * this.bh * 8;
    }
    this.spr.setVisible(this.count > 0);
    return this.count;
  }

  /**
   * The pixels go straight into the two textures' own storage (texSubImage2D from the cut's arrays) instead of through the canvas: a canvas refresh is a texImage2D, which asks the driver for new
   * storage and copies the canvas over, and it cost about 1.8 ms of GPU time a frame at a cut nearly every frame of a walk (round 5, O4). The colour is premultiplied here with the rounding the
   * canvas path has (the browser's own premultiply on a typed array floors, which differs by one level on the see-through fringe), so the bytes in the texture are the same as before.
   */
  private uploadDirect(): boolean {
    const r = this.world.sys.game.renderer as unknown as { gl?: WebGL2RenderingContext; glTextureUnits?: { bind(t: unknown, u: number): void }; glWrapper?: { updateTexturing(o: unknown): void } };
    const gl = r.gl;
    const wc = this.tex.source[0]?.glTexture as undefined | { flipY: boolean };
    const wn = this.tex.dataSource[0]?.glTexture as undefined | { flipY: boolean };
    if (!gl || !r.glTextureUnits || !r.glWrapper || !wc || !wn) return false;
    const pm = (this.pm ??= new Uint8Array(this.imgC.data.length));
    premultiplyRound(this.imgC.data, pm);
    for (const [w, px] of [[wc, pm], [wn, this.imgN.data]] as const) {
      r.glTextureUnits.bind(w, 0);
      r.glWrapper.updateTexturing({ texturing: { flipY: w.flipY, premultiplyAlpha: false } });
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.bw, this.bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return true;
  }

  hide(): void {
    this.spr.setVisible(false);
    this.wx = undefined;
    this.count = 0;
  }

  destroy(): void {
    this.spr.destroy();
    this.world.textures.remove(this.key);
  }
}
