/**
 * The kit's sprites from a few atlas sheets (tools/src/kit/atlas.ts, public #919): fetched from behind the title while the engine downloads, then every sprite cut back
 * into a canvas of its own and added under its own key, so the world reads each sprite as before. Without `kit/atlas.json` (a build without it, or `?loose`) the boot
 * loads the loose files one by one.
 */

export interface AtlasRect {
  s: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasFile {
  format: 1;
  sheets: { file: string; w: number; h: number }[];
  rects: Record<string, AtlasRect>;
}

/** One sheet fetched at high priority and decoded off the main thread by the image element. Its own few lines: the page's entry must not reach the painted land's fetcher (painted-dark.test.ts). */
async function sheetImage(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { priority: 'high' } as RequestInit);
  if (!res.ok) throw new Error(`kit atlas: ${url} answered ${res.status}`);
  const src = URL.createObjectURL(await res.blob());
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } finally {
    URL.revokeObjectURL(src);
  }
  return img;
}

export class KitAtlas {
  /** every sheet at once from the start: there are only a few, and the boot needs them all before the world starts */
  readonly sheets: Promise<HTMLImageElement>[];
  constructor(readonly file: AtlasFile) {
    this.sheets = file.sheets.map((s) => sheetImage(s.file));
    // a sheet that fails is told once by the boot's cut; this keeps the page from an unhandled rejection meanwhile
    for (const p of this.sheets) p.catch(() => undefined);
  }

  /** whether a sprite's file is in a sheet */
  holds(url: string): boolean {
    return url in this.file.rects;
  }

  /** the sheet a sprite's file lies in, or -1 */
  sheetOf(url: string): number {
    return this.file.rects[url]?.s ?? -1;
  }

  /** The sprite's own pixels cut out of its sheet, once the sheet has landed. */
  async cut(url: string): Promise<HTMLCanvasElement> {
    const r = this.file.rects[url];
    if (!r) throw new Error(`kit atlas: ${url} is in no sheet`);
    const sheet = await this.sheets[r.s]!;
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return c;
  }
}

/** Reads `kit/atlas.json` and starts its sheets, or undefined when the build has none. */
export async function kitAtlasOf(search: string): Promise<KitAtlas | undefined> {
  if (new URLSearchParams(search).has('loose')) return undefined;
  try {
    const res = await fetch('kit/atlas.json');
    if (!res.ok) return undefined;
    const file = (await res.json()) as AtlasFile;
    return file.format === 1 ? new KitAtlas(file) : undefined;
  } catch {
    return undefined;
  }
}
