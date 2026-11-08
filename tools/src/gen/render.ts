/**
 * The picture of a generated land at phone size (390 by 844): the whole land from above at a few pixels a tile,
 * then two windows drawn with the kit's own tiles and props, one on the clearing and one on a hidden door, each
 * marked on the overview; the land below gets the same frame, dark (`renderBelow`). No text: the measure is printed beside it. The kit art is read once and scaled with
 * nearest neighbour; a prop stands bottom-centred on its tile at the kit's scale, the way the game draws it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { REPO_ROOT } from '../load';
import { G, type Land, type Tile } from './grid';
import type { Generated } from './land';
import { at, pick } from './rand';
import type { Spawn } from './spawn';

const KIT_DIR = join(REPO_ROOT, 'content', 'kit', 'core');
const WIDTH = 390;
const HEIGHT = 844;
const TILE = 12;
const WINDOW: Tile = [32, 17];

interface Img {
  width: number;
  height: number;
  data: Uint8Array;
}
interface SpriteDef {
  file: string;
  w: number;
  h: number;
  scale?: number;
  density?: number;
  frames?: number;
}

type RGB = readonly [number, number, number];
/** The overview's colour a letter. */
const COLOURS: Record<string, RGB> = {
  [G.meadow]: [116, 164, 74],
  [G.flowers]: [150, 180, 92],
  [G.grove]: [74, 124, 58],
  [G.forest]: [38, 82, 42],
  [G.water]: [62, 112, 172],
  [G.bank]: [198, 184, 130],
  [G.path]: [196, 164, 104],
  [G.bridge]: [150, 110, 62],
  [G.ruinFloor]: [142, 136, 126],
  [G.rubble]: [112, 106, 100],
  [G.mountain]: [122, 122, 128],
};
const MARKS: Record<string, RGB> = {
  cave: [255, 64, 220],
  ruin: [255, 255, 255],
  clearing: [255, 220, 60],
  entry: [80, 230, 255],
  spring: [120, 200, 255],
  lake: [120, 200, 255],
  arrival: [255, 64, 220],
  secret: [255, 220, 60],
  pool: [120, 200, 255],
};
/** The overview's colours below the ground: the rock near black, the floor a dim grey-brown, the water deep. */
const DARK_COLOURS: Record<string, RGB> = {
  [G.mountain]: [34, 32, 36],
  [G.ruinFloor]: [118, 108, 96],
  [G.rubble]: [80, 74, 70],
  [G.water]: [40, 70, 120],
  [G.bank]: [120, 110, 84],
};

class Canvas {
  readonly data: Uint8Array;
  /** The rectangle drawing is kept inside; the whole canvas until `clip` narrows it. */
  private clipRect: [number, number, number, number];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
    this.clipRect = [0, 0, width, height];
  }
  clip(x0: number, y0: number, w: number, h: number): void {
    this.clipRect = [x0, y0, x0 + w, y0 + h];
  }
  unclip(): void {
    this.clipRect = [0, 0, this.width, this.height];
  }
  fill(x0: number, y0: number, w: number, h: number, [r, g, b]: RGB): void {
    for (let y = Math.max(0, y0); y < Math.min(this.height, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.width, x0 + w); x++) {
        const i = (y * this.width + x) * 4;
        this.data[i] = r;
        this.data[i + 1] = g;
        this.data[i + 2] = b;
        this.data[i + 3] = 255;
      }
    }
  }
  box(x0: number, y0: number, w: number, h: number, c: RGB): void {
    this.fill(x0, y0, w, 1, c);
    this.fill(x0, y0 + h - 1, w, 1, c);
    this.fill(x0, y0, 1, h, c);
    this.fill(x0 + w - 1, y0, 1, h, c);
  }
  /** Draws a source rectangle scaled to a destination rectangle, nearest neighbour, alpha over. */
  blit(img: Img, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, shade = 256): void {
    const [cx0, cy0, cx1, cy1] = this.clipRect;
    for (let y = 0; y < dh; y++) {
      const py = dy + y;
      if (py < cy0 || py >= cy1) continue;
      const iy = sy + Math.floor((y * sh) / dh);
      for (let x = 0; x < dw; x++) {
        const px = dx + x;
        if (px < cx0 || px >= cx1) continue;
        const ix = sx + Math.floor((x * sw) / dw);
        const s = (iy * img.width + ix) * 4;
        const a = img.data[s + 3]!;
        if (a === 0) continue;
        const d = (py * this.width + px) * 4;
        for (let c = 0; c < 3; c++) {
          const v = (img.data[s + c]! * shade) >> 8;
          this.data[d + c] = a === 255 ? v : (v * a + this.data[d + c]! * (255 - a)) >> 8;
        }
        this.data[d + 3] = 255;
      }
    }
  }
  png(): Buffer {
    const png = new PNG({ width: this.width, height: this.height });
    png.data = Buffer.from(this.data);
    return PNG.sync.write(png, { colorType: 6 });
  }
}

class Kit {
  private readonly defs: Record<string, SpriteDef>;
  private readonly cache = new Map<string, Img>();
  constructor() {
    const kit = JSON.parse(readFileSync(join(KIT_DIR, 'kit.json'), 'utf8')) as { kit: { sprites: Record<string, SpriteDef> } };
    this.defs = kit.kit.sprites;
  }
  def(name: string): SpriteDef | undefined {
    return this.defs[name];
  }
  image(name: string): Img | undefined {
    const def = this.defs[name];
    if (!def) return undefined;
    let img = this.cache.get(name);
    if (!img) {
      const png = PNG.sync.read(readFileSync(join(KIT_DIR, def.file)));
      img = { width: png.width, height: png.height, data: new Uint8Array(png.data) };
      this.cache.set(name, img);
    }
    return img;
  }
}

/** The kit tile a ground letter is drawn with; the variant by the tile's own draw, so the ground is never a stamp. */
function groundSprite(gen: Generated, ch: string, x: number, y: number): string | undefined {
  const v = (base: string, variants: number) => {
    const n = pick(gen.seed, 'ground-variant', at(x, y), variants);
    return n === 0 ? base : `${base}_${n}`;
  };
  switch (ch) {
    case G.meadow:
      return v('tiles/grass', 4);
    case G.flowers:
      return 'tiles/grass_flowers';
    case G.grove:
      return v('tiles/grove', 3);
    case G.forest:
      return v('tiles/forest', 3);
    case G.water:
      return 'tiles/water';
    case G.bank:
      return v('tiles/sand', 3);
    case G.path:
      return v('tiles/path', 3);
    case G.bridge:
      return 'tiles/bridge';
    case G.ruinFloor:
      return 'tiles/ruin_floor';
    case G.rubble:
      return v('tiles/rubble', 4);
    case G.mountain:
      return v('tiles/rubble', 4);
    default:
      return undefined;
  }
}

function drawWindow(canvas: Canvas, kit: Kit, gen: Generated, centre: Tile, dx: number, dy: number, dark = false): void {
  const { land } = gen;
  const [ww, wh] = WINDOW;
  const x0 = Math.min(Math.max(land.x0, centre[0] - (ww >> 1)), land.x0 + land.w - ww);
  const y0 = Math.min(Math.max(land.y0, centre[1] - (wh >> 1)), land.y0 + land.h - wh);
  canvas.fill(dx, dy, ww * TILE, wh * TILE, [20, 20, 24]);
  for (let y = y0; y < y0 + wh; y++) {
    for (let x = x0; x < x0 + ww; x++) {
      const ch = land.get(x, y);
      const name = groundSprite(gen, ch, x, y);
      const img = name ? kit.image(name) : undefined;
      const def = name ? kit.def(name) : undefined;
      const px = dx + (x - x0) * TILE;
      const py = dy + (y - y0) * TILE;
      const lv = Math.min(3, land.level(x, y));
      // below the ground the rock is near black and the floor lit only by what glows: the lamp's reach is the client's
      const shade = dark ? (ch === G.mountain ? 48 : 120) : ch === G.mountain ? 236 : 200 + lv * 18;
      if (img && def) canvas.blit(img, 0, 0, def.w, def.h, px, py, TILE, TILE, shade);
      else canvas.fill(px, py, TILE, TILE, (dark ? DARK_COLOURS[ch] : undefined) ?? COLOURS[ch] ?? [255, 0, 255]);
      // a dark lip where the ground drops to the south or the east: the terrace reads
      if (land.inside(x, y + 1) && land.level(x, y + 1) < land.level(x, y)) canvas.fill(px, py + TILE - 2, TILE, 2, [30, 26, 20]);
      if (land.inside(x + 1, y) && land.level(x + 1, y) < land.level(x, y)) canvas.fill(px + TILE - 2, py, 2, TILE, [30, 26, 20]);
    }
  }
  const props = land.props.filter((p) => p.x >= x0 - 2 && p.x < x0 + ww + 2 && p.y >= y0 && p.y < y0 + wh + 3).sort((a, b) => a.y - b.y || a.x - b.x);
  canvas.clip(dx, dy, ww * TILE, wh * TILE);
  for (const p of props) {
    const name = p.sprite.split(':')[1]!;
    const def = kit.def(name);
    const img = kit.image(name);
    if (!def || !img) continue;
    const density = def.density ?? 1;
    const scale = def.scale ?? 1;
    const pw = Math.max(2, Math.round(((def.w / density) * scale * TILE) / 16));
    const ph = Math.max(2, Math.round(((def.h / density) * scale * TILE) / 16));
    const cx = dx + (p.x - x0) * TILE + (TILE >> 1);
    const bottom = dy + (p.y - y0 + 1) * TILE;
    canvas.blit(img, 0, 0, def.w, def.h, cx - (pw >> 1), bottom - ph, pw, ph, dark && !name.includes('glow') ? 150 : 255);
  }
  canvas.unclip();
  for (const m of land.marks) {
    if (m.x < x0 || m.x >= x0 + ww || m.y < y0 || m.y >= y0 + wh) continue;
    if (m.kind !== 'cave' && m.kind !== 'entry' && m.kind !== 'arrival' && m.kind !== 'secret') continue;
    canvas.box(dx + (m.x - x0) * TILE - 2, dy + (m.y - y0) * TILE - 2, TILE + 4, TILE + 4, MARKS[m.kind]!);
  }
  canvas.box(dx - 1, dy - 1, ww * TILE + 2, wh * TILE + 2, [90, 90, 96]);
}

function drawOverview(canvas: Canvas, land: Land, dx: number, dy: number, s: number, windows: readonly Tile[], dark = false): void {
  for (let y = land.y0; y < land.y0 + land.h; y++) {
    for (let x = land.x0; x < land.x0 + land.w; x++) {
      const ch = land.get(x, y);
      const [r, g, b] = (dark ? DARK_COLOURS[ch] : undefined) ?? COLOURS[ch] ?? [255, 0, 255];
      const lv = Math.min(3, land.level(x, y));
      const k = ch === G.mountain ? 70 + lv * 6 : 82 + lv * 8;
      canvas.fill(dx + (x - land.x0) * s, dy + (y - land.y0) * s, s, s, [(r * k) / 100, (g * k) / 100, (b * k) / 100]);
    }
  }
  for (const m of land.marks) {
    const c = MARKS[m.kind];
    if (!c || m.kind === 'lake' || m.kind === 'spring' || m.kind === 'pool') continue;
    const r = m.kind === 'cave' || m.kind === 'arrival' ? 3 : 2;
    canvas.fill(dx + (m.x - land.x0) * s - r, dy + (m.y - land.y0) * s - r, 2 * r + s, 2 * r + s, c);
  }
  for (const [wx, wy] of windows) {
    const [ww, wh] = WINDOW;
    const x0 = Math.min(Math.max(land.x0, wx - (ww >> 1)), land.x0 + land.w - ww);
    const y0 = Math.min(Math.max(land.y0, wy - (wh >> 1)), land.y0 + land.h - wh);
    canvas.box(dx + (x0 - land.x0) * s, dy + (y0 - land.y0) * s, ww * s, wh * s, [255, 255, 255]);
  }
}

/** The two windows: the clearing, and a cave mouth (or a ruin, or the first road in, when the story has none). */
export function focusTiles(gen: Generated): [Tile, Tile] {
  const { land } = gen;
  const find = (kind: string) => land.marks.find((m) => m.kind === kind);
  const a = find('clearing') ?? { x: land.x0 + (land.w >> 1), y: land.y0 + (land.h >> 1) };
  const b = find('cave') ?? find('ruin') ?? find('entry') ?? a;
  return [
    [a.x, a.y],
    [b.x, b.y],
  ];
}

const DANGER_COLOURS: readonly RGB[] = [
  [240, 236, 200],
  [255, 160, 40],
  [255, 60, 60],
];

/** The creatures on the overview: a dot a spot, coloured by the kind's danger; a rare a white ring, a boss a red one. */
function drawSpawns(canvas: Canvas, land: Land, spawns: readonly Spawn[], dx: number, dy: number, s: number, dangerOf: (s: Spawn) => number): void {
  for (const sp of spawns) {
    const px = dx + (sp.x - land.x0) * s;
    const py = dy + (sp.y - land.y0) * s;
    const c = DANGER_COLOURS[dangerOf(sp)] ?? DANGER_COLOURS[0]!;
    canvas.fill(px, py, Math.max(2, s), Math.max(2, s), c);
    if (sp.rank === 'rare') canvas.box(px - 2, py - 2, s + 4, s + 4, [255, 255, 255]);
    if (sp.rank === 'boss') canvas.box(px - 3, py - 3, s + 6, s + 6, [255, 40, 40]);
    if (sp.shape === 'camp') canvas.box(px - 2, py - 2, s + 4, s + 4, [255, 200, 60]);
  }
}

export function render(gen: Generated, spawns: readonly Spawn[] = [], dangerOf: (s: Spawn) => number = (s) => Math.min(2, s.danger)): Buffer {
  return draw(gen, focusTiles(gen), spawns, dangerOf, false);
}

/** The land below in the same frame: its overview dark, a window on the first way up and one on the pool or a secret. */
export function renderBelow(gen: Generated): Buffer | undefined {
  if (!gen.below) return undefined;
  const land = gen.below.land;
  const find = (kind: string) => land.marks.find((m) => m.kind === kind);
  const a = find('arrival') ?? { x: land.x0 + (land.w >> 1), y: land.y0 + (land.h >> 1) };
  // the second window far from the first: the farthest secret, else the farthest other way up, else the pool
  const far = (kind: string) => land.marks.filter((m) => m.kind === kind).sort((m, n) => Math.abs(n.x - a.x) + Math.abs(n.y - a.y) - (Math.abs(m.x - a.x) + Math.abs(m.y - a.y)))[0];
  const b = far('secret') ?? land.marks.find((m) => m.kind === 'arrival' && (m.x !== a.x || m.y !== a.y)) ?? find('pool') ?? a;
  return draw({ ...gen, land }, [[a.x, a.y], [b.x, b.y]], [], () => 0, true);
}

function draw(gen: Generated, windows: readonly Tile[], spawns: readonly Spawn[], dangerOf: (s: Spawn) => number, dark: boolean): Buffer {
  const canvas = new Canvas(WIDTH, HEIGHT);
  canvas.fill(0, 0, WIDTH, HEIGHT, [28, 28, 32]);
  const { land } = gen;
  const s = Math.max(1, Math.min(3, Math.floor(386 / Math.max(land.w, land.h))));
  const ox = (WIDTH - land.w * s) >> 1;
  drawOverview(canvas, land, ox, 8, s, windows, dark);
  drawSpawns(canvas, land, spawns, ox, 8, s, dangerOf);
  let y = 8 + land.h * s + 12;
  const kit = new Kit();
  const wx = (WIDTH - WINDOW[0] * TILE) >> 1;
  for (const centre of windows) {
    if (y + WINDOW[1] * TILE > HEIGHT) break;
    drawWindow(canvas, kit, gen, centre, wx, y, dark);
    y += WINDOW[1] * TILE + 12;
  }
  return canvas.png();
}
