/**
 * The valley a page mounts. The painted valley is the game's first place (public #919): every page mounts it, `painted=valley-blk2x3` on its
 * own map (`base=1`: content/core/map.json is the painted valley's map, one ring round the scene) with the phone camera (`zoom=auto`). There is
 * no way back to the pixel valley on this page: its map lives on only as a frozen test fixture (tools/test/fixtures/pixel-valley).
 * `?preview` and a page naming its own land (`?debug&painted=<id>`) keep their own query whole; on any other page the page's own options win
 * over the default's (URLSearchParams.get reads the first value). game/test/painted-dark.test.ts holds the rest.
 */
export const PAINTED_DEFAULT = '?painted=valley-blk2x3&base=1&zoom=auto';

/** The query the painted mount reads: the page's own whole when it names a land, else the page's own options and then the default. */
export function paintedQuery(query: string): string {
  const own = query.replace(/^\?/, '');
  if (new URLSearchParams(own).has('painted')) return `?${own}`;
  return own ? `?${own}&${PAINTED_DEFAULT.slice(1)}` : PAINTED_DEFAULT;
}
