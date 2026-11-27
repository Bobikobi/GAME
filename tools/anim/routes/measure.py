#!/usr/bin/env python3
"""Bars B1 to B4 of the animation routes trial (#762), read from the delivered frames only.

Frames are 128 x 128 RGBA PNGs (`f00.png`, `f01.png`, ...). Nothing is re-snapped, palette-snapped or cut here: what a route
delivers is what is measured, so every route (a take, a cut-out, a render, an in-between) is judged by the same eye.

  python3 measure.py FRAMES_DIR --ref STANCE.png [--cycle-ms 1440] [--out measures.json]

B1 identity: height range, mean Lab distance of the frames' colours to the stance's colours, opaque area against the stance.
B2 feet: spread of the lowest opaque row, and how far the planted foot's left and right edges (lowest rows) drift.
B3 smoothness: frames per cycle, ms per frame at the matched cycle, the mean absolute pixel change between neighbours and the
   largest single-limb jump = the symmetric Hausdorff distance between neighbouring opaque masks (no segmentation, so it
   reads the same on a take, a render and a cut-out).
B4 loop: the same two numbers from the last frame to the first, against the largest inner jump.
Library: numpy and Pillow; no paths of its own."""
from __future__ import annotations
import argparse
import glob
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "prod"))
import gates  # noqa: E402  (the shared frame measures: lab, identity, foot_edges, mad)

CYCLE_MS = 1440  # the baseline: 16 frames at 90 ms; every route is shown and judged at this cycle time


def load_dir(path: str) -> list[np.ndarray]:
    files = sorted(glob.glob(str(Path(path) / "f*.png")))
    if not files:
        raise SystemExit(f"{path}: no f*.png frames")
    return [gates.load(f) for f in files]


def mask(a: np.ndarray) -> np.ndarray:
    return a[..., 3] > 0


def hausdorff(a: np.ndarray, b: np.ndarray) -> float:
    """Symmetric Hausdorff distance in px between the opaque pixels of two frames: the farthest any pixel of one is from the other."""
    pa = np.argwhere(mask(a)).astype(float)
    pb = np.argwhere(mask(b)).astype(float)
    if len(pa) == 0 or len(pb) == 0:
        return float("inf")
    out = 0.0
    for p, q in ((pa, pb), (pb, pa)):
        far = 0.0
        for i in range(0, len(p), 512):
            d = ((p[i:i + 512, None, :] - q[None, :, :]) ** 2).sum(-1)
            far = max(far, float(np.sqrt(d.min(1)).max()))
        out = max(out, far)
    return round(out, 2)


def lowest_row(a: np.ndarray) -> int:
    return int(np.where(mask(a).any(1))[0][-1])


def measure(frames: list[np.ndarray], ref: np.ndarray, cycle_ms: int = CYCLE_MS) -> dict:
    n = len(frames)
    heights = [gates.height(f) for f in frames]
    stance_h = gates.height(ref)
    palette = gates.colours([ref])
    ident = [gates.identity(f, palette) for f in frames]
    stance_area = int(mask(ref).sum())
    low = [lowest_row(f) for f in frames]
    edges = [gates.foot_edges(f) for f in frames]
    inner_mad = [gates.mad(frames[i], frames[i + 1]) for i in range(n - 1)]
    inner_hd = [hausdorff(frames[i], frames[i + 1]) for i in range(n - 1)]
    close_mad = gates.mad(frames[-1], frames[0])
    close_hd = hausdorff(frames[-1], frames[0])
    left = [e[0] for e in edges]
    right = [e[1] for e in edges]
    return {
        "frames": n,
        "ms_per_frame": round(cycle_ms / n, 1),
        "b1_height_min": min(heights), "b1_height_max": max(heights), "b1_height_stance": stance_h,
        "b1_height_first_last_dev": max(abs(heights[0] - stance_h), abs(heights[-1] - stance_h)),
        "b1_palette_dist_max": max(ident), "b1_palette_dist_mean": round(float(np.mean(ident)), 1),
        "b1_area_ratio_min": round(min(int(mask(f).sum()) for f in frames) / stance_area, 2),
        "b1_area_ratio_max": round(max(int(mask(f).sum()) for f in frames) / stance_area, 2),
        "b2_lowest_row_spread": max(low) - min(low),
        "b2_foot_edge_drift": max(max(left) - min(left), max(right) - min(right)),
        "b3_mad_mean": round(float(np.mean(inner_mad)), 3), "b3_mad_max": round(max(inner_mad), 3),
        "b3_limb_jump_mean": round(float(np.mean(inner_hd)), 2), "b3_limb_jump_max": max(inner_hd),
        "b4_close_mad": round(close_mad, 3), "b4_close_limb_jump": close_hd,
        "b4_loop_ok": bool(close_mad <= max(inner_mad) and close_hd <= max(inner_hd)),
        "components_max": max(len(gates.components(f)) for f in frames),
        "heights": heights, "inner_limb_jumps": inner_hd,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--cycle-ms", type=int, default=CYCLE_MS)
    ap.add_argument("--out")
    ns = ap.parse_args()
    m = measure(load_dir(ns.frames), gates.load(ns.ref), ns.cycle_ms)
    text = json.dumps(m, indent=1)
    if ns.out:
        Path(ns.out).write_text(text)
    print(json.dumps({k: v for k, v in m.items() if k not in ("heights", "inner_limb_jumps")}))


if __name__ == "__main__":
    main()
