import * as Phaser from 'phaser';

import { SHADE_ALPHA, SHADE_DEPTH, SHADE_KEY, shadeBox, shadePixels, shadeShare } from './crownshade';

function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHADE_KEY)) return;
  const W = 96;
  const H = 20;
  const tex = scene.textures.createCanvas(SHADE_KEY, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  const img = ctx.createImageData(W, H);
  img.data.set(shadePixels(W, H));
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

type Tree = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

/** One shade per tree the scene draws, kept under it as the tree grows, falls or hides. */
export class CrownShades {
  private readonly items: { tree: Tree; shade: Phaser.GameObjects.Image }[] = [];
  private readonly shares = new Map<string, number>();

  constructor(scene: Phaser.Scene, trees: Iterable<Tree>) {
    ensureTexture(scene);
    for (const tree of trees) {
      const shade = scene.add.image(tree.x, tree.y, SHADE_KEY).setOrigin(0.5).setDepth(SHADE_DEPTH).setVisible(false);
      this.items.push({ tree, shade });
    }
  }

  /** Places each shade under its tree for the texture the tree shows now. */
  sync(): void {
    for (const { tree, shade } of this.items) {
      const key = tree.texture.key;
      let share = this.shares.get(key);
      if (share === undefined) {
        share = shadeShare(key);
        this.shares.set(key, share);
      }
      if (share === 0 || !tree.visible || tree.alpha < 0.05) {
        shade.setVisible(false);
        continue;
      }
      const box = shadeBox(tree.displayWidth, share);
      shade
        .setPosition(tree.x, tree.y - box.lift)
        .setDisplaySize(box.w, box.h)
        .setAlpha(SHADE_ALPHA * tree.alpha)
        .setVisible(true);
    }
  }
}
