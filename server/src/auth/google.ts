import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

import { SignInRefusal, type OAuthProvider, type ProvenIdentity } from './provider';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const KEYS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
/** what the account asks for: an email and a name, nothing more (NEXT 18 e) */
const SCOPE = 'openid email profile';
/** how long Google's signing keys are trusted before they are fetched again */
const KEYS_TTL_MS = 60 * 60 * 1000;
/** the clock skew tolerated on `exp` and `iat` */
const SKEW_MS = 60 * 1000;

export interface GoogleOptions {
  clientId: string;
  clientSecret: string;
  /** injected so the tests answer for Google; the server passes the global fetch */
  fetch?: typeof fetch;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

function decodePart(part: string): Record<string, unknown> {
  try {
    const value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // fall through to the refusal
  }
  throw new SignInRefusal('Google sent a sign-in this server cannot read.', 'provider');
}

/**
 * Sign-in with Google: the authorization code flow with PKCE (S256), a `state` the callback checks, and a
 * nonce bound into the id token. The id token comes straight from Google's token endpoint, and is still
 * checked in full: its RS256 signature against Google's published keys, then `iss`, `aud`, `exp`, the
 * nonce, and `email_verified`. The token's own claims carry the subject and the address, so no userinfo
 * call is made: one fewer answer to trust, and the signed one is the one used.
 */
export function googleProvider(options: GoogleOptions): OAuthProvider {
  const send = options.fetch ?? fetch;
  let keys: { at: number; list: Jwk[] } | undefined;

  async function signingKey(kid: string, now: number): Promise<Jwk> {
    const cached = keys && now - keys.at < KEYS_TTL_MS ? keys.list.find((key) => key.kid === kid) : undefined;
    if (cached) return cached;
    // an unknown kid refreshes the keys once: Google rotates them, and a new one appears before it signs
    const response = await send(KEYS_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new SignInRefusal('Google could not be reached to check the sign-in.', 'provider');
    const body = (await response.json()) as { keys?: Jwk[] };
    keys = { at: now, list: Array.isArray(body.keys) ? body.keys : [] };
    const key = keys.list.find((candidate) => candidate.kid === kid);
    if (!key) throw new SignInRefusal('Google signed the sign-in with a key it does not publish.', 'provider');
    return key;
  }

  async function checkIdToken(idToken: string, nonce: string, now: number): Promise<ProvenIdentity> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new SignInRefusal('Google sent a sign-in this server cannot read.', 'provider');
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    const header = decodePart(headerPart);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
      throw new SignInRefusal('Google sent a sign-in signed in a way this server does not accept.', 'provider');
    }
    const key = createPublicKey({ key: await signingKey(header.kid, now), format: 'jwk' });
    const signed = verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`, 'ascii'), key, Buffer.from(signaturePart, 'base64url'));
    if (!signed) throw new SignInRefusal('The sign-in from Google does not carry a valid signature.', 'provider');

    const claims = decodePart(payloadPart);
    if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss)) {
      throw new SignInRefusal('The sign-in was not issued by Google.', 'provider');
    }
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(options.clientId) || (audience.length > 1 && claims.azp !== options.clientId)) {
      throw new SignInRefusal('The sign-in from Google was meant for another app.', 'provider');
    }
    if (typeof claims.exp !== 'number' || claims.exp * 1000 + SKEW_MS <= now) {
      throw new SignInRefusal('The sign-in from Google has expired. Try again.', 'provider');
    }
    if (typeof claims.iat === 'number' && claims.iat * 1000 - SKEW_MS > now) {
      throw new SignInRefusal('The sign-in from Google is dated in the future.', 'provider');
    }
    if (typeof claims.nonce !== 'string' || claims.nonce !== nonce) {
      throw new SignInRefusal('The sign-in from Google does not belong to this attempt.', 'provider');
    }
    if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 255) {
      throw new SignInRefusal('Google sent a sign-in with no account.', 'provider');
    }
    if (claims.email_verified !== true || typeof claims.email !== 'string') {
      throw new SignInRefusal('That Google account has no verified email address, so it cannot open an account here.', 'email-unverified');
    }
    return { provider: 'google', subject: claims.sub, email: claims.email };
  }

  return {
    id: 'google',
    authorizeUrl({ state, challenge, nonce, redirectUri }) {
      const url = new URL(AUTHORIZE_URL);
      url.search = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return url.toString();
    },

    async identify({ code, verifier, nonce, redirectUri, now }) {
      const response = await send(TOKEN_URL, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: options.clientId,
          client_secret: options.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: verifier,
        }).toString(),
      });
      if (!response.ok) throw new SignInRefusal('Google did not accept the sign-in. Try again.', 'provider');
      const body = (await response.json()) as { id_token?: unknown };
      if (typeof body.id_token !== 'string') throw new SignInRefusal('Google sent no sign-in to check.', 'provider');
      return checkIdToken(body.id_token, nonce, now);
    },
  };
}
