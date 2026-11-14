#!/usr/bin/env python3
"""Gates for one animation clip of a kept figure (anim lane, #716). Library: numpy + Pillow only, no paths of its own.

A clip is a list of 128 x 128 RGBA frames. The kept set is `<kept>/<race>/<motion>-<view>/f0..f3.png`; the reference of a
(race, view) is its `idle-<view>` set: the ground row (lowest opaque row of f0), the stance height, the palettes.

Gates, as the brief of 14.11 words them:
 (a) feet:     lowest-row spread <= 2 px after the whole-pixel re-snap, bob the re-snap adds <= 3 px. Airborne frames exempt.
 (b) identity: mean Lab distance of a frame's colours to the race's kept palette <= 18 (worst frame is the number kept).
 (c) size:     height within 3 px of the kept stance on every upright frame, first and last at least. Frames the eye
               declares a bend, crouch, recoil or reach (`bend`) are the motion; the lowest height is written.
 (e) loop:     mean absolute difference last -> first <= the largest mean absolute difference between neighbours.
 (f) aid:      components and area per frame, so a detached swoosh or line, or an area spike, is flagged for the eye.
Gate (d), the eye, is a human reading and lives in the manifest, not here."""
from __future__ import annotations
import glob
from pathlib import Path
import numpy as np
from PIL import Image

SIZE = 128
FEET_SPREAD_MAX, BOB_MAX, IDENTITY_MAX, HEIGHT_DEV_MAX = 2, 3, 18.0, 3


def lab(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    x = c @ m.T / np.array([.95047, 1, 1.08883])
    f = np.where(x > .008856, np.cbrt(x), 7.787 * x + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def load(path):
    a = np.array(Image.open(path).convert("RGBA"))
    assert a.shape == (SIZE, SIZE, 4), f"{path}: frames must be {SIZE}x{SIZE}"
    return a


def colours(arrays):
    px = [a[..., :3][a[..., 3] > 0] for a in arrays]
    return np.unique(np.concatenate(px), axis=0)


def extent(a):
    m = a[..., 3] > 0
    r = np.where(m.any(1))[0]
    c = np.where(m.any(0))[0]
    return int(r[0]), int(r[-1]), int(c[0]), int(c[-1])


def height(a):
    e = extent(a)
    return e[1] - e[0] + 1


class Reference:
    """What a (race, view) keeps: ground row, stance height, palettes, ink share of the stance."""

    def __init__(self, kept, race, view):
        base = Path(kept) / race
        stance = sorted(glob.glob(str(base / f"idle-{view}" / "f[0-9]*.png")))
        assert stance, f"no kept stance at {base}/idle-{view}"
        self.stance_frames = [load(p) for p in stance]
        self.stance = self.stance_frames[0]
        self.ground = extent(self.stance)[1]
        self.stand_h = height(self.stance)
        self.idle_palette = colours(self.stance_frames)
        allf = [load(p) for p in glob.glob(str(base / "*" / "f[0-9]*.png"))]
        self.race_palette = colours(allf)
        self.stance_area = int((self.stance[..., 3] > 0).sum())
        self.ink = ink_share(self.stance)


def snap(a, palette):
    out = np.zeros_like(a)
    m = a[..., 3] >= 128
    if m.any():
        px, pl = lab(a[..., :3][m]), lab(palette)
        out[..., :3][m] = palette[((px[:, None] - pl[None]) ** 2).sum(-1).argmin(1)]
        out[..., 3][m] = 255
    return out


def identity(a, palette):
    m = a[..., 3] > 0
    if not m.any():
        return None
    px, pl = lab(a[..., :3][m]), lab(palette)
    return round(float(np.sqrt(((px[:, None] - pl[None]) ** 2).sum(-1)).min(1).mean()), 1)


def ink_share(a):
    m = a[..., 3] > 0
    s = np.pad(m, 1)
    edge = m & ~(s[:-2, 1:-1] & s[2:, 1:-1] & s[1:-1, :-2] & s[1:-1, 2:])
    dark = (a[..., :3].astype(int).sum(-1) < 150) & m
    return round(float((dark & edge).sum() / max(1, edge.sum())), 3)


def lowest_x(a):
    m = a[..., 3] > 0
    r = np.where(m.any(1))[0][-1]
    return round(float(np.where(m[r - 1:r + 1].any(0))[0].mean()), 1)


def shift_rows(a, s):
    y = np.roll(a, s, axis=0)
    if s > 0:
        y[:s] = 0
    elif s < 0:
        y[s:] = 0
    return y


def components(a):
    """Areas of the 8-connected opaque components, largest first."""
    m = a[..., 3] > 0
    seen = np.zeros_like(m)
    areas = []
    for y, x in zip(*np.where(m)):
        if seen[y, x]:
            continue
        stack, n = [(y, x)], 0
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            n += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < SIZE and 0 <= nx < SIZE and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        areas.append(n)
    return sorted(areas, reverse=True)


def scale(a, z):
    """Whole-number nearest-neighbour enlargement by repeat. (Pillow 12.1.1 on this machine returns NULL from resize(NEAREST).)"""
    return np.repeat(np.repeat(a, z, axis=0), z, axis=1)


def mad(a, b):
    """Mean absolute difference of two RGBA frames over every pixel and channel."""
    return float(np.abs(a.astype(float) - b.astype(float)).mean())


def run(frames, ref, *, air=(), bend=(), loop=False, loop_from=0, no_resnap=False, key_range=None, effect=()):
    """frames: list of RGBA arrays. Returns (delivered frames, measures dict)."""
    air, effect = set(air), set(effect)
    bend = set(bend) - {0, len(frames) - 1}   # the first and last frame are always held to the stance
    sn = [snap(f, ref.race_palette) for f in frames]
    low = [extent(x)[1] for x in sn]
    shifts = [0 if (i in air or no_resnap) else ref.ground - low[i] for i in range(len(sn))]
    fr = [shift_rows(x, s) for x, s in zip(sn, shifts)]
    ext = [extent(x) for x in fr]
    heights = [e[1] - e[0] + 1 for e in ext]
    grounded = [i for i in range(len(fr)) if i not in air]
    raw_spread = max(low[i] for i in grounded) - min(low[i] for i in grounded) if grounded else 0
    after = [ext[i][1] for i in grounded]
    spread_after = (max(after) - min(after)) if after else 0
    bob = max(abs(s) for s in shifts)
    ids = [identity(f, ref.idle_palette) for f in frames]
    idv = [v for v in ids if v is not None]
    upright = [i for i in range(len(fr)) if i not in air and i not in bend and i not in effect]   # an effect frame is judged by the eye, not by height
    lo, hi = (ref.stand_h, ref.stand_h) if key_range is None else key_range
    dev = [max(0, lo - heights[i], heights[i] - hi) for i in upright]
    ends = [i for i in (0, len(fr) - 1) if i in upright]
    m = {
        "frames": len(fr), "airborne": sorted(air), "bend": sorted(bend), "effect_frames": sorted(effect),
        "a_raw_low_rows": low, "a_raw_spread": raw_spread, "a_shifts": shifts, "a_bob_px": bob,
        "a_spread_after": spread_after,
        "b_identity_per_frame": ids, "b_identity_max": max(idv), "b_identity_mean": round(sum(idv) / len(idv), 1),
        "c_heights": heights, "c_stance_height": ref.stand_h, "c_lowest_height": min(heights),
        "c_upright_dev_max": max(dev) if dev else 0, "c_ends_dev_max": max([dev[upright.index(i)] for i in ends], default=0),
        "aid_lowest_x": [lowest_x(x) for x in fr], "aid_centre_x": [round((e[2] + e[3]) / 2, 1) for e in ext],
        "aid_ink_share": [ink_share(x) for x in fr], "aid_kept_ink_share": ref.ink,
        "aid_area_ratio": [round(float((x[..., 3] > 0).sum() / ref.stance_area), 2) for x in fr],
    }
    comps = [components(x) for x in fr]
    area = np.array([sum(c) for c in comps], float)
    flags = []
    for i, c in enumerate(comps):
        detached = [s for s in c[1:] if s >= 2]
        nb = [area[j] for j in (i - 1, i + 1) if 0 <= j < len(fr)]
        spike = area[i] > 1.35 * float(np.median(nb)) if nb else False
        if detached or spike:
            flags.append({"frame": i, "detached_areas": detached, "area_spike": bool(spike)})
    m["f_components_per_frame"] = [len(c) for c in comps]
    m["f_flags"] = flags
    m["gate_a"] = "PASS" if spread_after <= FEET_SPREAD_MAX and bob <= BOB_MAX else "FAIL"
    m["gate_b"] = "PASS" if m["b_identity_max"] <= IDENTITY_MAX else "FAIL"
    m["gate_c"] = "PASS" if m["c_upright_dev_max"] <= HEIGHT_DEV_MAX else "FAIL"
    lp = fr[loop_from:]   # a clip whose hold loops (guard) closes its loop on the hold, not on the raise
    steps = [mad(lp[i], lp[i + 1]) for i in range(len(lp) - 1)]
    m["e_loop_from"] = loop_from
    m["e_step_max"] = round(max(steps), 3) if steps else 0.0
    m["e_close"] = round(mad(lp[-1], lp[0]), 3)
    m["gate_e"] = ("PASS" if m["e_close"] <= m["e_step_max"] else "FAIL") if loop else "n/a"
    return fr, m
