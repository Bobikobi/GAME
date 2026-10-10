// The site's colours come from design/tokens.css only (docs/team/GRUNT.md, item 4; PLATFORM.md section 5.4).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(import.meta.dirname, '..');
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function files(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, keep);
    return keep(path) ? [path] : [];
  });
}

describe('the site uses the token sheet', () => {
  it('has no hex colour anywhere in web/src', () => {
    const hits = files(join(WEB, 'src'), () => true)
      .flatMap((path) => readFileSync(path, 'utf8').split('\n').map((line, i) => ({ path, line, i })))
      .filter(({ line }) => HEX.test(line))
      .map(({ path, line, i }) => `${relative(WEB, path)}:${i + 1}: ${line.trim()}`);
    expect(hits).toEqual([]);
  });

  it('has no hex colour in the stylesheets of web/public', () => {
    const hits = files(join(WEB, 'public'), (path) => path.endsWith('.css')).filter((path) => HEX.test(readFileSync(path, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('imports the token sheet first in its stylesheet', () => {
    const css = readFileSync(join(WEB, 'src/styles/site.css'), 'utf8');
    expect(css.trimStart().startsWith("@import '../../../design/tokens.css';")).toBe(true);
  });
});
