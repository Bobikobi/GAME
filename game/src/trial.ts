/**
 * Whether the page asks for the painted ground (painted.ts): only `?preview`, or `?debug&painted=<id>`. Nothing else reaches it, so a player's page never downloads the painted code
 * or fetches a picture of it (main.ts `mountTrial`; game/test/painted-dark.test.ts holds the rest of the way in).
 */
export function paintedWanted(query: string): boolean {
  const q = new URLSearchParams(query);
  return q.has('preview') || (q.has('debug') && q.has('painted'));
}
