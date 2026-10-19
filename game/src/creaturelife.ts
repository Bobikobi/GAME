/**
 * The ambient creatures on screen (creatures.ts holds the rules, creatureart.ts the
 * pixels): one sprite each, moved in whole world pixels, drawn under the mist so an
 * unexplored place keeps its secrets. The scene builds it only under `RICH.motion`.
 */
import Phaser from 'phaser';
import type { MapDef } from '@game/kernel';
import { T } from './config';
import { type Creature, type Watch, isOut, makeCreatures, poseOf, stepCreature } from './creatures';
import { CREATURE_SCALE, creatureKey } from './creatureart';

/** Under the mist (8000) and over every canopy and prop, which sort by their feet. */
const DEPTH_SKY = 7000;
/** Fish swim over the water, under the props. */
const DEPTH_WATER = 2.1;
/** Margin around the view inside which a creature is drawn, world px. */
const MARGIN = 24;

/** Positions are whole art pixels: a quarter of a world unit at 64 px per tile. */
const snap = (v: number) => Math.round(v * 4) / 4;

/** Milliseconds a frame lasts while a creature moves, by look. */
const STRIDE_MS = { bird: 110, fish: 80, rabbit: 120, deer: 240 } as const;

interface Shown {
  c: Creature;
  spr: Phaser.GameObjects.Image;
  variant: string;
}

export class CreatureLife {
  private readonly shown: Shown[];

  constructor(
    private readonly scene: Phaser.Scene,
    map: MapDef,
    /** whether a tile stops a runner on foot: forest, water, walls */
    private readonly blocked: (x: number, y: number) => boolean,
  ) {
    this.shown = makeCreatures(map).map((c) => {
      const variant = c.look === 'bird' && c.kind.perch === 'tree' ? 'dark' : 'plain';
      const spr = scene.add.image(0, 0, creatureKey(c.look, variant, 'sit', 0)).setOrigin(0.5, 1).setScale(CREATURE_SCALE).setVisible(false);
      return { c, spr, variant };
    });
  }

  get count(): number {
    return this.shown.length;
  }

  /** How many are drawn right now (in view and not away). For the richness check. */
  visibleCount(): number {
    return this.shown.filter((s) => s.spr.visible).length;
  }

  update(time: number, dt: number, watch: Watch, hour: number, night: number, view: Phaser.Geom.Rectangle): void {
    for (const s of this.shown) {
      const { c, spr } = s;
      stepCreature(c, dt, watch, isOut(c.kind, hour, night), this.blocked);
      const pose = poseOf(c);
      const px = (c.sx + 0.5 + pose.ox) * T;
      // the foot line: a fish swims mid-tile, the rest stand a little above the tile's lower edge
      const py = (c.sy + (c.look === 'fish' ? 0.65 : 0.85) + pose.oy) * T;
      if (pose.alpha <= 0 || px < view.x - MARGIN || px > view.right + MARGIN || py < view.y - MARGIN || py > view.bottom + MARGIN) {
        spr.setVisible(false);
        continue;
      }
      const moving = pose.pose === 'move';
      const key = this.frame(s, moving, time);
      if (spr.texture.key !== key) spr.setTexture(key);
      let hop = 0;
      if (moving && c.look === 'rabbit') hop = Math.round(Math.abs(Math.sin(time / 90)) * 3);
      spr
        .setPosition(snap(px), snap(py) - hop)
        .setFlipX(pose.flip)
        .setAlpha(pose.alpha)
        .setDepth(c.look === 'fish' ? DEPTH_WATER : c.kind.perch === 'tree' || (moving && c.look === 'bird') ? DEPTH_SKY : Math.round(py))
        .setVisible(true);
    }
  }

  private frame(s: Shown, moving: boolean, time: number): string {
    const { c, variant } = s;
    const exists = (pose: string, n: number) => this.scene.textures.exists(creatureKey(c.look, variant, pose, n));
    const pose = moving && exists('move', 0) ? 'move' : 'sit';
    let n: number;
    if (moving) n = Math.floor(time / STRIDE_MS[c.look]) % 2;
    else if (c.look === 'fish') n = Math.floor(time / 450 + c.id) % 2;
    else if (c.look === 'deer') n = (time + c.id * 523) % 3200 < 900 ? 1 : 0;
    else if (c.look === 'rabbit') n = Math.floor(time / 700 + c.id) % 2;
    else n = (time + c.id * 413) % 1800 < 160 ? 1 : 0;
    return exists(pose, n) ? creatureKey(c.look, variant, pose, n) : creatureKey(c.look, variant, pose, 0);
  }

  destroy(): void {
    for (const s of this.shown) s.spr.destroy();
    this.shown.length = 0;
  }
}
