#!/usr/bin/env python3
"""R2 of the animation routes trial (#762): the approved human stance cut into parts and driven by joint angles.

  python3 cutout.py STANCE.png OUT_DIR [--frames 32] [--reduce nearest|vote]

The parts are cut from the stance by plain pixel rules (head above row 51, torso, two arms split at the elbow row, the legs below
row 83), each with a pivot. A pose is {shoulder_l, elbow_l, shoulder_r, elbow_r, lean, drop} in degrees and pixels; limits clamp
every angle. Parts are drawn 4x enlarged, rotated about their pivots by nearest sampling, layered back to front, then reduced to
the game's size by 'nearest' (centre sample) or 'vote' (the commonest colour of each 4 x 4 block, opaque when 8 of 16 are).
`pose_at(t)` (pure) gives the swing's pose for t in [0, 1); `clamp_pose` is the limit table. Pure functions are tested in test_cutout.py."""
from __future__ import annotations
import argparse
import math
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

S = 4  # enlargement while drawing
HEAD_ROW, LEG_ROW, ELBOW_ROW = 51, 83, 70
PIV = {"head": (62, 52), "torso": (62, 83), "arm_l": (53, 57), "fore_l": (50, 70), "arm_r": (73, 57), "fore_r": (74, 71)}
LIMITS = {"shoulder_l": (0, 175), "elbow_l": (-10, 120), "shoulder_r": (0, 175), "elbow_r": (-10, 120), "lean": (-12, 12), "drop": (0, 6)}


def clamp_pose(p: dict) -> dict:
    return {k: min(max(v, LIMITS[k][0]), LIMITS[k][1]) for k, v in p.items()}


def ease(x: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * min(max(x, 0.0), 1.0))


def pose_at(t: float) -> dict:
    """One swing, t in [0,1): rest, wind-up over the head (0.15..0.5), hold, strike down (0.58..0.72), recover."""
    if t < 0.5:
        up = ease(t / 0.5)
        lean, drop = -6 * up, 1 * up
    elif t < 0.58:
        up, lean, drop = 1.0, -6.0, 1.0
    elif t < 0.72:
        k = ease((t - 0.58) / 0.14)
        up, lean, drop = 1 - k, -6 + 20 * k, 1 + 4 * k
    else:
        k = ease((t - 0.72) / 0.28)
        up, lean, drop = 0.0, 14 * (1 - k), 5 * (1 - k)
    sh = 168 * up
    el = 30 * up
    return clamp_pose({"shoulder_l": sh, "elbow_l": el, "shoulder_r": sh, "elbow_r": el, "lean": lean, "drop": drop})


def split_parts(img: np.ndarray) -> dict[str, np.ndarray]:
    """Each part is a full-size RGBA array holding only its own pixels. The torso also holds a skin patch where an arm hung."""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    op = img[..., 3] > 0
    head = op & (yy < HEAD_ROW)
    legs = op & (yy >= LEG_ROW)
    body = op & ~head & ~legs
    arm_l = body & (xx <= 54) & (yy >= 53)
    arm_r = body & (xx >= 72) & (yy >= 53)
    torso = body & ~arm_l & ~arm_r
    masks = {"head": head, "torso": torso, "legs": legs, "arm_l": arm_l & (yy < ELBOW_ROW), "fore_l": arm_l & (yy >= ELBOW_ROW),
             "arm_r": arm_r & (yy < ELBOW_ROW), "fore_r": arm_r & (yy >= ELBOW_ROW)}
    parts = {}
    for name, m in masks.items():
        a = np.zeros_like(img)
        a[m] = img[m]
        parts[name] = a
    # patch: where the arms hung, the torso keeps a skin-coloured fill inside its own side so no hole opens
    skin = np.median(img[torso & (yy > 56) & (yy < 68)][:, :3], axis=0).astype(np.uint8)
    for m, xs in ((arm_l & (yy < LEG_ROW), range(55, 58)), (arm_r & (yy < LEG_ROW), range(69, 72))):
        rows = np.unique(np.where(m)[0])
        for y in rows:
            for x in xs:
                if not parts["torso"][y, x, 3]:
                    parts["torso"][y, x] = (*skin, 255)
    return parts


def draw(part: np.ndarray, pivot, angle: float, dx: float, dy: float) -> Image.Image:
    big = Image.fromarray(part, "RGBA").resize((part.shape[1] * S, part.shape[0] * S), Image.NEAREST)
    c = ((pivot[0] + 0.5) * S, (pivot[1] + 0.5) * S)
    rot = big.rotate(angle, resample=Image.NEAREST, center=c)
    return rot.transform(rot.size, Image.AFFINE, (1, 0, -dx * S, 0, 1, -dy * S), resample=Image.NEAREST)


def rotated_point(p, pivot, deg):
    r = math.radians(deg)  # same sense as PIL rotate: counter-clockwise on screen for a positive angle
    x, y = p[0] - pivot[0], p[1] - pivot[1]
    return (pivot[0] + x * math.cos(r) + y * math.sin(r), pivot[1] - x * math.sin(r) + y * math.cos(r))


def render(parts: dict, pose: dict, size) -> Image.Image:
    p = pose
    canvas = Image.new("RGBA", (size[0] * S, size[1] * S), (0, 0, 0, 0))
    canvas.alpha_composite(draw(parts["legs"], (62, 100), 0, 0, 0))
    # arms behind the torso for the far arm (left of the screen), in front for the near one
    layers = []
    for side, sgn in (("l", 1), ("r", -1)):
        sh, el = p["shoulder_" + side] * sgn, p["elbow_" + side] * sgn
        arm_piv, fore_piv = PIV["arm_" + side], PIV["fore_" + side]
        fx, fy = rotated_point(fore_piv, arm_piv, -sh)
        layers.append((side, draw(parts["arm_" + side], arm_piv, -sh, 0, p["drop"]),
                       draw(parts["fore_" + side], fore_piv, -sh - el, fx - fore_piv[0], fy - fore_piv[1] + p["drop"])))
    canvas.alpha_composite(draw(parts["torso"], PIV["torso"], -p["lean"], 0, p["drop"]))
    for side, a, f in layers:
        canvas.alpha_composite(a)
        canvas.alpha_composite(f)
    canvas.alpha_composite(draw(parts["head"], PIV["head"], -p["lean"] * 1.5, 0, p["drop"] + 0))
    return canvas


def reduce_img(canvas: Image.Image, how: str) -> Image.Image:
    a = np.array(canvas)
    h, w = a.shape[0] // S, a.shape[1] // S
    if how == "nearest":
        out = a[S // 2::S, S // 2::S].copy()
        out[..., 3] = np.where(out[..., 3] > 127, 255, 0)
        out[out[..., 3] == 0, :3] = 0
        return Image.fromarray(out, "RGBA")
    out = np.zeros((h, w, 4), np.uint8)
    blocks = a.reshape(h, S, w, S, 4).transpose(0, 2, 1, 3, 4).reshape(h, w, S * S, 4)
    for y in range(h):
        for x in range(w):
            b = blocks[y, x]
            op = b[b[:, 3] > 127]
            if len(op) * 2 >= S * S:
                col = Counter(map(tuple, op[:, :3])).most_common(1)[0][0]
                out[y, x] = (*col, 255)
    return Image.fromarray(out, "RGBA")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("stance")
    ap.add_argument("out")
    ap.add_argument("--frames", type=int, default=32)
    ap.add_argument("--reduce", choices=["nearest", "vote"], default="vote")
    a = ap.parse_args()
    img = np.array(Image.open(a.stance).convert("RGBA"))
    parts = split_parts(img)
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for i in range(a.frames):
        reduce_img(render(parts, pose_at(i / a.frames), (img.shape[1], img.shape[0])), a.reduce).save(Path(a.out) / f"f{i:02d}.png")
    print(a.frames, "frames ->", a.out)


if __name__ == "__main__":
    main()
