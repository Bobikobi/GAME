/**
 * The carcasses on the ground (public #930): each laid on its tile, drawn by `carcassLooks`. A STAND-IN, as that file says:
 * the animal's own front pose (frame 0 of its idle sheet, or its still when it has one) turned a quarter so it lies on its
 * side, shrinking with the dressing and the spoiling, until its own clips are drawn. Display only; the kernel holds the carcass
 * and the label "Dress carcass" stays the target's.
 */
import type * as Phaser from 'phaser';
import type { Bundle, PublicState } from '@game/kernel';
import { type CreatureSprites, creatureClipFor, creatureOf } from '../clips';
import { carcassLooks } from '../carcass-look';
import { T } from '../config';
import { baseOf, kitImage } from '../kitart';

/** The picture a kind lies as: a texture key and frame, and where its pixels are in that frame. */
interface Pose {
  key: string;
  frame: number;
  /** the opaque pixels' box in the frame, so the quarter turn is about the body and not the empty margin of the sheet's frame */
  box: { x: number; y: number; w: number; h: number };
}

export class CarcassLayer {
  private readonly shown = new Map<number, Phaser.GameObjects.Image>();
  private readonly poses = new Map<string, Pose | undefined>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly b: Bundle,
  ) {}

  /** The animal's own picture to lie down: its still when the kit has one, else the first frame of its idle sheet seen from the front. */
  private poseOf(kind: string): Pose | undefined {
    if (this.poses.has(kind)) return this.poses.get(kind);
    const sprites = this.b.sprites as CreatureSprites;
    const textures = this.scene.textures;
    const still = Object.keys(sprites).find((k) => creatureOf(sprites, k) === kind && textures.exists(k));
    const front = creatureClipFor(sprites, kind, 'idle', 'down');
    const key = still ?? (front && textures.exists(front.key) ? front.key : undefined);
    const pose = key ? { key, frame: 0, box: this.boxOf(key) } : undefined;
    if (pose) this.poses.set(kind, pose);
    return pose;
  }

  /** The box of the opaque pixels of frame 0; the whole frame when the pixels cannot be read. */
  private boxOf(key: string): Pose['box'] {
    const frame = this.scene.textures.getFrame(key, 0);
    const whole = { x: 0, y: 0, w: frame.width, h: frame.height };
    try {
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return whole;
      ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.width, frame.height);
      const data = ctx.getImageData(0, 0, frame.width, frame.height).data;
      let x0 = frame.width, y0 = frame.height, x1 = -1, y1 = -1;
      for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
          if (data[(y * frame.width + x) * 4 + 3]! === 0) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      return x1 < 0 ? whole : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch {
      return whole;
    }
  }

  /** Lays the carcasses of the state on their tiles; one that has been dressed or has spoiled away is taken off. */
  refresh(state: PublicState, tick: number): void {
    const looks = new Map(carcassLooks(this.b, state, tick).map((l) => [l.id, l]));
    for (const [id, img] of this.shown) {
      if (looks.has(id)) continue;
      img.destroy();
      this.shown.delete(id);
    }
    for (const look of looks.values()) {
      const pose = this.poseOf(look.kind);
      if (!pose) continue;
      let img = this.shown.get(look.id);
      if (!img) {
        img = kitImage(this.scene, 0, 0, pose.key, pose.frame);
        this.shown.set(look.id, img);
      }
      const base = baseOf(img) * look.scale;
      const { box } = pose;
      // the turn is about the middle of the body; on its side its width is its height off the ground
      img.setOrigin((box.x + box.w / 2) / img.width, (box.y + box.h / 2) / img.height).setScale(base).setAngle(look.angle);
      const foot = (look.tile[1] + 1) * T - 2;
      img.setPosition(Math.round((look.tile[0] + 0.5) * T), Math.round(foot - (box.w * base) / 2)).setDepth(Math.round(foot));
    }
  }

  destroy(): void {
    for (const img of this.shown.values()) img.destroy();
    this.shown.clear();
  }
}
