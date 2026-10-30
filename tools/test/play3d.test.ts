/** The 3D door on the home page (DECISIONS.md, 2026-10-30): hidden while 3D is paused; /play3d keeps shipping. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PLAY3D_OUT, has3dBuild, show3dDoor } from '../src/site/play3d';

let root = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'play3d-'));
  mkdirSync(join(root, PLAY3D_OUT), { recursive: true });
  writeFileSync(join(root, PLAY3D_OUT, 'index.html'), '<!doctype html>');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('show3dDoor', () => {
  it('is false with a 3D build and no env: the build still ships at /play3d/, the door stays off', () => {
    expect(has3dBuild(root)).toBe(true);
    expect(show3dDoor(root, {})).toBe(false);
  });
  it('is true only with SITE_3D_DOOR=force, with or without a build', () => {
    expect(show3dDoor(root, { SITE_3D_DOOR: 'force' })).toBe(true);
    expect(show3dDoor(join(root, 'nowhere'), { SITE_3D_DOOR: 'force' })).toBe(true);
    expect(show3dDoor(root, { SITE_3D_DOOR: '1' })).toBe(false);
  });
});
