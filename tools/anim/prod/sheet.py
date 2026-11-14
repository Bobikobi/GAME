#!/usr/bin/env python3
"""Contact sheet of a clip for the eye read: frames in a grid, numbered, optionally with the kept stance as the first cell.
  sheet.py OUT.png CLIP_DIR [--kept-stance PNG] [--cols 6] [--zoom 2] [--crop X0,Y0,X1,Y1] [--halo]"""
import argparse, glob, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gates


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("clip")
    ap.add_argument("--kept-stance", default=""); ap.add_argument("--cols", type=int, default=6); ap.add_argument("--zoom", type=int, default=2)
    ap.add_argument("--crop", default="20,12,108,124"); ap.add_argument("--bg", default="70,96,58")
    a = ap.parse_args(argv)
    x0, y0, x1, y1 = [int(v) for v in a.crop.split(",")]
    files = sorted(glob.glob(str(Path(a.clip) / "f[0-9]*.png"))) or sorted(glob.glob(str(Path(a.clip) / "*.png")))
    cells = ([("kept", a.kept_stance)] if a.kept_stance else []) + [(str(i), f) for i, f in enumerate(files)]
    w, h = (x1 - x0) * a.zoom, (y1 - y0) * a.zoom
    rows = -(-len(cells) // a.cols)
    sheet = Image.new("RGBA", (w * a.cols, h * rows), tuple(int(v) for v in a.bg.split(",")) + (255,))
    d = ImageDraw.Draw(sheet)
    for k, (label, f) in enumerate(cells):
        arr = gates.load(f)[y0:y1, x0:x1]
        cx, cy = (k % a.cols) * w, (k // a.cols) * h
        sheet.alpha_composite(Image.fromarray(gates.scale(arr, a.zoom)), (cx, cy))
        d.text((cx + 3, cy + 2), label, fill=(255, 255, 255, 255))
        d.line([(cx, cy), (cx, cy + h)], fill=(0, 0, 0, 255))
    sheet.convert("RGB").save(a.out)
    print(a.out, sheet.size)


if __name__ == "__main__":
    main()
