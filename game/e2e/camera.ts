/** Proves the device-pixel canvas and the camera zoom at a 3x phone, in a real browser. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from './cdp';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(GAME_DIR, 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function serve(): Promise<{ server: Server; url: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
      let file = join(DIST, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(DIST) || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      ok({ server, url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/` });
    });
  });
}


/**
 * The camera rule at a real 3x phone: the one e2e at device scale 3 (the others
 * run at 1, since software GL draws a 1170x2532 canvas about 8x slower). A
 * 390x844 screen at 3x is a 1170x2532 canvas, so k = floor(1170 / 576) = 2 and
 * the world zoom is 4k = 8.
 */
async function main(): Promise<void> {
  const remote = process.env.E2E_URL;
  if (!remote && !existsSync(join(DIST, 'index.html'))) throw new Error('no game/dist: run "pnpm build" first');
  const local = remote ? null : await serve();
  try {
    const browser = await Browser.launch();
    try {
      const page = await browser.newPage({ width: 390, height: 844, mobile: true, scale: 3 });
      try {
        await page.goto(`${remote ?? local?.url ?? ''}?debug&rich=none`);
        await page.waitFor(`!!document.querySelector('#game canvas') && !!window.__game && !!window.__game.world`, 'the world scene', 30_000);
        const seen = await page.eval<{ w: number; h: number; zoom: number }>(
          `({ w: document.querySelector('#game canvas').width, h: document.querySelector('#game canvas').height, zoom: __game.world.cameras.main.zoom })`,
        );
        if (seen.w !== 1170 || seen.h !== 2532) throw new Error(`canvas is ${seen.w}x${seen.h}, expected 1170x2532 device pixels`);
        if (seen.zoom !== 8) throw new Error(`camera zoom is ${seen.zoom}, expected 8 (k=2)`);
        console.log(`camera: canvas ${seen.w}x${seen.h}, zoom ${seen.zoom}`);
        if (page.errors.length > 0) throw new Error(`page errors:\n${page.errors.join('\n')}`);
      } finally {
        page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    local?.server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
