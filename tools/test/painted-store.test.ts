import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { type BlobSource, type Manifest, fetchAll, fetchPainted, makeManifest, manifestProblems, readSet, sha256, storeSource } from '../src/painted-store';

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
function tmp(): string {
  const r = mkdtempSync(join(tmpdir(), 'painted-store-'));
  roots.push(r);
  return r;
}
function put(path: string, data: string | Uint8Array): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, data);
}

/** a scene folder cut into units: what a page reads, and two whole layers it does not */
function scene(root: string, tiled = true): string {
  const dir = join(root, 'scene');
  put(join(dir, 'scene.json'), JSON.stringify({ id: 'test-vale', ...(tiled ? { tiles: { format: 1 } } : {}) }));
  put(join(dir, 'water.json'), '[1,2,3]');
  put(join(dir, 'figures', 'lynx.json'), '{}');
  put(join(dir, 'figures', 'walk.png'), new Uint8Array([1, 2, 3, 4]));
  put(join(dir, 'tiles', 'ground-0-0.webp'), new Uint8Array(3000).map((_, i) => i % 251));
  put(join(dir, 'tiles', 'alpha-0-0.bin'), new Uint8Array([9, 9, 9]));
  put(join(dir, 'ground.png'), new Uint8Array(500).fill(7));
  put(join(dir, 'objects.png'), new Uint8Array(400).fill(8));
  return dir;
}

/** a source that counts its reads */
function counted(src: BlobSource): { source: BlobSource; reads: () => number } {
  let n = 0;
  return {
    source: async (sum) => {
      n++;
      return src(sum);
    },
    reads: () => n,
  };
}

describe('the read set and the manifest', () => {
  it('a land cut into units lists the scene, the water, the figures and the units, never the whole layers', () => {
    const dir = scene(tmp());
    expect(readSet(dir)).toEqual(['figures/lynx.json', 'figures/walk.png', 'scene.json', 'tiles/alpha-0-0.bin', 'tiles/ground-0-0.webp', 'water.json']);
  });

  it('a land laid whole lists every file', () => {
    const dir = scene(tmp(), false);
    expect(readSet(dir)).toContain('ground.png');
    expect(readSet(dir)).toHaveLength(8);
  });

  it('every line holds the file\'s own size and sha256, and the store holds each file under its sha256', () => {
    const root = tmp();
    const dir = scene(root);
    const store = join(root, 'store');
    const m = makeManifest(dir, store);
    expect(m.scene).toBe('test-vale');
    expect(manifestProblems(m)).toEqual([]);
    for (const f of m.files) {
      const buf = readFileSync(join(dir, f.path));
      expect([f.bytes, f.sha256]).toEqual([buf.length, sha256(buf)]);
      expect(readFileSync(join(store, f.sha256)).equals(buf)).toBe(true);
    }
    expect(readdirSync(store)).toHaveLength(m.files.length);
  });

  it('a broken manifest is named line by line', () => {
    const bad = { format: 1, scene: 'Vale', files: [{ path: '../x', bytes: -1, sha256: 'abc' }, { path: 'a', bytes: 1, sha256: 'f'.repeat(64) }, { path: 'a', bytes: 1, sha256: 'f'.repeat(64) }] };
    expect(manifestProblems(bad)).toEqual([
      'scene must be lowercase letters, digits and dashes',
      '../x: a path inside the scene folder, with forward slashes',
      '../x: sha256 must be 64 lowercase hex',
      '../x: bytes must be a whole number',
      'a: listed twice',
    ]);
    expect(manifestProblems({ format: 2 })).toEqual(['format must be 1']);
  });
});

describe('the fetch', () => {
  function setup(): { root: string; m: Manifest; store: string; cache: string; out: string } {
    const root = tmp();
    const store = join(root, 'store');
    const m = makeManifest(scene(root), store);
    return { root, m, store, cache: join(root, 'cache'), out: join(root, 'public', 'painted') };
  }

  it('places every file beside the page byte for byte, then takes them from what is in place and from the cache, never the store again', async () => {
    const { m, store, cache, out } = setup();
    const src = counted(storeSource(store));
    const first = await fetchPainted(m, { source: src.source, cache, out });
    expect(first).toMatchObject({ files: 6, fetched: 6, cached: 0, kept: 0, removed: 0 });
    for (const f of m.files) expect(sha256(readFileSync(join(out, 'test-vale', f.path)))).toBe(f.sha256);
    const again = await fetchPainted(m, { source: src.source, cache, out });
    expect(again).toMatchObject({ fetched: 0, kept: 6 });
    // the page's folder cleared: everything comes back from the cache, the store is not read
    rmSync(out, { recursive: true });
    const fromCache = await fetchPainted(m, { source: src.source, cache, out });
    expect(fromCache).toMatchObject({ fetched: 0, cached: 6 });
    expect(src.reads()).toBe(6);
  });

  it('one changed byte in the store fails the run naming the file, and the file is neither placed nor cached', async () => {
    const { m, store, cache, out } = setup();
    const unit = m.files.find((f) => f.path === 'tiles/ground-0-0.webp')!;
    const blob = readFileSync(join(store, unit.sha256));
    blob[1234] = (blob[1234]! + 1) % 256;
    writeFileSync(join(store, unit.sha256), blob);
    await expect(fetchPainted(m, { source: storeSource(store), cache, out, atOnce: 1 })).rejects.toThrow(/^tiles\/ground-0-0\.webp: the store gave 3000 bytes/);
    expect(existsSync(join(out, 'test-vale', 'tiles', 'ground-0-0.webp'))).toBe(false);
    expect(existsSync(join(cache, unit.sha256))).toBe(false);
  });

  it('a changed byte in the cache or in place is not trusted: the file is read again', async () => {
    const { m, store, cache, out } = setup();
    await fetchPainted(m, { source: storeSource(store), cache, out });
    const unit = m.files.find((f) => f.path === 'tiles/ground-0-0.webp')!;
    const placed = join(out, 'test-vale', 'tiles', 'ground-0-0.webp');
    const spoiled = readFileSync(placed);
    spoiled[0] = (spoiled[0]! + 1) % 256;
    writeFileSync(placed, spoiled);
    writeFileSync(join(cache, unit.sha256), spoiled);
    const src = counted(storeSource(store));
    expect(await fetchPainted(m, { source: src.source, cache, out })).toMatchObject({ fetched: 1, kept: 5 });
    expect(sha256(readFileSync(placed))).toBe(unit.sha256);
    expect(sha256(readFileSync(join(cache, unit.sha256)))).toBe(unit.sha256);
  });

  it('the scene\'s folder holds exactly the manifest: a stale file goes, another scene\'s folder stays', async () => {
    const { m, store, cache, out } = setup();
    put(join(out, 'test-vale', 'tiles', 'old-9-9.webp'), 'old');
    put(join(out, 'test-vale', 'gone', 'deep.png'), 'old');
    put(join(out, 'another', 'scene.json'), '{}');
    expect(await fetchPainted(m, { source: storeSource(store), cache, out })).toMatchObject({ removed: 2 });
    expect(existsSync(join(out, 'test-vale', 'gone'))).toBe(false);
    expect(existsSync(join(out, 'another', 'scene.json'))).toBe(true);
  });

  it('a store that is an address serves the same blobs', async () => {
    const { m, store, cache, out } = setup();
    const server = createServer((req, res) => {
      const sum = (req.url ?? '').split('/').pop() ?? '';
      const path = join(store, sum);
      if (!/^[0-9a-f]{64}$/.test(sum) || !existsSync(path)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200);
      res.end(readFileSync(path));
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    try {
      const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/store/`;
      expect(await fetchPainted(m, { source: storeSource(base), cache, out })).toMatchObject({ fetched: 6 });
      const missing = { ...m, files: [{ path: 'x.png', bytes: 1, sha256: 'a'.repeat(64) }] };
      await expect(fetchPainted(missing, { source: storeSource(base), cache, out })).rejects.toThrow('the store answered 404');
    } finally {
      server.close();
    }
  });

  it('with no store named, the run says so and places nothing; required, it fails', async () => {
    const { root, m, store, cache, out } = setup();
    const manifests = join(root, 'manifests');
    put(join(manifests, 'test-vale.json'), JSON.stringify(m));
    expect(await fetchAll({ manifestDir: manifests, cache, out })).toEqual([`painted test-vale: no store named (PAINTED_STORE or the manifest's store), so its 6 pictures are not placed`]);
    expect(existsSync(out)).toBe(false);
    await expect(fetchAll({ manifestDir: manifests, cache, out, required: true })).rejects.toThrow('no store named');
    expect(await fetchAll({ manifestDir: manifests, cache, out, store })).toEqual(['painted test-vale: 6 files, 0.0 MB (0 in place, 0 from the cache, 6 from the store)']);
    // the manifest's own store, when nothing overrides it
    put(join(manifests, 'test-vale.json'), JSON.stringify({ ...m, store }));
    expect(await fetchAll({ manifestDir: manifests, cache, out })).toEqual(['painted test-vale: 6 files, 0.0 MB (6 in place, 0 from the cache, 0 from the store)']);
    // no manifests folder: nothing to do
    expect(await fetchAll({ manifestDir: join(root, 'none'), cache, out })).toEqual([]);
  });

  it('a manifest that names its store fails the run on any picture the store does not give whole, with no PAINTED_REQUIRED', async () => {
    const { root, m, store, cache, out } = setup();
    const manifests = join(root, 'manifests');
    const unit = m.files.find((f) => f.path === 'tiles/ground-0-0.webp')!;
    const blob = readFileSync(join(store, unit.sha256));
    const run = () => fetchAll({ manifestDir: manifests, cache, out });
    put(join(manifests, 'test-vale.json'), JSON.stringify({ ...m, store }));
    // one blob missing from the store
    rmSync(join(store, unit.sha256));
    await expect(run()).rejects.toThrow(`the store has no ${unit.sha256}`);
    // one byte changed in it
    const spoiled = Uint8Array.from(blob);
    spoiled[7] = (spoiled[7]! + 1) % 256;
    writeFileSync(join(store, unit.sha256), spoiled);
    await expect(run()).rejects.toThrow(/^tiles\/ground-0-0\.webp: the store gave 3000 bytes/);
    expect(existsSync(join(out, 'test-vale', unit.path))).toBe(false);
    // an address that does not answer (a closed port), as a build with no way to the store meets it
    const server = createServer();
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>((ok) => server.close(() => ok()));
    put(join(manifests, 'test-vale.json'), JSON.stringify({ ...m, store: `http://127.0.0.1:${port}/store` }));
    rmSync(cache, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
    await expect(run()).rejects.toThrow(`the store http://127.0.0.1:${port}/store could not be reached`);
    // whole again, the same run passes
    writeFileSync(join(store, unit.sha256), blob);
    put(join(manifests, 'test-vale.json'), JSON.stringify({ ...m, store }));
    expect(await run()).toEqual(['painted test-vale: 6 files, 0.0 MB (0 in place, 0 from the cache, 6 from the store)']);
  });
});
