/**
 * The scale audit (owner, 31.10: "check that the size of every item in the game is in a sensible proportion to
 * the character"): every sprite a player sees in the world, measured against the adult.
 *
 * `pnpm art:scale [--json] [--write] [--declare]`
 *
 * For each sprite of the kits outside the ground (`tiles/`) and the inventory icons (`items/`) it reads:
 * - the drawn height: the opaque rows of the frame (alpha 128 and up, the box and not the canvas), the tallest
 *   frame of a sheet, divided by the sprite's density so a 16 px and a 64 px sprite share one unit (the world
 *   keeps 16 units to a tile, game/src/kitart.ts);
 * - the height in characters: that, divided by the adult's, measured the same way on the adult human's standing frames;
 * - the range NATURE section 1 and STYLE 1b give its kind (tools/src/kit/scale.ts), and the verdict: under, over,
 *   in range, or no rule where no page speaks for the kind.
 * The rows are sorted by how far out they are. `--write` puts the table into
 * docs/design/frames/scale-audit-2026-10-31/scale.md. `--declare` writes the drawn height as `scale` (characters, two
 * decimals: STYLE 1b's floors carry two) into every world sprite of the kits that declares none, so a sprite that
 * arrives without one gets its honest number; it never touches one already declared. It changes nothing else.
 *
 * Pure where it can be: `verdictOf`, `distanceOf` and `renderScale` take numbers, so the words are tested without disks.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

import { ADULT, NOT_WORLD, passes, scaleKindOf, type ScaleKind } from '../kit/scale.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const KITS_DIR = join(ROOT, 'content', 'kit');
export const REPORT = join(ROOT, 'docs', 'design', 'frames', 'scale-audit-2026-10-31', 'scale.md');

/** The sprite the adult is measured on: the human's standing frames facing the camera, the base of the three races. */
export const ADULT_SPRITE = 'chars/human_down';

/** Solid pixels: the kit uses hard alpha (the ink check reads 128 the same way). */
const SOLID = 128;

export type Verdict = 'under' | 'over' | 'in range' | 'no rule';

export interface Row {
  kit: string;
  name: string;
  file: string;
  kind: string;
  /** The drawn height in art pixels of the sprite's own grid (opaque box, tallest frame). */
  px: number;
  density: number;
  /** The drawn height in world units (px / density). */
  units: number;
  /** The drawn height in characters, two decimals. */
  chars: number;
  lo: number | null;
  hi: number | null;
  verdict: Verdict;
  /** How far outside its range, in characters: 0 when in range or without a rule. */
  out: number;
}

/** Rows of a frame that hold a solid pixel: the opaque height (last row - first row + 1), 0 for an empty frame. */
export function opaqueHeight(png: PNG, frameWidth: number, frame: number): number {
  const { width, height, data } = png;
  const x0 = frame * frameWidth;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < Math.min(width, x0 + frameWidth); x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) >= SOLID) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
  }
  return top < 0 ? 0 : bottom - top + 1;
}

/** The tallest opaque height among the frames of a sheet: a walk bobs and a pose bends, the standing frame is the height. */
export function drawnHeight(png: PNG, frameWidth: number, frames: number): number {
  const hs: number[] = [];
  for (let f = 0; f < frames; f++) {
    const h = opaqueHeight(png, frameWidth, f);
    if (h > 0) hs.push(h);
  }
  if (hs.length === 0) return 0;
  return Math.max(...hs);
}

/** The range of a kind in characters: its floor, and the top where a page gives a range (null: bigger is open). */
export function rangeOf(kind: ScaleKind | undefined): { lo: number; hi: number | null } | undefined {
  return kind ? { lo: kind.floor, hi: kind.ceil ?? null } : undefined;
}

export function verdictOf(chars: number, range: { lo: number; hi: number | null } | undefined): Verdict {
  if (!range) return 'no rule';
  if (chars < passes(range.lo)) return 'under';
  if (range.hi !== null && chars > range.hi) return 'over';
  return 'in range';
}

/** How far a height stands outside its range, in characters; 0 inside or with no rule. */
export function distanceOf(chars: number, range: { lo: number; hi: number | null } | undefined): number {
  if (!range) return 0;
  if (chars < passes(range.lo)) return passes(range.lo) - chars;
  if (range.hi !== null && chars > range.hi) return chars - range.hi;
  return 0;
}

interface SpriteEntry {
  file: string;
  w: number;
  h: number;
  frames?: number;
  density?: number;
}

/** The kits on disk: id, directory and sprites. Reads kit.json of every folder of content/kit. */
function readKits(root = KITS_DIR): { id: string; dir: string; sprites: Record<string, SpriteEntry> }[] {
  const out: { id: string; dir: string; sprites: Record<string, SpriteEntry> }[] = [];
  for (const id of ['core', 'ceosisrael']) {
    const dir = join(root, id);
    const manifest = join(dir, 'kit.json');
    if (!existsSync(manifest)) continue;
    const kit = JSON.parse(readFileSync(manifest, 'utf8')) as { kit: { sprites: Record<string, SpriteEntry> } };
    out.push({ id, dir, sprites: kit.kit.sprites });
  }
  return out;
}

/** Measure every world sprite. The adult comes from `ADULT_SPRITE` and is returned with the rows. */
export function measureKits(root = KITS_DIR): { adultUnits: number; adultPx: number; rows: Row[] } {
  const kits = readKits(root);
  const read = (dir: string, s: SpriteEntry): number => {
    const png = PNG.sync.read(readFileSync(join(dir, s.file)));
    return drawnHeight(png, s.w, s.frames ?? 1);
  };
  const core = kits.find((k) => k.id === 'core');
  const adultSprite = core?.sprites[ADULT_SPRITE];
  if (!core || !adultSprite) throw new Error(`the adult sprite ${ADULT_SPRITE} is not in the core kit`);
  const adultPx = read(core.dir, adultSprite);
  const adultUnits = adultPx / (adultSprite.density ?? 1);
  const rows: Row[] = [];
  for (const kit of kits) {
    for (const [name, s] of Object.entries(kit.sprites)) {
      if (NOT_WORLD.includes(name.split('/')[0] ?? '')) continue;
      const density = s.density ?? 1;
      const px = read(kit.dir, s);
      const units = px / density;
      const chars = Math.round((units / adultUnits) * 100) / 100;
      const kind = scaleKindOf(name);
      const range = rangeOf(kind);
      rows.push({
        kit: kit.id, name, file: `content/kit/${kit.id}/${s.file}`, kind: kind?.kind ?? (name.startsWith('chars/') ? ADULT.kind : '-'),
        px, density, units: Math.round(units * 10) / 10, chars,
        lo: range?.lo ?? null, hi: range?.hi ?? null, verdict: verdictOf(chars, range), out: Math.round(distanceOf(chars, range) * 100) / 100,
      });
    }
  }
  rows.sort((a, b) => b.out - a.out || a.name.localeCompare(b.name));
  return { adultUnits, adultPx, rows };
}

/** Write the measured height as `scale` on every world sprite of a kit that has none. Returns the names it declared. */
export function declareScales(root = KITS_DIR): string[] {
  const { rows } = measureKits(root);
  const declared: string[] = [];
  for (const id of ['core', 'ceosisrael']) {
    const manifest = join(root, id, 'kit.json');
    if (!existsSync(manifest)) continue;
    const kit = JSON.parse(readFileSync(manifest, 'utf8')) as { kit: { sprites: Record<string, SpriteEntry & { scale?: number }> } };
    let changed = false;
    for (const r of rows.filter((x) => x.kit === id)) {
      const s = kit.kit.sprites[r.name];
      if (!s || s.scale !== undefined || r.chars < 0.1) continue;
      s.scale = r.chars;
      declared.push(`${id}:${r.name}`);
      changed = true;
    }
    if (changed) writeFileSync(manifest, `${JSON.stringify(kit, null, 2)}\n`);
  }
  return declared;
}

export const VERDICTS: readonly Verdict[] = ['under', 'over', 'in range', 'no rule'];

export function counts(rows: readonly Row[]): Record<Verdict, number> {
  const c: Record<Verdict, number> = { under: 0, over: 0, 'in range': 0, 'no rule': 0 };
  for (const r of rows) c[r.verdict]++;
  return c;
}

const rangeText = (r: Row): string => (r.lo === null ? 'no rule' : r.hi === null ? `${r.lo}+` : `${r.lo} to ${r.hi}`);

/** The page: the counts, the measure of the adult, and the table, worst first. */
export function renderScale(rows: readonly Row[], adultPx: number, adultUnits: number): string {
  const c = counts(rows);
  const lines = [
    '# The scale audit, 31.10.2026',
    '',
    'Every sprite a player sees in the world (props, characters, creatures; not ground tiles and not inventory icons), measured against the adult. Made by `pnpm art:scale --write`; the rule is NATURE section 1 and STYLE 1b (`tools/src/kit/scale.ts`).',
    '',
    `The adult: \`${ADULT_SPRITE}\`, ${adultPx} art px of opaque height at density 4, ${adultUnits} world units. One character is that height. A sprite's drawn height is its opaque box (not the canvas), its tallest frame, divided by its density and by the adult's.`,
    '',
    `Verdicts: ${VERDICTS.map((v) => `${v} ${c[v]}`).join(' · ')} (${rows.length} sprites).`,
    '',
    'A range with one number is a floor and the size of the common one; bigger is open (STYLE 1b), so only a kind with a top in NATURE can be over. A height up to a tenth under its floor is in range (the tolerance, NATURE section 1). `no rule` is a kind no page gives a height: it is listed, not judged. The open list is also what `pnpm check` prints as `!` lines.',
    '',
    '| Sprite | Kind | Drawn px | Density | Characters | Range | Verdict | Out by |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| \`${r.name}\`${r.kit === 'core' ? '' : ` (${r.kit})`} | ${r.kind} | ${r.px} | ${r.density} | ${r.chars} | ${rangeText(r)} | ${r.verdict} | ${r.out === 0 ? '' : r.out} |`),
    '',
  ];
  return lines.join('\n');
}

export function scaleCli(args: readonly string[]): string {
  if (args.includes('--declare')) {
    const names = declareScales();
    process.stdout.write(`declared scale on ${names.length} sprites\n`);
  }
  const { adultPx, adultUnits, rows } = measureKits();
  if (args.includes('--write')) {
    mkdirSync(dirname(REPORT), { recursive: true });
    writeFileSync(REPORT, renderScale(rows, adultPx, adultUnits));
  }
  if (args.includes('--json')) return `${JSON.stringify({ adultPx, adultUnits, counts: counts(rows), rows }, null, 2)}\n`;
  const c = counts(rows);
  const worst = rows.filter((r) => r.out > 0).slice(0, 15);
  return [
    `adult ${ADULT_SPRITE}: ${adultPx} px opaque, ${adultUnits} world units`,
    `${rows.length} sprites: ${VERDICTS.map((v) => `${v} ${c[v]}`).join(', ')}`,
    'worst 15:',
    ...worst.map((r) => `  ${r.name} (${r.kind}): ${r.chars} characters, range ${rangeText(r)}, ${r.verdict} by ${r.out}`),
    '',
  ].join('\n');
}
