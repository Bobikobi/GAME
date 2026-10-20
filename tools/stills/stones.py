#!/usr/bin/env python3
"""Draw the stepping-stone library and three path recipes.

    python3 tools/stills/stones.py

Pillow only, no network and no model call. Writes 18 1x stone options under
tools/stills/stones/, a manifest beside them, and two 390x844 sheets at 3x:

    docs/design/frames/2026-10-20-stones-options.png
    docs/design/frames/2026-10-20-stones-recipes.png

The options are shown on the L1/L2 stone ramp; the recipes use the same
path and the same light, and differ only in the stone mix.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import compose as C

HERE = Path(__file__).resolve().parent
LIB = HERE / "stones"
SHEET_OPTIONS = C.FRAMES / "2026-10-20-stones-options.png"
SHEET_RECIPES = C.FRAMES / "2026-10-20-stones-recipes.png"

LOOK = C.material_look()
COLOUR = C.Roles(LOOK)
FONT = ImageFont.load_default()

FAMILIES = ("oval", "slab", "split", "pair", "moss", "pebbles")
TIERS = ("S", "M", "L")

# The nominal size of each family and tier, in art px, before the per-stone
# jitter. The library keeps the nominal size; a recipe may vary it by 1 px.
SIZES = {
    "oval": {"S": (11, 7), "M": (17, 10), "L": (25, 14)},
    "slab": {"S": (13, 8), "M": (19, 11), "L": (28, 15)},
    "split": {"S": (12, 8), "M": (18, 11), "L": (27, 15)},
    "pair": {"S": (16, 9), "M": (22, 11), "L": (31, 15)},
    "moss": {"S": (12, 8), "M": (18, 11), "L": (26, 14)},
    "pebbles": {"S": (12, 7), "M": (16, 9), "L": (22, 11)},
}

RECIPES = {
    "A": {
        "name": "Rounded",
        "families": {"oval": 0.60, "pair": 0.20, "pebbles": 0.20},
        "sizes": {"S": 0.30, "M": 0.45, "L": 0.25},
        "path": 10,
        "full_path": 12,
        "loose": 4,
        "gap": (10, 18),
        "pair": 0.15,
    },
    "B": {
        "name": "Angular",
        "families": {"slab": 0.55, "split": 0.25, "moss": 0.20},
        "sizes": {"S": 0.25, "M": 0.45, "L": 0.30},
        "path": 9,
        "full_path": 11,
        "loose": 3,
        "gap": (12, 20),
        "pair": 0.10,
    },
    "C": {
        "name": "Mixed",
        "families": {"oval": 0.35, "slab": 0.30, "pair": 0.15, "moss": 0.10,
                     "pebbles": 0.10},
        "sizes": {"S": 0.35, "M": 0.45, "L": 0.20},
        "path": 12,
        "full_path": 14,
        "loose": 6,
        "gap": (8, 16),
        "pair": 0.25,
    },
}


# ------------------------------------------------------------------ shapes


def _outline(d, pts, c):
    d.polygon(pts, fill=c.cobble_dark + (255,))


def _slab_pts(x, y, w, h):
    return [
        (x + 2, y + h // 2),
        (x + w // 4, y + 1),
        (x + w - 3, y + 1),
        (x + w, y + h // 3),
        (x + w - 1, y + h),
        (x + w // 4, y + h),
        (x + 1, y + h - 2),
    ]


def _slab_body(x, y, w, h):
    return [
        (x + 3, y + h // 2),
        (x + w // 4 + 1, y + 2),
        (x + w - 4, y + 2),
        (x + w - 2, y + h // 3),
        (x + w - 2, y + h - 2),
        (x + w // 4 + 1, y + h - 1),
        (x + 2, y + h - 3),
    ]


def _slab(d, x, y, w, h, c, r):
    _outline(d, _slab_pts(x, y, w, h), c)
    body = _slab_body(x, y, w, h)
    d.polygon(body, fill=c.cobble_mid + (255,))
    d.line([body[1], body[2]], fill=c.cobble_light + (255,))
    d.line([body[4], body[5]], fill=c.cobble_dark + (255,))
    if r.random() < 0.35:
        d.line([(x + w // 2, y + 2), (x + w // 2 + 1, y + h - 2)],
               fill=c.cobble_dark + (255,))


def _oval(d, x, y, w, h, c, r):
    d.ellipse([x - 1, y - 1, x + w + 1, y + h + 1], fill=c.cobble_dark + (255,))
    d.ellipse([x, y, x + w, y + h], fill=c.cobble_mid + (255,))
    d.ellipse([x + 2, y + 1, x + w - 2, y + max(2, h // 2)],
              fill=c.cobble_light + (255,))
    d.line([(x + 2, y + h - 1), (x + w - 2, y + h - 1)],
           fill=c.cobble_dark + (255,))
    d.line([(x + w - 1, y + 3), (x + w - 1, y + h - 3)],
           fill=c.cobble_dark + (255,))
    if r.random() < 0.4:
        d.point((x + r.randrange(3, max(4, w - 3)),
                 y + r.randrange(2, max(3, h - 2))),
                fill=c.cobble_dark + (255,))


def _split(d, x, y, w, h, c, r):
    _slab(d, x, y, w, h, c, r)
    crack_x = x + w // 2 + r.choice([-1, 0, 1])
    d.line([(crack_x, y + 3), (crack_x + 1, y + h // 2),
            (crack_x, y + h - 2)], fill=c.cobble_dark + (255,))
    d.rectangle([x + w - 4, y + h // 2, x + w - 3, y + h // 2 + 1],
                fill=c.cobble_dark + (255,))


def _pair(d, x, y, w, h, c, r):
    _oval(d, x, y + h // 3, max(6, w // 3), max(5, h * 2 // 3), c, r)
    _oval(d, x + w // 3, y + 1, w * 2 // 3, h - 2, c, r)


def _moss(d, x, y, w, h, c, r):
    _slab(d, x, y, w, h, c, r)
    for _ in range(4):
        px = x + r.randrange(2, max(3, w - 2))
        py = y + r.randrange(0, max(1, h // 3))
        d.point((px, py), fill=(c.grass_dark if r.random() < 0.6
                                else c.grass_light) + (255,))
    C.tuft(d, x + r.randrange(2, max(3, w - 3)), y + 1,
           c.grass_dark, c.grass_light, c.grass_outline,
           r.choice([-1, 0, 1]), 3 + r.randrange(3), r)


def _pebbles(d, x, y, w, h, c, r):
    parts = [
        (x + 1, y + h // 2, max(4, w // 3), max(4, h // 2)),
        (x + w // 3, y + h // 4, max(4, w // 3), max(4, h // 2)),
        (x + 2 * w // 3, y + h // 2, max(3, w // 3 - 1), max(4, h // 2)),
        (x + w // 4, y + h - 2, max(3, w // 4), max(3, h // 3)),
    ]
    for i, (px, py, pw, ph) in enumerate(parts):
        body = c.cobble_alt if i == 1 else c.cobble_mid
        d.ellipse([px - 1, py - 1, px + pw + 1, py + ph + 1],
                  fill=c.cobble_dark + (255,))
        d.ellipse([px, py, px + pw, py + ph], fill=body + (255,))
        d.point((px + 1, py + 1), fill=c.cobble_light + (255,))


def draw_stone(d, x, y, family, w, h, c, r):
    """Draw one stone with its top-left at (x, y), on a 1x image."""
    if family == "oval":
        _oval(d, x, y, w, h, c, r)
    elif family == "slab":
        _slab(d, x, y, w, h, c, r)
    elif family == "split":
        _split(d, x, y, w, h, c, r)
    elif family == "pair":
        _pair(d, x, y, w, h, c, r)
    elif family == "moss":
        _moss(d, x, y, w, h, c, r)
    elif family == "pebbles":
        _pebbles(d, x, y, w, h, c, r)
    else:
        raise ValueError(family)


def draw_shadow(d, cx, baseline, w, c, on_path=True):
    col = c.path_dark if on_path else c.grass_dark
    d.ellipse([cx - w // 2, baseline - 2, cx + w // 2, baseline + 2],
              fill=col + (255,))


# ------------------------------------------------------------------ library


def make_library():
    LIB.mkdir(parents=True, exist_ok=True)
    options = []
    n = 0
    for family in FAMILIES:
        for tier in TIERS:
            n += 1
            w, h = SIZES[family][tier]
            r = C.seeded(100 + n)
            img = C.canvas(w + 4, h + 4)
            d = ImageDraw.Draw(img)
            draw_stone(d, 2, 2, family, w, h, COLOUR, r)
            filename = f"{n:02d}-{family}-{tier.lower()}.png"
            img.save(LIB / filename)
            options.append({
                "id": n,
                "family": family,
                "tier": tier,
                "w": w,
                "h": h,
                "file": filename,
            })
    manifest = {
        "palette": "stone ramp from #3a3230 to #eadcc4; outlines stone[0]",
        "scale": "1x art pixels; the sheets are 3x (1170x2532)",
        "tile": C.TILE,
        "recipes_note": ("path is the 240 px crop on the recipe sheet; full_path "
                         "is the 284 px scene path; loose stones are extra."),
        "options": options,
        "recipes": RECIPES,
    }
    (LIB / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return options


# ------------------------------------------------------------------ recipes


def centre(ly: int) -> int:
    return 195 + int(24 * math.sin((ly - 24) / 70)) + int((ly - 24) * 0.03)


def weighted(r, weights: dict[str, float]) -> str:
    keys = list(weights)
    values = [weights[k] for k in keys]
    return r.choices(keys, weights=values, k=1)[0]


def tier_plan(rec: dict, n: int, r) -> list[str]:
    """A shuffled tier list with the recipe's declared size mix."""
    counts = {t: int(round(rec["sizes"][t] * n)) for t in TIERS}
    while sum(counts.values()) < n:
        counts["M"] += 1
    while sum(counts.values()) > n:
        counts[max(counts, key=counts.get)] -= 1
    plan = [t for t in TIERS for _ in range(counts[t])]
    r.shuffle(plan)
    return plan


def draw_path_strip(img, c, y0: int, y1: int, r):
    """A dirt path with ragged edges, for a recipe crop."""
    d = ImageDraw.Draw(img)
    for ly in range(y0, y1):
        cx = centre(ly)
        hw = 11 + int(5 * math.sin(ly / 17))
        for x in range(cx - hw, cx + hw):
            edge = abs(x - cx) / max(1, hw)
            if edge > 0.78 and r.random() < 0.5:
                continue
            col = c.path_base if r.random() < 0.85 else c.path_dark
            d.point((x, ly), fill=col + (255,))
        if r.random() < 0.35:
            C.tuft(d, cx - hw - 1, ly, c.grass_dark, c.grass_light,
                   c.grass_outline, r.choice([-1, 0, 1]), 3 + r.randrange(4), r)
        if r.random() < 0.35:
            C.tuft(d, cx + hw + 1, ly, c.grass_dark, c.grass_light,
                   c.grass_outline, r.choice([-1, 0, 1]), 3 + r.randrange(4), r)


def place_stones(img, c, rec: dict, y0: int, y1: int, seed: int,
                 centre_fn=None):
    """Lay the stones only, on a path that is already drawn."""
    cx_of = centre_fn or centre
    d = ImageDraw.Draw(img)
    r = C.seeded(seed)
    y = y0 + 8
    count = 0
    total = 0
    tiers = {"S": 0, "M": 0, "L": 0}
    plan = tier_plan(rec, rec["path"], r)
    while y < y1 - 10 and count < rec["path"]:
        family = weighted(r, rec["families"])
        tier = plan[count]
        w, h = SIZES[family][tier]
        w = max(5, w + r.choice([-1, 0, 0, 1]))
        h = max(4, h + r.choice([-1, 0, 0, 1]))
        hw = 11 + int(5 * math.sin(y / 17))
        span = max(0, hw - w // 2 + 2)
        cx = cx_of(y) + (r.randrange(-span, span + 1) if span else 0)
        draw_shadow(d, cx, y, w, c, on_path=True)
        draw_stone(d, cx - w // 2, y - h, family, w, h, c, r)
        tiers[tier] += 1
        count += 1
        total += 1
        y += h + r.randrange(rec["gap"][0], rec["gap"][1] + 1)
        if r.random() < rec.get("pair", 0) and y < y1 - 8:
            pw, ph = SIZES["oval"]["S"]
            side = r.choice([-1, 1])
            pcx = cx + side * (w // 2 + r.randrange(2, 7))
            draw_shadow(d, pcx, y - h // 2, pw, c, on_path=True)
            draw_stone(d, pcx - pw // 2, y - h // 2 - ph, "oval",
                       pw, ph, c, r)
            tiers["S"] += 1
            total += 1
    for _ in range(rec["loose"]):
        ly = r.randrange(y0 + 16, max(y0 + 17, y1 - 10))
        side = r.choice([-1, 1])
        cx = cx_of(ly) + side * r.randrange(18, 42)
        family = "pebbles" if r.random() < 0.45 else "oval"
        w, h = SIZES[family]["S"]
        draw_shadow(d, cx, ly, w, c, on_path=False)
        draw_stone(d, cx - w // 2, ly - h, family, w, h, c, r)
        tiers["S"] += 1
        total += 1
    return total, tiers


def place_recipe(img, c, rec: dict, y0: int, y1: int, seed: int):
    """Draw the path and then one recipe's stones on it."""
    r = C.seeded(seed)
    draw_path_strip(img, c, y0, y1, r)
    return place_stones(img, c, rec, y0, y1, seed, centre)


# ------------------------------------------------------------------ sheets


def text(img, xy, s, fill):
    """Draw a hard-edged label; the default font is thresholded, never blended."""
    box = FONT.getbbox(s)
    w = max(1, box[2] - box[0]) + 2
    h = max(1, box[3] - box[1]) + 2
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text((0, 0), s, font=FONT, fill=255)
    mask = mask.point(lambda p: 255 if p >= 128 else 0)
    layer = Image.new("RGBA", (w, h), fill + (255,))
    img.paste(layer, (int(xy[0]), int(xy[1])), mask)


def option_sheet(options):
    img = C.canvas()
    C.draw_meadow(img, LOOK, COLOUR, 0, C.H, False, 71)
    d = ImageDraw.Draw(img)
    C.rect(d, [0, 0, C.W, 32], COLOUR.grass_outline)
    text(img, (8, 9), "STEPPING STONES  -  18 OPTIONS", COLOUR.grass_light)
    for i, o in enumerate(options):
        col = i % 3
        row = i // 3
        x0 = 8 + col * 125
        y0 = 40 + row * 120
        C.rect(d, [x0, y0, x0 + 120, y0 + 16], COLOUR.grass_outline)
        text(img, (x0 + 5, y0 + 4),
             f"{o['id']}  {o['family']} {o['tier']}  {o['w']}x{o['h']}",
             COLOUR.grass_light)
        d.rounded_rectangle([x0 + 6, y0 + 22, x0 + 114, y0 + 92], radius=10,
                            fill=COLOUR.path_base + (255,))
        d.rounded_rectangle([x0 + 8, y0 + 24, x0 + 112, y0 + 90], radius=9,
                            fill=COLOUR.path_alt + (255,))
        for _ in range(5):
            C.tuft(d, x0 + 10 + 100 * (i % 3) // 3, y0 + 26,
                   COLOUR.grass_dark, COLOUR.grass_light, COLOUR.grass_outline,
                   1, 3, C.seeded(500 + i))
        cx = x0 + 60
        baseline = y0 + 66
        d.ellipse([cx - o["w"], baseline - 2, cx + o["w"], baseline + 3],
                  fill=COLOUR.path_dark + (255,))
        tmp = C.canvas(o["w"] + 4, o["h"] + 4)
        draw_stone(ImageDraw.Draw(tmp), 2, 2, o["family"], o["w"], o["h"],
                   COLOUR, C.seeded(100 + o["id"]))
        tmp = tmp.resize(((o["w"] + 4) * 2, (o["h"] + 4) * 2), Image.NEAREST)
        img.alpha_composite(tmp, (cx - tmp.width // 2, baseline - tmp.height + 2))
    C.rect(d, [0, 800, C.W, C.H], COLOUR.grass_outline)
    text(img, (8, 808),
         "Stones shown at 2x; sizes are 1x.  S 11-13 / M 16-22 / L 22-31 px.",
         COLOUR.grass_light)
    text(img, (8, 822), "A 64 px tile is the width of the bar below.",
         COLOUR.grass_light)
    C.rect(d, [8, 834, 8 + C.TILE, 836], COLOUR.grass_light)
    out = img.resize((C.W * C.SCALE, C.H * C.SCALE), Image.NEAREST)
    out.save(SHEET_OPTIONS)


def recipe_sheet():
    img = C.canvas()
    C.draw_meadow(img, LOOK, COLOUR, 0, C.H, False, 99)
    d = ImageDraw.Draw(img)
    C.rect(d, [0, 0, C.W, 30], COLOUR.grass_outline)
    text(img, (8, 8), "THREE STONE RECIPES  -  THE SAME PATH", COLOUR.grass_light)
    for i, (key, rec) in enumerate(RECIPES.items()):
        y0 = 34 + i * 268
        y1 = y0 + 258
        C.draw_meadow(img, LOOK, COLOUR, y0, y1, False, 100 + i)
        count, tiers = place_recipe(img, COLOUR, rec, y0 + 24, y1 - 22,
                                    700 + i)
        C.rect(d, [0, y0, C.W, y0 + 24], COLOUR.grass_outline)
        text(img, (8, y0 + 8), f"{key}  {rec['name']}", COLOUR.grass_light)
        C.rect(d, [0, y1 - 20, C.W, y1], COLOUR.grass_outline)
        text(img, (8, y1 - 15),
             f"{count} stones ({rec['loose']} loose)  S{tiers['S']} M{tiers['M']} "
             f"L{tiers['L']}  gaps {rec['gap'][0]}-{rec['gap'][1]}  "
             f"~{rec['full_path'] + rec['loose']} on path",
             COLOUR.grass_light)
    out = img.resize((C.W * C.SCALE, C.H * C.SCALE), Image.NEAREST)
    out.save(SHEET_RECIPES)


# ------------------------------------------------------------------ check


def main() -> None:
    options = make_library()
    option_sheet(options)
    recipe_sheet()
    allowed = C.declared_colors(LOOK, "L2")
    allowed |= {(r << 16) | (g << 8) | b for r, g, b in C.all_ramp_colors(LOOK)}
    for path in (SHEET_OPTIONS, SHEET_RECIPES):
        w, h = C.check(path, allowed)
        print(f"{path.name}: {w}x{h}, in the declared ramps")
    print(f"{len(options)} options in {LIB}")
    print("recipes: " + ", ".join(f"{k} {v['name']}" for k, v in RECIPES.items()))


if __name__ == "__main__":
    main()
