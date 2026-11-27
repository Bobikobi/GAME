/**
 * The baked ground in chunks (NEXT 15, step 4). While every ground tile is a density-1 sprite the valley is one
 * canvas per frame, as it always was. Once one is at density 4 the ground is baked at 4 texture pixels per world
 * unit, which makes the 48x49 valley 3072x3136 per frame: past what a phone GPU takes in one texture, and about
 * 38 MB each. So it is baked per chunk of 16x16 tiles (1024x1024): only the chunks in view and one ring around
 * them are kept, built as the camera moves and dropped as it leaves. A chunk with no animated tile in it shares
 * one texture across the water's frames.
 *
 * At first light, and where the view lands on pages nothing of which is held (a teleport), the pages the view touches
 * are baked at once. Every other page, the ring and a page the walk reaches, is baked in strips (#879): a strip is
 * a few tiles of one page painted into a small scratch canvas and copied into the page, one idle slice runs as many
 * strips as it has time for (stream.ts), so crossing into a new page never blocks a frame (NEXT 19 d). The strips of
 * the pages the view touches come first, then the ring ahead of the figure's heading, then the rest. A page the view
 * reaches before its strips are done shows what is baked so far, the way a page not yet baked shows nothing.
 * `allow` limits the pages to the world chunks the stream holds.
 */
import type * as Phaser from 'phaser';
import { IdleQueue } from './stream';

/** Tiles on a chunk's side. */
export const CHUNK = 16;
/** A strip's size in tiles: half a row of a page, so one strip is a few tens of ms on a slow machine. */
export const STRIP_COLS = 8;
export const STRIP_ROWS = 1;
/** A piece of a strip that took longer than this halves the width of the next; one under FAST_MS doubles it (ms). */
const SLOW_MS = 25;
const FAST_MS = 8;
/** The longest a page already in view waits for the GPU to be given what is baked of it, ms. */
const UPLOAD_MS = 100;

export interface ChunkRange {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The chunks (inclusive) a world rectangle touches, widened by `ring` chunks and clamped to the map. */
export function chunkRange(view: { x: number; y: number; right: number; bottom: number }, unit: number, tilesW: number, tilesH: number, ring = 1): ChunkRange {
  const side = CHUNK * unit;
  const lastX = Math.ceil(tilesW / CHUNK) - 1;
  const lastY = Math.ceil(tilesH / CHUNK) - 1;
  const clamp = (v: number, last: number) => Math.max(0, Math.min(last, v));
  return {
    x0: clamp(Math.floor(view.x / side) - ring, lastX),
    y0: clamp(Math.floor(view.y / side) - ring, lastY),
    x1: clamp(Math.floor(view.right / side) + ring, lastX),
    y1: clamp(Math.floor(view.bottom / side) + ring, lastY),
  };
}

/** Paints one frame of a chunk's tiles into a canvas texture; says whether any tile in it is animated. */
export type ChunkPainter = (tex: Phaser.Textures.CanvasTexture, frame: number, tx0: number, ty0: number, tw: number, th: number) => boolean;

/** A rectangle of tiles on a page, counted from the page's corner. */
export interface Strip {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The strips of a page of `tw` by `th` tiles, those nearest the point `near` (in tiles from the page's corner) first. */
export function stripsOf(tw: number, th: number, near: { x: number; y: number }, cols = STRIP_COLS, rows = STRIP_ROWS): Strip[] {
  const out: Strip[] = [];
  for (let y = 0; y < th; y += rows) for (let x = 0; x < tw; x += cols) out.push({ x, y, w: Math.min(cols, tw - x), h: Math.min(rows, th - y) });
  const far = (s: Strip) => (s.x + s.w / 2 - near.x) ** 2 + (s.y + s.h / 2 - near.y) ** 2;
  return out.map((s, i) => ({ s, i, d: far(s) })).sort((a, b) => a.d - b.d || a.i - b.i).map((e) => e.s);
}

/**
 * The order the pages are baked in: the pages the view touches first, then the ring ahead of the figure's heading
 * (a page in front of it), then the rest; each group nearest the view's centre first. `centre` and `heading` are in
 * pages (world units over the page's side); a zero heading puts no page ahead.
 */
export function pageOrder<P extends { cx: number; cy: number }>(pages: readonly P[], seen: ChunkRange, centre: { x: number; y: number }, heading: { x: number; y: number }): P[] {
  const rank = (p: P): [number, number] => {
    const dx = p.cx + 0.5 - centre.x;
    const dy = p.cy + 0.5 - centre.y;
    const inView = p.cx >= seen.x0 && p.cx <= seen.x1 && p.cy >= seen.y0 && p.cy <= seen.y1;
    const ahead = dx * heading.x + dy * heading.y > 0;
    return [inView ? 0 : ahead ? 1 : 2, dx * dx + dy * dy];
  };
  return pages.map((p, i) => ({ p, i, r: rank(p) })).sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i).map((e) => e.p);
}

interface Chunk {
  cx: number;
  cy: number;
  tx0: number;
  ty0: number;
  tw: number;
  th: number;
  img?: Phaser.GameObjects.Image;
  /** the frames the image shows: the first alone until every frame is whole */
  keys: string[];
  /** every texture made for the page, whole or not */
  all: string[];
  texs: Phaser.Textures.CanvasTexture[];
  paint?: ChunkPainter;
  strips: Strip[];
  /** strip-frame units baked, and how many there are: the first frame's strips, then (if any tile is animated) the other frames' */
  done: number;
  total: number;
  /** tiles of the strip in hand already painted */
  at: number;
  complete: boolean;
  /** the first frame has strips the GPU has not been given yet, and when it was last given any */
  dirty: boolean;
  uploaded: number;
  /** the view touches the page */
  visible: boolean;
}

/** The queue key of the strip job: one job at a time, in the order of `todo`. */
const STRIPS = 'strips';

export class GroundChunks {
  private readonly live = new Map<string, Chunk>();
  /** the pages with strips still to bake, the first the next */
  private todo: Chunk[] = [];
  private scratch: Phaser.Textures.CanvasTexture | undefined;
  private span = '';
  private frame = 0;
  /** where the view's centre was when the heading was last taken, and the way it has been going since (world units) */
  private from: { x: number; y: number } | undefined;
  private heading = { x: 0, y: 0 };
  /** the pages the view touches, as of the last `update` */
  private seen: ChunkRange | undefined;
  /** how many times a page was baked whole in one call (a first light the view could not wait for), and the longest of them in ms */
  wholeBakes = 0;
  wholeLongest = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tilesW: number,
    private readonly tilesH: number,
    /** texture pixels per world unit: 4 */
    private readonly density: number,
    /** world units per tile */
    private readonly unit: number,
    private readonly frames: number,
    private readonly depth: number,
    private readonly makePainter: () => ChunkPainter,
    private readonly allow: (tx: number, ty: number) => boolean = () => true,
    private readonly queue: IdleQueue = new IdleQueue(),
    private readonly stripCols = STRIP_COLS,
    private readonly stripRows = STRIP_ROWS,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** how many tiles of a strip one slice's job paints: it follows what the last one cost */
  private pieceCols = 2;

  /** How many pages are held now (started: a page waiting for its first strip is not). */
  get count(): number {
    let n = 0;
    for (const chunk of this.live.values()) if (chunk.img) n++;
    return n;
  }

  /** Pages with strips still to bake. */
  get waiting(): number {
    return this.todo.length;
  }

  /** The longest single strip bake so far, in ms. */
  get longest(): number {
    return this.queue.longest;
  }

  /** Bakes every waiting strip now. */
  flush(): void {
    while (this.todo.length > 0) this.bakeUnit(this.todo[0]!);
    this.queue.cancel(STRIPS);
  }

  /**
   * Queues the pages the view touches and the ring around them, bakes at once only what the view touches when none
   * of it is held yet (first light, a teleport), and drops the rest. `epoch` changes when the stream's window does,
   * so a page that was not held yet is asked again. Cheap while the camera stays in a page. A `lazy` update bakes nothing
   * whole and starts no idle job: the caller bakes the view's pages with `bakeView` and then calls `resume` (the world's build, #843).
   */
  update(view: { x: number; y: number; right: number; bottom: number }, epoch = '', lazy = false): void {
    const centre = { x: (view.x + view.right) / 2, y: (view.y + view.bottom) / 2 };
    // the heading is the way the view's centre has gone since it last moved a tile
    if (!this.from) this.from = centre;
    else if (Math.hypot(centre.x - this.from.x, centre.y - this.from.y) >= this.unit) {
      this.heading = { x: centre.x - this.from.x, y: centre.y - this.from.y };
      this.from = centre;
    }
    const r = chunkRange(view, this.unit, this.tilesW, this.tilesH);
    const span = `${r.x0},${r.y0},${r.x1},${r.y1},${epoch}`;
    if (span === this.span) return;
    this.span = span;
    const seen = chunkRange(view, this.unit, this.tilesW, this.tilesH, 0);
    this.seen = seen;
    const inView = (c: Chunk) => c.cx >= seen.x0 && c.cx <= seen.x1 && c.cy >= seen.y0 && c.cy <= seen.y1;
    const want = new Set<string>();
    for (let cy = r.y0; cy <= r.y1; cy++) {
      for (let cx = r.x0; cx <= r.x1; cx++) if (this.allow(cx * CHUNK, cy * CHUNK)) want.add(`${cx},${cy}`);
    }
    for (const [id, chunk] of this.live) {
      if (want.has(id)) continue;
      this.free(chunk);
      this.live.delete(id);
    }
    const side = CHUNK * this.unit;
    const held = [...this.live.values()].some((c) => inView(c) && c.img);
    for (const id of want) {
      if (this.live.has(id)) continue;
      const [cx, cy] = id.split(',').map(Number) as [number, number];
      const chunk = this.chunk(cx, cy, { x: (centre.x - cx * side) / this.unit, y: (centre.y - cy * side) / this.unit });
      this.live.set(id, chunk);
    }
    // nothing of the view's own pages is held: it has to be seen whole this frame
    if (!held && !lazy) for (const chunk of this.live.values()) if (inView(chunk) && !chunk.img) this.bakeWhole(chunk);
    for (const chunk of this.live.values()) {
      const v = inView(chunk);
      // a page that has only now come into view is given what is baked of it before the next frame draws it
      if (v && !chunk.visible && chunk.dirty) this.upload(chunk);
      chunk.visible = v;
    }
    this.todo = pageOrder([...this.live.values()].filter((c) => !c.complete), seen, { x: centre.x / side, y: centre.y / side }, this.heading);
    if (this.todo.length > 0) {
      if (!lazy) this.pump();
    } else this.queue.cancel(STRIPS);
  }

  /**
   * Bakes strips of the pages the view touches (they come first in the queue) for up to `budget` ms; true when every one
   * of them is whole. The same pixels as a whole-page bake, a few ms at a time (#843).
   */
  bakeView(budget: number): boolean {
    const seen = this.seen;
    if (!seen) return true;
    const first = (): Chunk | undefined => {
      const c = this.todo[0];
      return c && c.cx >= seen.x0 && c.cx <= seen.x1 && c.cy >= seen.y0 && c.cy <= seen.y1 ? c : undefined;
    };
    const t0 = this.now();
    for (let c = first(); c; c = first()) {
      this.bakeUnit(c);
      if (this.now() - t0 >= budget) break;
    }
    return !first();
  }

  /** Starts the idle job for the strips still waiting: what `update` does unless it was `lazy`. */
  resume(): void {
    if (this.todo.length > 0) this.pump();
  }

  /** Shows a frame of the water's cycle on every chunk that has one. */
  setFrame(frame: number): void {
    this.frame = frame;
    for (const chunk of this.live.values()) this.show(chunk);
  }

  destroy(): void {
    this.queue.clear();
    for (const chunk of this.live.values()) this.free(chunk);
    this.live.clear();
    this.todo = [];
    if (this.scratch) this.scene.textures.remove('ground-strip');
    this.scratch = undefined;
    this.span = '';
    this.from = undefined;
    this.heading = { x: 0, y: 0 };
  }

  private chunk(cx: number, cy: number, near: { x: number; y: number }): Chunk {
    const tx0 = cx * CHUNK;
    const ty0 = cy * CHUNK;
    const tw = Math.min(CHUNK, this.tilesW - tx0);
    const th = Math.min(CHUNK, this.tilesH - ty0);
    const strips = stripsOf(tw, th, near, this.stripCols, this.stripRows);
    return { cx, cy, tx0, ty0, tw, th, keys: [], all: [], texs: [], strips, done: 0, total: strips.length, at: 0, complete: false, dirty: false, uploaded: 0, visible: false };
  }

  private free(chunk: Chunk): void {
    for (const key of chunk.all) this.scene.textures.remove(key);
    chunk.img?.destroy();
    this.todo = this.todo.filter((c) => c !== chunk);
  }

  private show(chunk: Chunk): void {
    if (chunk.img && chunk.keys.length > 0) chunk.img.setTexture(chunk.keys[Math.min(this.frame, chunk.keys.length - 1)]!);
  }

  private texture(chunk: Chunk, frame: number): Phaser.Textures.CanvasTexture {
    const key = `ground-c${chunk.cx}x${chunk.cy}-${frame}`;
    const tex = this.scene.textures.createCanvas(key, chunk.tw * this.unit * this.density, chunk.th * this.unit * this.density);
    if (!tex) throw new Error(`no canvas for ${key}`);
    chunk.all.push(key);
    chunk.texs.push(tex);
    return tex;
  }

  /** The whole page in one go, every frame: what the view needs on the frame it lands on a page. */
  private bakeWhole(chunk: Chunk): void {
    const t0 = this.now();
    this.wholeBakes++;
    const paint = this.makePainter();
    const animated = (frame: number): boolean => {
      const tex = this.texture(chunk, frame);
      const a = paint(tex, frame, chunk.tx0, chunk.ty0, chunk.tw, chunk.th);
      tex.refresh();
      return a;
    };
    if (animated(0)) for (let f = 1; f < this.frames; f++) animated(f);
    chunk.keys = chunk.all.slice();
    chunk.img = this.image(chunk);
    chunk.complete = true;
    chunk.done = chunk.total = 1;
    this.wholeLongest = Math.max(this.wholeLongest, this.now() - t0);
  }

  private upload(chunk: Chunk): void {
    chunk.texs[0]!.refresh();
    chunk.dirty = false;
    chunk.uploaded = this.now();
  }

  private image(chunk: Chunk): Phaser.GameObjects.Image {
    return this.scene.add
      .image(chunk.tx0 * this.unit, chunk.ty0 * this.unit, chunk.keys[Math.min(this.frame, chunk.keys.length - 1)]!)
      .setOrigin(0)
      .setScale(1 / this.density)
      .setDepth(this.depth);
  }

  /** Asks for the next strip in an idle slice; a slice with time left runs on to the one after, since the job asks again. */
  private pump(): void {
    this.queue.push(STRIPS, () => {
      const chunk = this.todo[0];
      if (!chunk) return;
      this.bakeUnit(chunk);
      if (this.todo.length > 0) this.pump();
    });
  }

  /**
   * A piece of one strip of one frame of a page: as many tiles as the last piece's cost allows. The strips of the first
   * frame come first; the other frames follow once a tile is known to be animated.
   */
  private bakeUnit(chunk: Chunk): void {
    const t0 = this.now();
    const n = chunk.strips.length;
    const frame = Math.floor(chunk.done / n);
    const strip = chunk.strips[chunk.done % n]!;
    if (!chunk.paint) {
      chunk.paint = this.makePainter();
      this.texture(chunk, 0);
      chunk.keys = [chunk.all[0]!];
      chunk.img = this.image(chunk);
    }
    // a frame's canvas is made as its first strip is baked, one at a time, so no slice makes three
    if (!chunk.texs[frame]) this.texture(chunk, frame);
    const w = Math.min(this.pieceCols, strip.w - chunk.at);
    const rx = strip.x + chunk.at;
    const scratch = this.stripTexture();
    scratch.getContext().clearRect(0, 0, scratch.width, scratch.height);
    const animated = chunk.paint(scratch, frame, chunk.tx0 + rx, chunk.ty0 + strip.y, w, strip.h);
    const px = this.unit * this.density;
    const tex = chunk.texs[frame]!;
    tex.getContext().drawImage(scratch.getCanvas() as CanvasImageSource, 0, 0, w * px, strip.h * px, rx * px, strip.y * px, w * px, strip.h * px);
    if (frame === 0 && animated) chunk.total = n * this.frames;
    chunk.at += w;
    if (chunk.at >= strip.w) {
      chunk.at = 0;
      chunk.done++;
      // the first frame shows as it is baked, as often as the GPU can be given it; the others show only whole
      if (frame === 0) chunk.dirty = true;
      else if (chunk.done % n === 0) tex.refresh();
    }
    if (chunk.dirty && (chunk.done >= n || (chunk.visible && this.now() - chunk.uploaded >= UPLOAD_MS))) this.upload(chunk);
    if (chunk.done >= chunk.total) {
      chunk.complete = true;
      chunk.keys = chunk.all.slice();
      this.todo = this.todo.filter((c) => c !== chunk);
      this.show(chunk);
    }
    const took = this.now() - t0;
    if (took > SLOW_MS) this.pieceCols = Math.max(1, this.pieceCols >> 1);
    else if (took < FAST_MS) this.pieceCols = Math.min(this.stripCols, this.pieceCols * 2);
  }

  private stripTexture(): Phaser.Textures.CanvasTexture {
    if (this.scratch) return this.scratch;
    const px = this.unit * this.density;
    const tex = this.scene.textures.createCanvas('ground-strip', this.stripCols * px, this.stripRows * px);
    if (!tex) throw new Error('no canvas for the strip');
    this.scratch = tex;
    return tex;
  }
}
