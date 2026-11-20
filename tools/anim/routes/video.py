#!/usr/bin/env python3
"""A looping MP4 of one clip for a phone (#762): video.py FRAMES_DIR OUT.mp4 --ms 48 --label "R1b 30 frames" [--seconds 13] [--zoom 4]

Frames (f*.png, 128 x 128 RGBA) are put on the page's green at --zoom x (nearest), a caption bar is added, and ffmpeg loops the clip at
its own frame time for about --seconds. Needs Pillow and ffmpeg."""
import argparse
import glob
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("out")
    ap.add_argument("--ms", type=float, required=True)
    ap.add_argument("--label", default="")
    ap.add_argument("--seconds", type=float, default=13)
    ap.add_argument("--zoom", type=int, default=4)
    a = ap.parse_args()
    files = sorted(glob.glob(str(Path(a.frames) / "f*.png")))
    fps = 1000.0 / a.ms
    z = a.zoom
    with tempfile.TemporaryDirectory() as td:
        n_loops = max(1, round(a.seconds * fps / len(files)))
        k = 0
        for _ in range(n_loops):
            for f in files:
                im = Image.new("RGBA", (128 * z, 128 * z + 36), (122, 143, 122, 255))
                im.alpha_composite(Image.open(f).convert("RGBA").resize((128 * z, 128 * z), Image.NEAREST), (0, 36))
                ImageDraw.Draw(im).text((8, 10), f"{a.label}  |  {len(files)} frames, {fps:.0f} fps", fill=(10, 20, 10, 255))
                im.convert("RGB").save(Path(td) / f"v{k:05d}.png")
                k += 1
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", f"{fps:.4f}", "-i", str(Path(td) / "v%05d.png"), 
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", a.out], check=True)
    print(a.out, f"{k / fps:.1f}s")


if __name__ == "__main__":
    main()
