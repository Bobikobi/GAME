/**
 * Holes in a drawing (DECISIONS.md, 2026-10-23): the see-through pockets a sprite's drawing encloses, and
 * what the check says about a small one.
 *
 * Until that day the importer took every colour near the background for background, wherever it stood,
 * so a pale face or a pink bowl came out see-through inside its own outline and the ground showed through
 * the object. A see-through region is its pixels side by side or corner to corner; it is enclosed when
 * none of it lies on its frame's edge, so a pocket that meets the outside at a corner is a notch of the
 * silhouette, not a hole. An enclosed region of at most `SPECK_MAX` pixels at density 4 is such a speck,
 * and the check names the command that imports the sprite again from its raw drawing. A larger one is an
 * opening the drawing has (a handle, a gap between stems) and passes. Density 1 is left out: at 16 px,
 * 14 of the kit's 145 sprites held one on 2026-10-23.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';

/** The largest enclosed see-through region the check calls a speck; one pixel more is an opening. */
export const SPECK_MAX = 24;

/** The pixels of a sprite strip: `width` by `height`, four bytes each, alpha last. */
export type Picture = { width: number; height: number; data: Uint8Array };

/** A kit sprite as the check reads it. */
export type HoleSprite = { w: number; frames: number; density: 1 | 4; source?: { spec: string; manifest: string } };

/** One enclosed see-through region: its frame, its size, and its first pixel in reading order, within the frame. */
export type Pocket = { frame: number; size: number; x: number; y: number };

/**
 * The enclosed see-through regions of each frame of a strip (`frames` frames of `frameWidth` side by side),
 * largest first within a frame. A pixel is see-through below alpha 128, as the importer reads it.
 */
export function enclosedPockets(picture: Picture, frameWidth: number, frames: number): Pocket[] {
  const { width, height, data } = picture;
  const count = frameWidth * height;
  const reached = new Uint8Array(count);
  const queue = new Int32Array(count);
  const pockets: Pocket[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const left = frame * frameWidth;
    const clear = (index: number): boolean => {
      const x = index % frameWidth;
      return (data[(((index - x) / frameWidth) * width + left + x) * 4 + 3] ?? 0) < 128;
    };
    // flood from the queued pixels through see-through ones, side by side or corner to corner; returns the queue's end
    const flood = (end: number): number => {
      let head = 0;
      let tail = end;
      while (head < tail) {
        const index = queue[head++] ?? 0;
        const x = index % frameWidth;
        const y = (index - x) / frameWidth;
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(frameWidth - 1, x + 1); nx += 1) {
            const neighbor = ny * frameWidth + nx;
            if (reached[neighbor] === 0 && clear(neighbor)) {
              reached[neighbor] = 1;
              queue[tail++] = neighbor;
            }
          }
        }
      }
      return tail;
    };
    reached.fill(0);
    let seeds = 0;
    for (let index = 0; index < count; index += 1) {
      const x = index % frameWidth;
      const y = (index - x) / frameWidth;
      if ((x === 0 || y === 0 || x === frameWidth - 1 || y === height - 1) && clear(index)) {
        reached[index] = 1;
        queue[seeds++] = index;
      }
    }
    flood(seeds);
    // what the edge did not reach is enclosed, one region at a time
    const found: Pocket[] = [];
    for (let index = 0; index < count; index += 1) {
      if (reached[index] !== 0 || !clear(index)) continue;
      reached[index] = 1;
      queue[0] = index;
      found.push({ frame, size: flood(1), x: index % frameWidth, y: Math.floor(index / frameWidth) });
    }
    pockets.push(...found.sort((a, b) => b.size - a.size));
  }
  return pockets;
}

/** The manifest line a sprite's `source.manifest` (`<path>:<line>`) points at, or undefined when it cannot be read. */
function pickedDrawing(manifest: string): { name: string; at: string } | undefined {
  const colon = manifest.lastIndexOf(':');
  const line = Number(manifest.slice(colon + 1));
  if (colon < 1 || !Number.isInteger(line) || line < 1) return undefined;
  try {
    const text = readFileSync(join(REPO_ROOT, manifest.slice(0, colon)), 'utf8').split('\n')[line - 1] ?? '';
    const parsed = JSON.parse(text) as { name?: unknown; at?: unknown };
    return typeof parsed.name === 'string' && typeof parsed.at === 'string' ? { name: parsed.name, at: parsed.at } : undefined;
  } catch {
    return undefined;
  }
}

/** How to import the sprite at `file` (a path from the repository root) again from its raw drawing. */
function reimportAdvice(sprite: HoleSprite, file: string): string {
  const fixed = 'Import it again from its raw drawing with the fixed importer';
  const picked = sprite.source === undefined ? undefined : pickedDrawing(sprite.source.manifest);
  if (sprite.source === undefined || picked === undefined) {
    const why = sprite.source === undefined ? 'the sprite names no "source" in kit.json' : `${sprite.source.manifest} cannot be read`;
    return `${fixed}: run "pnpm kit:gen <spec> --only <entry> --reimport --out <run>" from the repository root, where <run> is the --out folder of the run that drew it, then copy <run>/<entry>.png over ${file} (${why}, so find the run by hand; a sprite drawn by hand fills the pocket in its PNG instead).`;
  }
  const raw = `raw/${picked.name}-${picked.at.replace(/[:.]/g, '-')}.png`;
  return `${fixed}: run "pnpm kit:gen ${sprite.source.spec} --only ${picked.name} --reimport --out <run>" from the repository root, where <run> is the --out folder of the run that drew it, the one holding ${raw} (${sprite.source.manifest}); the re-import takes the run's last drawing of ${picked.name}, so check it is this one; then copy <run>/${picked.name}.png over ${file}.`;
}

/**
 * What the check says about a sprite's pockets: one message when a frame of a density 4 sprite encloses a
 * see-through region of at most `SPECK_MAX` pixels, else none. `file` is the PNG's path from the repository root.
 */
export function holeProblems(sprite: HoleSprite, picture: Picture, file: string): string[] {
  if (sprite.density !== 4) return [];
  const specks = enclosedPockets(picture, sprite.w, sprite.frames)
    .filter((pocket) => pocket.size <= SPECK_MAX)
    .sort((a, b) => b.size - a.size);
  const largest = specks[0];
  if (largest === undefined) return [];
  const where = `${sprite.frames > 1 ? `in frame ${largest.frame + 1} ` : ''}at ${largest.x},${largest.y}`;
  const pixels = specks.reduce((sum, pocket) => sum + pocket.size, 0);
  const found = specks.length === 1
    ? `a see-through pocket of ${largest.size} px ${where}`
    : `${specks.length} see-through pockets of at most ${SPECK_MAX} px, ${pixels} px in all, the largest (${largest.size} px) ${where}`;
  return [
    `encloses ${found}: the ground shows through the object there, and until 2026-10-23 the importer cut such specks out of drawings. ${reimportAdvice(sprite, file)} An opening the drawing means is larger than ${SPECK_MAX} px, or open to the outside.`,
  ];
}
