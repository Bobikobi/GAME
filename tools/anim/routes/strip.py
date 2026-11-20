#!/usr/bin/env python3
"""A contact strip of a folder of frames on a flat green, for a look at about 800 px: strip.py OUT.png FRAME... [--cols N] [--zoom Z]"""
import sys
from PIL import Image

args = sys.argv[1:]
cols, zoom = 8, 1
for flag in ("--cols", "--zoom"):
    if flag in args:
        i = args.index(flag)
        v = int(args[i + 1])
        del args[i:i + 2]
        cols, zoom = (v, zoom) if flag == "--cols" else (cols, v)
out, files = args[0], args[1:]
ims = [Image.open(f).convert("RGBA") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGBA", (w * cols, h * rows), (120, 140, 120, 255))
for i, im in enumerate(ims):
    sheet.alpha_composite(im, ((i % cols) * w, (i // cols) * h))
if zoom != 1:
    sheet = sheet.resize((sheet.width * zoom, sheet.height * zoom), Image.NEAREST)
sheet.convert("RGB").save(out)
print(sheet.size)
