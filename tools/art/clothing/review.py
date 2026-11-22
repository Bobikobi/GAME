"""Review sheet: for each (clip, frame, seed) the bare frame, the dressed frame with the face box drawn, enlarged, for the builder's eye."""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402


def tile(arr, box, crop, z):
    g = Image.new('RGBA', (arr.shape[1], arr.shape[0]), (120, 160, 90, 255))
    g.alpha_composite(Image.fromarray(arr))
    g = g.crop(crop).resize(((crop[2] - crop[0]) * z, (crop[3] - crop[1]) * z), Image.NEAREST).convert('RGB')
    if box:
        d = ImageDraw.Draw(g)
        x0, x1, y0, y1 = box
        d.rectangle(((x0 - crop[0]) * z, (y0 - crop[1]) * z, (x1 - crop[0]) * z + z - 1, (y1 - crop[1]) * z + z - 1), outline=(255, 0, 0))
    return g


def sheet(items, out, crop=(36, 16, 96, 60), z=4):
    """items: list of (bare_path, dressed_path, view)."""
    tiles = []
    for b, d, v in items:
        ba = np.array(Image.open(b).convert('RGBA'))
        da = np.array(Image.open(d).convert('RGBA'))
        lm = bars.landmarks(ba, v)
        tiles.append(tile(ba, None, crop, z))
        tiles.append(tile(da, lm['face'], crop, z))
    w, h = tiles[0].size
    cols = min(len(tiles), 8)
    rows = (len(tiles) + cols - 1) // cols
    W = Image.new('RGB', (w * cols, h * rows))
    for i, t in enumerate(tiles):
        W.paste(t, ((i % cols) * w, (i // cols) * h))
    W.save(out)
    return W.size
