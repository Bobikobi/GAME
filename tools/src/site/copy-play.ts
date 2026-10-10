/**
 * `tsx tools/src/site/copy-play.ts`, the last step of `pnpm build` (docs/team/GRUNT.md, item 4): the game's build
 * becomes the site's /play/, and a 3D build, when there is one, becomes /play3d/ (play3d.ts). The home page's 3D
 * loop (web/media/) ships only when the page shows the 3D door. Each target is emptied first, so nothing stale
 * survives a rebuild.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import { has3dBuild, PLAY3D_OUT, show3dDoor } from './play3d';

const site = join(REPO_ROOT, 'web/dist');
if (!existsSync(join(site, 'index.html'))) throw new Error('no web/dist: run the site build first');

function copy(from: string, to: string): void {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

const game = join(REPO_ROOT, 'game/dist');
if (!existsSync(join(game, 'index.html'))) throw new Error('no game/dist: run the game build first');
copy(game, join(site, 'play'));
console.log('copied game/dist to web/dist/play/');

if (has3dBuild(REPO_ROOT)) {
  copy(join(REPO_ROOT, PLAY3D_OUT), join(site, 'play3d'));
  console.log(`copied ${PLAY3D_OUT} to web/dist/play3d/`);
} else {
  rmSync(join(site, 'play3d'), { recursive: true, force: true });
}

if (show3dDoor(REPO_ROOT)) {
  copy(join(REPO_ROOT, 'web/media'), join(site, 'media'));
  console.log('copied the 3D loop to web/dist/media/');
} else {
  rmSync(join(site, 'media'), { recursive: true, force: true });
}
