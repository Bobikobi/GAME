/**
 * Where the site's Play doors lead (NEXT 18 h6, the cutover): the demo at /play/, which keeps no account, unless
 * the build names the game with an account in SITE_GAME_URL. That game is served beside its API under one name
 * (DECISIONS.md, 2026-10-27, "One origin"), so the door is a plain link to that name: the site sends no request to
 * the API, and needs no CORS and no rewrite. It is set on one Vercel preview first, for the owner to try there;
 * set for production, it is the release.
 */

/** The demo's address on the site; it keeps shipping whatever the doors name. */
export const DEMO_DOOR = '/play/';

/**
 * The address the Play doors open: the demo, or the root of the name SITE_GAME_URL gives. A value that is not an
 * https origin stops the build, so a typo never ships a dead door.
 */
export function playDoor(env: Record<string, string | undefined> = process.env): string {
  const raw = env['SITE_GAME_URL']?.trim();
  if (!raw) return DEMO_DOOR;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_GAME_URL=${JSON.stringify(raw)} is not a URL; give the game's origin, such as https://play.example.org.`);
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
    throw new Error(`SITE_GAME_URL=${JSON.stringify(raw)} is not an https origin; give the name alone, such as https://play.example.org.`);
  }
  return `${url.origin}/`;
}
