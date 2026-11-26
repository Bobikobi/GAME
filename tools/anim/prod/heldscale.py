#!/usr/bin/env python3
"""Rescale the stone drawn into the lift and carry clips to the world stone's size (public #874, DECISIONS 2026-11-26).

  heldscale.py --kit content/kit/core --world-scale 0.70 [--races human] [--verbs lift,carry] [--cap 1.4] [--write]

An object keeps its size in an interaction: the stone in a figure's hands is the size it has lying in the world (tools/src/kit/held.ts
is the check, `pnpm art:held` the table). A clip whose stone is drawn small is mended here by SCALING THE PIXELS ALREADY DRAWN, never by
drawing: per frame the stone's grey body is found at the clip's `hand` point (the same cut as held.ts), the stone's pixels (body and its
ink edge) are resampled nearest-neighbour about the stone's bottom middle by `k` (the world size over the frame's own, at most --cap,
and never under 1), the gaps that opens inside its outline are filled with the nearest drawn stone pixel of the same row, and the figure's
own pixels are laid back on top so hands and face stay as drawn. A frame where the body hides most of the stone (it measures under 60%
of the clip's largest) takes the clip's own factor instead of its own measure. The `hand` point (the stone's middle) moves with the stone.
Colours stay the ones drawn (no blend), so `pnpm check` finds no new colour and no half-transparent pixel. After a write run `pnpm kit:ink` (the ink edge of the grown stone). Without --write nothing is
written; the table of factors is printed. Python 3 with numpy and Pillow only."""
import argparse, json, sys
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image

REACH = 14
MIN_BODY = 12
WORLD_BODY = None  # the world stone's body, measured the same way, in sheet px of its picture


def grey_mask(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    luma = (r * 30 + g * 59 + b * 11) // 100
    return (a[..., 3] >= 128) & (luma >= 45) & ((mx - mn) <= 45)


def components(m):
    h, w = m.shape
    seen = np.zeros_like(m)
    out = []
    for y in range(h):
        for x in range(w):
            if m[y, x] and not seen[y, x]:
                q = deque([(y, x)])
                seen[y, x] = True
                pts = []
                while q:
                    cy, cx = q.popleft()
                    pts.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                q.append((ny, nx))
                out.append(pts)
    return out


def main_body(comps, seed, reach=REACH):
    best = None
    for pts in comps:
        if len(pts) < MIN_BODY:
            continue
        ys = np.array([p[0] for p in pts])
        xs = np.array([p[1] for p in pts])
        if np.min(np.hypot(xs - seed[0], ys - seed[1])) <= reach and (best is None or len(pts) > len(best)):
            best = pts
    return best


def box(pts):
    ys = [p[0] for p in pts]
    xs = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def stone_region(a, seed):
    """(stone mask, body points) of a frame: the grey body at the seed, small grey bits inside its box, and the ink touching it."""
    comps = components(grey_mask(a))
    body = main_body(comps, seed)
    if body is None:
        return None, None
    h, w = a.shape[:2]
    s = np.zeros((h, w), bool)
    for y, x in body:
        s[y, x] = True
    x0, y0, x1, y1 = box(body)
    for pts in comps:
        if pts is body:
            continue
        if all(x0 - 3 <= x <= x1 + 3 and y0 - 3 <= y <= y1 + 3 for y, x in pts):
            for y, x in pts:
                s[y, x] = True
    r, g, b = (a[..., i].astype(int) for i in range(3))
    luma = (r * 30 + g * 59 + b * 11) // 100
    ink = (a[..., 3] >= 128) & (luma < 45)
    grown = np.zeros_like(s)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= np.roll(np.roll(s, dy, 0), dx, 1)
    s |= grown & ink
    return s, body


def hull_rows(m):
    out = m.copy()
    for y in range(m.shape[0]):
        xs = np.where(m[y])[0]
        if len(xs):
            out[y, xs.min():xs.max() + 1] = True
    return out


def rescale(a, s, k):
    """The frame with the stone pixels `s` scaled by k about their bottom middle (nearest neighbour), the figure on top. Returns (frame, pivot)."""
    h, w = a.shape[:2]
    ys, xs = np.where(s)
    pivot = ((xs.min() + xs.max()) / 2, ys.max())
    layer = np.zeros_like(a)
    placed = np.zeros((h, w), bool)
    for Y in range(h):
        sy = int(round(pivot[1] + (Y - pivot[1]) / k))
        if not 0 <= sy < h:
            continue
        for X in range(w):
            sx = int(round(pivot[0] + (X - pivot[0]) / k))
            if 0 <= sx < w and s[sy, sx]:
                layer[Y, X] = a[sy, sx]
                placed[Y, X] = True
    filled = hull_rows(placed)
    for Y in range(h):
        last = None
        for X in range(w):
            if placed[Y, X]:
                last = layer[Y, X]
            elif filled[Y, X] and last is not None:
                layer[Y, X] = last
    figure = a.copy()
    figure[s] = 0
    out = np.zeros_like(a)
    out[filled] = layer[filled]
    on_top = figure[..., 3] > 0
    out[on_top] = figure[on_top]
    return fill_specks(out), pivot


def fill_specks(a, limit=24):
    """Enclosed see-through pockets of at most `limit` px (8-connected, the frame's border is outside) take the nearest solid colour: the importer's rule
    (tools/anim/prod/packclips.py), because laying a figure over a grown stone can close a few pixels of ground inside the outline."""
    h, w = a.shape[:2]
    clear = a[..., 3] < 128
    seen = np.zeros((h, w), bool)
    stack = [(y, x) for y in range(h) for x in range(w) if clear[y, x] and (y in (0, h - 1) or x in (0, w - 1))]
    for y, x in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for ny in range(max(0, y - 1), min(h, y + 2)):
            for nx in range(max(0, x - 1), min(w, x + 2)):
                if clear[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
    out = a.copy()
    left = set(zip(*np.nonzero(clear & ~seen)))
    while left:
        grown = {}
        for y, x in sorted(left):
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and out[ny, nx, 3] >= 128:
                    grown[(y, x)] = out[ny, nx].copy()
                    break
        if not grown:
            break
        for (y, x), c in grown.items():
            out[y, x] = c
            out[y, x, 3] = 255
        left -= set(grown)
    return out


def world_body(kit_dir, sprites):
    s = sprites["items/stone"]
    a = np.array(Image.open(Path(kit_dir) / s["file"]).convert("RGBA"))
    body = main_body(components(grey_mask(a)), (s["w"] / 2, s["h"] / 2), max(s["w"], s["h"]))
    x0, y0, x1, y1 = box(body)
    return max(x1 - x0 + 1, y1 - y0 + 1), s["density"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", required=True)
    ap.add_argument("--world-scale", type=float, required=True, help="STONE_SCALE.large in game/src/stone-art.ts")
    ap.add_argument("--races", default="human")
    ap.add_argument("--verbs", default="lift,carry")
    ap.add_argument("--cap", type=float, default=1.4)
    ap.add_argument("--keep", default="", help="clip:frame,... frames left as drawn (a hidden stone that scales badly)")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    kit_path = Path(a.kit) / "kit.json"
    kit = json.loads(kit_path.read_text())
    sprites = kit["kit"]["sprites"]
    body_px, wdens = world_body(a.kit, sprites)
    world_game = body_px * a.world_scale / wdens
    races = set(a.races.split(","))
    verbs = set(a.verbs.split(","))
    keep = {tuple(x.split(":")) for x in a.keep.split(",") if x}
    print(f"world stone body {body_px} px at scale {a.world_scale}: {world_game:.2f} game px; cap {a.cap}")
    for name, s in sorted(sprites.items()):
        cl = s.get("clip")
        if not cl or cl["verb"] not in verbs or cl["race"].split("/")[-1] not in races:
            continue
        fit = cl["fit_permille"] / 1000
        target = world_game * s["density"] / fit  # the world stone's body in this sheet's pixels
        sheet = np.array(Image.open(Path(a.kit) / s["file"]).convert("RGBA"))
        fw = s["w"]
        found = []
        for f in range(s["frames"]):
            fr = sheet[:, f * fw:(f + 1) * fw]
            mask, body = stone_region(fr, cl["hand"][f])
            if body is None:
                found.append(None)
                continue
            x0, y0, x1, y1 = box(body)
            found.append((mask, max(x1 - x0 + 1, y1 - y0 + 1)))
        sizes = [f[1] for f in found if f]
        if not sizes:
            print(f"{name}: no stone found, left as it is")
            continue
        top = max(sizes)
        k_clip = min(a.cap, max(1.0, target / top))
        out = sheet.copy()
        hand = [list(p) for p in cl["hand"]]
        line = []
        for f, got in enumerate(found):
            if got is None:
                line.append("-")
                continue
            mask, m = got
            k = k_clip if m < 0.6 * top else min(a.cap, max(1.0, target / m))
            if abs(k - 1) < 0.02 or (name, str(f)) in keep:
                line.append("1.00")
                continue
            fr = sheet[:, f * fw:(f + 1) * fw]
            new, pivot = rescale(fr, mask, k)
            out[:, f * fw:(f + 1) * fw] = new
            hx, hy = hand[f]
            hand[f] = [int(round(pivot[0] + (hx - pivot[0]) * k)), int(round(pivot[1] + (hy - pivot[1]) * k))]
            line.append(f"{k:.2f}")
        print(f"{name}: k per frame {' '.join(line)}")
        if a.write:
            Image.fromarray(out).save(Path(a.kit) / s["file"])
            cl["hand"] = hand
    if a.write:
        kit_path.write_text(json.dumps(kit, indent=2, ensure_ascii=False) + "\n")
        print("written")


if __name__ == "__main__":
    sys.exit(main())
