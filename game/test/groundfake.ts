/** A scene with just enough of Phaser's textures and images for GroundChunks, over plain pixel buffers. */
import type * as Phaser from 'phaser';

export interface FakeCanvas {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  refreshes: number;
  getContext(): FakeContext;
  getCanvas(): FakeCanvas;
  refresh(): void;
}

interface FakeContext {
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(src: FakeCanvas, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
}

function canvas(width: number, height: number): FakeCanvas {
  const data = new Uint8ClampedArray(width * height * 4);
  const self: FakeCanvas = {
    width,
    height,
    data,
    refreshes: 0,
    getCanvas: () => self,
    refresh: () => void self.refreshes++,
    getContext: () => ({
      clearRect(x, y, w, h) {
        for (let j = Math.max(0, y); j < Math.min(height, y + h); j++) data.fill(0, (j * width + Math.max(0, x)) * 4, (j * width + Math.min(width, x + w)) * 4);
      },
      // source over, one to one: what the page copy does of a strip (an empty destination takes the source as it is)
      drawImage(src, sx, sy, sw, sh, dx, dy) {
        for (let j = 0; j < sh; j++) {
          const y = dy + j;
          if (y < 0 || y >= height) continue;
          for (let i = 0; i < sw; i++) {
            const x = dx + i;
            if (x < 0 || x >= width) continue;
            const s = ((sy + j) * src.width + sx + i) * 4;
            const d = (y * width + x) * 4;
            const a = src.data[s + 3]!;
            if (a === 0) continue;
            if (data[d + 3] === 0 || a === 255) for (let k = 0; k < 4; k++) data[d + k] = src.data[s + k]!;
            else throw new Error('the fake blends only onto empty pixels');
          }
        }
      },
    }),
  };
  return self;
}

export function fakeScene() {
  const textures = new Map<string, FakeCanvas>();
  const images = new Set<object>();
  const shown: string[] = [];
  const scene = {
    textures: {
      createCanvas: (key: string, w: number, h: number) => {
        const tex = canvas(w, h);
        textures.set(key, tex);
        return tex;
      },
      remove: (key: string) => void textures.delete(key),
    },
    add: {
      image: (_x: number, _y: number, key: string) => {
        const img = { setOrigin: () => img, setScale: () => img, setDepth: () => img, setTexture: (key: string) => (shown.push(key), img), destroy: () => void images.delete(img) };
        shown.push(key);
        images.add(img);
        return img;
      },
    },
  };
  /** the pages' textures, the strip scratch left out */
  const live = { get size() { return [...textures.keys()].filter((k) => k !== 'ground-strip').length; }, [Symbol.iterator]: () => [...textures.keys()].filter((k) => k !== 'ground-strip')[Symbol.iterator]() };
  return { scene: scene as unknown as Phaser.Scene, textures, live, images, shown };
}
