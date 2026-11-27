/**
 * Streaming a painted land by units (V5b, private #44): the scene is cut by the exporter (tools/art/scene/export.py --tiles) into units on the 64 px grid, each layer of a unit one
 * picture, and only the units near the player are held as textures. This file is the pure state machine behind a port (fetch, decode, upload, drop, the clock): no browser, no
 * Phaser, so a unit test drives it with a fake port and a fake clock (game/test/painted-stream.test.ts). The mount (painted.ts) is the port.
 *
 * The rules, from the V5b note:
 *  - first light: a unit is lit when its first layers (ground, walls, objects: what a player sees) are resident; its relief (the normals) follows and the unit draws flat-lit meanwhile;
 *  - order: the pinned units' first layers (the standing unit first, then by distance), then the pinned units' relief, then the prefetch ring's first layers and relief by distance;
 *  - at most two fetches at once, one decode at a time, one texture upload per tick (the frame budget);
 *  - pinned: the standing unit and every unit the camera's view, padded by `pad` px, touches; a pinned unit is never evicted;
 *  - the standing unit changes only when the player is `inside` px into the next one, so a figure on a seam does not flip it every step;
 *  - prefetch: the units within `ring` px of the player;
 *  - cap: the resident bytes (w x h x 4 of every texture held) stay at or under `cap`; over it, the unpinned unit farthest from the player is evicted, one at a time, and only
 *    `linger` ms after it left the padded view (so a figure walking along a seam does not thrash);
 *  - the step ahead waits (`hold`) while the unit it walks into is not lit, when the player is within `edge` px of it; the mount holds it at most `holdMax` ms.
 */

export interface StreamLayerMeta {
  /** the layer's name: ground, walls, objects, ground-n, walls-n, objects-n */
  name: string;
  /** the file under the scene folder */
  file: string;
  /** the picture's size in px (its texture is w x h x 4 bytes) */
  w: number;
  h: number;
  /** the file's size on the wire */
  bytes: number;
}

/** a unit's baked wind (tiles/wind-<ux>-<uy>.json, tools/src/art/scene-wind.ts): per sheet (the tall pieces' or the low growth's) its two pictures and where each frame lies, [object, lean, k, x, y] */
export interface WindSheets {
  sheets: { low: boolean; w: number; h: number; c: string; n: string; place: [number, number, number, number, number][] }[];
}

export interface StreamUnitMeta {
  ux: number;
  uy: number;
  /** the unit's rectangle in scene px */
  x: number;
  y: number;
  w: number;
  h: number;
  layers: StreamLayerMeta[];
  /** the exporter's alpha of the unit's objects sheet (w x h bytes, row by row, zlib), read in place of the readback of the picture; absent on a scene baked before it */
  alpha?: string;
  /** the exporter's wind of the unit: the json naming its sheets and their frames' places (WindSheets); absent on a scene baked before it */
  wind?: string;
  /** what of the scene the unit can show: its rectangle and its pieces' (a piece stands in the unit of its foot and may reach over the seam); pinning reads it, absent = the rectangle */
  reach?: { x: number; y: number; w: number; h: number };
}

export interface StreamConfig {
  /** px the camera's view is padded by for pinning (3 tiles) */
  pad: number;
  /** px the player must be inside the next unit before it becomes the standing one (2 tiles) */
  inside: number;
  /** px of the prefetch ring round the player (12 tiles) */
  ring: number;
  /** the cap of resident texture bytes */
  cap: number;
  /** ms an unpinned unit waits after it left the padded view before it may be evicted */
  linger: number;
  /** px from a unit that is not lit at which the step toward it waits */
  edge: number;
  /** fetches at once */
  fetches: number;
}

/** 64 px a tile; the phone's cap of 120 MB (V5b note) */
export const STREAM: StreamConfig = { pad: 3 * 64, inside: 2 * 64, ring: 12 * 64, cap: 120 * 1024 * 1024, linger: 5000, edge: 2 * 64, fetches: 2 };

/** the layers that light a unit; the rest are its relief */
export const FIRST_LAYERS: ReadonlySet<string> = new Set(['ground', 'walls', 'objects']);

/** `uploading`: the texture is made and its pixels go in by bands, one a tick (StreamPort.band); its bytes count, it is not resident yet and its unit is not lit */
export type KeyState = 'absent' | 'fetching' | 'fetched' | 'decoding' | 'decoded' | 'uploading' | 'resident';

/** The mount's side: what the machine asks of the browser and of the scene. */
export interface StreamPort<Blob = unknown, Bitmap = unknown> {
  fetch(url: string): Promise<Blob>;
  decode(blob: Blob, layer: StreamLayerMeta, unit: StreamUnitMeta): Promise<Bitmap>;
  /**
   * the texture is made from the bitmap and the scene shows it (the mount builds what the layer carries); `'bands'`: the texture is made but its pixels go in by bands, and the
   * scene shows it when `band` says the last one is in
   */
  upload(key: string, bitmap: Bitmap, layer: StreamLayerMeta, unit: StreamUnitMeta): void | 'bands';
  /** the next band of a texture `upload` began by bands: true once its last band is in and the scene shows it */
  band?(key: string): boolean;
  /** the texture (or a bitmap not uploaded yet) is let go, and what the scene built on it */
  drop(key: string, layer: StreamLayerMeta, unit: StreamUnitMeta, wasResident: boolean): void;
  /** the unit's first layers are all resident */
  lit?(unit: StreamUnitMeta): void;
  /** a fetch or a decode failed (the key goes back to absent and is asked again later) */
  failed?(key: string, error: unknown): void;
}

export interface StreamView {
  /** the player's feet in scene px */
  player: readonly [number, number];
  /** the camera's view in scene px */
  view: { x: number; y: number; w: number; h: number };
}

interface KeyRec<Blob, Bitmap> {
  state: KeyState;
  gen: number;
  blob?: Blob;
  bitmap?: Bitmap;
}

export const unitKey = (u: { ux: number; uy: number }): string => `${u.ux},${u.uy}`;
export const layerKey = (u: { ux: number; uy: number }, layer: string): string => `painted:${layer}@${u.ux},${u.uy}`;
export const layerBytes = (l: StreamLayerMeta): number => l.w * l.h * 4;

const overlaps = (a: { x: number; y: number; w: number; h: number }, r: { x: number; y: number; w: number; h: number }): boolean => a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y;
/** whether anything the unit shows lies in the rectangle (its reach) */
const touches = (u: StreamUnitMeta, r: { x: number; y: number; w: number; h: number }): boolean => overlaps(u.reach ?? u, r);
/** the distance from a point to a unit's rectangle (0 inside) */
export const distTo = (u: StreamUnitMeta, p: readonly [number, number]): number => {
  const dx = Math.max(u.x - p[0], 0, p[0] - (u.x + u.w));
  const dy = Math.max(u.y - p[1], 0, p[1] - (u.y + u.h));
  return Math.hypot(dx, dy);
};
const inside = (u: StreamUnitMeta, p: readonly [number, number]): boolean => p[0] >= u.x && p[0] < u.x + u.w && p[1] >= u.y && p[1] < u.y + u.h;
/** how far a point lies inside a unit, from its nearest edge (negative outside) */
const depthIn = (u: StreamUnitMeta, p: readonly [number, number]): number => Math.min(p[0] - u.x, u.x + u.w - p[0], p[1] - u.y, u.y + u.h - p[1]);

export class PaintedStream<Blob = unknown, Bitmap = unknown> {
  readonly units: readonly StreamUnitMeta[];
  readonly cfg: StreamConfig;
  private readonly port: StreamPort<Blob, Bitmap>;
  private readonly base: string;
  private readonly now: () => number;
  private readonly keys = new Map<string, KeyRec<Blob, Bitmap>>();
  private readonly layerOf = new Map<string, { unit: StreamUnitMeta; layer: StreamLayerMeta }>();
  private standingU: StreamUnitMeta | undefined;
  private pinned = new Set<string>();
  /** when each unpinned unit left the padded view (ms) */
  private readonly leftAt = new Map<string, number>();
  private readonly litUnits = new Set<string>();
  private decodingNow = 0;
  private fetchingNow = 0;
  private last: StreamView | undefined;
  /** every unit pinned (a rig of the whole scene) */
  private all = false;
  /** the bytes of the resident textures */
  bytes = 0;
  /** the most the resident bytes ever reached */
  peak = 0;
  /** the evictions, with their time, for the tests and the report */
  readonly evictions: { unit: string; at: number }[] = [];
  /** the most fetches that were ever in flight at once */
  peakFetches = 0;

  constructor(units: readonly StreamUnitMeta[], base: string, port: StreamPort<Blob, Bitmap>, now: () => number, cfg: StreamConfig = STREAM) {
    this.units = units;
    this.base = base;
    this.port = port;
    this.now = now;
    this.cfg = cfg;
    for (const u of units) for (const l of u.layers) this.layerOf.set(layerKey(u, l.name), { unit: u, layer: l });
  }

  state(key: string): KeyState {
    return this.keys.get(key)?.state ?? 'absent';
  }

  /** a unit is lit when its first layers are resident */
  isLit(u: { ux: number; uy: number }): boolean {
    return this.litUnits.has(unitKey(u));
  }

  get standing(): StreamUnitMeta | undefined {
    return this.standingU;
  }

  /** the units pinned now, by key */
  pinnedKeys(): string[] {
    return [...this.pinned];
  }

  /** the units the view touches that are not lit yet (a hole the overview covers) */
  unlitInView(view: { x: number; y: number; w: number; h: number }): StreamUnitMeta[] {
    return this.units.filter((u) => touches(u, view) && !this.isLit(u));
  }

  /** whether the player's unit is lit and so is every unit the view shows (first light: the frame she sees is whole) */
  standingLit(): boolean {
    if (!this.standingU || !this.isLit(this.standingU)) return false;
    return !this.last || this.unlitInView(this.last.view).length === 0;
  }

  /**
   * Whether the player, standing in no unit yet, is within `ring` px of one and the nearest is lit, and so is every unit the view shows: the land has begun to show and its
   * one-time work after first light may start while she walks up to it (B4c: it then lands before she is in, not in the first frames inside).
   */
  nearLit(): boolean {
    const p = this.last?.player;
    if (!p || this.standingU || !this.last) return false;
    let best: StreamUnitMeta | undefined;
    for (const u of this.units) if (distTo(u, p) <= this.cfg.ring && (!best || distTo(u, p) < distTo(best, p))) best = u;
    return !!best && this.isLit(best) && this.unlitInView(this.last.view).length === 0;
  }

  /** whether every unit is lit and every layer resident (a whole-scene rig waits for it) */
  complete(): boolean {
    return this.units.every((u) => u.layers.every((l) => this.state(layerKey(u, l.name)) === 'resident'));
  }

  /** Pins every unit (a rig that frames the whole scene); the cap is then not kept. */
  pinAll(on = true): void {
    this.all = on;
  }

  unitAt(p: readonly [number, number]): StreamUnitMeta | undefined {
    return this.units.find((u) => inside(u, p));
  }

  /**
   * Whether the step from the player in direction (dx, dy) must wait: the unit it walks toward is not lit and the player is within `edge` px of it. The mount holds the step at
   * most its own time (the maze peek's hold, 3 s) and lets it go after.
   */
  holdStep(dx: number, dy: number): boolean {
    const p = this.last?.player;
    if (!p) return false;
    const ahead: [number, number] = [p[0] + Math.sign(dx) * this.cfg.edge, p[1] + Math.sign(dy) * this.cfg.edge];
    const u = this.unitAt(ahead);
    return !!u && !this.isLit(u);
  }

  /** One step of the machine: the view now, then what to fetch, decode, upload and evict. Call it every frame. */
  tick(v: StreamView): void {
    this.last = v;
    const t = this.now();
    this.updateStanding(v.player);
    const padded = { x: v.view.x - this.cfg.pad, y: v.view.y - this.cfg.pad, w: v.view.w + 2 * this.cfg.pad, h: v.view.h + 2 * this.cfg.pad };
    const pinned = new Set<string>();
    for (const u of this.units) if (this.all || touches(u, padded) || u === this.standingU) pinned.add(unitKey(u));
    for (const u of this.units) {
      const k = unitKey(u);
      if (pinned.has(k)) this.leftAt.delete(k);
      else if (this.pinned.has(k) || (!this.leftAt.has(k) && this.held(u))) this.leftAt.set(k, t);
    }
    this.pinned = pinned;
    this.upload();
    this.decode();
    this.evict(v.player, t);
    this.fetch(v.player);
  }

  /** the wanted keys in order: pinned first layers, pinned relief, ring first layers, ring relief; each group by distance, the standing unit first */
  private wanted(p: readonly [number, number]): { key: string; pinned: boolean }[] {
    const order = (us: StreamUnitMeta[]) => us.sort((a, b) => (a === this.standingU ? -1 : b === this.standingU ? 1 : distTo(a, p) - distTo(b, p)));
    const pin = order(this.units.filter((u) => this.pinned.has(unitKey(u))));
    const ring = order(this.units.filter((u) => !this.pinned.has(unitKey(u)) && distTo(u, p) <= this.cfg.ring));
    const out: { key: string; pinned: boolean }[] = [];
    const add = (us: StreamUnitMeta[], first: boolean, pinned: boolean) => {
      for (const u of us) for (const l of u.layers) if (FIRST_LAYERS.has(l.name) === first) out.push({ key: layerKey(u, l.name), pinned });
    };
    add(pin, true, true);
    add(pin, false, true);
    add(ring, true, false);
    add(ring, false, false);
    return out;
  }

  private updateStanding(p: readonly [number, number]): void {
    const here = this.unitAt(p);
    if (!here) return;
    if (!this.standingU || !inside(this.standingU, p)) {
      // she left the standing unit: the next one stands once she is far enough into it (or at once, when there was none or she is far from the old one)
      if (!this.standingU || depthIn(here, p) >= this.cfg.inside || distTo(this.standingU, p) >= this.cfg.inside) this.standingU = here;
    }
  }

  /** the bytes a key will hold once uploaded */
  private bytesOf(key: string): number {
    const l = this.layerOf.get(key);
    return l ? layerBytes(l.layer) : 0;
  }

  /** the bytes resident or on their way (fetching to decoded) */
  private committed(): number {
    let n = 0;
    for (const [k, r] of this.keys) if (r.state !== 'absent') n += this.bytesOf(k);
    return n;
  }

  private held(u: StreamUnitMeta): boolean {
    return u.layers.some((l) => this.state(layerKey(u, l.name)) !== 'absent');
  }

  private fetch(p: readonly [number, number]): void {
    if (this.fetchingNow >= this.cfg.fetches) return;
    for (const { key, pinned } of this.wanted(p)) {
      if (this.fetchingNow >= this.cfg.fetches) break;
      if (this.state(key) !== 'absent') continue;
      // the cap: a pinned unit is always fetched; a prefetch only when it fits
      if (!pinned && !this.all && this.committed() + this.bytesOf(key) > this.cfg.cap) continue;
      this.start(key);
    }
  }

  private start(key: string): void {
    const rec: KeyRec<Blob, Bitmap> = { state: 'fetching', gen: (this.keys.get(key)?.gen ?? 0) + 1 };
    this.keys.set(key, rec);
    const { layer } = this.layerOf.get(key)!;
    this.fetchingNow++;
    this.peakFetches = Math.max(this.peakFetches, this.fetchingNow);
    const gen = rec.gen;
    this.port.fetch(`${this.base}/${layer.file}`).then(
      (blob) => {
        this.fetchingNow--;
        const r = this.keys.get(key);
        if (!r || r.gen !== gen || r.state !== 'fetching') return;
        r.state = 'fetched';
        r.blob = blob;
      },
      (e: unknown) => {
        this.fetchingNow--;
        const r = this.keys.get(key);
        if (r && r.gen === gen) this.keys.delete(key);
        this.port.failed?.(key, e);
      },
    );
  }

  /** one decode at a time, the most wanted first */
  private decode(): void {
    if (this.decodingNow > 0 || !this.last) return;
    const next = this.wanted(this.last.player).find((w) => this.state(w.key) === 'fetched') ?? [...this.keys].map(([key]) => ({ key })).find((w) => this.state(w.key) === 'fetched');
    if (!next) return;
    const rec = this.keys.get(next.key)!;
    const { unit, layer } = this.layerOf.get(next.key)!;
    rec.state = 'decoding';
    this.decodingNow++;
    const gen = rec.gen;
    const blob = rec.blob as Blob;
    rec.blob = undefined;
    this.port.decode(blob, layer, unit).then(
      (bitmap) => {
        this.decodingNow--;
        const r = this.keys.get(next.key);
        if (!r || r.gen !== gen || r.state !== 'decoding') return;
        r.state = 'decoded';
        r.bitmap = bitmap;
      },
      (e: unknown) => {
        this.decodingNow--;
        const r = this.keys.get(next.key);
        if (r && r.gen === gen) this.keys.delete(next.key);
        this.port.failed?.(next.key, e);
      },
    );
  }

  /** one upload a tick, the most wanted first; a texture laid by bands takes the tick's upload until its last band is in */
  private upload(): void {
    const p = this.last?.player;
    if (!p) return;
    for (const [key, r] of this.keys) {
      if (r.state !== 'uploading') continue;
      if (this.port.band?.(key) ?? true) {
        r.state = 'resident';
        this.light(this.layerOf.get(key)!.unit);
      }
      return;
    }
    const next = this.wanted(p).find((w) => this.state(w.key) === 'decoded') ?? [...this.keys].map(([key]) => ({ key })).find((w) => this.state(w.key) === 'decoded');
    if (!next) return;
    const rec = this.keys.get(next.key)!;
    const { unit, layer } = this.layerOf.get(next.key)!;
    rec.state = 'resident';
    if (this.port.upload(next.key, rec.bitmap as Bitmap, layer, unit) === 'bands') rec.state = 'uploading';
    rec.bitmap = undefined;
    this.bytes += layerBytes(layer);
    this.peak = Math.max(this.peak, this.bytes);
    this.light(unit);
  }

  /** the unit lights once its first layers are all resident */
  private light(unit: StreamUnitMeta): void {
    const k = unitKey(unit);
    if (!this.litUnits.has(k) && unit.layers.filter((l) => FIRST_LAYERS.has(l.name)).every((l) => this.state(layerKey(unit, l.name)) === 'resident')) {
      this.litUnits.add(k);
      this.port.lit?.(unit);
    }
  }

  /** over the cap, the unpinned unit farthest from the player whose linger ran out goes, one a tick */
  private evict(p: readonly [number, number], t: number): void {
    if (this.all || this.committed() <= this.cfg.cap) return;
    const can = this.units.filter((u) => {
      const k = unitKey(u);
      const left = this.leftAt.get(k);
      return !this.pinned.has(k) && this.held(u) && left !== undefined && t - left >= this.cfg.linger;
    });
    if (!can.length) return;
    const far = can.reduce((a, b) => (distTo(b, p) > distTo(a, p) ? b : a));
    this.dropUnit(far, t);
  }

  private dropUnit(u: StreamUnitMeta, t: number): void {
    const k = unitKey(u);
    for (const l of u.layers) {
      const key = layerKey(u, l.name);
      const r = this.keys.get(key);
      if (!r) continue;
      // a texture still laid by bands is made: the mount lets it go as a resident one
      const was = r.state === 'resident' || r.state === 'uploading';
      if (was) this.bytes -= layerBytes(l);
      // the generation moves on, so a fetch or decode still in flight lands nowhere
      this.keys.set(key, { state: 'absent', gen: r.gen + 1 });
      this.port.drop(key, l, u, was);
    }
    this.litUnits.delete(k);
    this.leftAt.delete(k);
    this.evictions.push({ unit: k, at: t });
  }
}
