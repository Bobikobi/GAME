import type { IncomingMessage } from 'node:http';

import { MAILERS, type MailerName, type ResendConfig } from './auth/mailer';

/** The identity modes this build knows: a signed-in session (NEXT 18 e), and the staging header. */
const MODES = ['session', 'dev-header'] as const;
type AuthMode = (typeof MODES)[number];

const PLAYER_HEADER = 'x-player-id';
const STAGING_ONLY = 'staging-only';
/** hosts a browser treats as secure over plain http, so a laptop can run the session mode */
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

function isLoopback(origin: string): boolean {
  return LOOPBACK.includes(new URL(origin).hostname);
}

/** A refusal to start: main.ts prints it and exits non-zero, before the API listens or opens a database. */
export class BootError extends Error {}

/** What the session mode is built from; main.ts turns it into the sign-in with the database's store. */
export interface SessionConfig {
  /** the origin this API answers on (the OAuth redirect and the email link are built on it) */
  publicOrigin: string;
  /**
   * the origin the game is served from: the public origin itself, since the game's build sits beside the API
   * behind one nginx name (finding 4 of the 27.10 review). It differs only on a laptop, where the dev client
   * and the API are two loopback ports.
   */
  appOrigin: string;
  /** absent when neither variable is set: Google then answers "not open yet" */
  google?: { clientId: string; clientSecret: string };
  discord?: { clientId: string; clientSecret: string };
  mailer: MailerName;
  /** present only with MAILER=resend: its key and the sender address */
  resend?: ResendConfig;
  /** the header our nginx sets to the visitor's country (lower case), an override of the file below; absent, it is not read */
  countryHeader?: string;
  /** the country database file (COUNTRY_DB) the client's address is looked up in; absent, with no header either, every sign-up is held to the highest age */
  countryDb?: string;
  /** the header our nginx sets to the client's address (lower case); the sign-in limits count by it. Absent only on a loopback origin */
  addressHeader?: string;
}

export type Auth =
  | {
      mode: 'dev-header';
      /** the one line the boot log carries about who the server trusts */
      notice: string;
      resolve(request: IncomingMessage): Promise<string | undefined>;
    }
  | {
      mode: 'session';
      notice: string;
      session: SessionConfig;
    };

function headerId(request: IncomingMessage): Promise<string | undefined> {
  const id = request.headers[PLAYER_HEADER];
  return Promise.resolve(typeof id === 'string' && id.length > 0 && id.length <= 64 ? id : undefined);
}

/** A request header's name as an env variable gives it, lower case; undefined when unset. */
function headerName(env: NodeJS.ProcessEnv, name: string, example: string): string | undefined {
  const raw = env[name];
  const value = raw ? raw.toLowerCase() : undefined;
  if (value !== undefined && !/^[a-z0-9-]+$/.test(value)) {
    throw new BootError(`${name}=${JSON.stringify(raw)} is not a header name, such as ${example}.`);
  }
  return value;
}

/** An origin as a browser sends it: a scheme, a host and a port, no path; https unless the host is a loopback. */
function origin(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new BootError(`AUTH_MODE=session needs ${name}, the origin it serves, such as https://play.example.org.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BootError(`${name}=${JSON.stringify(value)} is not a URL.`);
  }
  if (url.origin !== value) throw new BootError(`${name} is an origin only, with no path or trailing slash: ${url.origin}.`);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.includes(url.hostname))) {
    throw new BootError(`${name} must be https: the session cookie is Secure, and only a loopback host may use plain http.`);
  }
  return value;
}

/** MAILER=resend takes its key and a sender: `Name <address>` or a bare address, on the domain Resend verified. */
function resendFromEnv(env: NodeJS.ProcessEnv): ResendConfig {
  const apiKey = env.RESEND_API_KEY ?? '';
  if (apiKey === '') throw new BootError('MAILER=resend needs RESEND_API_KEY.');
  const from = env.MAIL_FROM ?? '';
  if (!/^(?:[^<>@\r\n]+ <[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>|[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)$/.test(from)) {
    throw new BootError(`MAIL_FROM=${JSON.stringify(from)} is not a sender: write \`Loomvale <play@your-domain>\` on the domain verified in Resend.`);
  }
  return { apiKey, from };
}

/** A provider's client pair: both or neither, and neither keeps that way in closed ("not open yet"). */
function oauthPair(env: NodeJS.ProcessEnv, prefix: 'GOOGLE' | 'DISCORD', name: string): { clientId: string; clientSecret: string } | undefined {
  const clientId = env[`${prefix}_CLIENT_ID`] ?? '';
  const clientSecret = env[`${prefix}_CLIENT_SECRET`] ?? '';
  if ((clientId === '') !== (clientSecret === '')) {
    throw new BootError(`Set both ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET, or neither (${name} then stays closed).`);
  }
  return clientId === '' ? undefined : { clientId, clientSecret };
}

function sessionMode(env: NodeJS.ProcessEnv): Auth {
  if (env.ALLOW_DEV_HEADER) {
    throw new BootError('ALLOW_DEV_HEADER is set with AUTH_MODE=session: the header mode and sign-in never run together. Remove it.');
  }
  const publicOrigin = origin(env, 'PUBLIC_ORIGIN');
  // The game is served beside the API, on the same origin: the session cookie is __Host- and same-site, the
  // API sends no CORS headers, and the client fetches with credentials: 'same-origin'. So APP_ORIGIN is the
  // public origin, and may be left unset. A second origin is a laptop's dev client only: two loopback ports.
  const appOrigin = env.APP_ORIGIN ? origin(env, 'APP_ORIGIN') : publicOrigin;
  if (appOrigin !== publicOrigin && !(isLoopback(publicOrigin) && isLoopback(appOrigin))) {
    throw new BootError(`APP_ORIGIN=${appOrigin} is not PUBLIC_ORIGIN=${publicOrigin}: the game is served beside the API on one origin (the session cookie never crosses origins and the API sends no CORS headers). Leave APP_ORIGIN unset; only a loopback pair, a laptop's dev client beside its API, may differ.`);
  }
  const google = oauthPair(env, 'GOOGLE', 'Google');
  const discord = oauthPair(env, 'DISCORD', 'Discord');
  const mailer = env.MAILER ?? 'log';
  if (!MAILERS.some((known) => known === mailer)) {
    throw new BootError(`MAILER=${JSON.stringify(mailer)} is not a mailer this build has. Known: ${MAILERS.join(', ')}.`);
  }
  // the log mailer writes every live sign-in link into the API's log, where anyone who reads it can use one
  if (mailer === 'log' && env.ALLOW_LOG_MAILER !== STAGING_ONLY) {
    throw new BootError(`MAILER=log writes each sign-in link to the log, so anyone who reads the log can sign in as anyone; it starts only with ALLOW_LOG_MAILER=${STAGING_ONLY}, on a box no real player reaches.`);
  }
  const resend = mailer === 'resend' ? resendFromEnv(env) : undefined;
  const countryHeader = headerName(env, 'COUNTRY_HEADER', 'X-Country');
  const countryDb = env.COUNTRY_DB ? env.COUNTRY_DB : undefined;
  if (countryDb !== undefined && !countryDb.startsWith('/')) {
    throw new BootError(`COUNTRY_DB=${JSON.stringify(countryDb)} is not an absolute path to a country database file, such as /app/country.mmdb.`);
  }
  const addressHeader = headerName(env, 'CLIENT_ADDRESS_HEADER', 'X-Real-IP');
  if (addressHeader === undefined && !isLoopback(publicOrigin)) {
    throw new BootError('CLIENT_ADDRESS_HEADER is not set: behind nginx every request comes from nginx, so the sign-in limits would count all players as one. Set it to the header nginx fills, X-Real-IP.');
  }
  return {
    mode: 'session',
    notice: `AUTH_MODE=session: players are who their session cookie says; sign-in by email (links to the ${mailer} mailer${mailer === 'log' ? ', staging only' : ''})${[google && ' and Google', discord && ' and Discord'].filter(Boolean).join('')}, ${appOrigin === publicOrigin ? 'the game beside it' : `the game at ${appOrigin}`}; the age limit ${countryHeader || countryDb ? `by the country in ${[countryHeader, countryDb && `the file ${countryDb}`].filter(Boolean).join(', else in ')}` : 'is the highest (no COUNTRY_HEADER, no COUNTRY_DB)'}; limits by ${addressHeader ?? 'the socket address'}.`,
    session: { publicOrigin, appOrigin, google, discord, mailer: mailer as MailerName, ...(resend && { resend }), countryHeader, ...(countryDb && { countryDb }), addressHeader },
  };
}

/**
 * Who is allowed to say who is asking. `session` is sign-in (NEXT 18 e): a cookie the API set after an email
 * link or Google proved the player. `dev-header` trusts a header, and starts only when a second variable
 * says, in so many words, that the box is a staging one. Anything else, including no value at all, is a
 * refusal: a server that cannot tell players apart must not listen.
 */
export function authFromEnv(env: NodeJS.ProcessEnv): Auth {
  const mode = env.AUTH_MODE;
  if (mode === undefined || mode === '') {
    throw new BootError(`AUTH_MODE is not set. Known modes: ${MODES.join(', ')}.`);
  }
  if (!MODES.some((known) => known === mode)) {
    throw new BootError(`AUTH_MODE=${JSON.stringify(mode)} is not a mode this build knows. Known modes: ${MODES.join(', ')}.`);
  }
  if ((mode as AuthMode) === 'session') return sessionMode(env);
  if (env.ALLOW_DEV_HEADER !== STAGING_ONLY) {
    throw new BootError(`AUTH_MODE=dev-header lets any caller act as any player; it starts only with ALLOW_DEV_HEADER=${STAGING_ONLY}, on a box no real player reaches.`);
  }
  return {
    mode: 'dev-header',
    notice: `AUTH_MODE=dev-header: this server trusts the ${PLAYER_HEADER} header as the player's identity (staging only, no sign-in).`,
    resolve: headerId,
  };
}
