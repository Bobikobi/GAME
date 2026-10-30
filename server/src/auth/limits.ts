/**
 * How often one key may do a thing, counted in this process (finding 6 of the 27.10 review). It stands
 * behind nginx's `limit_req` on `/auth/`, which counts every path alike: this one counts the sign-in starts
 * by what they cost, a mail sent or a flow row written. A restart forgets the counts, which only lets a
 * few more through; the database's own count of links per address still holds across one.
 */
export class RateLimit {
  private readonly hits = new Map<string, number[]>();
  /** past this many keys a hit prunes first, so a flood of new keys between two sweeps cannot grow the map without end */
  private static readonly KEYS_BEFORE_PRUNE = 50_000;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** Count a hit for `key` at `now`, and say whether it was allowed; a refused hit is not counted. */
  take(key: string, now: number): boolean {
    if (this.hits.size >= RateLimit.KEYS_BEFORE_PRUNE) this.prune(now);
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    const allowed = recent.length < this.limit;
    if (allowed) recent.push(now);
    this.hits.set(key, recent);
    return allowed;
  }

  /** Forget every key with no hit inside the window. */
  prune(now: number): void {
    for (const [key, list] of this.hits) if (list.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
  }

  /** how many keys are held, for the tests */
  get size(): number {
    return this.hits.size;
  }
}

/**
 * The inbox an address reaches, for counting only: lower case, and a `+tag` on the name dropped, so
 * `tess+1@` and `tess+2@` count as the one inbox they land in. The mail still goes to the address as given.
 */
export function inboxOf(email: string): string {
  const at = email.lastIndexOf('@');
  const name = email.slice(0, at);
  const plus = name.indexOf('+');
  return `${plus > 0 ? name.slice(0, plus) : name}${email.slice(at)}`.toLowerCase();
}
