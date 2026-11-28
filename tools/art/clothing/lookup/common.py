"""Shared pieces of the lookup trial (public #952): frames of a kit sheet, the colours a piece may use, the snap.

Python 3 with numpy and Pillow only. Frames are RGBA uint8 arrays, 128 x 128, hard alpha.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import bars  # noqa: E402
import pack  # noqa: E402

REPO = pack.REPO
KIT = pack.KIT
FRAME = 128
HUMAN_RAMPS = ['wood', 'red', 'skin']      # the ramps of the bare human clips in the kit (kit.json: human_hit_front, human_jump_front)


def kit_row(name):
    with open(os.path.join(KIT, 'kit.json')) as fh:
        return json.load(fh)['kit']['sprites']['chars/' + name]


def load_clip(name):
    """All frames of a kit character sheet, in order, as a list of 128 x 128 RGBA arrays. Size and count come from the kit row."""
    row = kit_row(name)
    w, h, n = row['w'], row['h'], row['frames']
    assert w == FRAME and h == FRAME, (name, w, h)
    im = np.array(Image.open(os.path.join(KIT, row['file'])).convert('RGBA'))
    cols = row.get('cols') or im.shape[1] // w
    return [im[(i // cols) * h:(i // cols + 1) * h, (i % cols) * w:(i % cols + 1) * w].copy() for i in range(n)]


def palette():
    """The colours of a piece: the core 32 and the steps of the human clips' ramps (an (n, 3) uint8 array)."""
    return pack.palette_of(HUMAN_RAMPS)


def snap(rgb, pal=None):
    """Each colour onto the nearest palette colour in CIELAB. rgb: (..., 3) uint8."""
    pal = palette() if pal is None else pal
    flat = rgb.reshape(-1, 3)
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    d = ((bars.lab(cols)[:, None, :] - bars.lab(pal)[None, :, :]) ** 2).sum(-1)
    out = pal[d.argmin(1)][inv.reshape(-1)]
    return out.reshape(rgb.shape).astype(np.uint8)


def on_palette(rgb, mask, pal=None):
    """Share of the masked pixels whose colour is exactly on the palette."""
    pal = palette() if pal is None else pal
    px = rgb[mask]
    if len(px) == 0:
        return 1.0
    keys = set(map(tuple, pal.tolist()))
    return float(np.mean([tuple(p) in keys for p in px.tolist()]))


def save_rgba(a, path):
    Image.fromarray(a.astype(np.uint8), 'RGBA').save(path)
