"""L2b of round 2 (public #952): a piece's overhang told apart from its misfit on the stand frame, and misfit fixed by fitting.

The owner, 28.11: a garment is bigger than the body, so a piece reaching past B's outline is expected. What is wrong is a piece
where B has no limb. On the stand frame, for each piece pixel outside B: its distance to B and the part of the nearest B pixel
(parts.py). Per part the distances make a histogram; the band is where that histogram is still thick (KNEE of its first step),
never more than THICK_MAX. Within the band it is thickness. Misfit is a pixel beyond the band, or one whose nearest body part is
not a place the piece is worn (WEAR). Coverage is the share of the piece's target parts (TARGET) it covers: a glove that sits on the
forearm and leaves the fist bare is misfit too, though nothing of it is outside.

`fit` moves each side of a piece (its pixels grouped by the nearest part's side) by a shift and a scale, nearest neighbour, to raise
coverage and lower misfit: pixels are moved, never drawn. Python 3 with numpy only.
"""
import numpy as np

import parts

F = 128
THICK_MAX = 4.0           # art px at the 128 frame (the figure is 96 tall): no garment is thicker than this past B's outline
KNEE = 0.25               # the band ends where a distance step holds under this share of the first step's pixels
WEAR = {
    'cap': {'head'},
    'shirt': {'torso', 'pelvis', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'head'},
    'trousers': {'pelvis', 'torso', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r'},
    'gloves': {'hand_l', 'hand_r', 'fore_l', 'fore_r'},
    'boots': {'foot_l', 'foot_r', 'shin_l', 'shin_r'},
}
TARGET = {
    'cap': {'head'},
    'shirt': {'torso'},
    'trousers': {'thigh_l', 'thigh_r', 'shin_l', 'shin_r'},
    'gloves': {'hand_l', 'hand_r'},
    'boots': {'foot_l', 'foot_r'},
}
LOOSE = {}                # a loose piece (cape, robe skirt, long hair): name -> body anchor part, for the engine's wind later
SIDE = {n: ('l' if n.endswith('_l') else 'r' if n.endswith('_r') else 'c') for n in parts.NAMES}


def kind(name):
    """A piece name like 'gloves' or 'gloves_fit' -> its kind."""
    return name.split('_')[0]


def analyse(piece_mask, body, lab, name, dist=None):
    """Overhang, band and misfit of one piece on one frame (the stand frame). `lab` is parts.label(body, kp)."""
    k = kind(name)
    d, by, bx = parts.edt(body) if dist is None else dist
    ys, xs = np.nonzero(piece_mask & ~body)
    pl = lab[by[ys, xs], bx[ys, xs]]
    dd = d[ys, xs]
    steps = np.ceil(dd - 1e-6).astype(int)
    band, hist = {}, {}
    for p in sorted(set(pl.tolist())):
        h = np.bincount(steps[pl == p], minlength=12)[1:12]
        hist[parts.NAMES[p]] = h.tolist()
        b = 1
        for i in range(1, len(h)):
            if h[i] >= KNEE * max(h[0], 1):
                b = i + 1
            else:
                break
        band[parts.NAMES[p]] = float(min(b, THICK_MAX))
    names = np.array([parts.NAMES[p] for p in pl]) if len(pl) else np.array([], str)
    beyond = np.array([dd[i] > band[names[i]] + 1e-6 for i in range(len(dd))], bool)
    wrong = np.array([names[i] not in WEAR[k] for i in range(len(dd))], bool)
    mis = beyond | wrong
    misfit = np.zeros(body.shape, bool)
    misfit[ys[mis], xs[mis]] = True
    tgt = np.isin(lab, [parts.NAMES.index(t) for t in TARGET[k]])
    cov = float((piece_mask & tgt).sum() / max(1, tgt.sum()))
    return dict(px=int(piece_mask.sum()), overhang=int(len(ys)), band=band, hist=hist, misfit=int(mis.sum()),
                misfit_beyond=int(beyond.sum()), misfit_wrong_part=int(wrong.sum()), coverage=round(cov, 3), misfit_mask=misfit)


def _warp_group(piece, gmask, dy, dx, s, cy, cx):
    """The group's pixels scaled by s about (cy, cx) and shifted, by inverse nearest neighbour (no colour is made)."""
    out = np.zeros_like(piece)
    gy, gx = np.mgrid[0:F, 0:F]
    sy = np.round((gy - dy - cy) / s + cy).astype(int)
    sx = np.round((gx - dx - cx) / s + cx).astype(int)
    ok = (sy >= 0) & (sy < F) & (sx >= 0) & (sx < F)
    ok[ok] = gmask[sy[ok], sx[ok]]
    out[ok] = piece[sy[ok], sx[ok]]
    return out


def target_mask(lab, name, face=None):
    """The pixels a piece should cover: its TARGET parts, less the face box (no piece covers the chin or the face, DECISIONS
    2026-11-20); head-wear only above the face box's top row (the brow)."""
    tgt = np.isin(lab, [parts.NAMES.index(t) for t in TARGET[kind(name)]])
    if face is not None:
        x0, x1, y0, y1 = face
        if kind(name) == 'cap':
            tgt[y0:] = False
        tgt[y0:y1 + 1, x0:x1 + 1] = False
    return tgt


def face_px(piece_mask, face):
    if face is None:
        return 0
    x0, x1, y0, y1 = face
    return int(piece_mask[y0:y1 + 1, x0:x1 + 1].sum())


def score(piece_mask, body, lab, name, dist, face=None):
    a = analyse(piece_mask, body, lab, name, dist)
    return (piece_mask & target_mask(lab, name, face)).sum() - 2.0 * a['misfit'] - 50.0 * face_px(piece_mask, face), a


def fit(piece, body, lab, name, shift=4, scales=(0.9, 1.0, 1.1), face=None):
    """Fit each side of a piece to B's parts: per side (left, right, middle by the nearest body part of its pixels) the shift and scale
    that raise (target pixels covered - 2 x misfit - 50 x face-box pixels), never taking a move that adds misfit or a face pixel.
    Returns (fitted piece, per-side moves, analysis before, analysis after)."""
    dist = parts.edt(body)
    d, by, bx = dist
    piece = piece.copy()
    if face is not None:               # the face rule first: a piece's pixels in the face box are taken off, never moved elsewhere
        x0, x1, y0, y1 = face
        piece[y0:y1 + 1, x0:x1 + 1] = 0
    pm = piece[..., 3] > 0
    ys, xs = np.nonzero(pm)
    side = np.array([SIDE[parts.NAMES[lab[by[y, x], bx[y, x]]]] for y, x in zip(ys, xs)])
    before = analyse(pm, body, lab, name, dist)
    out = np.zeros_like(piece)
    moves = {}
    groups = [g for g in ('l', 'r', 'c') if (side == g).any()]
    if kind(name) in ('shirt', 'trousers', 'cap'):       # one garment round the trunk: moved as one
        groups = ['all']
    for g in groups:
        sel = np.ones(len(ys), bool) if g == 'all' else side == g
        gm = np.zeros((F, F), bool)
        gm[ys[sel], xs[sel]] = True
        cy, cx = ys[sel].mean(), xs[sel].mean()
        rest = pm & ~gm
        best = None
        for s in scales:
            for dy in range(-shift, shift + 1):
                for dx in range(-shift, shift + 1):
                    w = _warp_group(piece, gm, dy, dx, s, cy, cx)
                    m = (w[..., 3] > 0) | rest
                    sc, an = score(m, body, lab, name, dist, face)
                    if (dy, dx, s) != (0, 0, 1.0) and (an['misfit'] > before['misfit'] or face_px(m, face) > face_px(pm, face)):
                        continue
                    sc -= 0.01 * (abs(dy) + abs(dx)) + 0.5 * abs(s - 1)       # the smallest move wins a tie
                    if best is None or sc > best[0]:
                        best = (sc, dy, dx, s, w)
        _, dy, dx, s, w = best
        moves[g] = dict(dy=dy, dx=dx, scale=s)
        put = (w[..., 3] > 0) & (out[..., 3] == 0)
        out[put] = w[put]
    after = analyse(out[..., 3] > 0, body, lab, name, dist)
    return out, moves, before, after
