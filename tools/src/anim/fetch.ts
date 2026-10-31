/**
 * The libraries come from their own pages, never from the repo: a library's archive is downloaded by URL (a free
 * itch.io upload: the page's own download flow, no account), refused unless its byte count and sha256 are the ones in
 * tools/anim/libraries.json, and only the in-place glb and the licence are unpacked into tools/.cache/anim/lib/<id>/.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { CACHE_DIR, type Library, type ModelPack } from './clip.js';
import { zipEntries, zipFile, zipRead } from './zip.js';

export const LIB_DIR = join(CACHE_DIR, 'lib');

export const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/** Why these bytes are not the library's archive; empty when they are. */
export function archiveProblems(buf: Buffer, lib: Library): string[] {
  const out: string[] = [];
  if (buf.length !== lib.bytes) out.push(`${buf.length} bytes, expected ${lib.bytes}`);
  const sum = sha256(buf);
  if (sum !== lib.sha256) out.push(`sha256 ${sum}, expected ${lib.sha256}`);
  return out;
}

/** Where a library's glb lands once fetched, and whether it is there and checked. */
export function libraryGlb(id: string, lib: Library): { path: string; ready: boolean } {
  const path = join(LIB_DIR, id, basename(lib.glb));
  const stamp = join(LIB_DIR, id, 'sha256');
  return { path, ready: existsSync(path) && existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === lib.sha256 };
}

/** Unpack the glb and the licence of a checked archive. */
export function unpack(id: string, lib: Library, archive: Buffer): string {
  const problems = archiveProblems(archive, lib);
  if (problems.length > 0) throw new Error(`${id}: refused, the archive is not the one in libraries.json (${problems.join('; ')})`);
  const dir = join(LIB_DIR, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, basename(lib.glb)), zipFile(archive, lib.glb));
  writeFileSync(join(dir, 'License.txt'), zipFile(archive, lib.licence_file));
  writeFileSync(join(dir, 'sha256'), `${lib.sha256}\n`);
  return join(dir, basename(lib.glb));
}

// ------------------------------------------------------------------ model packs (races)

export const MODEL_DIR = join(CACHE_DIR, 'models');

/** Why these bytes are not the pack in libraries.json; empty when they are. */
export function packProblems(buf: Buffer, pack: ModelPack): string[] {
  const out: string[] = [];
  if (buf.length !== pack.bytes) out.push(`${buf.length} bytes, expected ${pack.bytes}`);
  const sum = sha256(buf);
  if (sum !== pack.sha256) out.push(`sha256 ${sum}, expected ${pack.sha256}`);
  return out;
}

/** Where a pack lands once fetched, and whether it is there and checked. */
export function modelDir(id: string, pack: ModelPack): { dir: string; ready: boolean } {
  const dir = join(MODEL_DIR, id);
  const stamp = join(dir, 'sha256');
  return { dir, ready: existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === pack.sha256 };
}

/** Unpack a checked pack: the folders it names (paths kept as in the archive) and the licence, or its one file. */
export function unpackModel(id: string, pack: ModelPack, buf: Buffer): string {
  const problems = packProblems(buf, pack);
  if (problems.length > 0) throw new Error(`${id}: refused, the pack is not the one in libraries.json (${problems.join('; ')})`);
  const dir = join(MODEL_DIR, id);
  mkdirSync(dir, { recursive: true });
  if (pack.file !== undefined) writeFileSync(join(dir, pack.file), buf);
  else {
    const wanted = [...(pack.unpack ?? []), ...(pack.licence_file ? [pack.licence_file] : [])];
    for (const e of zipEntries(buf)) {
      if (e.name.endsWith('/') || !wanted.some((w) => e.name.startsWith(w))) continue;
      const to = join(dir, e.name);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, zipRead(buf, e));
    }
  }
  writeFileSync(join(dir, 'sha256'), `${pack.sha256}\n`);
  return dir;
}

/** A file by its URL (a poly.pizza model). */
export async function urlDownload(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'user-agent': AGENT } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ------------------------------------------------------------------ itch.io, a free upload

class Jar {
  private readonly cookies = new Map<string, string>();
  take(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(';')[0] ?? '';
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

const AGENT = 'Mozilla/5.0 (X11; Linux x86_64) loomvale-tools-anim';

function csrf(html: string): string {
  const m = /name="csrf_token" value="([^"]+)"/.exec(html);
  if (m?.[1] === undefined) throw new Error('the page has no csrf token');
  return m[1];
}

/** The upload ids and names on an itch.io download page, in page order. */
export function itchUploads(html: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const m of html.matchAll(/data-upload_id="(\d+)"/g)) {
    const seg = html.slice(m.index ?? 0, (m.index ?? 0) + 1500);
    const name = /<strong[^>]*class="name"[^>]*>([^<]+)<\/strong>/.exec(seg)?.[1]?.trim();
    if (m[1] !== undefined && name !== undefined) out.push({ id: m[1], name });
  }
  return out;
}

/** Download a free itch.io upload by its page and exact upload name. */
export async function itchDownload(page: string, upload: string): Promise<Buffer> {
  const jar = new Jar();
  const get = async (url: string): Promise<string> => {
    const res = await fetch(url, { headers: { 'user-agent': AGENT, cookie: jar.header() } });
    jar.take(res);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
  };
  const post = async (url: string, token: string, referer: string): Promise<Record<string, unknown>> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'user-agent': AGENT, cookie: jar.header(), referer, 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf_token: token }).toString(),
    });
    jar.take(res);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
  const base = page.replace(/\/+$/, '');
  const pageHtml = await get(base);
  const dlUrl = (await post(`${base}/download_url`, csrf(pageHtml), base)).url;
  if (typeof dlUrl !== 'string') throw new Error(`${base}: no download page (is the upload still free?)`);
  const dlHtml = await get(dlUrl);
  const found = itchUploads(dlHtml).find((u) => u.name === upload);
  if (found === undefined) throw new Error(`${base}: no upload named "${upload}" (found: ${itchUploads(dlHtml).map((u) => u.name).join(', ')})`);
  const file = await post(`${base}/file/${found.id}?source=game_download`, csrf(dlHtml), dlUrl);
  if (typeof file.url !== 'string') throw new Error(`${base}: the file link was refused (${JSON.stringify(file).slice(0, 200)})`);
  const res = await fetch(file.url, { headers: { 'user-agent': AGENT } });
  if (!res.ok) throw new Error(`${upload}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
