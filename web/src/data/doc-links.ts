/**
 * The links of a guide page (docs/team/GRUNT.md, item 13): a markdown link relative to the repository
 * (../design/ASSET_PATH.md, templates/extension) points to the file on GitHub, and a link to another page of the guide
 * stays on the site. Absolute links and #anchors are left alone. It works on the rendered HTML, so it needs no
 * markdown plugin.
 */
import { posix } from 'node:path';

const REPO = 'https://github.com/Bobikobi/GAME/blob/develop/';
const GUIDE = 'docs/creators/';

/** The address a relative link of a guide page takes on the site. */
export function siteHref(href: string, from: string = GUIDE): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href;
  const [path = '', hash = ''] = href.split('#');
  const target = posix.normalize(posix.join(from, path));
  const anchor = hash ? `#${hash}` : '';
  if (target.startsWith(GUIDE) && target.endsWith('.md')) {
    const page = target.slice(GUIDE.length, -3).toLowerCase();
    return `/docs/${page === 'readme' ? '' : `${page}/`}${anchor}`;
  }
  return `${REPO}${target}${anchor}`;
}

/** Every href and src of the rendered page, through siteHref; an image is served raw. */
export function siteLinks(html: string, from: string = GUIDE): string {
  return html
    .replace(/(<a\b[^>]*?\shref=")([^"]*)(")/g, (_, a: string, href: string, z: string) => `${a}${siteHref(href, from)}${z}`)
    .replace(/(<img\b[^>]*?\ssrc=")([^"]*)(")/g, (_, a: string, src: string, z: string) => {
      const out = siteHref(src, from);
      return `${a}${out.startsWith(REPO) ? out.replace('/blob/', '/raw/') : out}${z}`;
    });
}
