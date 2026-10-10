/// <reference types="astro/client" />
/**
 * What the home page reads at build time, all of it real: the builders board (boards.ts), the points weights, the
 * builder whose record mends the old bridge, the signature options of the schema, and whether there is a 3D
 * build to open (tools/src/site/play3d.ts).
 */
import { resolve } from 'node:path';
import { SIGNATURE_GLYPHS, SIGNATURE_STYLES } from '@game/schema';
import { show3dDoor } from '../../../tools/src/site/play3d';
import { weights } from './boards';

export { builders } from './boards';

/** The repository root; `astro build` runs in web/. */
const ROOT = resolve(process.cwd(), '..');

/** What a builder earns, from the weights the board is computed with. */
export const earn = { record: weights.per_record, commit: weights.per_commit, review: weights.per_approval };

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
