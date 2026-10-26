import * as Phaser from 'phaser';

import { SHADOW, SUN_TODAY, maskOfAlpha, shadowBox, shadowOf, sunAt, type Mask, type Shadow } from './cast';
import { WORLD_TILE_SIZE, worldStudyLayout } from './world-study-layout';

const INK = `#${SHADOW.ink.toString(16).padStart(6, '0')}`;
const SUN = sunAt(SUN_TODAY, 10 * 60);
const MAX_ACTOR_FRAMES = 24;
let serial = 0;

interface Shape {
  mask: Mask;
  shadow: Shadow;
  /** The displayed frame's top-left relative to its unrotated origin. */
  left: number;
  top: number;
}

/** Read the rendered scale before projecting: this study uses one world unit per art pixel. */
function shapeOf(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): Shape | undefined {
  const frame = image.frame;
  const sx = Math.abs(image.scaleX), sy = Math.abs(image.scaleY);
  if (!frame?.source.image || !sx || !sy) return undefined;
  const width = frame.realWidth, height = frame.realHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * sx));
  canvas.height = Math.max(1, Math.ceil(height * sy));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.imageSmoothingEnabled = false;
  const flipX = image.flipX !== (image.scaleX < 0);
  const flipY = image.flipY !== (image.scaleY < 0);
  ctx.translate(flipX ? width * sx : 0, flipY ? height * sy : 0);
  ctx.scale(flipX ? -sx : sx, flipY ? -sy : sy);
  ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
    frame.x, frame.y, frame.cutWidth, frame.cutHeight);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3]! >= 128 ? 1 : 0;
  const mask = maskOfAlpha(alpha, canvas.width, canvas.height);
  if (mask.feet < 0) return undefined;
  return {
    mask, shadow: shadowOf(mask, SUN),
    left: -(image.scaleX < 0 ? width - image.displayOriginX : image.displayOriginX) * sx,
    top: -(image.scaleY < 0 ? height - image.displayOriginY : image.displayOriginY) * sy,
  };
}

/**
 * Reuse the game's alpha projection at this study's displayed scale. Tree layers are
 * painted once, so sway and see-through never detach their shadows from the roots.
 */
export function createWorldStudyShadows(
  scene: Phaser.Scene,
  trees: readonly Phaser.GameObjects.Image[],
  landAt: (x: number, y: number) => boolean,
) {
  const prefix = `world-study-shadow-${++serial}`;
  const width = worldStudyLayout.width * WORLD_TILE_SIZE;
  const height = worldStudyLayout.height * WORLD_TILE_SIZE;
  const makeCanvas = (key: string, w: number, h: number) => {
    const texture = scene.textures.createCanvas(key, w, h)!;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    texture.getContext().fillStyle = INK;
    return texture;
  };
  const cast = makeCanvas(`${prefix}-cast`, width, height);
  const contact = makeCanvas(`${prefix}-contact`, width, height);
  const castContext = cast.getContext(), contactContext = contact.getContext();
  for (const tree of trees) {
    const shape = shapeOf(tree);
    if (!shape) continue;
    const x = Math.round(tree.x + shape.left);
    const feet = Math.round(tree.y + shape.top + shape.mask.feet);
    // Opaque union, with opacity applied once to the final image, including overlaps.
    for (const span of shape.shadow.spans) castContext.fillRect(x + span.x, feet + span.y, span.w, 1);
    for (const [a, b] of shape.shadow.contact) contactContext.fillRect(x + a, feet, b - a + 1, 4);
  }
  for (const texture of [cast, contact]) {
    const context = texture.getContext();
    const pixels = context.getImageData(0, 0, width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4 + 3;
      if (pixels.data[at] && !landAt(x, y)) pixels.data[at] = 0;
    }
    context.putImageData(pixels, 0, 0);
    texture.refresh();
  }
  const castImage = scene.add.image(0, 0, cast.key).setOrigin(0).setDepth(2.5).setAlpha(SUN.alpha);
  const contactImage = scene.add.image(0, 0, contact.key).setOrigin(0).setDepth(2.6).setAlpha(SHADOW.contact);
  const movingContact = scene.add.graphics().setDepth(2.6).setVisible(false);
  let movingCast: Phaser.GameObjects.Image | undefined;
  let visible = true, sunEnabled = true, destroyed = false;
  let nextFrame = 0;
  type Entry = { key: string; shape: Shape; box: ReturnType<typeof shadowBox> };
  const frames = new Map<string, Entry>();
  const hideActor = () => {
    movingCast?.setVisible(false);
    movingContact.setVisible(false);
  };
  const advance = (actor?: Phaser.GameObjects.Sprite) => {
    if (destroyed) return;
    if (!actor?.active || !actor.visible || actor.alpha <= 0 || !visible) { hideActor(); return; }
    const signature = `${actor.texture.key}#${actor.frame.name}:${actor.scaleX},${actor.scaleY}:${actor.flipX},${actor.flipY}:${actor.displayOriginX},${actor.displayOriginY}`;
    let entry = frames.get(signature);
    if (!entry) {
      const shape = shapeOf(actor);
      if (!shape) { hideActor(); return; }
      const box = shadowBox(shape.shadow);
      const texture = makeCanvas(`${prefix}-actor-${nextFrame++}`, box.w, box.h);
      const ctx = texture.getContext();
      for (const span of shape.shadow.spans) ctx.fillRect(span.x - box.x, span.y - box.y, span.w, 1);
      texture.refresh();
      entry = { key: texture.key, shape, box };
      frames.set(signature, entry);
    } else {
      // Keep the working frames when appearance changes repeatedly during a long preview.
      frames.delete(signature); frames.set(signature, entry);
    }
    const x = Math.round(actor.x + entry.shape.left);
    const feet = Math.round(actor.y + entry.shape.top + entry.shape.mask.feet);
    if (!movingCast) movingCast = scene.add.image(0, 0, entry.key).setOrigin(0).setDepth(2.5).setAlpha(SUN.alpha);
    movingCast.setTexture(entry.key).setPosition(x + entry.box.x, feet + entry.box.y).setVisible(sunEnabled);
    movingContact.clear().fillStyle(SHADOW.ink, SHADOW.contact).setPosition(x, feet).setVisible(true);
    for (const [a, b] of entry.shape.shadow.contact) movingContact.fillRect(a, 0, b - a + 1, 4);
    while (frames.size > MAX_ACTOR_FRAMES) {
      const oldest = frames.keys().next().value!;
      scene.textures.remove(frames.get(oldest)!.key);
      frames.delete(oldest);
    }
  };
  return {
    advance,
    setVisible(enabled: boolean) {
      if (destroyed) return;
      visible = enabled;
      castImage.setVisible(visible && sunEnabled);
      contactImage.setVisible(visible);
      // advance() restores a moving actor only when one is actually supplied.
      if (!visible) hideActor();
    },
    setSunEnabled(enabled: boolean) {
      if (destroyed) return;
      sunEnabled = enabled;
      castImage.setVisible(visible && sunEnabled);
      if (!sunEnabled) movingCast?.setVisible(false);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      castImage.destroy(); contactImage.destroy(); movingCast?.destroy(); movingContact.destroy();
      for (const entry of frames.values()) scene.textures.remove(entry.key);
      frames.clear(); scene.textures.remove(cast.key); scene.textures.remove(contact.key);
    },
  };
}
