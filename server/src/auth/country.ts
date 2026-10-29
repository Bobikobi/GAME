import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { Reader, type CountryResponse } from 'mmdb-lib';

/** The country (two capitals) an address belongs to, or undefined when the file does not know it. */
export type CountryLookup = (address: string) => string | undefined;

/** an IPv4 client of a dual-stack socket: looked up as the IPv4 address it is, whatever aliases the file carries */
const MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const COUNTRY = /^[A-Z]{2}$/;
/** The codes a database may carry for "no country": none of them is a place, so none may lower the age limit. */
const NOT_A_PLACE = new Set(['ZZ', 'XX', 'AP', 'EU']);

/**
 * A lookup over a country database in MaxMind's file format: the free DB-IP country file the
 * image carries (CC BY 4.0, https://db-ip.com), or any file that holds `country.iso_code`. Pure JavaScript, so the
 * server needs no module on the host and no root. A private or loopback address, a string that is not an
 * address, and a code that names no country all answer undefined, which holds the sign-up to the highest age.
 */
export function countryLookup(db: Buffer): CountryLookup {
  const reader = new Reader<CountryResponse>(db);
  return (address) => {
    if (isIP(address) === 0) return undefined;
    const plain = MAPPED.exec(address)?.[1] ?? address;
    let found: CountryResponse | null;
    try {
      found = reader.get(plain);
    } catch {
      return undefined;
    }
    const code = found?.country?.iso_code;
    return code !== undefined && COUNTRY.test(code) && !NOT_A_PLACE.has(code) ? code : undefined;
  };
}

/** Read the file once, at boot: a path that does not open, or a file that is not a database, throws and the server does not start. */
export function loadCountryDb(path: string): CountryLookup {
  return countryLookup(readFileSync(path));
}
