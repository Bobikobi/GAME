/// <reference types="vite/client" />
/** Dev-only Phaser study: the normal Vite build still enters index.html/main.ts. */
import * as Phaser from 'phaser';
import { chooseShoreVariant, type ShoreMaterial } from './shore-material';
import materialJson from '../../docs/design/frames/rich-river-kit-2026-10-25/material.json';
import importReport from '../../docs/design/frames/rich-river-kit-2026-10-25/imports.json';
import waterUrl from '../../docs/design/frames/rich-world-2026-10-25/water.png?url';
import depthUrl from '../../docs/design/frames/rich-river-kit-2026-10-25/depth-transition.png?url';
import foamUrl from '../../docs/design/frames/rich-world-2026-10-25/foam.png?url';
import playerUrl from '../../content/kit/core/chars/player_down.png?url';

const bankUrls = import.meta.glob('../../docs/design/frames/rich-river-kit-2026-10-25/bank-*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const material: ShoreMaterial = materialJson;
const grid = importReport.seams.find(s => s.name === 'inlet')!.grid;
const tileSize = 64;
const extent = grid.length * tileSize;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

class RiverStudy extends Phaser.Scene {
  private actor!: Phaser.GameObjects.Sprite;
  private water!: Phaser.GameObjects.TileSprite;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private selected: string[][] = [];
  private flowing = !reduced.matches;
  private clock = 0;
  private repeats = 0;
  private foam: Phaser.GameObjects.Image[] = [];
  private waterClock = 0;

  constructor() { super('river-study'); }

  preload(): void {
    this.load.image('water', waterUrl);
    this.load.image('depth', depthUrl);
    this.load.image('foam', foamUrl);
    this.load.spritesheet('player', playerUrl, { frameWidth: 16, frameHeight: 24 });
    for (const v of material.variants) {
      const entry = Object.entries(bankUrls).find(([path]) => path.endsWith(`/${v.texture}.png`));
      if (!entry) throw new Error(`Missing shore asset ${v.texture}`);
      this.load.image(v.texture, entry[1]);
    }
  }

  create(): void {
    this.add.image(0, 0, material.water.bed).setOrigin(0).setDisplaySize(extent, extent);
    this.water = this.add.tileSprite(0, 0, extent, extent, material.water.surface).setOrigin(0).setAlpha(material.water.opacity);
    const motifs: string[][] = [];
    for (let y = 0; y < grid.length; y++) {
      this.selected[y] = [];
      motifs[y] = [];
      for (let x = 0; x < grid[y]!.length; x++) {
        const mask = grid[y]![x]!;
        if (!mask) continue;
        const nearby = [motifs[y]?.[x - 1], motifs[y - 1]?.[x]].filter((v): v is string => !!v);
        const choice = chooseShoreVariant(material, mask, x, y, nearby);
        if (!choice) throw new Error(`Missing compatible shore: ${material.id}/${mask}`);
        this.selected[y]![x] = choice.variant.texture;
        motifs[y]![x] = choice.variant.motif;
        if (choice.repeatedMotif) this.repeats++;
        this.add.image(x * tileSize, y * tileSize, choice.variant.texture).setOrigin(0).setDepth(2);
      }
    }
    for (const [x, y] of [[330, 180], [280, 220], [330, 270]]) {
      if (!this.landAt(x!, y!)) this.foam.push(this.add.image(x!, y!, material.water.foam).setScale(.5).setDepth(1).setAlpha(.35));
    }
    this.actor = this.add.sprite(125, 140, 'player', 1).setOrigin(.5, 1).setScale(4).setDepth(10);
    this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    const camera = this.cameras.main;
    camera.setBounds(-48, -48, extent + 96, extent + 96);
    camera.startFollow(this.actor, true, .15, .15);
    camera.setFollowOffset(0, 32);
    const waterButton = document.getElementById('water')!;
    const updateLabel = () => { waterButton.textContent = this.flowing ? 'עצירת מים' : 'הפעלת מים'; waterButton.setAttribute('aria-pressed', String(this.flowing)); };
    waterButton.onclick = () => { this.flowing = !this.flowing; updateLabel(); };
    document.getElementById('zoom')!.onclick = () => {
      const zoom = camera.zoom === 1 ? 2 : 1;
      camera.setZoom(zoom);
      document.getElementById('zoom')!.textContent = zoom === 1 ? 'קירוב ×2' : 'מבט רחב';
    };
    const onReduced = () => { this.flowing = !reduced.matches; updateLabel(); };
    reduced.addEventListener('change', onReduced);
    this.events.once('shutdown', () => reduced.removeEventListener('change', onReduced));
    updateLabel();
    document.getElementById('status')!.textContent = `דשא וחצץ · ${this.repeats} חזרות שעדיין חסרה להן חלופה`;
    (window as unknown as { __riverStudy: RiverStudy }).__riverStudy = this;
  }

  private landAt(x: number, y: number): boolean {
    const tx = Math.floor(x / tileSize), ty = Math.floor(y / tileSize);
    const texture = this.selected[ty]?.[tx];
    return !!texture && (this.textures.getPixel(Math.floor(x) - tx * tileSize, Math.floor(y) - ty * tileSize, texture)?.alpha ?? 0) >= 128;
  }

  override update(_time: number, delta: number): void {
    if (!this.actor || document.hidden) return;
    const dt = Math.min(delta, 50) / 1000;
    if (this.flowing) {
      this.water.tilePositionY -= material.water.speed * dt;
      this.waterClock += dt;
      this.foam.forEach((image, index) => image.setAlpha(.15 + .2 * (Math.sin(this.waterClock * 1.2 + index * 2) + 1) / 2));
    }
    let dx = Number(this.keys.RIGHT!.isDown || this.keys.D!.isDown) - Number(this.keys.LEFT!.isDown || this.keys.A!.isDown);
    let dy = Number(this.keys.DOWN!.isDown || this.keys.S!.isDown) - Number(this.keys.UP!.isDown || this.keys.W!.isDown);
    const pointer = this.input.activePointer;
    if (!dx && !dy && pointer.isDown) {
      const target = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      dx = target.x - this.actor.x; dy = target.y - this.actor.y;
      if (Math.hypot(dx, dy) < 8) dx = dy = 0;
    }
    const length = Math.hypot(dx, dy);
    if (length) {
      dx = dx / length * 125 * dt; dy = dy / length * 125 * dt;
      // Study-only alpha collision; shipped gameplay continues to use the kernel map.
      if (this.landAt(this.actor.x + dx - 5, this.actor.y) && this.landAt(this.actor.x + dx + 5, this.actor.y)) this.actor.x += dx;
      if (this.landAt(this.actor.x, this.actor.y + dy - 3) && this.landAt(this.actor.x, this.actor.y + dy + 3)) this.actor.y += dy;
      this.clock += dt;
      this.actor.setFrame(Math.floor(this.clock * 8) % 3);
    } else this.actor.setFrame(1);
  }
}

const host = document.getElementById('game')!;
const game = new Phaser.Game({ type: Phaser.AUTO, parent: host, pixelArt: true, roundPixels: true, banner: false, backgroundColor: '#172a52', scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth, height: host.clientHeight }, scene: [RiverStudy] });
window.addEventListener('pagehide', () => game.destroy(true), { once: true });
