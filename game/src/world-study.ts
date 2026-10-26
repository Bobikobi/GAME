/// <reference types="vite/client" />
/** Connected visual fixture only; the normal game still enters main.ts. */
import * as Phaser from 'phaser';
import { preloadWorldStudyGround, createWorldStudyGround } from './world-study-ground';
import { WorldStudyWater } from './world-study-water';
import { createWorldStudyShadows } from './world-study-shadows';
import { WORLD_TILE_SIZE, worldStudyLayout } from './world-study-layout';
import type { WaterLayer } from './coastal-water-study';
import type { WaterWeather } from './water-response';
import playerUrl from '../../content/kit/core/chars/player_down.png?url';

const waterUrls = import.meta.glob('../../docs/design/frames/rich-layered-water-2026-10-25/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const worldWidth = worldStudyLayout.width * WORLD_TILE_SIZE;
const worldHeight = worldStudyLayout.height * WORLD_TILE_SIZE;

class WorldStudy extends Phaser.Scene {
  private actor!: Phaser.GameObjects.Sprite;
  private ground!: ReturnType<typeof createWorldStudyGround>;
  private water!: WorldStudyWater;
  private shadows!: ReturnType<typeof createWorldStudyShadows>;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private moving = !reduced.matches;
  private elapsed = 0;
  private walkClock = 0;

  constructor() { super('world-study'); }

  preload(): void {
    preloadWorldStudyGround(this);
    this.load.spritesheet('world-study-player', playerUrl, { frameWidth: 16, frameHeight: 24 });
    for (const name of ['bed', 'body', 'light', 'foam']) {
      const entry = Object.entries(waterUrls).find(([path]) => path.endsWith(`/${name}.png`));
      if (!entry) throw new Error(`Missing approved water layer: ${name}`);
      this.load.image(`layered-${name}`, entry[1]);
    }
  }

  create(): void {
    this.ground = createWorldStudyGround(this);
    this.water = new WorldStudyWater(this, worldWidth, worldHeight, this.ground.landAt, this.ground.landColor);
    const spawn = worldStudyLayout.spawn;
    this.actor = this.add.sprite((spawn.x + .5) * WORLD_TILE_SIZE, (spawn.y + .5) * WORLD_TILE_SIZE, 'world-study-player', 1)
      .setOrigin(.5, 1).setScale(4);
    this.actor.setDepth(this.actor.y);
    this.shadows = createWorldStudyShadows(this, this.ground.trees, this.ground.landAt);
    this.shadows.advance(this.actor);
    this.events.once('shutdown', () => this.shadows.destroy());
    this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.actor, true, .16, .16);
    this.cameras.main.setFollowOffset(0, 24);
    this.cameras.main.centerOn(this.actor.x, this.actor.y);
    this.water.setView(this.cameras.main);
    this.ground.setMotion(this.moving);
    this.ground.advance(0, this.water.wind, this.actor);

    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      button.onclick = () => this.jumpToView(button.dataset.view!);
    }
    const updateMotionLabel = () => {
      const button = document.getElementById('motion')!;
      button.setAttribute('aria-pressed', String(this.moving));
      button.textContent = this.moving ? 'עצירת תנועה' : 'הפעלת תנועה';
    };
    const setMotion = (enabled: boolean) => {
      this.moving = enabled;
      this.ground.setMotion(enabled);
      updateMotionLabel();
    };
    document.getElementById('motion')!.onclick = () => setMotion(!this.moving);
    const onReduced = () => setMotion(!reduced.matches);
    reduced.addEventListener('change', onReduced);
    this.events.once('shutdown', () => reduced.removeEventListener('change', onReduced));

    const weather = document.getElementById('weather') as HTMLSelectElement;
    weather.onchange = () => {
      this.water.weather = weather.value as WaterWeather;
      this.water.render();
      this.shadows.setSunEnabled(weather.value !== 'storm');
    };
    document.getElementById('wind')!.onclick = () => {
      this.water.wind = [-this.water.wind[0], -this.water.wind[1]];
      this.water.rebuild();
      this.ground.advance(this.elapsed, this.water.wind, this.actor);
      document.getElementById('wind')!.textContent = this.water.wind[0] < 0 ? 'רוח ← החלפת כיוון' : 'רוח → החלפת כיוון';
    };
    document.getElementById('zoom')!.onclick = () => {
      const camera = this.cameras.main;
      camera.setZoom(camera.zoom === 1 ? 2 : 1);
      camera.centerOn(this.actor.x, this.actor.y);
      this.water.setView(camera);
      document.getElementById('zoom')!.textContent = camera.zoom === 1 ? 'קירוב ×2' : 'מבט רחב';
    };
    const plants = document.getElementById('plants') as HTMLInputElement;
    const shadows = document.getElementById('shadows') as HTMLInputElement;
    const updateShadows = () => this.shadows.setVisible(plants.checked && shadows.checked);
    plants.onchange = () => { this.ground.setPlantsVisible(plants.checked); updateShadows(); };
    shadows.onchange = updateShadows;
    for (const input of document.querySelectorAll<HTMLInputElement>('[data-layer]')) {
      input.onchange = () => {
        this.water.layers[input.dataset.layer as WaterLayer] = input.checked;
        this.water.render();
      };
    }
    updateMotionLabel();
    this.updatePlaceLabel();
    (window as unknown as { __worldStudy: WorldStudy }).__worldStudy = this;
  }

  /** Review shortcuts use authored land locations; walking remains available between them. */
  jumpToView(id: string): void {
    const view = worldStudyLayout.viewpoints.find(point => point.id === id);
    if (!view) return;
    const x = (view.x + .5) * WORLD_TILE_SIZE, y = (view.y + .5) * WORLD_TILE_SIZE;
    if (!this.ground.landAt(x, y)) throw new Error(`Viewpoint is not on ground: ${id}`);
    this.actor.setPosition(x, y).setDepth(y).setFrame(1);
    this.cameras.main.centerOn(x, y);
    this.water.setView(this.cameras.main);
    this.ground.advance(this.elapsed, this.water.wind, this.actor);
    this.shadows.advance(this.actor);
    this.updatePlaceLabel();
  }

  private updatePlaceLabel(): void {
    let closest = worldStudyLayout.viewpoints[0]!;
    let distance = Infinity;
    for (const view of worldStudyLayout.viewpoints) {
      const d = Math.hypot(this.actor.x - (view.x + .5) * WORLD_TILE_SIZE, this.actor.y - (view.y + .5) * WORLD_TILE_SIZE);
      if (d < distance) { closest = view; distance = d; }
    }
    document.getElementById('status')!.textContent = closest.label;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === closest.id));
    }
  }

  override update(_time: number, delta: number): void {
    if (!this.actor || document.hidden) return;
    const dt = Math.min(delta, 50) / 1000;
    if (this.moving) {
      this.elapsed += dt;
      this.water.advance(dt);
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
      if (this.ground.landAt(this.actor.x + dx - 6, this.actor.y) && this.ground.landAt(this.actor.x + dx + 6, this.actor.y)) this.actor.x += dx;
      if (this.ground.landAt(this.actor.x, this.actor.y + dy - 4) && this.ground.landAt(this.actor.x, this.actor.y + dy + 4)) this.actor.y += dy;
      this.walkClock += dt;
      this.actor.setFrame(Math.floor(this.walkClock * 8) % 3).setDepth(this.actor.y);
      this.updatePlaceLabel();
    } else this.actor.setFrame(1);
    this.water.setView(this.cameras.main);
    this.ground.advance(this.elapsed, this.water.wind, this.actor);
    this.shadows.advance(this.actor);
  }
}

const host = document.getElementById('game')!;
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: host, pixelArt: true, roundPixels: true, banner: false,
  backgroundColor: '#1c4a49',
  scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth, height: host.clientHeight },
  scene: [WorldStudy],
});
window.addEventListener('pagehide', event => { if (!event.persisted) game.destroy(true); });
