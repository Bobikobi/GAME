/**
 * The action poses of the base characters (NEXT 4c): one short sheet for each thing the
 * player does with the body besides walk and swing a tool. Each is the standing frame of the
 * idle sheet, bent or reached as the action needs, with a few pixels of what is in the hand.
 * They are drawn for the man (`player_<pose>_<dir>`) and the woman (`woman_<pose>_<dir>`); the
 * starter looks in roles.ts are laid over these in turn.
 *
 * Letters are palette letters (see roles.ts): s skin, 0 outline, 3/4 grey steel, c/d browns,
 * e/f straw and wood, q/r gold, 9 leaf, j water, W (5) white.
 */
import { type Build, type Frame, type Item, type View, build, lay, readSheet, writeSheet } from './roles.js';

export interface PoseFrame {
  /** rows taken out of the torso: the body bends */
  bend?: number;
  items: Record<View, Item[]>;
}

export interface Pose {
  name: string;
  /** one sheet for every direction, or the down view only */
  directional: boolean;
  /** the frame size: 16x24, or 32x32 for a lying body */
  size: [number, number];
  frames: PoseFrame[];
}

/** One group of pixels. `x` counts from the anchor column (negative is toward the left of the picture), `y` from its row. */
function px(anchor: Item['anchor'], x: number, y: number, ...rows: string[]): Item {
  return { anchor, layer: 'front', dy: y, dx: x, edge: true, grid: rows };
}
const t = (x: number, y: number, ...rows: string[]) => px('torso', x, y, ...rows);
const hd = (x: number, y: number, ...rows: string[]) => px('head', x, y, ...rows);
/** Single pixels of one colour, on the torso. */
const dots = (ch: string, ...pts: [number, number][]): Item[] => pts.map(([x, y]) => t(x, y, ch));
const arm = (...pts: [number, number][]) => dots('s', ...pts);

/** The arms the pose moves: the skin of each is cleared first. */
const FREE: Record<View, Item[]> = {
  down: [t(-4, 2, 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx'), t(2, 2, 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx')],
  left: [t(0, 1, 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx')],
  up: [t(-4, 2, 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx'), t(2, 2, 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx', 'xxx')],
};
const frame = (bend: number | undefined, d: Item[], l: Item[], u: Item[]): PoseFrame => ({
  bend,
  items: { down: [...FREE.down, ...d], left: [...FREE.left, ...l], up: [...FREE.up, ...u] },
});

const HAMMER = ['333', '344'];
const COIN = ['qr', 'rq'];
const BUBBLE = ['.000.', '05550', '.000.'];
const Z = ['5555', '..5.', '.5..', '5555'];

export const POSES: Pose[] = [
  {
    // down to a plant with both hands, then up with a sprig in the fist
    name: 'gather', directional: true, size: [16, 24],
    frames: [
      frame(2,
        [...arm([-4, 2], [-4, 3], [-3, 4], [-2, 5], [-1, 6], [3, 2], [3, 3], [2, 4], [1, 5], [0, 6], [1, 6]), t(-2, 7, '89998', '.989.')],
        [...arm([-1, 1], [-2, 2], [-3, 3], [-4, 4], [-5, 5], [-6, 6], [-6, 7]), t(-10, 6, '.8.', '898', '999')],
        [...arm([-5, 3], [-5, 4], [-5, 5], [5, 3], [5, 4], [5, 5])]),
      frame(2,
        [...arm([-4, 2], [-4, 3], [-3, 3], [-2, 3], [-1, 3], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3]), t(0, -1, '8', '9', '9')],
        [...arm([-1, 1], [-2, 2], [-3, 2], [-4, 1], [-5, 1], [-5, 0]), t(-6, -3, '8', '9', '9', '9')],
        [...arm([-5, 2], [-5, 3], [5, 2], [5, 3])]),
    ],
  },
  {
    // down to the ground for a thing lying there, then up with it
    name: 'lift', directional: true, size: [16, 24],
    frames: [
      frame(5,
        [...arm([-4, 2], [-4, 3], [-3, 4], [3, 2], [3, 3], [2, 4], [-2, 4], [1, 4], [-1, 5], [0, 5]), t(-1, 6, 'ef', 'ee')],
        [...arm([-1, 1], [-2, 2], [-3, 3], [-4, 4], [-5, 5]), t(-7, 5, 'ef', 'ee')],
        [...arm([-5, 3], [-5, 4], [-5, 5], [5, 3], [5, 4], [5, 5])]),
      frame(2,
        [...arm([-4, 2], [-4, 3], [-3, 3], [-2, 3], [3, 2], [3, 3], [2, 3], [1, 3]), t(-1, 0, 'ef', 'ee', 'ef')],
        [...arm([-1, 1], [-2, 2], [-3, 2], [-4, 2]), t(-6, 0, 'ef', 'ee', 'ef')],
        [...arm([-5, 3], [-5, 4], [5, 3], [5, 4])]),
    ],
  },
  {
    // the trowel over the shoulder, then into the ground
    name: 'dig', directional: true, size: [16, 24],
    frames: [
      frame(3,
        [...arm([3, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-4, 4]), t(4, -4, 'c', 'c'), t(4, -7, '34', '33', '3.')],
        [...arm([1, 1], [2, 0], [2, -1], [2, -2]), t(2, -4, 'c', 'c'), t(2, -7, '34', '33', '3.')],
        [...arm([3, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-4, 4]), t(4, -4, 'c', 'c'), t(4, -7, '34', '33', '3.')]),
      frame(3,
        [...arm([3, 2], [3, 3], [2, 4], [2, 5], [2, 6], [-4, 2], [-4, 3], [-4, 4]), t(2, 7, 'c', 'c', '34'), t(-2, 10, 'cdc.d')],
        [...arm([-1, 2], [-2, 3], [-3, 4], [-4, 5], [-4, 6]), t(-4, 7, 'c', '34'), t(-8, 9, 'cdc.d')],
        [...arm([3, 2], [3, 3], [2, 4], [2, 5], [-4, 2], [-4, 3], [-4, 4]), t(2, 6, 'c', 'c', '34')]),
    ],
  },
  {
    // a hammer lifted at the bench, then brought down in a spark
    name: 'craft', directional: true, size: [16, 24],
    frames: [
      frame(undefined,
        [...arm([3, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-3, 4], [-2, 4]), t(4, -3, 'c', 'c'), t(3, -5, ...HAMMER)],
        [...arm([1, 1], [0, 0], [0, -1], [0, -2]), t(0, -4, 'c'), t(-1, -6, ...HAMMER)],
        [...arm([3, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-3, 4], [-2, 4]), t(4, -3, 'c', 'c'), t(3, -5, ...HAMMER)]),
      frame(undefined,
        [...arm([3, 2], [3, 3], [2, 4], [2, 5], [-4, 2], [-4, 3], [-3, 4], [-2, 4]), t(0, 6, ...HAMMER), t(2, 6, 'c'), ...dots('q', [-3, 6], [4, 7]), ...dots('r', [-2, 5], [3, 5])],
        [...arm([-1, 2], [-2, 3], [-3, 4], [-4, 5]), t(-7, 6, ...HAMMER), t(-5, 6, 'c'), ...dots('q', [-9, 7], [-5, 8]), ...dots('r', [-8, 5])],
        [...arm([3, 2], [3, 3], [2, 4], [2, 5], [-4, 2], [-4, 3], [-3, 4], [-2, 4]), t(0, 6, ...HAMMER), ...dots('q', [-3, 6], [4, 7])]),
    ],
  },
  {
    // stirring at the fire: the spoon sweeps to one side of the pot and back
    name: 'cook', directional: true, size: [16, 24],
    frames: [
      frame(3,
        [...arm([3, 2], [2, 3], [1, 4], [0, 5], [-4, 2], [-4, 3], [-3, 4]), t(-5, 8, '.333.', '34433', '.333.'), ...dots('c', [-1, 6], [-2, 7]), ...dots('5', [-3, 6])],
        [...arm([-1, 2], [-2, 3], [-3, 4], [-4, 5]), t(-11, 8, '.333.', '34433', '.333.'), ...dots('c', [-5, 6], [-6, 7], [-7, 7]), ...dots('5', [-9, 6])],
        [...arm([3, 2], [2, 3], [1, 4], [-4, 2], [-4, 3], [-3, 4]), ...dots('c', [0, 5], [-1, 6])]),
      frame(3,
        [...arm([3, 2], [2, 3], [1, 4], [0, 5], [-4, 2], [-4, 3], [-3, 4]), t(-5, 8, '.333.', '34433', '.333.'), ...dots('c', [-1, 6], [-1, 7]), ...dots('5', [-2, 5], [-3, 6])],
        [...arm([-1, 2], [-2, 3], [-3, 4], [-4, 5]), t(-11, 8, '.333.', '34433', '.333.'), ...dots('c', [-5, 6], [-6, 6], [-7, 7]), ...dots('5', [-8, 5], [-9, 6])],
        [...arm([3, 2], [2, 3], [1, 4], [-4, 2], [-4, 3], [-3, 4]), ...dots('c', [0, 5], [0, 6])]),
    ],
  },
  {
    // a bite: the food at the chest, at the mouth, and less of it
    name: 'eat', directional: true, size: [16, 24],
    frames: [
      frame(undefined,
        [...arm([3, 2], [2, 3], [1, 3], [0, 3], [-4, 2], [-4, 3], [-4, 4]), t(-1, 0, 'ef', 'ee', 'pp')],
        [...arm([-1, 1], [-2, 2], [-3, 2], [-4, 2]), t(-6, 0, 'ef', 'ee', 'pp')],
        [...arm([4, 2], [4, 1], [4, 0], [-4, 2], [-4, 3], [-4, 4])]),
      frame(undefined,
        [...arm([3, 2], [3, 1], [2, 0], [1, -1], [0, -2], [-4, 2], [-4, 3], [-4, 4]), t(-1, -4, 'ef', 'ee')],
        [...arm([-1, 1], [-2, 0], [-3, -1], [-4, -2]), t(-6, -4, 'ef', 'ee')],
        [...arm([4, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-4, 4])]),
      frame(undefined,
        [...arm([3, 2], [3, 1], [2, 0], [1, -1], [0, -2], [-4, 2], [-4, 3], [-4, 4]), t(-1, -4, 'e')],
        [...arm([-1, 1], [-2, 0], [-3, -1], [-4, -2]), t(-6, -4, 'e')],
        [...arm([4, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-4, 4])]),
    ],
  },
  {
    // a cup lifted and tipped
    name: 'drink', directional: true, size: [16, 24],
    frames: [
      frame(undefined,
        [...arm([3, 2], [2, 3], [1, 3], [0, 3], [-4, 2], [-4, 3], [-4, 4]), t(-1, -1, '0f0', 'jjf', '0f0')],
        [...arm([-1, 1], [-2, 2], [-3, 2], [-4, 2]), t(-6, -1, '0f0', 'jjf', '0f0')],
        [...arm([4, 2], [4, 1], [4, 0], [-4, 2], [-4, 3], [-4, 4])]),
      frame(undefined,
        [...arm([3, 2], [3, 1], [2, 0], [1, -1], [0, -2], [-4, 2], [-4, 3], [-4, 4]), t(-1, -6, '0f0', 'jjf', '0f0')],
        [...arm([-1, 1], [-2, 0], [-3, -1], [-4, -2]), t(-6, -6, '0f0', 'jjf', '0f0')],
        [...arm([4, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-4, 4])]),
      frame(undefined,
        [...arm([3, 2], [3, 1], [2, 0], [1, -1], [0, -2], [-4, 2], [-4, 3], [-4, 4]), t(-1, -7, '0f0', 'f0f'), t(0, -5, 'j')],
        [...arm([-1, 1], [-2, 0], [-3, -1], [-4, -2]), t(-6, -7, '0f0', 'f0f'), t(-5, -5, 'j')],
        [...arm([4, 2], [4, 1], [4, 0], [4, -1], [-4, 2], [-4, 3], [-4, 4])]),
    ],
  },
  {
    // a hand out with a coin, the coin changing hands, the hand drawn back
    name: 'pay', directional: true, size: [16, 24],
    frames: [
      frame(undefined,
        [...arm([3, 2], [3, 3], [2, 4], [1, 5], [0, 6], [1, 6], [-4, 2], [-4, 3], [-4, 4]), t(-1, 7, ...COIN)],
        [...arm([-1, 1], [-2, 1], [-3, 1], [-4, 2], [-5, 2], [-5, 3]), t(-8, 1, ...COIN)],
        [...arm([4, 2], [4, 3], [4, 4], [-4, 2], [-4, 3], [-4, 4])]),
      frame(undefined,
        [...arm([3, 2], [3, 3], [2, 4], [1, 5], [0, 6], [1, 6], [-4, 2], [-4, 3], [-4, 4]), t(0, 7, 'rq'), ...dots('q', [-2, 6], [3, 8])],
        [...arm([-1, 1], [-2, 1], [-3, 1], [-4, 2], [-5, 2], [-5, 3]), t(-8, 1, 'rq'), ...dots('q', [-7, 0], [-9, 3])],
        [...arm([4, 2], [4, 3], [4, 4], [-4, 2], [-4, 3], [-4, 4])]),
      frame(undefined,
        [...arm([3, 2], [3, 3], [2, 3], [-4, 2], [-4, 3], [-4, 4])],
        [...arm([-1, 1], [-2, 2], [-3, 3])],
        [...arm([4, 2], [4, 3], [-4, 2], [-4, 3], [-4, 4])]),
    ],
  },
  {
    // the hand out in talk, a bubble over the head that fills with words
    name: 'talk', directional: true, size: [16, 24],
    frames: [
      frame(undefined,
        [...arm([-4, 2], [-5, 1], [-5, 0], [-5, -1], [3, 2], [3, 3], [3, 4]), hd(4, -1, ...BUBBLE)],
        [...arm([-1, 1], [-2, 0], [-3, -1], [-4, -2]), hd(4, -1, ...BUBBLE)],
        [...arm([-4, 2], [-5, 1], [-5, 0], [-5, -1], [3, 2], [3, 3], [3, 4]), hd(4, -1, ...BUBBLE)]),
      frame(undefined,
        [...arm([-4, 2], [-5, 1], [-6, 0], [-6, -1], [3, 2], [3, 3], [3, 4]), hd(4, -1, '.000.', '05250', '.000.')],
        [...arm([-1, 1], [-2, 0], [-3, -2], [-4, -3]), hd(4, -1, '.000.', '05250', '.000.')],
        [...arm([-4, 2], [-5, 1], [-6, 0], [-6, -1], [3, 2], [3, 3], [3, 4]), hd(4, -1, '.000.', '05250', '.000.')]),
      frame(undefined,
        [...arm([-4, 2], [-5, 2], [-5, 1], [-5, 0], [3, 2], [3, 3], [3, 4]), hd(4, -1, '.000.', '02520', '.000.')],
        [...arm([-1, 1], [-2, 1], [-3, 0], [-4, -1]), hd(4, -1, '.000.', '02520', '.000.')],
        [...arm([-4, 2], [-5, 2], [-5, 1], [-5, 0], [3, 2], [3, 3], [3, 4]), hd(4, -1, '.000.', '02520', '.000.')]),
    ],
  },
  {
    // setting a log down for the fire: held at the chest, then on the ground in a spark
    name: 'camp', directional: true, size: [16, 24],
    frames: [
      frame(2,
        [...arm([-4, 2], [-4, 3], [-4, 4], [3, 2], [3, 3], [3, 4]), t(-3, 3, '0ccccc0', '0ddddd0')],
        [...arm([-1, 1], [-2, 2], [-3, 3], [-4, 3]), t(-8, 3, '0ccccc0', '0ddddd0')],
        [...arm([-4, 2], [-4, 3], [-4, 4], [3, 2], [3, 3], [3, 4]), t(-3, 3, '0ccccc0', '0ddddd0')]),
      frame(3,
        [...arm([-4, 2], [-4, 3], [-3, 4], [-3, 5], [3, 2], [3, 3], [2, 4], [2, 5]), t(-3, 7, '0ccccc0', '0ddddd0'), ...dots('q', [-1, 5], [1, 5]), ...dots('p', [0, 6])],
        [...arm([-1, 1], [-2, 2], [-3, 3], [-4, 4], [-5, 5]), t(-10, 7, '0ccccc0', '0ddddd0'), ...dots('q', [-9, 5], [-7, 5]), ...dots('p', [-8, 6])],
        [...arm([-4, 2], [-4, 3], [-3, 4], [-3, 5], [3, 2], [3, 3], [2, 4], [2, 5]), t(-3, 7, '0ccccc0', '0ddddd0')]),
    ],
  },
];

/** Turns the standing idle frame onto its back: the head to the left, the feet to the right, on the bottom of a 32x32 frame, with the blanket drawn over from the chest down. */
function lie(fr: Frame, rise: number): Frame {
  const out: Frame = { w: 32, h: 32, px: new Array<number>(32 * 32).fill(-1) };
  const set = (x: number, y: number, c: number) => { if (x >= 0 && x < 32 && y >= 0 && y < 32) out.px[y * 32 + x] = c; };
  for (let y = 0; y < fr.h; y++) {
    for (let x = 0; x < fr.w; x++) {
      const v = fr.px[y * fr.w + x]!;
      if (v >= 0) set(4 + y, 16 + x, v); // the front of the body (small x) faces up
    }
  }
  // the blanket: over everything from the chest down, a row higher on the breath in
  const top = 19 - rise;
  for (let x = 4 + 10; x < 4 + 23; x++) {
    for (let y = top; y <= 28; y++) set(x, y, y === top || x === 4 + 10 ? 0 : (x + y) % 5 === 0 ? 31 : 30);
  }
  // the breath of sleep: a z, and a bigger one in the next frame
  for (let y = 0; y < Z.length; y++) for (let x = 0; x < Z[y]!.length; x++) if (Z[y]![x] === '5') set(8 + x + rise * 3, 9 - y - rise * 3, 5);
  return out;
}

/** The base sheets of a look, one for each pose and direction. Returns the sheets written, as `name|w|h|frames`. */
export function makeBaseActions(): string[] {
  const names: string[] = [];
  const none: Build = { cutRows: [], cutCols: [], dupCols: [] };
  for (const look of [['player', 'player'], ['woman', 'woman']] as const) {
    const [stem, src] = look;
    for (const pose of POSES) {
      for (const view of ['down', 'left', 'up'] as View[]) {
        if (!pose.directional && view !== 'down') continue;
        const idle = readSheet(`${src}_idle_${view}.png`, 16, 24)[0]!;
        const frames = pose.frames.map((pf) => {
          const cut = (pf.bend ?? 0) > 0 ? [13, 11, 9, 7, 15].slice(0, pf.bend) : [];
          const built = build(idle, { ...none, cutRows: cut });
          return lay(built.frame, pf.items[view]);
        });
        writeSheet(`${stem}_${pose.name}_${view}.png`, frames);
        names.push(`${stem}_${pose.name}_${view}|16|24|${frames.length}`);
      }
    }
    const idle = readSheet(`${src}_idle_left.png`, 16, 24)[0]!;
    writeSheet(`${stem}_sleep_down.png`, [lie(idle, 0), lie(idle, 1)]);
    names.push(`${stem}_sleep_down|32|32|2`);
  }
  return names;
}
