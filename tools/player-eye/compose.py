#!/usr/bin/env python3
"""A still for the player-eye reviewer: a kit object beside the standing human at game scale.

Needs Pillow (a drawing helper, not part of review.py). The object's drawn height is its kit `scale`
(characters, content/kit/<kit>/kit.json), the figure is the first frame of chars/human_down (scale 1),
both cut to their drawn pixels and set on one grey ground. Nothing is drawn: it only places existing sprites.

  python3 tools/player-eye/compose.py props/rock_small OUT.png [--kit core] [--grow 3]
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def trim(img):
    box = img.getbbox()
    return img.crop(box) if box else img


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", help="sprite name in the kit, e.g. props/rock_small")
    ap.add_argument("out")
    ap.add_argument("--kit", default="core")
    ap.add_argument("--grow", type=int, default=3, help="whole-number enlargement of the finished still (default 3)")
    a = ap.parse_args()
    kit = ROOT / "content" / "kit" / a.kit
    sprites = json.loads((kit / "kit.json").read_text())["kit"]["sprites"]
    spec = sprites[a.name]
    if "scale" not in spec:
        raise SystemExit(f"{a.name} declares no scale: it is not a world sprite, so there is no size to set beside a figure")
    fig_spec = sprites["chars/human_down"]
    fig = trim(Image.open(kit / "chars/human_down.png").convert("RGBA").crop((0, 0, fig_spec["w"], fig_spec["h"])))
    obj = trim(Image.open(kit / spec["file"]).convert("RGBA").crop((0, 0, spec["w"], spec["h"])))
    # the figure is `fig_spec.scale` characters tall; the object is spec.scale characters tall
    px_per_char = fig.height / fig_spec["scale"]
    height = max(1, round(spec["scale"] * px_per_char))
    obj = obj.resize((max(1, round(obj.width * height / obj.height)), height), Image.NEAREST)
    pad = 12
    w = fig.width + obj.width + 3 * pad
    h = max(fig.height, obj.height) + 2 * pad
    still = Image.new("RGBA", (w, h), (198, 202, 214, 255))
    still.alpha_composite(fig, (pad, h - pad - fig.height))
    still.alpha_composite(obj, (2 * pad + fig.width, h - pad - obj.height))
    still = still.resize((w * a.grow, h * a.grow), Image.NEAREST)
    still.convert("RGB").save(a.out)
    print(f"{a.out}: figure {fig.height} px tall (1 character), object {obj.height} px ({spec['scale']} characters), enlarged x{a.grow}")


if __name__ == "__main__":
    main()
