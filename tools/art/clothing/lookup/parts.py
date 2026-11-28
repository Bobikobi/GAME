"""Body parts of a frame from its keypoints (round 2, public #952): every body pixel takes the part of the nearest bone.

The keypoints are the 26 Halpe points of pose.py (the model is optional; a test passes keypoints by hand). A part is a list of bone
segments; the hand is the forearm bone carried past the wrist by HAND_EXT of its length, the foot the ankle to the toes and heel.
Python 3 with numpy only.
"""
import numpy as np

F = 128
HAND_EXT = 0.45
# part: segments as pairs of Halpe indices (person's left = 'l'); 'hand_*' and 'foot_*' are their own parts (gloves, boots)
BONES = {
    'head': [(17, 18), (0, 18), (3, 4)],
    'torso': [(18, 19), (5, 11), (6, 12), (5, 6)],
    'pelvis': [(11, 12)],
    'arm_l': [(5, 7)], 'arm_r': [(6, 8)],
    'fore_l': [(7, 9)], 'fore_r': [(8, 10)],
    'hand_l': [(9, 'hl')], 'hand_r': [(10, 'hr')],
    'thigh_l': [(11, 13)], 'thigh_r': [(12, 14)],
    'shin_l': [(13, 15)], 'shin_r': [(14, 16)],
    'foot_l': [(15, 20), (15, 24), (24, 20)], 'foot_r': [(16, 21), (16, 25), (25, 21)],
}
NAMES = list(BONES)
# the joint a part hangs from and its parent (for a loose piece's anchor, and for the part a joint pixel may also belong to)
PARENT = {'head': 'torso', 'torso': None, 'pelvis': 'torso', 'arm_l': 'torso', 'arm_r': 'torso', 'fore_l': 'arm_l', 'fore_r': 'arm_r',
          'hand_l': 'fore_l', 'hand_r': 'fore_r', 'thigh_l': 'pelvis', 'thigh_r': 'pelvis', 'shin_l': 'thigh_l', 'shin_r': 'thigh_r',
          'foot_l': 'shin_l', 'foot_r': 'shin_r'}


def neighbours(a, b):
    return a == b or PARENT.get(a) == b or PARENT.get(b) == a


def points(kp):
    """The keypoints with the two hand tips added ('hl', 'hr'): the forearm carried past the wrist."""
    p = {i: np.asarray(kp[i], float) for i in range(len(kp))}
    p['hl'] = p[9] + HAND_EXT * (p[9] - p[7])
    p['hr'] = p[10] + HAND_EXT * (p[10] - p[8])
    return p


def seg_dist(py, px, a, b):
    """Distance of pixels (py, px) to the segment a-b (points as (x, y))."""
    ax, ay = a
    bx, by = b
    vx, vy = bx - ax, by - ay
    L = vx * vx + vy * vy
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / L, 0, 1) if L > 1e-9 else np.zeros_like(px, float)
    return np.hypot(px - (ax + t * vx), py - (ay + t * vy)), t


def bone_distances(kp, ys, xs):
    """(len(NAMES), n) distances of the pixels to each part's nearest segment."""
    p = points(kp)
    out = np.empty((len(NAMES), len(ys)))
    for k, n in enumerate(NAMES):
        out[k] = np.min([seg_dist(ys, xs, p[a], p[b])[0] for a, b in BONES[n]], axis=0)
    return out


def label(mask, kp):
    """Part index (into NAMES) of every True pixel of mask, -1 elsewhere (F x F int)."""
    lab = np.full(mask.shape, -1, int)
    ys, xs = np.nonzero(mask)
    if len(ys):
        lab[ys, xs] = bone_distances(kp, ys, xs).argmin(0)
    return lab


def edt(mask):
    """Euclidean distance of every pixel to the nearest True pixel of mask (0 on it), and the index (y, x) of that pixel."""
    ys, xs = np.nonzero(mask)
    gy, gx = np.mgrid[0:mask.shape[0], 0:mask.shape[1]]
    best = np.full(mask.shape, np.inf)
    by = np.zeros(mask.shape, int)
    bx = np.zeros(mask.shape, int)
    for y, x in zip(ys, xs):
        d = (gy - y) ** 2 + (gx - x) ** 2
        u = d < best
        best[u] = d[u]
        by[u] = y
        bx[u] = x
    return np.sqrt(best), by, bx
