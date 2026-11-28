"""Step 2 of the lookup trial: a Gemini piece, cut out of its cell and brought onto the game's B stand frame.

  pieces.py [--out DIR]

The cell is a picture from outside the game (the owner's Gemini account, from the bare B body, public #952): the figure in it is
about 4 source pixels to one game pixel. Three things are done, none of them drawing:
  1 register   the cell is laid on the stand frame by a scale and a shift found by the overlap of the two skin masks (the bare
               head, torso and limbs that both pictures show); the overlap and the misfit in pixels are reported
  2 cut        the piece is the cell's pixels that a colour rule picks (a rule per piece, written below, read from looking at the
               cell) inside a region of the body; the rule is the only judgement, and it is printed
  3 snap       the piece is area-averaged onto the game grid (a game pixel is a piece pixel when at least half of its source block
               is), and every colour goes to the nearest of the core 32 and the human ramps (CIELAB)
Python 3 with numpy and Pillow only.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import bars  # noqa: E402

IN = os.path.join(common.REPO, '.scratch', 'clothing-lookup', 'in')
SHEET = 'human-mid-pieces.png'
BG = np.array([234, 232, 233])
CELLS = {'cap': (0, 0), 'shirt': (0, 1), 'trousers': (0, 2), 'gloves': (1, 0), 'boots': (1, 1), 'belt': (1, 2)}


def cell_image(name):
    g = Image.open(os.path.join(IN, SHEET)).convert('RGB')
    W, H = g.size
    r, c = CELLS[name]
    return np.array(g.crop((c * W // 3, r * H // 2, (c + 1) * W // 3, (r + 1) * H // 2)))


def hsv(rgb):
    r, g, b = [rgb[..., i].astype(float) / 255 for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = (mx - mn) / np.maximum(mx, 1e-6)
    return h, s, mx


def figure_mask(cell):
    return np.abs(cell.astype(int) - BG).sum(-1) > 40


PAD = 400


def resample(arr, s, ox, oy, size=common.FRAME):
    """Area-average (BOX) of `arr` (float32 H x W x C, zero outside) where game pixel (i, j) covers source [ox + j*s, ox + (j+1)*s) x
    [oy + i*s, ...). The source is padded with zeros so the window may leave it."""
    padded = np.pad(arr, ((PAD, PAD), (PAD, PAD), (0, 0)))
    out = []
    for ch in range(arr.shape[2]):
        im = Image.fromarray(np.ascontiguousarray(padded[..., ch]), 'F')
        b = (ox + PAD, oy + PAD, ox + PAD + size * s, oy + PAD + size * s)
        out.append(np.array(im.resize((size, size), Image.BOX, box=b)))
    return np.stack(out, -1)


def register(cell, stand):
    """Scale s (source px per game px) and offset (ox, oy) in source px laying the cell on the stand frame: best overlap (IoU) of
    the skin masks. Returns (s, ox, oy, iou)."""
    cs = (bars.is_skin(cell) & figure_mask(cell)).astype(np.float32)[..., None]
    ss = bars.is_skin(stand[..., :3]) & (stand[..., 3] > 0)
    ys, xs = np.nonzero(figure_mask(cell))
    # the figure's box centre in the cell is the first guess for the offset
    best = (0, None)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    sy, sx = np.nonzero(stand[..., 3] > 0)
    gx, gy = (sx.min() + sx.max() + 1) / 2, (sy.min() + sy.max() + 1) / 2
    for s in np.arange(3.80, 4.12, 0.02):
        ox0, oy0 = cx - gx * s, cy - gy * s
        for dy in range(-10, 11, 2):
            for dx in range(-10, 11, 2):
                m = resample(cs, s, ox0 + dx, oy0 + dy)[..., 0] >= 0.5
                iou = (m & ss).sum() / max(1, (m | ss).sum())
                if iou > best[0]:
                    best = (iou, (s, ox0 + dx, oy0 + dy))
    iou, (s, ox, oy) = best
    # refine around the best, finer steps
    for _ in range(2):
        for ds in (-0.01, 0, 0.01):
            for dy in (-1.0, -0.5, 0, 0.5, 1.0):
                for dx in (-1.0, -0.5, 0, 0.5, 1.0):
                    m = resample(cs, s + ds, ox + dx, oy + dy)[..., 0] >= 0.5
                    v = (m & ss).sum() / max(1, (m | ss).sum())
                    if v > iou:
                        iou, best = v, (v, (s + ds, ox + dx, oy + dy))
        iou, (s, ox, oy) = best
    return s, ox, oy, iou


# ---- the colour rules, one per piece, written from looking at the cell (the judgement of this step) ----
# A rule gets the cell (H x W x 3), its hue, saturation, value, and the cell's column of the body's middle and the source pixels
# per game pixel; it returns the boolean mask of the piece in the cell.
STRICT_GREEN = lambda h, s, v: (h >= 70) & (h <= 190) & (s >= 0.12) & (v <= 0.55)     # the cloth's clearly green pixels


def rows_of(mask, margin=0):
    ys = np.nonzero(mask.any(1))[0]
    return int(ys.min()) - margin, int(ys.max()) + margin


def rule_trousers(cell, h, s, v, cx, sp):
    """Cloth: the strict green pixels give the rows (waistband to cuff); inside them every figure pixel that is not skin is cloth (the
    cloth's shades are dark grey-green, the cuffs' ink and the folds), because the cell shows no shorts under trousers."""
    fm = figure_mask(cell)
    strict = STRICT_GREEN(h, s, v) & fm
    y0, y1 = rows_of(strict, 1)
    m = fm & ~bars.is_skin(cell) & (v <= 0.62)               # not the bright blend of the cell's edge with its background
    m[:y0] = False
    m[y1 + 1:] = False
    xs = np.arange(cell.shape[1])[None, :]
    m &= np.abs(xs - cx) <= 17 * sp                          # the hands hang at 22 px and more from the middle
    return m


def rule_gloves(cell, h, s, v, cx, sp):
    """Dark leather, steel studs and cuffs, at the sides of the body only (|dx| above 14 game px from the middle: the torso column holds
    the shorts and the belly's shade): figure pixels that are not skin and are dark or steel-grey."""
    skin = bars.is_skin(cell)
    dark = v <= 0.50
    steel = (s <= 0.35) & (v >= 0.25) & (v <= 0.85)
    m = figure_mask(cell) & ~skin & (dark | steel)
    xs = np.arange(cell.shape[1])[None, :]
    m &= np.abs(xs - cx) > 14 * sp
    return m


def rule_shirt(cell, h, s, v, cx, sp):
    """Jerkin brown in the torso column (|dx| up to 17 game px), sleeve green anywhere; skin is never cloth."""
    skin = bars.is_skin(cell)
    fm = figure_mask(cell) & ~skin
    xs = np.arange(cell.shape[1])[None, :]
    inner = np.abs(xs - cx) <= 17 * sp
    brown = (h >= 12) & (h <= 40) & (v <= 0.66) & (s >= 0.2)
    dark = v <= 0.30
    return fm & ((STRICT_GREEN(h, s, v)) | (inner & (brown | dark)))


def rule_boots(cell, h, s, v, cx, sp):
    """Leather and fur below the shins (round 2): every figure pixel that is not skin; the region (feet rows) keeps the shorts out."""
    return figure_mask(cell) & ~bars.is_skin(cell) & (v <= 0.85)


def rule_cap(cell, h, s, v, cx, sp):
    """The leather cap (round 2): figure pixels that are not skin, above the brow (the region); the face below the brow is never
    head-wear (DECISIONS 2026-11-20)."""
    return figure_mask(cell) & ~bars.is_skin(cell) & (v <= 0.80)


RULES = {'trousers': rule_trousers, 'gloves': rule_gloves, 'shirt': rule_shirt, 'boots': rule_boots, 'cap': rule_cap}
# region of the body each piece may sit in, as shares of the figure's height from its top row (stand frame rows 22..117):
REGIONS = {'trousers': (0.46, 1.02), 'gloves': (0.38, 0.62), 'shirt': (0.25, 0.60), 'boots': (0.76, 1.03), 'cap': (-0.06, bars.BROW_FRAC)}
MIN_COMPONENT = {'trousers': 20, 'gloves': 12, 'shirt': 40, 'boots': 12, 'cap': 30}


def components(mask):
    """8-connected components of a boolean mask: a list of (n, mask)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        st, pts = [(y0, x0)], []
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        st.append((yy, xx))
        m = np.zeros_like(mask)
        ys, xs = zip(*pts)
        m[list(ys), list(xs)] = True
        out.append((len(pts), m))
    return out


def prune(mask, min_component, strand_neighbours=2):
    """Drop components under `min_component` px, then pixels with fewer than `strand_neighbours` 8-neighbours (loose strands), once."""
    keep = np.zeros_like(mask)
    for n, m in components(mask):
        if n >= min_component:
            keep |= m
    p = np.pad(keep, 1)
    nb = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx].astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0))
    return keep & (nb >= strand_neighbours)


def cut(name):
    stand = common.load_clip('human_hit_front')[0]
    cell = cell_image(name)
    s, ox, oy, iou = register(cell, stand)
    h, sat, v = hsv(cell)
    sy, sx = np.nonzero(stand[..., 3] > 0)
    cx_game = (sx.min() + sx.max() + 1) / 2                  # the stand figure's middle column, game px
    cx = ox + cx_game * s                                    # the same column in the cell
    raw = RULES[name](cell, h, sat, v, cx, s)
    top, bot = bars.rows(stand)
    lo, hi = REGIONS[name]
    r0, r1 = int(round(top + lo * (bot - top + 1))), int(round(top + hi * (bot - top + 1)))
    rgba = np.concatenate([cell.astype(np.float32), raw.astype(np.float32)[..., None]], -1)
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4]              # colour averages over piece pixels only
    rs = resample(pm, s, ox, oy)
    cov = rs[..., 3]
    mask = cov >= 0.5
    mask[:r0] = False
    mask[r1:] = False
    mask = prune(mask, MIN_COMPONENT[name])
    rgb = np.where(cov[..., None] > 0, rs[..., :3] / np.maximum(cov[..., None], 1e-6), 0)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    out = np.zeros((common.FRAME, common.FRAME, 4), np.uint8)
    snapped = common.snap(rgb)
    out[mask, :3] = snapped[mask]
    out[mask, 3] = 255
    cs = (bars.is_skin(cell) & figure_mask(cell)).astype(np.float32)[..., None]
    cell_skin = resample(cs, s, ox, oy)[..., 0] >= 0.5
    ss = bars.is_skin(stand[..., :3]) & (stand[..., 3] > 0)
    info = dict(piece=name, scale=round(float(s), 3), offset=(round(float(ox), 1), round(float(oy), 1)), skin_iou=round(float(iou), 3),
                rows=(r0, r1), px=int(mask.sum()), skin_misfit_px=int((cell_skin ^ ss).sum()), skin_px=int(ss.sum()))
    return out, info, stand


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(common.REPO, '.scratch', 'clothing-lookup', 'work', 'pieces'))
    ap.add_argument('names', nargs='*', default=['trousers', 'gloves', 'shirt'])
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for n in a.names:
        out, info, stand = cut(n)
        common.save_rgba(out, os.path.join(a.out, n + '.png'))
        print(info)


if __name__ == '__main__':
    main()
