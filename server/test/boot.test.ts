import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { authFromEnv, BootError } from '../src/boot';

describe('the identity gate at boot', () => {
  test('refuses to start without AUTH_MODE', () => {
    expect(() => authFromEnv({})).toThrow(BootError);
    expect(() => authFromEnv({ AUTH_MODE: '' })).toThrow(/AUTH_MODE/);
  });

  test('refuses a mode it does not know, spelled however it is spelled', () => {
    for (const mode of ['session', 'DEV-HEADER', ' dev-header', 'dev-header ', 'none', 'off', 'true', '1']) {
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
    const { resolve } = authFromEnv({ AUTH_MODE: 'dev-header', ALLOW_DEV_HEADER: 'staging-only' });
    const request = (headers: Record<string, string | string[]>): never => ({ headers }) as never;
    expect(await resolve(request({ 'x-player-id': 'abc' }))).toBe('abc');
    expect(await resolve(request({}))).toBeUndefined();
    expect(await resolve(request({ 'x-player-id': '' }))).toBeUndefined();
    expect(await resolve(request({ 'x-player-id': 'x'.repeat(65) }))).toBeUndefined();
    expect(await resolve(request({ 'x-player-id': ['a', 'b'] }))).toBeUndefined();
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
