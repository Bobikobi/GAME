import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A fresh secret for a cookie, a link, a state or a PKCE verifier: 32 random bytes, base64url (43 characters). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the database keeps of a token: its sha-256 in hex, so a copy of the rows signs nobody in. */
export function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** The PKCE challenge of a verifier, method S256 (RFC 7636 4.2). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** Whether two strings are equal, in a time that does not tell how much of them matched. */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** A token as this server writes them; anything else is refused before it is hashed or looked up. */
export function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}
