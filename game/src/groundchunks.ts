/**
 * The baked ground in chunks (NEXT 15, step 4). While every ground tile is a density-1 sprite the valley is one
 * canvas per frame, as it always was. Once one is at density 4 the ground is baked at 4 texture pixels per world
 * unit, which makes the 48x49 valley 3072x3136 per frame: past what a phone GPU takes in one texture, and about
 * 38 MB each. So it is baked per chunk of 16x16 tiles (1024x1024): only the chunks in view and one ring around
 * them are kept, built as the camera moves and dropped as it leaves. A chunk with no animated tile in it shares
 * one texture across the water's frames.
 */
import type * as Phaser from 'phaser';

/** Tiles on a chunk's side. */
export const CHUNK = 16;

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
  return {
    x0: Math.max(0, Math.floor(view.x / side) - ring),
    y0: Math.max(0, Math.floor(view.y / side) - ring),
    x1: Math.min(lastX, Math.floor(view.right / side) + ring),
    y1: Math.min(lastY, Math.floor(view.bottom / side) + ring),
  };
}

/** Paints one frame of a chunk's tiles into a canvas texture; says whether any tile in it is animated. */
export type ChunkPainter = (tex: Phaser.Textures.CanvasTexture, frame: number, tx0: number, ty0: number, tw: number, th: number) => boolean;

interface Chunk {
  img: Phaser.GameObjects.Image;
  keys: string[];
}

export class GroundChunks {
  private readonly live = new Map<string, Chunk>();
  private span = '';
  private frame = 0;

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
    private readonly paint: ChunkPainter,
  ) {}

  /** How many chunks are held now. */
  get count(): number {
    return this.live.size;
  }

  /** Builds the chunks the view needs (with one ring) and drops the rest. Cheap while the camera stays in a chunk. */
  update(view: { x: number; y: number; right: number; bottom: number }): void {
    const r = chunkRange(view, this.unit, this.tilesW, this.tilesH);
    const span = `${r.x0},${r.y0},${r.x1},${r.y1}`;
    if (span === this.span) return;
    this.span = span;
    const want = new Set<string>();
    for (let cy = r.y0; cy <= r.y1; cy++) {
      for (let cx = r.x0; cx <= r.x1; cx++) {
        const id = `${cx},${cy}`;
        want.add(id);
        if (!this.live.has(id)) this.live.set(id, this.build(cx, cy));
      }
    }
    for (const [id, chunk] of this.live) {
      if (want.has(id)) continue;
      for (const key of chunk.keys) this.scene.textures.remove(key);
      chunk.img.destroy();
      this.live.delete(id);
    }
  }

  /** Shows a frame of the water's cycle on every chunk that has one. */
  setFrame(frame: number): void {
    this.frame = frame;
    for (const chunk of this.live.values()) chunk.img.setTexture(chunk.keys[Math.min(frame, chunk.keys.length - 1)]!);
  }

  destroy(): void {
    for (const chunk of this.live.values()) {
      for (const key of chunk.keys) this.scene.textures.remove(key);
      chunk.img.destroy();
    }
    this.live.clear();
    this.span = '';
  }

  private build(cx: number, cy: number): Chunk {
    const tx0 = cx * CHUNK;
    const ty0 = cy * CHUNK;
    const tw = Math.min(CHUNK, this.tilesW - tx0);
    const th = Math.min(CHUNK, this.tilesH - ty0);
    const keys: string[] = [];
    const make = (frame: number): boolean => {
      const key = `ground-c${cx}x${cy}-${frame}`;
      const tex = this.scene.textures.createCanvas(key, tw * this.unit * this.density, th * this.unit * this.density);
      if (!tex) throw new Error(`no canvas for ${key}`);
      keys.push(key);
      const animated = this.paint(tex, frame, tx0, ty0, tw, th);
      tex.refresh();
      return animated;
    };
    const animated = make(0);
    if (animated) for (let f = 1; f < this.frames; f++) make(f);
    const img = this.scene.add
      .image(tx0 * this.unit, ty0 * this.unit, keys[Math.min(this.frame, keys.length - 1)]!)
      .setOrigin(0)
      .setScale(1 / this.density)
      .setDepth(this.depth);
    return { img, keys };
  }
}
