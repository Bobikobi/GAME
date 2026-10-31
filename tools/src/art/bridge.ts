/**
 * The old bridge at 64 px (rich wave 3b), whole and broken, each in three tiles: the whole width (`bridge`, a rail each
 * side) and, for a bridge two tiles wide, its north half (`_n`, the rail and the water above, the deck running off the
 * bottom edge) and south half (`_s`); the world draws the halves on the first and last row of the slot. The water under
 * it is the river's teal body (water.ts), the same on every variant, so it joins the water beside it.
 * The deck is eight upright boards a tile with a dark seam, a lit left edge and grain, nails at both ends; a rail beam
 * runs along each side with a post every 32 px, and the deck throws a shadow on the water. The broken one has two
 * boards gone, one snapped, a plank adrift and a post and a stretch of rail missing. `pnpm art:bridge` writes the PNGs.
 */
import { TILE, hash3, writeScripted } from './scripted.js';
import { waterRows } from './water.js';

const SEED = 101;
const RAIL_TOP = 12;
const RAIL_BOTTOM = 47;
const DECK_TOP = 17;
const DECK_BOTTOM = 46;

interface Options {
  /** the rail and the water above the deck, the water and shadow below it */
  top: boolean;
  bottom: boolean;
  /** boards missing altogether */
  gone: readonly number[];
  /** boards cut short: the index and the row they end on */
  snapped: readonly [number, number][];
  /** posts missing */
  noPost: readonly number[];
  /** a stretch of the lower rail missing, from x to x */
  noRail?: readonly [number, number];
  /** a plank adrift in the water */
  adrift: boolean;
}

function bridgeRows(o: Options): string[] {
  const g = waterRows(SEED, 0).map((r) => [...r]);
  const set = (x: number, y: number, ch: string): void => {
    if (x >= 0 && y >= 0 && x < TILE && y < TILE) g[y]![x] = ch;
  };
  // the shadow under the deck on the water, then the planks on top of it
  for (let y = RAIL_BOTTOM + 1; o.bottom && y < RAIL_BOTTOM + 6; y += 1) {
    for (let x = 0; x < TILE; x += 1) if ((y - RAIL_BOTTOM < 4 || (x + y) % 2 === 0) && 'ijklm'.includes(g[y]![x]!)) set(x, y, 'h');
  }
  // the boards
  for (let b = 0; b < 8; b += 1) {
    if (o.gone.includes(b)) continue;
    const x0 = b * 8;
    const light = hash3(SEED, b, 1) < 0.4;
    const deckEnd = o.bottom ? DECK_BOTTOM : TILE - 1;
    const end = o.snapped.find(([i]) => i === b)?.[1] ?? deckEnd;
    for (let y = o.top ? DECK_TOP : 0; y <= end; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        let ch = light ? 'x' : 'w';
        if (x === 0) ch = 'u';
        else if (x === 1) ch = light ? 'y' : 'x';
        else if (x === 7) ch = 'v';
        else if ((x === 3 || x === 5) && hash3(SEED + 2, b * 8 + x, y >> 3) < 0.5 && y % 7 !== 0) ch = light ? 'w' : 'v';
        // a snapped board's end is ragged
        if (end < deckEnd && y > end - 3 && hash3(SEED + 3, b * 8 + x, y) < 0.5) continue;
        set(x0 + x, y, ch);
      }
    }
    // a nail at each end
    for (const ny of [o.top ? DECK_TOP + 2 : 3, deckEnd - 3]) {
      if (ny > end) continue;
      set(x0 + 4, ny, 'y');
      set(x0 + 4, ny + 1, 'u');
    }
  }
  // the rails: a beam each side, lit on top, shaded below
  const beam = (y0: number, gap?: readonly [number, number]): void => {
    for (let x = 0; x < TILE; x += 1) {
      if (gap && x >= gap[0] && x <= gap[1]) continue;
      const rows = ['x', 'w', 'w', 'v', 'u'];
      rows.forEach((ch, k) => set(x, y0 + k, ch));
      if (hash3(SEED + 4, x >> 1, y0) < 0.18) set(x, y0 + 1, 'v');
    }
  };
  if (o.top) beam(RAIL_TOP);
  if (o.bottom) beam(RAIL_BOTTOM, o.noRail);
  // the posts: a block with a lit cap, standing across the rail
  [0, 32].forEach((px, k) => {
    if (o.noPost.includes(k)) return;
    for (const y0 of [o.top ? RAIL_TOP - 3 : -1, o.bottom ? RAIL_BOTTOM - 2 : -1]) {
      if (y0 < 0) continue;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const ch = y === 0 || x === 0 ? 'y' : y === 7 || x === 7 ? 'u' : y < 3 ? 'x' : 'w';
          set(px + x, y0 + y, ch);
        }
      }
      set(px + 3, y0 + 3, 'u');
      set(px + 4, y0 + 4, 'v');
    }
  });
  if (o.adrift && o.bottom) {
    // a plank turning in the current below the deck
    const ax = 10;
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 20; x += 1) {
        const yy = 53 + y + (x > 12 ? 1 : 0);
        set(ax + x, yy, y === 0 ? 'x' : y === 4 ? 'u' : x % 6 === 0 ? 'v' : 'w');
      }
    }
  }
  return g.map((r) => r.join(''));
}

const WHOLE: Options = { top: true, bottom: true, gone: [], snapped: [], noPost: [], adrift: false };
const BROKEN: Options = { top: true, bottom: true, gone: [1, 2], snapped: [[5, 28]], noPost: [1], noRail: [8, 27], adrift: true };
// the halves of a bridge two tiles wide: the broken boards run through both, the snapped one ends in the north half
const WHOLE_N: Options = { ...WHOLE, bottom: false };
const WHOLE_S: Options = { ...WHOLE, top: false };
const BROKEN_N: Options = { ...BROKEN, bottom: false, noRail: undefined, adrift: false };
const BROKEN_S: Options = { ...BROKEN, top: false, snapped: [], gone: [1, 2, 5], noPost: [1], noRail: [8, 27] };

/** Writes the six sprites, their kit.json entries and one manifest line each. */
export function writeBridge(): string[] {
  return writeScripted('tools/src/art/bridge.ts', 'the old bridge at 64 px over the river water', ['wood', 'teal'], [
    { name: 'bridge', frames: [bridgeRows(WHOLE)] },
    { name: 'bridge_n', frames: [bridgeRows(WHOLE_N)] },
    { name: 'bridge_s', frames: [bridgeRows(WHOLE_S)] },
    { name: 'bridge_broken', frames: [bridgeRows(BROKEN)] },
    { name: 'bridge_broken_n', frames: [bridgeRows(BROKEN_N)] },
    { name: 'bridge_broken_s', frames: [bridgeRows(BROKEN_S)] },
  ]);
}
