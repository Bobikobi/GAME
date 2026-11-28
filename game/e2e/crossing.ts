/**
 * One crossing of a block's seam, walked by a figure in the engine: the walk the block command (blockwalk.ts, private tracker #10, order 23 and 25) and the private preview (preview.ts, tracker #33) share,
 * so there is one walker. A crossing is a run of open cells of the scene (`route`, scene cells, forward or reversed for the way back) that crosses one seam; the figure is put on its first cell and
 * walks it a tile at a time on the held arrow keys (the trunk's FreeWalk). A step is good when the feet stand on the cell asked for; a walk that stops short is a stuck cell.
 */
import { type Page } from './cdp';
import { sleep } from './cdp';
import { FreeWalk, ART_PX } from './walk';

export type Crossing = { seam: string; route: [number, number][]; first?: boolean; back?: boolean };

/** Put the figure on a scene cell (the session's position and the world's body). */
export const put = (c: [number, number]): string =>
  `(() => { const p = window.__painted, w = window.__game.world; const to = [p.x0 + ${c[0]}, p.y0 + ${c[1]}]; for (const s of [w.session, window.__game.session].filter(Boolean)) { s.pos = [to[0], to[1]]; if (s.state?.player) s.state.player.at = [to[0], to[1]]; } w.placePlayer(to[0], to[1]); return 1; })()`;

/** Walk one crossing from its first cell to its last. `atMid` runs once, when the feet stand on the middle step (a still, a probe) and returns what it saw. Never throws: a stuck walk comes back as ok false. */
export async function walkCrossing(page: Page, w: FreeWalk, c: Crossing, x0: number, y0: number, atMid?: () => Promise<string>): Promise<{ ok: boolean; detail: string; seen: string }> {
  const mid = Math.floor(c.route.length / 2);
  let ok = true;
  let detail = '';
  let seen = '';
  try {
    await page.eval(put(c.route[0]!));
    await sleep(400);
    const steps = c.route.slice(1);
    for (let k = 0; k < steps.length; k++) {
      const [cx, cy] = steps[k]!;
      await w.closeBox();
      await w.holdTo([x0 + cx, y0 + cy], `cell ${cx},${cy}`, 8_000);
      const f = await w.feet();
      const gx = Math.floor(f[0] / ART_PX) - x0;
      const gy = Math.floor(f[1] / ART_PX) - y0;
      if (gx !== cx || gy !== cy) {
        ok = false;
        detail = `stuck: at step ${k + 1} of ${steps.length} the feet stand on cell ${gx},${gy}, not ${cx},${cy}`;
        break;
      }
      if (k + 1 === mid && atMid) seen = await atMid();
    }
    if (ok) detail = `${c.route.length - 1} steps from cell ${c.route[0]} to ${c.route[c.route.length - 1]}, the feet stood on every cell`;
  } catch (e) {
    ok = false;
    detail = `stuck: ${(e as Error).message}`;
  } finally {
    await w.release();
  }
  return { ok, detail, seen };
}
