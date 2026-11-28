"""Family 2 of round 2 (public #952): a body map from the pose read off the picture.

Each part of the stand frame (parts.py) moves to the frame by the move its keypoints make: a limb bone (shoulder-elbow, elbow-wrist,
wrist-hand tip, hip-knee, knee-ankle) by a turn, a stretch along the bone only (a foreshortened limb is shorter, never thinner),
and a shift; the head, the trunk, the pelvis and the feet by the least-squares turn, scale and shift of their points. Every frame body
pixel looks back through the moves of the parts whose bones are near it, and takes the stand pixel that lands on a body pixel of that
part with the nearest colour: an inverse nearest-neighbour lookup, so a turned limb copies the stand's own pixels and makes none.
Python 3 with numpy only (the keypoints come from pose.py or a test).
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import parts  # noqa: E402
import partmap  # noqa: E402

F = common.FRAME
LIMB = {'arm_l': (5, 7), 'arm_r': (6, 8), 'fore_l': (7, 9), 'fore_r': (8, 10), 'hand_l': (9, 'hl'), 'hand_r': (10, 'hr'),
        'thigh_l': (11, 13), 'thigh_r': (12, 14), 'shin_l': (13, 15), 'shin_r': (14, 16)}
BLOCK = {'head': [0, 1, 2, 3, 4, 17, 18], 'torso': [5, 6, 11, 12, 18, 19], 'pelvis': [11, 12, 19],
         'foot_l': [15, 20, 22, 24], 'foot_r': [16, 21, 23, 25]}
STRETCH = (0.6, 1.6)
SCALE = (0.7, 1.4)
NEAR = 3.0          # px: parts whose bone lies within this of the nearest bone are candidates for a pixel
COLOUR_W = 1.0
BONE_W = 4.0        # cost per px of bone distance (in units of 20 CIELAB)


def limb_inverse(ps, pf, a, b, py, px, stretch=STRETCH):
    """Stand coordinates of frame pixels (py, px) under the limb move a-b (points dicts as (x, y))."""
    vs, vf = ps[b] - ps[a], pf[b] - pf[a]
    ls, lf = np.hypot(*vs), np.hypot(*vf)
    if ls < 1e-6 or lf < 1e-6:
        return py - (pf[a][1] - ps[a][1]), px - (pf[a][0] - ps[a][0])
    us, uf = vs / ls, vf / lf
    ws, wf = np.array([-us[1], us[0]]), np.array([-uf[1], uf[0]])
    r = np.clip(lf / ls, *stretch)
    dx, dy = px - pf[a][0], py - pf[a][1]
    al = (dx * uf[0] + dy * uf[1]) / r
    be = dx * wf[0] + dy * wf[1]
    sx = ps[a][0] + al * us[0] + be * ws[0]
    sy = ps[a][1] + al * us[1] + be * ws[1]
    return sy, sx


def block_inverse(ps, pf, idx, py, px):
    """Stand coordinates of frame pixels under the similarity (turn, scale, shift) fitted on the block's points."""
    q = np.array([ps[i] for i in idx])
    p = np.array([pf[i] for i in idx])
    qc, pc = q.mean(0), p.mean(0)
    H = (q - qc).T @ (p - pc)
    U, _, Vt = np.linalg.svd(H)
    R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[-1] *= -1
        R = Vt.T @ U.T
    s = np.sqrt(((p - pc) ** 2).sum() / max(((q - qc) ** 2).sum(), 1e-9))
    s = float(np.clip(s, *SCALE))
    pts = np.stack([px, py], -1) - pc
    back = (pts / s) @ R + qc
    return back[:, 1], back[:, 0]


GATE = {'torso': [5, 6, 12, 11], 'pelvis': [11, 12, 19], 'head': [3, 17, 4, 0]}


def inside_hull(py, px, pts, margin):
    """Pixels within `margin` px of the convex hull of pts ((x, y) list)."""
    P = np.array(pts, float)
    c = P.mean(0)
    ang = np.arctan2(P[:, 1] - c[1], P[:, 0] - c[0])
    P = P[np.argsort(ang)]
    inside = np.ones(len(py), bool)
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        nx, ny = b[1] - a[1], -(b[0] - a[0])          # outward normal for counter-clockwise order (y down: check sign)
        L = np.hypot(nx, ny)
        if L < 1e-9:
            continue
        sgn = np.sign((c[0] - a[0]) * nx + (c[1] - a[1]) * ny)
        d = ((px - a[0]) * nx + (py - a[1]) * ny) / L * (-sgn)
        inside &= d <= margin
    return inside


def patch_lab(lab, op, k=3):
    """Mean CIELAB over the k x k opaque neighbourhood of each pixel."""
    w = op.astype(float)
    num = np.stack([densemap_box(lab[..., i] * w, k) for i in range(3)], -1)
    den = densemap_box(w, k)[..., None]
    return num / np.maximum(den, 1e-6)


def densemap_box(a, k):
    p = k // 2
    c = np.pad(a, ((p + 1, p), (p + 1, p))).cumsum(0).cumsum(1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def fit(stand, frame, frame_kp, near=NEAR, colour_w=COLOUR_W, bone_w=BONE_W, stretch=STRETCH, gate=0.0, patch=1, head_only=None):
    """The map src (F, F, 2) of a frame from the stand (route2.Stand: frame, body, kp, lab) and the frame's keypoints.
    Tuning (round 2, one round): `stretch` bounds the limb stretch, `gate` > 0 keeps the trunk, pelvis and head lookups to pixels
    within that many px of their keypoints' outline, `patch` > 1 compares colours over a patch, `head_only` (F x F bool, the face box
    carried to the frame) lets the pixels inside it look up the head only (a head lowered between the shoulders stays a head)."""
    ps, pf = parts.points(stand.kp), parts.points(frame_kp)
    fo = frame[..., 3] > 0
    ys, xs = np.nonzero(fo)
    n = len(ys)
    bd = parts.bone_distances(frame_kp, ys, xs)                     # (parts, n)
    cand = bd <= bd.min(0, keepdims=True) + near
    if head_only is not None:
        inside = head_only[ys, xs]
        hk = parts.NAMES.index('head')
        cand[:, inside] = False
        cand[hk, inside] = True
    st_lab = partmap.lab_frame(stand.frame)
    fr_lab_full = partmap.lab_frame(frame)
    if patch > 1:
        st_lab = patch_lab(st_lab, stand.body, patch)
        fr_lab_full = patch_lab(fr_lab_full, fo, patch)
    fr_lab = fr_lab_full[ys, xs]
    best = np.full(n, np.inf)
    out_y = np.full(n, -1)
    out_x = np.full(n, -1)
    for k, name in enumerate(parts.NAMES):
        sel = np.nonzero(cand[k])[0]
        if gate > 0 and name in GATE and len(sel):
            sel = sel[inside_hull(ys[sel].astype(float), xs[sel].astype(float), [pf[i] for i in GATE[name]], gate)]
        if not len(sel):
            continue
        py, px = ys[sel].astype(float), xs[sel].astype(float)
        if name in LIMB:
            a, b = LIMB[name]
            sy, sx = limb_inverse(ps, pf, a, b, py, px, stretch)
        else:
            sy, sx = block_inverse(ps, pf, BLOCK[name], py, px)
        sy, sx = np.round(sy).astype(int), np.round(sx).astype(int)
        ok = (sy >= 0) & (sy < F) & (sx >= 0) & (sx < F)
        sy, sx = np.clip(sy, 0, F - 1), np.clip(sx, 0, F - 1)
        lab_ok = np.array([parts.neighbours(name, parts.NAMES[l]) if l >= 0 else False for l in stand.lab[sy, sx]], bool)
        ok &= stand.body[sy, sx] & lab_ok
        cdist = np.sqrt(((st_lab[sy, sx] - fr_lab[sel]) ** 2).sum(-1)) / 20.0
        cost = colour_w * cdist + bone_w * np.maximum(bd[k, sel] - bd[:, sel].min(0), 0) / max(near, 1e-6)
        cost[~ok] = np.inf
        upd = cost < best[sel]
        best[sel[upd]] = cost[upd]
        out_y[sel[upd]] = sy[upd]
        out_x[sel[upd]] = sx[upd]
    src = np.full((F, F, 2), -1, int)
    good = out_y >= 0
    src[ys[good], xs[good]] = np.stack([out_y[good], out_x[good]], -1)
    return src
