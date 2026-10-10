/// <reference types="astro/client" />
/**
 * What the home page reads at build time, all of it real: the builders board (content/board.json, written by
 * `pnpm board`), the points weights (.github/points.json), the builder whose record mends the old bridge, the
 * signature options of the schema, and whether there is a 3D build to open (tools/src/site/play3d.ts).
 */
import { resolve } from 'node:path';
import { SIGNATURE_GLYPHS, SIGNATURE_STYLES } from '@game/schema';
import board from '../../../content/board.json';
import points from '../../../.github/points.json';
import { show3dDoor } from '../../../tools/src/site/play3d';

/** The repository root; `astro build` runs in web/. */
const ROOT = resolve(process.cwd(), '..');

export interface Builder {
  handle: string;
  points: number;
  records: number;
  commits: number;
}

/** Every builder on the board, most points first; a tie goes to the handle in alphabetical order. */
export const builders: Builder[] = Object.entries(board.board as Record<string, Omit<Builder, 'handle'>>)
  .map(([handle, b]) => ({ handle, ...b }))
  .sort((a, b) => b.points - a.points || a.handle.localeCompare(b.handle));

/** What a builder earns, from the same file the board is computed with. */
export const earn = { record: points.per_record, commit: points.per_commit, review: points.per_approval };

/** The slot the opening quest mends, and the handle of the record that fills it: the window's plate shows it. */
export const BRIDGE_SLOT = 'core/old-bridge';
interface Restore {
  creator: string;
  restore?: { place?: { slot?: string } };
}
const restores = import.meta.glob<Restore>('../../../content/**/restores/*.json', { eager: true, import: 'default' });
export const bridgeBuilder: string | undefined = Object.values(restores).find((r) => r.restore?.place?.slot === BRIDGE_SLOT)?.creator;

/** How a signature can look in the game: its styles and its marks ("none" is not a mark). */
export const signature = { styles: SIGNATURE_STYLES.length, marks: SIGNATURE_GLYPHS.filter((g) => g !== 'none').length };

/** True when the home page shows the 3D door (a 3D build exists, or a screenshot forces it). */
export const door3d = show3dDoor(ROOT);

/** "1 record", "33 records". */
export const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
