import type { IncomingMessage } from 'node:http';

/** The identity modes this build knows. A signed-in session joins this list with NEXT 18 e. */
const MODES = ['dev-header'] as const;
type AuthMode = (typeof MODES)[number];

const PLAYER_HEADER = 'x-player-id';
const STAGING_ONLY = 'staging-only';

/** A refusal to start: main.ts prints it and exits non-zero, before the API listens or opens a database. */
export class BootError extends Error {}

export interface Auth {
  mode: AuthMode;
  /** the one line the boot log carries about who the server trusts */
  notice: string;
  resolve(request: IncomingMessage): Promise<string | undefined>;
}

function headerId(request: IncomingMessage): Promise<string | undefined> {
  const id = request.headers[PLAYER_HEADER];
  return Promise.resolve(typeof id === 'string' && id.length > 0 && id.length <= 64 ? id : undefined);
}

/**
 * Who is allowed to say who is asking. Nothing here is signed in yet (NEXT 18 e), so the one mode that
 * exists trusts a header, and it starts only when a second variable says, in so many words, that the box
 * is a staging one. Anything else, including no value at all, is a refusal: a server that cannot tell
 * players apart must not listen.
 */
export function authFromEnv(env: NodeJS.ProcessEnv): Auth {
  const mode = env.AUTH_MODE;
  if (mode === undefined || mode === '') {
    throw new BootError(`AUTH_MODE is not set. Known modes: ${MODES.join(', ')}.`);
  }
  if (!MODES.some((known) => known === mode)) {
    throw new BootError(`AUTH_MODE=${JSON.stringify(mode)} is not a mode this build knows. Known modes: ${MODES.join(', ')}.`);
  }
  if (env.ALLOW_DEV_HEADER !== STAGING_ONLY) {
    throw new BootError(`AUTH_MODE=dev-header lets any caller act as any player; it starts only with ALLOW_DEV_HEADER=${STAGING_ONLY}, on a box no real player reaches.`);
  }
  return {
    mode: 'dev-header',
    notice: `AUTH_MODE=dev-header: this server trusts the ${PLAYER_HEADER} header as the player's identity (staging only, no sign-in).`,
    resolve: headerId,
  };
}
