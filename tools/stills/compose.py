#!/usr/bin/env python3
"""Compose the 2026-10-20 art ladder: four world stills and three Pell stills.

One command re-makes every frame:

    python3 tools/stills/compose.py

Pillow only. No network, no model call. The generated Pell sprites are checked
in under tools/stills/inputs/ and read from disk.

The frames are 390x844 art pixels, enlarged 3x to 1170x2532 (a 390x844 phone
at 3x), with a 64 px tile. The script also checks that every opaque pixel is a
declared ramp step or a declared blend of one, and that no pixel is half clear.
"""

from __future__ import annotations

import colorsys
import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / "docs" / "design" / "frames"
INPUTS = Path(__file__).resolve().parent / "inputs"

W, H = 390, 844
SCALE = 3
TILE = 64

# ---------------------------------------------------------------- palettes


def hx(s: str) -> tuple[int, int, int]:
    n = int(s.lstrip("#"), 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


CORE = {
    "grey": ["#1b1a2e", "#3a3554", "#5d6177", "#8f94a8", "#c6cad6", "#f5f4ef"],
    "green": ["#1f3d2b", "#2e6b3b", "#4c9a3f", "#84c450", "#c8e88a"],
    "earth": ["#3d2618", "#6e4226", "#9e6b3c", "#c99a5e", "#ebd3a2"],
    "water": ["#172a52", "#275a99", "#3f8fd1", "#7cc4ec", "#c4ecf8"],
    "red": ["#5e1c28", "#a8302f", "#e2533f", "#f6a07f"],
    "fire": ["#b8661f", "#eda83a", "#f8de62"],
    "skin": ["#d38c66", "#f3c7a0"],
    "purple": ["#5b3373", "#9a5bb0"],
}

# The L1 material ramps: five or six steps, dark to light, the hue moving
# cooler as it darkens and warmer as it lightens.
MATERIAL = {
    "wood": ["#2e1e24", "#4a2c2a", "#6e4032", "#95603c", "#bd8655", "#e0b37a"],
    "stone": ["#242338", "#3b3a52", "#57576e", "#787a8c", "#a09a96", "#c6bca8"],
    "leaf": ["#16332f", "#27543a", "#3f7d45", "#68a94f", "#a8cd6f"],
    "meadow": ["#243330", "#3e5038", "#5e7141", "#889552", "#b8b96d"],
    "water2": ["#12203f", "#1c3d6e", "#2c6494", "#557f96", "#c9b28a"],
    "cloth": ["#3a1a2c", "#5e2333", "#8a3534", "#b8543c", "#de7f52"],
    "skin2": ["#8a4a3e", "#b06a4f", "#d38c66", "#eab184", "#f7d3ab"],
    "fire2": ["#8c3a1e", "#b8661f", "#eda83a", "#f8de62", "#fff3c0"],
    "plaster": ["#4a3f38", "#6b5c4c", "#918169", "#b8a789", "#dccdaa"],
    "iron": ["#262538", "#3d3a4c", "#5c535f", "#877a80", "#b3a79c"],
    "sand2": ["#3a2e2a", "#5e4a3a", "#8a6f4f", "#b59468", "#d9bd8a"],
}


def hue_steps(ramp: list[str]) -> list[float]:
    out = []
    for h in ramp:
        r, g, b = [v / 255 for v in hx(h)]
        hh, ll, ss = colorsys.rgb_to_hsv(r, g, b)
        out.append(round(hh * 360, 1))
    return out


@dataclass(frozen=True)
class Look:
    """One palette and one outline rule. The scene reads roles, never hexes."""

    name: str
    ramps: dict[str, list[tuple[int, int, int]]]
    local_outline: bool

    def step(self, ramp: str, i: int) -> tuple[int, int, int]:
        r = self.ramps[ramp]
        return r[max(0, min(i, len(r) - 1))]

    def outline(self, ramp: str) -> tuple[int, int, int]:
        return self.step(ramp, 0) if self.local_outline else hx("#1b1a2e")


def core_look() -> Look:
    ramps = {k: [hx(c) for c in v] for k, v in CORE.items()}
    # grey 0 is the one outline; every other role reads the same ramps.
    return Look("L0", ramps, False)


def material_look() -> Look:
    ramps = {k: [hx(c) for c in v] for k, v in MATERIAL.items()}
    # a sprite that declares nothing keeps the core; the trial Pell does.
    for k, v in CORE.items():
        ramps.setdefault(k, [hx(c) for c in v])
    return Look("L1", ramps, True)


# ---------------------------------------------------------------- colours


class Roles:
    """Named colours of a look, all drawn from its ramps."""

    def __init__(self, look: Look):
        self.look = look
        s = look.step
        o = look.outline
        if look.name == "L0":
            self.cobble_base = s("grey", 1)
            self.cobble_mid = s("grey", 2)
            self.cobble_light = s("grey", 3)
            self.cobble_dark = s("grey", 0)
            self.stone_base = s("grey", 1)
            self.stone_mid = s("grey", 2)
            self.stone_light = s("grey", 3)
            self.stone_dark = s("grey", 1)
            self.stone_outline = hx("#1b1a2e")
            self.grass_base = s("green", 2)
            self.grass_dark = s("green", 1)
            self.grass_light = s("green", 3)
            self.grass_outline = hx("#1b1a2e")
            self.far_base = s("green", 2)
            self.far_dark = s("green", 1)
            self.far_light = s("green", 3)
            self.far_outline = hx("#1b1a2e")
            self.water_dark = s("water", 0)
            self.water_mid = s("water", 1)
            self.water_light = s("water", 2)
            self.water_pale = s("water", 3)
            self.sand_base = s("earth", 4)
            self.sand_mid = s("earth", 3)
            self.sand_dark = s("earth", 2)
            self.sand_outline = hx("#1b1a2e")
            self.wood_base = s("earth", 1)
            self.wood_mid = s("earth", 2)
            self.wood_light = s("earth", 3)
            self.wood_dark = s("earth", 0)
            self.wood_outline = hx("#1b1a2e")
            self.plaster_base = s("earth", 3)
            self.plaster_mid = s("earth", 4)
            self.plaster_light = s("earth", 4)
            self.plaster_dark = s("earth", 2)
            self.plaster_outline = hx("#1b1a2e")
            self.cloth_base = s("red", 1)
            self.cloth_mid = s("red", 2)
            self.cloth_light = s("red", 3)
            self.cloth_dark = s("red", 0)
            self.cloth_outline = hx("#1b1a2e")
            self.skin_base = s("skin", 0)
            self.skin_light = s("skin", 1)
            self.skin_dark = s("earth", 2)
            self.fire_base = s("fire", 0)
            self.fire_mid = s("fire", 1)
            self.fire_light = s("fire", 2)
            self.fire_white = s("grey", 5)
            self.iron_base = s("grey", 1)
            self.iron_mid = s("grey", 2)
            self.iron_light = s("grey", 3)
            self.iron_outline = hx("#1b1a2e")
            self.hair_light = s("grey", 5)
            self.hair_mid = s("grey", 4)
        else:
            self.cobble_base = s("stone", 1)
            self.cobble_mid = s("stone", 2)
            self.cobble_light = s("stone", 3)
            self.cobble_dark = s("stone", 0)
            self.stone_base = s("stone", 2)
            self.stone_mid = s("stone", 3)
            self.stone_light = s("stone", 4)
            self.stone_dark = s("stone", 1)
            self.stone_outline = o("stone")
            self.grass_base = s("leaf", 2)
            self.grass_dark = s("leaf", 1)
            self.grass_light = s("leaf", 3)
            self.grass_outline = o("leaf")
            self.far_base = s("meadow", 2)
            self.far_dark = s("meadow", 1)
            self.far_light = s("meadow", 3)
            self.far_outline = o("meadow")
            self.water_dark = s("water2", 0)
            self.water_mid = s("water2", 1)
            self.water_light = s("water2", 2)
            self.water_pale = s("water2", 3)
            self.sand_base = s("sand2", 3)
            self.sand_mid = s("sand2", 2)
            self.sand_dark = s("sand2", 1)
            self.sand_outline = o("sand2")
            self.wood_base = s("wood", 2)
            self.wood_mid = s("wood", 3)
            self.wood_light = s("wood", 4)
            self.wood_dark = s("wood", 1)
            self.wood_outline = o("wood")
            self.plaster_base = s("plaster", 2)
            self.plaster_mid = s("plaster", 3)
            self.plaster_light = s("plaster", 4)
            self.plaster_dark = s("plaster", 1)
            self.plaster_outline = o("plaster")
            self.cloth_base = s("cloth", 2)
            self.cloth_mid = s("cloth", 3)
            self.cloth_light = s("cloth", 4)
            self.cloth_dark = s("cloth", 1)
            self.cloth_outline = o("cloth")
            self.skin_base = s("skin2", 2)
            self.skin_light = s("skin2", 3)
            self.skin_dark = s("skin2", 1)
            self.fire_base = s("fire2", 0)
            self.fire_mid = s("fire2", 2)
            self.fire_light = s("fire2", 3)
            self.fire_white = s("fire2", 4)
            self.iron_base = s("iron", 2)
            self.iron_mid = s("iron", 3)
            self.iron_light = s("iron", 4)
            self.iron_outline = o("iron")
            self.hair_light = s("stone", 5)
            self.hair_mid = s("stone", 4)


# ---------------------------------------------------------------- paint helpers


def canvas(w: int = W, h: int = H) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def rect(d: ImageDraw.ImageDraw, box, fill):
    d.rectangle(box, fill=fill + (255,))


def line(d: ImageDraw.ImageDraw, pts, fill, width=1):
    d.line(pts, fill=fill + (255,), width=width)


def ellipse(d: ImageDraw.ImageDraw, box, fill):
    d.ellipse(box, fill=fill + (255,))


def poly(d: ImageDraw.ImageDraw, pts, fill):
    d.polygon(pts, fill=fill + (255,))


def alpha_of(img: Image.Image) -> Image.Image:
    return img.getchannel("A")


def over(img: Image.Image, color: tuple[int, int, int], alpha: float) -> Image.Image:
    """One flat colour over the whole frame at one alpha."""
    if alpha <= 0:
        return img
    layer = Image.new("RGBA", img.size, color + (round(255 * alpha),))
    out = img.copy()
    out.alpha_composite(layer)
    return out


def multiply(img: Image.Image, color: tuple[int, int, int], alpha: float) -> Image.Image:
    if alpha <= 0:
        return img
    tint = Image.new("RGBA", img.size, color + (255,))
    multiplied = ImageChops.multiply(img, tint)
    return Image.blend(img, multiplied, alpha)


def paste(base: Image.Image, sprite: Image.Image, x: int, y: int) -> None:
    base.alpha_composite(sprite, dest=(x, y))


def seeded(seed: int) -> random.Random:
    return random.Random(seed)


# ---------------------------------------------------------------- terrain


def shore_line(x: int, base: int, amp: int = 4, seed: int = 3) -> int:
    r = seeded(seed)
    phase = [r.uniform(0, 6.28) for _ in range(4)]
    return int(
        base
        + amp * math.sin(x / 23 + phase[0])
        + amp * 0.6 * math.sin(x / 9 + phase[1])
        + 2 * math.sin(x / 4 + phase[2])
    )


def draw_meadow(img, look: Look, c: Roles, y0: int, y1: int, far: bool, seed: int) -> None:
    d = ImageDraw.Draw(img)
    base = c.far_base if far else c.grass_base
    dark = c.far_dark if far else c.grass_dark
    light = c.far_light if far else c.grass_light
    outline = c.far_outline if far else c.grass_outline
    d.rectangle([0, y0, W, y1], fill=base + (255,))
    r = seeded(seed)
    # low scatter: a darker line and single blades
    for _ in range((y1 - y0) * W // 90):
        x = r.randrange(W)
        y = r.randrange(y0, y1)
        n = r.choice([2, 2, 3])
        col = dark if r.random() < 0.55 else light
        for k in range(n):
            d.point((x + k, y - k), fill=col + (255,))
    # tufts
    for _ in range((y1 - y0) * W // 900):
        x = r.randrange(W)
        y = r.randrange(y0 + 2, y1 - 1)
        tuft(d, x, y, dark, light, outline, r.choice([-1, 0, 0, 1]), 7 + r.randrange(6), r)
    if far:
        for _ in range(4):
            x = r.randrange(8, W - 8)
            y = r.randrange(y0 + 2, max(y0 + 3, y1 - 2))
            flower(d, x, y, c, r)


def tuft(d, x, y, dark, light, outline, lean, height, r) -> None:
    blades = r.choice([3, 4, 4, 5])
    for i in range(blades):
        bx = x + i * 2 - blades
        top = y - height + r.randrange(0, 5)
        dx = lean if i % 2 == 0 else -lean
        line(d, [(bx, y), (bx + dx // 2, (y + top) // 2), (bx + dx, top)], dark if i % 2 else light)
    d.point((x - 1, y), fill=outline + (255,))


def flower(d, x, y, c: Roles, r) -> None:
    col = c.cloth_mid if r.random() < 0.5 else c.fire_mid
    d.point((x, y - 3), fill=col + (255,))
    d.point((x - 1, y - 2), fill=col + (255,))
    d.point((x + 1, y - 2), fill=col + (255,))
    d.point((x, y - 1), fill=col + (255,))
    d.point((x, y - 4), fill=c.fire_white + (255,))


def draw_water(img, look: Look, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    # depth bands, far to near; a dithered edge between each
    bands = [
        (56, 108, c.water_dark),
        (108, 150, c.water_mid),
        (150, 180, c.water_light),
        (180, 197, c.water_pale),
    ]
    for y0, y1, col in bands:
        d.rectangle([0, y0, W, y1], fill=col + (255,))
    for y, col in [(56, c.water_dark), (108, c.water_mid), (150, c.water_light), (180, c.water_pale)]:
        for x in range(W):
            if (x + y) % 2 == 0:
                d.point((x, y), fill=col + (255,))
    r = seeded(11)
    # ripples: short dashes in the lighter steps; a darker underside
    for _ in range(58):
        x = r.randrange(-20, W)
        y = r.randrange(60, 190)
        n = r.choice([4, 6, 8, 10])
        col = c.water_light if y < 120 else c.water_pale
        line(d, [(x, y), (x + n, y)], col)
        if r.random() < 0.5:
            d.point((x + n // 2, y + 1), fill=c.water_pale + (255,))
    # the far bank's edge: a dark line and a light lip
    d.rectangle([0, 54, W, 57], fill=c.water_dark + (255,))
    for x in range(W):
        if x % 5 < 3:
            d.point((x, 56), fill=c.water_light + (255,))


def draw_shore_base(img, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    d.rectangle([0, 186, W, H], fill=c.sand_base + (255,))
    r = seeded(12)
    for _ in range(200):
        x = r.randrange(W)
        y = r.randrange(196, 240)
        d.point((x, y), fill=(c.sand_dark if r.random() < 0.35 else c.sand_mid) + (255,))


def draw_shore_details(img, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    for x in range(W):
        y = shore_line(x, 200, 4, 3)
        # the wet line and a pale lip over the water's edge
        d.point((x, 196), fill=c.sand_mid + (255,))
        if x % 3 == 0:
            d.point((x, 195), fill=c.water_pale + (255,))
        d.point((x, y), fill=c.sand_dark + (255,))
    r = seeded(12)
    for _ in range(140):
        x = r.randrange(W)
        y = shore_line(x, 200, 4, 3) + r.randrange(1, 26)
        d.point((x, y), fill=(c.sand_dark if r.random() < 0.4 else c.sand_mid) + (255,))
    # pebbles
    for _ in range(9):
        x = r.randrange(6, W - 6)
        y = shore_line(x, 200, 4, 3) + r.randrange(4, 30)
        w = r.choice([3, 4, 5])
        ellipse(d, [x, y, x + w, y + max(2, w - 2)], c.stone_mid)
        d.point((x + 1, y + 1), fill=c.stone_light + (255,))
    # footprints, fading from the dark step to the light step
    fx, fy = 280, shore_line(280, 200, 4, 3) + 6
    for i, col in enumerate([c.sand_dark, c.sand_dark, c.sand_mid, c.sand_mid, c.sand_base]):
        x = fx - i * 13
        y = fy + (i % 2) * 3
        d.rectangle([x, y, x + 3, y + 5], fill=col + (255,))
        d.rectangle([x + 1, y + 7, x + 4, y + 10], fill=col + (255,))
    # reeds at the water's edge
    for x0 in (18, 96, 336):
        reeds(d, c, x0, shore_line(x0, 200, 4, 3) + 2, seeded(x0))


def reeds(d, c: Roles, x0: int, y0: int, r) -> None:
    for i in range(6):
        x = x0 + i * 3 + r.randrange(-1, 2)
        h = 18 + r.randrange(20)
        lean = r.choice([-2, -1, 0, 1, 2])
        col = c.grass_dark if i % 2 else c.grass_base
        line(d, [(x, y0), (x + lean // 2, y0 - h // 2), (x + lean, y0 - h)], col, 1)
        if r.random() < 0.5:
            head = c.wood_dark if i % 2 else c.wood_base
            d.rectangle([x + lean - 1, y0 - h - 4, x + lean + 1, y0 - h], fill=head + (255,))


def draw_cobble(img, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    d.rectangle([0, 232, W, H], fill=c.cobble_base + (255,))
    r = seeded(21)
    y = 236
    row = 0
    while y < H:
        h = 10 + r.randrange(5)
        x = -14 - (r.randrange(8) if row % 2 else 0)
        while x < W:
            w = 15 + r.randrange(10)
            skew = r.choice([-1, 0, 0, 1])
            box = [x, y + (1 if skew > 0 else 0), x + w - 2, y + h - 2 - (1 if skew < 0 else 0)]
            ellipse(d, box, c.cobble_mid)
            # top-left light, bottom-right dark
            line(d, [(box[0] + 3, box[1] + 1), (box[2] - 4, box[1] + 1)], c.cobble_light)
            line(d, [(box[0] + 1, box[1] + 3), (box[0] + 1, box[3] - 3)], c.cobble_light)
            line(d, [(box[0] + 3, box[3] - 1), (box[2] - 3, box[3] - 1)], c.cobble_dark)
            if r.random() < 0.22:
                d.point((box[0] + w // 2, box[1] + h // 2), fill=c.cobble_dark + (255,))
            x += w
        y += h
        row += 1
    # grass in the joints near the shore and the edges
    for _ in range(34):
        x = r.randrange(W)
        y = r.randrange(240, H - 4)
        if y < 300 or x < 20 or x > W - 20 or r.random() < 0.25:
            tuft(d, x, y, c.grass_dark, c.grass_light, c.grass_outline, r.choice([-1, 0, 1]), 5 + r.randrange(5), r)


def draw_path(img, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    r = seeded(61)
    for y in range(566, H):
        cx = 292 + int((y - 566) * 0.11) + int(3 * math.sin(y / 31))
        w = 15 + int(4 * math.sin(y / 17))
        for x in range(cx - w, cx + w):
            edge = abs(x - cx) / w
            if edge > 0.84 and r.random() < 0.55:
                continue
            col = c.sand_mid if r.random() < 0.62 else c.sand_dark
            if r.random() < 0.14:
                col = c.sand_base
            d.point((x, y), fill=col + (255,))
    for _ in range(14):
        x = r.randrange(270, 340)
        y = r.randrange(600, H - 4)
        ww = r.choice([2, 3, 4])
        ellipse(d, [x, y, x + ww, y + 2], c.stone_mid)
        d.point((x, y + 1), fill=c.stone_dark + (255,))


def draw_far_bank(img, look: Look, c: Roles) -> None:
    d = ImageDraw.Draw(img)
    draw_meadow(img, look, c, 0, 58, True, 31)
    # the bank's lip, a ragged dark line over the water
    for x in range(W):
        y = 54 + int(2 * math.sin(x / 17))
        d.point((x, y), fill=c.far_outline + (255,))
        if x % 4 == 0:
            d.point((x, y + 1), fill=c.far_dark + (255,))


# ---------------------------------------------------------------- shadows


def shadow_mask(mask: Image.Image, feet: int, sx: float, sy: float, cap: int | None = None) -> Image.Image:
    """Project a silhouette to the ground: z rows up lands at (x + z*sx, feet + z*sy)."""
    out = Image.new("L", mask.size, 0)
    src = mask.load()
    dst = out.load()
    w, h = mask.size
    for y in range(h):
        if y > feet:
            continue
        z = feet - y
        if cap is not None:
            z = min(z, cap)
        dy = feet + int(round(sy * z))
        dx = int(round(sx * z))
        if not (0 <= dy < h):
            continue
        x = 0
        while x < w:
            if src[x, y] > 100:
                x0 = x
                while x < w and src[x, y] > 100:
                    x += 1
                for xx in range(x0, x):
                    X = xx + dx
                    if 0 <= X < w:
                        dst[X, dy] = 255
            else:
                x += 1
    return out.filter(ImageFilter.MaxFilter(3))


def contact_line(img: Image.Image, mask: Image.Image, feet: int, color: tuple[int, int, int]) -> None:
    src = mask.load()
    w, h = mask.size
    y = min(feet, h - 1)
    xs = [x for x in range(w) if src[x, y] > 100]
    if not xs:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle([min(xs), feet, max(xs), feet + 3], fill=color + (round(255 * 0.45),))
    img.alpha_composite(layer)


def apply_shadow(ground: Image.Image, mask: Image.Image, color: tuple[int, int, int], alpha: float) -> None:
    layer = Image.new("RGBA", ground.size, color + (0,))
    layer.putalpha(mask.point(lambda v: round(v * alpha)))
    ground.alpha_composite(layer)


# ---------------------------------------------------------------- sprites


def outline_sprite(img: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    mask = img.getchannel("A")
    edge = mask.filter(ImageFilter.FIND_EDGES)
    out = img.copy()
    px, ep, mp = out.load(), edge.load(), mask.load()
    for y in range(out.height):
        for x in range(out.width):
            if ep[x, y] > 0 and mp[x, y] == 0:
                px[x, y] = color + (255,)
    return out


def draw_house(c: Roles, look: Look) -> tuple[Image.Image, int, int, int]:
    """192x320, top-left at (198,252). Returns sprite, x, y, feet."""
    w, h = 192, 320
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    # roof: a hipped thatch, ridge at the top
    roof_h = 108
    pts = [(18, 0), (w - 18, 0), (w, roof_h), (0, roof_h)]
    poly(d, pts, c.wood_base)
    # shingle rows, clipped by the roof polygon
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.polygon(pts, fill=255)
    r = seeded(41)
    for yy in range(6, roof_h - 4, 9):
        inset = int(18 * (1 - yy / roof_h))
        line(d, [(inset, yy), (w - inset, yy)], c.wood_dark)
        x = inset + (4 if (yy // 9) % 2 else 0)
        while x < w - inset:
            line(d, [(x, yy), (x, yy + 8)], c.wood_dark)
            x += 13
    # ridge cap and eave
    rect(d, [16, 0, w - 17, 4], c.wood_light)
    rect(d, [0, roof_h - 6, w - 1, roof_h - 1], c.wood_dark)
    rect(d, [0, roof_h, w - 1, roof_h + 3], c.wood_outline)
    # the last sun from the left: a lit lip on the left slope, a dark right edge
    for yy in range(6, roof_h - 8):
        inset = int(18 * (1 - yy / roof_h))
        for k in range(4):
            d.point((inset + k, yy), fill=(c.wood_light if k < 2 else c.wood_mid) + (255,))
        for k in range(5):
            d.point((w - inset - 1 - k, yy), fill=(c.wood_dark if k < 3 else c.wood_base) + (255,))
    # chimney
    cx, cy = 146, 8
    rect(d, [cx, cy, cx + 30, cy + 46], c.stone_base)
    rect(d, [cx - 2, cy - 2, cx + 32, cy + 2], c.stone_light)
    rect(d, [cx + 2, cy + 2, cx + 28, cy + 8], c.stone_dark)
    rect(d, [cx + 2, cy + 6, cx + 28, cy + 12], c.stone_outline)
    for yy in range(cy + 16, cy + 44, 9):
        line(d, [(cx, yy), (cx + 30, yy)], c.stone_dark)
    # walls
    wall_y = roof_h + 4
    rect(d, [4, wall_y, w - 5, h - 1], c.plaster_base)
    rect(d, [4, wall_y, w - 5, wall_y + 14], c.plaster_dark)
    rect(d, [4, wall_y + 15, w - 5, wall_y + 24], c.plaster_mid)
    # stone foundation
    rect(d, [4, h - 26, w - 5, h - 1], c.stone_mid)
    rect(d, [4, h - 26, w - 5, h - 23], c.stone_light)
    for yy in range(h - 21, h - 1, 8):
        line(d, [(4, yy), (w - 5, yy)], c.stone_dark)
    for xx in range(8, w - 8, 20):
        line(d, [(xx, h - 25), (xx, h - 1)], c.stone_dark)
    # timber frame
    for xx in (4, 88, w - 12):
        rect(d, [xx, wall_y, xx + 7, h - 1], c.wood_base)
        rect(d, [xx, wall_y, xx + 2, h - 1], c.wood_light)
        rect(d, [xx + 5, wall_y, xx + 7, h - 1], c.wood_dark)
    rect(d, [4, wall_y + 24, w - 5, wall_y + 31], c.wood_base)
    rect(d, [4, wall_y + 24, w - 5, wall_y + 26], c.wood_light)
    # diagonal braces
    line(d, [(12, wall_y + 32), (86, wall_y + 96)], c.wood_base, 5)
    line(d, [(w - 14, wall_y + 32), (96, wall_y + 96)], c.wood_base, 5)
    # plaster cracks
    r = seeded(42)
    for _ in range(8):
        x = r.randrange(18, w - 20)
        y = r.randrange(wall_y + 34, h - 30)
        d.point((x, y), fill=c.plaster_dark + (255,))
        if r.random() < 0.5:
            d.point((x + 1, y + 2), fill=c.plaster_dark + (255,))
    # door, 64 x 112
    dx, dy = 64, h - 112
    rect(d, [dx - 3, dy - 3, dx + 67, h - 1], c.wood_dark)
    for i in range(4):
        x = dx + i * 16
        rect(d, [x, dy, x + 14, h - 6], c.wood_base if i % 2 else c.wood_mid)
        line(d, [(x + 2, dy + 2), (x + 2, h - 8)], c.wood_light)
        line(d, [(x + 12, dy + 2), (x + 12, h - 8)], c.wood_dark)
    rect(d, [dx, dy + 2, dx + 63, dy + 8], c.wood_dark)
    rect(d, [dx + 2, h - 14, dx + 61, h - 8], c.wood_dark)
    # handle and hinges
    rect(d, [dx + 50, dy + 54, dx + 56, dy + 60], c.iron_light)
    rect(d, [dx + 2, dy + 22, dx + 16, dy + 25], c.iron_base)
    rect(d, [dx + 2, dy + 78, dx + 16, dy + 81], c.iron_base)
    # step
    rect(d, [dx - 8, h - 8, dx + 72, h - 1], c.stone_light)
    rect(d, [dx - 8, h - 4, dx + 72, h - 1], c.stone_mid)
    # windows, 32 x 32, lit at 19:00
    for wx in (18, w - 52):
        wy = wall_y + 52
        rect(d, [wx - 3, wy - 3, wx + 35, wy + 35], c.wood_dark)
        rect(d, [wx, wy, wx + 31, wy + 31], c.fire_base)
        # four panes
        for py in (wy + 2, wy + 17):
            for px in (wx + 2, wx + 17):
                rect(d, [px, py, px + 12, py + 12], c.fire_mid)
                rect(d, [px + 2, py + 2, px + 10, py + 8], c.fire_light)
                d.point((px + 6, py + 5), fill=c.fire_white + (255,))
        line(d, [(wx + 15, wy), (wx + 15, wy + 31)], c.wood_dark)
        line(d, [(wx, wy + 15), (wx + 31, wy + 15)], c.wood_dark)
        rect(d, [wx - 4, wy + 32, wx + 35, wy + 36], c.wood_light)
        rect(d, [wx - 4, wy + 34, wx + 35, wy + 36], c.wood_dark)
    # baked light: left edge lighter, right darker, a light band under the eave
    rect(d, [4, wall_y + 25, 10, h - 1], c.plaster_dark)
    rect(d, [w - 12, wall_y + 25, w - 5, h - 1], c.plaster_dark)
    # outline
    if look.local_outline:
        # the frame's own ramps already carry local dark steps; a one-pixel
        # contour in each material's darkest step reads as the outline
        pass
    return outline_sprite(im, c.wood_outline), 198, 252, 252 + h


def draw_well(c: Roles) -> tuple[Image.Image, int, int, int]:
    w, h = 128, 128
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    # the front face: three courses of stone, staggered
    for row in range(3):
        y = 60 + row * 19
        for i in range(7):
            x = 6 + i * 19 - (9 if row % 2 else 0)
            rect(d, [x, y, min(x + 17, 122), y + 17], c.stone_mid)
            line(d, [(x + 1, y + 1), (min(x + 16, 121), y + 1)], c.stone_light)
            line(d, [(x + 1, y + 16), (min(x + 16, 121), y + 16)], c.stone_dark)
        line(d, [(6, y + 18), (122, y + 18)], c.stone_dark)
    rect(d, [4, 116, 124, 121], c.stone_outline)
    # the rim, a ring of stone with a dark opening
    ellipse(d, [2, 14, 126, 90], c.stone_dark)
    ellipse(d, [4, 16, 124, 88], c.stone_mid)
    ellipse(d, [8, 19, 120, 84], c.stone_light)
    ellipse(d, [14, 23, 114, 80], c.stone_mid)
    # radial seams on the rim
    for a in (-2.6, -2.0, -1.2, -0.4, 0.4, 1.2, 2.0, 2.6):
        x0 = int(64 + 60 * math.cos(a))
        y0 = int(52 + 36 * math.sin(a))
        x1 = int(64 + 30 * math.cos(a))
        y1 = int(52 + 18 * math.sin(a))
        line(d, [(x0, y0), (x1, y1)], c.stone_dark)
    ellipse(d, [28, 32, 100, 72], c.stone_dark)
    ellipse(d, [34, 36, 94, 68], c.water_dark)
    ellipse(d, [42, 42, 86, 62], c.water_mid)
    for x in range(46, 84, 6):
        d.point((x, 50), fill=c.water_light + (255,))
        d.point((x + 2, 52), fill=c.water_pale + (255,))
    # posts and beam
    rect(d, [24, 0, 32, 40], c.wood_base)
    rect(d, [24, 0, 27, 40], c.wood_light)
    rect(d, [96, 0, 104, 40], c.wood_base)
    rect(d, [99, 0, 102, 40], c.wood_light)
    rect(d, [20, 0, 108, 7], c.wood_mid)
    rect(d, [20, 0, 108, 2], c.wood_light)
    rect(d, [20, 5, 108, 7], c.wood_dark)
    # rope and bucket
    line(d, [(64, 7), (64, 30)], c.iron_light)
    rect(d, [56, 28, 72, 42], c.wood_dark)
    rect(d, [58, 30, 70, 34], c.wood_base)
    rect(d, [58, 34, 70, 36], c.wood_mid)
    # moss and grass at the foot
    for x in range(8, 124, 7):
        d.point((x, 117), fill=c.grass_dark + (255,))
    for x in range(12, 120, 11):
        d.point((x, 119), fill=c.grass_base + (255,))
    return outline_sprite(im, c.stone_outline), 48, 276, 276 + h


def draw_lamp(c: Roles) -> tuple[Image.Image, int, int, int]:
    w, h = 64, 192
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    # stone base
    ellipse(d, [14, 174, 50, 190], c.stone_base)
    ellipse(d, [18, 176, 46, 186], c.stone_mid)
    # post
    rect(d, [27, 52, 36, 180], c.wood_base)
    rect(d, [27, 52, 29, 180], c.wood_light)
    rect(d, [34, 52, 36, 180], c.wood_dark)
    rect(d, [26, 112, 37, 118], c.iron_base)
    rect(d, [26, 116, 37, 118], c.iron_light)
    # bracket
    line(d, [(32, 58), (44, 50), (44, 44)], c.iron_base, 3)
    # lantern
    rect(d, [12, 10, 50, 52], c.iron_base)
    rect(d, [14, 12, 48, 50], c.fire_mid)
    # panes
    for py in (15, 33):
        for px in (16, 33):
            rect(d, [px, py, px + 13, py + 15], c.fire_mid)
            rect(d, [px + 2, py + 2, px + 11, py + 13], c.fire_light)
            d.point((px + 6, py + 7), fill=c.fire_white + (255,))
    # frame
    line(d, [(31, 12), (31, 50)], c.iron_base)
    line(d, [(14, 31), (48, 31)], c.iron_base)
    # cap and ring
    poly(d, [(10, 10), (52, 10), (46, 2), (16, 2)], c.iron_mid)
    rect(d, [14, 0, 46, 3], c.iron_light)
    line(d, [(32, 0), (32, -3)], c.iron_light)
    # bottom plate
    rect(d, [12, 50, 50, 56], c.iron_base)
    rect(d, [12, 50, 50, 52], c.iron_light)
    return outline_sprite(im, c.iron_outline), 144, 424, 424 + h


def draw_hearth(c: Roles) -> tuple[Image.Image, int, int, int]:
    w, h = 64, 64
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    # ash and logs
    ellipse(d, [8, 32, 56, 58], c.stone_dark)
    ellipse(d, [12, 36, 52, 54], c.stone_base)
    rect(d, [16, 42, 46, 48], c.wood_dark)
    rect(d, [20, 38, 44, 44], c.wood_base)
    rect(d, [18, 44, 42, 47], c.wood_mid)
    # flame: three tongues, the shape changes only in the loop
    flame(d, c, 32, 42, 1.0, 0)
    # stones round the fire, in front of the flame
    for i in range(9):
        a = -0.05 + i * (math.pi * 1.05) / 8
        x = int(32 + 27 * math.cos(a))
        y = int(50 + 13 * math.sin(a))
        rect(d, [x - 5, y - 3, x + 5, y + 3], c.stone_mid)
        rect(d, [x - 4, y - 2, x + 2, y], c.stone_light)
        rect(d, [x + 1, y + 1, x + 5, y + 3], c.stone_dark)
    # embers
    for x, y in [(22, 50), (42, 49), (30, 53), (38, 54)]:
        d.point((x, y), fill=c.fire_mid + (255,))
    return outline_sprite(im, c.stone_outline), 240, 680, 680 + h


def flame(d, c: Roles, x: int, base: int, scale: float, phase: int) -> None:
    cols = [
        (-10, 10, 2, 0.2, c.fire_base),
        (10, 11, 2, 1.6, c.fire_base),
        (-6, 19, 3, 0.8, c.fire_mid),
        (6, 16, 3, 0.6, c.fire_mid),
        (-2, 25, 3, 0.4, c.fire_light),
        (2, 22, 3, 1.2, c.fire_mid),
    ]
    for cx_off, hgt, wid, off, col in cols:
        hh = max(5, int(hgt * scale + 3 * math.sin(phase * 0.9 + off)))
        for i in range(hh):
            t = i / max(1, hh - 1)
            half = max(1, int(wid * (1 - t * 0.75)))
            jitter = int(1.3 * math.sin(phase * 1.7 + off + i * 0.9))
            xx = x + cx_off + jitter + int(cx_off * 0.12 * t)
            cc = col
            if abs(cx_off) <= 2 and t > 0.45:
                cc = c.fire_mid
            if abs(cx_off) <= 2 and t < 0.2:
                cc = c.fire_light
            line(d, [(xx - half, base - i), (xx + half, base - i)], cc)
    # a dark log and embers under the fire
    rect(d, [x - 13, base - 2, x + 13, base + 2], c.wood_dark)
    rect(d, [x - 11, base - 2, x + 11, base], c.wood_base)
    for ex, ey in [(-15, 2), (15, 2), (-7, 4), (9, 4)]:
        d.point((x + ex, base + ey), fill=c.fire_base + (255,))


def draw_tree(c: Roles, look: Look, w: int = 128, h: int = 192, seed: int = 51) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    r = seeded(seed)
    # trunk
    tx = w // 2
    rect(d, [tx - 7, h - 72, tx + 7, h - 8], c.wood_base)
    rect(d, [tx - 7, h - 72, tx - 4, h - 8], c.wood_light)
    rect(d, [tx + 4, h - 72, tx + 7, h - 8], c.wood_dark)
    # roots
    line(d, [(tx - 7, h - 12), (tx - 16, h - 4)], c.wood_base, 3)
    line(d, [(tx + 7, h - 12), (tx + 16, h - 4)], c.wood_base, 3)
    # canopy blobs, dark to light
    blobs = []
    for i in range(11):
        bx = tx + int(34 * math.cos(i * 2.1)) + r.randrange(-6, 7)
        by = 54 + int(30 * math.sin(i * 1.4)) + r.randrange(-6, 7)
        br = 24 + r.randrange(14)
        blobs.append((bx, by, br))
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    for bx, by, br in blobs:
        md.ellipse([bx - br, by - br, bx + br, by + br], fill=255)
    # local outline / dark base
    dark = canvas(w, h)
    dd = ImageDraw.Draw(dark)
    for bx, by, br in blobs:
        dd.ellipse([bx - br - 1, by - br - 1, bx + br + 1, by + br + 1], fill=c.grass_outline + (255,))
    for bx, by, br in blobs:
        dd.ellipse([bx - br, by - br, bx + br, by + br], fill=c.grass_dark + (255,))
    im.alpha_composite(dark)
    # mid and light clusters
    mid = canvas(w, h)
    md2 = ImageDraw.Draw(mid)
    for bx, by, br in blobs:
        md2.ellipse([bx - br + 3, by - br + 2, bx + br - 4, by + br - 4], fill=c.grass_base + (255,))
    im.alpha_composite(Image.composite(mid, canvas(w, h), mask))
    light = canvas(w, h)
    ld = ImageDraw.Draw(light)
    for bx, by, br in blobs:
        ld.ellipse([bx - br + 7, by - br + 5, bx + br - 11, by + br - 13], fill=c.grass_light + (255,))
        ld.ellipse([bx - br + 11, by - br + 8, bx - br + 18, by - br + 13], fill=c.grass_light + (255,))
    im.alpha_composite(light)
    # leaf texture
    for _ in range(40):
        x = r.randrange(8, w - 8)
        y = r.randrange(8, 120)
        if mask.getpixel((x, y)):
            d.point((x, y), fill=(c.grass_dark if r.random() < 0.5 else c.grass_light) + (255,))
    return outline_sprite(im, c.grass_outline)


def draw_boat(c: Roles) -> Image.Image:
    w, h = 84, 30
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    poly(d, [(2, 8), (80, 8), (70, 24), (12, 24)], c.wood_base)
    poly(d, [(6, 10), (76, 10), (66, 21), (16, 21)], c.wood_dark)
    poly(d, [(10, 12), (72, 12), (64, 19), (18, 19)], c.wood_mid)
    rect(d, [16, 14, 64, 17], c.wood_light)
    line(d, [(20, 10), (60, 10)], c.wood_light, 2)
    # oar
    line(d, [(64, 4), (48, 18)], c.wood_light, 2)
    return outline_sprite(im, c.wood_outline)


def draw_bench(c: Roles) -> Image.Image:
    im = canvas(64, 26)
    d = ImageDraw.Draw(im)
    rect(d, [2, 4, 61, 10], c.wood_mid)
    rect(d, [2, 4, 61, 6], c.wood_light)
    rect(d, [4, 10, 9, 25], c.wood_dark)
    rect(d, [54, 10, 59, 25], c.wood_dark)
    return outline_sprite(im, c.wood_outline)


def draw_barrel(c: Roles) -> Image.Image:
    im = canvas(24, 30)
    d = ImageDraw.Draw(im)
    rect(d, [4, 2, 20, 28], c.wood_base)
    rect(d, [6, 2, 18, 28], c.wood_mid)
    rect(d, [6, 2, 9, 28], c.wood_light)
    rect(d, [4, 7, 20, 9], c.iron_base)
    rect(d, [4, 21, 20, 23], c.iron_base)
    ellipse(d, [4, 0, 20, 5], c.wood_light)
    return outline_sprite(im, c.wood_outline)


def draw_crate(c: Roles) -> Image.Image:
    im = canvas(30, 28)
    d = ImageDraw.Draw(im)
    rect(d, [1, 2, 29, 27], c.wood_base)
    rect(d, [3, 4, 27, 25], c.wood_mid)
    line(d, [(3, 4), (27, 25)], c.wood_dark, 2)
    line(d, [(27, 4), (3, 25)], c.wood_dark, 2)
    rect(d, [1, 2, 29, 4], c.wood_light)
    return im


def draw_elder(c: Roles, look: Look) -> Image.Image:
    """A script-drawn 64x96 stand-in for the 16 px elder, in the scene's ramps."""
    w, h = 64, 96
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    outline = c.wood_outline
    skin, skin_l, skin_d = c.skin_base, c.skin_light, c.skin_dark
    robe, robe_l, robe_d = c.wood_base, c.wood_mid, c.wood_dark
    hair, hair_d = c.hair_light, c.hair_mid
    # robe, wider at the foot
    poly(d, [(17, 38), (47, 38), (53, 92), (11, 92)], robe)
    poly(d, [(17, 38), (24, 38), (21, 92), (11, 92)], robe_l)
    poly(d, [(42, 38), (47, 38), (53, 92), (46, 92)], robe_d)
    # a hood's shadow at the shoulders
    rect(d, [20, 38, 44, 42], robe_d)
    # belt and a hanging cord
    rect(d, [14, 62, 50, 68], c.cloth_dark)
    rect(d, [28, 61, 36, 69], c.cloth_base)
    rect(d, [31, 69, 33, 82], c.cloth_base)
    # arms
    poly(d, [(17, 42), (12, 44), (14, 70), (20, 68)], robe)
    poly(d, [(47, 42), (52, 44), (50, 70), (44, 68)], robe_d)
    # hands
    rect(d, [12, 68, 18, 74], skin)
    rect(d, [46, 68, 52, 74], skin_d)
    # head: 24 wide, round
    rect(d, [21, 14, 43, 40], skin)
    rect(d, [21, 14, 23, 40], skin_l)
    rect(d, [41, 14, 43, 40], skin_d)
    d.point((20, 22), fill=skin_l + (255,))
    d.point((44, 22), fill=skin_d + (255,))
    # white hair, a hood-like cap
    rect(d, [19, 10, 45, 18], hair)
    rect(d, [19, 10, 45, 12], c.hair_light)
    rect(d, [18, 16, 22, 30], hair)
    rect(d, [42, 16, 46, 30], hair_d)
    # brows, eyes, nose
    rect(d, [24, 24, 29, 25], hair_d)
    rect(d, [35, 24, 40, 25], hair_d)
    rect(d, [25, 26, 28, 29], skin_d)
    rect(d, [36, 26, 39, 29], skin_d)
    d.point((26, 27), fill=c.fire_white + (255,))
    d.point((37, 27), fill=c.fire_white + (255,))
    rect(d, [30, 27, 34, 34], skin_d)
    # beard and moustache
    poly(d, [(21, 33), (43, 33), (41, 44), (32, 52), (23, 44)], hair)
    poly(d, [(24, 35), (40, 35), (38, 42), (32, 47), (26, 42)], hair_d)
    rect(d, [21, 32, 43, 36], hair)
    rect(d, [28, 44, 36, 48], hair)
    # staff
    rect(d, [53, 20, 57, 92], c.wood_dark)
    rect(d, [53, 20, 54, 92], c.wood_light)
    ellipse(d, [50, 14, 60, 24], c.iron_light)
    ellipse(d, [52, 16, 58, 22], c.iron_base)
    # boots
    rect(d, [14, 90, 29, 94], c.wood_dark)
    rect(d, [35, 90, 50, 94], c.wood_dark)
    rect(d, [14, 90, 29, 91], c.wood_base)
    rect(d, [35, 90, 50, 91], c.wood_base)
    # outline: a one-pixel contour in the local darkest step
    mask = alpha_of(im)
    edge = mask.filter(ImageFilter.FIND_EDGES)
    for y in range(h):
        for x in range(w):
            if edge.getpixel((x, y)) > 0 and mask.getpixel((x, y)) == 0:
                d.point((x, y), fill=outline + (255,))
    return im


def draw_bird(c: Roles) -> Image.Image:
    im = canvas(24, 16)
    d = ImageDraw.Draw(im)
    # two swept wings and a small body
    poly(d, [(12, 8), (9, 6), (1, 3), (5, 8), (11, 11)], c.iron_light)
    poly(d, [(12, 8), (15, 6), (23, 3), (19, 8), (13, 11)], c.iron_light)
    line(d, [(3, 4), (8, 7)], c.hair_light)
    line(d, [(21, 4), (16, 7)], c.hair_light)
    ellipse(d, [10, 6, 14, 11], c.hair_light)
    d.point((15, 7), fill=c.iron_mid + (255,))
    line(d, [(11, 11), (10, 14)], c.iron_mid)
    line(d, [(13, 11), (14, 14)], c.iron_mid)
    return outline_sprite(im, c.iron_outline)


def smoke_plume(d, c: Roles, x: int, base: int, height: int, phase: float = 0.0) -> None:
    """A column of puffs: small at the chimney, larger and thinner as it rises."""
    puffs = [(0.00, 3), (0.18, 5), (0.38, 7), (0.60, 8), (0.82, 8), (1.0, 6)]
    for k, (t, r) in enumerate(puffs):
        drift = 5 * math.sin(t * 5.2 + phase * 6.28)
        cx = x - int(24 * t + drift)
        cy = base - int(height * t)
        for ox, oy, rr in ((-r // 2, 1, r), (r // 2, 0, max(2, r - 1)), (0, -r // 2, max(2, r - 1))):
            ellipse(d, [cx + ox - rr, cy + oy - rr, cx + ox + rr, cy + oy + rr], c.iron_light)
        # the light sits on the top-left of the puff, the shade on its foot
        ellipse(d, [cx - r, cy - r, cx + r // 2, cy + r // 3], c.hair_mid)
        for i in range(r):
            d.point((cx - r + 2 + i, cy + r - 1), fill=c.iron_mid + (255,))
        for i in range(r // 2):
            d.point((cx + r - 1, cy - r // 2 + i), fill=c.iron_mid + (255,))
        if k in (2, 4):
            d.point((cx + r, cy - r // 2), fill=c.hair_mid + (255,))


def draw_grass_patch(c: Roles, w: int, h: int, seed: int, scale: float = 1.0) -> Image.Image:
    im = canvas(w, h)
    d = ImageDraw.Draw(im)
    r = seeded(seed)
    for i in range(w // 4):
        x = r.randrange(2, w - 2)
        base = h - r.randrange(0, 4)
        height = int((14 + r.randrange(14)) * scale)
        lean = r.choice([-2, -1, 0, 1, 2])
        col = c.grass_dark if i % 3 else c.grass_light
        line(d, [(x, base), (x + lean // 2, base - height // 2), (x + lean, base - height)], col, 1)
        d.point((x, base), fill=c.grass_outline + (255,))
    return im


# ---------------------------------------------------------------- body light


class Stepper:
    """Maps a colour to its ramp and shifts it one step, all in declared ramps."""

    def __init__(self, look: Look):
        self.map: dict[tuple[int, int, int], list[tuple[int, int, int]]] = {}
        for ramp in look.ramps.values():
            for col in ramp:
                self.map.setdefault(col, ramp)

    def shift(self, col: tuple[int, int, int], delta: int) -> tuple[int, int, int]:
        ramp = self.map.get(col)
        if not ramp:
            return col
        i = ramp.index(col) + delta
        if i < 0:
            return col
        return ramp[min(i, len(ramp) - 1)]


def body_light(img: Image.Image, stepper: Stepper, from_left: bool = True,
               protect: frozenset[tuple[int, int, int]] = frozenset()) -> Image.Image:
    """Four art px on the lit side one step lighter, the far side one step darker."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        xs = [x for x in range(w) if px[x, y][3] > 0]
        if not xs:
            continue
        left, right = xs[0], xs[-1]
        for k in range(4):
            lx = left + k
            rx = right - k
            if lx <= right:
                r, g, b, a = px[lx, y]
                if a and (r, g, b) not in protect:
                    px[lx, y] = stepper.shift((r, g, b), 1 if from_left else -1) + (a,)
            if rx >= left:
                r, g, b, a = px[rx, y]
                if a and (r, g, b) not in protect:
                    px[rx, y] = stepper.shift((r, g, b), -1 if from_left else 1) + (a,)
    return out


def load_pell(name: str, stepper: Stepper, protect: set[tuple[int, int, int]]) -> Image.Image:
    im = Image.open(INPUTS / f"pell-{name}.png").convert("RGBA")
    source = im.copy()
    lit = body_light(source, stepper, protect=frozenset(protect))
    # the outline is the sprite's darkest step; body light never lifts it
    out = source.copy()
    sp = source.load()
    lp = lit.load()
    op = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = sp[x, y]
            if a and (r, g, b) not in protect:
                op[x, y] = lp[x, y]
    return out


# ---------------------------------------------------------------- light


@dataclass(frozen=True)
class Light:
    x: float
    y: float
    radii: tuple[float, ...]
    peak: float
    kind: str


def pool_alpha(img_size, lights: list[Light], base: float, dither: bool) -> Image.Image:
    """The darkness left on each pixel after every light cuts its pool."""
    w, h = img_size
    acc = Image.new("L", (w, h), round(255 * base))
    for light in lights:
        m = Image.new("L", (w, h), round(255 * base))
        d = ImageDraw.Draw(m)
        n = len(light.radii)
        # from the outside in, each ring one step lighter
        for i in range(n):
            r = light.radii[n - 1 - i]
            a = base * ((n - 1 - i) / n)
            d.ellipse([light.x - r, light.y - r, light.x + r, light.y + r], fill=round(255 * a))
        if dither:
            # 50% checker in a 6 px band at each boundary
            px = m.load()
            for i, r in enumerate(light.radii[:-1]):
                a_in = base * (i / n)
                a_out = base * ((i + 1) / n)
                for yy in range(int(light.y - r - 3), int(light.y + r + 4)):
                    for xx in range(int(light.x - r - 3), int(light.x + r + 4)):
                        if not (0 <= xx < w and 0 <= yy < h):
                            continue
                        dist = math.hypot(xx - light.x, yy - light.y)
                        if abs(dist - r) <= 3:
                            px[xx, yy] = round(255 * (a_in if (xx + yy) % 2 == 0 else a_out))
        acc = ImageChops.darker(acc, m)
    return acc


def light_frame(
    img: Image.Image,
    lamps: list[Light],
    fires: list[Light],
    windows: list[Light],
    *,
    warm: tuple[tuple[int, int, int], float],
    base_dark: float,
    dither: bool,
    glow: bool,
) -> Image.Image:
    # the warm wash sits under the blue shade, as in the game
    out = multiply(img, warm[0], warm[1])
    # the pools: the blue shade cut by every light
    lights = lamps + fires + windows
    alpha = pool_alpha(out.size, lights, base_dark, dither)
    shade = Image.new("RGBA", out.size, hx("#172a52") + (0,))
    shade.putalpha(alpha)
    out.alpha_composite(shade)
    return out


# ---------------------------------------------------------------- scene


@dataclass
class Scene:
    img: Image.Image
    casters: list[tuple[Image.Image, int, int, int, int, bool]]


def compose_scene(look: Look, *, pell: Image.Image | None = None,
                  pell_pos: tuple[int, int] = (312, 696), elder: bool = True,
                  tall_grass: bool = True, bird: bool = True,
                  canopy_shade: bool = False, smoke_static: bool = True,
                  water_phase: int = 0) -> Scene:
    c = Roles(look)
    stepper = Stepper(look)
    ground = canvas()

    draw_far_bank(ground, look, c)
    draw_shore_base(ground, c)
    draw_water(ground, look, c)
    draw_shore_details(ground, c)
    draw_cobble(ground, c)
    draw_path(ground, c)

    # props
    house, hx0, hy0, hfeet = draw_house(c, look)
    well, wx0, wy0, wfeet = draw_well(c)
    lamp, lx0, ly0, lfeet = draw_lamp(c)
    hearth, fx0, fy0, ffeet = draw_hearth(c)
    tree = draw_tree(c, look)
    boat = draw_boat(c)
    bench = draw_bench(c)
    barrel = draw_barrel(c)
    crate = draw_crate(c)
    b = draw_bird(c)
    elder_s = draw_elder(c, look) if elder else None

    # the far-bank oak is a canopy only, overhanging the water
    far_tree = draw_tree(c, look, 200, 150, seed=71).crop((0, 0, 200, 132))
    far_pos = (-54, -30)

    # reflections on the water: the far tree and the boat, flipped, cut at the shore,
    # and stepped 2 px sideways every 4 rows as the water moves
    refl_col = hx("#275a99") if look.name == "L0" else look.step("water2", 1)
    for spr, x, y in ((far_tree, far_pos[0], far_pos[1]), (boat, 248, 104)):
        refl = spr.transpose(Image.FLIP_TOP_BOTTOM)
        ry = y + spr.height + 10
        alpha = refl.getchannel("A")
        for row in range(refl.height):
            sy = ry + row
            if not (56 <= sy <= 195):
                continue
            src_y = row
            shift = 2 if ((row // 4 + water_phase) % 2 == 0) else 0
            for sx in range(refl.width):
                a = alpha.getpixel((sx, src_y))
                if not a:
                    continue
                px = x + sx + shift
                if 0 <= px < W:
                    base = ground.getpixel((px, sy))
                    ground.putpixel((px, sy), blend_over(base[:3], refl_col, 0.35) + (255,))
    # clip the reflections to the water
    water_mask = Image.new("L", (W, H), 0)
    wd = ImageDraw.Draw(water_mask)
    wd.rectangle([0, 56, W, 197], fill=255)

    # cast shadow union
    union = Image.new("L", (W, H), 0)
    casters: list[tuple[Image.Image, int, int, int, int, bool]] = [
        (house, hx0, hy0, hfeet, 140, True),
        (lamp, lx0, ly0, lfeet, 192, True),
        (hearth, fx0, fy0, ffeet, 40, True),
        (tree, -32, 652, 652 + tree.height, 150, True),
        (bench, 24, 470, 496, 20, True),
        (barrel, 92, 442, 472, 28, True),
        (crate, 116, 478, 506, 26, True),
    ]
    if elder_s is not None:
        casters.append((elder_s, 208, 572, 668, 96, True))
    if pell is not None:
        casters.append((pell, pell_pos[0], pell_pos[1], pell_pos[1] + 96, 96, True))


    for spr, x, y, feet, cap, contact in casters:
        m = Image.new("L", (W, H), 0)
        m.paste(spr.getchannel("A"), (x, y))
        sm = shadow_mask(m, feet, 0.92, 0.36, cap)
        union = ImageChops.lighter(union, sm)
    wm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(wm).ellipse([wx0 + 20, wy0 + 108, wx0 + 172, wy0 + 142], fill=255)
    union = ImageChops.lighter(union, wm)
    if bird:
        # a body above the ground: its shadow stays on the ground
        bm = Image.new("L", (W, H), 0)
        ImageDraw.Draw(bm).ellipse([272, 624, 308, 636], fill=255)
        union = ImageChops.lighter(union, bm)
    apply_shadow(ground, union, hx("#1b1a2e"), 0.30)
    for spr, x, y, feet, cap, contact in casters:
        if not contact:
            continue
        m = Image.new("L", (W, H), 0)
        m.paste(spr.getchannel("A"), (x, y))
        contact_line(ground, m, feet, hx("#1b1a2e"))
    layer = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle([wx0 + 18, wfeet, wx0 + 118, wfeet + 3],
                                    fill=hx("#1b1a2e") + (round(255 * 0.45),))
    ground.alpha_composite(layer)

    # cloud shadows, 12%, in whole pixels
    cloud = Image.new("L", (W, H), 0)
    cd = ImageDraw.Draw(cloud)
    r = seeded(81)
    cd.polygon([(0, 556), (390, 606), (390, 664), (0, 614)], fill=255)
    for cx, cy, cw, ch in [(120, 500, 200, 80), (300, 760, 150, 70)]:
        for _ in range(7):
            x = cx + r.randrange(-cw // 3, cw // 3)
            y = cy + r.randrange(-ch // 3, ch // 3)
            cd.ellipse([x - cw // 3, y - ch // 3, x + cw // 3, y + ch // 3], fill=255)
    apply_shadow(ground, cloud, hx("#1b1a2e"), 0.12)

    if canopy_shade:
        # 12% under the canopies, the strength of a cloud shadow
        cm = Image.new("L", (W, H), 0)
        cm.paste(tree.getchannel("A"), (-32, 652 + 46))
        cm.paste(far_tree.getchannel("A"), (far_pos[0], far_pos[1] + 30))
        apply_shadow(ground, cm, hx("#1b1a2e"), 0.12)

    # paste props back to front
    for spr, x, y in [
        (house, hx0, hy0),
        (well, wx0, wy0),
        (tree, -32, 652),
        (bench, 24, 470),
        (barrel, 92, 442),
        (crate, 116, 478),
        (lamp, lx0, ly0),
        (hearth, fx0, fy0),
    ]:
        paste(ground, spr, x, y)
    if far_tree:
        paste(ground, far_tree, far_pos[0], far_pos[1])
    paste(ground, boat, 248, 104)
    if elder_s is not None:
        paste(ground, body_light(elder_s, stepper, protect=frozenset({c.wood_outline})), 208, 572)
    if pell is not None:
        paste(ground, pell, pell_pos[0], pell_pos[1])
    if tall_grass:
        grass = draw_grass_patch(c, 104, 80, 91, 1.45)
        paste(ground, grass, 288, 724)
    if bird:
        paste(ground, b, 230, 540)

    # a still plume from the chimney; the loop moves it
    if smoke_static:
        smoke = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(smoke)
        smoke_plume(sd, c, 351, 248, 54, 0.0)
        ground.alpha_composite(smoke)

    return Scene(ground, casters)


# ---------------------------------------------------------------- frames


LIGHTS_L0 = {
    "lamp": Light(144 + 26, 424 + 34, (96.0, 160.0), 0.08, "lamp"),
    "hearth": Light(240 + 32, 680 + 40, (40.0, 104.0), 0.08, "fire"),
    "window_l": Light(198 + 34, 252 + 108 + 52 + 16, (24.0, 56.0), 0.06, "window"),
    "window_r": Light(198 + 156, 252 + 108 + 52 + 16, (24.0, 56.0), 0.06, "window"),
}

LIGHTS_L2 = {
    "lamp": Light(170, 458, (96.0, 118.0, 140.0, 160.0), 0.10, "lamp"),
    "hearth": Light(272, 720, (40.0, 62.0, 84.0, 104.0), 0.10, "fire"),
    "window_l": Light(232, 428, (24.0, 34.0, 44.0, 56.0), 0.08, "window"),
    "window_r": Light(354, 428, (24.0, 34.0, 44.0, 56.0), 0.08, "window"),
}


def make_world(look: Look, *, pell_sprite: Image.Image | None = None,
               level: str = "L0", canopy: bool = True, tall_grass: bool = True,
               elder: bool = True, bird: bool = True,
               pell_pos: tuple[int, int] = (312, 696),
               motion: int | None = None) -> Image.Image:
    scene = compose_scene(look, pell=pell_sprite, pell_pos=pell_pos, elder=elder,
                          tall_grass=tall_grass, bird=bird,
                          canopy_shade=(level == "L2" and canopy),
                          smoke_static=(motion is None),
                          water_phase=(motion or 0))
    img = scene.img
    if motion is not None:
        img.alpha_composite(motion_overlay(Roles(look), motion))
    if level == "L0":
        return light_frame(img, [LIGHTS_L0["lamp"]], [LIGHTS_L0["hearth"]],
                           [LIGHTS_L0["window_l"], LIGHTS_L0["window_r"]],
                           warm=(hx("#eda83a"), 0.13), base_dark=0.40,
                           dither=False, glow=False)
    return light_frame(img, [LIGHTS_L2["lamp"]], [LIGHTS_L2["hearth"]],
                       [LIGHTS_L2["window_l"], LIGHTS_L2["window_r"]],
                       warm=(hx("#e2533f"), 0.28), base_dark=0.40,
                       dither=True, glow=False)


def pell_frame(look: Look, name: str) -> Image.Image:
    stepper = Stepper(look)
    protect = {hx("#1b1a2e")} if name != "C" else {(93, 24, 62), (107, 29, 58)}
    sprite = load_pell(name, stepper, protect)
    return make_world(look, pell_sprite=sprite, level="L0", tall_grass=False,
                      elder=False, bird=False, pell_pos=(190, 620))


def upscale(img: Image.Image, scale: int = SCALE) -> Image.Image:
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def save(img: Image.Image, name: str) -> Path:
    if img.getchannel("A").getextrema() != (255, 255):
        raise SystemExit(f"{name}: a half-clear pixel; every pixel is fully solid")
    path = FRAMES / name
    upscale(img).convert("RGB").save(path, optimize=True)
    return path


# ---------------------------------------------------------------- the loop


def motion_overlay(c: Roles, frame: int, n: int = 10) -> Image.Image:
    """One second at 10 fps: smoke, flame, sway, ripples."""
    im = canvas()
    d = ImageDraw.Draw(im)
    t = frame / n
    # smoke from the chimney: one plume that breathes and drifts
    smoke_plume(d, c, 351, 250, 56 + int(6 * math.sin(t * 6.28)), t)
    # hearth flame, redrawn on top of the still's flame
    flame(d, c, 272, 722, 1.0 + 0.20 * math.sin(t * 6.28), frame * 2)
    # grass sway: the shore tufts and the tall grass in front of Pell
    r = seeded(101)
    for _ in range(24):
        x = r.randrange(4, W - 4)
        y = r.randrange(196, 236)
        lean = int(round(2 * math.sin(t * 6.28 + x * 0.3)))
        line(d, [(x, y), (x + lean, y - 8)], c.grass_light if r.random() < 0.5 else c.grass_dark)
    r = seeded(103)
    for _ in range(26):
        x = r.randrange(296, 388)
        y = r.randrange(800, 824)
        h = 18 + r.randrange(14)
        lean = int(round(3 * math.sin(t * 6.28 + x * 0.22)))
        line(d, [(x, y), (x + lean // 2, y - h // 2), (x + lean, y - h)],
             c.grass_light if r.random() < 0.5 else c.grass_dark)
    # water ripples: dashes drift right
    r = seeded(102)
    for _ in range(22):
        x = (r.randrange(0, W) + frame * 4) % W
        y = r.randrange(62, 190)
        line(d, [(x, y), (x + 11, y)], c.water_pale)
        d.point((x + 5, y + 1), fill=c.water_light + (255,))
    return im


def make_loop_frames(look: Look, pell_sprite: Image.Image, n: int = 10) -> list[Image.Image]:
    return [
        make_world(look, pell_sprite=pell_sprite, level="L2", motion=i)
        for i in range(n)
    ]


def save_gif(frames: list[Image.Image], name: str) -> Path:
    for i, f in enumerate(frames):
        if f.getchannel("A").getextrema() != (255, 255):
            raise SystemExit(f"{name} frame {i}: a half-clear pixel")
    path = FRAMES / name
    big = [upscale(f).convert("RGB") for f in frames]
    # a single adaptive palette keeps the loop steady from frame to frame
    pal = big[0].quantize(colors=256, method=Image.MEDIANCUT)
    quants = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in big]
    quants[0].save(path, save_all=True, append_images=quants[1:], duration=100,
                   loop=0, optimize=True, disposal=2)
    return path


# ---------------------------------------------------------------- check


def all_ramp_colors(look: Look) -> set[tuple[int, int, int]]:
    out = set()
    for ramp in look.ramps.values():
        out.update(ramp)
    return out


_over_cache: dict[tuple[tuple[int, int, int], tuple[int, int, int], int], tuple[int, int, int]] = {}
_mult_cache: dict[tuple[tuple[int, int, int], tuple[int, int, int], int], tuple[int, int, int]] = {}


def blend_over(base, color, a):
    key = (base, color, round(255 * a))
    hit = _over_cache.get(key)
    if hit is not None:
        return hit
    im = Image.new("RGBA", (1, 1), base + (255,))
    im.alpha_composite(Image.new("RGBA", (1, 1), color + (round(255 * a),)))
    out = im.getpixel((0, 0))[:3]
    _over_cache[key] = out
    return out


def blend_mult(base, color, a):
    key = (base, color, round(a * 1000))
    hit = _mult_cache.get(key)
    if hit is not None:
        return hit
    im = Image.new("RGBA", (1, 1), base + (255,))
    tint = Image.new("RGBA", (1, 1), color + (255,))
    out = Image.blend(im, ImageChops.multiply(im, tint), a).getpixel((0, 0))[:3]
    _mult_cache[key] = out
    return out


def declared_colors(look: Look, level: str, extra: set[tuple[int, int, int]] | None = None) -> set[int]:
    """Every pixel must be a ramp step or one declared blend of one.

    The blends are the ones the renderer applies, in its order: a reflection,
    a cast/contact shadow, a cloud shadow, a canopy shade, the hour's wash,
    the blue shade and the pool's steps.
    """
    base = all_ramp_colors(look)
    if extra:
        base |= extra
    dark = hx("#1b1a2e")
    blue = hx("#172a52")
    refl = hx("#275a99") if look.name == "L0" else look.step("water2", 1)
    warm = (hx("#eda83a"), 0.13) if level == "L0" else (hx("#e2533f"), 0.28)
    dark_level = 0.40
    pool = [dark_level * i / 2 for i in range(3)] if level == "L0" else [dark_level * i / 4 for i in range(5)]
    allowed: set[int] = set()

    def add(col):
        allowed.add((col[0] << 16) | (col[1] << 8) | col[2])

    for col in base:
        for ra in (0.0, 0.35):
            c1 = blend_over(col, refl, ra) if ra else col
            for sa in (0.0, 0.30, 0.45):
                c2 = blend_over(c1, dark, sa) if sa else c1
                for sb in (0.0, 0.30, 0.45):
                    c2b = blend_over(c2, dark, sb) if sb else c2
                    for ca in (0.0, 0.12):
                        c3 = blend_over(c2b, dark, ca) if ca else c2b
                        for na in (0.0, 0.12):
                            c4 = blend_over(c3, dark, na) if na else c3
                            c5 = blend_mult(c4, warm[0], warm[1])
                            for pa in pool:
                                c6 = blend_over(c5, blue, pa) if pa else c5
                                add(c6)
    return allowed


def check(path: Path, allowed: set[int]) -> tuple[int, int]:
    im = Image.open(path).convert("RGB")
    if im.size != (W * SCALE, H * SCALE):
        raise SystemExit(f"{path.name}: {im.size}, not {(W * SCALE, H * SCALE)}")
    px = im.load()
    bad = 0
    first = None
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            k = (r << 16) | (g << 8) | b
            if k not in allowed:
                bad += 1
                if first is None:
                    first = (x, y, (r, g, b))
    if bad:
        raise SystemExit(f"{path.name}: {bad} pixels outside the declared ramps, first {first}")
    return im.width, im.height


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    core = core_look()
    mat = material_look()
    stepper_core = Stepper(core)

    pell_a = load_pell("A", stepper_core, {hx("#1b1a2e")})

    frames = {}
    frames["L0"] = make_world(core, pell_sprite=pell_a, level="L0")
    frames["L1"] = make_world(mat, pell_sprite=pell_a, level="L0")
    frames["L2"] = make_world(mat, pell_sprite=pell_a, level="L2")

    paths = {}
    for name, img in frames.items():
        paths[name] = save(img, f"2026-10-20-art-{name}.png")

    loop = make_loop_frames(mat, pell_a)
    paths["L3"] = save(loop[0], "2026-10-20-art-L3.png")
    paths["loop"] = save_gif(loop, "2026-10-20-art-L3-loop.gif")

    for name in "ABC":
        img = pell_frame(core, name)
        paths[f"pell-{name}"] = save(img, f"2026-10-20-pell-{name}.png")

    # palette check: the stills (the GIF is a 256-colour reduction of them)
    pell_c = set()
    im = Image.open(INPUTS / "pell-C.png").convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                pell_c.add((r, g, b))
    checks = {
        "L0": declared_colors(core, "L0"),
        "L1": declared_colors(mat, "L0"),
        "L2": declared_colors(mat, "L2"),
        "L3": declared_colors(mat, "L2"),
        "pell-A": declared_colors(core, "L0"),
        "pell-B": declared_colors(core, "L0"),
        "pell-C": declared_colors(core, "L0", pell_c),
    }
    report = []
    for name, path in paths.items():
        if name == "loop":
            continue
        key = name if name in checks else name
        if key not in checks:
            continue
        w, h = check(path, checks[key])
        report.append(f"{path.name}: {w}x{h}, in the declared ramps")

    print("\n".join(report))
    print(f"\n{len(paths)} files in {FRAMES}")
    print("ramp hues (dark to light):")
    for ramp, steps in MATERIAL.items():
        print(f"  {ramp:8s} {hue_steps(steps)}")


if __name__ == "__main__":
    main()
