/**
 * The youngest age that may open an account (CR-49): 13, or the country's higher age of digital consent.
 *
 * The countries below set a higher age under GDPR article 8 (and Korea's PIPA); every other country is 13.
 * The list is the commonly published one and is not legal advice: the owner confirms it before the first
 * address is collected (DECISIONS 2026-10-09, "Opens for stage 2a").
 */
const CONSENT_AGE: Readonly<Record<string, number>> = {
  AT: 14, BG: 14, CY: 14, CZ: 15, DE: 16, ES: 14, FR: 15, GR: 15, HR: 16, HU: 16, IE: 16, IT: 14,
  KR: 14, LI: 16, LT: 14, LU: 16, NL: 16, PL: 16, RO: 16, SI: 15, SK: 16,
};

/** The floor of CR-49 everywhere. */
export const MINIMUM_AGE = 13;

/** The age a sign-up with no country is held to: the highest in the list, so a missing country never lowers the bar. */
export const UNKNOWN_COUNTRY_AGE = Math.max(MINIMUM_AGE, ...Object.values(CONSENT_AGE));

export type BirthBand = '13-15' | '16-17' | '18+';

/** The age a country asks for; a country this server does not list asks for 13, an absent one for the highest. */
export function consentAge(country: string | undefined): number {
  if (country === undefined) return UNKNOWN_COUNTRY_AGE;
  return CONSENT_AGE[country] ?? MINIMUM_AGE;
}

/**
 * The age a player born in `birthYear` has surely reached in `year`: one less than the difference, since the
 * birthday may still be ahead. Only the year is asked, so the gate errs toward refusing, never toward a
 * child who is not yet old enough.
 */
export function surelyReached(birthYear: number, year: number): number {
  return year - birthYear - 1;
}

/**
 * The band an account keeps (`accounts.birth_band`), or `under-age` with the age that was needed. The year
 * of birth itself is never stored, so the row cannot become a birthday.
 */
export function ageGate(birthYear: number, country: string | undefined, now: number): { band: BirthBand } | { underAge: number } {
  const age = surelyReached(birthYear, new Date(now).getUTCFullYear());
  const needed = consentAge(country);
  if (age < needed) return { underAge: needed };
  if (age >= 18) return { band: '18+' };
  return { band: age >= 16 ? '16-17' : '13-15' };
}
