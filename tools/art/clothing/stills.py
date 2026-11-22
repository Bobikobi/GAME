"""Stills for a card, built on compose.py's pipeline (box reduction by 51/96, hard alpha, ink edge, nearest x3, the painted
village-edge plate). A figure is pasted on the plate: the engine does not draw it, and a card says so.

  place(figs, out_full, out_phone, plate, focus)  figs: [(frame128 PIL image, cx, cy, scale)] feet at (cx, cy) in plate px
  crop4(full, bbox, out)                           the figure enlarged 4 times (the name says so)
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compose as C  # noqa: E402


def reduce_scaled(im, scale):
    old = C.SCALE
    C.SCALE = scale
    try:
        return C.ink_edge(C.reduce_frame(im))
    finally:
        C.SCALE = old


def place(figs, out_full, out_phone, plate, focus=0, patch=True):
    pl = np.asarray(Image.open(plate).convert('RGB'))
    W, H = 1920 // C.Z, 1080 // C.Z
    cx0 = figs[focus][1]
    cy0 = figs[focus][2]
    x0 = max(0, min(pl.shape[1] - W, cx0 - W // 2))
    y0 = max(0, min(pl.shape[0] - H, cy0 - int(H * 0.62)))
    win = pl[y0:y0 + H, x0:x0 + W].astype(np.float64)
    boxes = []
    layer = np.zeros((H, W, 4), np.uint8)
    for fig, cx, cy, sc in figs:
        fx, fy = cx - x0, cy - y0
        if patch:
            yy, xx = np.mgrid[0:H, 0:W]
            k = np.clip(1 - (((xx - fx) / 6.5) ** 2 + ((yy - (fy - 1)) / 1.6) ** 2), 0, 1) * 0.45
            win *= (1 - k[..., None])
        a = np.asarray(reduce_scaled(fig, sc))
        ys, xs = np.where(a[..., 3] > 0)
        top, bot, left, right = ys.min(), ys.max(), xs.min(), xs.max()
        px, py = int(fx - (left + right) // 2), int(fy - bot)
        for yy in range(a.shape[0]):
            for xx in range(a.shape[1]):
                if a[yy, xx, 3] > 0 and 0 <= py + yy < H and 0 <= px + xx < W:
                    layer[py + yy, px + xx] = a[yy, xx]
        boxes.append(((px + left) * C.Z, (py + top) * C.Z, (px + right + 1) * C.Z, (py + bot + 1) * C.Z))
    big = C.up(win.round().astype(np.uint8))
    L = C.up(layer)
    big = np.where(L[..., 3:4] > 0, L[..., :3], big).astype(np.uint8)
    full = Image.fromarray(big, 'RGB')
    full.save(out_full)
    bx = boxes[focus]
    cxs, cys = (bx[0] + bx[2]) // 2, (bx[1] + bx[3]) // 2
    p0 = max(0, min(1920 - 844, cxs - 422))
    q0 = max(0, min(1080 - 390, cys - 195))
    full.crop((p0, q0, p0 + 844, q0 + 390)).save(out_phone)
    return boxes


def crop4(full_path, box, out, w=120, h=170):
    im = Image.open(full_path)
    cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    x0, y0 = max(0, cx - w // 2), max(0, cy - h // 2)
    im.crop((x0, y0, x0 + w, y0 + h)).resize((w * 4, h * 4), Image.NEAREST).save(out)
