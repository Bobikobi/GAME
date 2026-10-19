/**
 * The peek at a maze's entrance, on the screen (../peek.ts holds the rules): a
 * second camera over the whole screen looks down on the maze's frame for three
 * seconds and fades back to the player. It sees the ground, the props and the
 * figures; the air (the mist, the shade, the dark and the lights) stays with
 * the main camera, so the shape reads at any hour. Tier 1 draws a faint line
 * of the route and tiers 1 and 2 light the landmarks, for this camera only.
 */
import * as Phaser from 'phaser';
import { T } from '../config';
import { PEEK_MS, fitFrame, type Peek } from '../peek';
import { pixelRatio } from '../view';

const INK = 0x1b1a2e;
/** the route: paper white, very faint, about 3 px wide on any screen */
const LINE = { color: 0xf5f4ef, alpha: 0.22, px: 3 };
const GLOW = 0xffe28c;
/** the fade in and out at either end of the three seconds */
const FADE_MS = 350;
/** the peek starts this much nearer than the fit and rises to it while it fades in */
const RISE = 1.15;
/** the screen's own bands: the HUD's boxes and the touch controls; a peek fits between them */
const KEEP = '.top .hud, .top .tracker, .touch .pad, .touch .tbtns';
/** a margin around the frame, in screen px */
const EDGE = 8;

export interface PeekShown {
  quest: string;
  tier: number;
  /** when it began and ended, performance.now() */
  since: number;
  ended?: number;
  zoom: number;
  /** the frame's box on the screen at its widest, in CSS px, and the free band it had to fit */
  box: { x: number; y: number; w: number; h: number };
  band: { top: number; bottom: number };
  line: boolean;
  glows: number;
}

export class MazePeek {
  /** the last peek shown, for the tests */
  last: PeekShown | undefined;
  private cam: Phaser.Cameras.Scene2D.Camera | undefined;
  private marks: Phaser.GameObjects.GameObject[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private tick: (() => void) | undefined;

  /**
   * @param air the depth from which an object belongs to the air, which the peek leaves out
   * @param labels the page's labels pinned to the world, hidden while the peek shows
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly air: number,
    private readonly labels: HTMLElement,
  ) {}

  get active(): boolean {
    return this.cam !== undefined;
  }

  show(peek: Peek): void {
    if (this.cam) return;
    const s = this.scene;
    // laid out in CSS pixels, as the labels are; the camera's own zoom is scaled up to the canvas's
    const px = pixelRatio();
    const w = s.scale.width / px;
    const h = s.scale.height / px;
    const band = bands(h);
    const fit = fitFrame(peek.frame, T, { w, h }, { top: band.top + EDGE, bottom: band.bottom + EDGE, side: EDGE });
    const cam = s.cameras.add(0, 0, s.scale.width, s.scale.height, false, 'peek').setBackgroundColor(INK).setAlpha(0).setRoundPixels(false);
    cam.ignore(s.children.list.filter((o) => (o as unknown as { depth: number }).depth >= this.air));
    cam.setZoom(fit.zoom * px * RISE).centerOn(fit.x, fit.y);
    this.cam = cam;
    if (peek.route.length > 1) {
      const g = s.add.graphics().setDepth(this.air - 2);
      g.lineStyle(LINE.px / fit.zoom, LINE.color, LINE.alpha);
      g.beginPath();
      peek.route.forEach(([x, y], i) => (i === 0 ? g.moveTo((x + 0.5) * T, (y + 0.5) * T) : g.lineTo((x + 0.5) * T, (y + 0.5) * T)));
      g.strokePath();
      this.marks.push(g);
    }
    if (peek.landmarks.length > 0) {
      makeGlow(s);
      for (const [x, y] of peek.landmarks) {
        const glow = s.add.image(x * T, y * T, 'peek-glow').setDepth(this.air - 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.glows.push(glow);
        this.marks.push(glow);
      }
    }
    s.cameras.main.ignore(this.marks);
    this.labels.style.visibility = 'hidden';
    const since = performance.now();
    const left = (peek.frame.x * T - (fit.x - w / 2 / fit.zoom)) * fit.zoom;
    const top = (peek.frame.y * T - (fit.y - h / 2 / fit.zoom)) * fit.zoom;
    this.last = {
      quest: peek.quest,
      tier: peek.tier,
      since,
      zoom: fit.zoom,
      box: { x: left, y: top, w: peek.frame.w * T * fit.zoom, h: peek.frame.h * T * fit.zoom },
      band,
      line: peek.route.length > 1,
      glows: this.glows.length,
    };
    // driven by the wall clock, so three seconds are three seconds whatever the frame rate
    this.tick = () => {
      const t = performance.now() - since;
      if (t >= PEEK_MS) {
        this.end();
        return;
      }
      const k = Math.min(1, t / FADE_MS);
      cam.setAlpha(Math.min(k, (PEEK_MS - t) / FADE_MS));
      cam.setZoom(fit.zoom * px * (1 + (RISE - 1) * (1 - k) ** 2)).centerOn(fit.x, fit.y);
      // tier 1 keeps the landmarks lit, breathing; tier 2 lights them once, for a moment, once the peek is up
      const lit = t - FADE_MS;
      const glow =
        peek.glowMs >= PEEK_MS ? k * (0.55 + 0.25 * Math.sin(t / 220)) : lit >= 0 && lit <= peek.glowMs ? Math.sin((Math.PI * lit) / peek.glowMs) : 0;
      for (const g of this.glows) g.setAlpha(glow);
    };
    s.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
  }

  /** Back to the player: the second camera and the marks go. */
  end(): void {
    if (this.tick) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick);
    this.tick = undefined;
    if (this.cam) this.scene.cameras.remove(this.cam);
    this.cam = undefined;
    for (const m of this.marks) m.destroy();
    this.marks = [];
    this.glows = [];
    this.labels.style.visibility = '';
    if (this.last && this.last.ended === undefined) this.last.ended = performance.now();
  }
}

/** How much of the screen's top and bottom the page's own boxes cover, in CSS px. */
function bands(h: number): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>(KEEP)) {
    const r = el.getBoundingClientRect();
    if (el.hidden || r.width === 0 || r.height === 0) continue;
    if (r.top + r.height / 2 < h / 2) top = Math.max(top, r.bottom);
    else bottom = Math.max(bottom, h - r.top);
  }
  return { top: Math.round(top), bottom: Math.round(bottom) };
}

/** A soft round glow, 32 px across, brighter toward the middle. */
function makeGlow(scene: Phaser.Scene): void {
  if (scene.textures.exists('peek-glow')) return;
  const g = scene.add.graphics();
  for (let k = 16; k > 0; k--) g.fillStyle(GLOW, 0.9 * (1 - k / 17) ** 1.5 * 0.4).fillCircle(16, 16, k);
  g.generateTexture('peek-glow', 32, 32);
  g.destroy();
}
