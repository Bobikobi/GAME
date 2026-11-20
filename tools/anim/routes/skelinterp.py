#!/usr/bin/env python3
"""Poses read from drawn frames, re-timed at the skeleton level: skelinterp.py OUT.json N EST.json... [--cycle] [--pin 'LEFT LEG,RIGHT LEG' --pin-from STANCE_EST.json]

Each EST.json is /estimate-skeleton's answer for one drawn frame. The joints' x and y are interpolated with a Catmull-Rom spline
through the frames (cyclic with --cycle) and sampled at N even steps over one cycle, so N poses come out of a few drawn ones with
no new drawing. OUT.json has the same shape as retarget.py's: {"frames": [[{x,y,label,z_index}*18]*N]}. Pure functions `catmull` and `pin` are tested in test_routes.py."""
import json
import sys

import numpy as np


def catmull(points, n, cyclic=True):
    """points: array (k, ...) of values; n samples spread over the k segments (k when cyclic, k-1 otherwise)."""
    p = np.asarray(points, float)
    k = len(p)
    segs = k if cyclic else k - 1
    out = []
    for j in range(n):
        u = segs * j / n if cyclic else (k - 1) * j / max(n - 1, 1)
        i, f = int(np.floor(u)), u - np.floor(u)
        if not cyclic and i >= k - 1:
            i, f = k - 2, 1.0

        def at(m):
            return p[m % k] if cyclic else p[min(max(m, 0), k - 1)]
        p0, p1, p2, p3 = at(i - 1), at(i), at(i + 1), at(i + 2)
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3))
    return np.array(out)


def pin(frames, est, labels):
    """Set the named joints of every frame to the place they have in the stance estimate `est` (a planted foot stays planted)."""
    at = {p["label"]: (p["x"], p["y"]) for p in est}
    for f in frames:
        for q in f:
            if q["label"] in labels:
                q["x"], q["y"] = at[q["label"]]
    return frames


def main():
    a = sys.argv[1:]
    cyclic = "--cycle" in a
    a = [x for x in a if x != "--cycle"]
    pin_labels, pin_from = None, None
    for flag in ("--pin", "--pin-from"):
        if flag in a:
            i = a.index(flag)
            v = a[i + 1]
            del a[i:i + 2]
            if flag == "--pin":
                pin_labels = v.split(",")
            else:
                pin_from = v
    out, n, files = a[0], int(a[1]), a[2:]
    ests = [json.load(open(f)) for f in files]
    ests = [e["keypoints"] if "keypoints" in e else e for e in ests]
    labels = [p["label"] for p in ests[0]]
    arr = np.array([[[p["x"], p["y"]] for p in sorted(e, key=lambda q: labels.index(q["label"]))] for e in ests])  # frames x joints x 2
    z = [{p["label"]: p.get("z_index", 0) for p in e} for e in ests]
    res = catmull(arr, n, cyclic)
    seg = len(ests) if cyclic else len(ests) - 1
    frames = []
    for j in range(n):
        near = int(round(seg * j / n if cyclic else (len(ests) - 1) * j / max(n - 1, 1))) % len(ests)
        frames.append([{"x": float(np.clip(res[j, m, 0], 0, 1)), "y": float(np.clip(res[j, m, 1], 0, 1)), "label": lab, "z_index": int(z[near][lab])} for m, lab in enumerate(labels)])
    if pin_labels:
        st = json.load(open(pin_from))
        frames = pin(frames, st["keypoints"] if "keypoints" in st else st, pin_labels)
    json.dump({"frames": frames}, open(out, "w"))
    print(f"{n} poses from {len(ests)} drawn frames -> {out}")


if __name__ == "__main__":
    main()
