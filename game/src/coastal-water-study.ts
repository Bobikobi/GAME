import * as Phaser from 'phaser';
import { buildWaterField, waterResponse, WATER_WEATHER, type WaterSample, type WaterWeather } from './water-response';

/** Study renderer: resamples generated water art; foam uses the generated sprite, no new art drawn. */
export class CoastalWaterStudy {
  weather: WaterWeather = 'windy';
  slope = .4;
  wind: [number, number] = [-1, .25];
  time = 0;
  renders = 0;
  field: WaterSample[] = [];
  private readonly resolution: number;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly pixels: ImageData;
  private readonly source: ImageData;
  private readonly image: Phaser.GameObjects.Image;
  private foam: { image: Phaser.GameObjects.Image; sample: WaterSample }[] = [];
  private budget = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly size: number, private readonly landAt: (x: number, y: number) => boolean, surface: string, private readonly foamKey: string) {
    this.resolution = size / 2;
    const source = scene.textures.get(surface).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    this.source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.texture = scene.textures.createCanvas('coastal-study-surface', this.resolution, this.resolution)!;
    this.pixels = this.texture.getContext().createImageData(this.resolution, this.resolution);
    this.image = scene.add.image(0, 0, this.texture.key).setOrigin(0).setDisplaySize(size, size).setDepth(0);
    this.rebuild();
    scene.events.once('shutdown', () => { this.foam.forEach(f => f.image.destroy()); this.image.destroy(); scene.textures.remove(this.texture.key); });
  }

  rebuild(): void {
    this.foam.forEach(f => f.image.destroy());
    this.field = buildWaterField(this.size, 8, this.landAt, this.wind);
    this.foam = this.field.flatMap((sample, i) => !sample.land && sample.distance >= 2 && sample.distance <= 14 && i % 3 === 0
      ? [{ sample, image: this.scene.add.image(sample.x, sample.y, this.foamKey).setDepth(1).setScale(.42).setRotation(Math.atan2(sample.ny, sample.nx) + Math.PI / 2).setAlpha(0) }] : []);
    this.render();
  }

  advance(dt: number): void {
    this.time += dt;
    this.budget += dt;
    if (this.budget >= 1 / 15) { this.budget = 0; this.render(); }
  }

  render(): void {
    const w = WATER_WEATHER[this.weather];
    const columns = this.size / 8;
    const responses = this.field.map(s => waterResponse(s, this.weather, this.slope, this.time));
    const length = Math.hypot(...this.wind) || 1;
    const wx = this.wind[0] / length, wy = this.wind[1] / length;
    const { width: sw, height: sh, data: source } = this.source;
    const dest = this.pixels.data;
    const wrap = (v: number, n: number) => ((Math.floor(v) % n) + n) % n;
    for (let y = 0; y < this.resolution; y++) for (let x = 0; x < this.resolution; x++) {
      const worldX = x * 2, worldY = y * 2;
      const index = Math.floor(worldY / 8) * columns + Math.floor(worldX / 8);
      const sample = this.field[index]!, response = responses[index]!;
      // Waves bend along the local bank; time moves water art, never the land or riverbed.
      const cross = Math.sin((worldX + worldY) * .065 + this.time * w.frequency) * w.amplitude * .24;
      const sx = wrap(worldX - wx * this.time * w.speed + sample.nx * response.bend - wy * cross, sw);
      const sy = wrap(worldY - wy * this.time * w.speed + sample.ny * response.bend + wx * cross, sh);
      const from = (sy * sw + sx) * 4, to = (y * this.resolution + x) * 4;
      dest[to] = source[from]!; dest[to + 1] = source[from + 1]!; dest[to + 2] = source[from + 2]!; dest[to + 3] = 255;
    }
    this.texture.getContext().putImageData(this.pixels, 0, 0);
    this.texture.refresh();
    this.image.setAlpha(this.weather === 'calm' ? .18 : this.weather === 'windy' ? .4 : .58);
    for (const f of this.foam) {
      const r = waterResponse(f.sample, this.weather, this.slope, this.time);
      f.image.setAlpha(r.foam).setScale(.4 + w.amplitude * .035);
      f.image.setPosition(f.sample.x + f.sample.nx * r.bend * .35, f.sample.y + f.sample.ny * r.bend * .35);
    }
    this.renders++;
  }
}
