/**
 * The two passes of the still water on the Phaser scene (waterstill.ts has the shader and its numbers): the darks drawn by MULTIPLY, the lights by ADD,
 * both over the ground plate that carries the picture's own water. Built by the mount for a land whose scene has water and no river course.
 */
import * as Phaser from 'phaser';
import { type WaterField } from './waterfield';
import { DEFAULT_WIND } from './wind';
import { STILL_FS, sheetAlphaOf, stillBake, stillLightOf, type StillScene } from './waterstill';

export const FIELD_KEY = 'painted:water-field';
export const BASE_KEY = 'painted:water-base';
export const RAMP_KEY = 'painted:water-ramp';
export const TONE_KEY = 'painted:water-tone';

type Hour = Parameters<typeof stillLightOf>[0];

/** A streamed land's still water baked by the exporter (tools/src/art/scene-bake.ts): its field, base and ramp as textures already made, and the field's grid. */
export interface StillBaked {
  grid: { w: number; h: number };
  seam: number;
  fieldKey: string;
  baseKey: string;
  rampKey: string;
}

/** One unit's quad of a streamed land: its rectangle in scene px, its own ground, tone and shadow copy. */
export interface StillUnit {
  x: number;
  y: number;
  w: number;
  h: number;
  plateKey: string;
  toneKey: string;
  shadeKey: string;
}

export class StillWater {
  /** the field, when the mount baked it (a land laid whole); a streamed land's exporter baked it into textures */
  readonly field?: WaterField;
  /** whether the scene has any water at all: a land with none builds no layer */
  readonly any: boolean;
  /** how many art pixels lie on a hard cut between two painted tones of the one body (waterseam.ts): 0 for a land without one */
  seam = 0;
  private readonly layers: Phaser.GameObjects.Shader[];
  private readonly units = new Map<string, Phaser.GameObjects.Shader[]>();
  private readonly world: Phaser.Scene;
  private readonly at: [number, number];
  private readonly scene: StillScene;
  private readonly art: number;
  private readonly depth: number;
  private readonly keys: { field: string; base: string; ramp: string };
  private readonly grid: { w: number; h: number };
  private readonly clock: () => number;
  private readonly ramp: () => boolean;
  private readonly lane: () => boolean;
  private readonly dark: () => boolean;
  private readonly speck: () => boolean;
  private visible = true;
  private light: ReturnType<typeof stillLightOf> = { light: [1, 1, 1], hold: [1, 1, 1], sun: [1, 1, 1], dir: [-0.25, 0.3], wind: [DEFAULT_WIND.x, DEFAULT_WIND.y], sparkle: 0, warm: 0, noon: 0, lane: 0 };
  private fade = 0;

  /**
   * @param world the scene the mount lives in
   * @param x where the picture's corner lies in the world, `y` likewise (the quad is the picture's size over `art`)
   * @param scene the mount's scene data
   * @param art scene pixels to the side of one art pixel
   * @param clock the water's own clock in seconds (the mount's, which a measure can hold and seek)
   * @param shadeKey the texture holding the shadows on the water (scene pixels, the shadow in alpha)
   * @param lane whether the dashes crowd into the sun's lane at a low sun (round 12 proof, `sunlane`); read every frame, off by default
   * @param dark whether bright marks keep to the sun's lane and the shore and the sun's road is the right way up (round 13 proof, `darkmarks`); read every frame; on by default in the mount since the owner's yes (16.11)
   * @param speck whether the old water specks come back (hold `snow`: bright marks everywhere, glints one px, the road as shipped); read every frame
   * @param ramp whether the depth ramp (round 11 proof, waterfield.ts rampPixels) draws the depth; read every frame, off by default
   */
  constructor(world: Phaser.Scene, x: number, y: number, scene: StillScene, art: number, clock: () => number, shadeKey: string, depth: number, ramp: () => boolean = () => false, lane: () => boolean = () => false, dark: () => boolean = () => false, speck: () => boolean = () => false, baked?: StillBaked) {
    this.world = world;
    this.at = [x, y];
    this.scene = scene;
    this.art = art;
    this.depth = depth;
    this.clock = clock;
    this.ramp = ramp;
    this.lane = lane;
    this.dark = dark;
    this.speck = speck;
    this.keys = { field: baked?.fieldKey ?? FIELD_KEY, base: baked?.baseKey ?? BASE_KEY, ramp: baked?.rampKey ?? RAMP_KEY };
    this.layers = [];
    if (baked) {
      // a streamed land: the exporter baked the field, and each unit gets its own quads as it lands (addUnit)
      this.any = true;
      this.seam = baked.seam;
      this.grid = baked.grid;
      return;
    }
    const tex = world.textures;
    const read = (key: string, w: number, h: number): Uint8ClampedArray => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(tex.get(key).getSourceImage() as CanvasImageSource, 0, 0);
      return ctx.getImageData(0, 0, w, h).data;
    };
    const plate = read('painted:ground', scene.width, scene.height);
    const bake = stillBake(scene, read('painted:water-bed', scene.width, scene.height), sheetAlphaOf(scene, read('painted:objects', scene.sheet.w, scene.sheet.h)), plate, art);
    this.field = bake.field;
    const f = bake.field;
    this.grid = { w: f.w, h: f.h };
    this.any = bake.any;
    if (!this.any) return;
    this.seam = bake.seam;
    const put = (key: string, rgba: Uint8ClampedArray, w: number, h: number): void => {
      const c = tex.createCanvas(key, w, h);
      if (!c) throw new Error(`painted: ${key} was refused`);
      c.getContext().putImageData(new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
      c.refresh();
      c.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    put(FIELD_KEY, bake.fieldRgba, f.w, f.h);
    put(BASE_KEY, bake.baseRgba, f.w, f.h);
    put(RAMP_KEY, bake.rampRgba, f.w, f.h);
    // at scene resolution, a cell on the cut holds light and dark pixels; a land with no cut gets one white pixel (the shader reads it by the scene's uv, so any size serves)
    if (bake.tone) put(TONE_KEY, bake.tone, scene.width, scene.height);
    else put(TONE_KEY, new Uint8ClampedArray([255, 255, 255, 255]), 1, 1);
    this.layers.push(...this.quads({ x: 0, y: 0, w: scene.width, h: scene.height, plateKey: 'painted:ground', toneKey: TONE_KEY, shadeKey }));
  }

  /** The two passes over one rectangle of the scene: the darks by MULTIPLY, the lights by ADD. */
  private quads(u: StillUnit): Phaser.GameObjects.Shader[] {
    const { scene, art, grid: f } = this;
    const [x, y] = this.at;
    // the quad's texture coordinate runs up from its bottom edge (as the textures, uploaded flipped), so a unit's share is counted from the scene's bottom: (0, 0, 1, 1) for the whole land
    const unit = [u.x / scene.width, (scene.height - u.y - u.h) / scene.height, u.w / scene.width, u.h / scene.height];
    const make = (pass: number, blend: number, z: number): Phaser.GameObjects.Shader =>
      this.world.add
        .shader(
          {
            name: pass === 0 ? 'painted-water-darks' : 'painted-water-lights',
            fragmentSource: STILL_FS,
            setupUniforms: (set: (name: string, value: unknown) => void) => {
              set('uField', 0);
              set('uShade', 1);
              set('uBase', 2);
              set('uBody', 3);
              set('uPlate', 4);
              set('uTone', 5);
              set('uRamp', this.ramp() ? 1 : 0);
              set('uSize', [scene.width, scene.height]);
              set('uGrid', [f.w, f.h]);
              set('uArt', art);
              set('uTime', this.clock());
              set('uPass', pass);
              set('uWind', this.light.wind);
              set('uLight', this.light.light);
              set('uHold', this.light.hold);
              set('uSun', this.light.sun);
              set('uL', this.light.dir);
              set('uSparkle', this.light.sparkle);
              set('uWarm', this.light.warm);
              set('uNoon', this.light.noon);
              set('uLane', this.lane() ? this.light.lane : 0);
              set('uDark', this.dark() ? 1 : 0);
              set('uMarks', this.dark() && !this.speck() ? 1 : 0);
              set('uFade', this.fade);
              set('uUnit', unit);
            },
          } as unknown as Phaser.Types.GameObjects.Shader.ShaderQuadConfig,
          x + u.x / art,
          y + u.y / art,
          u.w / art,
          u.h / art,
          [this.keys.field, u.shadeKey, this.keys.base, this.keys.ramp, u.plateKey, u.toneKey],
        )
        .setOrigin(0)
        .setDepth(z)
        .setBlendMode(blend)
        .setVisible(this.visible);
    return [make(0, Phaser.BlendModes.MULTIPLY, this.depth), make(1, Phaser.BlendModes.ADD, this.depth + 0.01)];
  }

  /** A streamed land's unit: its quads over its rectangle (`key` names it for removeUnit). */
  addUnit(key: string, u: StillUnit): void {
    this.removeUnit(key);
    this.units.set(key, this.quads(u));
  }

  removeUnit(key: string): void {
    for (const s of this.units.get(key) ?? []) s.destroy();
    this.units.delete(key);
  }

  /** The hour: the flat ground light, the sun, the sun's road, and how much a shadow takes off the lights (`fade`, the mount's). */
  setHour(l: Hour, fade: number): void {
    this.light = stillLightOf(l);
    this.fade = fade;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    for (const s of this.layers) s.setVisible(on);
    for (const q of this.units.values()) for (const s of q) s.setVisible(on);
  }
}
