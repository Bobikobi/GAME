/**
 * design/tokens.css is the one token sheet of the game and the site. Every
 * colour in it is a core-palette colour, and the game's own :root copy
 * (game/src/style.css) says the same values until it imports the sheet.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_PALETTE } from '../src/kit/palette';
import { REPO_ROOT } from '../src/load';

const tokens = readFileSync(join(REPO_ROOT, 'design', 'tokens.css'), 'utf8');
const style = readFileSync(join(REPO_ROOT, 'game', 'src', 'style.css'), 'utf8');

describe('design/tokens.css', () => {
  const palette = new Set(CORE_PALETTE.map((c) => c.toLowerCase()));

  it('uses core-palette colours only, written as six-digit hex', () => {
    const hexes = [...tokens.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(palette.has(hex), `${hex} is not in CORE_PALETTE`).toBe(true);
    }
  });

  it('has no scrims, gradients or rounded corners', () => {
    expect(tokens).not.toMatch(/rgba?\(|hsla?\(|gradient\(/);
    expect(tokens).toMatch(/--radius:\s*0;/);
    expect(tokens).toMatch(/--px:\s*2px;/);
  });

  it('contains the import line and its :root block declares no hex', () => {
    expect(style).toMatch(/@import\s+['"]\.\.\/\.\.\/design\/tokens\.css['"];/);
    const root = /:root\s*\{([^}]*)\}/.exec(style)?.[1] ?? '';
    expect(root).not.toMatch(/#[0-9a-fA-F]/);
  });

  it('keeps text at 15px or more and the pixel face first', () => {
    for (const m of tokens.matchAll(/--text-[a-z0-9]+:\s*(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(15);
    expect(tokens).toMatch(/--font:\s*'Pixelify Sans'/);
    expect(tokens).toMatch(/--font-reading:\s*'Atkinson Hyperlegible'/);
  });
});
