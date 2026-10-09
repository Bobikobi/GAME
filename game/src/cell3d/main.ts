/**
 * The 3D cell trial: one camp by the stream, ten meters across.
 *
 * Where /3d.html draws the whole valley with low-poly kit models, this page
 * draws ONE place at the finish the engine can give: photoscanned trees,
 * rocks and ground from Poly Haven (CC0), a real sky for the light, soft
 * shadows, a stream that mirrors the bank, a fire, and a textured character
 * with real proportions and a walk. The assets are fetched by
 * game/tools/fetch-cell-assets.mjs into game/public/3d/cell/ (git ignores
 * them); the characters sit in game/public/3d/models/.
 *
 * Under ?e2e the scene advances a fixed 1/30 s per frame and window.__cell3d
 * drives it, so game/e2e/cell3d.ts takes the same screenshots on every
 * machine. ?look=wizard|matt|human picks the character (wolf-bright and
 * wolf-grim walk on four legs; the people made for this trial, digger-m and
 * forager-m, keep the height they were made at and carry the props of their
 * role on the sockets of their skeleton), ?props=hat,basket puts other props
 * on (empty: none), ?zoom=<m> the start distance, ?post=0 turns the bloom off.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

interface Manifest {
  models: Record<string, string>;
  /** the alpha cut-out of a leaf-card model, fetched on its own (the 1k gltf drops it) */
  alpha?: Record<string, string>;
  textures: Record<string, Record<string, string>>;
  skies: Record<string, string>;
}

interface CellApi {
  ready: boolean;
  walk(dx: number, dz: number, frames: number): Promise<void>;
  run(dx: number, dz: number, frames: number): Promise<void>;
  night(on: boolean): void;
  zoom(meters: number): void;
  /** turns the character to the camera and holds the camera still for a while */
  face(): void;
  pos(): [number, number];
  debug(): Record<string, unknown>;
}
declare global {
  interface Window {
    __cell3d?: CellApi;
  }
}

const PARAMS = new URLSearchParams(location.search);
const FIXED = PARAMS.has('e2e');
const STEP = 1 / 30;
const ASSETS = './3d/cell/';

/** half the side of the walkable cell, in meters */
const CELL = 5;
/** the ground mesh is wider than the cell, so the edge of the world is trees, not void */
const GROUND = 26;
const WATER_Y = -0.45;
/** west of this the bank drops into the stream */
const BANK_X = -3.4;
const CHAR_HEIGHT = 1.75;
const SPEED = 1.45;
const RUN_SPEED = 3.4;
/** a four-legged character (the wolf) stands this tall at the ears, and moves at its own pace */
const QUAD_HEIGHT = 0.95;
const QUAD_SPEED = 1.1;
const QUAD_RUN_SPEED = 2.8;
/** what each role carries: game/public/3d/models/prop-<name>.glb, each on the socket its file names */
const ROLE_PROPS: Record<string, string[]> = { digger: ['spade'], forager: ['basket'], explorer: ['hat'] };

// ---------------------------------------------------------------- the land

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LATTICE = 64;
const lattice = new Float32Array(LATTICE * LATTICE);
{
  const rnd = mulberry32(20261008);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();
}
function latticeAt(i: number, j: number): number {
  const ii = ((i % LATTICE) + LATTICE) % LATTICE;
  const jj = ((j % LATTICE) + LATTICE) % LATTICE;
  return lattice[jj * LATTICE + ii] ?? 0;
}
/** value noise in 0..1, periodic every LATTICE units */
function noise2(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = latticeAt(x0, z0);
  const b = latticeAt(x0 + 1, z0);
  const c = latticeAt(x0, z0 + 1);
  const d = latticeAt(x0 + 1, z0 + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function smooth(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** the height of the ground, with the stream cut along the west */
function height(x: number, z: number): number {
  let y = 0.22 * (noise2(x * 0.22 + 3, z * 0.22 + 7) - 0.5) + 0.07 * (noise2(x * 0.9, z * 0.9) - 0.5) + 0.02 * x;
  const bed = smooth(-3.6, -5.4, x) * (1 - smooth(-8.6, -10.6, x));
  y -= 1.15 * bed;
  return y;
}
/** 1 where the ground is forest floor (under the big tree, around the fire) */
function floorWeight(x: number, z: number): number {
  const spots: [number, number, number][] = [
    [4.2, -3.0, 3.4],
    [1.4, 0.9, 2.6],
    [-1.6, 2.6, 1.5],
    [7.5, -8.0, 3.2],
    [-1.5, -8.5, 3.2],
    [9.0, 2.0, 2.8],
    [6.5, 8.5, 3.0],
  ];
  let w = 0;
  for (const [sx, sz, r] of spots) w = Math.max(w, 1 - smooth(r * 0.45, r, Math.hypot(x - sx, z - sz)));
  w += 0.4 * (noise2(x * 0.5 + 11, z * 0.5 + 5) - 0.5);
  return Math.min(1, Math.max(0, w));
}
/** 1 on the sand of the bank and the bed */
function sandWeight(x: number, z: number): number {
  const edge = 0.5 * (noise2(x * 0.7 + 2, z * 0.7 + 9) - 0.5);
  return smooth(-2.3 + edge, -3.3 + edge, x) * (1 - smooth(-10.4, -11.6, x));
}

// ---------------------------------------------------------------- textures

const loader = new THREE.TextureLoader();
async function texture(path: string, srgb: boolean): Promise<THREE.Texture> {
  const t = await loader.loadAsync(path);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** a tiling normal map for the water, from the same noise */
function waterNormals(): THREE.DataTexture {
  const n = 512;
  const data = new Uint8Array(n * n * 4);
  // 16 and 32 noise cells per tile: long ripples, not static
  const h = (i: number, j: number) => noise2(i / 32, j / 32) * 0.6 + noise2(i / 16 + 17, j / 16 + 3) * 0.4;
  const k = 40;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const dx = (h(i + 1, j) - h(i - 1, j)) * k;
      const dz = (h(i, j + 1) - h(i, j - 1)) * k;
      const len = Math.hypot(dx, 1, dz);
      const o = (j * n + i) * 4;
      data[o] = Math.round((-dx / len) * 127.5 + 127.5);
      data[o + 1] = Math.round((-dz / len) * 127.5 + 127.5);
      data[o + 2] = Math.round((1 / len) * 127.5 + 127.5);
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** a soft round glow for the fire and the shadow under the feet */
function glowTexture(): THREE.CanvasTexture {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const g = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a flame with a shape: wide and white-hot at the base, narrow and red at the tip */
function flameTexture(): THREE.CanvasTexture {
  const w = 64;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      // 0 at the base (bottom of the canvas), 1 at the tip
      const t = 1 - y / (h - 1);
      const half = (w / 2) * (0.15 + 0.85 * Math.pow(1 - t, 0.8)) * (0.9 + 0.1 * noise2(t * 9, 2.5));
      for (let x = 0; x < w; x++) {
        const dx = (x - (w - 1) / 2 + 2.5 * (noise2(x * 0.3, y * 0.12) - 0.5)) / half;
        const inside = Math.max(0, 1 - dx * dx);
        const a = Math.pow(inside, 1.4) * Math.pow(1 - t, 0.35) * (t < 0.08 ? t / 0.08 : 1);
        const heat = inside * (1 - t);
        const o = (y * w + x) * 4;
        img.data[o] = 255;
        img.data[o + 1] = Math.round(60 + 190 * Math.min(1, heat * 1.4));
        img.data[o + 2] = Math.round(Math.max(0, heat - 0.45) * 420);
        img.data[o + 3] = Math.round(255 * Math.min(1, a));
      }
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- models

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}
interface Model {
  parts: Part[];
  size: THREE.Vector3;
  min: THREE.Vector3;
  cards: boolean;
}
const gltfLoader = new GLTFLoader();
const models = new Map<string, Model>();
let loaded = 0;
let toLoad = 0;
const loadingEl = document.getElementById('loading');
function progress(): void {
  loaded++;
  if (loadingEl) loadingEl.textContent = `Loading the camp (${loaded}/${toLoad})`;
}

/** thin leaf cards: lit like the ground they stand on, and never shadowing themselves */
const CARDS = new Set(['grass_medium_01', 'fern_02', 'moss_01', 'flower_gazania']);

/** loads a Poly Haven model (thinned by the fetch script) and bakes its transforms */
async function loadModel(path: string, id: string, alphaPath?: string): Promise<Model> {
  const cards = CARDS.has(id);
  const [gltf, alpha] = await Promise.all([gltfLoader.loadAsync(path), alphaPath ? loader.loadAsync(alphaPath) : null]);
  // the model's own textures are not flipped (glTF), so its alpha map must not be either
  if (alpha) alpha.flipY = false;
  gltf.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshes.push(obj);
  });
  const parts: Part[] = [];
  const box = new THREE.Box3();
  for (const m of meshes) {
    const geometry = m.geometry.clone();
    geometry.applyMatrix4(m.matrixWorld);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) box.union(geometry.boundingBox);
    if (cards) {
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
      normal.needsUpdate = true;
    }
    const material = Array.isArray(m.material) ? m.material[0] : m.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.side = material.alphaTest > 0 || material.transparent ? THREE.DoubleSide : THREE.FrontSide;
      // leaves and grass cut by alpha render crisper than blended
      if (material.transparent && material.map) {
        material.transparent = false;
        material.alphaTest = 0.45;
      }
      if (alpha && (material.alphaTest > 0 || cards)) {
        material.alphaMap = alpha;
        material.alphaTest = Math.max(material.alphaTest, 0.5);
        material.side = THREE.DoubleSide;
      }
      // cut-outs blend their edge into the multisampled frame instead of flickering
      if (material.alphaTest > 0) material.alphaToCoverage = true;
      // a distant leaf at a grazing angle sparkles without anisotropic filtering
      for (const t of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.alphaMap]) {
        if (t) t.anisotropy = 8;
      }
      if (cards) {
        material.aoMap = null;
        material.normalMap = null;
        material.roughness = 0.9;
      }
    }
    if (material) parts.push({ geometry, material });
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  progress();
  return { parts, size, min: box.min.clone(), cards };
}

interface Placement {
  id: string;
  matrix: THREE.Matrix4;
}
const placements: Placement[] = [];
const solids: [number, number, number][] = [];
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** stands a model on the ground at x,z with its base at the surface */
function place(id: string, x: number, z: number, opts: { yaw?: number; scale?: number; y?: number; solid?: number } = {}): void {
  const model = models.get(id);
  if (!model) throw new Error(`model ${id} is not loaded`);
  const s = opts.scale ?? 1;
  const y = (opts.y ?? height(x, z)) - model.min.y * s;
  tmpPos.set(x, y, z);
  tmpQuat.setFromAxisAngle(UP, opts.yaw ?? 0);
  tmpScale.set(s, s, s);
  placements.push({ id, matrix: new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale) });
  if (opts.solid) solids.push([x, z, opts.solid]);
}

function buildInstances(scene: THREE.Scene): void {
  const byId = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byId.get(p.id) ?? [];
    list.push(p);
    byId.set(p.id, list);
  }
  for (const [id, list] of byId) {
    const model = models.get(id);
    if (!model) continue;
    for (const part of model.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((p, i) => mesh.setMatrixAt(i, p.matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = !model.cards;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

// ---------------------------------------------------------------- character

interface Hero {
  holder: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
  /** null when the model has no run: the walk then plays faster */
  run: THREE.AnimationAction | null;
  /** on four legs (the skin has front-leg joints): sized at the ears, a long shadow, its own pace */
  quad: boolean;
  speed: number;
  runSpeed: number;
  /** how high above the feet the camera looks, in meters */
  eye: number;
  clips: string[];
}
async function loadCharacter(name: string): Promise<Hero> {
  const gltf = await gltfLoader.loadAsync(`./3d/models/${name}.glb`);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let quad = false;
  root.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh && obj.skeleton.bones.some((b) => /frontleg/i.test(b.name))) quad = true;
  });
  // a person made for this trial (game/tools/blender/person_rig.py) has prop sockets and already stands
  // at the height it was made at; any other character is sized to CHAR_HEIGHT or QUAD_HEIGHT
  const made = !!root.getObjectByName('socket_back') || !!root.getObjectByName('socket_head');
  const s = made ? 1 : (quad ? QUAD_HEIGHT : CHAR_HEIGHT) / Math.max(size.y, 1e-6);
  root.scale.setScalar(s);
  root.position.y = -box.min.y * s;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
    }
  });
  const holder = new THREE.Group();
  holder.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const find = (re: RegExp) => gltf.animations.find((c) => re.test(c.name)) ?? null;
  const idleClip = find(/\|Idle$/i) ?? find(/idle/i);
  const walkClip = find(/\|Walk$/i) ?? find(/walk/i);
  const runClip = find(/\|Run$/i) ?? find(/^run$/i);
  const idle = idleClip ? mixer.clipAction(idleClip) : null;
  const walk = walkClip ? mixer.clipAction(walkClip) : null;
  const run = runClip ? mixer.clipAction(runClip) : null;
  const speed = quad ? QUAD_SPEED : SPEED;
  const runSpeed = quad ? QUAD_RUN_SPEED : RUN_SPEED;
  // a clip that knows how fast its planted feet slide back (extras.groundSpeed, metres per second at
  // the file's size) is played at the rate that keeps the feet still on the ground
  const pace = (action: THREE.AnimationAction | null, want: number, fallback: number) => {
    if (!action) return;
    const ground = Number(action.getClip().userData['groundSpeed'] ?? 0);
    action.timeScale = ground > 0 ? THREE.MathUtils.clamp(want / (ground * s), 0.5, 2.5) : fallback;
  };
  pace(walk, speed, 1.1);
  pace(run, runSpeed, 1);
  idle?.play();
  // the bind pose stands a little off the idle pose; the feet are measured in the pose shown
  mixer.update(0);
  root.updateMatrixWorld(true);
  const posed = new THREE.Box3();
  root.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) {
      obj.computeBoundingBox();
      if (obj.boundingBox) posed.union(obj.boundingBox.clone().applyMatrix4(obj.matrixWorld));
    }
  });
  if (!posed.isEmpty()) root.position.y -= posed.min.y;
  root.traverse((obj) => {
    const mat = obj instanceof THREE.Mesh ? obj.material : null;
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      if (m instanceof THREE.MeshStandardMaterial && m.map) m.map.anisotropy = 8;
    }
  });
  progress();
  return { holder, mixer, idle, walk, run, quad, speed, runSpeed, eye: quad ? 0.6 : 1.0, clips: gltf.animations.map((c) => c.name) };
}

/**
 * Puts each prop on the socket its file names (extras.socket on its node): the prop was modelled in the
 * socket's frame, so it goes on as it is. What lies on the body (the basket's straps, the hat) comes in one
 * copy per person it was fitted to, named by that person's look (extras.wearer): the copy made for this
 * look stays, or the first one on anyone else. Returns what went on, as prop@socket (prop:wearer@socket for
 * a fitted copy).
 */
async function attachProps(root: THREE.Object3D, names: string[], look: string): Promise<string[]> {
  toLoad += names.length;
  const on: string[] = [];
  for (const name of names) {
    const gltf = await gltfLoader.loadAsync(`./3d/models/prop-${name}.glb`);
    progress();
    const nodes: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      nodes.push(obj);
    });
    const prop = nodes.find((obj) => typeof obj.userData['socket'] === 'string');
    const socket = prop ? root.getObjectByName(String(prop.userData['socket'])) : undefined;
    if (!prop || !socket) {
      console.warn(`prop ${name}: this character has no socket for it`);
      continue;
    }
    const copies = nodes.filter((obj) => typeof obj.userData['wearer'] === 'string');
    const mine = copies.find((obj) => obj.userData['wearer'] === look) ?? copies[0];
    for (const obj of copies) {
      if (obj !== mine) obj.removeFromParent();
    }
    prop.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        if (m instanceof THREE.MeshStandardMaterial && m.map) m.map.anisotropy = 8;
      }
    });
    socket.add(prop);
    on.push(mine ? `${name}:${String(mine.userData['wearer'])}@${socket.name}` : `${name}@${socket.name}`);
  }
  return on;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function blocked(x: number, z: number): boolean {
  if (x < BANK_X || x > CELL + 0.6 || z < -CELL - 0.6 || z > CELL + 0.6) return true;
  for (const [sx, sz, r] of solids) if (Math.hypot(x - sx, z - sz) < r) return true;
  return false;
}

// ---------------------------------------------------------------- the scene

async function main(): Promise<void> {
  const canvas = document.getElementById('cell') as HTMLCanvasElement | null;
  const nightButton = document.getElementById('night');
  const stickEl = document.getElementById('stick');
  const knob = stickEl?.querySelector('i') ?? null;
  if (!canvas) throw new Error('no canvas');

  const manifestRes = await fetch(`${ASSETS}manifest.json`);
  if (!manifestRes.ok) {
    throw new Error('the models of the camp are not here yet: run "node game/tools/fetch-cell-assets.mjs" and rebuild');
  }
  const manifest = (await manifestRes.json()) as Manifest;
  toLoad = Object.keys(manifest.models).length + Object.keys(manifest.skies).length + 1;

  const mobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // the whole frame is multisampled and bloomed, so a dense screen is not drawn at its full density
  renderer.setPixelRatio(FIXED ? 1 : Math.min(window.devicePixelRatio, mobile ? 1 : 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();

  // the camera high behind the character, like the old online worlds; zoom is its distance
  const portrait = () => window.innerWidth < window.innerHeight;
  const camera = new THREE.PerspectiveCamera(portrait() ? 52 : 42, window.innerWidth / window.innerHeight, 0.1, 200);
  const ZOOM_MIN = 3;
  const ZOOM_MAX = 12;
  const PITCH = 0.58;
  const clampZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  let zoom = clampZoom(Number(PARAMS.get('zoom')) || 7);

  // the sky lights everything; the sun draws the shadows
  const skyIds = Object.keys(manifest.skies);
  const dayPath = manifest.skies[skyIds[0] ?? ''];
  const nightPath = manifest.skies[skyIds[1] ?? ''];
  if (!dayPath || !nightPath) throw new Error('the manifest needs two skies');
  const rgbe = new RGBELoader();
  const daySky = await rgbe.loadAsync(ASSETS + dayPath);
  daySky.mapping = THREE.EquirectangularReflectionMapping;
  progress();
  const nightSky = await rgbe.loadAsync(ASSETS + nightPath);
  nightSky.mapping = THREE.EquirectangularReflectionMapping;
  progress();
  scene.environment = daySky;
  scene.background = daySky;
  scene.environmentIntensity = 0.6;
  scene.backgroundIntensity = 1.0;

  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(-9, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(FIXED || mobile ? 1024 : 2048, FIXED || mobile ? 1024 : 2048);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -13;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  sun.shadow.blurSamples = 6;
  scene.add(sun, sun.target);

  // the ground: grass, forest floor and sand blended by the land itself
  const tex = manifest.textures;
  const grassSet = tex['leafy_grass'] ?? {};
  const floorSet = tex['forest_ground_04'] ?? {};
  const sandSet = tex['forrest_sand_01'] ?? {};
  const need = (set: Record<string, string>, kind: string, id: string): string => {
    const p = set[kind];
    if (!p) throw new Error(`texture ${id} has no ${kind} map`);
    return ASSETS + p;
  };
  const maybe = (set: Record<string, string>, kind: string): Promise<THREE.Texture | null> => {
    const p = set[kind];
    return p ? texture(ASSETS + p, false) : Promise.resolve(null);
  };
  const [grassDiff, grassNor, grassRough, floorDiff, sandDiff] = await Promise.all([
    texture(need(grassSet, 'diff', 'grass'), true),
    maybe(grassSet, 'nor'),
    maybe(grassSet, 'rough'),
    texture(need(floorSet, 'diff', 'forest floor'), true),
    texture(need(sandSet, 'diff', 'sand'), true),
  ]);
  const TILE = GROUND / 3.2;
  for (const t of [grassDiff, grassNor, grassRough, floorDiff, sandDiff]) {
    if (!t) continue;
    t.repeat.set(TILE, TILE);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: grassDiff,
    normalMap: grassNor,
    roughnessMap: grassRough,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
  groundMaterial.normalScale.set(0.7, 0.7);
  groundMaterial.onBeforeCompile = (shader) => {
    shader.uniforms['mapB'] = { value: floorDiff };
    shader.uniforms['mapC'] = { value: sandDiff };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D mapB;\nuniform sampler2D mapC;')
      .replace(
        '#include <map_fragment>',
        [
          'vec4 groundA = texture2D( map, vMapUv );',
          'groundA.rgb *= vec3( 0.84, 1.0, 0.76 );',
          'vec4 groundB = texture2D( mapB, vMapUv );',
          'vec4 groundC = texture2D( mapC, vMapUv );',
          'diffuseColor *= mix( mix( groundA, groundB, vColor.r ), groundC, vColor.g );',
        ].join('\n'),
      )
      .replace('#include <color_fragment>', '');
  };
  const SEG = 130;
  const groundGeometry = new THREE.PlaneGeometry(GROUND, GROUND, SEG, SEG);
  groundGeometry.rotateX(-Math.PI / 2);
  const posAttr = groundGeometry.getAttribute('position');
  const colors = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    posAttr.setY(i, height(x, z));
    colors[i * 3] = floorWeight(x, z);
    colors[i * 3 + 1] = sandWeight(x, z);
    colors[i * 3 + 2] = 0;
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.receiveShadow = true;
  scene.add(ground);

  // the stream mirrors the bank and the sky
  const water = new Water(new THREE.PlaneGeometry(6.4, GROUND + 6), {
    textureWidth: FIXED ? 256 : 512,
    textureHeight: FIXED ? 256 : 512,
    waterNormals: waterNormals(),
    sunDirection: sun.position.clone().normalize(),
    sunColor: 0xfff0d8,
    waterColor: 0x1d4a52,
    distortionScale: 1.1,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(-7.1, WATER_Y, 0);
  const waterUniforms = (water.material as THREE.ShaderMaterial).uniforms;
  if (waterUniforms['size']) waterUniforms['size'].value = 4;
  scene.add(water);

  // the models of the camp
  const ids = Object.keys(manifest.models);
  for (const id of ids) {
    const path = manifest.models[id];
    if (!path) continue;
    const alphaPath = manifest.alpha?.[id];
    models.set(id, await loadModel(ASSETS + path, id, alphaPath ? ASSETS + alphaPath : undefined));
  }
  const has = (id: string) => models.has(id);
  const rnd = mulberry32(7);
  const scatter = (id: string, count: number, ok: (x: number, z: number) => boolean, scale: [number, number]) => {
    if (!has(id)) return;
    let n = 0;
    let guard = 0;
    while (n < count && guard++ < count * 40) {
      const x = (rnd() - 0.5) * (GROUND - 4);
      const z = (rnd() - 0.5) * (GROUND - 4);
      if (!ok(x, z)) continue;
      place(id, x, z, { yaw: rnd() * Math.PI * 2, scale: scale[0] + rnd() * (scale[1] - scale[0]) });
      n++;
    }
  };
  const onGrass = (x: number, z: number) => x > -2.2 && sandWeight(x, z) < 0.2 && floorWeight(x, z) < 0.55 && Math.hypot(x - 1.4, z - 0.9) > 1.9;
  const underTrees = (x: number, z: number) => x > -2.6 && floorWeight(x, z) > 0.5 && Math.hypot(x - 1.4, z - 0.9) > 2.2;

  // the big tree shades the camp; the firs (9 m tall at scale 1) ring the cell
  if (has('island_tree_02')) place('island_tree_02', 4.2, -3.0, { yaw: 0.4, scale: 1.5, solid: 0.7 });
  if (has('fir_sapling_medium')) {
    place('fir_sapling_medium', -1.5, -8.5, { yaw: 1.1, scale: 1.2 });
    place('fir_sapling_medium', 7.5, -8.0, { yaw: 2.3, scale: 1.3 });
    place('fir_sapling_medium', 9.0, 2.0, { yaw: 0.2, scale: 1.1, solid: 0.6 });
    place('fir_sapling_medium', 6.5, 8.5, { yaw: 3.0, scale: 1.25 });
    place('fir_sapling_medium', -10.8, 4.5, { yaw: 1.7, scale: 1.2 });
    place('fir_sapling_medium', -11.2, -5.0, { yaw: 0.6, scale: 1.1 });
    place('fir_sapling_medium', -0.5, 9.5, { yaw: 2.6, scale: 1.0 });
    place('fir_sapling_medium', 8.2, -2.0, { yaw: 0.3, scale: 0.55 });
    place('fir_sapling_medium', -2.8, 7.8, { yaw: 1.9, scale: 0.5 });
    place('fir_sapling_medium', -11.6, -0.6, { yaw: 2.8, scale: 0.6 });
    place('fir_sapling_medium', 3.4, -8.6, { yaw: 1.2, scale: 0.7 });
  }
  if (has('tree_stump_01')) place('tree_stump_01', -1.6, 2.6, { yaw: 0.8, solid: 0.55 });
  if (has('dead_tree_trunk')) place('dead_tree_trunk', 3.1, 2.7, { yaw: 1.25, solid: 0.9 });
  if (has('stone_fire_pit')) place('stone_fire_pit', 1.4, 0.9, { yaw: 0.3, solid: 0.95 });
  if (has('rock_moss_set_01')) place('rock_moss_set_01', -2.6, -2.2, { yaw: 0.8, solid: 1.1 });
  if (has('namaqualand_boulder_02')) {
    place('namaqualand_boulder_02', -3.0, 4.3, { yaw: 2.1, scale: 0.6, solid: 0.8 });
    place('namaqualand_boulder_02', -2.9, -5.6, { yaw: 0.4, scale: 0.45 });
    place('namaqualand_boulder_02', -9.4, 7.5, { yaw: 1.3, scale: 0.8 });
  }
  if (has('Lantern_01')) {
    const stump = models.get('tree_stump_01');
    place('Lantern_01', -1.6, 2.6, { yaw: 2.4, y: height(-1.6, 2.6) + (stump ? stump.size.y : 0.5) });
  }
  if (has('moss_01')) {
    place('moss_01', -2.0, -1.3, { yaw: 0.5 });
    place('moss_01', -1.1, 3.5, { yaw: 2.2 });
    place('moss_01', 3.7, 3.4, { yaw: 1.0 });
  }
  scatter('fern_02', 10, underTrees, [0.8, 1.2]);
  scatter('shrub_02', 5, (x, z) => onGrass(x, z) && Math.hypot(x, z) > 4.5, [0.8, 1.1]);
  scatter('flower_gazania', 8, onGrass, [0.9, 1.2]);
  scatter('grass_medium_01', 90, onGrass, [0.7, 1.25]);
  buildInstances(scene);

  // the fire: crossed flames and a light
  const fireAt = new THREE.Vector3(1.4, height(1.4, 0.9) + 0.25, 0.9);
  const flameMat = new THREE.MeshBasicMaterial({
    map: flameTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    // brighter than white: the flames bloom
    color: new THREE.Color(2.4, 1.3, 0.5),
  });
  const flames = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const big = i < 3;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(big ? 0.7 : 0.45, big ? 1.15 : 0.75), flameMat);
    f.position.y = big ? 0.5 : 0.34;
    f.rotation.y = (i * Math.PI) / 5;
    flames.add(f);
  }
  flames.position.copy(fireAt);
  scene.add(flames);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(1.6, 0.7, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }),
  );
  glow.scale.set(2.2, 1.7, 1);
  glow.position.copy(fireAt).add(new THREE.Vector3(0, 0.5, 0));
  scene.add(glow);
  const SPARKS = 48;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkAge = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) sparkAge[i] = Math.random() * 1.6;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: new THREE.Color(2.2, 1.1, 0.35), size: 0.045, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
  );
  sparks.frustumCulled = false;
  scene.add(sparks);
  const fireLight = new THREE.PointLight(0xff8a3a, 0, 10, 2);
  fireLight.position.copy(fireAt).add(new THREE.Vector3(0, 0.6, 0));
  scene.add(fireLight);
  const lanternLight = new THREE.PointLight(0xffd080, 0, 7, 2);
  lanternLight.position.set(-1.6, height(-1.6, 2.6) + 1.2, 2.6);
  scene.add(lanternLight);

  // the character
  const look = PARAMS.get('look') ?? 'wizard';
  const hero = await loadCharacter(`character-${look}`);
  const wanted = PARAMS.get('props');
  const props = await attachProps(
    hero.holder,
    wanted !== null ? wanted.split(',').filter(Boolean) : (ROLE_PROPS[look.split('-')[0] ?? ''] ?? []),
    look,
  );
  scene.add(hero.holder);
  const feetShadow = new THREE.Mesh(
    hero.quad ? new THREE.PlaneGeometry(0.7, 1.6) : new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  feetShadow.rotation.x = -Math.PI / 2;
  feetShadow.renderOrder = 1;
  scene.add(feetShadow);
  const pos = new THREE.Vector3(3.2, 0, 3.8);
  pos.y = height(pos.x, pos.z);
  let yaw = Math.atan2(fireAt.x - pos.x, fireAt.z - pos.z);
  let camYaw = yaw;
  let camHold = 0;
  type Gait = 'idle' | 'walk' | 'run';
  let gait: Gait = 'idle';
  const gaitAction = (g: Gait) => (g === 'idle' ? hero.idle : g === 'run' ? (hero.run ?? hero.walk) : hero.walk);
  const walkRate = hero.walk?.timeScale ?? 1;
  const frameTimes: number[] = [];

  // input: a thumb anywhere, or the arrow keys / WASD; the thumb pulled past the ring, or Shift,
  // runs; n for night; zoom with two fingers, the wheel, or + and -
  const stick = { x: 0, y: 0, far: false };
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
    stick.far = false;
    if (stickEl) stickEl.style.display = 'none';
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  };
  document.addEventListener('pointerdown', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
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
    stick.far = false;
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
    stick.far = len > 1.7;
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

  // bloom for the fire and the lantern
  const post = PARAMS.get('post') !== '0';
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // day and night
  let nightOn = false;
  let nightMix = 0;
  const setNight = (on: boolean) => {
    nightOn = on;
    if (nightButton) nightButton.textContent = on ? 'Day' : 'Night';
  };
  nightButton?.addEventListener('click', () => setNight(!nightOn));
  const daySun = new THREE.Color(0xfff0d8);
  const nightSun = new THREE.Color(0x7f93d8);
  const applyNight = (mix: number) => {
    const sky = mix > 0.5 ? nightSky : daySky;
    if (scene.environment !== sky) {
      scene.environment = sky;
      scene.background = sky;
    }
    scene.environmentIntensity = THREE.MathUtils.lerp(0.6, 0.22, mix);
    scene.backgroundIntensity = THREE.MathUtils.lerp(1.0, 0.55, mix);
    sun.color.lerpColors(daySun, nightSun, mix);
    sun.intensity = THREE.MathUtils.lerp(2.6, 0.35, mix);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 0.85, mix);
    bloom.strength = THREE.MathUtils.lerp(0.22, 0.55, mix);
    lanternLight.intensity = 6 * mix;
    flameMat.opacity = THREE.MathUtils.lerp(0.75, 1, mix);
  };
  applyNight(0);

  // the walk under e2e
  let job: { dx: number; dz: number; run: boolean; left: number; done: () => void } | null = null;
  const api: CellApi = {
    ready: false,
    walk: (dx, dz, frames) =>
      new Promise<void>((done) => {
        job = { dx, dz, run: false, left: frames, done };
      }),
    run: (dx, dz, frames) =>
      new Promise<void>((done) => {
        job = { dx, dz, run: true, left: frames, done };
      }),
    night: (on) => setNight(on),
    zoom: (m) => {
      zoom = clampZoom(m);
    },
    face: () => {
      yaw = camYaw + Math.PI;
      camHold = 90;
    },
    pos: () => [Math.round(pos.x * 100) / 100, Math.round(pos.z * 100) / 100],
    debug: () => ({
      look,
      props,
      clips: hero.clips,
      quad: hero.quad,
      gait,
      pace: { walk: hero.walk?.timeScale ?? null, run: hero.run?.timeScale ?? null },
      zoom,
      fps: frameTimes.length > 1 ? Math.round((frameTimes.length - 1) / ((frameTimes[frameTimes.length - 1] ?? 0) - (frameTimes[0] ?? 0)) * 1000) : 0,
      models: Object.fromEntries([...models].map(([id, m]) => [id, { parts: m.parts.length, size: m.size.toArray().map((v) => Math.round(v * 100) / 100) }])),
      placements: placements.length,
      triangles: (() => {
        let n = 0;
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const idx = o.geometry.getIndex();
            const count = idx ? idx.count / 3 : o.geometry.getAttribute('position').count / 3;
            n += count * (o instanceof THREE.InstancedMesh ? o.count : 1);
          }
        });
        return Math.round(n);
      })(),
    }),
  };
  window.__cell3d = api;

  const tmp = new THREE.Vector3();
  const target = new THREE.Vector3();
  const timer = new THREE.Timer();
  let time = 0;
  let first = true;

  function step(dt: number): void {
    time += dt;
    let mx: number;
    let mz: number;
    let fast: boolean;
    if (job) {
      mx = job.dx;
      mz = job.dz;
      fast = job.run;
    } else {
      fast = stick.far || held.has('ShiftLeft') || held.has('ShiftRight');
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
    const running = moving && fast && len > 0.6;
    if (moving) {
      camHold = 0;
      yaw = lerpAngle(yaw, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12));
      const speed = running ? hero.runSpeed : hero.speed;
      const nx = pos.x + mx * speed * dt;
      const nz = pos.z + mz * speed * dt;
      if (!blocked(nx, pos.z)) pos.x = nx;
      if (!blocked(pos.x, nz)) pos.z = nz;
    }
    pos.y = height(pos.x, pos.z);
    hero.holder.position.copy(pos);
    feetShadow.position.set(pos.x, pos.y + 0.02, pos.z);
    feetShadow.rotation.z = yaw;
    hero.holder.rotation.y = yaw;
    const next: Gait = running ? 'run' : moving ? 'walk' : 'idle';
    if (next !== gait) {
      const from = gaitAction(gait);
      const to = gaitAction(next);
      gait = next;
      // without a run clip the walk itself speeds up
      if (!hero.run && hero.walk) hero.walk.timeScale = next === 'run' ? walkRate * (hero.runSpeed / hero.speed) : walkRate;
      if (to && to !== from) {
        to.reset().play();
        if (from) from.crossFadeTo(to, next === 'idle' ? 0.25 : 0.18, false);
      }
    }
    hero.mixer.update(dt);

    // the camera
    if (camHold > 0) camHold--;
    else camYaw = lerpAngle(camYaw, yaw, 1 - Math.exp(-dt * 2.5));
    const back = zoom * Math.cos(PITCH);
    const up = zoom * Math.sin(PITCH);
    target.set(pos.x - Math.sin(camYaw) * back, pos.y + up, pos.z - Math.cos(camYaw) * back);
    target.y = Math.max(target.y, height(target.x, target.z) + 0.5);
    if (first) camera.position.copy(target);
    else camera.position.lerp(target, 1 - Math.exp(-dt * 5));
    tmp.set(pos.x, pos.y + hero.eye, pos.z);
    camera.lookAt(tmp);
    first = false;

    // the fire breathes, the water moves, the night comes in
    const flicker = 0.8 + 0.2 * noise2(time * 6, 3.5) + 0.1 * noise2(time * 17, 8.5);
    fireLight.intensity = THREE.MathUtils.lerp(4, 20, nightMix) * flicker;
    flames.children.forEach((f, i) => {
      const big = i < 3;
      const s = 0.8 + 0.35 * noise2(time * 5 + i * 3, i * 2.3);
      f.scale.set(0.9 + 0.2 * noise2(time * 4 + i, 5), s, 1);
      f.position.y = (big ? 0.5 : 0.34) + (big ? 0.55 : 0.35) * (s - 1);
      f.rotation.z = 0.12 * (noise2(time * 3 + i, 7) - 0.5);
    });
    glow.material.opacity = (0.22 + 0.4 * nightMix) * flicker;
    flameMat.color.setRGB(1.5 + 0.8 * nightMix, 0.85 + 0.4 * nightMix, 0.32 + 0.2 * nightMix);
    for (let i = 0; i < SPARKS; i++) {
      sparkAge[i] = (sparkAge[i] ?? 0) + dt;
      let age = sparkAge[i] ?? 0;
      if (age > 1.6) {
        age -= 1.6;
        sparkAge[i] = age;
      }
      const seed = i * 7.31;
      const rise = age * (0.9 + 0.5 * noise2(seed, 1));
      sparkPos[i * 3] = fireAt.x + 0.18 * Math.sin(seed) + 0.25 * (noise2(seed + time * 1.5, age * 2) - 0.5);
      sparkPos[i * 3 + 1] = fireAt.y + 0.3 + rise;
      sparkPos[i * 3 + 2] = fireAt.z + 0.18 * Math.cos(seed) + 0.25 * (noise2(seed + 9, age * 2 + time) - 0.5);
    }
    sparkGeo.getAttribute('position').needsUpdate = true;
    if (waterUniforms['time']) waterUniforms['time'].value += dt * 0.6;
    const want = nightOn ? 1 : 0;
    if (Math.abs(want - nightMix) > 0.001) {
      nightMix += (want - nightMix) * Math.min(1, dt * 2.5);
      if (Math.abs(want - nightMix) < 0.01) nightMix = want;
      applyNight(nightMix);
    }
  }

  function onResize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = portrait() ? 52 : 42;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function frame(): void {
    timer.update();
    frameTimes.push(performance.now());
    if (frameTimes.length > 90) frameTimes.shift();
    const dt = FIXED ? STEP : Math.min(timer.getDelta(), 0.1);
    step(dt);
    if (post) composer.render();
    else renderer.render(scene, camera);
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
  loadingEl?.remove();
  api.ready = true;
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (loadingEl) loadingEl.textContent = `The camp did not load: ${message}`;
  console.error(err);
});
