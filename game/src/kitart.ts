/**
 * Kit art on two grids (NEXT 15): a sprite of density 1 has 16 art pixels per tile, one of density 4 has 64.
 * The world keeps 16 units per tile, so a density-4 image is shown at a quarter scale: its base scale is
 * 1 / density. Every kit image and sprite the scenes make goes through here, and every later scale write
 * (a sway, a squash, a fall) is relative to that base, or a density-4 sprite would grow fourfold.
 */
import type * as Phaser from 'phaser';
import { app } from './app';

type Art = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

/** Art pixels per tile side of a kit sprite (1 or 4); 1 for anything the bundle does not name, such as the fx textures. */
export function densityOf(ref: string): number {
  return app.bundle?.sprites[ref]?.density ?? 1;
}

/** A kit sprite's size in world units (a frame's w x h at its density), or undefined for one the bundle lacks. */
export function unitOf(ref: string): { w: number; h: number } | undefined {
  const info = app.bundle?.sprites[ref];
  return info && { w: info.w / info.density, h: info.h / info.density };
}

/** The scale an image of this texture shows at with no effect on it. */
export function baseScale(ref: string): number {
  return 1 / densityOf(ref);
}

/** The base scale an object was given, 1 for one that never was. */
export function baseOf(o: Phaser.GameObjects.GameObject): number {
  return (o.getData('base') as number | undefined) ?? 1;
}

/** Gives an image or sprite its base scale from its texture. */
export function adopt<T extends Art>(o: T): T {
  const b = baseScale(o.texture.key);
  o.setData('base', b);
  o.setScale(b);
  return o;
}

export function kitImage(scene: Phaser.Scene, x: number, y: number, ref: string, frame?: string | number): Phaser.GameObjects.Image {
  return adopt(scene.add.image(x, y, ref, frame));
}

export function kitSprite(scene: Phaser.Scene, x: number, y: number, ref: string, frame?: string | number): Phaser.GameObjects.Sprite {
  return adopt(scene.add.sprite(x, y, ref, frame));
}

/** Swaps the texture and keeps whatever effect the scale carries (a squash, a breath) on the new base. */
export function retex<T extends Art>(o: T, ref: string, frame?: string | number): T {
  const old = baseOf(o);
  const rx = o.scaleX / old;
  const ry = o.scaleY / old;
  o.setTexture(ref, frame);
  const b = baseScale(ref);
  o.setData('base', b);
  o.setScale(rx * b, ry * b);
  return o;
}

/** A scale relative to the base: `rel(o, 1)` is at rest, `rel(o, 0.92)` a squash. Also the value a scale tween aims at. */
export function rel(o: Phaser.GameObjects.GameObject, sx: number, sy = sx): { x: number; y: number } {
  const b = baseOf(o);
  return { x: sx * b, y: sy * b };
}

/** Writes a relative scale. */
export function setRel<T extends Art>(o: T, sx: number, sy = sx): T {
  const s = rel(o, sx, sy);
  o.setScale(s.x, s.y);
  return o;
}

/** Draws a frame onto a canvas texture at a scale, nearest-neighbour: a density-1 tile at 4x on a 4 px per unit canvas. */
export function drawScaled(tex: Phaser.Textures.CanvasTexture, ref: string, frame: string | number | undefined, x: number, y: number, scale: number): void {
  const f = tex.manager.getFrame(ref, frame);
  if (!f) return;
  const cut = f.canvasData as { x: number; y: number };
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.source.image as CanvasImageSource, cut.x, cut.y, f.cutWidth, f.cutHeight, x, y, f.cutWidth * scale, f.cutHeight * scale);
}
