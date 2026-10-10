// The built site (docs/team/GRUNT.md, item 4): the site at /, the game at /play/, no script on the home page.
// Run after `pnpm build` (or the `site` step of `pnpm verify`), which writes web/dist.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '../dist');

describe('the build output', () => {
  it('has the home page', () => {
    expect(existsSync(join(DIST, 'index.html')), 'no web/dist/index.html: run pnpm build first').toBe(true);
  });

  it('has the game at /play/', () => {
    expect(existsSync(join(DIST, 'play/index.html'))).toBe(true);
  });

  it('puts no script on the home page', () => {
    expect(readFileSync(join(DIST, 'index.html'), 'utf8')).not.toContain('<script');
  });

  it('ships the two faces with their licences', () => {
    for (const face of ['platypi/platypi-latin.woff2', 'platypi/OFL.txt', 'atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin.woff2', 'atkinson-hyperlegible-next/OFL.txt'])
      expect(existsSync(join(DIST, 'fonts', face)), face).toBe(true);
  });
});
