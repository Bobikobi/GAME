"""Round 2 of the clothing route (public #952): carry a piece through any family's body map, and the bars of the round.

Every family gives, per frame, a map `src[y, x] = (sy, sx)`: the stand-frame pixel a frame body pixel comes from (-1: none). The
piece is carried the same way for all of them (`carry`): a piece pixel on the stand body goes where the map sends it; a piece pixel
OUTSIDE the stand body (overhang: a cuff, a sole, a cap's brim) rides with the body part it hangs from - the rigid move fitted to the
map's own pairs of the nearest stand pixels of that part - so it follows a turned forearm, not just the nearest moving pixel.

The bars, per frame (each is True when the frame passes):
  L2a  every garment pixel moves with the body: (i) no carried pixel is left where the body has left - a pixel outside the frame's
       body further from it than it was from the stand body (or its part's band) by more than 1 px is stray; at most STRAY_MAX;
       (ii) the garment sits on the part it came from: of the carried pixels on the frame body, the share whose stand part and frame
       part (parts.py from the frame's own keypoints, a judge outside the map) are the same or joined is at least PART_AGREE.
  L2b  overhang versus misfit: carried pixels outside the frame body beyond THICK_MAX + 1, or next to a part the piece is not worn
       on, are misfit; at most the stand frame's own misfit + MISFIT_SLACK.
  L3   the face rule: carried pixels in the face box (the stand face box carried to the frame by the keypoints) at most S3_MAX.
  L4   (manager's ruling 28.11) the piece's area as a share of the frame's own visible body area, against the same share on the B stand
       frame, within [L4_LO, L4_HI]. The clip-median form (L4_old, kept in the rows to show beside it) failed correct frames when the
       whole clip lost area (feet lifted, squats).
  L5   colours on the palette (all of them), L6 holes inside the piece (counted, never filled; reported).
  L7   per-frame confidence: the map rebuilds the BARE frame from the bare stand frame; `exact` is the share of body pixels given their
       own colour. It is a prediction, not a bar: the report says how well it foretells the frames a person sees as wrong.
Python 3 with numpy only.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import parts  # noqa: E402
import overhang  # noqa: E402
import carry as carry1  # noqa: E402

F = common.FRAME
STRAY_MAX = 3
PART_AGREE = 0.85
MISFIT_SLACK = 3
S3_MAX = 3
L4_LO, L4_HI = 0.8, 1.25


def rigid(q, p):
    """Least-squares rotation + shift taking points q (n, 2) onto p (n, 2) (no scale): returns (R 2x2, t 2)."""
    qc, pc = q.mean(0), p.mean(0)
    H = (q - qc).T @ (p - pc)
    U, _, Vt = np.linalg.svd(H)
    R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[-1] *= -1
        R = Vt.T @ U.T
    return R, pc - R @ qc


def part_moves(src, stand_lab, resid=2.0):
    """Per stand part, the rigid move (rotation + shift) fitted to the map's pairs of that part, refitted without the pairs it misses by
    more than `resid` px (a wrong match of a patch must not swing a limb). Returns {part index: (R, t)}; parts with under 6 pairs
    are left out."""
    ys, xs = np.nonzero(src[..., 0] >= 0)
    sy, sx = src[ys, xs, 0], src[ys, xs, 1]
    q = np.stack([sy, sx], -1).astype(float)
    p = np.stack([ys, xs], -1).astype(float)
    lab = stand_lab[sy, sx]
    out = {}
    for k in np.unique(lab):
        sel = lab == k
        if sel.sum() < 6:
            continue
        qq, pp = q[sel], p[sel]
        R, t = rigid(qq, pp)
        for _ in range(2):
            r = np.hypot(*(pp - (qq @ R.T + t)).T)
            good = r <= max(resid, np.median(r))
            if good.sum() < 6:
                break
            R, t = rigid(qq[good], pp[good])
        out[int(k)] = (R, t)
    return out


def carry(piece, stand, src, stand_lab, frame_body=None):
    """The piece's layer on the frame, the stand pixel each layer pixel came from (F x F x 2, -1 where none), and the overhang pixels
    dropped. With `frame_body`, an overhang pixel whose ride lands further from the frame's body than it hung from the stand body
    (+1 px) is not put down: it is counted as dropped (L2a counts it as stray), so a wrong ride never floats on the ground."""
    layer = np.zeros((F, F, 4), np.uint8)
    lsrc = np.full((F, F, 2), -1, int)
    pa = piece[..., 3] > 0
    body = stand[..., 3] > 0
    ys, xs = np.nonzero(src[..., 0] >= 0)
    sy, sx = src[ys, xs, 0], src[ys, xs, 1]
    take = pa[sy, sx]
    layer[ys[take], xs[take]] = piece[sy[take], sx[take]]
    lsrc[ys[take], xs[take]] = np.stack([sy[take], sx[take]], -1)
    oy, ox = np.nonzero(pa & ~body)
    dropped = 0
    if len(oy) and len(ys):
        d, by, bx = parts.edt(body)
        fd = parts.edt(frame_body)[0] if frame_body is not None else None
        moves = part_moves(src, stand_lab)
        for y, x in zip(oy, ox):
            part = int(stand_lab[by[y, x], bx[y, x]])
            k = part
            while k not in moves and parts.PARENT.get(parts.NAMES[k]):     # a part the map lost rides with its parent
                k = parts.NAMES.index(parts.PARENT[parts.NAMES[k]])
            if k not in moves:
                continue
            R, t = moves[k]
            ty, tx = R @ np.array([y, x], float) + t
            ty, tx = int(round(ty)), int(round(tx))
            if not (0 <= ty < F and 0 <= tx < F) or (fd is not None and fd[ty, tx] > d[y, x] + 1.0):
                dropped += 1
                continue
            if layer[ty, tx, 3] == 0:
                layer[ty, tx] = piece[y, x]
                lsrc[ty, tx] = (y, x)
    return layer, lsrc, dropped


def face_box_on(frame_kp, stand_kp, face):
    """The stand face box carried to the frame by the similarity fitted on the head's keypoints (nose, eyes, ears, head top, neck):
    a boolean mask on the frame."""
    idx = [0, 1, 2, 3, 4, 17, 18]
    q = np.asarray(stand_kp)[idx][:, ::-1]            # (y, x)
    p = np.asarray(frame_kp)[idx][:, ::-1]
    qc, pc = q.mean(0), p.mean(0)
    s = np.sqrt(((p - pc) ** 2).sum() / max(((q - qc) ** 2).sum(), 1e-9))
    R, _ = rigid(q, p)
    x0, x1, y0, y1 = face
    gy, gx = np.mgrid[0:F, 0:F]
    pts = np.stack([gy.ravel(), gx.ravel()], -1).astype(float)
    back = ((pts - pc) / s) @ R + qc                  # frame pixel -> stand coordinates (R orthonormal: inverse is R.T)
    m = (back[:, 0] >= y0 - 0.5) & (back[:, 0] <= y1 + 0.5) & (back[:, 1] >= x0 - 0.5) & (back[:, 1] <= x1 + 0.5)
    return m.reshape(F, F)


def recon(stand, frame, src):
    """L7: the bare frame rebuilt from the bare stand frame through the map."""
    ok = src[..., 0] >= 0
    rec = np.zeros((F, F, 4), np.uint8)
    rec[ok] = stand[src[ok][:, 0], src[ok][:, 1]]
    fo = frame[..., 3] > 0
    exact = (rec[..., :3] == frame[..., :3]).all(-1) & (rec[..., 3] > 0) & fo
    return dict(exact=float(exact.sum() / max(1, fo.sum())), holes=int((fo & ~ok).sum()), exact_mask=exact)


def frame_bars(frame, layer, lsrc, src, stand, stand_lab, stand_dist, frame_kp, stand_kp, face, name, stand_an, palette=None, dropped=0):
    """The per-frame numbers of one piece. `stand_an` is overhang.analyse of the (fitted) piece on the stand frame."""
    k = overhang.kind(name)
    fo = frame[..., 3] > 0
    pm = layer[..., 3] > 0
    n = int(pm.sum())
    sd, sby, sbx = stand_dist
    fd, fby, fbx = parts.edt(fo)
    flab = parts.label(fo, frame_kp)
    ys, xs = np.nonzero(pm)
    qy, qx = lsrc[ys, xs, 0], lsrc[ys, xs, 1]
    has = qy >= 0
    # the part each carried pixel came from: its own stand part, or for overhang the part it hangs from
    src_part = np.where(has, stand_lab[sby[np.maximum(qy, 0), np.maximum(qx, 0)], sbx[np.maximum(qy, 0), np.maximum(qx, 0)]], -1)
    d_src = np.where(has, sd[np.maximum(qy, 0), np.maximum(qx, 0)], 0)
    d_fr = fd[ys, xs]
    band = np.array([stand_an['band'].get(parts.NAMES[p], 1.0) if p >= 0 else 1.0 for p in src_part])
    stray = int(((d_fr > np.maximum(d_src, band) + 1.0) & ~fo[ys, xs]).sum()) + dropped
    on = fo[ys, xs] & (src_part >= 0)
    agree = [parts.neighbours(parts.NAMES[a], parts.NAMES[b]) for a, b in zip(src_part[on], flab[ys[on], xs[on]])]
    part_agree = float(np.mean(agree)) if agree else 1.0
    out_px = ~fo[ys, xs]
    near_part = flab[fby[ys, xs], fbx[ys, xs]]
    mis = out_px & ((d_fr > overhang.THICK_MAX + 1.0) | np.array([parts.NAMES[p] not in overhang.WEAR[k] for p in near_part], bool))
    misfit = int(mis.sum())
    fbox = face_box_on(frame_kp, stand_kp, face)
    face_n = int((pm & fbox).sum())
    pal = common.palette() if palette is None else palette
    on_pal = common.on_palette(layer[..., :3], pm, pal)
    holes_in, holes_all = carry1.holes(frame, src, layer)
    r = recon(stand, frame, src)
    under = pm & fo
    foot = float(r['exact_mask'][under].mean()) if under.any() else 1.0
    return dict(px=n, body_px=int(fo.sum()), stray=stray, dropped=dropped, part_agree=round(part_agree, 3), misfit=misfit, face_px=face_n, on_palette=on_pal,
                holes_in_piece=holes_in, holes_body=holes_all, exact=round(r['exact'], 4), exact_under=round(foot, 4))


def verdicts(rows, stand_misfit, stand_share=None):
    """Per-frame pass of L2a, L2b, L3, L4 and the frame's all-four pass. L4 is the piece's share of the frame's body area against
    `stand_share` (the same share on the stand frame); L4_old (the clip's median area) is kept beside it, not used for `all`."""
    px = [r['px'] for r in rows]
    med = float(np.median([p for p in px if p > 0])) if any(px) else 0.0
    out = []
    for r in rows:
        l2a = r['stray'] <= max(STRAY_MAX, 0.02 * r['px']) and r['part_agree'] >= PART_AGREE
        l2b = r['misfit'] <= stand_misfit + MISFIT_SLACK
        l3 = r['face_px'] <= S3_MAX
        ratio_old = r['px'] / med if med else 0.0
        l4_old = L4_LO <= ratio_old <= L4_HI
        share = r['px'] / max(1, r['body_px'])
        ratio = share / stand_share if stand_share else ratio_old
        l4 = L4_LO <= ratio <= L4_HI if stand_share else l4_old
        out.append(dict(L2a=bool(l2a), L2b=bool(l2b), L3=bool(l3), L4=bool(l4), L4_old=bool(l4_old), area_ratio=round(ratio, 3),
                        area_ratio_old=round(ratio_old, 3), L5=r['on_palette'] >= 0.999, all=bool(l2a and l2b and l3 and l4),
                        all_old=bool(l2a and l2b and l3 and l4_old)))
    return out
