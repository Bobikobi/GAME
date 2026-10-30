/**
 * The overworld in 3D, behind /play3d/: the same game as scenes/world.ts. It feeds the same GameSession (so the same kernel,
 * the same bundle and the same save), walks tile by tile with the kernel's own walkable(), and finds what the player
 * can touch with the same rules; only the drawing differs. The rules below that mirror world.ts (target, arrive,
 * signText) are copied on purpose, so the classic scene stays untouched while the 3D door is young; DECISIONS.md
 * (2026-10-11) names the follow-up of sharing them.
 *
 * One tile is one metre-unit: tile (x, y) is the square [x, x+1) by [y, y+1) of the ground, and z is the map's y.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  type Action,
  type Bundle,
  type Grade,
  type Slot,
  campTile,
  findSlot,
  hourOf,
  inRect,
  isNight,
  makeWalkable,
  minuteOfDay,
  npcTile,
  riddleSlots,
  spotOpen,
  walkStepMs,
} from '@game/kernel';
import { pileAt } from '../scenes/piles';
import { app, type WorldView } from '../app';
import { sound, type SfxId } from '../audio';
import { SONG_OF, crossfadeMs, musicState, signalsOf, type MusicState } from '../audio/state';
import { DIG_SPOT_SPRITE } from '../config';
import { DIRS, type Dir } from '../input';
import { ECHOES, pickOf } from '../lore';
import { emptySlots, slotContent } from '../places';
import type { SignInfo } from '../scenes/world';
import { nodeModel, npcLook, pickLook, wolfModel } from './art';
import { WOLF_EYES } from '../predator';
import { FrameProbe, liteUrl } from './lite';
import { createScenery, groundY, modelOf, standalone, walkY, WATER_Y, type MapData, type Places, type Scenery } from './scenery';
import type { GameSession } from '../session-surface';
import { stoneView } from '../stone';
import { heightOf, questTargets } from '../targets';
import { nodeLook } from '../growth';
import { hintDistance, lanternNight, nodeAction, searchableOn } from '../text';
import { beatAt, blowsDue, resourceKind, treasureKind, type AutoKind } from '../work';
import { ART_PX, StandingReports, Walker, canEnter, facedTile, facingFor, landStep } from '../walking';
import type { WorkKind } from '../ui/ui';

const NEIGHBOURS: readonly [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];
const CHAR_HEIGHT = 1.5;
const ZOOM_MIN = 4;
const ZOOM_MAX = 18;
const PITCH = 0.62;
/** Signatures show over signs this close to the player, in tiles. */
const SIGN_REACH = 5;
const SWING_MS = 520;
const WORK_SOUND: Record<WorkKind, SfxId> = { strike: 'strike', pick: 'pluck', snap: 'tug', timing: 'rustle', dig: 'dig', fish: 'plop' };

export interface Target {
  label: string;
  run: () => void;
  /** the tile the marker points at, and how tall the thing standing there is, in metres */
  tile: [number, number];
  top: number;
}

interface Hero {
  holder: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
}

/**
 * Two red points at the wolf's head. The head is the end of the long horizontal axis where the highest points of the
 * model lie (the ears stand above the tail), found from the model itself so a new wolf needs no number.
 */
function wolfEyes(body: THREE.Object3D, height: number): THREE.Group {
  body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const alongX = size.x > size.z;
  const high: number[] = [];
  const v = new THREE.Vector3();
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 4) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y > box.min.y + size.y * 0.8) high.push(alongX ? v.x : v.z);
    }
  });
  const mean = high.length ? high.reduce((a, n) => a + n, 0) / high.length : centre[alongX ? 'x' : 'z'];
  const sign = mean >= centre[alongX ? 'x' : 'z'] ? 1 : -1;
  const reach = (alongX ? size.x : size.z) / 2;
  const group = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color: WOLF_EYES.red, transparent: true, opacity: 0.25, depthWrite: false });
  const core = new THREE.MeshBasicMaterial({ color: WOLF_EYES.red });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), core), new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow));
    const lateral = side * 0.06;
    const along = sign * reach * 0.92;
    eye.position.set(centre.x + (alongX ? along : lateral), box.min.y + height * 0.8, centre.z + (alongX ? lateral : along));
    group.add(eye);
  }
  return group;
}

/** What stands on a node's tile: the thing now showing, and what it was made from, so it is rebuilt only when the stage changes. */
interface NodeView {
  art: THREE.Object3D | null;
  sprite: string;
  alpha: number;
  /** counts the redraws, so a slow load of an old stage never lands over a newer one */
  gen: number;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/** "core/base-kit:props/standing_stone" -> "standing stone" */
function spriteName(ref: string): string {
  return (ref.split('/').pop() ?? ref).replace(/_/g, ' ');
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Frees what a drawn thing owns: its own materials and the textures and geometry made for it, never the shared models. */
function dispose(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
    if (o instanceof THREE.Mesh && o.geometry.userData.own) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const map = (m as THREE.MeshBasicMaterial).map;
      if (map?.userData.own) map.dispose();
      m.dispose();
    }
  });
}

/** The built fire's flame: two tongues that light themselves, so the fire reads as lit by day as well as by night. */
function flameOf(): THREE.Group {
  const flame = new THREE.Group();
  flame.name = 'flame';
  const tongues: [radius: number, height: number, color: number, opacity: number][] = [
    [0.17, 0.46, 0xff7a2a, 0.85],
    [0.09, 0.3, 0xffe08a, 0.95],
  ];
  for (const [radius, height, color, opacity] of tongues) {
    const geometry = new THREE.ConeGeometry(radius, height, 7);
    geometry.userData.own = true;
    const tongue = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
    tongue.position.y = height / 2;
    flame.add(tongue);
  }
  return flame;
}

function clearGroup(g: THREE.Group): void {
  for (const c of g.children) dispose(c);
  g.clear();
}

function setAlpha(obj: THREE.Object3D, alpha: number): void {
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.transparent = alpha < 1 || m.transparent;
      m.opacity = alpha;
    }
  });
}

export class World3D implements WorldView {
  private session?: GameSession;
  private readonly b: Bundle;
  private readonly walkable: ReturnType<typeof makeWalkable>;
  private readonly renderer: THREE.WebGLRenderer;
  /** drawing without shadows or smoothing, asked for by `?lite` or chosen by the frame probe */
  private readonly lite: boolean;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scenery: Scenery;
  private readonly scene: THREE.Scene;
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly loader = new GLTFLoader();

  private hero?: Hero;
  private heroKey = '';
  private walking = false;
  private yaw = Math.PI;
  /** the player's drawn place */
  private readonly pos = new THREE.Vector3();
  /** the body walking freely between tiles, by the 2D scene's rules (walking.ts) */
  private readonly body = new Walker();
  private zoom = 11;
  private first = true;
  private time = 0;

  private readonly nodes = new Map<string, NodeView>();
  private readonly nodeAt = new Map<string, string>();
  private readonly npcAt = new Map<string, string>();
  private readonly signs = new Map<string, string>();
  private readonly searches = new Map<string, string>();
  private readonly notes = new Map<string, { text: string; name: string; top: number }>();
  private readonly tops = new Map<string, number>();
  private readonly signSpots: { slot: string; x: number; y: number; label: HTMLElement }[] = [];
  private readonly restoreArt = new Map<string, THREE.Group>();
  private readonly restoreShown = new Map<string, boolean>();
  private readonly campArt = new Map<string, { art: THREE.Group; built: boolean; taken: boolean }>();
  private readonly glints: THREE.Sprite[] = [];
  private glintKey = '';
  private readonly marker: THREE.Mesh;
  private readonly bar: THREE.Sprite;
  private readonly barCtx: CanvasRenderingContext2D;
  private empty: Slot[] = [];
  private unbind: (() => void)[] = [];
  private labels!: HTMLElement;

  private busyFrom = 0;
  private busyMs = 0;
  private work: { node: string; kind: WorkKind } | null = null;
  private swingUntil = 0;
  private nextSwing = 0;
  private refreshIn = 0;
  private auto: { node: string; kind: AutoKind; start: number; ms: number; hits: number; facing: Dir; underfoot: boolean; onDone?: () => void } | null = null;
  private readonly held = new Set<string>();
  private lanternFor: number | undefined;
  /** the reports a player standing still owes the kernel while a hunt runs; the 3D door has no walking predators to watch with */
  private readonly stillReports = new StandingReports();
  private fell = false;
  private wasNight: boolean | undefined;
  /** the music's state asked for last */
  private musicNow: MusicState | undefined;
  private readonly hazards: { kind: string; art: THREE.Object3D; frames: number; wolf?: { idle: THREE.AnimationAction | null; body: THREE.Object3D; eyes: THREE.Object3D } }[] = [];
  private prompt = '';
  private hinted = new Set<string>();
  /** slots the player stands in now, so a riddle's slot is tried once per entry */
  private inside = new Set<string>();
  private nightMix = 0;
  private attractT = 0;

  private constructor(b: Bundle, renderer: THREE.WebGLRenderer, scenery: Scenery, lite: boolean) {
    this.b = b;
    this.lite = lite;
    this.walkable = makeWalkable(b);
    this.renderer = renderer;
    this.scenery = scenery;
    this.scene = scenery.scene;
    this.camera = new THREE.PerspectiveCamera(this.portrait() ? 55 : 45, window.innerWidth / window.innerHeight, 0.1, 160);
    const zoom = Number(new URLSearchParams(location.search).get('zoom'));
    if (zoom) this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 4),
      new THREE.MeshBasicMaterial({ color: 0xf8de62, transparent: true, opacity: 0.95, depthTest: false }),
    );
    this.marker.rotation.x = Math.PI;
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    this.scene.add(this.marker);

    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 8;
    this.barCtx = canvas.getContext('2d')!;
    this.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
    this.bar.scale.set(0.9, 0.2, 1);
    this.bar.renderOrder = 11;
    this.bar.visible = false;
    this.scene.add(this.bar);
  }

  /** Builds the scene for the bundle and puts it in the canvas; the world draws itself until a session is bound. */
  static async create(b: Bundle, canvas: HTMLCanvasElement): Promise<World3D> {
    const mobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 700;
    // ?lite draws without shadows or smoothing, for a machine with no graphics card (the e2e runs in software)
    const lite = new URLSearchParams(location.search).has('lite');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
    renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio, mobile ? 1.75 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !lite;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const hosts = new Set<string>();
    for (const list of [b.resources, b.treasures]) for (const d of Object.values(list)) hosts.add(d.place.slot);
    const places: Places = { hosts, fogged: new Set(emptySlots(b).map((s) => s.id)) };
    const scenery = await createScenery(b.map as unknown as MapData, places, renderer, mobile);
    const world = new World3D(b, renderer, scenery, lite);
    await world.build();
    window.addEventListener('resize', () => world.resize());
    canvas.addEventListener(
      'wheel',
      (e) => {
        world.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, world.zoom * (1 + e.deltaY * 0.0012)));
        e.preventDefault();
      },
      { passive: false },
    );
    sound.installUnlock();
    sound.music('valley', 1500);
    return world;
  }

  private portrait(): boolean {
    return window.innerWidth < window.innerHeight;
  }

  private resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = this.portrait() ? 55 : 45;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------ building

  private async texture(ref: string): Promise<THREE.Texture | undefined> {
    const info = this.b.sprites[ref];
    if (!info) return undefined;
    let t = this.textures.get(ref);
    if (!t) {
      t = await new THREE.TextureLoader().loadAsync(`./${info.url}`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      this.textures.set(ref, t);
    }
    return t;
  }

  /**
   * The bundle's own picture of a thing, for what has no 3D model: upright and turned to the camera, or lying on the
   * ground. A sheet of frames shows its first frame.
   */
  private async picture(ref: string, flat: boolean, x: number, z: number): Promise<THREE.Object3D | undefined> {
    const base = await this.texture(ref);
    const info = this.b.sprites[ref];
    if (!base || !info) return undefined;
    const t = base.clone();
    t.needsUpdate = true;
    t.userData.own = true;
    if (info.frames > 1) {
      t.repeat.set(1 / info.frames, 1);
      t.offset.set(0, 0);
    }
    const tiles = [info.w / info.density / 16, info.h / info.density / 16] as const;
    if (flat) {
      const geometry = new THREE.PlaneGeometry(tiles[0], tiles[1]);
      geometry.userData.own = true;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, groundY(x, z) + 0.03, z);
      mesh.renderOrder = 1;
      return mesh;
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.05 }));
    sprite.center.set(0.5, 0);
    sprite.scale.set(tiles[0], tiles[1], 1);
    sprite.position.set(x, groundY(x, z), z);
    return sprite;
  }

  private async build(): Promise<void> {
    const b = this.b;
    this.labels = document.createElement('div');
    this.labels.className = 'world-labels';
    app.ui.root.prepend(this.labels);
    this.empty = emptySlots(b);

    // props: what the map says is a sign or a note, and how tall it stands
    for (const p of b.map.props) {
      const info = b.sprites[p.sprite];
      if (!info) continue;
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++) {
          if (p.sign) this.signs.set(key(x, y), p.sign);
          if (p.note) this.notes.set(key(x, y), { text: p.note, name: spriteName(p.sprite), top: info.h / info.density / 16 });
          const searchable = p.id === undefined ? undefined : searchableOn(b, p.id);
          if (searchable) this.searches.set(key(x, y), searchable);
          this.tops.set(key(x, y), info.h / info.density / 16);
        }
      }
      if (p.sign) this.signSpots.push({ slot: p.sign, x: p.x + p.w / 2, y: p.y, label: this.signatureEl(p.sign) });
      // a hazard is drawn from its own sprite: a pit lies flat, a wolf stands
      if (p.hazard) {
        const wolf = p.hazard.kind === 'predator' ? await this.wolf(p.sprite, p.x + p.w / 2, p.y + p.h / 2 + 0.4) : undefined;
        const art = wolf?.holder ?? (await this.picture(p.sprite, p.hazard.kind !== 'predator', p.x + p.w / 2, p.y + p.h / 2 + (p.hazard.kind === 'predator' ? 0.4 : 0)));
        if (art) {
          this.scene.add(art);
          this.hazards.push({ kind: p.hazard.kind, art, frames: info.frames, wolf: wolf ? { idle: wolf.idle, body: wolf.body, eyes: wolf.eyes } : undefined });
        }
      }
    }

    // nodes and finds
    for (const [id, inst] of Object.entries(b.instances)) {
      this.nodeAt.set(key(inst.x, inst.y), id);
      this.nodes.set(id, { art: null, sprite: '', alpha: -1, gen: 0 });
    }

    // people
    for (const [id, npc] of Object.entries(b.npcs)) {
      const t = npcTile(b, id);
      if (!t) continue;
      const art = await this.person(id, npc.sprite, t[0] + 0.5, t[1] + 0.5);
      if (art) this.scene.add(art);
      this.npcAt.set(key(t[0], t[1]), id);
      this.tops.set(key(t[0], t[1]), 1.5);
    }

    // a sign for every place a creator filled where the map has none
    const covered = new Set(this.signs.values());
    const signModel = await modelOf('sign');
    for (const slot of b.map.slots) {
      const content = slotContent(b, slot.id);
      if (!content || content.creator === 'core' || covered.has(slot.id)) continue;
      const at = this.freeTileBeside(slot);
      if (!at) continue;
      const g = standalone(signModel, at[0] + 0.5, at[1] + 0.5, 1.1);
      this.scene.add(g);
      this.signs.set(key(at[0], at[1]), slot.id);
      this.tops.set(key(at[0], at[1]), 1);
      this.signSpots.push({ slot: slot.id, x: at[0] + 0.5, y: at[1], label: this.signatureEl(slot.id) });
    }
    for (const spot of this.signSpots) this.labels.append(spot.label);

    // places to mend
    for (const [id, r] of Object.entries(b.restores)) {
      const slot = findSlot(b.map, r.place.slot);
      if (!slot) continue;
      const art = new THREE.Group();
      this.scene.add(art);
      this.restoreArt.set(id, art);
    }
    // places to build
    for (const [id, c] of Object.entries(b.camps)) {
      const t = campTile(b, c.slot);
      if (!t) continue;
      const art = new THREE.Group();
      art.position.set(t[0] + 0.5, groundY(t[0] + 0.5, t[1] + 0.5), t[1] + 0.5);
      this.scene.add(art);
      this.campArt.set(id, { art, built: false, taken: false });
    }
  }

  /** A person of the valley: a mini character when there is one for them, else their sprite. */
  private async person(id: string, sprite: string, x: number, z: number): Promise<THREE.Object3D | undefined> {
    const name = npcLook(id);
    if (name) {
      try {
        const h = await this.character(name);
        h.holder.position.set(x, groundY(x, z), z);
        h.holder.rotation.y = Math.PI;
        return h.holder;
      } catch {
        // the model is missing: the sprite stands in
      }
    }
    return this.picture(sprite, false, x, z);
  }

  /** A wolf of the bank: its own model when the sprite has one (art.ts), else the sprite. By day it sleeps; at night only its eyes show, red and steady (DECISIONS 2026-10-16). */
  private async wolf(sprite: string, x: number, z: number): Promise<(Hero & { body: THREE.Object3D; eyes: THREE.Object3D }) | undefined> {
    const m = wolfModel(sprite);
    if (!m) return undefined;
    try {
      const h = await this.character(m.model, m.height);
      const body = h.holder.children[0]!;
      const eyes = wolfEyes(body, m.height); // measured while the holder is still at the origin, facing the model's own way
      eyes.visible = false;
      h.holder.add(eyes);
      h.holder.position.set(x, groundY(x, z), z);
      h.holder.rotation.y = m.turn;
      return { ...h, body, eyes };
    } catch {
      return undefined;
    }
  }

  private async character(name: string, height = CHAR_HEIGHT): Promise<Hero> {
    const gltf = await this.loader.loadAsync(`./models/${name}.glb`);
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
    const s = height / Math.max(size.y, 1e-6);
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
    this.mixers.push(mixer);
    return { holder, mixer, idle, walk };
  }

  private readonly mixers: THREE.AnimationMixer[] = [];

  /** A tile next to a slot where a sign can stand without blocking anything. */
  private freeTileBeside(slot: Slot): [number, number] | undefined {
    const view = { camp: [], restored: [] };
    const candidates: [number, number][] = [];
    for (let y = slot.y; y < slot.y + slot.h; y++) candidates.push([slot.x - 1, y], [slot.x + slot.w, y]);
    for (let x = slot.x; x < slot.x + slot.w; x++) candidates.push([x, slot.y - 1], [x, slot.y + slot.h]);
    return candidates.find(([x, y]) => this.walkable(x, y, view) && !this.nodeAt.has(key(x, y)) && !this.signs.has(key(x, y)) && !this.tops.has(key(x, y)));
  }

  private signatureEl(slotId: string): HTMLElement {
    const content = slotContent(this.b, slotId);
    const el = document.createElement('div');
    if (!content) {
      el.className = 'signature sig-ink empty';
      el.textContent = 'Awaiting restoration';
      return el;
    }
    const profile = this.b.creators[content.creator];
    const sig = profile?.signature;
    el.className = `signature sig-${sig?.style ?? 'ink'}`;
    if (sig?.glyph && sig.glyph !== 'none') {
      const glyph = document.createElement('i');
      glyph.className = `glyph g-${sig.glyph}`;
      el.append(glyph);
    }
    el.append(sig?.text ?? profile?.name ?? content.creator);
    return el;
  }

  // ------------------------------------------------------------ the session

  bind(session: GameSession): void {
    for (const off of this.unbind) off();
    this.session = session;
    this.body.place(session.pos);
    this.work = null;
    this.auto = null;
    this.held.clear();
    this.lanternFor = undefined;
    this.hinted.clear();
    this.inside.clear();
    this.unbind = [
      session.on('busy', ({ ms }) => {
        this.busyFrom = session.tick;
        this.busyMs = ms;
        this.nextSwing = 0;
      }),
      session.on('change', () => void this.refresh()),
      // a fall takes the player to town: the walk and the work are over, the place they stand in is new
      session.on('events', (events) => {
        if (!events.some((e) => e.e === 'fall')) return;
        this.fell = true;
        this.body.moving = false;
        if (this.auto) this.endWork(this.auto);
        this.inside.clear();
        this.first = true;
      }),
    ];
    this.pos.set(session.pos[0] + 0.5, 0, session.pos[1] + 0.5);
    this.pos.y = walkY(this.pos.x, this.pos.z);
    this.first = true;
    void this.loadHero(session).then(() => this.refresh());
  }

  private async loadHero(session: GameSession): Promise<void> {
    const p = session.state.player;
    // a race wears today's model until its own 3D art: the 2D sheets are named for the race, the models for the old starters
    const stem = (this.b.races[p.race]?.sprite ?? '').split('/').pop()?.replace(/_down$/, '') ?? '';
    const short = ({ human: 'explorer', elf: 'forager', skeleton: 'digger' } as Record<string, string>)[stem] ?? stem;
    const wanted = `character-${short}-${p.look === 1 ? 'f' : 'm'}`;
    const fallback = p.look === 1 ? 'character-female-a' : 'character-male-a';
    if (this.heroKey === wanted && this.hero) return;
    if (this.hero) this.scene.remove(this.hero.holder);
    let hero: Hero;
    try {
      hero = await this.character(wanted);
    } catch {
      hero = await this.character(fallback);
    }
    hero.holder.add(this.scenery.lantern);
    this.scene.add(hero.holder);
    this.hero = hero;
    this.heroKey = wanted;
    this.walking = false;
  }

  /** Redraws what depends on the state: mended places, built camps, the stage of every node. */
  private async refresh(): Promise<void> {
    const s = this.session;
    if (!s) return;
    const p = s.state.player;
    for (const [id, art] of this.restoreArt) {
      const done = p.restored.includes(id);
      if (this.restoreShown.get(id) === done) continue;
      this.restoreShown.set(id, done);
      clearGroup(art);
      await this.drawRestore(id, art, done);
    }
    for (const [id, c] of this.campArt) {
      const built = p.camp.includes(id);
      const taken = !built && p.camp.some((o) => this.b.camps[o]?.slot === this.b.camps[id]?.slot);
      if (c.built === built && c.taken === taken && c.art.children.length > 0) continue;
      c.built = built;
      c.taken = taken;
      clearGroup(c.art);
      await this.drawCamp(id, c.art, built, taken);
    }
    await this.refreshNodes();
    this.refreshGlints(s);
  }

  private async drawRestore(id: string, art: THREE.Group, done: boolean): Promise<void> {
    const r = this.b.restores[id]!;
    const slot = findSlot(this.b.map, r.place.slot);
    if (!slot) return;
    if (id === 'core/old-bridge' && done) {
      const model = await modelOf('bridge_wood');
      const cz = slot.y + slot.h / 2;
      for (let i = 0; i < 4; i++) {
        const g = standalone(model, slot.x - 0.8 + 0.56 + i * 1.08, cz, 0.44);
        g.position.y = -0.1;
        art.add(g);
      }
      return;
    }
    const ref = done ? r.after : r.before;
    const info = this.b.sprites[ref];
    if (!info) return;
    if (info.w === 16 * info.density && info.h === 16 * info.density) {
      for (let y = slot.y; y < slot.y + slot.h; y++) {
        for (let x = slot.x; x < slot.x + slot.w; x++) {
          const flat = await this.picture(ref, true, x + 0.5, y + 0.5);
          if (!flat) continue;
          // a picture on a water tile (the broken bridge) lies on the surface, not on the lowered river bed under it
          if (groundY(x + 0.5, y + 0.5) < WATER_Y) flat.position.y = WATER_Y + 0.02;
          art.add(flat);
        }
      }
    } else {
      const up = await this.picture(ref, false, slot.x + slot.w / 2, slot.y + slot.h);
      if (up) art.add(up);
    }
  }

  private async drawCamp(id: string, art: THREE.Group, built: boolean, taken: boolean): Promise<void> {
    if (taken) return;
    const c = this.b.camps[id]!;
    if (built && id === 'core/campfire') {
      const stones = await modelOf('campfire_stones');
      const logs = await modelOf('campfire_logs');
      const a = standalone(stones, 0, 0, 0.3);
      const l = standalone(logs, 0, 0, 0.4, 0.3);
      for (const g of [a, l]) g.position.set(0, 0, 0);
      l.position.y = 0.02;
      const flame = flameOf();
      flame.position.y = 0.18;
      const light = new THREE.PointLight(0xffa24a, 6, 8, 2);
      light.position.set(0, 0.8, 0);
      art.add(a, l, flame, light);
      return;
    }
    const pic = await this.picture(c.sprite, false, 0, 0);
    if (!pic) return;
    pic.position.set(0, 0, 0);
    if (!built) setAlpha(pic, 0.4);
    art.add(pic);
  }

  private ready(s: GameSession, id: string): boolean {
    return (s.state.nodes[id]?.readyAt ?? 0) <= s.tick;
  }

  private async refreshNodes(): Promise<void> {
    const s = this.session;
    if (!s) return;
    const hour = hourOf(this.b, s.tick);
    for (const [id, view] of this.nodes) {
      // work under way keeps what it works on as it is until it ends
      if (this.held.has(id)) continue;
      const inst = this.b.instances[id]!;
      if (inst.kind !== 'resource') {
        await this.refreshDig(id, view, s);
        continue;
      }
      const r = this.b.resources[inst.source]!;
      const ready = this.ready(s, id);
      const inHours = !r.hours || (r.hours[0] < r.hours[1] ? hour >= r.hours[0] && hour < r.hours[1] : hour >= r.hours[0] || hour < r.hours[1]);
      const look = nodeLook(r, (s.state.nodes[id]?.readyAt ?? 0) - s.tick);
      const alpha = look.flat ? look.alpha : ready && !inHours ? 0.55 : look.alpha;
      if (view.sprite !== look.sprite) {
        const gen = ++view.gen;
        if (view.art) {
          this.scene.remove(view.art);
          dispose(view.art);
        }
        view.sprite = look.sprite;
        view.alpha = -1;
        view.art = null;
        const x = inst.x + 0.5;
        const z = inst.y + 0.5;
        const m = look.flat ? undefined : nodeModel(look.sprite);
        const art = m ? standalone(await modelOf(m.model), x, z, m.height, pickLook(inst.x, inst.y) * Math.PI * 2) : ((await this.picture(look.sprite, look.flat, x, z)) ?? null);
        // the stage changed again while this one was loading: the later draw owns the node
        if (view.gen !== gen) {
          if (art) dispose(art);
          continue;
        }
        view.art = art;
        if (art) this.scene.add(art);
      }
      if (view.art && view.alpha !== alpha) {
        view.alpha = alpha;
        setAlpha(view.art, alpha);
      }
    }
  }

  private async refreshDig(id: string, view: NodeView, s: GameSession): Promise<void> {
    const inst = this.b.instances[id]!;
    const t = this.b.treasures[inst.source];
    const ref = t && !t.tool ? (this.b.items[t.finds[0]!.item]?.sprite ?? DIG_SPOT_SPRITE) : DIG_SPOT_SPRITE;
    if (!view.art && view.sprite !== ref) {
      view.sprite = ref;
      const art = await this.picture(ref, !(t && !t.tool), inst.x + 0.5, inst.y + 0.5);
      if (art) {
        view.art = art;
        setAlpha(art, 0);
        this.scene.add(art);
      }
    }
    if (!view.art) return;
    const reach = hintDistance(this.b, s.state);
    const d = Math.max(Math.abs(inst.x - s.pos[0]), Math.abs(inst.y - s.pos[1]));
    // a start's own spot shows to that start alone, until it is dug
    const want = d > reach || !spotOpen(this.b, s.state, id) ? 0 : this.ready(s, id) ? 1 : 0.3;
    const now = view.alpha < 0 ? 0 : view.alpha;
    const next = Math.abs(want - now) < 0.02 ? want : now + (want - now) * 0.5;
    if (next !== view.alpha) {
      view.alpha = next;
      setAlpha(view.art, next);
      view.art.visible = next > 0.01;
    }
  }

  /** A few yellow lights over every target of the first open step of the main task, so the next place to go reads from the map itself. */
  private refreshGlints(s: GameSession): void {
    const targets = questTargets(this.b, s.state, s.tick);
    const k = JSON.stringify(targets);
    if (k === this.glintKey) return;
    this.glintKey = k;
    for (const g of this.glints) {
      this.scene.remove(g);
      g.material.dispose();
    }
    this.glints.length = 0;
    const tex = this.glintTexture();
    for (const t of targets) {
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf8de62, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        sp.scale.setScalar(0.35);
        sp.userData = { x: t.x + 0.5, z: t.y + 0.5, top: t.h / 16, phase: i * 2.1 };
        this.scene.add(sp);
        this.glints.push(sp);
      }
    }
  }

  private glintTex?: THREE.Texture;
  private glintTexture(): THREE.Texture {
    if (this.glintTex) return this.glintTex;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    this.glintTex = new THREE.CanvasTexture(c);
    return this.glintTex;
  }

  // ------------------------------------------------------------ the frame loop

  /** Runs forever: one frame of the world on the wall clock. */
  start(): void {
    let last = performance.now();
    // the first frames tell whether this machine needs the lighter draw; `?lite` skips the question
    const probe = this.lite ? undefined : new FrameProbe();
    const frame = (now: number) => {
      const raw = now - last;
      const dt = Math.min(raw, 100);
      last = now;
      if (probe && !probe.done) {
        probe.add(raw);
        if (probe.done && probe.slow && this.goLite()) return;
      }
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /**
   * A machine that cannot keep up gets the lighter draw. On the title the page simply reopens with `?lite` (the
   * save is on disk, nothing is lost) and this loop ends; once the player is in, the renderer drops to one pixel
   * per pixel instead and the loop goes on.
   */
  private goLite(): boolean {
    console.info('[3d] slow frames: switching to the lighter draw');
    if (!this.session?.started) {
      location.replace(liteUrl(location.href));
      return true;
    }
    this.renderer.setPixelRatio(1);
    return false;
  }

  /** the built fire breathes: its flame sways a little every frame */
  private flicker(): void {
    const k = 1 + 0.08 * Math.sin(this.time * 19) + 0.05 * Math.sin(this.time * 7.3);
    for (const c of this.campArt.values()) {
      const flame = c.art.getObjectByName('flame');
      if (flame) flame.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
    }
  }

  private update(delta: number): void {
    const dt = delta / 1000;
    this.time += dt;
    this.scenery.tick(dt, this.time);
    for (const m of this.mixers) m.update(dt);
    this.flicker();
    const s = this.session;
    if (!s || !s.started) {
      this.attract(dt);
      return;
    }
    s.advance(delta);
    this.refreshIn -= delta;
    if (this.refreshIn <= 0) {
      this.refreshIn = 250;
      void this.refreshNodes();
      this.showSignatures(s);
    }
    this.walk(s, delta);
    this.stillReports.frame(this.b, s, [], !this.body.moving, app.ui.blocking);
    this.shade(s, dt);
    this.workTick(s);
    this.drawBusy(s);
    this.updatePrompt(s);
    this.placeHero(s, dt);
    this.glow();
    this.follow(dt);
  }

  /** Before a game starts the camera drifts over the valley. */
  private attract(dt: number): void {
    this.attractT += dt;
    const x = 22 + Math.sin(this.attractT / 9) * 10;
    const z = 15 + Math.cos(this.attractT / 13) * 5;
    this.pos.set(x, groundY(x, z), z);
    this.follow(dt);
    this.scenery.followSun(x, this.pos.y, z);
  }

  private canControl(s: GameSession): boolean {
    // while an action waits for the server the player has no control: nothing is sent twice
    return !s.paused && !s.busy && !s.waiting && !app.ui.blocking;
  }

  /** The free walk, by the 2D scene's rules (NEXT 22 a); the hero turns to the motion itself, at any angle. */
  private walk(s: GameSession, delta: number): void {
    this.body.follow(s.pos);
    const input: [number, number] = this.canControl(s) ? app.controls.vector() : [0, 0];
    s.facing = facingFor(input, s.facing);
    if (input[0] !== 0 || input[1] !== 0) this.yaw = Math.atan2(input[0], input[1]);
    this.fell = false;
    for (const tile of this.body.frame(input, delta, walkStepMs(this.b, s.state), (x, y, from) => this.canWalk(s, x, y, from))) {
      // the kernel hears of each new tile; a hazard there may hurt, and a fall ends the walk
      landStep(s, tile);
      if (this.fell) return;
      this.arrive(s);
    }
  }

  /** The kernel's rule, a rock face's, and a plant or stone that is ready stands in the way (walking.ts); `from` is the tile left, the player's own when none is given. */
  canWalk(s: GameSession, x: number, y: number, from?: readonly [number, number]): boolean {
    return canEnter(this.b, this.walkable, this.nodeAt, s, x, y, from);
  }

  private arrive(s: GameSession): void {
    const [x, y] = s.pos;
    (s as { seeAt?: () => void }).seeAt?.();
    const riddles = riddleSlots(this.b, s.state);
    for (const slot of this.b.map.slots) {
      if (!inRect(x, y, slot)) {
        this.inside.delete(slot.id);
        continue;
      }
      const entered = !this.inside.has(slot.id);
      this.inside.add(slot.id);
      // an area counts once; a slot an open riddle names is tried on every entry, by day or by night (P-2)
      if ((slot.kind === 'area' && !s.state.player.visited.includes(slot.id)) || (entered && riddles.has(slot.id))) {
        s.act({ t: 'visit', slot: slot.id, at: [x, y] });
      }
      if (slot.kind === 'ruin' && !this.hinted.has(slot.id)) {
        const t = Object.values(this.b.treasures).find((d) => d.place.slot === slot.id && (d.pocket ?? s.state.player.pocket) === s.state.player.pocket);
        if (t) {
          this.hinted.add(slot.id);
          app.ui.toast(`Hint: ${t.hint}`, 'info');
        }
      }
    }
    void this.refreshNodes();
  }

  /** Day and night follow the game's clock: dark from 21:00 to 4:00, fading over two hours on each side. */
  private shade(s: GameSession, dt: number): void {
    const m = minuteOfDay(this.b, s.tick) / 60;
    const night = m >= 21 || m < 4 ? 1 : m >= 19 ? (m - 19) / 2 : m < 6 ? (6 - m) / 2 : 0;
    const dark = night >= 0.5;
    if (dark !== this.wasNight) {
      const flipped = this.wasNight !== undefined;
      this.wasNight = dark;
      // a riddle answered by night or by day: the slot the player stands in is entered again at the flip
      if (flipped) {
        this.inside.clear();
        this.arrive(s);
      }
      sound.ambience(dark ? 'night' : 'day');
    }
    // the music follows the state as in the pixel game (audio/state.ts): night outside the town, a fight, near death
    const state = musicState(signalsOf(this.b, s.state, dark));
    if (state !== this.musicNow) {
      sound.music(SONG_OF[state], crossfadeMs(this.musicNow, state));
      this.musicNow = state;
    }
    this.showHazards(s);
    this.placeLantern(s);
    if (Math.abs(night - this.nightMix) < 0.002) return;
    this.nightMix += (night - this.nightMix) * Math.min(1, dt * 2.5);
    this.scenery.setNight(this.nightMix);
  }

  /** By day a hazard shows and can be walked around: the wolf sleeps, the pit lies plain. At night the wolf is awake and the pit is lost in the dark. The hour is the kernel's. */
  private showHazards(s: GameSession): void {
    const night = isNight(this.b, s.tick);
    for (const h of this.hazards) {
      if (h.kind === 'predator' && h.wolf) {
        if (h.wolf.idle) h.wolf.idle.paused = !night;
        h.wolf.body.visible = !night;
        h.wolf.eyes.visible = night;
      } else if (h.kind === 'predator') {
        const map = (h.art as THREE.Sprite).material.map;
        if (map && h.frames > 1) map.offset.x = (night ? 1 : 0) / h.frames;
      } else h.art.visible = !night;
    }
  }

  /** Light the lantern for this night (G31): the UI calls it with the warning box. */
  lightLantern(): void {
    const s = this.session;
    if (s) this.lanternFor = lanternNight(this.b, s.state, s.pos, s.tick);
  }

  /** The lantern burns around the player while they are out in the night it was lit for; in town, by a camp or by day it is out. */
  private placeLantern(s: GameSession): void {
    const lit = this.lanternFor !== undefined && lanternNight(this.b, s.state, s.pos, s.tick) === this.lanternFor;
    const flicker = 0.5 + 0.5 * Math.sin(this.time * 5.8) * Math.sin(this.time * 2.4);
    this.scenery.lantern.intensity = lit ? 14 + 4 * flicker : 0;
  }

  private placeHero(s: GameSession, dt: number): void {
    const hero = this.hero;
    if (!hero) return;
    this.body.follow(s.pos);
    this.pos.set(this.body.x / ART_PX, 0, this.body.y / ART_PX);
    this.pos.y = walkY(this.pos.x, this.pos.z);
    hero.holder.position.copy(this.pos);
    hero.holder.rotation.y = lerpAngle(hero.holder.rotation.y, this.yaw, 1 - Math.exp(-dt * 14));
    const moving = this.body.moving;
    if (moving !== this.walking) {
      this.walking = moving;
      const from = moving ? hero.idle : hero.walk;
      const to = moving ? hero.walk : hero.idle;
      if (to) {
        to.reset().play();
        if (from) from.crossFadeTo(to, 0.2, false);
      }
    }
    this.scenery.followSun(this.pos.x, this.pos.y, this.pos.z);
  }

  /** The glints bob over their targets and the marker bounces over what a press would act on. */
  private glow(): void {
    for (const g of this.glints) {
      const d = g.userData as { x: number; z: number; top: number; phase: number };
      const t = (this.time * 0.5 + d.phase) % 1;
      g.position.set(d.x + Math.sin(d.phase * 3) * 0.25, groundY(d.x, d.z) + 0.3 + d.top * t, d.z + Math.cos(d.phase * 2) * 0.2);
      g.material.opacity = Math.sin(Math.PI * t);
    }
  }

  private follow(dt: number): void {
    const back = this.zoom * Math.cos(PITCH);
    const up = this.zoom * Math.sin(PITCH);
    // the camera stays south of the player looking north, so up on the pad is up on the screen
    const target = new THREE.Vector3(this.pos.x, this.pos.y + up, this.pos.z + back);
    target.y = Math.max(target.y, groundY(target.x, target.z) + 0.6);
    const w = this.b.map.width;
    const h = this.b.map.height;
    if (up < 4.5) {
      target.x = Math.min(w - 2.3, Math.max(2.3, target.x));
      target.z = Math.min(h - 2.3, Math.max(2.3, target.z));
    }
    if (this.first) this.camera.position.copy(target);
    else this.camera.position.lerp(target, 1 - Math.exp(-dt * 6));
    this.first = false;
    this.camera.lookAt(this.pos.x, this.pos.y + 1.0, this.pos.z);
  }

  // ------------------------------------------------------------ working

  /** One beat of a minigame: the thing shakes and sounds. */
  beat(nodeId: string, kind: WorkKind, grade: Grade): void {
    const s = this.session;
    if (!s) return;
    this.work = { node: nodeId, kind };
    this.faceNode(s, nodeId);
    this.swingUntil = performance.now() + 160;
    this.impact(nodeId, kind, grade);
  }

  private faceNode(s: GameSession, nodeId: string): void {
    const inst = this.b.instances[nodeId];
    if (!inst) return;
    const dx = inst.x - s.pos[0];
    const dy = inst.y - s.pos[1];
    if (dx === 0 && dy === 0) return;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    s.facing = dir;
    this.yaw = Math.atan2(dx, dy);
  }

  private impact(nodeId: string, kind: WorkKind, grade?: Grade): void {
    const inst = this.b.instances[nodeId];
    if (!inst) return;
    const at = this.screenOf(inst.x, inst.y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, window.innerWidth) - 0.5) * 1.2));
    sound.sfx(WORK_SOUND[kind], { pan, gain: grade === 0 ? 0.6 : 1 });
    if (grade === 0) sound.sfx('miss', { pan, gain: 0.5 });
    if (grade === 4) sound.sfx('perfect', { pan });
    const art = this.nodes.get(nodeId)?.art;
    if (art) {
      const x0 = inst.x + 0.5;
      art.position.x = x0 + 0.06;
      setTimeout(() => (art.position.x = x0), 70);
    }
  }

  private drawBusy(s: GameSession): void {
    if (!s.busy || this.busyMs <= 0) {
      this.bar.visible = false;
      if (!s.busy && this.busyMs > 0) {
        this.busyMs = 0;
        this.work = null;
      }
      return;
    }
    const k = Math.min(1, (s.tick - this.busyFrom) / this.busyMs);
    const g = this.barCtx;
    g.clearRect(0, 0, 36, 8);
    g.fillStyle = '#1b1a2e';
    g.fillRect(0, 0, 36, 8);
    g.fillStyle = '#f8de62';
    g.fillRect(2, 2, Math.round(32 * k), 4);
    (this.bar.material.map as THREE.Texture).needsUpdate = true;
    this.bar.position.set(this.pos.x, this.pos.y + CHAR_HEIGHT + 0.4, this.pos.z);
    this.bar.visible = true;
    if (this.work) {
      const phase = (s.tick - this.busyFrom) % SWING_MS;
      if (phase > SWING_MS * 0.55 && performance.now() >= this.nextSwing) {
        this.nextSwing = performance.now() + SWING_MS * 0.9;
        this.impact(this.work.node, this.work.kind);
      }
    }
  }

  /**
   * One press starts the work (DECISIONS.md, 2026-10-11): the kernel takes the action now and keeps the player busy for as
   * long as it lasts, and the blows are shown on the thing. A step away takes the action back (GameSession.cancelWork).
   */
  async startWork(nodeId: string, onDone?: () => void): Promise<void> {
    const s = this.session;
    const inst = this.b.instances[nodeId];
    if (!s || !inst || this.auto) return;
    const kind = inst.kind === 'resource' ? resourceKind(this.b.resources[inst.source]!) : treasureKind(this.b.treasures[inst.source]!);
    if (!kind) return;
    const action: Action = inst.kind === 'resource' ? { t: 'gather', node: nodeId, grade: 3, at: s.pos } : { t: 'dig', spot: nodeId, grade: 3, at: s.pos };
    // an action on the server waits for its reply, so the work starts when the answer comes
    const res = await s.act(action);
    if (!res.ok) return app.ui.toast(res.error, 'bad');
    const busy = res.events.find((e) => e.e === 'busy');
    if (!busy || busy.e !== 'busy') return;
    this.faceNode(s, nodeId);
    const underfoot = inst.x === s.pos[0] && inst.y === s.pos[1];
    // a dig that solved a riddle says nothing of the catch (G6)
    const solved = res.events.some((e) => e.e === 'riddle');
    this.auto = { node: nodeId, kind, start: s.tick, ms: busy.ms, hits: 0, facing: s.facing, underfoot, onDone: solved ? undefined : onDone };
    this.held.add(nodeId);
  }

  /** Drops the work under way, if any, before a panel reads the state. */
  dropWork(): void {
    const s = this.session;
    if (s && this.auto) this.stopWork(s, this.auto);
  }

  private workTick(s: GameSession): void {
    const w = this.auto;
    if (!w) return;
    const elapsed = s.tick - w.start;
    // the end comes first: a level-up window opening as the work ends must not undo it
    if (elapsed >= w.ms) return this.finishWork(w);
    const dir = app.controls.direction();
    if (s.paused || app.ui.blocking || (dir !== null && (w.underfoot || dir !== w.facing))) return this.stopWork(s, w);
    const beat = beatAt(elapsed, w.ms);
    if (blowsDue(beat) > w.hits) {
      w.hits = blowsDue(beat);
      this.blow(w, beat.progress);
    }
  }

  /** Walked away, or something opened: the work is dropped as if it had not begun. */
  private stopWork(s: GameSession, w: NonNullable<World3D['auto']>): void {
    this.endWork(w);
    s.cancelWork();
  }

  private endWork(w: NonNullable<World3D['auto']>): void {
    this.auto = null;
    this.busyMs = 0;
    this.held.delete(w.node);
    const art = this.nodes.get(w.node)?.art;
    if (art) {
      art.position.x = this.b.instances[w.node]!.x + 0.5;
      art.rotation.z = 0;
    }
  }

  private finishWork(w: NonNullable<World3D['auto']>): void {
    this.endWork(w);
    void this.refreshNodes();
    if (w.kind === 'fell') {
      sound.sfx('crack', { gain: 0.9 });
      setTimeout(() => sound.sfx('thud'), 450);
    }
    w.onDone?.();
  }

  /** One blow: the thing sounds and shakes; a tree leans a little more each time. */
  private blow(w: NonNullable<World3D['auto']>, progress: number): void {
    const inst = this.b.instances[w.node];
    if (!inst) return;
    const at = this.screenOf(inst.x, inst.y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, window.innerWidth) - 0.5) * 1.2));
    if (w.kind === 'fell') {
      sound.sfx('thud', { pan });
      if (progress > 0.5) sound.sfx('crack', { pan, gain: 0.25 + 0.5 * progress });
    } else if (w.kind === 'mine') {
      sound.sfx('strike', { pan });
      if (progress > 0.5) sound.sfx('crack', { pan, gain: 0.2 + 0.4 * progress });
    } else sound.sfx('dig', { pan });
    const art = this.nodes.get(w.node)?.art;
    if (!art) return;
    const x0 = inst.x + 0.5;
    art.position.x = x0 + (w.kind === 'dig' ? 0 : progress > 0.6 ? 0.08 : 0.04);
    if (w.kind === 'fell') art.rotation.z = (w.facing === 'left' ? 1 : w.facing === 'right' ? -1 : 0) * progress * 0.08;
    setTimeout(() => {
      if (this.nodes.get(w.node)?.art === art) art.position.x = x0;
    }, 70);
  }

  // ------------------------------------------------------------ interaction

  private showSignatures(s: GameSession): void {
    const blocked = app.ui.blocking;
    for (const spot of this.signSpots) {
      const d = Math.max(Math.abs(spot.x - 0.5 - s.pos[0]), Math.abs(spot.y - s.pos[1]));
      spot.label.classList.toggle('on', !blocked && d <= SIGN_REACH);
    }
    this.placeSignatures();
  }

  /** Pins every signature over its sign, where the sign is on the page. */
  private placeSignatures(): void {
    for (const spot of this.signSpots) {
      if (!spot.label.classList.contains('on')) continue;
      const at = this.screenOf(spot.x - 0.5, spot.y - 1.2);
      spot.label.style.left = `${Math.round(at.x)}px`;
      spot.label.style.top = `${Math.round(at.y)}px`;
    }
  }

  private updatePrompt(s: GameSession): void {
    const t = this.canControl(s) ? this.target(s) : undefined;
    const label = t?.label ?? '';
    if (label !== this.prompt) {
      this.prompt = label;
      app.ui.setPrompt(label);
    }
    this.marker.visible = !!t;
    if (t) {
      const x = t.tile[0] + 0.5;
      const z = t.tile[1] + 0.5;
      this.marker.position.set(x, groundY(x, z) + t.top + 0.35 + Math.sin(this.time * 6) * 0.07, z);
    }
  }

  /** The A button: act on what the player faces, stands on, or stands next to. */
  interact(): void {
    const s = this.session;
    if (!s || !this.canControl(s)) return;
    this.target(s)?.run();
  }

  private target(s: GameSession): Target | undefined {
    const [x, y] = s.pos;
    const [fx, fy] = DIRS[s.facing];
    const order: [number, number][] = [facedTile(s), [x, y]];
    for (const [dx, dy] of NEIGHBOURS) {
      if (dx === fx && dy === fy) continue;
      order.push([x + dx, y + dy]);
    }
    for (const [tx, ty] of order) {
      const t = this.targetAt(s, tx, ty);
      if (t) return t;
    }
    return undefined;
  }

  private targetAt(s: GameSession, x: number, y: number): Target | undefined {
    const b = this.b;
    const p = s.state.player;
    const k = key(x, y);
    const tile: [number, number] = [x, y];
    const top = this.tops.get(k) ?? 1;
    // a pile the player put down, under their feet (drawn in the 2D door; here the prompt finds it)
    const dropped = x === s.pos[0] && y === s.pos[1] ? pileAt(s.state, x, y) : undefined;
    if (dropped) return { label: `Pick up ${b.items[dropped]?.name ?? dropped}`, run: () => app.ui.pickUp(dropped), tile, top: 0.4 };
    const npc = this.npcAt.get(k);
    if (npc) return { label: `Talk to ${b.npcs[npc]?.name ?? npc}`, run: () => app.ui.talk(npc), tile, top };
    const nodeId = this.nodeAt.get(k);
    if (nodeId) {
      const inst = b.instances[nodeId]!;
      if (inst.kind === 'resource') {
        const r = b.resources[inst.source]!;
        // a gathered node is only ground until it grows back
        if (this.ready(s, nodeId)) {
          return { label: nodeAction(b, r), run: () => app.ui.gather(nodeId), tile, top: heightOf(b, r.sprite, 16) / 16 };
        }
      } else {
        const view = this.nodes.get(nodeId);
        if (view && view.alpha > 0.2) return { label: b.treasures[inst.source]?.tool ? 'Dig here' : 'Pick up', run: () => app.ui.dig(nodeId), tile, top: 0.4 };
      }
    }
    for (const [id, c] of Object.entries(b.camps)) {
      const t = campTile(b, c.slot);
      if (!t || t[0] !== x || t[1] !== y) continue;
      if (p.camp.includes(id)) {
        if (c.provides) return { label: `Cook at the ${c.title}`, run: () => app.ui.craft(c.provides!), tile, top: 0.6 };
        return { label: c.title, run: () => app.ui.campInfo(id), tile, top: 0.6 };
      }
      // the kernel refuses to build under the player's feet, so offer it only from beside the spot
      const underfoot = x === s.pos[0] && y === s.pos[1];
      if (!underfoot && !p.camp.some((o) => b.camps[o]?.slot === c.slot)) return { label: `Build: ${c.title}`, run: () => app.ui.build(id), tile, top: 0.6 };
    }
    for (const [id, r] of Object.entries(b.restores)) {
      const slot = findSlot(b.map, r.place.slot);
      if (!slot || !inRect(x, y, slot) || p.restored.includes(id)) continue;
      // a restore with no inputs opens only as a quest's reward: nothing to mend by hand
      return { label: r.inputs.length === 0 ? `Look at the ${r.title}` : `Mend the ${r.title}`, run: () => app.ui.restore(id), tile, top: 0.6 };
    }
    const sign = this.signs.get(k);
    if (sign) return { label: 'Read the sign', run: () => app.ui.sign(sign), tile, top };
    const note = this.notes.get(k);
    if (note) return { label: `Look at the ${note.name}`, run: () => app.ui.note(note.text), tile, top: note.top };
    const searchable = this.searches.get(k);
    if (searchable) return { label: 'Search', run: () => void app.ui.search(searchable), tile, top };
    const fog = this.empty.find((slot) => inRect(x, y, slot));
    const faced = facedTile(s);
    if (fog && x === faced[0] && y === faced[1]) {
      return { label: `Look at the ${fog.label ?? 'mist'}`, run: () => app.ui.sign(fog.id), tile, top: 0.6 };
    }
    return undefined;
  }

  /** What a sign says: who made the place, how much they gave, or an invitation when nobody has yet. */
  signText(slotId: string): SignInfo {
    const b = this.b;
    const slot = findSlot(b.map, slotId);
    const p = this.session?.state.player;
    if (slot?.kind === 'camp') return { title: `${p?.name || 'Your'}'s camp`, lines: ['Build here: a fire first, more later.'], empty: false };
    const content = slotContent(b, slotId);
    if (!content) {
      return {
        title: slot?.label ?? 'An empty place',
        lines: [
          pickOf(ECHOES),
          'Awaiting restoration. Nobody has brought this place back yet. Anyone can - with a short data file, a sprite and an AI tool if you like.',
        ],
        empty: true,
      };
    }
    const lines: string[] = [];
    const stone = content.kind === 'restore' && p ? stoneView(b.restores[content.id], p.restored, p.name) : undefined;
    if (content.kind === 'restore' && p?.restored.includes(content.id) && !stone) lines.push(`Mended by ${p.name}.`);
    const profile = b.creators[content.creator];
    const entry = b.board[content.creator];
    const name = profile?.name ?? (content.creator === 'core' ? 'the core team' : content.creator);
    const role = profile?.role ? ` (${profile.role})` : '';
    lines.push(`Added by ${name}${role}.`);
    if (entry) {
      lines.push(`${entry.points} creator points · ${entry.commits} commits`);
    }
    if (content.ai_tools?.length) {
      lines.push(`Made with: ${content.ai_tools.join(', ')}.`);
    }
    return {
      title: content.title,
      lines,
      empty: false,
      creator: {
        name,
        role: profile?.role,
        signature: profile?.signature,
        points: entry?.points,
        commits: entry?.commits,
        ai: content.ai_tools ?? [],
        mendedBy: content.kind === 'restore' && p?.restored.includes(content.id) && !stone ? p.name : undefined,
        stone,
      },
    };
  }

  /** Where a tile is on the page, for UI that points at the world. */
  screenOf(x: number, y: number): { x: number; y: number } {
    const v = new THREE.Vector3(x + 0.5, groundY(x + 0.5, y + 0.5) + 0.6, y + 0.5).project(this.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  /** Test and support hook (?debug): where the player is and what the world holds. */
  debug(): Record<string, unknown> {
    const s = this.session;
    return {
      pos: s?.pos,
      drawn: [this.pos.x, this.pos.y, this.pos.z],
      night: this.nightMix,
      hero: !!this.hero,
      nodes: this.nodes.size,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }
}
