"""How well a map rebuilds the bare frame from the stand frame (the map's own check, before any piece is carried).

For a frame and the map made for it: carry the stand frame through the map and compare with the frame. Python 3 with numpy only.
"""
import numpy as np

F = 128


def recon_metrics(stand, frame, src):
    """iou: overlap of the rebuilt silhouette with the frame's; exact: share of the frame's body pixels the map gives the very colour
    they have; holes: frame body pixels no source reaches; spill: rebuilt pixels on empty ground of the frame."""
    ok = src[..., 0] >= 0
    rec = np.zeros((F, F, 4), np.uint8)
    rec[ok] = stand[src[ok][:, 0], src[ok][:, 1]]
    ro, fo = rec[..., 3] > 0, frame[..., 3] > 0
    exact = (rec[..., :3] == frame[..., :3]).all(-1) & ro & fo
    n = max(1, int(fo.sum()))
    return dict(iou=float((ro & fo).sum() / max(1, (ro | fo).sum())), exact=float(exact.sum() / n), holes=int((fo & ~ok).sum()),
                spill=int((ro & ~fo).sum()), body=n)
