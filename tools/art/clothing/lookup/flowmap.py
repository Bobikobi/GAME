"""Family 3 of round 2 (public #952): a dense matcher from optical flow in place of round 1's patch match.

Two matchers on the frames scaled up by a whole step (nearest, on a flat background): `dis`, OpenCV's DIS flow (classical, fast),
and `raft`, the RAFT model of torchvision (learned, weights from download.pytorch.org, BSD). The flow from a frame to the stand
frame (or to its neighbour) is read at each game pixel's centre and rounded: that is the map. The maps of a clip are made by round
1's tracking (`densemap.chain_bi`: direct where the pose is near the stand pose, else tracked from the nearest such frame), with the
flow as the pair matcher. Optional dependencies: opencv (dis), torch and torchvision (raft), in the project-local venv.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import densemap  # noqa: E402

F = common.FRAME
UP = 4
BG = (96, 128, 96)
_raft = {}


def big(frame, up=UP):
    a = frame[..., 3:4].astype(float) / 255
    rgb = frame[..., :3] * a + np.array(BG) * (1 - a)
    return np.repeat(np.repeat(rgb.astype(np.uint8), up, 0), up, 1)


def flow_dis(a_img, b_img, fine=False):
    """DIS flow on grey (the first measurement: preset MEDIUM); `fine` (the tuning round) runs it on the three colour channels'
    mean flow with smaller patches and more refinement, so a hand on skin of nearly the same grey is still told apart."""
    import cv2
    def one(g0, g1):
        dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        if fine:
            dis.setPatchSize(8)
            dis.setPatchStride(2)
            dis.setVariationalRefinementIterations(10)
        return dis.calc(g0, g1, None)
    if not fine:
        return one(cv2.cvtColor(a_img, cv2.COLOR_RGB2GRAY), cv2.cvtColor(b_img, cv2.COLOR_RGB2GRAY))
    la, lb = cv2.cvtColor(a_img, cv2.COLOR_RGB2LAB), cv2.cvtColor(b_img, cv2.COLOR_RGB2LAB)
    return np.mean([one(la[..., c].copy(), lb[..., c].copy()) for c in range(3)], 0)


def flow_raft(a_img, b_img):
    import torch
    from torchvision.models.optical_flow import raft_large, Raft_Large_Weights
    if 'm' not in _raft:
        torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
        w = Raft_Large_Weights.DEFAULT
        _raft['m'] = raft_large(weights=w).eval()
        _raft['t'] = w.transforms()
    t1 = torch.from_numpy(a_img).permute(2, 0, 1)[None]
    t2 = torch.from_numpy(b_img).permute(2, 0, 1)[None]
    t1, t2 = _raft['t'](t1, t2)
    with torch.no_grad():
        fl = _raft['m'](t1, t2, num_flow_updates=12)[-1][0]
    return fl.permute(1, 2, 0).numpy()


def fit(a, b, radius=None, variant='raft'):
    """Map of frame b's body pixels into frame a (src as densemap.fit): the flow from b to a at each pixel's centre."""
    if variant == 'raft':
        fl = flow_raft(big(b), big(a))
    else:
        fl = flow_dis(big(b), big(a), fine=variant == 'disfine')
    c = UP // 2
    fy = fl[c::UP, c::UP]                       # (F, F, 2) at the game pixels' centres, in big px
    bo = b[..., 3] > 0
    ao = a[..., 3] > 0
    ys, xs = np.nonzero(bo)
    sx = np.round(xs + fy[ys, xs, 0] / UP).astype(int)
    sy = np.round(ys + fy[ys, xs, 1] / UP).astype(int)
    ok = (sy >= 0) & (sy < F) & (sx >= 0) & (sx < F)
    ok[ok] = ao[sy[ok], sx[ok]]
    src = np.full((F, F, 2), -1, int)
    src[ys[ok], xs[ok]] = np.stack([sy[ok], sx[ok]], -1)
    return src


def clip_maps(stand, frames, variant='f3raft', cache=None):
    v = 'disfine' if variant == 'f3b' else ('dis' if 'dis' in variant else 'raft')
    anchor = 'noanchor' not in variant
    return densemap.chain_bi(stand.frame, frames, anchor_exact=0.70, fitfn=lambda a, b, r: fit(a, b, variant=v), anchor=anchor, cache=cache)
