/**
 * `tsx tools/src/site/copy-play.ts`, the last step of `pnpm build` (docs/team/GRUNT.md, items 4 and 8): the game's
 * build becomes the site's /play/, and a 3D build, when there is one, becomes /play3d/ (play3d.ts). The home page's
 * 3D loop (web/media/) ships only when the page shows the 3D door. The JSON schemas are published at /api/schema/.
 * Each target is emptied first, so nothing stale survives a rebuild.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../load';
import { has3dBuild, PLAY3D_OUT, show3dDoor } from './play3d';

const site = join(REPO_ROOT, 'web/dist');
if (!existsSync(join(site, 'index.html'))) throw new Error('no web/dist: run the site build first');

function copy(from: string, to: string, filter?: (name: string) => boolean): void {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  if (!filter) {
    cpSync(from, to, { recursive: true });
    return;
  }
  for (const name of readdirSync(from).filter(filter)) cpSync(join(from, name), join(to, name));
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

copy(join(REPO_ROOT, 'schema/json'), join(site, 'api/schema'), (name) => name.endsWith('.schema.json'));
console.log('copied schema/json to web/dist/api/schema/');

// The Vercel adapter (GRUNT item 17) copied the static pages into the Build Output before the game and the schemas
// were added to web/dist: refresh that copy, and put the whole output where Vercel looks for it, at the repository root.
const output = join(REPO_ROOT, 'web/.vercel/output');
if (existsSync(join(output, 'config.json'))) {
  copy(site, join(output, 'static'));
  copy(output, join(REPO_ROOT, '.vercel/output'));
  console.log('copied web/dist to the Build Output static folder, and the Build Output to .vercel/output/');
}
