#!/usr/bin/env python3
"""Cut a drawn grid of figures (Gemini or GPT, R4/R5 of the animation routes trial #762) into game frames.

  python3 cutgrid.py GRID.png COLS ROWS OUT_DIR --ref STANCE.png [--bg-dist 48] [--ground 117] [--height 96] [--drop 255,255,0,200]

Each cell is found by an even split; its background is the cell's corner colour; the figure is the biggest connected blob of pixels
further than --bg-dist from it. One scale for the whole grid (cell 0 is the stance: its figure is set to --height px) keeps the
figure's size steady; each figure's lowest row lands on --ground and the centre of its lowest 12 percent on column 64. The
reduction is a box average, then every colour snaps to the stance's own palette and alpha cuts at 50 percent. Pure helpers
(`blob_bbox`, `snap_to`) are tested in test_cutgrid.py. Needs numpy, Pillow."""
from __future__ import annotations
import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def blob_bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    """Bounding box (x0, y0, x1, y1), x1/y1 exclusive, of the biggest 8-connected blob of True cells; None when empty."""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    best, best_n = None, 0
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack, n = [(sy, sx)], 0
        seen[sy, sx] = True
        x0 = x1 = sx
        y0 = y1 = sy
        while stack:
            y, x = stack.pop()
            n += 1
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
        if n > best_n:
            best_n, best = n, (x0, y0, x1 + 1, y1 + 1)
    return best


def snap_to(rgb: np.ndarray, pal: np.ndarray) -> np.ndarray:
    flat = rgb.reshape(-1, 3).astype(np.int32)
    d = ((flat[:, None, :] - pal[None].astype(np.int32)) ** 2).sum(-1)
    return pal[d.argmin(1)].reshape(rgb.shape).astype(np.uint8)


def cell_mask(cell: np.ndarray, bg_dist: int, drop=None) -> np.ndarray:
    corners = np.array([cell[3, 3], cell[3, -4], cell[-4, 3], cell[-4, -4]], float)
    bg = np.median(corners, axis=0)
    m = np.abs(cell[..., :3].astype(float) - bg).sum(-1) > bg_dist
    if drop is not None:  # a guide colour the drawer copied into the picture (the yellow ground line of a drawn grid)
        m &= np.abs(cell[..., :3].astype(float) - np.array(drop[:3])).sum(-1) > drop[3]
    return m


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("grid")
    ap.add_argument("cols", type=int)
    ap.add_argument("rows", type=int)
    ap.add_argument("out")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--bg-dist", type=int, default=48)
    ap.add_argument("--ground", type=int, default=117)
    ap.add_argument("--height", type=int, default=96)
    ap.add_argument("--drop", help="R,G,B,TOL: pixels within TOL (sum of channel differences) of this colour are background")
    a = ap.parse_args()
    drop = [int(v) for v in a.drop.split(",")] if a.drop else None
    g = np.array(Image.open(a.grid).convert("RGB"))
    ref = np.array(Image.open(a.ref).convert("RGBA"))
    pal = np.unique(ref[ref[..., 3] > 127][:, :3], axis=0)
    ch, cw = g.shape[0] // a.rows, g.shape[1] // a.cols
    cells, boxes = [], []
    for r in range(a.rows):
        for c in range(a.cols):
            cell = g[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            m = cell_mask(cell, a.bg_dist, drop)
            cells.append((cell, m))
            boxes.append(blob_bbox(m))
    if boxes[0] is None:
        raise SystemExit("cell 0 is empty")
    scale = a.height / (boxes[0][3] - boxes[0][1])
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for i, ((cell, m), bb) in enumerate(zip(cells, boxes)):
        out = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        if bb is not None:
            x0, y0, x1, y1 = bb
            rgba = np.dstack([cell, (m * 255).astype(np.uint8)])
            crop = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
            # colours are averaged only over opaque pixels (premultiplied) so the edge does not pick up the green
            arr = np.array(crop).astype(float)
            pre = arr[..., :3] * (arr[..., 3:] / 255)
            w2, h2 = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
            pm = np.dstack([pre, arr[..., 3:]])
            small = np.stack([np.array(Image.fromarray(pm[..., k].astype(np.float32), "F").resize((w2, h2), Image.BOX)) for k in range(4)], -1)
            alpha = small[..., 3] / 255
            col = np.where(alpha[..., None] > 0, small[..., :3] / np.maximum(alpha[..., None], 1e-6), 0)
            op = alpha > 0.5
            low = op[int(h2 * 0.88):]
            xs = np.nonzero(low.any(0))[0]
            cx = (xs.min() + xs.max()) / 2 if len(xs) else w2 / 2
            tile = np.zeros((h2, w2, 4), np.uint8)
            tile[..., :3] = snap_to(np.clip(col, 0, 255).astype(np.uint8), pal)
            tile[..., 3] = np.where(op, 255, 0)
            tile[~op, :3] = 0
            ox, oy = round(64 - cx), a.ground + 1 - h2
            out.alpha_composite(Image.fromarray(tile, "RGBA"), (max(ox, 0), max(oy, 0)), (max(-ox, 0), max(-oy, 0)))
        out.save(Path(a.out) / f"f{i:02d}.png")
    print(len(cells), "frames, scale", round(scale, 3), "->", a.out)


if __name__ == "__main__":
    main()
