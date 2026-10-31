/** The ways in (the owner, Q2): an email link, Google, and Discord. */
export type ProviderId = 'email' | 'google' | 'discord';

/**
 * Whether a way in proves the address itself: the email link is the mailbox, and Google signs the address it
 * calls verified. Discord's `verified` only says the address was confirmed once, in an answer it does not sign.
 * A proof of the address may sign in to the account that has it, and takes the address back from every weaker
 * way in on that account; a weaker one never joins an account by its address (refused as `email-taken`).
 * Never a second account for one address, and never a quiet way into someone else's.
 */
export const PROVES_ADDRESS: Readonly<Record<ProviderId, boolean>> = { email: true, google: true, discord: false };

/** The ways in that do not prove the address: what a proof of it removes from an account it joins. */
export const WEAKER_WAYS = (Object.keys(PROVES_ADDRESS) as ProviderId[]).filter((id) => !PROVES_ADDRESS[id]);

/** An identity a provider has proven: who it is there, and the address it vouches for. */
export interface ProvenIdentity {
  provider: ProviderId;
  subject: string;
  email: string;
}

/** An OAuth provider: where the browser is sent, and how its answer becomes a proven identity. */
export interface OAuthProvider {
  id: Exclude<ProviderId, 'email'>;
  authorizeUrl(request: { state: string; challenge: string; nonce: string; redirectUri: string }): string;
  /** Exchange the code and check what comes back; throws a SignInRefusal on anything short of proof. */
  identify(request: { code: string; verifier: string; nonce: string; redirectUri: string; now: number }): Promise<ProvenIdentity>;
}

/**
 * Why a sign-in was refused, in a code the client branches on. Nothing changes on a refusal: no account,
 * no session, no identity.
 */
export type SignInReason =
  | 'state'
  | 'link-unknown'
  | 'link-used'
  | 'link-expired'
  | 'email-unverified'
  | 'provider'
  | 'not-open'
  | 'under-age'
  | 'name-taken'
  | 'email-taken'
  | 'no-signup'
  | 'origin'
  | 'request'
  /** too many sign-ins asked for from one client address in a short time (429) */
  | 'slow-down';

export class SignInRefusal extends Error {
  constructor(
    message: string,
    readonly reason: SignInReason,
    readonly status = 400,
  ) {
    super(message);
  }
}

/**
 * One call to a provider and its JSON (finding 8 of the 27.10 review). A call that fails, hangs past the
 * timeout, or answers with something that is not a JSON object is a refusal like any other, so the player
 * goes back to the game instead of a 500 or nginx's 504. `who` names the provider in the player's words.
 */
export async function askProvider(
  send: typeof fetch,
  url: string,
  init: RequestInit,
  call: { who: string; timeoutMs: number; refused: string },
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await send(url, { ...init, signal: AbortSignal.timeout(call.timeoutMs) });
  } catch {
    throw new SignInRefusal(`${call.who} could not be reached to finish the sign-in. Try again.`, 'provider');
  }
  if (!response.ok) throw new SignInRefusal(call.refused, 'provider');
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SignInRefusal(`${call.who} sent an answer this server cannot read. Try again.`, 'provider');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new SignInRefusal(`${call.who} sent an answer this server cannot read. Try again.`, 'provider');
  }
  return body as Record<string, unknown>;
}
