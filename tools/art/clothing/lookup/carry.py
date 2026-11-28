"""Step 4 of the lookup trial: carry a piece through a frame's body map, and measure the bars L2-L6 on the result.

A piece is an RGBA layer on the stand frame (pieces.py). A body map `src[y, x] = (sy, sx)` says where each frame body pixel comes
from. The carried layer takes, at each frame pixel, the piece's pixel at its source - nothing is drawn. A piece pixel that sits
outside the stand body (a hem, a cuff) goes where the nearest body pixel goes. Holes (a body pixel inside the garment that no source
reaches) are counted and left as they are. Python 3 with numpy only.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import bars  # noqa: E402

F = common.FRAME


def displacements(src, stand):
    """For each stand body pixel q, the shift (dy, dx) of the frame pixels that take their colour from it (rounded mean), and whether
    any does. Returns (dy, dx, valid), each F x F."""
    ys, xs = np.nonzero(src[..., 0] >= 0)
    sy, sx = src[ys, xs, 0], src[ys, xs, 1]
    cnt = np.zeros((F, F))
    sdy = np.zeros((F, F))
    sdx = np.zeros((F, F))
    np.add.at(cnt, (sy, sx), 1)
    np.add.at(sdy, (sy, sx), ys - sy)
    np.add.at(sdx, (sy, sx), xs - sx)
    valid = cnt > 0
    n = np.maximum(cnt, 1)
    return np.round(sdy / n).astype(int), np.round(sdx / n).astype(int), valid


def limit_use(src, max_use):
    """A source pixel may colour at most `max_use` frame pixels (the ones nearest the middle of those that take it): a limb drawn longer
    than the stand's would otherwise repeat one row of the piece along it. The pixels let go become holes of the map, counted as such."""
    if max_use is None:
        return src
    out = src.copy()
    ys, xs = np.nonzero(src[..., 0] >= 0)
    key = src[ys, xs, 0] * F + src[ys, xs, 1]
    order = np.argsort(key, kind='stable')
    ys, xs, key = ys[order], xs[order], key[order]
    starts = np.nonzero(np.r_[True, key[1:] != key[:-1]])[0]
    ends = np.r_[starts[1:], len(key)]
    for a, b in zip(starts, ends):
        if b - a > max_use:
            gy, gx = ys[a:b], xs[a:b]
            d = (gy - np.median(gy)) ** 2 + (gx - np.median(gx)) ** 2
            drop = np.argsort(d, kind='stable')[max_use:]
            out[gy[drop], gx[drop]] = -1
    return out


def carry(piece, stand, src, max_use=None):
    """The piece's layer on the frame (RGBA), and a dict with `dropped` (piece pixels on the stand body that no frame pixel takes)."""
    src = limit_use(src, max_use)
    layer = np.zeros((F, F, 4), np.uint8)
    pa = piece[..., 3] > 0
    ys, xs = np.nonzero(src[..., 0] >= 0)
    sy, sx = src[ys, xs, 0], src[ys, xs, 1]
    take = pa[sy, sx]
    layer[ys[take], xs[take]] = piece[sy[take], sx[take]]
    # pieces outside the stand body ride with the nearest body pixel that moves
    body = stand[..., 3] > 0
    dy, dx, valid = displacements(src, stand)
    oy, ox = np.nonzero(pa & ~body)
    vy, vx = np.nonzero(valid)
    if len(oy) and len(vy):
        for y, x in zip(oy, ox):
            k = int(((vy - y) ** 2 + (vx - x) ** 2).argmin())
            py, px = y + dy[vy[k], vx[k]], x + dx[vy[k], vx[k]]
            if 0 <= py < F and 0 <= px < F and layer[py, px, 3] == 0:
                layer[py, px] = piece[y, x]
    taken = np.zeros((F, F), bool)
    taken[sy, sx] = True
    dropped = int((pa & body & ~taken).sum())
    return layer, dict(dropped=dropped)


def despeckle(layer, min_px=4):
    """Remove carried pieces of the layer smaller than `min_px` (8-connected): stray pixels a wrong source left. Returns (layer, removed px)."""
    m = layer[..., 3] > 0
    seen = np.zeros_like(m)
    out = layer.copy()
    removed = 0
    for y0, x0 in zip(*np.nonzero(m)):
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
                    if 0 <= yy < F and 0 <= xx < F and m[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        st.append((yy, xx))
        if len(pts) < min_px:
            for y, x in pts:
                out[y, x] = 0
            removed += len(pts)
    return out, removed


def dress(frame, layer):
    out = frame.copy()
    m = layer[..., 3] > 0
    out[m] = layer[m]
    return out


REACH = 8


def holes(frame, src, layer):
    """(holes inside the garment, body holes in all). A body pixel no source reaches is a hole; it is inside the garment when the carried
    piece has a pixel on both sides of it within REACH px along its row, or along its column."""
    fo = frame[..., 3] > 0
    pm = layer[..., 3] > 0
    gap = fo & (src[..., 0] < 0) & ~pm
    inside = 0
    for y, x in zip(*np.nonzero(gap)):
        row, col = pm[y], pm[:, x]
        if (row[max(0, x - REACH):x].any() and row[x + 1:x + 1 + REACH].any()) or (col[max(0, y - REACH):y].any() and col[y + 1:y + 1 + REACH].any()):
            inside += 1
    return inside, int((fo & (src[..., 0] < 0)).sum())


def measure(frame, layer, src, palette=None):
    """The per-frame numbers of the bars: piece pixels, outside the body outline, in the face box, share on the palette, holes."""
    pm = layer[..., 3] > 0
    n = int(pm.sum())
    fo = frame[..., 3] > 0
    outside = int((pm & ~fo).sum())
    lm = bars.landmarks(frame, 'front')
    fb = bars.face_mask(lm, frame.shape)
    face = int((pm & fb).sum())
    pal = common.palette() if palette is None else palette
    on = common.on_palette(layer[..., :3], pm, pal)
    hole_in, hole_all = holes(frame, src, layer)
    return dict(px=n, outside=outside, outside_share=(outside / n if n else 0.0), face_px=face, on_palette=on, holes_in_piece=hole_in, holes_body=hole_all)
