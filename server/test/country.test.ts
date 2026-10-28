import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { countryLookup, loadCountryDb } from '../src/auth/country';

import { buildCountryDb, FIXTURE } from './support/mmdb';

describe('the country lookup', () => {
  const lookup = countryLookup(buildCountryDb(FIXTURE));

  test('names the country an IPv4 or IPv6 address belongs to, and an IPv4 address written as IPv6', () => {
    expect(lookup('192.0.2.77')).toBe('IL');
    expect(lookup('198.51.100.1')).toBe('DE');
    expect(lookup('2001:db8:1234::1')).toBe('FR');
    expect(lookup('::ffff:192.0.2.77')).toBe('IL');
  });

  test('an address the file does not hold, a private one and a loopback one are no country', () => {
    for (const address of ['8.8.8.8', '10.0.0.1', '127.0.0.1', '::1', '2001:db9::1']) expect(lookup(address), address).toBeUndefined();
  });

  test('a code that names no place never counts as a country: it would lower the age limit', () => {
    expect(lookup('203.0.113.5')).toBeUndefined();
  });

  test('a string that is not one address is no country, and never throws', () => {
    for (const text of ['', 'x', '192.0.2.999', '192.0.2.1, 198.51.100.1', '192.0.2.1\n', ' 192.0.2.1', '2001:db8::zz']) {
      expect(lookup(text), JSON.stringify(text)).toBeUndefined();
    }
  });

  test('refuses a file that is not a country database, at load and not at the first sign-up', () => {
    expect(() => countryLookup(Buffer.from('not a database'))).toThrow();
    const dir = mkdtempSync(join(tmpdir(), 'country-'));
    try {
      writeFileSync(join(dir, 'empty.mmdb'), '');
      expect(() => loadCountryDb(join(dir, 'empty.mmdb'))).toThrow();
      expect(() => loadCountryDb(join(dir, 'missing.mmdb'))).toThrow(/ENOENT/);
      writeFileSync(join(dir, 'country.mmdb'), buildCountryDb(FIXTURE));
      expect(loadCountryDb(join(dir, 'country.mmdb'))('192.0.2.1')).toBe('IL');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
