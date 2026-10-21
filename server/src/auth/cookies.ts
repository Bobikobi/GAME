import type { IncomingMessage } from 'node:http';

/**
 * The cookies sign-in sets. The `__Host-` prefix makes the browser refuse each one unless it is Secure, has
 * no Domain and has the path `/`, so no other name under the same site can set or read it.
 */
export const SESSION_COOKIE = '__Host-of_session';
export const FLOW_COOKIE = '__Host-of_flow';
export const SIGNUP_COOKIE = '__Host-of_signup';
/** set for a day when a sign-up is refused for its age; while it stands the browser gets no new try */
export const AGE_COOKIE = '__Host-of_age';

/** The value of one cookie the request carries, or undefined; a name sent twice is read as absent. */
export function readCookie(request: IncomingMessage, name: string): string | undefined {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return undefined;
  let found: string | undefined;
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== name) continue;
    if (found !== undefined) return undefined;
    found = part.slice(at + 1).trim();
  }
  return found;
}

/**
 * One Set-Cookie value: httpOnly (no script reads it), Secure, SameSite=Lax (it rides a top-level link from
 * another site, which the OAuth callback and the email link both are, and no cross-site request else).
 * A browser treats http://localhost as secure, so the same cookie works on a laptop.
 */
export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

/** The Set-Cookie value that removes a cookie. */
export function clearCookie(name: string): string {
  return cookie(name, '', 0);
}
