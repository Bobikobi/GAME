/**
 * pnpm art:gallery <pool[,pool]> [--since YYYY-MM-DD] [--names a,b] [--serve [--port N]] [--out file.html]
 *
 * The owner's pick page: see `gallery.ts`. `--serve` keeps running (its pid is printed) until it is killed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { galleryCli, servePage } from './gallery.js';
import { ROOT } from './queue.js';

try {
  const { html, serve, port, out, count } = galleryCli(process.argv.slice(2));
  const target = out ?? join(ROOT, '.scratch/art-pick/gallery.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  process.stdout.write(`${count} drafts on the page: ${target}\n`);
  if (serve) {
    servePage(html, join(ROOT, '.scratch/art-pick'), port);
    process.stdout.write(`serving http://127.0.0.1:${port}/ (pid ${process.pid}); picks land in .scratch/art-pick/\n`);
  }
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
