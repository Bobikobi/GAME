/**
 * The youngest age that may open an account (CR-49): 13, or the country's higher age of digital consent.
 *
 * The countries below set a higher age under GDPR article 8, Korea's PIPA and China's PIPL; every other
 * country is 13. The list is the commonly published one and is not legal advice: it is reviewed whenever
 * the game opens to a new country (the owner, 21.10: "align with the big companies").
 */
const CONSENT_AGE: Readonly<Record<string, number>> = {
  AT: 14, BG: 14, CN: 14, CY: 14, CZ: 15, DE: 16, ES: 14, FR: 15, GR: 15, HR: 16, HU: 16, IE: 16, IT: 14,
  KR: 14, LI: 16, LT: 14, LU: 16, NL: 16, PL: 16, RO: 16, SI: 15, SK: 16,
};

/** The floor of CR-49 everywhere. */
export const MINIMUM_AGE = 13;

/** The age a sign-up with no known country is held to: the highest in the list, so a missing country never lowers the bar. */
export const UNKNOWN_COUNTRY_AGE = Math.max(MINIMUM_AGE, ...Object.values(CONSENT_AGE));

export type BirthBand = '13-15' | '16-17' | '18+';

export interface BirthDate {
  year: number;
  month: number;
  day: number;
}

/** The age a country asks for; a country this server does not list asks for 13, an absent one for the highest. */
export function consentAge(country: string | undefined): number {
  if (country === undefined) return UNKNOWN_COUNTRY_AGE;
  return CONSENT_AGE[country] ?? MINIMUM_AGE;
}

/**
 * A date of birth as the sign-up sends it, `YYYY-MM-DD`, when it is a real day of the calendar, not after
 * `now` and not more than 120 years before it; otherwise undefined.
 */
export function parseBirthDate(text: unknown, now: number): BirthDate | undefined {
  if (typeof text !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  const today = new Date(now);
  if (date.getTime() > now || year < today.getUTCFullYear() - 120) return undefined;
  return { year, month, day };
}

/**
 * The age reached on the server's date (UTC): the birthday counts from its own day, and one born on 29
 * February turns a year older on 1 March in a year without one.
 */
export function ageOn(birth: BirthDate, now: number): number {
  const today = new Date(now);
  const [month, day] = [today.getUTCMonth() + 1, today.getUTCDate()];
  const reached = month > birth.month || (month === birth.month && day >= birth.day);
  return today.getUTCFullYear() - birth.year - (reached ? 0 : 1);
}

/**
 * The band an account keeps (`accounts.birth_band`), or `underAge`. The date of birth itself is never
 * stored, so the row cannot become a birthday.
 */
export function ageGate(birth: BirthDate, country: string | undefined, now: number): { band: BirthBand } | { underAge: true } {
  const age = ageOn(birth, now);
  if (age < consentAge(country)) return { underAge: true };
  if (age >= 18) return { band: '18+' };
  return { band: age >= 16 ? '16-17' : '13-15' };
}
