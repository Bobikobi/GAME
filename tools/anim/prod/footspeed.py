#!/usr/bin/env python3
"""Gate (g), the foot speed of a walking clip: how far the planted foot travels under the body from one pose to the next. Library plus CLI.
numpy + Pillow only, no paths of its own.

A walk or run sheet is played distance-locked (game/src/work.ts `poseFrame`): the pose shown is the one for the art pixels walked, so
the cycle must be as long as the strides the game covers. Poses come at most `POSES_PER_S_MAX` (30) a second (two 60 Hz frames a pose),
so a pose must cover at least pace / 30 art px of ground. A drawn clip that bounces in place (PixelLab, 28.11: the walk 4.7 art px a pose,
the run 4.5) holds its feet only up to 4.5 x 30 = 140 px/s; the game's walk pace is 337 px/s, its run 674 px/s at every second pose.

  foot step      the planted foot's travel along the ground (x) between two poses it is on the ground in both, in raw px
  art step       raw step x fit (`fit_permille`/1000 of the clip's kit row; default 0.719, the human left clips)
  poses/s        the poses a second the game would have to show to hold the foot at a pace: pace / art step
  gate (g)       PASS when the art step is >= pace / POSES_PER_S_MAX at every pace the clip is meant for (walk 11.2, run 22.5 by default)

A foot is a blob of the frame's lowest rows (`SOLE_ROWS`): the foot on the ground in that pose (give it frames that stand on one ground row, the
processed set, not a raw job). The same foot is followed to the next pose as the nearest blob within `MAX_STEP` raw px. The measure is the median of the steps at least `MIN_STEP` raw px (a foot standing still on
two poses is a plant, not a stride). Front and back views give no usable x travel (the feet travel toward the camera, which the
ground row flattens): the gate is for the side view."""
from __future__ import annotations
import glob
import sys
from pathlib import Path
import numpy as np
from PIL import Image

PACE_WALK, PACE_RUN, PACE_SNEAK = 337.0, 674.0, 168.0      # art px a second: 64 px / walk_step_ms 190, run_div 2, sneak_mul 2
PACES = {"walk": PACE_WALK, "run": PACE_RUN, "sneak": PACE_SNEAK}
POSES_PER_S_MAX = 30
FIT = 0.719
SOLE_ROWS, MAX_STEP, MIN_STEP = 3, 40, 1.0


def blobs(a):
    """The feet of one RGBA frame: [(centre x, bottom row)] of the runs of columns the lowest `SOLE_ROWS` rows hold."""
    m = a[..., 3] > 127
    rows = np.where(m.any(1))[0]
    if rows.size == 0:
        return []
    low = int(rows.max())
    xs = np.where(m[max(0, low - SOLE_ROWS + 1):low + 1].any(0))[0]
    out, s, p = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - p > 2:
            out.append(((s + p) / 2, low))
            s = x
        p = x
    out.append(((s + p) / 2, low))
    return out


def steps(frames):
    """The planted-foot steps of a looping clip, raw px along x, signed (positive = the foot moves right): one per planted foot per pose pair."""
    feet = [blobs(f) for f in frames]
    n, out = len(feet), []
    for i in range(n):
        for x, _ in feet[i]:
            near = [nx - x for nx, _ in feet[(i + 1) % n] if abs(nx - x) <= MAX_STEP]
            if near:
                out.append(min(near, key=abs))
    return out


def measure(frames, fit=FIT):
    """{poses, raw, art, walk_poses_s, run_poses_s, steps}: the median planted-foot step and the poses a second that hold it at each pace."""
    st = [abs(d) for d in steps(frames) if abs(d) >= MIN_STEP]
    if not st:
        return {"poses": len(frames), "raw": 0.0, "art": 0.0, "walk_poses_s": None, "run_poses_s": None, "steps": []}
    raw = float(np.median(st))
    art = raw * fit
    return {"poses": len(frames), "raw": round(raw, 2), "art": round(art, 2), "walk_poses_s": round(PACE_WALK / art, 1),
            "run_poses_s": round(PACE_RUN / art, 1), "steps": sorted(round(d, 1) for d in st)}


def gate_g(frames, fit=FIT, paces=(PACE_WALK,)):
    """'PASS' when the art step reaches pace / POSES_PER_S_MAX for every pace named, else 'FAIL'; with the measure."""
    m = measure(frames, fit)
    need = {p: p / POSES_PER_S_MAX for p in paces}
    ok = m["art"] > 0 and all(m["art"] >= n for n in need.values())
    return ("PASS" if ok else "FAIL"), {**m, "needs": {str(int(p)): round(n, 1) for p, n in need.items()}}


def load(folder):
    return [np.array(Image.open(f).convert("RGBA")) for f in sorted(glob.glob(str(Path(folder) / "*.png")))]


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="gate (g): the planted foot's travel per pose of a side-view clip")
    ap.add_argument("dirs", nargs="+", help="folders of the clip's frames (p*.png or f*.png, 128 x 128)")
    ap.add_argument("--fit", type=float, default=FIT, help="the clip's fit_permille / 1000")
    ap.add_argument("--run", action="store_true", help="also hold the clip to the run pace (674 px/s at every second pose)")
    a = ap.parse_args()
    for d in a.dirs:
        verdict, info = gate_g(load(d), a.fit, (PACE_WALK, PACE_RUN) if a.run else (PACE_WALK,))
        print(d, verdict, info)
