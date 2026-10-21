#!/usr/bin/env python3
"""The nature sheets: scale, climate, season, weather and shade, on the ladder's square.

One command re-makes every frame:

    python3 tools/stills/nature.py

Pillow only, no network, no model call. It reads the tables of `nature.json`
(the tables of docs/design/NATURE.md as data), composes the 2026-10-20 ladder's
square through `compose.py` with the climate's ramps, trees and far bank, the
season's sun and the weather's look over it, and writes the frames to
docs/design/frames/ at 1170x2532. Twelve frames, one difference each:

    scale        the square at 12:00 with an adult, a child, the elder, a hen,
                 a dog, the wolf, a deer and a horse with the cart
    climate x4   temperate, dry, cold, wet - the same layout at 16:30 in summer
    season x2    autumn and winter at 16:30, temperate
    weather x3   overcast, rain and fog at 12:00, temperate summer
    shade x2     Pell at the foot of the near tree, the canopy's shade over the
                 ground only, then over him too

A frame fails if any pixel is half clear. The script prints the distinct
colours of every frame (the measure of #230, taken on the still itself).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose as C  # noqa: E402
from compose import (  # noqa: E402
    H, W, Look, Roles, Stepper, Sun, canvas, ellipse, hx, line, multiply,
    outline_sprite, poly, rect, seeded,
)

TABLES = json.loads((Path(__file__).resolve().parent / "nature.json").read_text())
DATE = "2026-10-21"


# ---------------------------------------------------------------- looks


def climate_look(climate: str, season: str) -> Look:
    """The L1 material look with the climate's ramps, then the season's, over it."""
    ramps = {k: [hx(c) for c in v] for k, v in C.MATERIAL.items()}
    for k, v in C.CORE.items():
        ramps.setdefault(k, [hx(c) for c in v])
    for k, v in TABLES["climates"][climate]["ramps"].items():
        ramps[k] = [hx(c) for c in v]
    for k, v in TABLES["seasons"][season]["ramps"].items():
        ramps[k] = [hx(c) for c in v]
    return Look("L1", ramps, True)


def sun_of(hour: str, season: str, weather: str, **over) -> Sun:
    sx, sy, alpha, cap = TABLES["sun"][hour][season]
    w = TABLES["weathers"][weather]
    cloud = {"patches": 0.12, "none": 0.0, "whole": 0.0}[w["cloud"]]
    return Sun(sx=sx, sy=sy, alpha=alpha * w["shadow_alpha"], cap_mult=cap * w["shadow_cap"],
               cloud=cloud, **over)


# ---------------------------------------------------------------- far banks


def far_bank_meadow(scatter: float):
    def draw(img, look: Look, c: Roles) -> None:
        C.draw_far_bank(img, look, c)
        if scatter < 1.0:
            # a thinner meadow: the tufts thinned by the climate's scatter
            d = ImageDraw.Draw(img)
            r = seeded(7)
            px = img.load()
            for y in range(0, 54):
                for x in range(W):
                    if px[x, y][:3] in (c.far_dark, c.far_light) and r.random() > scatter:
                        px[x, y] = c.far_base + (255,)
            del d
    return draw


def far_bank_sand(img, look: Look, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    rect(d, [0, 0, W, 58], c.sand_base)
    r = seeded(33)
    # wind ripples every 14 rows along a slow wave, pebbles with a lit top
    for row in range(4, 58, 14):
        for x in range(0, W, 16):
            y = row + int(2 * math.sin(x / 23))
            n = 6 + r.randrange(5)
            line(d, [(x, y), (x + n, y)], c.sand_mid)
    for _ in range(14):
        x, y = r.randrange(W), r.randrange(2, 54)
        rect(d, [x, y, x + 2, y + 1], c.sand_dark)
        d.point((x, y), fill=c.sand_base + (255,))
    # a dry bush and a low wall of mud brick
    for bx, by, br in [(170, 44, 7), (300, 40, 6)]:
        ellipse(d, [bx - br, by - br, bx + br, by + br], c.grass_dark)
        ellipse(d, [bx - br + 2, by - br + 1, bx + br - 3, by + br - 3], c.grass_base)
    for x in range(40, 140, 10):
        rect(d, [x, 34, x + 8, 50], c.plaster_mid)
        rect(d, [x, 34, x + 8, 35], c.plaster_light)
        line(d, [(x + 8, 34), (x + 8, 50)], c.plaster_dark)
    for x in range(W):
        y = 54 + int(2 * math.sin(x / 17))
        d.point((x, y), fill=c.sand_dark + (255,))


def far_bank_snow(img, look: Look, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    snow, drift, fleck = c.sand_light if hasattr(c, "sand_light") else c.stone_light, c.sand_mid, c.water_pale
    rect(d, [0, 0, W, 58], snow)
    r = seeded(44)
    # drift lines every 22 rows along a slow wave, broken, with a light crest
    for row in range(6, 58, 22):
        for x in range(0, W, 3):
            if r.random() < 0.8:
                y = row + int(3 * math.sin(x / 31))
                d.point((x, y), fill=drift + (255,))
                if x % 9 == 0:
                    d.point((x, y - 1), fill=c.stone_light + (255,))
    for _ in range(40):
        d.point((r.randrange(W), r.randrange(2, 54)), fill=fleck + (255,))
    # a fence under snow, two low firs
    for x in range(150, 286, 22):
        rect(d, [x, 36, x + 3, 52], c.wood_dark)
        rect(d, [x - 1, 34, x + 4, 36], snow)
    for bx, by in [(70, 46), (330, 44)]:
        poly(d, [(bx, by - 22), (bx + 10, by), (bx - 10, by)], c.grass_dark)
        poly(d, [(bx, by - 16), (bx + 6, by - 6), (bx - 6, by - 6)], c.grass_base)
        line(d, [(bx - 6, by - 7), (bx + 2, by - 7)], snow)
    for x in range(W):
        y = 54 + int(2 * math.sin(x / 17))
        d.point((x, y), fill=c.stone_mid + (255,))


def far_bank_marsh(img, look: Look, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    C.draw_meadow(img, look, c, 0, 58, True, 31)
    r = seeded(55)
    # mud pools and reeds everywhere
    for bx, by, bw, bh in [(60, 30, 50, 14), (220, 24, 70, 16), (330, 40, 40, 10)]:
        ellipse(d, [bx - bw, by - bh, bx + bw, by + bh], c.sand_dark)
        ellipse(d, [bx - bw + 3, by - bh + 2, bx + bw - 3, by + bh - 2], c.water_mid)
        line(d, [(bx - bw // 2, by), (bx + bw // 3, by)], c.water_light)
    for _ in range(26):
        x, y = r.randrange(4, W - 4), r.randrange(6, 52)
        C.reeds(d, c, x, y, r)
    for x in range(W):
        y = 54 + int(2 * math.sin(x / 17))
        d.point((x, y), fill=c.far_outline + (255,))


FAR_BANKS = {"meadow": None, "sand": far_bank_sand, "snow": far_bank_snow, "marsh": far_bank_marsh}


# ---------------------------------------------------------------- trees


def tree_pine(c: Roles, look: Look, w: int = 128, h: int = 192, seed: int = 51) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    tx = w // 2
    poly(d, [(tx - 6, h - 60), (tx + 6, h - 60), (tx + 8, h - 10), (tx - 8, h - 10)], c.wood_base)
    poly(d, [(tx + 3, h - 60), (tx + 6, h - 60), (tx + 8, h - 10), (tx + 4, h - 10)], c.wood_dark)
    # tiers, each a triangle a step lighter on its lit side
    tiers = 5
    for i in range(tiers):
        top = 6 + i * (h - 70) // tiers
        base = top + (h - 60) // tiers + 18
        half = 14 + i * (w // 2 - 18) // tiers
        poly(d, [(tx, top), (tx + half, base), (tx - half, base)], c.grass_dark)
        poly(d, [(tx, top + 2), (tx + half - 6, base - 2), (tx, base - 2)], c.grass_base)
        line(d, [(tx - half + 4, base - 3), (tx, top + 10)], c.grass_light)
    return outline_sprite(im, c.grass_outline)


def tree_palm(c: Roles, look: Look, w: int = 128, h: int = 192, seed: int = 51) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    tx = w // 2
    # a leaning trunk of rings
    pts = [(tx + int(14 * math.sin(k / 9)), h - 10 - k * 2) for k in range(0, 70)]
    for k, (x, y) in enumerate(pts):
        if h < 180 and y > 60:
            continue  # the far bank shows the crown only
        wdt = 7 if k < 50 else 6
        rect(d, [x - wdt, y, x + wdt, y + 2], c.wood_dark if k % 4 == 0 else c.wood_base)
        d.point((x - wdt + 1, y), fill=c.wood_light + (255,))
    top = pts[-1]
    # fronds
    for ang in range(-170, 0, 24):
        a = math.radians(ang)
        ex, ey = top[0] + int(54 * math.cos(a)), top[1] + int(40 * math.sin(a)) + 18
        line(d, [top, (ex, ey)], c.grass_dark, 3)
        for t in range(6, 50, 6):
            px_, py_ = top[0] + int(t * math.cos(a)), top[1] + int(t * 0.75 * math.sin(a)) + int(t * 0.33)
            line(d, [(px_, py_), (px_ + int(8 * math.cos(a + 1.3)), py_ + 8)], c.grass_base, 2)
            line(d, [(px_, py_), (px_ + int(8 * math.cos(a - 1.3)), py_ + 7)], c.grass_light, 1)
    # dates under the crown
    for k in range(4):
        ellipse(d, [top[0] - 6 + k * 3, top[1] + 12 + k * 2, top[0] - 2 + k * 3, top[1] + 17 + k * 2], c.cloth_mid)
    return outline_sprite(im, c.grass_outline)


def tree_willow(c: Roles, look: Look, w: int = 128, h: int = 192, seed: int = 51) -> Image.Image:
    im = C.draw_tree(c, look, w, h, seed)
    d = ImageDraw.Draw(im)
    r = seeded(seed + 3)
    # drooping strands over the crown's lower half, down past the trunk
    for x in range(8, w - 8, 5):
        top = 40 + r.randrange(20)
        length = 60 + r.randrange(50)
        lean = r.choice([-1, 0, 1])
        col = c.grass_light if x % 3 == 0 else c.grass_dark
        line(d, [(x, top), (x + lean, top + length // 2), (x + lean * 2, min(h - 14, top + length))], col, 1)
    return outline_sprite(im, c.grass_outline)


def tree_bare(c: Roles, look: Look, w: int = 128, h: int = 192, seed: int = 51) -> Image.Image:
    """A winter tree: the oak's trunk and branches, no leaves, a cap of snow-less twigs."""
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    r = seeded(seed)
    tx = w // 2
    poly(d, [(tx - 8, h - 74), (tx + 8, h - 74), (tx + 11, h - 10), (tx - 11, h - 10)], c.wood_base)
    poly(d, [(tx - 8, h - 74), (tx - 3, h - 74), (tx - 5, h - 10), (tx - 11, h - 10)], c.wood_light)
    poly(d, [(tx + 4, h - 74), (tx + 8, h - 74), (tx + 11, h - 10), (tx + 6, h - 10)], c.wood_dark)
    line(d, [(tx - 10, h - 12), (tx - 22, h - 5)], c.wood_base, 4)
    line(d, [(tx + 10, h - 12), (tx + 23, h - 6)], c.wood_base, 4)

    def branch(x0, y0, ang, length, width, depth):
        if depth == 0 or length < 6:
            return
        x1 = x0 + int(length * math.cos(ang))
        y1 = y0 - int(length * math.sin(ang))
        line(d, [(x0, y0), (x1, y1)], c.wood_dark if width > 1 else c.wood_base, width)
        for da in (-0.55, 0.5):
            branch(x1, y1, ang + da + r.uniform(-0.2, 0.2), int(length * 0.68), max(1, width - 1), depth - 1)

    branch(tx, h - 74, 1.45, 44, 4, 5)
    branch(tx - 2, h - 72, 2.1, 34, 3, 4)
    branch(tx + 3, h - 70, 0.9, 34, 3, 4)
    return outline_sprite(im, c.wood_outline)


TREES = {"oak": None, "pine": tree_pine, "palm": tree_palm, "willow": tree_willow, "bare": tree_bare}


def grass_scaled(scatter: float):
    def draw(c: Roles, w: int, h: int, seed: int, scale: float = 1.0) -> Image.Image:
        im = C.draw_grass_patch(c, w, h, seed, scale)
        if scatter < 1.0:
            # a dry climate keeps a third of the blades
            r = seeded(seed)
            px = im.load()
            for y in range(h):
                for x in range(w):
                    if px[x, y][3] and r.random() > scatter:
                        px[x, y] = (0, 0, 0, 0)
        return im
    return draw


# ---------------------------------------------------------------- creatures for the scale sheet


def creature_child(c: Roles, pell: Image.Image) -> Image.Image:
    """A child: the adult's drawing at 0.65 of its height, the head kept at the adult's size."""
    h = round(96 * TABLES["scale"]["child"])
    body = pell.resize((round(64 * 0.78), h), Image.NEAREST)
    head = pell.crop((14, 0, 50, 34))
    im = canvas(64, 96)
    C.paste(im, body, 7, 96 - h)
    C.paste(im, head, 14, 96 - h - 6)
    return im


def creature_hen(c: Roles) -> Image.Image:
    im = canvas(32, 32)
    d = ImageDraw.Draw(im)
    body = c.plaster_light
    ellipse(d, [6, 14, 26, 28], body)
    ellipse(d, [8, 16, 20, 24], c.plaster_mid)
    ellipse(d, [18, 8, 28, 18], body)
    poly(d, [(27, 13), (31, 14), (27, 16)], c.fire_mid)
    rect(d, [21, 6, 25, 9], c.cloth_mid)
    d.point((25, 12), fill=c.wood_outline + (255,))
    for x in (12, 18):
        line(d, [(x, 27), (x, 31)], c.fire_mid)
    return outline_sprite(im, c.wood_outline)


def creature_dog(c: Roles) -> Image.Image:
    im = canvas(64, 48)
    d = ImageDraw.Draw(im)
    body, dark, light = c.wood_light, c.wood_mid, c.plaster_light
    ellipse(d, [10, 18, 48, 40], body)
    ellipse(d, [14, 22, 36, 34], light)
    ellipse(d, [40, 10, 58, 28], body)
    poly(d, [(42, 12), (46, 2), (50, 12)], dark)
    poly(d, [(52, 12), (56, 4), (58, 14)], dark)
    rect(d, [54, 20, 60, 25], dark)
    d.point((52, 17), fill=c.wood_outline + (255,))
    line(d, [(12, 24), (2, 12)], dark, 3)
    for x in (16, 24, 36, 44):
        rect(d, [x, 36, x + 4, 46], body)
    return outline_sprite(im, c.wood_outline)


def creature_wolf(c: Roles) -> Image.Image:
    """The wolf at 0.55 of a character at the shoulder, two tiles long, low and grey."""
    im = canvas(112, 64)
    d = ImageDraw.Draw(im)
    body, dark, pale = c.iron_mid, c.iron_base, c.iron_light
    ellipse(d, [6, 14, 82, 48], body)
    ellipse(d, [14, 24, 66, 44], pale)
    poly(d, [(70, 16), (104, 20), (108, 36), (82, 42)], body)
    poly(d, [(74, 18), (80, 2), (88, 18)], dark)
    poly(d, [(88, 18), (94, 4), (100, 20)], dark)
    rect(d, [102, 28, 110, 33], dark)
    rect(d, [94, 24, 97, 26], c.fire_light)
    line(d, [(6, 20), (-4, 6)], dark, 5)
    for x in (14, 28, 56, 72):
        rect(d, [x, 44, x + 6, 62], body)
        rect(d, [x, 59, x + 6, 62], dark)
    return outline_sprite(im, c.wood_outline)


def creature_deer(c: Roles) -> Image.Image:
    im = canvas(80, 110)
    d = ImageDraw.Draw(im)
    body, dark, pale = c.wood_light, c.wood_mid, c.plaster_light
    ellipse(d, [6, 52, 60, 84], body)
    ellipse(d, [14, 62, 50, 80], pale)
    poly(d, [(50, 56), (62, 30), (72, 32), (66, 60)], body)
    ellipse(d, [60, 20, 78, 36], body)
    rect(d, [74, 28, 79, 32], dark)
    d.point((70, 25), fill=c.wood_outline + (255,))
    # antlers, up to 1.4 characters
    for base, side in ((64, -1), (70, 1)):
        line(d, [(base, 22), (base + side * 6, 8), (base + side * 10, 0)], dark, 2)
        line(d, [(base + side * 4, 12), (base + side * 12, 6)], dark, 1)
        line(d, [(base + side * 2, 16), (base + side * 10, 16)], dark, 1)
    for x in (12, 22, 42, 52):
        rect(d, [x, 80, x + 4, 108], dark)
    rect(d, [2, 50, 8, 58], pale)
    return outline_sprite(im, c.wood_outline)


def creature_horse(c: Roles) -> Image.Image:
    im = canvas(128, 112)
    d = ImageDraw.Draw(im)
    body, dark, light = c.wood_mid, c.wood_dark, c.wood_light
    ellipse(d, [10, 44, 96, 88], body)
    ellipse(d, [20, 52, 80, 80], light)
    poly(d, [(84, 50), (104, 14), (118, 16), (104, 60)], body)
    ellipse(d, [100, 6, 126, 28], body)
    rect(d, [120, 16, 127, 22], dark)
    poly(d, [(104, 8), (108, 0), (112, 10)], dark)
    d.point((114, 12), fill=c.wood_outline + (255,))
    # mane and tail
    for k in range(0, 40, 4):
        line(d, [(104 - k // 2, 14 + k), (98 - k // 2, 18 + k)], dark, 2)
    for k in range(6):
        line(d, [(12, 50 + k * 2), (0, 70 + k * 6)], dark, 2)
    for x in (18, 32, 68, 84):
        rect(d, [x, 84, x + 6, 110], body)
        rect(d, [x, 106, x + 6, 110], dark)
    return outline_sprite(im, c.wood_outline)


# ---------------------------------------------------------------- weather over the scene


def ambient(img: Image.Image, weather: str) -> Image.Image:
    a = TABLES["weathers"][weather]["ambient"]
    return img if a is None else multiply(img, hx(a[0]), a[1])


def wet_ground(img: Image.Image) -> Image.Image:
    """The ground one step darker for the day: a multiply of ink at 12% below the water."""
    out = img.copy()
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle([0, 197, W, H], fill=hx("#1b1a2e") + (round(255 * 0.12),))
    out.alpha_composite(layer)
    return out


def puddles(img: Image.Image, c: Roles, seed: int = 17) -> None:
    """Puddles on the cobbles: the water ramp's dark and middle steps, one pale dash each."""
    d = ImageDraw.Draw(img)
    r = seeded(seed)
    for bx, by, bw, bh in [(60, 330, 16, 5), (250, 640, 18, 6), (120, 790, 22, 6), (330, 300, 12, 4)]:
        ellipse(d, [bx - bw, by - bh, bx + bw, by + bh], c.water_dark)
        ellipse(d, [bx - bw + 2, by - bh + 1, bx + bw - 2, by + bh - 1], c.water_mid)
        line(d, [(bx - bw // 2, by - 1), (bx + bw // 4, by - 1)], c.water_light)
        d.point((bx + r.randrange(-bw // 2, bw // 2), by + 1), fill=c.water_pale + (255,))


def rain_streaks(img: Image.Image, seed: int = 23) -> None:
    """Streaks 2 px long at the wind's angle, pale, whole pixels; a ring where one lands."""
    d = ImageDraw.Draw(img)
    r = seeded(seed)
    pale = hx("#c4ecf8")
    for _ in range(W * H // 420):
        x, y = r.randrange(W), r.randrange(H)
        base = img.getpixel((x, y))[:3]
        col = C.blend_over(base, pale, 0.55)
        line(d, [(x, y), (x - 1, y + 3)], col, 1)
    for _ in range(40):
        x, y = r.randrange(W), r.randrange(240, H)
        base = img.getpixel((x, y))[:3]
        d.ellipse([x - 3, y - 1, x + 3, y + 1], outline=C.blend_over(base, pale, 0.4) + (255,))


def fog_banks(img: Image.Image, strength: float, seed: int = 29) -> None:
    """Three banks across the view (#238's placement), pale, in three alphas only,
    dithered where one alpha meets the next (STYLE 2: whole pixels at one alpha)."""
    px = img.load()
    pale = hx("#c6cad6")
    steps = (strength * 0.5, strength * 0.8, strength * 1.1)
    for frac, half, w in ((0.22, 70, 0.9), (0.46, 60, 0.7), (0.64, 80, 1.0)):
        cy = int(H * frac)
        for y in range(max(0, cy - half), min(H, cy + half)):
            t = 1 - abs(y - cy) / half
            for x in range(W):
                wave = 0.5 + 0.5 * math.sin(x / 37 + y / 11)
                v = t * w * (0.7 + 0.3 * wave)
                # the band's alpha in three steps; a checker row between two steps
                if v < 0.18:
                    continue
                k = 0 if v < 0.45 else 1 if v < 0.75 else 2
                edge = min(abs(v - 0.45), abs(v - 0.75)) < 0.06
                if edge and (x + y) % 2:
                    k = max(0, k - 1) if k else -1
                if k < 0:
                    continue
                base = px[x, y][:3]
                px[x, y] = C.blend_over(base, pale, steps[k]) + (255,)


def whole_cloud(img: Image.Image, seed: int = 39) -> None:
    """An overcast sky: the ground under one cloud with a few lighter gaps, #172a52 at 20%."""
    mask = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(mask)
    r = seeded(seed)
    for _ in range(5):
        x, y = r.randrange(W), r.randrange(200, H)
        d.ellipse([x - 70, y - 30, x + 70, y + 30], fill=120)
    C.apply_shadow(img, mask, hx("#172a52"), 0.25)


def heat_shimmer(img: Image.Image, seed: int = 41) -> None:
    """Rows over the sand shifted one pixel on a slow wave: the air over hot ground."""
    r = seeded(seed)
    for y in range(190, 240):
        if r.random() < 0.5:
            shift = 1 if int(y / 3) % 2 == 0 else -1
            row = img.crop((0, y, W, y + 1))
            img.paste(row, (shift, y))


def leaves_falling(img: Image.Image, c: Roles, seed: int = 47) -> None:
    d = ImageDraw.Draw(img)
    r = seeded(seed)
    for _ in range(60):
        x, y = r.randrange(W), r.randrange(220, H)
        col = r.choice([c.grass_base, c.grass_light, c.grass_dark])
        poly(d, [(x, y), (x + 3, y + 1), (x + 1, y + 3)], col)


def snow_on_ground(img: Image.Image, c: Roles, seed: int = 53) -> None:
    """A thin snow on the cobbles' tops and the sand: the light step, whole pixels."""
    px = img.load()
    r = seeded(seed)
    for y in range(197, H):
        for x in range(W):
            if r.random() < 0.08:
                px[x, y] = c.stone_light + (255,)


# ---------------------------------------------------------------- frames


def light(img: Image.Image, hour: str, season: str, lit: bool) -> Image.Image:
    warm, base_dark = TABLES["hours"][hour][season]
    warm_col = hx(warm[0]) if warm else hx("#eda83a")
    warm_alpha = warm[1] if warm else 0.0
    lamps = [C.LIGHTS_L2["lamp"]] if lit else []
    fires = [C.LIGHTS_L2["hearth"]] if lit else []
    windows = [C.LIGHTS_L2["window_l"], C.LIGHTS_L2["window_r"]] if lit else []
    return C.light_frame(img, lamps, fires, windows, warm=(warm_col, warm_alpha),
                         base_dark=base_dark, dither=True, glow=False)


def world(climate: str, season: str, weather: str, hour: str, *, pell: Image.Image | None,
          pell_pos=(312, 696), elder=True, tall_grass=True, bird=True, extra=(),
          canopy_shade=True, over_all=False, tree_on_top=False) -> Image.Image:
    cl = TABLES["climates"][climate]
    se = TABLES["seasons"][season]
    we = TABLES["weathers"][weather]
    look = climate_look(climate, season)
    c = Roles(look)
    tree_kind = se["tree"] or cl["tree"]
    far_kind = se["far_bank"] or cl["far_bank"]
    scatter = cl["scatter"]
    far = FAR_BANKS[far_kind] or far_bank_meadow(scatter)
    sun = sun_of(hour, season, weather, canopy_over_all=over_all, tree_on_top=tree_on_top)
    scene = C.compose_scene(look, pell=pell, pell_pos=pell_pos, elder=elder, tall_grass=tall_grass,
                            bird=bird and not we["rain"], canopy_shade=canopy_shade, sun=sun,
                            far_bank=far, tree_fn=TREES[tree_kind], grass_fn=grass_scaled(scatter),
                            extra=list(extra))
    img = scene.img
    if se["leaves"]:
        leaves_falling(img, c)
    if se["puddles"]:
        puddles(img, c)
    if climate == "cold" and season == "winter":
        snow_on_ground(img, c)
    if we["wet"]:
        img = wet_ground(img)
        if not se["puddles"]:
            puddles(img, c, seed=19)
    if we["cloud"] == "whole":
        whole_cloud(img)
    if we.get("shimmer"):
        heat_shimmer(img)
    img = ambient(img, weather)
    if we["rain"]:
        rain_streaks(img)
    if we["fog"]:
        fog_banks(img, we["fog"])
    lit = TABLES["hours"][hour][season][1] > 0
    return light(img, hour, season, lit)


def count_colours(img: Image.Image) -> int:
    data = img.convert("RGB").tobytes()
    return len({data[i:i + 3] for i in range(0, len(data), 3)})


def main() -> None:
    C.FRAMES.mkdir(parents=True, exist_ok=True)
    look0 = climate_look("temperate", "summer")
    stepper = Stepper(look0)
    pell = C.load_pell("A", stepper, {hx("#1b1a2e")})
    c = Roles(look0)

    frames: dict[str, Image.Image] = {}

    # 1. scale: the square at noon, the creatures of NATURE section 1 in one frame
    extra = [
        (creature_wolf(c), 4, 584, 646, 44),
        (creature_dog(c), 122, 600, 646, 36),
        (creature_deer(c), 302, 586, 694, 60),
        (creature_horse(c), 84, 700, 810, 70),
        (creature_child(c, pell), 300, 712, 806, 60),
        (creature_hen(c), 350, 770, 800, 20),
    ]
    frames["scale"] = world("temperate", "summer", "clear", "12:00", pell=pell, pell_pos=(236, 710),
                            tall_grass=False, bird=True, extra=extra)

    # 2. climate: the same layout at 16:30 in summer, the climate's own air
    for name in ("temperate", "dry", "cold", "wet"):
        air = TABLES["climates"][name]["air"]
        frames[f"climate-{name}"] = world(name, "summer", air, "16:30", pell=pell)

    # 3. season: autumn and winter at 16:30, temperate
    frames["season-autumn"] = world("temperate", "autumn", "clear", "16:30", pell=pell)
    frames["season-winter"] = world("temperate", "winter", "overcast", "16:30", pell=pell)

    # 4. weather: overcast, rain and fog at noon, temperate summer
    for name in ("overcast", "rain", "fog"):
        frames[f"weather-{name}"] = world("temperate", "summer", name, "12:00", pell=pell)

    # 5. shade: Pell at the foot of the near tree; the canopy's shade over the ground only, then over him
    for name, over in (("ground", False), ("over", True)):
        frames[f"shade-{name}"] = world("temperate", "summer", "clear", "12:00", pell=pell, pell_pos=(62, 740),
                                        tall_grass=False, over_all=over, tree_on_top=True)

    report = []
    for name, img in frames.items():
        path = C.save(img, f"{DATE}-nature-{name}.png")
        report.append(f"{path.name}: {img.width}x{img.height} art px, {count_colours(img)} colours")
    print("\n".join(report))
    print(f"\n{len(frames)} frames in {C.FRAMES}")


if __name__ == "__main__":
    main()
