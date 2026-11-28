"""Step 3, method (a) of the lookup trial: a body map per frame from per-limb parts of the B stand frame.

The parts (head, torso, pelvis, upper arms, forearms and hands, thighs, shins and feet) are cut from the stand frame once, by rules on
its coordinates (PART_OF), and each frame is searched for them: hierarchically (torso first, then what hangs from it), each part by
its own shift - and, in the rotating variant, by a rotation about its joint, nearest-neighbour, so no pixel is invented. A part's
score is how many of its pixels land on a frame pixel of the same colour family (CIELAB distance), less a penalty for landing on
another colour and a larger one for landing on empty. The result is a map: for each frame pixel, the stand-frame pixel it comes from
(or -1). Python 3 with numpy and Pillow only.
"""
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import bars  # noqa: E402

F = common.FRAME

# part: (parent, pivot (x, y) on the stand frame, z (higher is drawn later), rotation limit in degrees)
PARTS = {
    'torso': (None, (64, 62), 4, 8),
    'head': ('torso', (64, 49), 6, 20),
    'pelvis': ('torso', (64, 74), 3, 8),
    'arm_l': ('torso', (50, 55), 5, 70),
    'arm_r': ('torso', (79, 55), 5, 70),
    'fore_l': ('arm_l', (46, 70), 5.5, 70),
    'fore_r': ('arm_r', (82, 70), 5.5, 70),
    'thigh_l': ('pelvis', (58, 90), 2, 60),
    'thigh_r': ('pelvis', (70, 90), 2, 60),
    'shin_l': ('thigh_l', (57, 102), 1, 60),
    'shin_r': ('thigh_r', (71, 102), 1, 60),
}
ORDER = list(PARTS)          # parents before children


def part_of(y, x):
    """The part a stand-frame body pixel belongs to (rules read from the stand frame at 8x: DECISIONS entry of this trial)."""
    if y <= 48:
        return 'head'
    if y <= 89:
        if x <= 51:
            return 'arm_l' if y <= 69 else 'fore_l'
        if x >= 78:
            return 'arm_r' if y <= 69 else 'fore_r'
        return 'torso' if y <= 73 else 'pelvis'
    left = x <= 63
    if y <= 101:
        return 'thigh_l' if left else 'thigh_r'
    return 'shin_l' if left else 'shin_r'


def split(stand):
    """Part pixel lists of the stand frame's body: {name: (ys, xs)}."""
    ys, xs = np.nonzero(stand[..., 3] > 0)
    names = np.array([part_of(y, x) for y, x in zip(ys, xs)])
    return {n: (ys[names == n], xs[names == n]) for n in PARTS}


def lab_frame(a):
    return bars.lab(a[..., :3].reshape(-1, 3)).reshape(F, F, 3)


def rot_grid(limit, step):
    k = int(limit // step)
    return [0.0] + [s * i * step for i in range(1, k + 1) for s in (1, -1)]


def _warp(ys, xs, pivot, theta, dy, dx):
    """Forward nearest-neighbour: pixels (ys, xs) rotated by theta degrees about pivot (x, y), then shifted. Returns integer (y, x)."""
    t = np.deg2rad(theta)
    c, s = np.cos(t), np.sin(t)
    px, py = pivot
    rx = c * (xs - px) - s * (ys - py) + px
    ry = s * (xs - px) + c * (ys - py) + py
    return np.round(ry + dy).astype(int), np.round(rx + dx).astype(int)


def score(part_ys, part_xs, part_lab, ty, tx, f_op, f_lab, de2=400.0, p_other=0.3, p_empty=1.0):
    """Score of one placement: matches - p_other * other colour - p_empty * empty/outside."""
    inside = (ty >= 0) & (ty < F) & (tx >= 0) & (tx < F)
    cy, cx = np.clip(ty, 0, F - 1), np.clip(tx, 0, F - 1)
    op = f_op[cy, cx] & inside
    d = ((f_lab[cy, cx] - part_lab) ** 2).sum(-1)
    match = op & (d <= de2)
    other = op & ~match
    empty = ~op
    return match.sum() - p_other * other.sum() - p_empty * empty.sum()


def fit(stand, frame, rotate=False, step=6.0, radius=5, root_radius=34):
    """Fit all parts of `stand` to `frame`. Returns {name: (theta, dy, dx)} in stand coordinates (rotation about the part's pivot, then shift)."""
    parts = split(stand)
    st_lab = lab_frame(stand)
    f_op = frame[..., 3] > 0
    f_lab = lab_frame(frame)
    fit_ = {}
    for name in ORDER:
        parent, pivot, z, lim = PARTS[name]
        ys, xs = parts[name]
        if len(ys) == 0:
            fit_[name] = (0.0, 0, 0)
            continue
        pl = st_lab[ys, xs]
        if parent is None:
            cands = [(0.0, dy, dx) for dy in range(-root_radius, root_radius + 1) for dx in range(-root_radius, root_radius + 1)]
            thetas = rot_grid(lim, step) if rotate else [0.0]
            cands = [(t, dy, dx) for t in thetas for (_, dy, dx) in cands]
        else:
            pt, pdy, pdx = fit_[parent]
            # where the parent carries this part's pivot
            ppivot = PARTS[parent][1]
            py_, px_ = _warp(np.array([pivot[1]]), np.array([pivot[0]]), ppivot, pt, pdy, pdx)
            by, bx = int(py_[0]) - pivot[1], int(px_[0]) - pivot[0]      # the shift the parent gives the pivot
            thetas = rot_grid(lim, step) if rotate else [0.0]
            cands = [(t, by + dy, bx + dx) for t in thetas for dy in range(-radius, radius + 1) for dx in range(-radius, radius + 1)]
        best, bs = None, -1e9
        # evaluate in chunks by theta (same rotation, many shifts)
        by_theta = {}
        for t, dy, dx in cands:
            by_theta.setdefault(t, []).append((dy, dx))
        for t, shifts in by_theta.items():
            sh = np.array(shifts)
            ry, rx = _warp(ys, xs, pivot, t, 0, 0)
            ty = ry[None, :] + sh[:, 0:1]
            tx = rx[None, :] + sh[:, 1:2]
            inside = (ty >= 0) & (ty < F) & (tx >= 0) & (tx < F)
            cy, cx = np.clip(ty, 0, F - 1), np.clip(tx, 0, F - 1)
            op = f_op[cy, cx] & inside
            d = ((f_lab[cy, cx] - pl[None]) ** 2).sum(-1)
            match = op & (d <= 400.0)
            sc = match.sum(1) - 0.3 * (op & ~match).sum(1) - 1.0 * (~op).sum(1)
            # prefer the small move among equals
            sc = sc - 1e-3 * (np.abs(sh[:, 0]) + np.abs(sh[:, 1])) - 1e-3 * abs(t)
            i = int(sc.argmax())
            if sc[i] > bs:
                bs, best = sc[i], (t, int(sh[i, 0]), int(sh[i, 1]))
        fit_[name] = best
    return fit_


def build_map(stand, fit_, extra=None):
    """The map of a fit: `src[y, x] = (sy, sx)` of the stand pixel each frame pixel comes from, (-1, -1) where no part reaches.
    Parts are drawn in z order, a later part over an earlier one. `extra`: boolean mask of stand pixels outside the body that a piece
    occupies (cuffs, hems); each goes with the nearest body part."""
    parts = split(stand)
    ext = {n: [parts[n][0], parts[n][1]] for n in PARTS}
    if extra is not None:
        ey, ex = np.nonzero(extra & ~(stand[..., 3] > 0))
        if len(ey):
            allp = [(n, parts[n][0], parts[n][1]) for n in PARTS if len(parts[n][0])]
            best = np.full(len(ey), 1e9)
            owner = np.zeros(len(ey), int)
            for k, (n, py, px) in enumerate(allp):
                d = ((ey[:, None] - py[None]) ** 2 + (ex[:, None] - px[None]) ** 2).min(1)
                upd = d < best
                best[upd] = d[upd]
                owner[upd] = k
            for k, (n, _, _) in enumerate(allp):
                sel = owner == k
                ext[n][0] = np.concatenate([ext[n][0], ey[sel]])
                ext[n][1] = np.concatenate([ext[n][1], ex[sel]])
    src = np.full((F, F, 2), -1, int)
    for name in sorted(PARTS, key=lambda n: PARTS[n][2]):
        ys, xs = ext[name]
        if len(ys) == 0:
            continue
        t, dy, dx = fit_[name]
        pivot = PARTS[name][1]
        # forward then close one-pixel cracks a rotation leaves: write each pixel and fill the cell it also touches via inverse lookup
        ty, tx = _warp(ys, xs, pivot, t, dy, dx)
        mask = np.zeros((F, F), bool)
        idx = np.full((F, F), -1, int)
        ok = (ty >= 0) & (ty < F) & (tx >= 0) & (tx < F)
        idx[ty[ok], tx[ok]] = np.nonzero(ok)[0]
        if t != 0.0:
            # inverse sampling for every destination pixel in the box: source = R^-1 (p - shift - pivot) + pivot, nearest
            pm = np.zeros((F, F), bool)
            pm[ys, xs] = True
            y0, y1, x0, x1 = max(ty.min() - 2, 0), min(ty.max() + 3, F), max(tx.min() - 2, 0), min(tx.max() + 3, F)
            gy, gx = np.mgrid[y0:y1, x0:x1]
            tr = np.deg2rad(-t)
            c, s = np.cos(tr), np.sin(tr)
            px, py = pivot
            qx = c * (gx - dx - px) - s * (gy - dy - py) + px
            qy = s * (gx - dx - px) + c * (gy - dy - py) + py
            qy, qx = np.round(qy).astype(int), np.round(qx).astype(int)
            valid = (qy >= 0) & (qy < F) & (qx >= 0) & (qx < F)
            valid[valid] = pm[qy[valid], qx[valid]]
            sy = np.where(valid, qy, -1)
            sx = np.where(valid, qx, -1)
            region = valid
            src[y0:y1, x0:x1][region] = np.stack([sy[region], sx[region]], -1)
        else:
            sel = idx >= 0
            k = idx[sel]
            src[sel] = np.stack([ys[k], xs[k]], -1)
    return src


def timed_map(stand, frames, **kw):
    t0 = time.time()
    maps = []
    fits = []
    for fr in frames:
        f = fit(stand, fr, **kw)
        fits.append(f)
        maps.append(build_map(stand, f))
    return maps, fits, time.time() - t0


def reconstruct(stand, src):
    """Carry the stand frame itself through a map: the frame the map would make of the bare figure (the map's own check)."""
    out = np.zeros((F, F, 4), np.uint8)
    ok = src[..., 0] >= 0
    out[ok] = stand[src[ok][:, 0], src[ok][:, 1]]
    return out
