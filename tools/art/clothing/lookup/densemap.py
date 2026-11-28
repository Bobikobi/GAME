"""Step 3, method (b) of the lookup trial: a dense body map by patch matching between the stand frame and each frame.

For every body pixel p of a frame, the stand-frame pixel q = p + d whose PATCH x PATCH neighbourhood (colour in CIELAB, and empty or
not) matches best, with a small pull towards the global shift of the whole figure (so a flat patch of skin takes the nearest answer
rather than any); then each pixel takes the median of the shifts around it (SMOOTH passes) so neighbours move together. The map is
`src[y, x] = (sy, sx)` as in partmap.py. Python 3 with numpy only.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import partmap  # noqa: E402

F = common.FRAME
PATCH = 7
R = 34
LAMBDA = 0.6
SMOOTH = 2


def box(a, k):
    """Mean over k x k windows (same shape, zero padded) of a (H, W) array."""
    p = k // 2
    c = np.pad(a, ((p + 1, p), (p + 1, p))).cumsum(0).cumsum(1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def fit(stand, frame, patch=PATCH, radius=R, lam=LAMBDA, smooth=SMOOTH, glob=None):
    """Dense shifts d(p) for the frame's body pixels: returns the map src (F, F, 2) of the stand pixel each body pixel comes from."""
    st_op = stand[..., 3] > 0
    fr_op = frame[..., 3] > 0
    st_lab = partmap.lab_frame(stand)
    fr_lab = partmap.lab_frame(frame)
    # the global shift: the silhouette overlap's best
    g = partmap.fit(stand, frame, root_radius=34)['torso'] if glob is None else (0, glob[0], glob[1])
    gdy, gdx = g[1], g[2]
    # d is the shift from the STAND to the frame, so the stand pixel for frame pixel p is p - d
    pad = 2 * radius + 40
    st_lab_p = np.pad(st_lab, ((pad, pad), (pad, pad), (0, 0)))
    st_op_p = np.pad(st_op, pad)
    best = np.full((F, F), 1e9)
    bdy = np.zeros((F, F), int)
    bdx = np.zeros((F, F), int)
    for dy in range(gdy - radius, gdy + radius + 1):
        for dx in range(gdx - radius, gdx + radius + 1):
            if abs(dy) > pad - 2 or abs(dx) > pad - 2:
                continue
            sl = (slice(pad - dy, pad - dy + F), slice(pad - dx, pad - dx + F))
            q_lab = st_lab_p[sl]
            q_op = st_op_p[sl]
            diff = np.where(fr_op & q_op, np.minimum(((fr_lab - q_lab) ** 2).sum(-1) / 400.0, 1.0), (fr_op != q_op).astype(float))
            c = box(diff, patch)
            c = c + lam * ((dy - gdy) ** 2 + (dx - gdx) ** 2) / (radius ** 2) * 0.02 * patch * 0 + lam * (np.hypot(dy - gdy, dx - gdx) / radius) * 0.1
            upd = c < best
            best[upd] = c[upd]
            bdy[upd] = dy
            bdx[upd] = dx
    # median smoothing of the shifts over the body, a few passes
    for _ in range(smooth):
        ny, nx = bdy.copy(), bdx.copy()
        ys, xs = np.nonzero(fr_op)
        for y, x in zip(ys, xs):
            y0, y1, x0, x1 = max(y - 2, 0), min(y + 3, F), max(x - 2, 0), min(x + 3, F)
            m = fr_op[y0:y1, x0:x1]
            ny[y, x] = int(np.median(bdy[y0:y1, x0:x1][m]))
            nx[y, x] = int(np.median(bdx[y0:y1, x0:x1][m]))
        bdy, bdx = ny, nx
    src = np.full((F, F, 2), -1, int)
    ys, xs = np.nonzero(fr_op)
    sy, sx = ys - bdy[ys, xs], xs - bdx[ys, xs]
    ok = (sy >= 0) & (sy < F) & (sx >= 0) & (sx < F)
    ok[ok] = st_op[sy[ok], sx[ok]]
    src[ys[ok], xs[ok]] = np.stack([sy[ok], sx[ok]], -1)
    return src


def chain(stand, frames, radius=12, **kw):
    """Maps of a clip by tracking: each frame is matched to the frame before it (small moves, so a hand stays a hand), and the maps are
    composed back to the stand frame: src_k[p] = src_{k-1}[ pair_k[p] ]. Frame 0 is matched to the stand frame directly (radius R)."""
    maps = [fit(stand, frames[0])]
    for k in range(1, len(frames)):
        pair = fit(frames[k - 1], frames[k], radius=radius, **kw)
        prev = maps[-1]
        cur = np.full((F, F, 2), -1, int)
        ok = pair[..., 0] >= 0
        ys, xs = np.nonzero(ok)
        q = pair[ys, xs]
        s = prev[q[:, 0], q[:, 1]]
        good = s[:, 0] >= 0
        cur[ys[good], xs[good]] = s[good]
        maps.append(cur)
    return maps


def refine(stand, frame, src, patch=PATCH, radius=2, lam=0.15, smooth=1):
    """Anchor a map to the stand frame: every body pixel may take a source up to `radius` px from the one the map gave it, by the
    patch cost against the STAND frame (a window shares one shift), with a pull towards the map's own answer. Frames then do not
    inherit the drift of the chain; the radius keeps a hand a hand."""
    st_op = stand[..., 3] > 0
    fr_op = frame[..., 3] > 0
    st_lab = partmap.lab_frame(stand)
    fr_lab = partmap.lab_frame(frame)
    has = src[..., 0] >= 0
    qy = np.where(has, src[..., 0], 0)
    qx = np.where(has, src[..., 1], 0)
    best = np.full((F, F), 1e9)
    bdy = np.zeros((F, F), int)
    bdx = np.zeros((F, F), int)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            ny, nx = qy + dy, qx + dx
            ins = (ny >= 0) & (ny < F) & (nx >= 0) & (nx < F)
            ny, nx = np.clip(ny, 0, F - 1), np.clip(nx, 0, F - 1)
            q_op = st_op[ny, nx] & ins & has
            diff = np.where(fr_op & q_op, np.minimum(((fr_lab - st_lab[ny, nx]) ** 2).sum(-1) / 400.0, 1.0), (fr_op != q_op).astype(float))
            c = box(diff, patch) + lam * np.hypot(dy, dx) / max(radius, 1) * 0.3
            upd = c < best
            best[upd] = c[upd]
            bdy[upd] = dy
            bdx[upd] = dx
    for _ in range(smooth):
        ny, nx = bdy.copy(), bdx.copy()
        ys, xs = np.nonzero(fr_op & has)
        for y, x in zip(ys, xs):
            y0, y1, x0, x1 = max(y - 1, 0), min(y + 2, F), max(x - 1, 0), min(x + 2, F)
            m = (fr_op & has)[y0:y1, x0:x1]
            ny[y, x] = int(np.median(bdy[y0:y1, x0:x1][m]))
            nx[y, x] = int(np.median(bdx[y0:y1, x0:x1][m]))
        bdy, bdx = ny, nx
    out = np.full((F, F, 2), -1, int)
    ys, xs = np.nonzero(fr_op & has)
    sy, sx = qy[ys, xs] + bdy[ys, xs], qx[ys, xs] + bdx[ys, xs]
    ok = (sy >= 0) & (sy < F) & (sx >= 0) & (sx < F)
    ok[ok] = st_op[sy[ok], sx[ok]]
    out[ys[ok], xs[ok]] = np.stack([sy[ok], sx[ok]], -1)
    return out


def chain_anchored(stand, frames, radius=12, rradius=2, **kw):
    """The chain, with each frame's composed map refined against the stand frame before it is passed on."""
    maps = [fit(stand, frames[0])]
    for k in range(1, len(frames)):
        pair = fit(frames[k - 1], frames[k], radius=radius, **kw)
        prev = maps[-1]
        cur = np.full((F, F, 2), -1, int)
        ys, xs = np.nonzero(pair[..., 0] >= 0)
        q = pair[ys, xs]
        s = prev[q[:, 0], q[:, 1]]
        good = s[:, 0] >= 0
        cur[ys[good], xs[good]] = s[good]
        maps.append(refine(stand, frames[k], cur, radius=rradius))
    return maps


def exact_share(stand, frame, src):
    ok = src[..., 0] >= 0
    rec = np.zeros_like(frame)
    rec[ok] = stand[src[ok][:, 0], src[ok][:, 1]]
    fo = frame[..., 3] > 0
    return float(((rec[..., :3] == frame[..., :3]).all(-1) & (rec[..., 3] > 0) & fo).sum() / max(1, fo.sum()))


def compose(prev_map, pair):
    """Map of a frame from the map of its neighbour and the pair map (frame pixel -> neighbour pixel)."""
    cur = np.full((F, F, 2), -1, int)
    ys, xs = np.nonzero(pair[..., 0] >= 0)
    q = pair[ys, xs]
    s = prev_map[q[:, 0], q[:, 1]]
    good = s[:, 0] >= 0
    cur[ys[good], xs[good]] = s[good]
    return cur


def chain_bi(stand, frames, direct_radius=10, pair_radius=12, anchor_exact=0.85, rradius=2, report=None, cache=None):
    """Tracking from the nearest anchor. A direct map (stand -> frame, window round the figure's global shift) is made for every frame;
    frames it rebuilds at `anchor_exact` or better (their pose is the stand pose) are anchors and keep it. Every other frame takes the
    maps of its neighbours composed from the nearer anchor, forward or backward in time, and is then anchored by `refine`."""
    n = len(frames)
    def cached(key, make):
        if cache is None:
            return make()
        path = f'{cache}.{key}.npy'
        if os.path.exists(path):
            return np.load(path)
        v = make()
        np.save(path, v)
        return v
    direct = [cached(f'd{k}', lambda f=f: fit(stand, f, radius=direct_radius)) for k, f in enumerate(frames)]
    ex = [exact_share(stand, f, m) for f, m in zip(frames, direct)]
    anchors = [k for k in range(n) if ex[k] >= anchor_exact]
    if not anchors:
        anchors = [int(np.argmax(ex))]
    maps = [None] * n
    for k in anchors:
        maps[k] = direct[k]
    pair_prev = {}     # frame k -> pull from k-1
    pair_next = {}
    def pp(k):
        if k not in pair_prev:
            pair_prev[k] = cached(f'p{k}', lambda: fit(frames[k - 1], frames[k], radius=pair_radius))
        return pair_prev[k]
    def pn(k):
        if k not in pair_next:
            pair_next[k] = cached(f'n{k}', lambda: fit(frames[k + 1], frames[k], radius=pair_radius))
        return pair_next[k]
    how = {}
    for k in range(n):
        if maps[k] is not None:
            how[k] = 'anchor'
    # forward and backward tracks from the anchors, each frame takes the nearer
    fwd, bwd = {}, {}
    for a in anchors:
        cur = direct[a]
        for k in range(a + 1, n):
            if k in anchors:
                break
            cur = refine(stand, frames[k], compose(cur, pp(k)), radius=rradius)
            fwd[k] = (k - a, cur)
    for a in reversed(anchors):
        cur = direct[a]
        for k in range(a - 1, -1, -1):
            if k in anchors:
                break
            cur = refine(stand, frames[k], compose(cur, pn(k)), radius=rradius)
            bwd[k] = (a - k, cur)
    for k in range(n):
        if maps[k] is not None:
            continue
        opts = [x for x in (fwd.get(k), bwd.get(k)) if x is not None]
        d, m = min(opts, key=lambda t: t[0])
        maps[k] = m
        how[k] = f'track {d}'
    if report is not None:
        report.update(anchors=anchors, direct_exact=ex, how=how)
    return maps
