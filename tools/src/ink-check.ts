/**
 * The ink edge, measured. The owner decided on 23.10 (PR #305) that "the outline is the one-pixel ink line
 * #1b1a2e, on every sprite", and that a check which measures ink on the edge follows, so the mix of edges
 * cannot come back. Every density 4 sprite outside `tiles/` (ground is seamless and never outlined) and `creatures/`
 * (animals wear no outline: the owner's pick C of 31.10) must
 * carry ink on at least INK_MIN_SHARE of its edge pixels, else an error names it. The 16 px (density 1)
 * sprites got their outline from the 18.10 rule: they are reported as one summary warning, never failed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Assembled } from './assemble';
import type { Issue } from './load';
import { INK_HEX, inkShare } from './kit/ink';

/** The least share of a rich sprite's edge pixels that must be ink (decision of 23.10, PR #305). */
export const INK_MIN_SHARE = 0.95;

export function checkInk(a: Assembled): Issue[] {
  const issues: Issue[] = [];
  let thin = 0;
  let thinUnder = 0;
  for (const [kitId, kit] of Object.entries(a.kits)) {
    for (const [name, s] of Object.entries(kit.sprites)) {
      if (name.startsWith('tiles/') || name.startsWith('creatures/')) continue; // ground is seamless; animals wear no outline (pick C, 31.10)
      let share: number;
      try {
        share = inkShare(readFileSync(join(kit.dir, s.file)), s.w);
      } catch {
        continue; // a missing or unreadable PNG is checkKits' error to report
      }
      if (s.density === 4) {
        if (share < INK_MIN_SHARE) {
          issues.push({
            file: `content/kit/${kitId}/${s.file}`,
            where: `art.ink.${kitId}:${name}`,
            message: `only ${(share * 100).toFixed(0)}% of its edge pixels are ink ${INK_HEX}, at least ${INK_MIN_SHARE * 100}% is needed. Run "pnpm kit:ink".`,
            level: 'error',
          });
        }
      } else {
        thin++;
        if (share < INK_MIN_SHARE) thinUnder++;
      }
    }
  }
  if (thin > 0) {
    issues.push({
      file: 'content/kit',
      where: 'art.ink16',
      message: `ink on the edge of the 16 px sprites (outline from the 18.10 rule, not enforced): ${thinUnder} of ${thin} are under ${INK_MIN_SHARE * 100}%`,
      level: 'warning',
    });
  }
  return issues;
}
