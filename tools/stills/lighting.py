"""Compose the lighting ladder's stills A, B and C over a real 17:30 screenshot of the game.

    python3 tools/stills/lighting.py

reads `inputs/lighting-base.png` and `inputs/lighting-base-noplayer.png` (made by `lighting-shoot.mts`)
and writes the four `docs/design/frames/2026-10-30-lighting-*.png`. The numbers are in
docs/design/LIGHTING.md section 3, and RULES below holds the same ones.

Every layer is computed on the art-pixel grid (390 x 844, one art px = 3 device px at 3x), placed by
the numbers in RULES, and enlarged 3x nearest before it meets the base, so each layer is whole art
pixels at one alpha per step. Only palette colours are used.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
S = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tools/stills/inputs'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'docs/design/frames'
W, H, K = 390, 844, 3
VIEW = (482.0, 30.0)  # the camera's world corner; 4 art px per world unit


def art(wx, wy):
    return ((wx - VIEW[0]) * 4, (wy - VIEW[1]) * 4)


def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)


RAMPS = {
    'greys': ['#1b1a2e', '#3a3554', '#5d6177', '#8f94a8', '#c6cad6', '#f5f4ef'],
    'greens': ['#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a'],
    'earth': ['#3d2618', '#6e4226', '#9e6b3c', '#c99a5e', '#ebd3a2'],
    'water': ['#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8'],
    'reds': ['#5e1c28', '#a8302f', '#e2533f', '#f6a07f'],
    'fire': ['#b8661f', '#eda83a', '#f8de62'],
    'skin': ['#d38c66', '#f3c7a0'],
    'purples': ['#5b3373', '#9a5bb0'],
}

RULES = {
    'hour': '17:30',
    'wash': {'tint': '#eda83a', 'pct': 18, 'blend': 'multiply'},
    'pool_steps': [  # from the centre out: up to this share of the radius, colour, alpha (ADD)
        [0.25, '#f8de62', 24], [0.50, '#eda83a', 18], [0.75, '#eda83a', 12], [1.00, '#b8661f', 8]],
    'pool_dither': 0.03,  # share of the radius on each side of a step's edge that is checkered
    'lights': [
        {'id': 'lamp 30,7', 'foot': art(488, 128), 'head': art(488, 100), 'r': 96},
        {'id': 'lamp 33,7', 'foot': art(536, 128), 'head': None, 'r': 96},  # head behind the house at 31,5
        {'id': 'lamp 34,4', 'foot': art(552, 80), 'head': art(552, 52), 'r': 96},
        {'id': 'lamp 37,13', 'foot': art(600, 224), 'head': None, 'r': 96},  # off the right edge
        {'id': 'hearth 29,6', 'foot': art(472, 104), 'head': None, 'r': 128},  # off the left edge, lit
        {'id': 'Pell window', 'foot': (358, 600), 'head': None, 'r': 64, 'ry': 40},
    ],
    'head_glow': [[6, '#f8de62', 50], [12, '#f8de62', 25]],
    'window': {'house': (544, 128), 'glass_dark': '#8f94a8', 'glass_light': '#c6cad6', 'lit_dark': '#eda83a', 'lit_light': '#f8de62'},
    'body_light': {'px': 4, 'lit_side': 'left', 'sun': 'south-west'},
    'clouds': {'tint': '#172a52', 'steps': [4, 8, 12], 'list': [
        {'c': (-60, 150), 'd_tiles': 8}, {'c': (430, 690), 'd_tiles': 6}, {'c': (90, 1010), 'd_tiles': 10}]},
    'shaft': {'tint': '#f8de62', 'pct': 6, 'from': (-20, 720), 'dir': (1.03, -0.40), 'width': 64},
    'motes': {'n': 14, 'tint': '#f5f4ef', 'pct': 45, 'seed': 7, 'size': 2},
    'embers': {'n': 7, 'from': art(472, 100), 'seed': 3, 'size': 2},
    'fireflies': {'n': 5, 'core': '#c8e88a', 'halo': '#84c450', 'halo_pct': 40, 'seed': 11},
    'flicker': {'amp': 0.04, 'lobes': 3},
    'gust': {'band_y': (790, 844), 'shift': [1, 2]},
}


def up(layer):
    return np.repeat(np.repeat(layer, K, axis=0), K, axis=1)


def load(name):
    return np.asarray(Image.open(S / name).convert('RGB'), dtype=np.float64)


base = load('lighting-base.png')
noplayer = load('lighting-base-noplayer.png')
assert base.shape == (H * K, W * K, 3), base.shape
ys, xs = np.mgrid[0:H, 0:W]
checker = ((xs + ys) % 2).astype(np.float64)
BAYER = np.array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]).reshape(4, 4) / 16.0
bayer = BAYER[ys % 4, xs % 4]


def multiply(img, tint, alpha_art):
    a = up(alpha_art)[..., None]
    return img * (1 - a) + img * (hexc(tint) / 255.0) * a


def add(img, colour_art, alpha_art):
    a = up(alpha_art)[..., None]
    return np.clip(img + up(colour_art) * a, 0, 255)


def wash(img):
    w = RULES['wash']
    return multiply(img, w['tint'], np.full((H, W), w['pct'] / 100.0))


def pools(img, flicker=False):
    rank = np.full((H, W), 99)
    steps = RULES['pool_steps']
    for i, l in enumerate(RULES['lights']):
        fx, fy = l['foot']
        rx, ry = l['r'], l.get('ry', l['r'])
        d = np.hypot((xs - fx) / rx, (ys - fy) / ry)
        if flicker:  # the flame's shape moves the pool's edge: a few lobes, phase per light
            th = np.arctan2(ys - fy, xs - fx)
            d = d / (1 + RULES['flicker']['amp'] * np.sin(RULES['flicker']['lobes'] * th + 1.7 * i))
        d = d + (checker - 0.5) * 2 * RULES['pool_dither']
        for k, (edge, _, _) in enumerate(steps):
            hit = (d <= edge) & (rank > k)
            rank[hit] = k
    colour = np.zeros((H, W, 3))
    alpha = np.zeros((H, W))
    for k, (_, c, pct) in enumerate(steps):
        m = rank == k
        colour[m] = hexc(c)
        alpha[m] = pct / 100.0
    img = add(img, colour, alpha)
    # the lit heads
    colour = np.zeros((H, W, 3))
    alpha = np.zeros((H, W))
    for l in RULES['lights']:
        if not l['head']:
            continue
        hx, hy = l['head']
        d = np.hypot(xs - hx, ys - hy)
        for r, c, pct in reversed(RULES['head_glow']):
            m = d <= r
            colour[m] = hexc(c)
            alpha[m] = pct / 100.0
    return add(img, colour, alpha)


def player_mask():
    diff = np.abs(base - noplayer).sum(axis=2)
    m = diff.reshape(H, K, W, K).max(axis=(1, 3)) > 6
    box = np.zeros_like(m)
    x0, y0 = (int(v) for v in art(560, 168))  # the player's sprite: 16 x 24 world units at (560, 168)
    box[y0:y0 + 96, x0:x0 + 64] = True
    return m & box


PMASK = player_mask()


def lit_window(img):
    w = RULES['window']
    house = np.asarray(Image.open(ROOT / 'content/kit/core/props/house_small.png').convert('RGBA'))
    out = img.copy()
    for sy in range(house.shape[0]):
        for sx in range(house.shape[1]):
            px = '#%02x%02x%02x' % tuple(house[sy, sx, :3])
            if house[sy, sx, 3] == 0 or px not in (w['glass_dark'], w['glass_light']):
                continue
            ax, ay = art(w['house'][0] + sx, w['house'][1] + sy)
            ax, ay = int(ax), int(ay)
            for yy in range(ay, ay + 4):
                for xx in range(ax, ax + 4):
                    if 0 <= xx < W and 0 <= yy < H and not PMASK[yy, xx]:
                        c = hexc(w['lit_light'] if px == w['glass_light'] else w['lit_dark'])
                        out[yy * K:(yy + 1) * K, xx * K:(xx + 1) * K] = c
    return out


PAL = {c: (name, i) for name, ramp in RAMPS.items() for i, c in enumerate(ramp)}
PAL_RGB = np.array([hexc(c) for c in PAL])
PAL_KEYS = list(PAL)
SCALES = np.linspace(0.55, 1.05, 11)


def body_light(img):
    """STYLE 4: the 4 art px on the side away from the light one step darker, the side toward it one step lighter."""
    out = img.copy()
    n = RULES['body_light']['px']
    for y in range(H):
        cols = np.nonzero(PMASK[y])[0]
        if cols.size == 0:
            continue
        lit = cols[:n]
        dark = cols[-n:]
        for x, step in [(x, 1) for x in lit] + [(x, -1) for x in dark]:
            p = img[y * K + 1, x * K + 1]
            cand = SCALES[:, None, None] * PAL_RGB[None, :, :]
            err = np.abs(cand - p).sum(axis=2)
            si, ci = np.unravel_index(np.argmin(err), err.shape)
            key = PAL_KEYS[ci]
            ramp_name, idx = PAL[key]
            if key == '#1b1a2e':
                continue  # the ink outline stays ink
            ramp = RAMPS[ramp_name]
            j = min(max(idx + step, 0), len(ramp) - 1)
            ratio = hexc(ramp[j]) / np.maximum(hexc(key), 1)
            out[y * K:(y + 1) * K, x * K:(x + 1) * K] = np.clip(img[y * K:(y + 1) * K, x * K:(x + 1) * K] * ratio, 0, 255)
    return out


def clouds(img):
    c = RULES['clouds']
    dens = np.zeros((H, W))
    for cl in c['list']:
        cx, cy = cl['c']
        r = cl['d_tiles'] * 64 / 2
        d = np.hypot(xs - cx, (ys - cy) * 1.25) / r  # a cloud's shade is a little wider than tall
        # soft: full inside 60% of the radius, falling to nothing at the rim
        v = np.clip((1 - d) / 0.4, 0, 1)
        dens = np.maximum(dens, v)  # one shade where clouds overlap
    steps = c['steps']
    lvl = np.floor(dens * len(steps) + bayer * 0.999)  # ordered dither between steps
    lvl = np.clip(lvl, 0, len(steps)).astype(int)
    alpha = np.where(lvl > 0, np.array([0] + steps)[lvl] / 100.0, 0)
    return multiply(img, c['tint'], alpha), dens


def shaft(img, shade):
    s = RULES['shaft']
    dx, dy = s['dir']
    n = math.hypot(dx, dy)
    dx, dy = dx / n, dy / n
    fx, fy = s['from']
    dist = np.abs((xs - fx) * dy - (ys - fy) * dx)  # distance from the shaft's centre line
    band = (dist <= s['width'] / 2) & (shade < 0.25)
    colour = np.zeros((H, W, 3))
    colour[band] = hexc(s['tint'])
    return add(img, colour, band * s['pct'] / 100.0), band


def put(img, x, y, colour, alpha=1.0, size=1):
    for yy in range(y, y + size):
        for xx in range(x, x + size):
            if 0 <= xx < W and 0 <= yy < H:
                sl = img[yy * K:(yy + 1) * K, xx * K:(xx + 1) * K]
                sl[:] = sl * (1 - alpha) + hexc(colour) * alpha


def gust(img):
    """The two lightest greens of the meadow lean 1 px in the gust's edge and 2 px in its heart."""
    y0, y1 = RULES['gust']['band_y']
    out = img.copy()
    light = [hexc('#84c450'), hexc('#c8e88a')]
    for y in range(y0, y1):
        shift = 2 if (y - y0) % 12 < 6 else 1
        for x in range(W - 2, -1, -1):
            p = img[y * K + 1, x * K + 1]
            g = p[1] > p[0] + 20 and p[1] > p[2] + 10 and p[1] > 120
            if g and x + shift < W:
                out[y * K:(y + 1) * K, (x + shift) * K:(x + shift + 1) * K] = img[y * K:(y + 1) * K, x * K:(x + 1) * K]
    return out


def particles(img, band):
    rng = np.random.default_rng(RULES['embers']['seed'])
    ex, ey = RULES['embers']['from']
    embers = []
    for i in range(RULES['embers']['n']):
        # carried right by the same wind as the gust, rising 0.5 to 2 tiles
        t = (i + 1) / RULES['embers']['n']
        x = int(ex + 40 + 70 * t + rng.integers(-6, 7))
        y = int(ey - 30 - 90 * t + rng.integers(-8, 9))
        embers.append((x, y))
        put(img, x, y, '#f8de62' if i % 2 == 0 else '#eda83a', 1.0, RULES['embers']['size'])
    rng = np.random.default_rng(RULES['motes']['seed'])
    pts = np.argwhere(band & ~PMASK)
    motes = []
    for i in rng.choice(len(pts), RULES['motes']['n'], replace=False):
        y, x = pts[i]
        motes.append((int(x), int(y)))
        put(img, int(x), int(y), RULES['motes']['tint'], RULES['motes']['pct'] / 100.0, RULES['motes']['size'])
    rng = np.random.default_rng(RULES['fireflies']['seed'])
    flies = []
    for i in range(RULES['fireflies']['n']):
        x = int(rng.integers(20, W - 20))
        y = int(rng.integers(800, 836))
        flies.append((x, y))
        for dx, dy in [(-1, 0), (-1, 1), (2, 0), (2, 1), (0, -1), (1, -1), (0, 2), (1, 2)]:
            put(img, x + dx, y + dy, RULES['fireflies']['halo'], RULES['fireflies']['halo_pct'] / 100.0)
        put(img, x, y, RULES['fireflies']['core'], 1.0, 2)
    return img, {'embers': embers, 'motes': motes, 'fireflies': flies}


def still_a():
    return wash(base.copy())


def still_b():
    img = wash(base.copy())
    img = pools(img)
    img = lit_window(img)
    return body_light(img)


def still_c():
    img = wash(base.copy())
    img, shade = clouds(img)
    img = gust(img)
    img = pools(img, flicker=True)
    img = lit_window(img)
    img = body_light(img)
    img, band = shaft(img, shade)
    img, placed = particles(img, band)
    return img, placed


def save(arr, path):
    im = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8))
    n = len(im.getcolors(1 << 20) or [])
    print(path.name, 'colours', n, file=sys.stderr)
    if n > 256:
        im.save(path, optimize=True)
        return path.stat().st_size
    q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(path, optimize=True)
    return path.stat().st_size


OUT.mkdir(parents=True, exist_ok=True)
a = still_a()
b = still_b()
c, placed = still_c()
sizes = {}
for tag, arr in (('A', a), ('B', b), ('C', c)):
    sizes[tag] = save(arr, OUT / f'2026-10-30-lighting-{tag}.png')

# the side by side: three thirds at 1x, with a label strip
strip = 64
sheet = Image.new('RGB', (W * 3, H + strip), tuple(int(v) for v in hexc('#1b1a2e')))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except OSError:
    font = ImageFont.load_default()
labels = ['A  tint by hour', 'B  + light pools, body light', 'C  + cloud shade, motion']
for i, arr in enumerate((a, b, c)):
    small = Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8)).resize((W, H), Image.NEAREST)
    sheet.paste(small, (i * W, strip))
    draw.text((i * W + 12, 18), labels[i], fill=tuple(int(v) for v in hexc('#f5f4ef')), font=font)
sheet.save(OUT / '2026-10-30-lighting-A-B-C.png', optimize=True)
sizes['A-B-C'] = (OUT / '2026-10-30-lighting-A-B-C.png').stat().st_size
print(json.dumps({'sizes': sizes, 'placed': placed, 'player_px': int(PMASK.sum())}, default=str))
