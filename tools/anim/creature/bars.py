#!/usr/bin/env python3
"""The creature clip trial's bars (#793) over a folder of frames, by the instrument of #762 (tools/anim/routes/measure.py).

  python3 bars.py FRAMES_DIR --ref IDLE.png --cycle-ms 600 --kind loop|move [--creature wolf|human] [--out bars.json]

B1 body height: human = the figure's height range; wolf = the back line (top row of the torso columns) range over the frames.
B2 planted feet: spread of the lowest opaque row (feet leaving or sinking), and, for a move, the planted foot's edge drift.
   (a walking loop's feet slide by the stride, so for a loop only the spread of the lowest row is a bar.)
B3 loop: the last frame closes to the first (`loop`); a move ends where the idle can follow: Hausdorff of the last frame's mask
   to the idle's, at most 6 px (`move`).
Also frames, ms a frame, the largest neighbour jump and the loose-piece count. Pure numpy + Pillow; measure.py is imported by path."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROUTES = Path(__file__).resolve().parents[1] / "routes"
sys.path.insert(0, str(ROUTES))
import measure  # noqa: E402

END_BAR = 6.0


def back_line(a: np.ndarray) -> int:
    """The top row of the torso: the columns between a third and two thirds of the body's width."""
    m = measure.mask(a)
    xs = np.where(m.any(0))[0]
    lo, hi = xs[0] + (xs[-1] - xs[0]) // 3, xs[0] + 2 * (xs[-1] - xs[0]) // 3
    ys = np.where(m[:, lo:hi + 1].any(1))[0]
    return int(ys[0])


def bars(frames, ref, cycle_ms, kind, creature):
    m = measure.measure(frames, ref, cycle_ms)
    out = {"frames": m["frames"], "ms_per_frame": m["ms_per_frame"], "cycle_ms": cycle_ms,
           "limb_jump_max": m["b3_limb_jump_max"], "limb_jump_mean": m["b3_limb_jump_mean"], "components_max": m["components_max"],
           "palette_dist": m["b1_palette_dist_mean"], "area_ratio": [m["b1_area_ratio_min"], m["b1_area_ratio_max"]]}
    if creature == "wolf":
        bl = [back_line(f) for f in frames]
        out["b1_back_line_range"] = [min(bl), max(bl)]
        out["b1_drift"] = max(bl) - min(bl)
    else:
        out["b1_height_range"] = [m["b1_height_min"], m["b1_height_max"]]
        out["b1_drift"] = m["b1_height_max"] - m["b1_height_min"]
    out["b2_lowest_row_spread"] = m["b2_lowest_row_spread"]
    out["b2_foot_edge_drift"] = m["b2_foot_edge_drift"]
    if kind == "loop":
        out["b3_loop_closes"] = bool(m["b4_loop_ok"])
        out["b3_close_jump"] = m["b4_close_limb_jump"]
        out["b3_pass"] = bool(m["b4_loop_ok"])
        out["b2_pass"] = m["b2_lowest_row_spread"] <= 1
    else:
        end = measure.hausdorff(frames[-1], ref)
        out["b3_end_to_idle"] = end
        out["b3_pass"] = end <= END_BAR
        out["b2_pass"] = m["b2_foot_edge_drift"] <= 1
    out["b1_pass"] = out["b1_drift"] <= 2
    # two more readings for a single move (the manager's ruling of 21.11): B1 at the endpoints only (first and last frame against the idle's height,
    # a lunge may move the body in the middle), and B2 on the planted feet only: the rear feet, the right edge of the lowest rows (the creature faces left)
    if kind == "move":
        if creature == "wolf":
            h0 = back_line(ref)
            out["b1_endpoints"] = max(abs(back_line(frames[0]) - h0), abs(back_line(frames[-1]) - h0))
        else:
            hh = measure.mask(ref).any(1)
            h0 = int(np.where(hh)[0][-1] - np.where(hh)[0][0])
            def hgt(a):
                r = np.where(measure.mask(a).any(1))[0]
                return int(r[-1] - r[0])
            out["b1_endpoints"] = max(abs(hgt(frames[0]) - h0), abs(hgt(frames[-1]) - h0))
        out["b1_endpoints_pass"] = out["b1_endpoints"] <= 2
        rear = [measure.gates.foot_edges(f)[1] for f in frames]
        out["b2_rear_edge_drift"] = max(rear) - min(rear)
        out["b2_rear_pass"] = out["b2_rear_edge_drift"] <= 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--cycle-ms", type=int, required=True)
    ap.add_argument("--kind", choices=["loop", "move"], required=True)
    ap.add_argument("--creature", default="wolf")
    ap.add_argument("--out")
    a = ap.parse_args()
    frames = measure.load_dir(a.dir)
    ref = measure.gates.load(a.ref)
    r = bars(frames, ref, a.cycle_ms, a.kind, a.creature)
    if a.out:
        Path(a.out).write_text(json.dumps(r, indent=1))
    print(json.dumps(r))


if __name__ == "__main__":
    main()
