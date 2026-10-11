/**
 * The three starter looks, derived from the base character sheets.
 *
 * DECISIONS 2026-10-09 "Each player role reads at a glance": one big item, one colour
 * and its own build per role, over the same patched base clothes.
 *   explorer  tall and lean   wide-brimmed straw hat, tall backpack, moss-green blanket roll
 *   forager   short and slight  large wicker basket, rust-red neckerchief and basket lining
 *   digger    broad, heavy-set  indigo cap, spade strapped across the back
 *
 * Each role gets a man and a woman (`<role>_*` and `<role>_w_*`), in walk, idle and work
 * sheets, four directions (right is the left sheet, mirrored by the game). The build is a
 * handful of rows and columns taken out of or copied into the base frame; the item is a
 * grid of palette letters laid on a spot found on the body, so it follows every frame.
 *
 *   pnpm exec tsx tools/src/kit/roles.ts        # rewrites the PNGs and kit.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import { CORE_PALETTE, hexToRgb } from './palette.js';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '../../../content/kit/core');
// palette letters: 0-9 then a-v, in the order of CORE_PALETTE
const LETTERS = '0123456789abcdefghijklmnopqrstuv';
const RGB = CORE_PALETTE.map(hexToRgb);

const HAIR = [11, 21]; // b, l
const TUNIC = 13; // d

interface Frame {
  w: number;
  h: number;
  px: number[]; // palette index, -1 clear
}

function readSheet(file: string, fw: number, fh: number): Frame[] {
  const png = PNG.sync.read(readFileSync(join(KIT, 'chars', file)));
  const frames: Frame[] = [];
  for (let f = 0; f < png.width / fw; f++) {
    const px: number[] = [];
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const i = ((y * png.width) + f * fw + x) * 4;
        if (png.data[i + 3] === 0) { px.push(-1); continue; }
        const idx = RGB.findIndex((c) => c[0] === png.data[i] && c[1] === png.data[i + 1] && c[2] === png.data[i + 2]);
        if (idx < 0) throw new Error(`${file}: colour outside the palette`);
        px.push(idx);
      }
    }
    frames.push({ w: fw, h: fh, px });
  }
  return frames;
}

function writeSheet(file: string, frames: Frame[]): void {
  const { w, h } = frames[0]!;
  const png = new PNG({ width: w * frames.length, height: h });
  png.data.fill(0);
  frames.forEach((fr, f) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = fr.px[y * w + x]!;
        if (v < 0) continue;
        const i = (y * png.width + f * w + x) * 4;
        png.data[i] = RGB[v]![0];
        png.data[i + 1] = RGB[v]![1];
        png.data[i + 2] = RGB[v]![2];
        png.data[i + 3] = 255;
      }
    }
  });
  writeFileSync(join(KIT, 'chars', file), PNG.sync.write(png));
}

interface Build {
  /** rows to take out, counted up from the feet */
  cutRows: number[];
  /** columns to take out, counted from the frame centre (0 is the column right of centre) */
  cutCols: number[];
  /** columns to copy once more, same counting */
  dupCols: number[];
}

interface Built {
  frame: Frame;
  mapX: (x: number) => number;
  mapY: (y: number) => number;
}

function build(fr: Frame, b: Build): Built {
  const { w, h } = fr;
  let feet = h - 1;
  while (feet > 0 && fr.px.slice(feet * w, feet * w + w).every((v) => v < 0)) feet--;
  const out: Frame = { w, h, px: new Array<number>(w * h).fill(-1) };
  const cut = new Set(b.cutRows.map((o) => feet - o));
  let n = 0;
  for (let y = feet; y >= 0; y--) {
    if (cut.has(y)) continue;
    const ny = feet - n++;
    for (let x = 0; x < w; x++) out.px[ny * w + x] = fr.px[y * w + x]!;
  }
  const c = w / 2;
  const src: number[] = [];
  for (let x = 0; x < w; x++) {
    const rel = x - c;
    if (b.cutCols.includes(rel)) continue;
    src.push(x);
    if (b.dupCols.includes(rel)) src.push(x);
  }
  const shift = Math.floor((w - src.length) / 2); // pad, or crop the clear ends
  const res: Frame = { w, h, px: new Array<number>(w * h).fill(-1) };
  for (let x = 0; x < w; x++) {
    const s = src[x - shift];
    if (s === undefined) continue;
    for (let y = 0; y < h; y++) res.px[y * w + x] = out.px[y * w + s]!;
  }
  return {
    frame: res,
    mapY: (y) => y + [...cut].filter((r) => r > y && r <= feet).length,
    mapX: (x) => {
      const j = src.findIndex((v) => v >= x);
      return (j < 0 ? src.length : j) + shift;
    },
  };
}

interface Item {
  anchor: 'head' | 'torso';
  layer: 'back' | 'front';
  /** row of the first grid line, counted from the anchor row */
  dy: number;
  /** column of the grid's middle, counted from the anchor column */
  dx?: number;
  grid: string[];
}

interface Anchors {
  hairRow: number;
  headX: number;
  torsoRow: number;
  torsoX: number;
}

function anchors(fr: Frame): Anchors {
  const { w, h, px } = fr;
  let hairRow = 0;
  find: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (HAIR.includes(px[y * w + x]!)) { hairRow = y; break find; }
  let sx = 0;
  let sn = 0;
  for (let y = hairRow; y < hairRow + 3; y++) for (let x = 0; x < w; x++) if (HAIR.includes(px[y * w + x]!)) { sx += x; sn++; }
  const headX = sn ? Math.round(sx / sn) : w / 2;
  let torsoRow = hairRow + 7;
  for (let y = hairRow + 4; y < h; y++) {
    let k = 0;
    for (let x = 0; x < w; x++) if (px[y * w + x] === TUNIC) k++;
    if (k >= 2) { torsoRow = y; break; }
  }
  let tx = 0;
  let tn = 0;
  for (let y = torsoRow; y < torsoRow + 4; y++) for (let x = 0; x < w; x++) if (px[y * w + x] === TUNIC) { tx += x; tn++; }
  return { hairRow, headX, torsoRow, torsoX: tn ? Math.round(tx / tn) : headX };
}

function lay(fr: Frame, items: Item[], at?: Anchors): Frame {
  const a = at ?? anchors(fr);
  const out: Frame = { ...fr, px: [...fr.px] };
  const draw = (item: Item, onlyClear: boolean) => {
    const ax = item.anchor === 'head' ? a.headX : a.torsoX;
    const ay = item.anchor === 'head' ? a.hairRow : a.torsoRow;
    const mid = Math.floor(item.grid[0]!.length / 2);
    item.grid.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        const ch = row[gx]!;
        if (ch === '.') continue;
        const x = ax + (item.dx ?? 0) + gx - mid;
        const y = ay + item.dy + gy;
        if (x < 0 || y < 0 || x >= fr.w || y >= fr.h) continue;
        if (onlyClear && out.px[y * fr.w + x]! >= 0) continue;
        out.px[y * fr.w + x] = LETTERS.indexOf(ch);
      }
    });
  };
  for (const it of items) if (it.layer === 'back') draw(it, true);
  for (const it of items) if (it.layer === 'front') draw(it, false);
  return out;
}

type View = 'down' | 'left' | 'up';

interface Role {
  id: string;
  build: Build;
  items: Record<View, Item[]>;
}

// letters: 0 outline, 2/3/4 grey, 6-9 moss green, b-d browns, e/f straw,
// g-j indigo, l-o rust red, p-r amber, s skin
const HAT: string[] = [
  '....00000....',
  '...0eefee0...',
  '...0777770...',
  '0eeeeeeeeeee0',
  '.0ccccccccc0.',
];

const explorer: Role = {
  id: 'explorer',
  build: { cutRows: [], cutCols: [0], dupCols: [] },
  items: {
    down: [
      { anchor: 'head', layer: 'front', dy: -2, grid: HAT },
      {
        anchor: 'torso', layer: 'back', dy: -4,
        grid: [
          '..0777777777..',
          '.078888888870.',
          '.077777777770.',
          '.0cccccccccc0.',
          '0dddddddddddd0',
          '0dddddddddddd0',
          '0dddddddddddd0',
          '.0cccccccccc0.',
          '..0000000000..',
        ],
      },
      { anchor: 'torso', layer: 'front', dy: 0, grid: ['.c.....c.', '.c.....c.', '.c.....c.', '.c.....c.'] },
    ],
    left: [
      { anchor: 'head', layer: 'front', dy: -2, dx: -1, grid: HAT },
      {
        anchor: 'torso', layer: 'front', dy: -3, dx: 4,
        grid: [
          '.0777.',
          '078887',
          '077770',
          '0cccc0',
          '0dddd0',
          '0dddd0',
          '0dddd0',
          '0dddd0',
          '0dddd0',
          '.0cc0.',
          '..00..',
        ],
      },
    ],
    up: [
      { anchor: 'head', layer: 'front', dy: -2, grid: HAT },
      {
        anchor: 'torso', layer: 'front', dy: -1,
        grid: [
          '..0777770..',
          '.078888870.',
          '.077777770.',
          '0ccccccccc0',
          '0ddddddddd0',
          '0dcdddddcd0',
          '0ddddddddd0',
          '0ddddddddd0',
          '.0ccccccc0.',
          '..0000000..',
        ],
      },
    ],
  },
};

const BASKET_FRONT: string[] = [
  '..0mnnnnnm0..',
  '.0ecececece0.',
  '0ececececece0',
  '0cececececec0',
  '0ececececece0',
  '.0ecececece0.',
  '..0ccccccc0..',
];

const forager: Role = {
  id: 'forager',
  build: { cutRows: [15, 13, 11, 9], cutCols: [0, 3], dupCols: [] },
  items: {
    down: [
      { anchor: 'torso', layer: 'back', dy: -4, grid: BASKET_FRONT },
      { anchor: 'torso', layer: 'front', dy: -1, grid: ['0mnnnm0', '.0mnm0.', '..0m0..'] },
    ],
    left: [
      {
        anchor: 'torso', layer: 'front', dy: -3, dx: 4,
        grid: ['0mnnnm0', '0ecece0', '0cecec0', '0ecece0', '0cecec0', '0ecece0', '.0ccc0.', '..000..'],
      },
      { anchor: 'torso', layer: 'front', dy: -1, dx: -1, grid: ['.0mnm0', '..0m0.'] },
    ],
    up: [
      {
        anchor: 'torso', layer: 'front', dy: -2,
        grid: [
          '.0mmnnnmm0.',
          '0ecececece0',
          '0cecececec0',
          '0ecececece0',
          '0cecececec0',
          '0ecececece0',
          '.0ccccccc0.',
          '..0000000..',
        ],
      },
    ],
  },
};

const digger: Role = {
  id: 'digger',
  build: { cutRows: [10], cutCols: [], dupCols: [-3, 2] },
  items: {
    down: [
      {
        anchor: 'head', layer: 'front', dy: -1,
        grid: ['...00000...', '..0hhhhh0..', '.0hiihhhh0.', '.0hhhhhhh0.', '..0ggggg0..'],
      },
      {
        anchor: 'torso', layer: 'front', dy: -4,
        grid: [
          '.......033.',
          '......03440',
          '......03330',
          '.......0c0.',
          '.hh..0c.0..',
          '..hh.c.....',
          '...hhh.....',
          '....hhh....',
          '.....hhh...',
        ],
      },
    ],
    left: [
      {
        anchor: 'head', layer: 'front', dy: -1, dx: -1,
        grid: ['...00000...', '..0hhhhh0..', '.0hhhhhhh0.', '0ggggggg0..', '.0000000...'],
      },
      {
        anchor: 'torso', layer: 'front', dy: -5, dx: 3,
        grid: [
          '.033.',
          '03440',
          '03330',
          '.0c0.',
          '.0c0.',
          '0c0..',
          'c0...',
        ],
      },
      { anchor: 'torso', layer: 'front', dy: 1, dx: 0, grid: ['.hhh.', '..hhh'] },
    ],
    up: [
      {
        anchor: 'head', layer: 'front', dy: -1,
        grid: ['...00000...', '..0hhhhh0..', '.0hhhhhhh0.', '.0hhhhhhh0.', '..0hhhhh0..'],
      },
      {
        anchor: 'torso', layer: 'front', dy: -4,
        grid: [
          '.......033.',
          '......03440',
          '......03330',
          '.....0c0...',
          '....0c0....',
          '...0c0.....',
          '..0c0......',
          '.0c0.......',
          '0c0........',
        ],
      },
      { anchor: 'torso', layer: 'front', dy: 0, grid: ['hh........', '.hh.......', '..hh......', '...hh.....', '....hh....', '.....hh...'] },
    ],
  },
};

/**
 * Where the head and the torso are in the base work frames, read off the sheets
 * (the raised arms and the tool hide the colours the walk frames are found by).
 */
const WORK_AT: Record<View, Anchors[]> = {
  down: [{ hairRow: 3, headX: 9, torsoRow: 14, torsoX: 15 }, { hairRow: 3, headX: 12, torsoRow: 15, torsoX: 13 }],
  left: [{ hairRow: 6, headX: 8, torsoRow: 11, torsoX: 14 }, { hairRow: 3, headX: 12, torsoRow: 13, torsoX: 15 }],
  up: [{ hairRow: 5, headX: 16, torsoRow: 13, torsoX: 16 }, { hairRow: 5, headX: 12, torsoRow: 13, torsoX: 14 }],
};

export const ROLES: Role[] = [explorer, forager, digger];

interface SheetPlan {
  suffix: string;
  fw: number;
  fh: number;
  view: View;
  /** the base sheet for each look */
  man: string;
  woman: string;
}

const SHEETS: SheetPlan[] = [];
for (const view of ['down', 'left', 'up'] as View[]) {
  SHEETS.push({ suffix: view, fw: 16, fh: 24, view, man: `player_${view}.png`, woman: `woman_${view}.png` });
  SHEETS.push({ suffix: `idle_${view}`, fw: 16, fh: 24, view, man: `player_idle_${view}.png`, woman: `woman_idle_${view}.png` });
  // the base has no woman work pose to the side or back: the man's pose is used, the item over it is the role's
  SHEETS.push({ suffix: `work_${view}`, fw: 32, fh: 32, view, man: `player_work_${view}.png`, woman: view === 'down' ? 'woman_work_down.png' : `player_work_${view}.png` });
}

export function makeAll(): string[] {
  const names: string[] = [];
  for (const role of ROLES) {
    for (const look of ['man', 'woman'] as const) {
      for (const s of SHEETS) {
        const frames = readSheet(look === 'man' ? s.man : s.woman, s.fw, s.fh).map((fr, i) => {
          const built = build(fr, role.build);
          const base = s.suffix.startsWith('work_') ? WORK_AT[s.view][i] : undefined;
          const at = base && {
            hairRow: built.mapY(base.hairRow),
            headX: built.mapX(base.headX),
            torsoRow: built.mapY(base.torsoRow),
            torsoX: built.mapX(base.torsoX),
          };
          return lay(built.frame, role.items[s.view], at);
        });
        const stem = look === 'man' ? role.id : `${role.id}_w`;
        const name = `${stem}_${s.suffix}`;
        writeSheet(`${name}.png`, frames);
        names.push(`${name}|${s.fw}|${s.fh}|${frames.length}`);
      }
    }
  }
  return names;
}

function main(): void {
  const made = makeAll();
  const file = join(KIT, 'kit.json');
  const kit = JSON.parse(readFileSync(file, 'utf8')) as { kit: { sprites: Record<string, { file: string; w: number; h: number; frames?: number }> } };
  // a renamed or dropped sheet leaves nothing behind
  for (const key of Object.keys(kit.kit.sprites)) if (ROLES.some((r) => key.startsWith(`chars/${r.id}_`))) delete kit.kit.sprites[key];
  for (const m of made) {
    const [name, w, h, frames] = m.split('|') as [string, string, string, string];
    kit.kit.sprites[`chars/${name}`] = { file: `chars/${name}.png`, w: Number(w), h: Number(h), frames: Number(frames) };
  }
  writeFileSync(file, `${JSON.stringify(kit, null, 2)}\n`);
  console.log(`${made.length} sheets written`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
