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

/** The elements markdown renders to; anything else in the text is a placeholder such as <your-handle>, shown as typed. */
const ELEMENTS = new Set(
  'a b blockquote br code del details em h1 h2 h3 h4 h5 h6 hr i img input kbd li ol p pre s span strong sub summary sup table tbody td tfoot th thead tr ul'.split(' '),
);

/**
 * The rendered guide made safe to insert as it is: a tag outside ELEMENTS is written out as text, and no element
 * keeps an event handler or a script address. The guide is the repository's own text; this keeps a placeholder
 * visible and a slip in a pull request harmless.
 */
export function safeHtml(html: string): string {
  return html.replace(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g, (tag: string, close: string, name: string, attrs: string) => {
    if (!ELEMENTS.has(name.toLowerCase())) return tag.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const clean = attrs
      .replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(\s(?:href|src)\s*=\s*")\s*javascript:[^"]*"/gi, '$1#"');
    return `<${close}${name}${clean}>`;
  });
}
