import type * as Phaser from 'phaser';
import { CoastalWaterStudy, type WaterLayer, type WaterRenderBounds } from './coastal-water-study';
import type { WaterSample, WaterWeather } from './water-response';

interface ShorePoint { x: number; y: number; order: number }
interface ShoreTree { point: ShorePoint; axis: 'x' | 'y'; left?: ShoreTree; right?: ShoreTree }

function shoreTree(points: ShorePoint[], depth = 0): ShoreTree | undefined {
  if (!points.length) return undefined;
  const axis = depth % 2 ? 'y' : 'x';
  points.sort((a, b) => a[axis] - b[axis] || a.order - b.order);
  const middle = Math.floor(points.length / 2);
  return { point: points[middle]!, axis, left: shoreTree(points.slice(0, middle), depth + 1), right: shoreTree(points.slice(middle + 1), depth + 1) };
}

/** Static 2px shoreline geometry, indexed once. Samples retain world coordinates.
 * The original study's boundary points, nearest-point ties and 80px wind shelter
 * are retained; there is no finite depth cutoff or chunk-local wave phase.
 */
export class WorldWaterField {
  private readonly tree?: ShoreTree;
  readonly shorePoints: number;

  constructor(readonly width: number, readonly height: number, private readonly sourceLandAt: (x: number, y: number) => boolean) {
    const boundary: ShorePoint[] = [];
    for (let y = 1; y < height; y += 2) for (let x = 1; x < width; x += 2) {
      if (!this.landAt(x, y)) continue;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        if (!this.landAt(x + dx!, y + dy!)) boundary.push({ x: x + dx! / 2, y: y + dy! / 2, order: boundary.length });
      }
    }
    this.shorePoints = boundary.length;
    this.tree = shoreTree(boundary);
  }

  landAt(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.sourceLandAt(x, y);
  }

  sampleAt(x: number, y: number): WaterSample {
    const land = this.landAt(x, y);
    let squared = Infinity, nearest: ShorePoint | undefined;
    const visit = (node?: ShoreTree): void => {
      if (!node) return;
      const p = node.point, d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < squared || (d === squared && p.order < (nearest?.order ?? Infinity))) { squared = d; nearest = p; }
      const delta = node.axis === 'x' ? x - p.x : y - p.y;
      visit(delta <= 0 ? node.left : node.right);
      if (delta ** 2 <= squared) visit(delta <= 0 ? node.right : node.left);
    };
    if (!land) visit(this.tree);
    const distance = Math.sqrt(squared), length = distance || 1;
    return { x, y, land, distance, nx: nearest ? (x - nearest.x) / length : 0, ny: nearest ? (y - nearest.y) / length : 0, exposure: .2 };
  }

  region(x: number, y: number, width: number, height: number): WaterSample[] {
    const field: WaterSample[] = [];
    for (let sy = y + 1; sy < y + height; sy += 2) for (let sx = x + 1; sx < x + width; sx += 2) field.push(this.sampleAt(sx, sy));
    return field;
  }

  expose(field: WaterSample[], wind: readonly [number, number]): void {
    const length = Math.hypot(...wind) || 1, wx = wind[0] / length, wy = wind[1] / length;
    for (const sample of field) {
      let shelter = 1;
      if (!sample.land) for (let d = 2; d <= 80; d += 2) {
        const x = sample.x - wx * d, y = sample.y - wy * d;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) break;
        if (this.landAt(x, y)) { shelter = .18; break; }
      }
      const facing = Math.max(0, -(wx * sample.nx + wy * sample.ny));
      sample.exposure = shelter * (.2 + .8 * facing);
    }
  }
}

interface WaterChunk { water: CoastalWaterStudy; wind: string; visible: boolean }
interface WorldWaterOptions { chunkSize?: number; maxCachedChunks?: number }
let nextWorld = 0;

/** Dev-world adapter around the approved compositor. Only visible chunks animate;
 * a small viewport margin covers motion between its 20fps updates. Terrain and
 * nearest-shore geometry are static, and generated raster art is shared.
 */
export class WorldStudyWater {
  weather: WaterWeather = 'windy';
  slope = .4;
  wind: [number, number] = [-1, .25];
  layers: Record<WaterLayer, boolean> = { bed: true, reflection: true, surface: true, breakers: true };
  time = 0;
  renders = 0;
  readonly geometry: WorldWaterField;
  private readonly chunks = new Map<string, WaterChunk>();
  private readonly dryChunks = new Set<string>();
  private readonly chunkSize: number;
  private readonly maxCachedChunks: number;
  private readonly prefix = `world-study-water-${nextWorld++}`;
  private bounds?: WaterRenderBounds;
  private paintedBounds?: WaterRenderBounds;
  private budget = 0;
  private destroyed = false;
  private readonly dispose = () => this.destroy();

  constructor(private readonly scene: Phaser.Scene, readonly width: number, readonly height: number,
    landAt: (x: number, y: number) => boolean, private readonly landColor: (x: number, y: number) => readonly number[] | undefined,
    options: WorldWaterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 384;
    this.maxCachedChunks = options.maxCachedChunks ?? 16;
    if (width <= 0 || height <= 0 || width % 2 || height % 2 || this.chunkSize <= 0 || this.chunkSize % 2 || this.maxCachedChunks < 1) throw new Error('World water needs positive even pixel bounds and a positive cache size');
    this.geometry = new WorldWaterField(width, height, landAt);
    scene.events.once('shutdown', this.dispose);
  }

  get stats() {
    return { cachedChunks: this.chunks.size, visibleChunks: [...this.chunks.values()].filter(c => c.visible).length, shorePoints: this.geometry.shorePoints };
  }

  setView(camera: Phaser.Cameras.Scene2D.Camera): void {
    if (this.destroyed) return;
    // Match Phaser's preRender view calculation without relying on last frame's worldView.
    const width = camera.width / camera.zoom, height = camera.height / camera.zoom;
    const left = camera.scrollX + camera.width / 2 - width / 2, top = camera.scrollY + camera.height / 2 - height / 2;
    const next = { left: Math.max(0, left), top: Math.max(0, top), right: Math.min(this.width, left + width), bottom: Math.min(this.height, top + height) };
    const painted = this.paintedBounds;
    const jumped = !painted || Math.abs(next.left - painted.left) > 16 || Math.abs(next.top - painted.top) > 16
      || Math.abs(next.right - painted.right) > 16 || Math.abs(next.bottom - painted.bottom) > 16;
    this.bounds = next;
    for (const chunk of this.chunks.values()) { chunk.visible = false; chunk.water.setVisible(false); }
    if (next.right > next.left && next.bottom > next.top) {
      for (let cy = Math.floor(next.top / this.chunkSize); cy < Math.ceil(next.bottom / this.chunkSize); cy++) {
        for (let cx = Math.floor(next.left / this.chunkSize); cx < Math.ceil(next.right / this.chunkSize); cx++) {
          const key = `${cx}:${cy}`;
          if (this.dryChunks.has(key)) continue;
          let chunk = this.chunks.get(key), created = false;
          if (!chunk) {
            const x = cx * this.chunkSize, y = cy * this.chunkSize;
            const chunkWidth = Math.min(this.chunkSize, this.width - x), chunkHeight = Math.min(this.chunkSize, this.height - y);
            const field = this.geometry.region(x, y, chunkWidth, chunkHeight);
            if (field.every(sample => sample.land)) { this.dryChunks.add(key); continue; }
            const water = new CoastalWaterStudy(this.scene, chunkWidth, (sx, sy) => this.geometry.landAt(sx, sy), this.landColor, {
              x, y, height: chunkHeight, key: `${this.prefix}-${cx}-${cy}`, deferRender: true,
              field: wind => { this.geometry.expose(field, wind); return field; },
              sampleAt: (sx, sy) => this.geometry.sampleAt(Math.max(1, Math.min(this.width - 1, sx)), Math.max(1, Math.min(this.height - 1, sy))),
            });
            chunk = { water, wind: '-1,0.25', visible: true };
            this.chunks.set(key, chunk);
            created = true;
          }
          chunk.visible = true;
          chunk.water.setVisible(true);
          // Map insertion order is the cache's least-recently-viewed order.
          this.chunks.delete(key); this.chunks.set(key, chunk);
          const rebuilt = this.sync(chunk);
          if (created || rebuilt || jumped) chunk.water.render(this.renderBounds());
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      if (this.chunks.size <= this.maxCachedChunks) break;
      if (chunk.visible) continue;
      chunk.water.destroy(); this.chunks.delete(key);
    }
    if (jumped) this.paintedBounds = { ...next };
  }

  private renderBounds(): WaterRenderBounds | undefined {
    if (!this.bounds) return undefined;
    return { left: this.bounds.left - 16, top: this.bounds.top - 16, right: this.bounds.right + 16, bottom: this.bounds.bottom + 16 };
  }

  private sync(chunk: WaterChunk): boolean {
    const water = chunk.water;
    water.time = this.time; water.weather = this.weather; water.slope = this.slope; water.layers = this.layers; water.wind = this.wind;
    const wind = this.wind.join(',');
    if (chunk.wind === wind) return false;
    chunk.wind = wind; water.rebuild(); return true;
  }

  advance(dt: number): void {
    if (this.destroyed) return;
    this.time += dt; this.budget += dt;
    if (this.budget >= 1 / 20) { this.budget %= 1 / 20; this.render(); }
  }

  render(): void {
    if (this.destroyed) return;
    const bounds = this.renderBounds();
    for (const chunk of this.chunks.values()) if (chunk.visible) { this.sync(chunk); chunk.water.render(bounds); }
    if (this.bounds) this.paintedBounds = { ...this.bounds };
    this.renders++;
  }

  rebuild(): void {
    for (const chunk of this.chunks.values()) if (chunk.visible) { chunk.wind = ''; this.sync(chunk); }
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.dispose);
    for (const chunk of this.chunks.values()) chunk.water.destroy();
    this.chunks.clear();
    this.dryChunks.clear();
  }
}
