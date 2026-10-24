/** The ways in (the owner, Q2): an email link, Google, and Discord. */
export type ProviderId = 'email' | 'google' | 'discord';

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
  | 'request';

export class SignInRefusal extends Error {
  constructor(
    message: string,
    readonly reason: SignInReason,
    readonly status = 400,
  ) {
    super(message);
  }
}
