#!/usr/bin/env python3
"""A creature's drawn clips -> kit sheets and kit rows (#847).

  packcreature.py --manifest tools/anim/creature/wolf-pack.json --drafts .scratch/art-drafts --kit content/kit/core [--derive-ramps N] [--write] [--write-kit]

The manifest names, per view and verb, the eight frames of a clip as drafts of the store (`Bobikobi/GAME-art-drafts`) by id, in
order; `pnpm art:drafts fetch <ids>` puts them in --drafts, and each file is checked against its id (the first 16 hex of its
SHA-256) before it is read. The frames are the ones the owner liked, as drawn: nothing is redrawn or recoloured here.

What the kit asks of a sprite is done on the pixels as they are (the same importer part as packclips.py, never a resample):
hard alpha, pockets of see-through of at most 24 px enclosed by the figure filled with the nearest solid colour, and each solid
pixel taken to the nearest colour (CIELAB) of the core palette and the creature's own ramps. An animal wears no outline in the kit
(STYLE section 9; the `creatures/` group is not measured), so the edge is left as drawn.

The creature's ramps are the colours of its own drawing: `--derive-ramps N` picks the N colours of the drawing that, together
with the core palette, leave the least colour distance over all its pixels (greedy, weighted by pixel count), sorts them by light
and deals them to ramps of six, so each ramp rises in light and moves its hue from dark to light (the rule of tools/src/kit/ramps.ts).
The result is printed as JSON for the manifest; the manifest then holds the ramps and a run reads them from it. A drawing whose
colours the core palette does not hold (the wolf's warm greys against the core's cool ones) is imported into its own ramps, not
bent into the core's: bent, it turned from grey to blue with orange blotches (mean colour distance 14.6, 2026-11-27).

Per view the sheets share one ground point and one head point, so a creature does not step sideways when it stops or starts:
  - anchor y is the median lowest solid row over the view's frames, anchor x the median middle of the figure's box;
  - head is the median middle of the pixels of the core red #e2533f (the eye) where the view shows an eye, else the middle top of the figure.
The fit is the manifest's one value for every view, so the creature does not change size as it turns.

--write puts the sheets in <kit>/creatures/<name>_<verb>_<view>.png (the same bytes every run); --write-kit puts the ramps and the rows
in <kit>/kit.json (replacing the rows of an earlier run, and giving the still sprite named by `still` its `still_of`).
Python 3 with numpy and Pillow only; every path is an argument."""
import argparse, hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import packclips as pc  # noqa: E402

FRAME = 128
DENSITY = 4
EYE = (0xE2, 0x53, 0x3F)
RAMP_STEPS = 6


def light(rgb):
    r, g, b = (int(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def warmth(rgb):
    r, g, b = (int(v) for v in rgb)
    t = r + g + b
    return 0 if t == 0 else (r - b) / t


def hexof(rgb):
    return "#%02x%02x%02x" % tuple(int(v) for v in rgb)


def load_frame(drafts, fid):
    path = Path(drafts) / f"{fid}.png"
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest()[:16] != fid:
        raise SystemExit(f"{path}: the file is not the draft {fid} (its hash differs)")
    a = np.array(Image.open(path).convert("RGBA"))
    if a.shape != (FRAME, FRAME, 4):
        raise SystemExit(f"{path}: not {FRAME} x {FRAME}")
    return a


def fit_of(man: dict, view: str) -> int:
    """The manifest's `fit_permille`: one number for every view, or a map view -> number (the views of an animal drawn long or wide
    take their own, so it keeps one size as it turns). Sheets of one view share it, walk and idle."""
    fit = man["fit_permille"]
    return int(fit[view] if isinstance(fit, dict) else fit)


def derive_ramps(frames, core, count, name):
    """The `count` colours of the drawing that best serve its pixels beside the core palette, dealt to ramps of six."""
    seen = {}
    for a in frames:
        m = a[..., 3] >= 128
        for px in map(tuple, a[m][:, :3]):
            seen[px] = seen.get(px, 0) + 1
    cols = np.array(sorted(seen), dtype=np.uint8)
    w = np.array([seen[tuple(c)] for c in cols], dtype=float)
    lab = pc.lab(cols)
    base = pc.lab(core)
    best = np.sqrt(((lab[:, None] - base[None]) ** 2).sum(-1)).min(1)
    chosen = []
    rampn = count // RAMP_STEPS
    lights = [light(c) for c in cols]

    def crowded(i):
        """True when adding colour i puts more colours inside five light steps than there are ramps to deal them to (a ramp rises by at least 5)."""
        ls = sorted([lights[j] for j in chosen] + [lights[i]])
        return any(sum(1 for x in ls if lo <= x < lo + 5) > rampn for lo in ls)

    for _ in range(count):
        gain = []
        for i in range(len(cols)):
            if i in chosen or crowded(i):
                gain.append(-1.0)
                continue
            d = np.minimum(best, np.sqrt(((lab - lab[i]) ** 2).sum(-1)))
            gain.append(float((w * (best - d)).sum()))
        i = int(np.argmax(gain))
        chosen.append(i)
        best = np.minimum(best, np.sqrt(((lab - lab[i]) ** 2).sum(-1)))
    steps = sorted((cols[i] for i in chosen), key=lambda c: (light(c), hexof(c)))
    n = count // RAMP_STEPS
    # dealt by a seeded search: each colour to a ramp whose last step is at least 5 darker, every ramp full and moving its hue by 0.03
    rng = np.random.default_rng(847)
    for _ in range(50000):
        decks = [[] for _ in range(n)]
        for c in steps:
            fits = [d for d in decks if len(d) < RAMP_STEPS and (not d or light(c) - light(d[-1]) >= 5)]
            if not fits:
                break
            fits[int(rng.integers(len(fits)))].append(c)
        else:
            if all(len(d) == RAMP_STEPS and abs(warmth(d[-1]) - warmth(d[0])) >= 0.03 for d in decks):
                break
    else:
        raise SystemExit("the colours cannot be dealt to ramps that rise and move their hue: ask for fewer")
    return [{"id": f"{name}-fur-{r + 1}", "steps": [hexof(c) for c in d]} for r, d in enumerate(decks)]


def ramp_problems(ramp):
    s = ramp["steps"]
    rgb = [[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in s]
    out = []
    if not 5 <= len(s) <= 6:
        out.append("steps")
    if len(set(s)) != len(s):
        out.append("repeat")
    for i in range(1, len(rgb)):
        if light(rgb[i]) - light(rgb[i - 1]) < 5:
            out.append(f"light step {i + 1}")
    if abs(warmth(rgb[-1]) - warmth(rgb[0])) < 0.03:
        out.append("hue drift")
    return out


def snap(a, pal):
    """One frame as the kit holds an animal: hard alpha, no specks, kit colours, the edge as drawn."""
    a = a.copy()
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a[a[..., 3] == 0] = 0
    a = pc.fill_specks(a)
    m = a[..., 3] == 255
    px = pc.lab(a[..., :3][m])
    d = ((px[:, None] - pc.lab(pal)[None]) ** 2).sum(-1)
    a[..., :3][m] = pal[d.argmin(1)]
    return a


def anchor_head(frames):
    lows, mids, tops, eyes = [], [], [], []
    for a in frames:
        x0, x1, y0, y1 = pc.box(a)
        lows.append(y1)
        mids.append((x0 + x1) / 2)
        tops.append(y0)
        red = np.nonzero((a[..., 0] == EYE[0]) & (a[..., 1] == EYE[1]) & (a[..., 2] == EYE[2]) & (a[..., 3] == 255))
        if len(red[0]):
            eyes.append((float(red[1].mean()), float(red[0].mean())))
    anchor = [round(float(np.median(mids))), round(float(np.median(lows)))]
    if len(eyes) >= len(frames) // 2:
        head = [round(float(np.median([e[0] for e in eyes]))), round(float(np.median([e[1] for e in eyes])))]
    else:
        head = [anchor[0], round(float(np.median(tops))) + 8]
    return anchor, head


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--drafts", required=True, help=".scratch/art-drafts, where `pnpm art:drafts fetch` puts the pictures")
    ap.add_argument("--kit", required=True, help="content/kit/core")
    ap.add_argument("--palette", default="tools/src/kit/palette.ts")
    ap.add_argument("--derive-ramps", type=int, metavar="N", help="print the creature's ramps (N colours, a multiple of 6) and stop")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--write-kit", action="store_true")
    a = ap.parse_args()
    man = json.loads(Path(a.manifest).read_text())
    raw = {(c["view"], c["verb"]): [load_frame(a.drafts, f) for f in c["frames"]] for c in man["clips"]}
    core = pc.palette_of(a.palette, a.kit, [])
    if a.derive_ramps:
        if a.derive_ramps % RAMP_STEPS or a.derive_ramps > 4 * RAMP_STEPS:
            raise SystemExit("N is a multiple of 6, at most 24 (a sprite names at most four ramps)")
        ramps = derive_ramps([f for fr in raw.values() for f in fr], core, a.derive_ramps, man["name"])
        for r in ramps:
            print(r["id"], r["steps"], ramp_problems(r) or "ok")
        print(json.dumps(ramps))
        return 0
    ramps = man["ramps"]
    if not ramps:
        raise SystemExit("the manifest holds no ramps: run --derive-ramps 24 and put the result in it")
    for r in ramps:
        if ramp_problems(r):
            raise SystemExit(f"ramp {r['id']}: {ramp_problems(r)}")
    pal = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for r in ramps for h in r["steps"]], dtype=np.uint8)
    pal = np.concatenate([core, pal])
    snapped = {k: [snap(f, pal) for f in fr] for k, fr in raw.items()}
    views = sorted({v for v, _ in snapped})
    place = {v: anchor_head([f for (vv, _), fr in snapped.items() if vv == v for f in fr]) for v in views}
    moved = [float(np.sqrt(((pc.lab(f[..., :3][f[..., 3] > 0]) - pc.lab(g[..., :3][g[..., 3] > 0])) ** 2).sum(1)).mean())
             for k in raw for f, g in zip(raw[k], snapped[k]) if (f[..., 3] >= 128).sum() == (g[..., 3] > 0).sum()]
    rows = {}
    for c in man["clips"]:
        key = (c["view"], c["verb"])
        sheet = f"creatures/{man['name']}_{c['verb']}_{c['view']}"
        anchor, head = place[c["view"]]
        rows[sheet] = {
            "file": f"{sheet}.png", "w": FRAME, "h": FRAME, "frames": len(snapped[key]), "density": DENSITY,
            "ramps": [r["id"] for r in ramps],
            "creature_clip": {"creature": man["creature"], "view": c["view"], "verb": c["verb"], "frame_ms": c["frame_ms"], "anchor": anchor,
                              "fit_permille": fit_of(man, c["view"]), "head": head},
        }
        if a.write:
            pc.save(pc.strip(snapped[key]), Path(a.kit) / f"{sheet}.png")
    print(f"{len(rows)} sheets; mean colour distance moved by the import {np.mean(moved):.2f} (max of a frame {max(moved):.2f}) over {len(moved)} frames")
    for k, v in rows.items():
        print(json.dumps({k: v["creature_clip"]}))
    if a.write_kit:
        path = Path(a.kit) / "kit.json"
        data = json.loads(path.read_text())
        kit = data["kit"]
        kit["ramps"] = [r for r in kit.get("ramps", []) if not r["id"].startswith(f"{man['name']}-fur-")] + [{"id": r["id"], "steps": r["steps"]} for r in ramps]
        sprites = {k: v for k, v in kit["sprites"].items() if not (k.startswith(f"creatures/{man['name']}_") and "creature_clip" in v)}
        if man.get("still") in sprites:
            sprites[man["still"]]["still_of"] = man["creature"]
        keys = list(sprites)
        at = keys.index("creatures/roe") + 1 if "creatures/roe" in keys else len(keys)
        kit["sprites"] = {**{k: sprites[k] for k in keys[:at]}, **rows, **{k: sprites[k] for k in keys[at:]}}
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
