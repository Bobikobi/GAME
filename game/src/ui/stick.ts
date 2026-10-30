/**
 * The floating stick of the landscape layout (the owner, 30.10: a phone in landscape plays with a stick and buttons
 * in the Wild Rift grammar). The stick is not drawn anywhere until the left thumb lands in its zone; its center is
 * where the thumb landed, and the finger's offset from that center drives the walk exactly as the portrait pad does
 * (`stickFrom`: the same dead zone and full-speed share, of the ring's own width). Lifting the finger lets it go.
 * Pure: no page, no app, so the math is tested on its own (game/test/touch.test.ts).
 */
import { STICK_FULL, stickFrom } from '../input';

/** The floating stick's ring at its floor, in CSS px; on a screen the ring is `controlsLayout(H).ring`, 0.26 H. */
export const STICK_RING = 96;

/** Where a thumb may land to raise the stick: a box in CSS px. */
export interface Zone {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The stick's zone on a screen `width` by `height`: the left half, below the HUD's band (`bandBottom`, the lowest
 * edge of what the top band shows).
 */
export function stickZone(width: number, height: number, bandBottom: number): Zone {
  return { left: 0, top: Math.max(0, bandBottom), right: width / 2, bottom: height };
}

export function inZone(zone: Zone, x: number, y: number): boolean {
  return x >= zone.left && x < zone.right && y >= zone.top && y < zone.bottom;
}

export class FloatingStick {
  /** the stick's center while a thumb holds it, else null */
  center: { x: number; y: number } | null = null;
  /** the pointer that raised it */
  pointer: number | null = null;

  constructor(public ring = STICK_RING) {}

  /** A thumb lands: inside the zone it raises the stick there (and reads no walk yet), elsewhere nothing. */
  down(pointer: number, x: number, y: number, zone: Zone): boolean {
    if (this.pointer !== null || !inZone(zone, x, y)) return false;
    this.pointer = pointer;
    this.center = { x, y };
    return true;
  }

  /** The walk's vector for the thumb at `x, y`, or null when this pointer does not hold the stick. */
  move(pointer: number, x: number, y: number): [number, number] | null {
    if (pointer !== this.pointer || !this.center) return null;
    return stickFrom(x - this.center.x, y - this.center.y, this.ring);
  }

  /**
   * Where the knob is drawn for the thumb at `x, y`, from the center: the finger's offset, held inside the
   * full-speed ring, so the knob stops where the walk stops growing.
   */
  knob(x: number, y: number): { x: number; y: number } {
    if (!this.center) return { x: 0, y: 0 };
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const r = Math.hypot(dx, dy);
    const max = this.ring * STICK_FULL;
    return r <= max ? { x: dx, y: dy } : { x: (dx / r) * max, y: (dy / r) * max };
  }

  /** The thumb lifts: true when it was the one holding the stick, which is then let go. */
  up(pointer: number): boolean {
    if (pointer !== this.pointer) return false;
    this.pointer = null;
    this.center = null;
    return true;
  }
}

/** A button's center, measured from the screen's right and bottom edges, and its diameter, in CSS px. */
export interface Placed {
  right: number;
  bottom: number;
  d: number;
}

export interface ControlsLayout {
  a: Placed;
  b: Placed;
  sneak: Placed;
  bag: Placed;
  journal: Placed;
  menu: Placed;
  /** the floating stick's ring and its knob */
  ring: number;
  knob: number;
  /** Sneak's angle on the ability arc round A, in degrees (180 is straight left) */
  sneakDeg: number;
  /** how far from the right edge the cluster reaches, for a dialogue to stand clear of it */
  cluster: number;
}

/** The gap between two buttons that stand side by side: a fifth of the smaller one's diameter, as Wild Rift's. */
export const GAP = 0.2;

/**
 * The landscape controls for a screen `H` CSS px tall, in Wild Rift's size and density (the owner, 30.10, through
 * the manager's measure of a Wild Rift screen): every size a share of H with a floor for the thumb.
 * - A, the attack: 0.19 H across (60 at the least), its center 0.19 H from the right and the bottom edge.
 * - B and Sneak, the ability arc: 0.13 H (48 at the least), on one arc round A at A's radius, their own and a gap;
 *   B straight left, Sneak up-left at the angle that leaves one gap between B's edge and its own. The rest of the
 *   arc stays open for the hunt's buttons.
 * - Bag, Journal and Menu, the column at the right edge: 0.11 H (44 at the least), centers 0.07 H from the edge,
 *   from just above Sneak's top upward, one gap apart.
 * - The stick: a ring of 0.26 H (96 at the least), the knob 0.4 of it.
 */
export function controlsLayout(H: number): ControlsLayout {
  const aD = Math.max(60, Math.round(0.19 * H));
  const aC = Math.round(0.19 * H);
  const sD = Math.max(48, Math.round(0.13 * H));
  const arc = aD / 2 + sD / 2 + GAP * sD;
  // the chord between B's and Sneak's centers is one diameter and one gap
  const sneakDeg = 180 - (2 * Math.asin(((1 + GAP) * sD) / (2 * arc)) * 180) / Math.PI;
  const rad = (sneakDeg * Math.PI) / 180;
  const sneak = { right: aC - arc * Math.cos(rad), bottom: aC + arc * Math.sin(rad), d: sD };
  const cD = Math.max(44, Math.round(0.11 * H));
  const cR = Math.max(Math.round(0.07 * H), cD / 2 + 2);
  const step = cD + GAP * cD;
  const bagBottom = sneak.bottom + sD / 2 + GAP * cD + cD / 2;
  const ring = Math.max(96, Math.round(0.26 * H));
  const round = (p: Placed): Placed => ({ right: Math.round(p.right), bottom: Math.round(p.bottom), d: p.d });
  return {
    a: { right: aC, bottom: aC, d: aD },
    b: round({ right: aC + arc, bottom: aC, d: sD }),
    sneak: round(sneak),
    bag: round({ right: cR, bottom: bagBottom, d: cD }),
    journal: round({ right: cR, bottom: bagBottom + step, d: cD }),
    menu: round({ right: cR, bottom: bagBottom + 2 * step, d: cD }),
    ring,
    knob: Math.round(0.4 * ring),
    sneakDeg: Math.round(sneakDeg * 10) / 10,
    cluster: Math.ceil(aC + arc + sD / 2 + 12),
  };
}
