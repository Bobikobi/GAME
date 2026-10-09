/**
 * The 3D trial of the valley.
 *
 * The real map of the game (content/core/map.json) drawn as a small 3D scene:
 * painted ground, free CC0 models for the trees, stones and ruins, a character
 * that walks with a thumb or the arrow keys, a camera high behind it the way the
 * old online worlds show the land (zoom with the wheel, a pinch or +/-), and a night.
 * It is a trial of the look only: nothing here reads the rules, the save or
 * the kernel, and the page lives on its own at /3d.html.
 *
 * Under ?e2e the scene advances a fixed 1/30 s per frame, and window.__valley3d
 * lets game/e2e/valley3d.ts walk the character and take the same screenshots
 * on every machine. ?look=b picks the second character, ?zoom=<m> the start distance.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import mapFile from '../../../content/core/map.json';

interface Legend {
  sprite: string;
  solid: boolean;
  tag: string;
}
interface Prop {
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
}
interface Slot {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tag?: string;
  label?: string;
}
interface MapData {
  width: number;
  height: number;
  legend: Record<string, Legend>;
  ground: string[];
  props: Prop[];
  spawn: { x: number; y: number };
  slots: Slot[];
}

interface ValleyApi {
  ready: boolean;
  walk(dx: number, dz: number, frames: number): Promise<void>;
  night(on: boolean): void;
  pos(): [number, number];
  /** what the character is made of, for a check from outside */
  debug(): Record<string, unknown>;
}
declare global {
  interface Window {
    __valley3d?: ValleyApi;
  }
}

const MAP = mapFile.map as unknown as MapData;
const W = MAP.width;
const H = MAP.height;
const PARAMS = new URLSearchParams(location.search);
const FIXED = PARAMS.has('e2e');
const STEP = 1 / 30;

const CHAR_HEIGHT = 1.5;
const SPEED = 2.4;
const RADIUS = 0.28;
const BRIDGE_Y = 0.02;
const WATER_Y = -0.12;
const MODEL_FACING = 0; // the Kenney characters face +z, like rotation.y = atan2(dx, dz) expects

// ---------------------------------------------------------------- the map

type Kind = 'grass' | 'flowers' | 'grove' | 'forest' | 'water' | 'sand' | 'path' | 'cobble' | 'ruin' | 'rubble';
const KIND_BY_SPRITE: Record<string, Kind> = {
  grass: 'grass',
  grass_flowers: 'flowers',
  grove: 'grove',
  forest: 'forest',
  water: 'water',
  sand: 'sand',
  path: 'path',
  cobble: 'cobble',
  ruin_floor: 'ruin',
  rubble: 'rubble',
};

const kinds: Kind[] = [];
const solidTile: boolean[] = [];
for (let z = 0; z < H; z++) {
  const row = MAP.ground[z] ?? '';
  for (let x = 0; x < W; x++) {
    const legend = MAP.legend[row[x] ?? 'T'];
    const name = legend?.sprite.split('/').pop() ?? 'forest';
    kinds.push(KIND_BY_SPRITE[name] ?? 'grass');
    solidTile.push(legend?.solid ?? true);
  }
}
function kindAt(x: number, z: number): Kind {
  if (x < 0 || z < 0 || x >= W || z >= H) return 'forest';
  return kinds[z * W + x] ?? 'forest';
}

const bridgeSlot = MAP.slots.find((s) => s.id === 'core/old-bridge');
const BRIDGE = bridgeSlot
  ? { x0: bridgeSlot.x - 0.8, x1: bridgeSlot.x + bridgeSlot.w + 0.8, z0: bridgeSlot.y, z1: bridgeSlot.y + bridgeSlot.h }
  : { x0: 0, x1: 0, z0: 0, z1: 0 };
function onBridge(x: number, z: number): boolean {
  return x >= BRIDGE.x0 && x < BRIDGE.x1 && z >= BRIDGE.z0 && z < BRIDGE.z1;
}

// ------------------------------------------------------------ the heights

function hash(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
function noise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const sx = smooth(x - x0);
  const sz = smooth(z - z0);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sz);
}

const BUILT: Kind[] = ['path', 'cobble', 'ruin', 'rubble'];
const corner = new Float32Array((W + 1) * (H + 1));
for (let cz = 0; cz <= H; cz++) {
  for (let cx = 0; cx <= W; cx++) {
    let y = noise(cx * 0.23, cz * 0.23) * 0.45 + noise(cx * 0.9 + 5, cz * 0.9 + 5) * 0.06;
    const touching = [kindAt(cx - 1, cz - 1), kindAt(cx, cz - 1), kindAt(cx - 1, cz), kindAt(cx, cz)];
    if (touching.includes('water')) y = -0.55;
    else if (touching.every((k) => BUILT.includes(k))) y *= 0.4;
    corner[cz * (W + 1) + cx] = y;
  }
}
function cornerY(cx: number, cz: number): number {
  const x = Math.min(W, Math.max(0, cx));
  const z = Math.min(H, Math.max(0, cz));
  return corner[z * (W + 1) + x] ?? 0;
}
function groundY(x: number, z: number): number {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  const fx = x - tx;
  const fz = z - tz;
  const top = THREE.MathUtils.lerp(cornerY(tx, tz), cornerY(tx + 1, tz), fx);
  const bottom = THREE.MathUtils.lerp(cornerY(tx, tz + 1), cornerY(tx + 1, tz + 1), fx);
  return THREE.MathUtils.lerp(top, bottom, fz);
}
function walkY(x: number, z: number): number {
  const y = groundY(x, z);
  return onBridge(x, z) ? Math.max(y, BRIDGE_Y) : y;
}

// ----------------------------------------------------------- the random

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(list: readonly [T, ...T[]], r: () => number): T {
  return list[Math.floor(r() * list.length)] ?? list[0];
}

// ------------------------------------------------------------ the ground

const ATLAS = 256;
const CELL = 64;
const COLS = 4;
const CELL_OF: Record<Kind, number> = {
  grass: 0,
  flowers: 1,
  sand: 2,
  path: 3,
  cobble: 4,
  ruin: 5,
  rubble: 6,
  water: 7,
  forest: 8,
  grove: 9,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function slabs(ctx: CanvasRenderingContext2D, cell: number, size: number, gap: number, dark: string, tones: readonly [string, ...string[]], r: () => number): void {
  const ox = (cell % COLS) * CELL;
  const oy = Math.floor(cell / COLS) * CELL;
  ctx.fillStyle = dark;
  ctx.fillRect(ox, oy, CELL, CELL);
  for (let y = 0; y < CELL; y += size) {
    for (let x = 0; x < CELL; x += size) {
      ctx.fillStyle = pick(tones, r);
      ctx.fillRect(ox + x + gap, oy + y + gap, size - gap * 2, size - gap * 2);
    }
  }
}

function tint(ctx: CanvasRenderingContext2D, cell: number, source: HTMLImageElement, color: string): void {
  const ox = (cell % COLS) * CELL;
  const oy = Math.floor(cell / COLS) * CELL;
  ctx.drawImage(source, ox, oy, CELL, CELL);
  ctx.fillStyle = color;
  ctx.fillRect(ox, oy, CELL, CELL);
}

async function buildAtlas(): Promise<THREE.CanvasTexture> {
  const [grass, flowers, sand, path] = await Promise.all(
    ['grass', 'grass_flowers', 'sand', 'path'].map((t) => loadImage(`./3d/tiles/${t}.png`)),
  );
  if (!grass || !flowers || !sand || !path) throw new Error('the painted tiles did not load');
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  const r = mulberry32(11);
  ctx.drawImage(grass, 0, 0, CELL, CELL);
  ctx.drawImage(flowers, CELL, 0, CELL, CELL);
  ctx.drawImage(sand, CELL * 2, 0, CELL, CELL);
  ctx.drawImage(path, CELL * 3, 0, CELL, CELL);
  slabs(ctx, CELL_OF.cobble, 16, 2, '#4f4c45', ['#8b867b', '#9a9489', '#7d786e', '#a39d91'], r);
  slabs(ctx, CELL_OF.ruin, 32, 3, '#4a5244', ['#7f8574', '#8a9080', '#737a6a'], r);
  slabs(ctx, CELL_OF.rubble, 32, 3, '#4a5244', ['#7f8574', '#8a9080', '#737a6a'], r);
  ctx.fillStyle = '#3f4639';
  for (let i = 0; i < 9; i++) {
    const ox = (CELL_OF.rubble % COLS) * CELL + r() * 50;
    const oy = Math.floor(CELL_OF.rubble / COLS) * CELL + r() * 50;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + 6 + r() * 8, oy + 2);
    ctx.lineTo(ox + 3, oy + 6 + r() * 8);
    ctx.fill();
  }
  tint(ctx, CELL_OF.water, sand, 'rgba(30, 70, 110, 0.55)');
  tint(ctx, CELL_OF.forest, grass, 'rgba(8, 28, 14, 0.42)');
  tint(ctx, CELL_OF.grove, grass, 'rgba(16, 48, 20, 0.22)');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function buildGround(atlas: THREE.CanvasTexture): THREE.Mesh {
  const tiles = W * H;
  const positions = new Float32Array(tiles * 6 * 3);
  const normals = new Float32Array(tiles * 6 * 3);
  const uvs = new Float32Array(tiles * 6 * 2);
  const colors = new Float32Array(tiles * 6 * 3);
  const r = mulberry32(3);
  const inset = 1.5 / ATLAS;
  let v = 0;
  const normalAt = (cx: number, cz: number): THREE.Vector3 =>
    new THREE.Vector3(cornerY(cx - 1, cz) - cornerY(cx + 1, cz), 2, cornerY(cx, cz - 1) - cornerY(cx, cz + 1)).normalize();
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const kind = kindAt(x, z);
      const cell = CELL_OF[kind];
      const u0 = ((cell % COLS) * CELL) / ATLAS + inset;
      const u1 = ((cell % COLS) * CELL + CELL) / ATLAS - inset;
      const v0 = 1 - (Math.floor(cell / COLS) * CELL) / ATLAS - inset;
      const v1 = 1 - (Math.floor(cell / COLS) * CELL + CELL) / ATLAS + inset;
      // the four corners, then the uv corners turned a random quarter so the tiles do not line up
      const corners: [number, number][] = [
        [x, z],
        [x + 1, z],
        [x, z + 1],
        [x + 1, z + 1],
      ];
      const uvRing: [number, number][] = [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ];
      // the built ground keeps its direction; the natural ground is turned so the tiles do not line up
      const turn = BUILT.includes(kind) ? 0 : Math.floor(r() * 4);
      const uvOf = (i: number): [number, number] => uvRing[(i + turn) % 4] ?? [u0, v0];
      // corner order a b c d maps to the ring a b d c
      const uvByCorner: [number, number][] = [uvOf(0), uvOf(1), uvOf(3), uvOf(2)];
      const shade = 0.9 + r() * 0.1;
      const order = [0, 2, 1, 1, 2, 3];
      for (const i of order) {
        const c = corners[i] ?? [x, z];
        const uv = uvByCorner[i] ?? [u0, v0];
        positions[v * 3] = c[0];
        positions[v * 3 + 1] = cornerY(c[0], c[1]);
        positions[v * 3 + 2] = c[1];
        const n = normalAt(c[0], c[1]);
        normals[v * 3] = n.x;
        normals[v * 3 + 1] = n.y;
        normals[v * 3 + 2] = n.z;
        uvs[v * 2] = uv[0];
        uvs[v * 2 + 1] = uv[1];
        colors[v * 3] = shade;
        colors[v * 3 + 1] = shade;
        colors[v * 3 + 2] = shade;
        v++;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------ the models

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}
interface Model {
  parts: Part[];
  /** the size after the model is scaled to a height of 1 and set on the ground */
  size: THREE.Vector3;
}

const loader = new GLTFLoader();
const models = new Map<string, Model>();

async function loadModel(name: string): Promise<Model> {
  const gltf = await loader.loadAsync(`./3d/models/${name}.glb`);
  gltf.scene.updateMatrixWorld(true);
  const parts: Part[] = [];
  const box = new THREE.Box3();
  gltf.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geometry = (obj.geometry as THREE.BufferGeometry).clone().applyMatrix4(obj.matrixWorld);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) box.union(geometry.boundingBox);
    const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (material) parts.push({ geometry, material: material as THREE.Material });
  });
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 1 / Math.max(size.y, 1e-6);
  const fit = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
  for (const part of parts) part.geometry.applyMatrix4(fit);
  return { parts, size: size.multiplyScalar(s) };
}

interface Placement {
  name: string;
  x: number;
  y: number;
  z: number;
  height: number;
  rot: number;
  sx: number;
  sz: number;
}

const placements: Placement[] = [];
/** Places a model with its feet at (x, z) on the ground; height in metres, rot about y. */
function place(name: string, x: number, z: number, height: number, rot = 0, extra: { y?: number; sx?: number; sz?: number } = {}): void {
  placements.push({ name, x, z, y: extra.y ?? groundY(x, z), height, rot, sx: extra.sx ?? 1, sz: extra.sz ?? 1 });
}

async function buildInstances(scene: THREE.Scene): Promise<void> {
  const names = [...new Set(placements.map((p) => p.name))];
  await Promise.all(
    names.map(async (name) => {
      if (!models.has(name)) models.set(name, await loadModel(name));
    }),
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  for (const name of names) {
    const model = models.get(name);
    if (!model) continue;
    const list = placements.filter((p) => p.name === name);
    for (const part of model.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(axis, p.rot);
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.height * p.sx, p.height, p.height * p.sz));
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

/** One copy of a model with its own materials, for things that change (the glow mushrooms). */
function standalone(model: Model, x: number, z: number, height: number, rot = 0): THREE.Group {
  const group = new THREE.Group();
  for (const part of model.parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.position.set(x, groundY(x, z), z);
  group.rotation.y = rot;
  group.scale.setScalar(height);
  return group;
}

// ---------------------------------------------------- the built things

const plaster = new THREE.MeshStandardMaterial({ color: 0xe9d6ad, roughness: 0.9 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.8 });
const roofWood = new THREE.MeshStandardMaterial({ color: 0x6e4226, roughness: 0.85 });
const stone = new THREE.MeshStandardMaterial({ color: 0x8d8a82, roughness: 0.95 });
const glass = new THREE.MeshStandardMaterial({ color: 0x8fb7d6, roughness: 0.3, metalness: 0.1 });

function shadowed(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function house(p: Prop): THREE.Group {
  const g = new THREE.Group();
  const cx = p.x + p.w / 2;
  const cz = p.y + p.h / 2;
  const base = groundY(cx, cz) - 0.05;
  const bw = p.w - 0.3;
  const bd = p.h - 0.3;
  const bh = 1.7;
  const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), plaster));
  walls.position.set(cx, base + bh / 2, cz);
  const roof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.4, bd * 0.85, bd * 0.85), roofWood));
  roof.rotation.x = Math.PI / 4;
  roof.position.set(cx, base + bh - 0.2, cz);
  const door = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.06), woodDark));
  door.position.set(cx, base + 0.55, cz + bd / 2 + 0.02);
  g.add(walls, roof, door);
  for (const dx of [-0.85, 0.85]) {
    const win = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.06), glass));
    win.position.set(cx + dx, base + 1.05, cz + bd / 2 + 0.02);
    g.add(win);
  }
  return g;
}

function well(p: Prop): THREE.Group {
  const g = new THREE.Group();
  const cx = p.x + p.w / 2;
  const cz = p.y + p.h / 2;
  const base = groundY(cx, cz) - 0.05;
  const ring = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.5, 12), stone));
  ring.position.set(cx, base + 0.25, cz);
  g.add(ring);
  for (const dx of [-0.5, 0.5]) {
    const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), woodDark));
    post.position.set(cx + dx, base + 0.65, cz);
    g.add(post);
  }
  const roof = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.45, 4), roofWood));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(cx, base + 1.5, cz);
  g.add(roof);
  return g;
}

function lintel(p: Prop): THREE.Mesh {
  const cx = p.x + p.w / 2;
  const cz = p.y + p.h / 2;
  const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(p.w - 0.2, 0.35, 0.5), stone));
  beam.position.set(cx, groundY(cx, cz) + 2.2 + 0.17, cz);
  return beam;
}

// --------------------------------------------------------------- the scene

const FOREST_TREES = ['tree_pineTallA', 'tree_pineRoundA', 'tree_default', 'tree_oak_dark', 'tree_detailed', 'tree_tall', 'tree_fat'] as const;
const GROVE_TREES = ['tree_default', 'tree_oak', 'tree_detailed'] as const;
const FLOWERS = ['flower_redA', 'flower_yellowA', 'flower_purpleA'] as const;
const ROCKS = ['rock_smallA', 'rock_smallB', 'stone_largeA', 'rock_largeA', 'rock_largeB'] as const;
const MUSHROOMS = ['mushroom_redGroup', 'mushroom_tanGroup', 'mushroom_red'] as const;

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
const solids: Rect[] = [];

function scatter(r: () => number, slot: Slot, names: readonly [string, ...string[]], count: number, h0: number, h1: number): void {
  for (let i = 0; i < count; i++) {
    const x = slot.x + 0.4 + r() * (slot.w - 0.8);
    const z = slot.y + 0.4 + r() * (slot.h - 0.8);
    place(pick(names, r), x, z, h0 + r() * (h1 - h0), r() * Math.PI * 2);
  }
}

function layoutTiles(): void {
  const r = mulberry32(2026);
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const kind = kindAt(x, z);
      const cx = x + 0.5 + (r() - 0.5) * 0.6;
      const cz = z + 0.5 + (r() - 0.5) * 0.6;
      const rot = r() * Math.PI * 2;
      switch (kind) {
        case 'forest':
          if (r() < 0.75) place(pick(FOREST_TREES, r), cx, cz, 2.4 + r() * 1.4, rot);
          if (r() < 0.3) place(r() < 0.5 ? 'plant_bush' : 'grass_large', x + 0.5 + (r() - 0.5) * 0.7, z + 0.5 + (r() - 0.5) * 0.7, 0.45 + r() * 0.3, rot);
          break;
        case 'grove':
          if (r() < 0.1) {
            place(pick(GROVE_TREES, r), cx, cz, 1.9 + r() * 0.6, rot);
            solids.push({ x0: cx - 0.3, z0: cz - 0.3, x1: cx + 0.3, z1: cz + 0.3 });
          }
          if (r() < 0.35) place('grass', cx, cz, 0.3 + r() * 0.15, rot);
          if (r() < 0.12) place(pick(FLOWERS, r), cx, cz, 0.3, rot);
          break;
        case 'flowers':
          for (let i = 0; i < 3; i++) place(pick(FLOWERS, r), x + 0.2 + r() * 0.6, z + 0.2 + r() * 0.6, 0.28 + r() * 0.12, r() * Math.PI * 2);
          break;
        case 'grass':
          if (r() < 0.07) place('grass_leafs', cx, cz, 0.28, rot);
          break;
        case 'sand':
          if (r() < 0.07) place('rock_smallA', cx, cz, 0.22, rot);
          break;
        case 'water':
          if (r() < 0.05) place(r() < 0.5 ? 'lily_small' : 'lily_large', cx, cz, 0.06, rot, { y: WATER_Y + 0.01 });
          break;
        case 'ruin':
          if (r() < 0.04) place('rock_smallB', cx, cz, 0.2, rot);
          break;
        default:
          break;
      }
    }
  }
}

function layoutProps(scene: THREE.Scene, glow: THREE.Group[]): void {
  const r = mulberry32(77);
  for (const p of MAP.props) {
    const name = p.sprite.split('/').pop() ?? '';
    const cx = p.x + p.w / 2;
    const cz = p.y + p.h / 2;
    if (p.solid) solids.push({ x0: p.x, z0: p.y, x1: p.x + p.w, z1: p.y + p.h });
    switch (name) {
      case 'tree_oak':
        place('tree_oak', cx, p.y + p.h - 0.3, 3.4, r() * Math.PI * 2);
        break;
      case 'flowers':
        for (let i = 0; i < 3; i++) place(pick(FLOWERS, r), p.x + 0.2 + r() * 0.6, p.y + 0.2 + r() * 0.6, 0.32, r() * Math.PI * 2);
        break;
      case 'sign':
        place('sign', cx, cz, 1.1, 0);
        break;
      case 'standing_stone':
        place('stone_tallA', cx, cz, 1.6, 0.4);
        break;
      case 'house_small':
        scene.add(house(p));
        break;
      case 'well_old':
        scene.add(well(p));
        break;
      case 'market_stall':
        place('tent_smallOpen', cx, cz, 2.2, Math.PI);
        break;
      case 'ruin_pillar':
        place('statue_column', cx, cz, 2.2, r() * 0.3);
        break;
      case 'broken_statue':
        place('statue_columnDamaged', cx, cz, 1.6, r() * Math.PI * 2);
        break;
      case 'statue_head':
        place('statue_head', cx, cz, 1.2, 0.5);
        break;
      case 'ruin_wall':
        place('statue_block', cx, cz, 1.2, 0, { sx: 1.8, sz: 0.5 });
        break;
      case 'ruin_arch':
        place('statue_column', p.x + 0.35, cz, 2.2);
        place('statue_column', p.x + p.w - 0.35, cz, 2.2);
        scene.add(lintel(p));
        break;
      case 'rubble':
        for (let i = 0; i < 3; i++) place(pick(ROCKS, r), p.x + 0.3 + r() * (p.w - 0.6), p.y + 0.2 + r() * 0.6, 0.3 + r() * 0.2, r() * Math.PI * 2);
        break;
      case 'totem':
        place('statue_obelisk', cx, cz, 2.0, 0);
        break;
      case 'glow_mushrooms': {
        const model = models.get('mushroom_redGroup');
        if (model) {
          const g = standalone(model, cx, cz, 0.5, r() * Math.PI * 2);
          glow.push(g);
          scene.add(g);
        }
        break;
      }
      case 'dead_tree':
        place('stump_oldTall', p.x + 0.6, cz, 1.3, r() * Math.PI * 2);
        place('log', p.x + 1.5, cz + 0.2, 0.35, 0.3);
        break;
      default:
        break;
    }
  }
}

function layoutSlots(scene: THREE.Scene, mists: THREE.Mesh[]): void {
  const r = mulberry32(5);
  for (const slot of MAP.slots) {
    const cx = slot.x + slot.w / 2;
    const cz = slot.y + slot.h / 2;
    switch (slot.id) {
      case 'core/river-stones':
        scatter(r, slot, ROCKS, 6, 0.3, 0.6);
        break;
      case 'core/berry-bushes':
        scatter(r, slot, ['plant_bushDetailed'], 6, 0.8, 1.0);
        break;
      case 'core/fallen-branches':
        scatter(r, slot, ['log'], 3, 0.35, 0.45);
        place('log_stack', cx, cz, 0.5, 0.4);
        break;
      case 'core/wild-herbs':
        scatter(r, slot, ['plant_bush'], 4, 0.45, 0.6);
        scatter(r, slot, FLOWERS, 3, 0.3, 0.35);
        break;
      case 'core/forest-mushrooms':
        scatter(r, slot, MUSHROOMS, 5, 0.35, 0.5);
        break;
      case 'core/sun-bank':
        scatter(r, slot, ['flower_yellowA'], 5, 0.35, 0.45);
        break;
      case 'core/west-glade':
        scatter(r, slot, ['grass_large'], 4, 0.4, 0.5);
        scatter(r, slot, FLOWERS, 2, 0.3, 0.35);
        break;
      case 'core/ruins-garden':
        scatter(r, slot, ['plant_bushLarge'], 3, 0.7, 0.9);
        scatter(r, slot, ROCKS, 2, 0.3, 0.4);
        break;
      case 'core/camp':
        place('campfire_stones', cx, cz, 0.3, 0);
        place('campfire_logs', cx, cz, 0.4, 0.3, { y: groundY(cx, cz) + 0.02 });
        place('tent_detailedClosed', slot.x + 1.2, slot.y + 1.1, 1.6, Math.PI * 0.75);
        place('pot_large', cx + 0.9, cz + 0.4, 0.45, 0);
        place('log', cx - 0.3, cz + 1.0, 0.35, 1.3);
        solids.push({ x0: slot.x + 0.3, z0: slot.y + 0.3, x1: slot.x + 2.1, z1: slot.y + 1.9 });
        break;
      case 'core/old-bridge':
        for (let i = 0; i < 4; i++) place('bridge_wood', BRIDGE.x0 + 0.56 + i * 1.08, cz, 0.44, 0, { y: -0.1 });
        break;
      case 'core/town-square':
      case 'core/ruins-gate':
        break;
      default: {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
        const mist = new THREE.Mesh(new THREE.PlaneGeometry(slot.w, slot.h), mat);
        mist.rotation.x = -Math.PI / 2;
        mist.position.set(cx, groundY(cx, cz) + 0.5, cz);
        mists.push(mist);
        scene.add(mist);
      }
    }
  }
}

// ----------------------------------------------------------- the character

interface Character {
  holder: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
  clips: string[];
}

async function loadCharacter(name: string): Promise<Character> {
  const gltf = await loader.loadAsync(`./3d/models/${name}.glb`);
  const root = gltf.scene;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.frustumCulled = false;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = CHAR_HEIGHT / Math.max(size.y, 1e-6);
  root.scale.setScalar(s);
  root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  const holder = new THREE.Group();
  holder.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const clip = (re: RegExp) => gltf.animations.find((a) => re.test(a.name));
  const idleClip = clip(/^idle$/i) ?? clip(/idle/i);
  const walkClip = clip(/^walk$/i) ?? clip(/walk/i);
  const idle = idleClip ? mixer.clipAction(idleClip) : null;
  const walk = walkClip ? mixer.clipAction(walkClip) : null;
  if (walk) walk.timeScale = 1.3;
  idle?.play();
  return { holder, mixer, idle, walk, clips: gltf.animations.map((a) => a.name) };
}

// ------------------------------------------------------------------ main

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const FEET: [number, number][] = [
  [-RADIUS, -RADIUS],
  [RADIUS, -RADIUS],
  [-RADIUS, RADIUS],
  [RADIUS, RADIUS],
];

function blocked(px: number, pz: number): boolean {
  for (const [ox, oz] of FEET) {
    const x = px + ox;
    const z = pz + oz;
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= W || tz >= H) return true;
    if ((solidTile[tz * W + tx] ?? true) && !onBridge(x, z)) return true;
    for (const s of solids) if (x >= s.x0 && x < s.x1 && z >= s.z0 && z < s.z1) return true;
  }
  return false;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('valley') as HTMLCanvasElement | null;
  const loading = document.getElementById('loading');
  const nightButton = document.getElementById('night');
  const stickEl = document.getElementById('stick');
  const knob = stickEl?.querySelector('i') ?? null;
  if (!canvas) throw new Error('no canvas');

  const mobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const dayFog = new THREE.Color(0xcfe0f0);
  const nightFog = new THREE.Color(0x0e1530);
  const fog = new THREE.FogExp2(dayFog.getHex(), 0.009);
  scene.fog = fog;
  const background = new THREE.Color().copy(dayFog);
  scene.background = background;

  // the camera sits high behind the character and looks down at the land, like the
  // old online worlds; zoom is the distance to the character, PITCH the angle down
  const portrait = () => window.innerWidth < window.innerHeight;
  const camera = new THREE.PerspectiveCamera(portrait() ? 55 : 45, window.innerWidth / window.innerHeight, 0.1, 160);
  const ZOOM_MIN = 4;
  const ZOOM_MAX = 18;
  const PITCH = 0.62;
  const clampZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  let zoom = clampZoom(Number(PARAMS.get('zoom')) || 11);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b8f4a, 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const lantern = new THREE.PointLight(0xffb866, 0, 9, 2);
  lantern.position.set(0.35, 1.4, 0.25);

  // the ground and the water
  const atlas = await buildAtlas();
  atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene.add(buildGround(atlas));
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2c4327, roughness: 1 }));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set(W / 2, -0.7, H / 2);
  skirt.receiveShadow = true;
  scene.add(skirt);
  const waterTexture = await new THREE.TextureLoader().loadAsync('./3d/tiles/water.png');
  waterTexture.colorSpace = THREE.SRGBColorSpace;
  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(W / 2, H / 2);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: waterTexture, color: 0x9fd0ff, transparent: true, opacity: 0.86, roughness: 0.25, metalness: 0.1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(W / 2, WATER_Y, H / 2);
  scene.add(water);

  // everything that stands on the ground
  models.set('mushroom_redGroup', await loadModel('mushroom_redGroup'));
  const glow: THREE.Group[] = [];
  const mists: THREE.Mesh[] = [];
  layoutTiles();
  layoutProps(scene, glow);
  layoutSlots(scene, mists);
  await buildInstances(scene);

  // the character
  const hero = await loadCharacter(PARAMS.get('look') === 'b' ? 'character-male-a' : 'character-female-a');
  hero.holder.add(lantern);
  scene.add(hero.holder);
  const pos = new THREE.Vector3(MAP.spawn.x + 0.5, 0, MAP.spawn.y + 0.5);
  pos.y = walkY(pos.x, pos.z);
  let yaw = Math.PI / 2;
  let camYaw = yaw;
  let walking = false;

  // input: a thumb anywhere, or the arrow keys / WASD; n for night;
  // zoom with two fingers, the wheel, or + and -
  const stick = { x: 0, y: 0 };
  const keys = { x: 0, y: 0 };
  const held = new Set<string>();
  let stickId: number | null = null;
  const origin = { x: 0, y: 0 };
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: number | null = null;
  const span = (): number => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const dropStick = () => {
    stickId = null;
    stick.x = 0;
    stick.y = 0;
    if (stickEl) stickEl.style.display = 'none';
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  };
  document.addEventListener('pointerdown', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      // a second finger: the thumb lets go and the two fingers zoom
      dropStick();
      pinch = span();
      return;
    }
    if (pointers.size > 2 || stickId !== null) return;
    stickId = e.pointerId;
    origin.x = e.clientX;
    origin.y = e.clientY;
    stick.x = 0;
    stick.y = 0;
    if (stickEl) {
      stickEl.style.display = 'block';
      stickEl.style.left = `${origin.x}px`;
      stickEl.style.top = `${origin.y}px`;
    }
  });
  document.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
      if (pinch !== null && pointers.size === 2) {
        const now = span();
        if (now > 0 && pinch > 0) zoom = clampZoom((zoom * pinch) / now);
        pinch = now;
        return;
      }
    }
    if (e.pointerId !== stickId) return;
    let dx = (e.clientX - origin.x) / 50;
    let dy = (e.clientY - origin.y) / 50;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    stick.x = dx;
    stick.y = dy;
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx * 36}px), calc(-50% + ${dy * 36}px))`;
  });
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.pointerId === stickId) dropStick();
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener(
    'wheel',
    (e) => {
      zoom = clampZoom(zoom * (1 + e.deltaY * 0.0012));
      e.preventDefault();
    },
    { passive: false },
  );
  const readKeys = () => {
    keys.x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
    keys.y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
  };
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyN') setNight(!nightOn);
    if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom = clampZoom(zoom / 1.15);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom = clampZoom(zoom * 1.15);
    held.add(e.code);
    readKeys();
  });
  document.addEventListener('keyup', (e) => {
    held.delete(e.code);
    readKeys();
  });

  // day and night
  let nightOn = false;
  let nightMix = 0;
  const setNight = (on: boolean) => {
    nightOn = on;
    if (nightButton) nightButton.textContent = on ? 'Day' : 'Night';
  };
  nightButton?.addEventListener('click', () => setNight(!nightOn));
  const daySky = new THREE.Color(0xbfd9ff);
  const nightSky = new THREE.Color(0x1a2446);
  const dayGround = new THREE.Color(0x6b8f4a);
  const nightGround = new THREE.Color(0x0b1020);
  const daySun = new THREE.Color(0xfff1d6);
  const nightSun = new THREE.Color(0x8fa8ff);
  const glowColor = new THREE.Color(0x7fe0ff);
  const applyNight = (mix: number) => {
    hemi.color.lerpColors(daySky, nightSky, mix);
    hemi.groundColor.lerpColors(dayGround, nightGround, mix);
    hemi.intensity = THREE.MathUtils.lerp(2.0, 0.7, mix);
    sun.color.lerpColors(daySun, nightSun, mix);
    sun.intensity = THREE.MathUtils.lerp(2.4, 0.35, mix);
    fog.color.lerpColors(dayFog, nightFog, mix);
    fog.density = THREE.MathUtils.lerp(0.009, 0.03, mix);
    background.copy(fog.color);
    lantern.intensity = 18 * mix;
    for (const g of glow) {
      for (const child of g.children) {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.copy(glowColor);
          child.material.emissiveIntensity = 1.6 * mix;
        }
      }
    }
  };
  applyNight(0);

  // the walk under e2e
  let job: { dx: number; dz: number; left: number; done: () => void } | null = null;
  const api: ValleyApi = {
    ready: false,
    walk: (dx, dz, frames) =>
      new Promise<void>((done) => {
        job = { dx, dz, left: frames, done };
      }),
    night: (on) => setNight(on),
    pos: () => [Math.round(pos.x * 100) / 100, Math.round(pos.z * 100) / 100],
    debug: () => {
      const meshes: Record<string, unknown>[] = [];
      hero.holder.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const map = mat instanceof THREE.MeshStandardMaterial ? mat.map : null;
        const image = map ? (map.image as { width?: number; height?: number } | null) : null;
        meshes.push({
          name: obj.name,
          type: obj.type,
          skinned: obj instanceof THREE.SkinnedMesh,
          bones: obj instanceof THREE.SkinnedMesh ? obj.skeleton.bones.length : 0,
          material: mat?.type,
          color: mat instanceof THREE.MeshStandardMaterial ? mat.color.getHexString() : null,
          map: image ? `${image.width ?? '?'}x${image.height ?? '?'}` : null,
          vertices: obj.geometry.getAttribute('position')?.count ?? 0,
          uv: !!obj.geometry.getAttribute('uv'),
        });
      });
      const bones: Record<string, unknown>[] = [];
      hero.holder.traverse((obj) => {
        if (obj instanceof THREE.Bone) {
          bones.push({
            name: obj.name,
            parent: obj.parent?.name,
            pos: obj.position.toArray().map((v) => Math.round(v * 1000) / 1000),
            rot: obj.rotation.toArray().slice(0, 3).map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)),
          });
        }
      });
      return {
        clips: hero.clips,
        walkTracks: hero.walk?.getClip().tracks.map((t) => t.name),
        bones,
        idle: hero.idle ? { running: hero.idle.isRunning(), time: hero.idle.time, weight: hero.idle.getEffectiveWeight() } : null,
        walk: hero.walk ? { running: hero.walk.isRunning(), time: hero.walk.time, weight: hero.walk.getEffectiveWeight() } : null,
        mixerTime: hero.mixer.time,
        zoom,
        meshes,
      };
    },
  };
  window.__valley3d = api;

  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3();
  const timer = new THREE.Timer();
  let time = 0;
  let first = true;

  function step(dt: number): void {
    time += dt;
    // where to go, in the world
    let mx: number;
    let mz: number;
    if (job) {
      mx = job.dx;
      mz = job.dz;
    } else {
      const ix = Math.max(-1, Math.min(1, stick.x + keys.x));
      const iy = Math.max(-1, Math.min(1, stick.y + keys.y));
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      mx = fx * -iy + -fz * ix;
      mz = fz * -iy + fx * ix;
    }
    let len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
      len = 1;
    }
    const moving = len > 0.08;
    if (moving) {
      yaw = lerpAngle(yaw, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12));
      const nx = pos.x + mx * SPEED * dt;
      const nz = pos.z + mz * SPEED * dt;
      if (!blocked(nx, pos.z)) pos.x = nx;
      if (!blocked(pos.x, nz)) pos.z = nz;
    }
    pos.y = walkY(pos.x, pos.z);
    hero.holder.position.copy(pos);
    hero.holder.rotation.y = yaw + MODEL_FACING;
    if (moving !== walking) {
      walking = moving;
      const from = moving ? hero.idle : hero.walk;
      const to = moving ? hero.walk : hero.idle;
      if (to) {
        to.reset().play();
        if (from) from.crossFadeTo(to, 0.25, false);
      }
    }
    hero.mixer.update(dt);

    // the camera high behind the character, the land in view
    camYaw = lerpAngle(camYaw, yaw, 1 - Math.exp(-dt * 2.5));
    const back = zoom * Math.cos(PITCH);
    const up = zoom * Math.sin(PITCH);
    target.set(pos.x - Math.sin(camYaw) * back, pos.y + up, pos.z - Math.cos(camYaw) * back);
    target.y = Math.max(target.y, groundY(target.x, target.z) + 0.6);
    if (up < 4.5) {
      // zoomed in under the tree tops: stay out of the forest border, or a trunk sits on the lens
      target.x = Math.min(W - 2.3, Math.max(2.3, target.x));
      target.z = Math.min(H - 2.3, Math.max(2.3, target.z));
    }
    if (first) camera.position.copy(target);
    else camera.position.lerp(target, 1 - Math.exp(-dt * 5));
    tmp.set(pos.x, pos.y + 1.0, pos.z);
    camera.lookAt(tmp);
    first = false;

    // the sun follows, so the shadows stay sharp near the character
    sun.position.set(pos.x - 8, pos.y + 14, pos.z + 6);
    sun.target.position.copy(pos);

    // the water drifts, the mist breathes, the night comes in
    waterTexture.offset.x += dt * 0.03;
    waterTexture.offset.y += dt * 0.02;
    mists.forEach((m, i) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + 0.08 * Math.sin(time * 0.7 + i);
    });
    const want = nightOn ? 1 : 0;
    if (Math.abs(want - nightMix) > 0.001) {
      nightMix += (want - nightMix) * Math.min(1, dt * 2.5);
      if (Math.abs(want - nightMix) < 0.01) nightMix = want;
      applyNight(nightMix);
    }
  }

  function onResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = portrait() ? 55 : 45;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function frame(): void {
    timer.update();
    const dt = FIXED ? STEP : Math.min(timer.getDelta(), 0.1);
    step(dt);
    renderer.render(scene, camera);
    if (job) {
      job.left--;
      if (job.left <= 0) {
        const done = job.done;
        job = null;
        done();
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
  loading?.remove();
  api.ready = true;
}

main().catch((err: unknown) => {
  const loading = document.getElementById('loading');
  const message = err instanceof Error ? err.message : String(err);
  if (loading) loading.textContent = `The valley did not load: ${message}`;
  console.error(err);
});
