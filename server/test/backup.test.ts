import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

let root: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

/** Runs deploy/backup.sh in a scratch box whose `docker` is a script that prints `dump` and exits `code`. */
function backup(dump: string | 'random', code: number): { status: number | null; stderr: string; kept: string[]; parts: string[] } {
  root = mkdtempSync(join(tmpdir(), 'backup-test-'));
  const deploy = join(root, 'deploy');
  const bin = join(root, 'bin');
  mkdirSync(deploy);
  mkdirSync(bin);
  copyFileSync(new URL('../../deploy/backup.sh', import.meta.url).pathname, join(deploy, 'backup.sh'));
  writeFileSync(join(deploy, '.env'), 'DB_USER=u\nDB_NAME=game\n');
  writeFileSync(join(deploy, 'compose.yml'), '');
  writeFileSync(join(bin, 'docker'), `#!/bin/sh\n${dump === 'random' ? 'head -c 8000 /dev/urandom' : `printf '%s' '${dump}'`}\nexit ${code}\n`);
  chmodSync(join(bin, 'docker'), 0o755);
  const run = spawnSync('bash', [join(deploy, 'backup.sh')], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: root },
    encoding: 'utf8',
  });
  const dir = join(root, 'openfold', 'backups');
  const files = existsSync(dir) ? readdirSync(dir) : [];
  return { status: run.status, stderr: run.stderr, kept: files.filter((f) => f.endsWith('.sql.gz')), parts: files.filter((f) => f.endsWith('.part')) };
}

describe('deploy/backup.sh', () => {
  test('a failed pg_dump fails the run and moves nothing into place', () => {
    const run = backup('', 1);
    expect(run.status).not.toBe(0);
    expect(run.kept).toEqual([]);
    expect(run.parts).toEqual([]);
  });

  test('a dump under the floor is refused, and no .part is left behind', () => {
    const run = backup('CREATE TABLE x ();', 0);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/floor/);
    expect(run.kept).toEqual([]);
    expect(run.parts).toEqual([]);
  });

  test('a whole dump is moved into place under its final name', () => {
    const run = backup('random', 0);
    expect(run.status, run.stderr).toBe(0);
    expect(run.kept).toHaveLength(1);
    expect(run.parts).toEqual([]);
  });
});
