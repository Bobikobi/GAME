import { EventEmitter } from 'node:events';
import type * as Phaser from 'phaser';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoastalWaterStudy } from '../src/coastal-water-study';
import { WorldStudyWater, WorldWaterField } from '../src/world-study-water';
import { buildWaterField } from '../src/water-response';

type Pixels = { width: number; height: number; data: Uint8ClampedArray };
type DrawnImage = { x: number; y: number; key: string; visible: boolean; destroyed: boolean };
const pixels = (width: number, height: number): Pixels => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });

function fakeScene() {
  const events = new EventEmitter().setMaxListeners(0), canvases = new Map<string, Pixels>(), images: DrawnImage[] = [];
  const art: Pixels = { width: 2, height: 2, data: new Uint8ClampedArray([31, 82, 63, 255, 150, 195, 170, 255, 70, 95, 82, 255, 240, 231, 212, 255]) };
  const scene = {
    events,
    textures: {
      get: () => ({ getSourceImage: () => art }),
      createCanvas: (key: string, _width: number, _height: number) => ({
        key, getContext: () => ({ createImageData: pixels, putImageData: (data: Pixels) => canvases.set(key, { ...data, data: data.data.slice() }) }), refresh: () => undefined,
      }),
      remove: (key: string) => canvases.delete(key),
    },
    add: {
      image: (x: number, y: number, key: string) => {
        const image = { x, y, key, visible: true, destroyed: false,
          setOrigin: () => image, setDisplaySize: () => image, setDepth: () => image,
          setVisible: (visible: boolean) => { image.visible = visible; return image; }, destroy: () => { image.destroyed = true; },
        };
        images.push(image); return image;
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, events, canvases, images };
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => {
    let source: Pixels;
    return { width: 0, height: 0, getContext: () => ({ drawImage: (image: Pixels) => { source = image; }, getImageData: () => source }) };
  } });
});
afterEach(() => vi.unstubAllGlobals());

test('indexed global geometry retains the original nearest shore, tie order and wind exposure', () => {
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < 64 && y < 64 && (x < 18 || (x >= 34 && x < 46 && y >= 14 && y < 50));
  const geometry = new WorldWaterField(64, 64, land);
  for (const wind of [[-1, .25], [1, -.25], [0, 0]] as const) {
    const whole = buildWaterField(64, 2, land, wind);
    const chunk = geometry.region(16, 8, 32, 40);
    geometry.expose(chunk, wind);
    for (const sample of chunk) expect(sample).toEqual(whole.find(s => s.x === sample.x && s.y === sample.y));
  }
});

test('offshore and rectangular regions have finite normals with no invented coast cutoff', () => {
  const sea = new WorldWaterField(96, 32, () => false);
  const field = sea.region(32, 0, 64, 32);
  sea.expose(field, [-1, .25]);
  expect(field).toHaveLength(32 * 16);
  expect(field.every(s => s.distance === Infinity && s.nx === 0 && s.ny === 0 && s.exposure === .2)).toBe(true);
  const distant = new WorldWaterField(256, 32, x => x < 16).sampleAt(201, 15);
  expect(distant.distance).toBe(185);
  expect(distant.nx).toBe(1);
});

test('chunk boundaries preserve approved compositor pixels including refracted shore reflection', () => {
  const full = fakeScene(), tiled = fakeScene();
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < 64 && y < 64 && (x < 18 || (x >= 34 && x < 46 && y >= 14 && y < 50));
  const color = (x: number, y: number) => land(x, y) ? [80 + Math.floor(x) * 2, 100 + Math.floor(y), 50] : undefined;
  const baseline = new CoastalWaterStudy(full.scene, 64, land, color);
  const world = new WorldStudyWater(tiled.scene, 64, 64, land, color, { chunkSize: 16 });
  const camera = { width: 64, height: 64, scrollX: 0, scrollY: 0, zoom: 1 } as Phaser.Cameras.Scene2D.Camera;
  world.setView(camera);
  for (const time of [0, 1.7, 2.8, 5.3]) {
    baseline.time = time; baseline.weather = 'storm'; baseline.slope = 0; baseline.wind = [1, -.25]; baseline.rebuild();
    world.time = time; world.weather = 'storm'; world.slope = 0; world.wind = [1, -.25]; world.rebuild();
    const expected = full.canvases.get('coastal-study-surface')!;
    const actual = pixels(32, 32);
    for (const image of tiled.images.filter(image => image.visible && !image.destroyed)) {
      const data = tiled.canvases.get(image.key)!;
      for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
        const from = (y * data.width + x) * 4, to = ((image.y / 2 + y) * 32 + image.x / 2 + x) * 4;
        actual.data.set(data.data.subarray(from, from + 4), to);
      }
    }
    expect(actual.data).toEqual(expected.data);
  }
  world.destroy(); baseline.destroy();
});

test('viewport culling, shared time, bounded retained cache and shutdown release chunk resources', () => {
  const fixture = fakeScene();
  const world = new WorldStudyWater(fixture.scene, 128, 32, () => false, () => undefined, { chunkSize: 32, maxCachedChunks: 2 });
  const camera = { width: 32, height: 32, scrollX: 0, scrollY: 0, zoom: 1 } as Phaser.Cameras.Scene2D.Camera;
  world.setView(camera);
  world.advance(.1);
  const initial = fixture.images[0]!;
  const snapshot = fixture.canvases.get(initial.key)!.data.slice();
  for (const x of [32, 64, 96]) { camera.scrollX = x; world.setView(camera); world.advance(.1); }
  expect(world.stats).toMatchObject({ visibleChunks: 1, cachedChunks: 2 });
  expect(initial.destroyed).toBe(true);
  expect(fixture.images.filter(image => image.visible && !image.destroyed)).toHaveLength(1);
  expect(world.time).toBeCloseTo(.4);
  expect(snapshot.length).toBe(16 * 16 * 4);
  fixture.events.emit('shutdown');
  expect(fixture.canvases.size).toBe(0);
  expect(fixture.images.every(image => image.destroyed)).toBe(true);
});

test('all-land chunks allocate no animated surface', () => {
  const fixture = fakeScene();
  const world = new WorldStudyWater(fixture.scene, 32, 32, () => true, () => [50, 80, 40], { chunkSize: 32 });
  world.setView({ width: 32, height: 32, scrollX: 0, scrollY: 0, zoom: 1 } as Phaser.Cameras.Scene2D.Camera);
  expect(world.stats.visibleChunks).toBe(0);
  expect(fixture.images).toHaveLength(0);
  world.destroy();
});

test('paused water paints newly exposed pixels during gradual camera travel without advancing time', () => {
  const fixture = fakeScene();
  const world = new WorldStudyWater(fixture.scene, 64, 64, () => false, () => undefined, { chunkSize: 64 });
  const camera = { width: 16, height: 16, scrollX: 0, scrollY: 0, zoom: 1 } as Phaser.Cameras.Scene2D.Camera;
  world.setView(camera);
  const key = fixture.images[0]!.key;
  const alphaAt = (x: number, y: number) => fixture.canvases.get(key)!.data[(Math.floor(y / 2) * 32 + Math.floor(x / 2)) * 4 + 3];
  expect(alphaAt(35, 5)).toBe(0);
  for (let x = 1; x <= 20; x++) { camera.scrollX = x; world.setView(camera); }
  expect(alphaAt(35, 5)).toBe(255);
  expect(world.time).toBe(0);
  world.destroy();
});
