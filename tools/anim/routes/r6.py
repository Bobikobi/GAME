#!/usr/bin/env python3
"""R6 of the animation routes trial (#762): a take's N frames doubled to 2N with no new drawing.

  python3 r6.py FRAMES_DIR OUT_DIR --mode flow|blend [--scale 4]

flow : ffmpeg minterpolate (motion-compensated) on frames enlarged by --scale over a flat key colour, the loop closed by
       repeating frame 0; the in-between frames are reduced by nearest and their opaque mask is rebuilt from the key distance.
blend: each in-between is the 50/50 mix of its two neighbours (colour weighted by alpha), mask = either neighbour opaque.
Both then snap every opaque pixel to the nearest colour of the take's own palette and cut alpha at 50%.
Output f00..f(2N-1).png, original frames at even places. Needs numpy, Pillow and ffmpeg."""
from __future__ import annotations
import argparse
import glob
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

KEY = (0, 255, 0)


def palette_of(frames: list[np.ndarray]) -> np.ndarray:
    px = np.concatenate([f[f[..., 3] > 127][:, :3] for f in frames])
    return np.unique(px, axis=0)


def snap(rgb: np.ndarray, pal: np.ndarray) -> np.ndarray:
    flat = rgb.reshape(-1, 3).astype(np.int32)
    d = ((flat[:, None, :] - pal[None].astype(np.int32)) ** 2).sum(-1)
    return pal[d.argmin(1)].reshape(rgb.shape).astype(np.uint8)


def blend_pair(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    wa, wb = (a[..., 3:] > 127).astype(float), (b[..., 3:] > 127).astype(float)
    tot = np.maximum(wa + wb, 1e-6)
    rgb = (a[..., :3] * wa + b[..., :3] * wb) / tot
    return rgb, (wa + wb)[..., 0] > 0


def flow_between(frames: list[np.ndarray], scale: int) -> list[tuple[np.ndarray, np.ndarray]]:
    n = len(frames)
    seq = frames + [frames[0], frames[0]]  # the loop closes on frame 0; a spare copy keeps the last in-between
    h, w = frames[0].shape[:2]
    out = []
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for i, f in enumerate(seq):
            im = Image.new("RGB", (w, h), KEY)
            im.paste(Image.fromarray(f, "RGBA"), (0, 0), Image.fromarray(f, "RGBA"))
            im.resize((w * scale, h * scale), Image.NEAREST).save(td / f"s{i:03d}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-framerate", "10", "-i", str(td / "s%03d.png"), "-vf",
                        "minterpolate=fps=20:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1", str(td / "o%03d.png")], check=True)
        outs = sorted(td.glob("o*.png"))
        # 2n+1 frames: even = originals, odd = in-betweens
        for j in range(1, 2 * n, 2):
            o = np.array(Image.open(outs[j]).convert("RGB").resize((w, h), Image.NEAREST))
            dist = np.abs(o.astype(int) - np.array(KEY)).sum(-1)
            out.append((o, dist > 120))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("out")
    ap.add_argument("--mode", choices=["flow", "blend"], required=True)
    ap.add_argument("--scale", type=int, default=4)
    a = ap.parse_args()
    files = sorted(glob.glob(str(Path(a.frames) / "f*.png")))
    frames = [np.array(Image.open(f).convert("RGBA")) for f in files]
    pal = palette_of(frames)
    mids = ([blend_pair(frames[i], frames[(i + 1) % len(frames)]) for i in range(len(frames))] if a.mode == "blend"
            else flow_between(frames, a.scale))
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for i, f in enumerate(frames):
        Image.fromarray(f, "RGBA").save(Path(a.out) / f"f{2 * i:02d}.png")
        rgb, m = mids[i]
        res = np.zeros_like(f)
        if m.any():
            res[..., :3] = snap(rgb, pal)
        res[..., 3] = np.where(m, 255, 0)
        res[~m, :3] = 0
        Image.fromarray(res, "RGBA").save(Path(a.out) / f"f{2 * i + 1:02d}.png")
    print(len(frames) * 2, "frames ->", a.out)


if __name__ == "__main__":
    main()
