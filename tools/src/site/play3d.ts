/**
 * The 3D door (DECISIONS.md, 2026-10-09; docs/team/PLATFORM.md, "The 3D door at /play3d/"): an optional build
 * step after the game. When the game package has a `build:3d` script, it builds the 3D client into
 * game/dist-3d/; the copy step ships that folder at /play3d/ and the home page shows the 3D door. When there is no
 * such script, or it fails, the build still ships and the door stays hidden.
 *
 * SITE_3D_DOOR=force shows the door without a 3D build, for screenshots of the home page only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Where the 3D client's build lands, relative to the repository root. */
export const PLAY3D_OUT = 'game/dist-3d';

/** True when a 3D build is there to ship at /play3d/. */
export function has3dBuild(root: string): boolean {
  return existsSync(join(root, PLAY3D_OUT, 'index.html'));
}

/** True when the home page shows the 3D door: a 3D build exists, or a screenshot asks for the door. */
export function show3dDoor(root: string, env: Record<string, string | undefined> = process.env): boolean {
  return env['SITE_3D_DOOR'] === 'force' || has3dBuild(root);
}

/** Runs the game's `build:3d` script when it has one. Returns whether a 3D build is there afterwards. */
export function build3d(root: string, log: (line: string) => void = console.log): boolean {
  const pkg = JSON.parse(readFileSync(join(root, 'game/package.json'), 'utf8')) as { scripts?: Record<string, string> };
  rmSync(join(root, PLAY3D_OUT), { recursive: true, force: true });
  if (!pkg.scripts?.['build:3d']) {
    log('3D door: the game has no build:3d script yet, so the door stays hidden.');
    return false;
  }
  const run = spawnSync('pnpm', ['--filter', 'game', 'run', 'build:3d'], { cwd: root, stdio: 'inherit' });
  if (run.status !== 0 || !has3dBuild(root)) {
    rmSync(join(root, PLAY3D_OUT), { recursive: true, force: true });
    log('3D door: the 3D build failed; the classic game still ships and the door stays hidden.');
    return false;
  }
  log(`3D door: built into ${PLAY3D_OUT}.`);
  return true;
}
