#!/usr/bin/env python3
"""A library motion on a standard skeleton to the 18-joint keypoints PixelLab's /animate-with-skeleton-v3 asks for, fitted to our figure.

  python3 retarget.py MOTION.json REF_POSE.json ESTIMATE.json OUT.json [--overlay OVERLAY.png --image STANCE.png] [--elev 35] [--phi DEG] [--arm-gain G]

MOTION.json and REF_POSE.json come from glbjoints.py (the same skeleton; REF_POSE is a frame of an upright idle, its first frame is used).
ESTIMATE.json is the answer of /estimate-skeleton for our stance (18 labelled joints, x and y as fractions 0-1 of the picture).
The camera is the game's: orthographic, `elev` degrees down, the figure turned `phi` degrees from a pure side view toward the camera;
phi, the scale and the offset are fitted so the idle pose lands on the estimate. Each frame is then the estimate plus the scaled
screen-space change of the motion from the idle (the face points follow the Head bone), so the proportions are our figure's and
the feet the library plants stay planted. OUT.json: {"phi", "scale_px_per_m", "fit_rms_px", "frames": [[{x,y,label,z_index}*18]*N]}.
Pure functions are tested in test_routes.py."""
from __future__ import annotations
import json
import math
import sys

import numpy as np

SIZE = 128
JOINT = {  # label -> library bone
    "NECK": "neck_01", "LEFT SHOULDER": "upperarm_l", "RIGHT SHOULDER": "upperarm_r",
    "LEFT ELBOW": "lowerarm_l", "RIGHT ELBOW": "lowerarm_r", "LEFT ARM": "hand_l", "RIGHT ARM": "hand_r",
    "LEFT HIP": "thigh_l", "RIGHT HIP": "thigh_r", "LEFT KNEE": "calf_l", "RIGHT KNEE": "calf_r",
    "LEFT LEG": "foot_l", "RIGHT LEG": "foot_r",
    "NOSE": "Head", "LEFT EYE": "Head", "RIGHT EYE": "Head", "LEFT EAR": "Head", "RIGHT EAR": "Head",
}
BODY = [k for k in JOINT if JOINT[k] != "Head"]
EDGES = [("NECK", "LEFT SHOULDER"), ("NECK", "RIGHT SHOULDER"), ("LEFT SHOULDER", "LEFT ELBOW"), ("LEFT ELBOW", "LEFT ARM"),
         ("RIGHT SHOULDER", "RIGHT ELBOW"), ("RIGHT ELBOW", "RIGHT ARM"), ("NECK", "LEFT HIP"), ("NECK", "RIGHT HIP"),
         ("LEFT HIP", "LEFT KNEE"), ("LEFT KNEE", "LEFT LEG"), ("RIGHT HIP", "RIGHT KNEE"), ("RIGHT KNEE", "RIGHT LEG"),
         ("NOSE", "NECK"), ("NOSE", "LEFT EYE"), ("NOSE", "RIGHT EYE"), ("LEFT EYE", "LEFT EAR"), ("RIGHT EYE", "RIGHT EAR")]


def project(p, phi_deg: float, elev_deg: float):
    """Library metres (x left of the figure, y up, z forward) to screen metres (right, down). The figure faces screen-left turned
    phi degrees toward the camera; the character's left is the side nearer the camera."""
    phi, el = math.radians(phi_deg), math.radians(elev_deg)
    p = np.asarray(p, float)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    # ground plane (screen right X, toward camera D): forward f = (-cos phi, sin phi), left l = (sin phi, cos phi)
    X = x * math.sin(phi) + z * -math.cos(phi)
    D = x * math.cos(phi) + z * math.sin(phi)
    return np.stack([X, -y * math.cos(el) + D * math.sin(el)], -1)


def fit_similarity(src, dst):
    """Uniform scale s and offset t minimising |s*src + t - dst|; returns s, t, rms."""
    sm, dm = src.mean(0), dst.mean(0)
    a, b = src - sm, dst - dm
    s = float((a * b).sum() / max((a * a).sum(), 1e-12))
    t = dm - s * sm
    rms = float(np.sqrt(((s * src + t - dst) ** 2).sum(1).mean()))
    return s, t, rms


def fit_camera(ref_pos, est_px, elev_deg: float):
    """Grid search over phi: the angle whose projection of the idle pose is closest (after scale and offset) to the estimate."""
    best = None
    for phi in range(0, 91):
        src = np.array([project(ref_pos[JOINT[k]], phi, elev_deg) for k in BODY])
        dst = np.array([est_px[k] for k in BODY])
        s, t, rms = fit_similarity(src, dst)
        if s > 0 and (best is None or rms < best[3]):
            best = (phi, s, t, rms)
    return best


ARM = {"LEFT ELBOW": "LEFT SHOULDER", "LEFT ARM": "LEFT SHOULDER", "RIGHT ELBOW": "RIGHT SHOULDER", "RIGHT ARM": "RIGHT SHOULDER"}


def retarget(motion, ref, est, elev=35.0, phi=None, arm_gain=1.0):
    bones = motion["bones"]
    idx = {b: bones.index(b) for b in set(JOINT.values())}
    ref_idx = {b: ref["bones"].index(b) for b in idx}
    ref_pos = {b: np.array(ref["pos"][0][ref_idx[b]]) for b in idx}
    est_px = {p["label"]: np.array([p["x"], p["y"]]) * SIZE for p in est}
    z_index = {p["label"]: p.get("z_index", 0) for p in est}
    if phi is None:
        phi, s, t, rms = fit_camera(ref_pos, est_px, elev)
    else:  # the turn is forced (a side-ish view of the swing); only the scale is fitted
        src = np.array([project(ref_pos[JOINT[k]], phi, elev) for k in BODY])
        s, t, rms = fit_similarity(src, np.array([est_px[k] for k in BODY]))
    ref_scr = {b: project(ref_pos[b], phi, elev) * s for b in idx}
    frames = []
    for fr in motion["pos"]:
        kps = []
        for label, bone in JOINT.items():
            now = project(np.array(fr[idx[bone]]), phi, elev) * s
            xy = est_px[label] + (now - ref_scr[bone])
            if label in ARM and arm_gain != 1.0:  # the reach of the arm from its own shoulder is exaggerated, as the drawn swing is
                sh = JOINT[ARM[label]]
                sh_delta = project(np.array(fr[idx[sh]]), phi, elev) * s - ref_scr[sh]
                xy = est_px[label] + sh_delta + arm_gain * ((now - ref_scr[bone]) - sh_delta)
            kps.append({"x": float(np.clip(xy[0] / SIZE, 0, 1)), "y": float(np.clip(xy[1] / SIZE, 0, 1)), "label": label, "z_index": int(z_index[label])})
        frames.append(kps)
    return {"phi": phi, "scale_px_per_m": round(s, 2), "fit_rms_px": round(rms, 2), "frames": frames}


def overlay(image_path, out_path, frames_kp, picks, zoom=4):
    from PIL import Image, ImageDraw
    base = Image.open(image_path).convert("RGBA")
    bg = Image.new("RGBA", base.size, (120, 140, 120, 255))
    bg.alpha_composite(base)
    big = bg.resize((base.width * zoom, base.height * zoom), Image.NEAREST).convert("RGB")
    d = ImageDraw.Draw(big)
    cols = [(255, 255, 255), (255, 60, 60), (60, 60, 255), (255, 255, 60), (60, 255, 255), (255, 60, 255)]
    for c, i in zip(cols, picks):
        pts = {k["label"]: (k["x"] * SIZE * zoom, k["y"] * SIZE * zoom) for k in frames_kp[i]}
        for a, b in EDGES:
            d.line([pts[a], pts[b]], fill=c, width=2)
    big.save(out_path)


def main():
    a = [x for x in sys.argv[1:]]
    opts = {}
    for flag in ("--overlay", "--image", "--elev", "--phi", "--arm-gain"):
        if flag in a:
            i = a.index(flag)
            opts[flag] = a[i + 1]
            del a[i:i + 2]
    motion, ref, est = (json.load(open(p)) for p in a[:3])
    est = est["keypoints"] if "keypoints" in est else est
    res = retarget(motion, ref, est, float(opts.get("--elev", 35)), float(opts["--phi"]) if "--phi" in opts else None, float(opts.get("--arm-gain", 1.0)))
    json.dump(res, open(a[3], "w"))
    print(f"phi {res['phi']} deg, {res['scale_px_per_m']} px/m, fit rms {res['fit_rms_px']} px, {len(res['frames'])} frames")
    if "--overlay" in opts:
        n = len(res["frames"])
        overlay(opts["--image"], opts["--overlay"], res["frames"], [0, n // 8, n // 4, n * 3 // 8, n // 2, n * 3 // 4])


if __name__ == "__main__":
    main()
