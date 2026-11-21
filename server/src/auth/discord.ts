import { askProvider, SignInRefusal, type OAuthProvider } from './provider';

export const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
export const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
export const DISCORD_ME_URL = 'https://discord.com/api/v10/users/@me';
/** what the account asks for: who the player is there and their address, nothing more (NEXT 18 e) */
const SCOPE = 'identify email';
/** how long Discord gets to answer one call, well inside nginx's 30 s; past it the player goes back to the game */
const TIMEOUT_MS = 10 * 1000;
/** a Discord id is a snowflake: a 64-bit number written in decimal */
const SNOWFLAKE = /^\d{1,20}$/;

export interface DiscordOptions {
  clientId: string;
  clientSecret: string;
  /** injected so the tests answer for Discord; the server passes the global fetch */
  fetch?: typeof fetch;
  /** how long one call to Discord may take; a test shortens it */
  timeoutMs?: number;
}

/**
 * Sign-in with Discord: the authorization code flow with PKCE (S256) and a `state` the callback checks, as
 * Google's. Discord signs no id token for this flow, so the identity is what its own API answers for the
 * access token, over TLS, straight from discord.com: the account's id, its address, and whether Discord has
 * verified that address. An unverified address or none is refused, as it is for Google; even a verified one
 * does not prove the mailbox (`PROVES_ADDRESS`), so it never joins an account by it. The token is used for
 * that one call and kept nowhere. The nonce has no place to ride here; the state and the verifier bind the flow.
 */
export function discordProvider(options: DiscordOptions): OAuthProvider {
  const send = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const ask = (url: string, init: RequestInit, refused: string) => askProvider(send, url, init, { who: 'Discord', timeoutMs, refused });

  return {
    id: 'discord',
    authorizeUrl({ state, challenge, redirectUri }) {
      const url = new URL(DISCORD_AUTHORIZE_URL);
      url.search = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },

    async identify({ code, verifier, redirectUri }) {
      const token = await ask(DISCORD_TOKEN_URL, {
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
      }, 'Discord did not accept the sign-in. Try again.');
      if (typeof token.access_token !== 'string' || token.access_token === '' || String(token.token_type).toLowerCase() !== 'bearer') {
        throw new SignInRefusal('Discord sent no sign-in to check.', 'provider');
      }
      const me = await ask(DISCORD_ME_URL, {
        headers: { accept: 'application/json', authorization: `Bearer ${token.access_token}` },
      }, 'Discord could not say who signed in. Try again.');
      if (typeof me.id !== 'string' || !SNOWFLAKE.test(me.id)) {
        throw new SignInRefusal('Discord sent a sign-in with no account.', 'provider');
      }
      if (me.verified !== true || typeof me.email !== 'string' || me.email === '') {
        throw new SignInRefusal('That Discord account has no verified email address, so it cannot open an account here.', 'email-unverified');
      }
      return { provider: 'discord', subject: me.id, email: me.email };
    },
  };
}
