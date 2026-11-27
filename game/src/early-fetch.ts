/**
 * The painted land's pictures fetched from the moment its scene file is read, before the game boots (V5b): they used to wait in the boot loader's queue behind every kit
 * sprite, so their first byte came at 8.5 s on a phone's Fast 4G. A few at a time, so the kit's small files keep the rest of the connections; each is decoded as it lands.
 * The boot scene skips these keys in its loader and adds the decoded pictures as textures before the world starts.
 */

export interface EarlyPort<B, I> {
  fetch(url: string): Promise<B>;
  decode(blob: B): Promise<I>;
}

/** how many pictures are fetched at once: a phone keeps six connections to one host on HTTP/1.1, and the kit's many small files take the rest */
export const EARLY_AT_ONCE = 2;

export class EarlyImages<B, I> {
  private readonly done = new Map<string, Promise<I>>();
  private readonly queue: { key: string; url: string; resolve: (i: I) => void; reject: (e: unknown) => void }[] = [];
  private running = 0;
  constructor(
    private readonly port: EarlyPort<B, I>,
    private readonly atOnce = EARLY_AT_ONCE,
  ) {}

  /** Queues the pictures in the order given (what the first frame needs first). */
  want(items: readonly { key: string; url: string }[]): void {
    for (const { key, url } of items) {
      if (this.done.has(key)) continue;
      this.done.set(
        key,
        new Promise<I>((resolve, reject) => {
          this.queue.push({ key, url, resolve, reject });
        }),
      );
    }
    this.pump();
  }

  has(key: string): boolean {
    return this.done.has(key);
  }

  keys(): string[] {
    return [...this.done.keys()];
  }

  /** The decoded picture of a key asked for, or undefined if it was never asked. */
  get(key: string): Promise<I> | undefined {
    return this.done.get(key);
  }

  private pump(): void {
    while (this.running < this.atOnce && this.queue.length) {
      const job = this.queue.shift()!;
      this.running++;
      this.port
        .fetch(job.url)
        .then((b) => this.port.decode(b))
        .then(job.resolve, job.reject)
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }
}

/** The browser's port: a fetch at high priority, decoded off the main thread by the image element. */
export const BROWSER_EARLY: EarlyPort<Blob, HTMLImageElement> = {
  async fetch(url) {
    const res = await fetch(url, { priority: 'high' } as RequestInit);
    if (!res.ok) throw new Error(`early fetch: ${url} answered ${res.status}`);
    return res.blob();
  },
  async decode(blob) {
    const img = new Image();
    const src = URL.createObjectURL(blob);
    img.src = src;
    try {
      await img.decode();
    } finally {
      // the decoded picture stays with the element; the blob's address is no longer needed
      URL.revokeObjectURL(src);
    }
    return img;
  },
};
