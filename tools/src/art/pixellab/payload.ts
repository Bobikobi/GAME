/**
 * What a PixelLab answer holds, read tolerantly. The trial (2.11) saw the shapes of only a few endpoints and the
 * folders of the live answers are gone, so nothing here assumes a place for a picture: it walks the answer, the way
 * the trial's `pl.images` did, and the ledger records the key structure of the first answer of each recipe
 * (`shapeOf`, no picture data) so a later change in the API is visible in the repository.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const DATA_URL = /^data:image\/[a-z]+;base64,/;

function asImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const bare = value.replace(DATA_URL, '');
  return bare.length > 40 ? bare : null;
}

/** Every base64 picture anywhere in an answer, in order of appearance, the same bytes once. */
export function findImages(payload: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown, key: string | null): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        // a bare long string in a list is a picture (the trial's rule: over 200 characters)
        if (typeof item === 'string' && item.length > 200) walk(item, 'images');
        else walk(item, key);
      }
      return;
    }
    if (typeof node === 'string') {
      const image = key === 'image' || key === 'images' || key === 'base64' ? asImage(node) : null;
      if (image !== null && !out.includes(image)) out.push(image);
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, k);
    }
  };
  walk(payload, null);
  return out;
}

export interface FoundUrl {
  /** The keys and indexes down to the link, e.g. `files.walk.gif` or `directions.2.frames.5`. */
  path: string;
  url: string;
}

const IMAGE_URL = /\.(png|gif|webp)(\?.*)?$/i;

/** Every link to a picture in an answer. A link counts when its own name or the key that holds it ends in an image extension. */
export function findUrls(payload: unknown): FoundUrl[] {
  const out: FoundUrl[] = [];
  const walk = (node: unknown, path: string[]): void => {
    if (typeof node === 'string') {
      const last = path[path.length - 1] ?? '';
      if (/^https?:\/\//.test(node) && (IMAGE_URL.test(node) || IMAGE_URL.test(last)) && !out.some((u) => u.url === node)) out.push({ path: path.join('.'), url: node });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, [...path, String(i)]));
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
    }
  };
  walk(payload, []);
  return out;
}

/** The key structure of an answer without any picture data: `a.b`, `list[].c`, so a ledger line can say what the API sent. */
export function shapeOf(payload: unknown, limit = 60): string[] {
  const seen = new Set<string>();
  const walk = (node: unknown, path: string, depth: number): void => {
    if (seen.size >= limit) return;
    if (Array.isArray(node)) {
      seen.add(`${path}[]`);
      if (depth < 5 && node.length > 0) walk(node[0], `${path}[]`, depth + 1);
      return;
    }
    if (node !== null && typeof node === 'object') {
      if (depth >= 5) {
        seen.add(`${path}{}`);
        return;
      }
      for (const [k, v] of Object.entries(node)) walk(v, path === '' ? k : `${path}.${k}`, depth + 1);
      return;
    }
    seen.add(`${path}:${node === null ? 'null' : typeof node}`);
  };
  walk(payload, '', 0);
  return [...seen].sort();
}

/** An object field read without trusting its type. */
export function field(node: unknown, ...keys: string[]): unknown {
  let at: unknown = node;
  for (const k of keys) {
    if (at === null || typeof at !== 'object') return undefined;
    at = (at as Record<string, unknown>)[k];
  }
  return at;
}

export function stringField(node: unknown, ...keys: string[]): string | null {
  const v = field(node, ...keys);
  return typeof v === 'string' && v !== '' ? v : null;
}

export function numberField(node: unknown, ...keys: string[]): number | null {
  const v = field(node, ...keys);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
