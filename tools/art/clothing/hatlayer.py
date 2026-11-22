"""Head-wear as its own layer (manager ruling 21.11): one hat drawing per view, laid by code on every frame at the head anchor
measured from that frame's bare figure, so the hat cannot change between frames (S4) and cannot cover the face (S3).

  extract(bare, dressed, view)            -> sprite: the garment's pixels in the head place (mask + colours) and the source anchor
  lay(sprite, bare, view)                 -> the bare frame with the hat laid on at that frame's own head anchor
  compose(body, bare, sprite, view)       -> the frame: the bare head with the hat above the neck row, the drawn body below it

The anchor is the figure's top row and the horizontal middle of the head's silhouette at the brow rows (the same rows the face box
of bars.landmarks uses), taken on the bare frame only. Head-fit (poke-through) = bare pixels the hat leaves uncovered above the hat's top row in a
column: the head's own hair standing out over the crown.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402


def anchor(bare, view):
    lm = bars.landmarks(bare, view)
    op = bars.opaque(bare)
    brow = lm['brow']
    probe = op[brow:brow + max(2, int(round(0.08 * lm['h'])))]
    xs = np.nonzero(probe.any(0))[0]
    return dict(top=lm['top'], cx=(int(xs.min()) + int(xs.max())) / 2.0, head_end=lm['head_end'])


def _dilate(m):
    p = np.pad(m, 1)
    out = np.zeros_like(m)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            out |= p[dy:dy + m.shape[0], dx:dx + m.shape[1]]
    return out


def _erode(m):
    return ~_dilate(~m)


def extract(bare, dressed, view, places=('head',)):
    lm = bars.landmarks(bare, view)
    g = bars.garment_pixels(bare, dressed, lm, list(places))
    g = _erode(_dilate(g)) | g                  # close one-pixel gaps inside the piece
    g &= bars.opaque(dressed)
    fm = bars.face_mask(lm, bare.shape)
    g &= ~fm                                    # a piece never owns a pixel of the face box
    a = anchor(bare, view)
    return dict(mask=g, rgba=dressed.copy(), anchor=a, view=view)


def lay(sprite, bare, view):
    a = anchor(bare, view)
    dy = int(a['top'] - sprite['anchor']['top'])
    dx = int(round(a['cx'] - sprite['anchor']['cx']))
    out = bare.copy()
    ys, xs = np.nonzero(sprite['mask'])
    H, W = bare.shape[:2]
    m = np.zeros(bare.shape[:2], bool)
    for y, x in zip(ys, xs):
        Y, X = y + dy, x + dx
        if 0 <= Y < H and 0 <= X < W:
            out[Y, X] = sprite['rgba'][y, x]
            out[Y, X, 3] = 255
            m[Y, X] = True
    # the hat covers the head: nothing of the bare head stands out above the hat's own top row in a column the hat covers
    for x in range(W):
        col = np.nonzero(m[:, x])[0]
        if len(col):
            out[:col.min(), x] = 0
    return out, m


def compose(body, bare, sprite, view):
    """The bare head with the hat laid on, down to the neck row; the drawn frame (body) from there down."""
    head, m = lay(sprite, bare, view)
    a = anchor(bare, view)
    cut = a['head_end'] + 1
    out = body.copy()
    out[:cut] = head[:cut]
    return drop_specks(out, cut), m


def drop_specks(a, cut):
    """Opaque pieces smaller than bars.SPECK that lie wholly above the neck row (a few pixels of hair or crown cut off the hat's
    edge by the layer) are cleared: S5 asks for one body with no loose specks. Pieces lower down are the drawn body's, not touched."""
    a = a.copy()
    op = bars.opaque(a)
    seen = np.zeros_like(op)
    H, W = op.shape
    for y0 in range(cut):
        for x0 in range(W):
            if op[y0, x0] and not seen[y0, x0]:
                st, pts = [(y0, x0)], []
                seen[y0, x0] = True
                while st:
                    y, x = st.pop()
                    pts.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < H and 0 <= xx < W and op[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True
                                st.append((yy, xx))
                if len(pts) < bars.SPECK and all(py < cut for py, _ in pts) and not any(py + 1 < H and op[py + 1, px] and (py + 1, px) not in set(pts) for py, px in pts):
                    for py, px in pts:
                        a[py, px] = 0
    return a


def poke_through(bare, hatmask):
    """Head-fit: bare pixels the hat leaves uncovered above the hat's own top row in a column (hair standing out over the crown),
    counted over the columns the hat covers. Hair beside the face under the brim is how a hat sits and is not counted."""
    op = bars.opaque(bare) & ~hatmask
    n = 0
    for x in range(bare.shape[1]):
        col = np.nonzero(hatmask[:, x])[0]
        if len(col):
            n += int(op[:col.min(), x].sum())
    return n
