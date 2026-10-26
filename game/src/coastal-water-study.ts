import type * as Phaser from 'phaser';
import { buildWaterField, WATER_WEATHER, type WaterSample, type WaterWeather } from './water-response';
import { waterLayers } from './layered-water';

type Raster = { width: number; height: number; data: Uint8ClampedArray };
type WaterRasters = Record<'bed' | 'body' | 'light' | 'foam', Raster>;
const rasterCache = new WeakMap<Phaser.Textures.TextureManager, WaterRasters>();
export type WaterLayer = 'bed' | 'reflection' | 'surface' | 'breakers';
export interface WaterRenderBounds { left: number; top: number; right: number; bottom: number }
/** Optional world-region plumbing; the standalone study keeps its original geometry path. */
export interface CoastalWaterRegion {
  x: number;
  y: number;
  height: number;
  key: string;
  field: (wind: readonly [number, number]) => WaterSample[];
  sampleAt: (x: number, y: number) => WaterSample;
  deferRender?: boolean;
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const offset = (r: Raster, x: number, y: number) => {
  const wrap = (v: number, n: number) => ((Math.floor(v) % n) + n) % n;
  return (wrap(y, r.height) * r.width + wrap(x, r.width)) * 4;
};

/** CPU study compositor, sampling generated raster art with independent material layers.
 * Pixels are snapped at 2 world pixels. Only masks, lighting and UVs are animated.
 */
export class CoastalWaterStudy {
  weather: WaterWeather = 'windy';
  slope = .4;
  wind: [number, number] = [-1, .25];
  time = 0;
  renders = 0;
  field: WaterSample[] = [];
  layers: Record<WaterLayer, boolean> = { bed: true, reflection: true, surface: true, breakers: true };
  private readonly resolution: number;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly pixels: ImageData;
  private readonly rasters: WaterRasters;
  private readonly image: Phaser.GameObjects.Image;
  private readonly land: Uint8Array;
  private readonly reflected: Uint8ClampedArray;
  private readonly reflectionWidth: number;
  private readonly reflectionPadding: number;
  private readonly height: number;
  private destroyed = false;
  private budget = 0;
  private readonly dispose = () => this.destroy();

  constructor(private readonly scene: Phaser.Scene, private readonly size: number, landAt: (x: number, y: number) => boolean,
    private readonly landColor: (x: number, y: number) => readonly number[] | undefined, private readonly region?: CoastalWaterRegion) {
    this.resolution = size / 2;
    this.height = region?.height ?? size;
    this.land = new Uint8Array(region ? 0 : size * size);
    if (!region) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) this.land[y * size + x] = Number(landAt(x, y));
    const read = (key: string): Raster => {
      const source = scene.textures.get(`layered-${key}`).getSourceImage() as HTMLImageElement;
      const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(source, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    let rasters = rasterCache.get(scene.textures);
    if (!rasters) { rasters = { bed: read('bed'), body: read('body'), light: read('light'), foam: read('foam') }; rasterCache.set(scene.textures, rasters); }
    this.rasters = rasters;
    this.texture = scene.textures.createCanvas(region?.key ?? 'coastal-study-surface', this.resolution, this.height / 2)!;
    this.pixels = this.texture.getContext().createImageData(this.resolution, this.height / 2);
    this.reflectionPadding = region ? 4 : 0;
    this.reflectionWidth = this.resolution + this.reflectionPadding * 2;
    this.reflected = new Uint8ClampedArray(this.reflectionWidth * this.height / 2 * 4);
    this.image = scene.add.image(region?.x ?? 0, region?.y ?? 0, this.texture.key).setOrigin(0).setDisplaySize(size, this.height).setDepth(0);
    this.rebuild();
    scene.events.once('shutdown', this.dispose);
  }

  rebuild(): void {
    const landAt = (x: number, y: number) => x >= 0 && y >= 0 && x < this.size && y < this.size && this.land[Math.floor(y) * this.size + Math.floor(x)] === 1;
    this.field = this.region ? this.region.field(this.wind) : buildWaterField(this.size, 2, landAt, this.wind);
    this.reflected.fill(0);
    for (let row = 0; row < this.height / 2; row++) for (let col = 0; col < this.reflectionWidth; col++) {
      const localCol = col - this.reflectionPadding;
      const s = localCol >= 0 && localCol < this.resolution ? this.field[row * this.resolution + localCol]!
        : this.region!.sampleAt(this.region!.x + localCol * 2 + 1, this.region!.y + row * 2 + 1);
      if (s.land || !Number.isFinite(s.distance) || s.distance > 70) continue;
      // Reflect actual bank art across its local shoreline, not an invented tree silhouette.
      const c = this.landColor(s.x - s.nx * (s.distance * 2 + 6), s.y - s.ny * (s.distance * 2 + 6));
      const to = (row * this.reflectionWidth + col) * 4;
      if (c) { this.reflected.set(c.slice(0, 3), to); this.reflected[to + 3] = 255; }
    }
    if (!this.region?.deferRender) this.render();
  }

  setVisible(visible: boolean): void { this.image.setVisible(visible); }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.dispose);
    this.image.destroy();
    this.scene.textures.remove(this.texture.key);
  }

  advance(dt: number): void {
    this.time += dt; this.budget += dt;
    if (this.budget >= 1 / 20) { this.budget %= 1 / 20; this.render(); }
  }

  render(bounds?: WaterRenderBounds): void {
    const w = WATER_WEATHER[this.weather], t = this.time;
    const windLength = Math.hypot(...this.wind) || 1;
    const wx = this.wind[0] / windLength, wy = this.wind[1] / windLength;
    const { bed, body, light, foam } = this.rasters;
    const dest = this.pixels.data;
    for (let i = 0; i < this.field.length; i++) {
      const s = this.field[i]!, to = i * 4;
      if (bounds && (s.x < bounds.left || s.x >= bounds.right || s.y < bounds.top || s.y >= bounds.bottom)) continue;
      if (s.land) { dest[to + 3] = 0; continue; }
      const x = s.x, y = s.y, response = waterLayers(s, this.weather, this.slope, t);
      const roll = Math.sin(x * .035 + y * .045 - t * .8) * (1 + w.amplitude * .2);
      const a = offset(body, x * .65 - wx * t * 1.5 + roll, y * .65 - wy * t * 1.5);
      const b = offset(body, x * .39 + wy * t + 41, y * .39 - wx * t + 73);
      const bedIndex = offset(bed, x * .85 + roll * .4, y * .85 + Math.sin(t + x * .06));
      const l = offset(light, x + roll * 2 - wx * t * 2.5, y * 1.4 - wy * t * 2.5);
      const lightLevel = (light.data[l]! + light.data[l + 1]! + light.data[l + 2]!) / 765;
      const glint = clamp((lightLevel - .42) * 2.5) * (.12 + .65 * Math.max(0, Math.sin(t * 1.7 + x * .045 + y * .018)) ** 6);
      const f = offset(foam, x * 1.2 + roll - wx * t * 2, y * 1.2 - wy * t * 2);
      const f2 = offset(foam, x * .73 + wy * t * 1.2 + 32, y * .73 - wx * t * 1.2);
      const foamLevel = (foam.data[f]! + foam.data[f + 1]! + foam.data[f + 2]!) / 765;
      const holes = clamp((foamLevel - .28) * 1.9);
      const foamAlpha = this.layers.breakers ? clamp((response.foam + response.retreat) * holes) : 0;
      const refractX = Math.max(0, Math.min(this.reflectionWidth - 1, Math.floor((x - (this.region?.x ?? 0) + roll * 2) / 2) + this.reflectionPadding));
      const reflectedIndex = (Math.floor((y - (this.region?.y ?? 0)) / 2) * this.reflectionWidth + refractX) * 4;
      const reflectionAlpha = this.layers.reflection && this.reflected[reflectedIndex + 3] ? response.reflection : 0;
      for (let c = 0; c < 3; c++) {
        // Deep body stays quiet. Two low-contrast scales prevent one tiled net dominating.
        const base = [28, 74, 73][c]!;
        let color = base * .65 + body.data[a + c]! * .2 + body.data[b + c]! * .15;
        if (this.layers.bed) color = color * (1 - response.shallow * .65) + bed.data[bedIndex + c]! * response.shallow * .65;
        color = color * (1 - reflectionAlpha) + this.reflected[reflectedIndex + c]! * reflectionAlpha;
        if (this.layers.surface) color = color * (1 - glint) + light.data[l + c]! * glint;
        if (this.layers.breakers) color = color * (1 - response.body) + [98, 179, 162][c]! * response.body;
        const foamColor = foam.data[f + c]! * .8 + foam.data[f2 + c]! * .2;
        dest[to + c] = Math.round(color * (1 - foamAlpha) + foamColor * foamAlpha);
      }
      dest[to + 3] = 255;
    }
    this.texture.getContext().putImageData(this.pixels, 0, 0);
    this.texture.refresh(); this.renders++;
  }
}
