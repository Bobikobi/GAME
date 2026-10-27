/// <reference types="vite/client" />
import * as Phaser from 'phaser';
import { WORLD_TILE_SIZE as TILE, worldStudyLayout, worldStudyMask, worldStudyPathDistance, worldStudyRegionInset } from './world-study-layout';
import { worldStudyCanStand, type WorldStudyTreeFootprint } from './world-study-collision';

const assets = import.meta.glob('../../docs/design/frames/rich-world-expansion-2026-10-26/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const banks = import.meta.glob('../../docs/design/frames/rich-river-kit-2026-10-25/bank-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const plants = import.meta.glob('../../docs/design/frames/rich-shore-2026-10-25/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
import broadOakUrl from '../../docs/design/frames/rich-world-trees-2026-10-26/oak-broad.png?url';
import pavingUrl from '../../docs/design/frames/rich-world-ground-2026-10-27/paving.png?url';
import wornUrl from '../../docs/design/frames/rich-world-ground-2026-10-27/worn.png?url';
const masks = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const hash = (x: number, y: number) => (Math.imul(x + 23, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;
const key = (name: string) => `world-ground-${name}`;

export function preloadWorldStudyGround(scene: Phaser.Scene): void {
  scene.load.image(key('oak-broad'), broadOakUrl);
  scene.load.image(key('paving'), pavingUrl);
  scene.load.image(key('worn'), wornUrl);
  for (const name of ['meadow-a', 'meadow-b', 'meadow-c', 'path', 'woodland', 'oak']) {
    const entry = Object.entries(assets).find(([path]) => path.endsWith(`/${name}.png`));
    if (!entry) throw new Error(`Missing imported world material: ${name}`);
    scene.load.image(key(name), entry[1]);
  }
  for (const mask of masks) {
    const entry = Object.entries(banks).find(([path]) => path.endsWith(`/bank-${mask}.png`))!;
    scene.load.image(key(`bank-${mask}`), entry[1]);
  }
  for (const name of ['grass', 'reeds']) {
    const entry = Object.entries(plants).find(([path]) => path.endsWith(`/${name}.png`))!;
    scene.load.image(key(name), entry[1]);
  }
}

/** Assemble generated art; geometry and blend weights never draw organic objects. */
export function createWorldStudyGround(scene: Phaser.Scene) {
  const width = worldStudyLayout.width * TILE, height = worldStudyLayout.height * TILE;
  const texture = scene.textures.createCanvas('world-study-ground', width, height)!;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  for (let ty = 0; ty < worldStudyLayout.height; ty++) for (let tx = 0; tx < worldStudyLayout.width; tx++) {
    const mask = worldStudyMask(tx, ty);
    if (!mask) continue;
    ctx.drawImage(scene.textures.get(key(`bank-${mask}`)).getSourceImage() as HTMLImageElement, tx * TILE, ty * TILE);
  }
  const pixels = ctx.getImageData(0, 0, width, height);
  const raster = (name: string): ImageData => {
    const image = scene.textures.get(key(name)).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height);
  };
  const fields = ['meadow-a', 'meadow-b', 'meadow-c', 'path', 'woodland'].map(raster);
  const sampleOffset = (field: ImageData, x: number, y: number) => (((y % field.height + field.height) % field.height) * field.width + (x % field.width + field.width) % field.width) * 4;
  const wetVertices: { x: number; y: number }[] = [];
  worldStudyLayout.corners.forEach((row, y) => [...row].forEach((land, x) => { if (land === '0') wetVertices.push({ x: x * TILE, y: y * TILE }); }));
  const distances = worldStudyLayout.corners.map((row, y) => [...row].map((_, x) => {
    let nearest = Infinity;
    for (const water of wetVertices) nearest = Math.min(nearest, Math.hypot(x * TILE - water.x, y * TILE - water.y));
    return nearest;
  }));
  const soil = fields[3]!, forest = fields[4]!;
  const paving = raster('paving'), worn = raster('worn');
  const patches = worldStudyLayout.regions.filter(region => region.material !== 'forest');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const to = (y * width + x) * 4;
    if (pixels.data[to + 3]! < 128) continue;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), fx = x % TILE / TILE, fy = y % TILE / TILE;
    const row = distances[ty]!, next = distances[ty + 1]!;
    const shoreDistance = (row[tx]! * (1 - fx) + row[tx + 1]! * fx) * (1 - fy) + (next[tx]! * (1 - fx) + next[tx + 1]! * fx) * fy;
    const cover = clamp((shoreDistance - 30) / 80);
    // Generated material luminance breaks transition edges; no procedural painted motifs.
    const forestAt = sampleOffset(forest, x, y), soilAt = sampleOffset(soil, x, y);
    const grain = (forest.data[forestAt + 1]! - 75) / 5;
    let forestWeight = 0;
    for (const region of worldStudyLayout.regions) {
      if (region.material !== 'forest') continue;
      const rx = region.x * TILE, ry = region.y * TILE, right = rx + region.width * TILE, bottom = ry + region.height * TILE;
      const inside = Math.min(x - rx, right - x, y - ry, bottom - y);
      forestWeight = Math.max(forestWeight, clamp(.5 + (inside + grain) / 110));
    }
    const pathWeight = clamp((worldStudyLayout.path.width * TILE / 2 - worldStudyPathDistance(x, y) + grain * .35) / 13);
    // Blend complete registered 128px fields at a larger scale, rather than shuffling their 64px crops.
    const mx = Math.floor(x / 256), my = Math.floor(y / 256), blendX = (x % 256) / 256, blendY = (y % 256) / 256;
    const choices = [fields[hash(mx, my) % 3]!, fields[hash(mx + 1, my) % 3]!, fields[hash(mx, my + 1) % 3]!, fields[hash(mx + 1, my + 1) % 3]!];
    const offsets = choices.map(field => sampleOffset(field, x, y));
    let patchWeight = 0, patchField = paving, patchOffset = 0;
    for (const region of patches) {
      // Reject distant pixels before consulting rounded geometry or the imported stone/soil edge detail.
      if (x < region.x * TILE - 48 || y < region.y * TILE - 48 || x > (region.x + region.width) * TILE + 48 || y > (region.y + region.height) * TILE + 48) continue;
      const field = region.material === 'paving' ? paving : worn;
      const at = sampleOffset(field, x, y);
      const detail = (field.data[at]! + field.data[at + 1]! + field.data[at + 2]!) / 3;
      const edge = worldStudyRegionInset(region, x, y) + (detail - 100) * .16 + grain * .5;
      const weight = Math.round(clamp(.5 + edge / 48) * 3) / 3;
      if (weight > patchWeight) { patchWeight = weight; patchField = field; patchOffset = at; }
    }
    for (let c = 0; c < 3; c++) {
      const upper = choices[0]!.data[offsets[0]! + c]! * (1 - blendX) + choices[1]!.data[offsets[1]! + c]! * blendX;
      const lower = choices[2]!.data[offsets[2]! + c]! * (1 - blendX) + choices[3]!.data[offsets[3]! + c]! * blendX;
      const meadow = upper * (1 - blendY) + lower * blendY;
      const ground = meadow * (1 - forestWeight) + forest.data[forestAt + c]! * forestWeight;
      const path = ground * (1 - pathWeight) + soil.data[soilAt + c]! * pathWeight;
      const material = path * (1 - patchWeight) + patchField.data[patchOffset + c]! * patchWeight;
      pixels.data[to + c] = Math.round(pixels.data[to + c]! * (1 - cover) + material * cover);
    }
  }
  ctx.putImageData(pixels, 0, 0); texture.refresh();
  const image = scene.add.image(0, 0, texture.key).setOrigin(0).setDepth(2);
  const landAt = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && pixels.data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3]! >= 128;
  const landColor = (x: number, y: number): readonly number[] | undefined => {
    if (!landAt(x, y)) return undefined;
    const at = (Math.floor(y) * width + Math.floor(x)) * 4;
    return [pixels.data[at]!, pixels.data[at + 1]!, pixels.data[at + 2]!];
  };
  type Plant = { image: Phaser.GameObjects.Image; x: number; y: number; tree: boolean; phase: number };
  const foliage: Plant[] = [];
  const treeFootprints: WorldStudyTreeFootprint[] = [];
  const place = (name: string, x: number, y: number, tree: boolean, variant: number) => {
    const plant = scene.add.image(x, y, key(name)).setOrigin(.5, 1).setDepth(y);
    if (tree) {
      // Keep the trunk upright: mirror a branching silhouette, never rotate it to fake a new camera angle.
      // Independent hash bits avoid the alternating rows of the placement lattice.
      plant.setFlipX(Boolean((variant >>> 8) & 1));
      const height = 320 + ((variant >>> 12) % 5) * 8;
      const width = name === 'oak-broad' ? height : Math.round(height * (192 / 320) * (1 + ((variant >>> 17) % 3) * .035));
      plant.setDisplaySize(width, height);
      // Roots occupy a shallow patch of ground; leaves and upright bark are an overhang.
      treeFootprints.push({ x, y: y - 14 * height / 320, radiusX: width * .17, radiusY: 18 * height / 320 });
    }
    if (!tree) plant.setDisplaySize(name === 'grass' ? 38 : 48, name === 'grass' ? 38 : 48);
    if (!tree && variant % 2) plant.setFlipX(true);
    foliage.push({ image: plant, x, y, tree, phase: variant % 37 });
  };
  for (let ty = 1; ty < worldStudyLayout.height - 1; ty++) for (let tx = 1; tx < worldStudyLayout.width - 1; tx++) {
    const seed = hash(tx, ty), x = (tx + .25 + (seed % 41) / 100) * TILE, y = (ty + .3 + (seed % 31) / 100) * TILE;
    if (!landAt(x, y) || worldStudyPathDistance(x, y) < 52) continue;
    if (patches.some(region => worldStudyRegionInset(region, x, y) > -20)) continue;
    const inForest = worldStudyLayout.regions.some(r => r.material === 'forest' && x > r.x * TILE && y > r.y * TILE && x < (r.x + r.width) * TILE && y < (r.y + r.height) * TILE);
    const nearWater = !landAt(x + 48, y) || !landAt(x - 48, y) || !landAt(x, y + 48);
    if (inForest && tx % 3 === 1 && ty % 4 === 3 && landAt(x - 36, y) && landAt(x + 36, y)) {
      const treeX = x + (((seed >>> 6) % 81) - 40);
      const treeY = y + (((seed >>> 15) % 101) - 50);
      // Stagger the roots while retaining the clear route and the existing land footprint.
      const clear = landAt(treeX - 36, treeY) && landAt(treeX + 36, treeY) && worldStudyPathDistance(treeX, treeY) >= 58;
      place((seed >>> 3) % 5 === 2 ? 'oak-broad' : 'oak', clear ? treeX : x, clear ? treeY : y, true, seed);
    }
    else if (nearWater && seed % 3 === 0) place('reeds', x, y, false, seed);
    else if (seed % (inForest ? 4 : 3) === 0) place('grass', x, y, false, seed);
  }
  let motion = true;
  const advance = (time: number, wind: readonly [number, number], actor?: { x: number; y: number }) => {
    for (const p of foliage) {
      const sway = motion ? Math.sin(time * (p.tree ? .55 : 1.5) + p.phase) + Math.sin(time * .37 + p.x * .006) * .4 : 0;
      // Rotate the generated image around its root; no terrain pixels or trunks translate.
      p.image.setRotation(sway * (p.tree ? .004 : .025) * Math.sign(wind[0] || 1));
      const behind = p.tree && actor && actor.y < p.y && actor.y > p.y - p.image.displayHeight && Math.abs(actor.x - p.x) < p.image.displayWidth / 2
        && [24, 52, 72].some(up => {
          // Fade only when actual painted leaves or bark cover the character, not an empty frame corner.
          let px = Math.floor((actor.x - p.x) / p.image.scaleX + p.image.width / 2);
          if (p.image.flipX) px = p.image.width - 1 - px;
          const py = Math.floor((actor.y - up - p.y) / p.image.scaleY + p.image.height);
          return (scene.textures.getPixelAlpha(px, py, p.image.texture.key) ?? 0) >= 128;
        });
      p.image.setAlpha(behind ? .42 : 1);
    }
  };
  scene.events.once('shutdown', () => { image.destroy(); for (const p of foliage) p.image.destroy(); scene.textures.remove(texture.key); });
  return {
    image, landAt, landColor, advance,
    treeFootprints,
    canStand: (x: number, y: number) => worldStudyCanStand(x, y, landAt, treeFootprints),
    trees: foliage.filter(p => p.tree).map(p => p.image),
    setPlantsVisible: (visible: boolean) => { for (const p of foliage) p.image.setVisible(visible); },
    setMotion: (enabled: boolean) => { motion = enabled; },
  };
}
