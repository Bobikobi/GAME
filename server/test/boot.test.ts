import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { authFromEnv, BootError } from '../src/boot';

describe('the identity gate at boot', () => {
  test('refuses to start without AUTH_MODE', () => {
    expect(() => authFromEnv({})).toThrow(BootError);
    expect(() => authFromEnv({ AUTH_MODE: '' })).toThrow(/AUTH_MODE/);
  });

  test('refuses a mode it does not know, spelled however it is spelled', () => {
    for (const mode of ['sessions', 'SESSION', 'DEV-HEADER', ' dev-header', 'dev-header ', 'none', 'off', 'true', '1']) {
      expect(() => authFromEnv({ AUTH_MODE: mode, ALLOW_DEV_HEADER: 'staging-only' }), mode).toThrow(BootError);
    }
  });

  test('dev-header needs the second variable, and nothing else stands in for it', () => {
    expect(() => authFromEnv({ AUTH_MODE: 'dev-header' })).toThrow(/ALLOW_DEV_HEADER/);
    for (const value of ['', '1', 'true', 'yes', 'staging', 'Staging-Only', 'production']) {
      expect(() => authFromEnv({ AUTH_MODE: 'dev-header', ALLOW_DEV_HEADER: value }), value).toThrow(BootError);
    }
    expect(() => authFromEnv({ AUTH_MODE: 'dev-header', NODE_ENV: 'production' })).toThrow(BootError);
  });

  test('dev-header with the second variable is staging, and the notice says it trusts a header', () => {
    const auth = authFromEnv({ AUTH_MODE: 'dev-header', ALLOW_DEV_HEADER: 'staging-only' });
    expect(auth.mode).toBe('dev-header');
    expect(auth.notice).toMatch(/trusts the x-player-id header/);
    expect(auth.notice).not.toContain('\n');
  });

  test('the resolver reads the header only in dev-header mode, and only a short id', async () => {
    const auth = authFromEnv({ AUTH_MODE: 'dev-header', ALLOW_DEV_HEADER: 'staging-only' });
    if (auth.mode !== 'dev-header') throw new Error('expected the header mode');
    const { resolve } = auth;
    const request = (headers: Record<string, string | string[]>): never => ({ headers }) as never;
    expect(await resolve(request({ 'x-player-id': 'abc' }))).toBe('abc');
    expect(await resolve(request({}))).toBeUndefined();
    expect(await resolve(request({ 'x-player-id': '' }))).toBeUndefined();
    expect(await resolve(request({ 'x-player-id': 'x'.repeat(65) }))).toBeUndefined();
    expect(await resolve(request({ 'x-player-id': ['a', 'b'] }))).toBeUndefined();
  });
});

describe('the session mode at boot (NEXT 18 e)', () => {
  const ready = {
    AUTH_MODE: 'session',
    PUBLIC_ORIGIN: 'https://api.example.org',
    APP_ORIGIN: 'https://play.example.org',
    ALLOW_LOG_MAILER: 'staging-only',
    CLIENT_ADDRESS_HEADER: 'X-Real-IP',
  };

  test('starts with the two origins, the log mailer by default, and Google closed without its pair', () => {
    const auth = authFromEnv(ready);
    if (auth.mode !== 'session') throw new Error('expected the session mode');
    expect(auth.session).toEqual({ publicOrigin: 'https://api.example.org', appOrigin: 'https://play.example.org', google: undefined, mailer: 'log', addressHeader: 'x-real-ip' });
    expect(auth.notice).toMatch(/session cookie/);
    expect(auth.notice).toContain('staging only');
    expect(auth.notice).not.toContain('Google');
  });

  test('the log mailer starts only beside ALLOW_LOG_MAILER=staging-only: it writes live links to the log (finding 5)', () => {
    const { ALLOW_LOG_MAILER: _allowed, ...unflagged } = ready;
    expect(() => authFromEnv(unflagged)).toThrow(/ALLOW_LOG_MAILER/);
    expect(() => authFromEnv({ ...unflagged, MAILER: 'log' })).toThrow(/ALLOW_LOG_MAILER/);
    for (const value of ['', '1', 'true', 'staging', 'Staging-Only']) {
      expect(() => authFromEnv({ ...unflagged, ALLOW_LOG_MAILER: value }), value).toThrow(BootError);
    }
  });

  test('names the address header off a loopback origin, since behind nginx every request comes from nginx (finding 6)', () => {
    const { CLIENT_ADDRESS_HEADER: _header, ...unnamed } = ready;
    expect(() => authFromEnv(unnamed)).toThrow(/CLIENT_ADDRESS_HEADER/);
    const laptop = authFromEnv({ ...unnamed, PUBLIC_ORIGIN: 'http://localhost:8080', APP_ORIGIN: 'http://localhost:5173' });
    if (laptop.mode !== 'session') throw new Error('expected the session mode');
    expect(laptop.session.addressHeader).toBeUndefined();
    expect(laptop.notice).toContain('the socket address');
    for (const bad of ['X Real IP', 'x-real-ip:', 'x_real_ip']) {
      expect(() => authFromEnv({ ...ready, CLIENT_ADDRESS_HEADER: bad }), bad).toThrow(/CLIENT_ADDRESS_HEADER/);
    }
  });

  test('takes Google only as a pair, and the notice never carries the secret', () => {
    const auth = authFromEnv({ ...ready, GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'not-for-the-log' });
    if (auth.mode !== 'session') throw new Error('expected the session mode');
    expect(auth.session.google).toEqual({ clientId: 'id.apps.googleusercontent.com', clientSecret: 'not-for-the-log' });
    expect(auth.notice).toContain('Google');
    expect(auth.notice).not.toContain('not-for-the-log');
    expect(() => authFromEnv({ ...ready, GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => authFromEnv({ ...ready, GOOGLE_CLIENT_SECRET: 'secret' })).toThrow(/GOOGLE_CLIENT_ID/);
  });

  test('refuses a missing origin, a path, a trailing slash, and plain http off a loopback host', () => {
    expect(() => authFromEnv({ AUTH_MODE: 'session', APP_ORIGIN: ready.APP_ORIGIN })).toThrow(/PUBLIC_ORIGIN/);
    expect(() => authFromEnv({ AUTH_MODE: 'session', PUBLIC_ORIGIN: ready.PUBLIC_ORIGIN })).toThrow(/APP_ORIGIN/);
    for (const bad of ['https://api.example.org/', 'https://api.example.org/auth', 'http://api.example.org', 'api.example.org', 'ftp://api.example.org']) {
      expect(() => authFromEnv({ ...ready, PUBLIC_ORIGIN: bad }), bad).toThrow(BootError);
    }
    for (const local of ['http://localhost:8080', 'http://127.0.0.1:8080']) {
      expect(authFromEnv({ ...ready, PUBLIC_ORIGIN: local }).mode, local).toBe('session');
    }
  });

  test('never runs beside the header switch, and knows only the mailers it has', () => {
    expect(() => authFromEnv({ ...ready, ALLOW_DEV_HEADER: 'staging-only' })).toThrow(/ALLOW_DEV_HEADER/);
    expect(() => authFromEnv({ ...ready, MAILER: 'smtp' })).toThrow(/MAILER/);
  });

  test('reads a country header only when COUNTRY_HEADER names one, and says so in the notice', () => {
    const unset = authFromEnv(ready);
    if (unset.mode !== 'session') throw new Error('expected the session mode');
    expect(unset.session.countryHeader).toBeUndefined();
    expect(unset.notice).toMatch(/highest \(no COUNTRY_HEADER\)/);
    const set = authFromEnv({ ...ready, COUNTRY_HEADER: 'X-Country' });
    if (set.mode !== 'session') throw new Error('expected the session mode');
    expect(set.session.countryHeader).toBe('x-country');
    expect(set.notice).toContain('x-country');
    for (const bad of ['X Country', 'x-country:', 'x_country']) {
      expect(() => authFromEnv({ ...ready, COUNTRY_HEADER: bad }), bad).toThrow(/COUNTRY_HEADER/);
    }
  });
});

describe('the process itself', () => {
  function boot(env: Record<string, string>) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
      env: { PATH: process.env.PATH ?? '', ...env },
      encoding: 'utf8',
      timeout: 20_000,
    });
  }

  test('exits non-zero before listening or touching a database when AUTH_MODE is missing, unknown, or dev-header alone', () => {
    // no DATABASE_URL and no bundle: the gate has to fire before either is needed
    for (const env of [{}, { AUTH_MODE: 'session' }, { AUTH_MODE: 'dev-header' }] as Array<Record<string, string>>) {
      const run = boot(env);
      expect(run.status, JSON.stringify(env)).toBe(1);
      expect(run.stdout).not.toContain('openfold api on');
      expect(run.stderr).toMatch(/AUTH_MODE|ALLOW_DEV_HEADER/);
    }
  });
});

describe('the nginx site file (the 27.10 review)', () => {
  const conf = readFileSync(new URL('../../deploy/nginx-openfold.conf', import.meta.url), 'utf8');
  const auth = /location \/auth\/ \{([^}]*)\}/.exec(conf)?.[1] ?? '';

  test('sign-in has a request limit and a log line without the query string (findings 5, 6)', () => {
    expect(conf).toMatch(/^limit_req_zone \$binary_remote_addr zone=openfold_auth:\S+ rate=\d+r\/m;$/m);
    expect(auth).toMatch(/limit_req zone=openfold_auth /);
    expect(auth).toMatch(/access_log \S+ openfold_auth;/);
    const format = /^log_format openfold_auth (.*);$/m.exec(conf)?.[1] ?? '';
    expect(format).toContain('$uri');
    for (const leaks of ['$request ', '$request"', '$request_uri', '$args', '$query_string', '$http_referer']) expect(format).not.toContain(leaks);
  });

  test('the client address the API counts by is set by nginx, never passed through', () => {
    expect(conf).toContain('proxy_set_header X-Real-IP $remote_addr;');
    // the headers sit on the server, so neither location may set its own and drop them
    for (const location of conf.matchAll(/location [^{]*\{([^}]*)\}/g)) expect(location[1]).not.toContain('proxy_set_header');
  });
});
