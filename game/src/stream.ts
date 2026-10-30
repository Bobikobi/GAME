/**
 * Chunk streaming in the classic client (NEXT 19 d). A world chunk is 64 by 64 tiles, the unit the map is stored and
 * streamed in; a bake page is 16 by 16 tiles, the unit the ground is baked into (groundchunks.ts, NEXT 15). The stream
 * holds the 3 by 3 world chunks around the player's, drops the ones beyond one ring when the player crosses a border,
 * and never holds more than nine. Its pages are baked in idle slices, so a walk across a border never blocks a frame.
 *
 * The seam is under the mist: the edge of the held window is at least one whole chunk (64 tiles) from the player, and
 * the mist is solid 11 tiles out (MIST.clear + MIST.ramp), so a page that is not held is never on screen.
 */

/** Tiles on a world chunk's side. */
export const WORLD_CHUNK = 64;
/** Chunks held around the player's, each way. */
export const STREAM_RING = 1;
/** The most chunks the stream ever holds: (2 * ring + 1) squared. */
export const MAX_HELD = (2 * STREAM_RING + 1) ** 2;

/** The world chunk a tile is in; the world has no end, so a negative tile has a chunk too. */
export function chunkOfTile(t: number): number {
  return Math.floor(t / WORLD_CHUNK);
}

/** The id of a world chunk. */
export const chunkId = (cx: number, cy: number): string => `${cx},${cy}`;

/** Whether the tile is inside the 3 by 3 window around the player's chunk. */
export function inWindow(at: { cx: number; cy: number }, tx: number, ty: number): boolean {
  return Math.abs(chunkOfTile(tx) - at.cx) <= STREAM_RING && Math.abs(chunkOfTile(ty) - at.cy) <= STREAM_RING;
}

export interface StreamStep {
  loaded: string[];
  dropped: string[];
}

/**
 * The window of world chunks. `load` returns the chunk, or nothing where the world has none yet (the mist stands
 * there); what it returns is held, and `drop` is told when it leaves.
 */
export class ChunkStream<C> {
  private readonly held = new Map<string, C>();
  private at: { cx: number; cy: number } | undefined;
  private most = 0;

  constructor(
    private readonly load: (cx: number, cy: number) => C | undefined,
    private readonly drop: (cx: number, cy: number, chunk: C) => void = () => undefined,
  ) {}

  /** How many chunks are held now. */
  get count(): number {
    return this.held.size;
  }

  /** The most chunks held at any moment since the start. */
  get peak(): number {
    return this.most;
  }

  /** The player's chunk, once known. */
  get centre(): { cx: number; cy: number } | undefined {
    return this.at;
  }

  has(cx: number, cy: number): boolean {
    return this.held.has(chunkId(cx, cy));
  }

  get(cx: number, cy: number): C | undefined {
    return this.held.get(chunkId(cx, cy));
  }

  /** Whether a tile is on a held chunk. */
  holds(tx: number, ty: number): boolean {
    return this.held.has(chunkId(chunkOfTile(tx), chunkOfTile(ty)));
  }

  /** The player is on this tile. Cheap while it stays in one chunk; on a crossing the far side goes first, then the new side comes. */
  update(tx: number, ty: number): StreamStep {
    const cx = chunkOfTile(tx);
    const cy = chunkOfTile(ty);
    const step: StreamStep = { loaded: [], dropped: [] };
    if (this.at && this.at.cx === cx && this.at.cy === cy) return step;
    this.at = { cx, cy };
    for (const [id, chunk] of this.held) {
      const [hx, hy] = id.split(',').map(Number) as [number, number];
      if (Math.abs(hx - cx) <= STREAM_RING && Math.abs(hy - cy) <= STREAM_RING) continue;
      this.held.delete(id);
      this.drop(hx, hy, chunk);
      step.dropped.push(id);
    }
    for (let y = cy - STREAM_RING; y <= cy + STREAM_RING; y++) {
      for (let x = cx - STREAM_RING; x <= cx + STREAM_RING; x++) {
        const id = chunkId(x, y);
        if (this.held.has(id)) continue;
        const chunk = this.load(x, y);
        if (chunk === undefined) continue;
        this.held.set(id, chunk);
        step.loaded.push(id);
        this.most = Math.max(this.most, this.held.size);
        if (this.held.size > MAX_HELD) throw new Error(`the stream holds ${this.held.size} chunks, over ${MAX_HELD}`);
      }
    }
    return step;
  }

  destroy(): void {
    for (const [id, chunk] of this.held) {
      const [hx, hy] = id.split(',').map(Number) as [number, number];
      this.drop(hx, hy, chunk);
    }
    this.held.clear();
    this.at = undefined;
  }
}

/** What an idle callback is given: how long the slice has left. */
export interface Slice {
  timeRemaining(): number;
  /** true when the browser ran the callback only because its timeout was up, not because it was idle */
  didTimeout?: boolean;
}

/** Runs `run` in the next idle slice; `timeout` ms is the longest it may wait. */
export type IdleRunner = (run: (slice: Slice) => void, timeout?: number) => void;

/** The longest a waiting page waits for an idle slice, ms. */
export const IDLE_TIMEOUT = 120;

/** The browser's idle callback, or a timer that gives a slice of a frame's half where there is none. */
export const idleSlice: IdleRunner = (run, timeout = IDLE_TIMEOUT) => {
  const w = globalThis as { requestIdleCallback?: (cb: (d: Slice) => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) {
    // the timeout keeps a walk that never idles from starving the bake
    w.requestIdleCallback(run, { timeout });
    return;
  }
  setTimeout(() => {
    const start = performance.now();
    run({ timeRemaining: () => Math.max(0, 8 - (performance.now() - start)), didTimeout: true });
  }, 0);
};

/**
 * Jobs run in idle slices, one page at a time: a slice runs a job only while its remaining time is more than the
 * last job took (the first page of a queue has no last, and a timed-out slice runs one regardless), so a slice stays
 * inside the frame it was given. A job queued under a key replaces the one waiting.
 */
export class IdleQueue {
  private readonly jobs = new Map<string, () => void>();
  private armed = false;
  /** when the oldest waiting job began to wait, so a declined slice does not restart its timeout */
  private since = 0;
  private last = 0;
  private worst = 0;

  constructor(
    private readonly idle: IdleRunner = idleSlice,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get pending(): number {
    return this.jobs.size;
  }

  /** The longest single job so far, in ms. */
  get longest(): number {
    return this.worst;
  }

  push(key: string, job: () => void): void {
    if (this.jobs.size === 0 && !this.armed) this.since = this.now();
    this.jobs.set(key, job);
    this.arm();
  }

  keys(): IterableIterator<string> {
    return this.jobs.keys();
  }

  cancel(key: string): void {
    this.jobs.delete(key);
  }

  clear(): void {
    this.jobs.clear();
  }

  /** Runs every waiting job now, for a caller that cannot wait (a first frame, a test). */
  flush(): void {
    for (const [key, job] of this.jobs) {
      this.jobs.delete(key);
      this.time(job);
    }
  }

  private arm(): void {
    if (this.armed || this.jobs.size === 0) return;
    this.armed = true;
    const wait = this.now() - this.since;
    this.idle((slice) => {
      this.armed = false;
      // a slice shorter than the last page waits for a longer one, unless the timeout says the bake has waited enough
      if (!slice.didTimeout && slice.timeRemaining() < this.last) {
        this.arm();
        return;
      }
      this.since = this.now();
      do {
        const next = this.jobs.entries().next();
        if (next.done) break;
        this.jobs.delete(next.value[0]);
        this.time(next.value[1]);
      } while (this.jobs.size > 0 && slice.timeRemaining() > this.last);
      this.arm();
    }, Math.max(1, IDLE_TIMEOUT - wait));
  }

  private time(job: () => void): void {
    const t = this.now();
    job();
    this.last = this.now() - t;
    this.worst = Math.max(this.worst, this.last);
  }
}
