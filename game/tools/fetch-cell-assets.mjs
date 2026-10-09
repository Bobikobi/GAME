#!/usr/bin/env node
/* global fetch, Buffer, console */
/**
 * Downloads the CC0 Poly Haven assets of the 3D cell trial (game/cell.html)
 * into game/public/3d/cell/, which git ignores: photoscanned models, PBR
 * ground textures and two skies, all at 1k. The scanned meshes are far too
 * dense for a browser (a tree is a million triangles), so each model is
 * thinned with gltf-transform to the budget below and saved as one .glb.
 * The leaf cards (grass, fern, moss) cut their shape with an alpha map that
 * the 1k gltf drops (it ships the diffuse as a jpg), so that map is fetched
 * on its own next to the model.
 * Run it once before `pnpm dev` or `pnpm --filter game build`; what exists
 * is not fetched or thinned again.
 *
 *   node game/tools/fetch-cell-assets.mjs
 *
 * Everything comes from https://polyhaven.com (CC0), through its public API;
 * the thinning uses npx @gltf-transform/cli (fetched by npx on first use).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '3d', 'cell');
const API = 'https://api.polyhaven.com/files/';

/** model id -> the triangle budget it is thinned to */
const MODELS = {
  island_tree_02: 70_000,
  fir_sapling_medium: 45_000,
  tree_stump_01: 12_000,
  rock_moss_set_01: 20_000,
  namaqualand_boulder_02: 15_000,
  fern_02: 6_000,
  grass_medium_01: 4_000,
  shrub_02: 12_000,
  stone_fire_pit: 15_000,
  Lantern_01: 10_000,
  dead_tree_trunk: 20_000,
  moss_01: 6_000,
  flower_gazania: 6_000,
};
const TEXTURES = ['leafy_grass', 'forest_ground_04', 'forrest_sand_01'];
const SKIES = ['kloofendal_48d_partly_cloudy_puresky', 'kloppenheim_07_puresky'];

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function save(url, path) {
  if (await exists(path)) return false;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return true;
}

/** the triangles of a .gltf, from its accessors */
async function triangles(gltfPath) {
  const json = JSON.parse(await readFile(gltfPath, 'utf8'));
  let n = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = prim.indices !== undefined ? json.accessors?.[prim.indices] : json.accessors?.[prim.attributes?.POSITION];
      if (acc) n += acc.count / 3;
    }
  }
  return Math.round(n);
}

function transform(args) {
  execFileSync('npx', ['--yes', '@gltf-transform/cli@4', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

const manifest = { source: 'https://polyhaven.com', license: 'CC0', models: {}, alpha: {}, textures: {}, skies: {} };
let fetched = 0;

for (const [id, budget] of Object.entries(MODELS)) {
  const glb = join(OUT, 'models', `${id}.glb`);
  manifest.models[id] = `models/${id}.glb`;
  const files = await fetchJson(API + id);
  const alpha = files.Alpha?.['1k']?.jpg?.url;
  if (alpha) {
    const name = `${id}_alpha_1k.jpg`;
    if (await save(alpha, join(OUT, 'textures', name))) fetched++;
    manifest.alpha[id] = `textures/${name}`;
  }
  if (await exists(glb)) {
    console.log(`model ${id}: ready`);
    continue;
  }
  const g = files.gltf?.['1k']?.gltf;
  if (!g) throw new Error(`${id}: no 1k gltf`);
  const raw = join(OUT, 'raw', id);
  const main = g.url.split('/').pop();
  if (await save(g.url, join(raw, main))) fetched++;
  for (const [rel, f] of Object.entries(g.include ?? {})) {
    if (await save(f.url, join(raw, rel))) fetched++;
  }
  const tris = await triangles(join(raw, main));
  const ratio = Math.min(1, budget / Math.max(tris, 1));
  await mkdir(dirname(glb), { recursive: true });
  if (ratio < 0.95) transform(['simplify', join(raw, main), glb, '--ratio', String(ratio), '--error', '0.01']);
  else transform(['copy', join(raw, main), glb]);
  await rm(raw, { recursive: true, force: true });
  console.log(`model ${id}: ${tris} triangles, thinned to ${Math.round(tris * ratio)}${alpha ? ', with its alpha map' : ''}`);
}
await rm(join(OUT, 'raw'), { recursive: true, force: true });

for (const id of TEXTURES) {
  const files = await fetchJson(API + id);
  const g = files.gltf?.['1k']?.gltf;
  if (!g) throw new Error(`${id}: no 1k gltf`);
  const maps = {};
  for (const [rel, f] of Object.entries(g.include ?? {})) {
    const name = rel.split('/').pop();
    if (!/\.(jpg|png)$/i.test(name)) continue;
    if (await save(f.url, join(OUT, 'textures', name))) fetched++;
    const kind = /_diff_/.test(name) ? 'diff' : /_nor_gl_/.test(name) ? 'nor' : /_rough_/.test(name) ? 'rough' : /_arm_/.test(name) ? 'arm' : name;
    maps[kind] = `textures/${name}`;
  }
  manifest.textures[id] = maps;
  console.log(`texture ${id}: ${Object.keys(maps).join(', ')}`);
}

for (const id of SKIES) {
  const files = await fetchJson(API + id);
  const h = files.hdri?.['1k']?.hdr;
  if (!h) throw new Error(`${id}: no 1k hdr`);
  const name = `${id}_1k.hdr`;
  if (await save(h.url, join(OUT, 'sky', name))) fetched++;
  manifest.skies[id] = `sky/${name}`;
  console.log(`sky ${id}`);
}

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`done: ${fetched} files fetched into ${OUT}`);
