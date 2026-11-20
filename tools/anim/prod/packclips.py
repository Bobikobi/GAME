#!/usr/bin/env python3
"""A set of delivered clips -> kit sheets and kit rows (#742, stage 2).

  packclips.py --set SET --table eight_table.md --kit content/kit/core [--out-table T.md] --palette tools/src/kit/palette.ts [--write] [--write-kit] [--band 2]

SET holds `<race>/<verb>-<view>[-q34|-g1]/f00.png.. + clip.json` (the production route's take folders; a folder with an `-s<number>`
suffix is a rejected try and is never read). The table is the owner-approved cell table: one row a verb, one column a race and view,
a cell `PASS`, `PASS (q34)`, `PASS (g1)` or `PARKED`. Per passing cell this reads the take and the same race and view's walk sheet in
the kit (`chars/<race>_down|up|left.png`, frames in order and, last, the standing pose), and measures:

  - the take's standing height (clip.json `c_stance_height`, else its median frame) against the walk's standing frame, both in sheet
    pixels at density 4. The take is packed at its own size (no resampling, 128 px frames) and the clip's `fit_permille` shows it as tall
    as the walk's: round(1000 * walk height / take height). The band (`--band`, world pixels, default 2) gates the DISPLAYED height;
    the walk shows at 1 / density, so a world pixel is 4 sheet pixels;
  - the ground point: the walk's feet stand `walk_low - anchor_y` sheet rows under its anchor, which after the fit is that many walk rows,
    so the take's anchor y is the take's own feet row (the median of its frames' lowest opaque rows) less that offset divided by the fit,
    rounded to a row. The engine puts the origin on `anchor y / frame height` and the figure's middle on column 64, so the feet land
    within half a display pixel of the walk's;
  - the figure's middle: the median centre of the take's opaque box against the walk's, after the fit (reported in world pixels);
  - the take's own `ms` (the speed the owner saw) as the clip's `frame_ms`.

The takes are snapped to the race's kept palette, which the kit does not hold, so each frame is brought to what `pnpm check` asks of a
kit sprite (the importer's part, done here on the pixels as they are and never resampled): pockets of see-through of at most 24 px
enclosed by the figure are filled with the colour of the nearest solid pixel, each solid pixel is taken to the nearest colour (CIELAB)
of the core palette and the ramps the same race and view's walk names, and the figure's edge pixels (the kit's one definition,
tools/src/kit/ink.ts) become the ink #1b1a2e.

A cell whose displayed height or feet are out of the band is REFUSED and listed. With --write each passing cell is written as one
horizontal strip (`chars/<race>_<verb>_<view>.png`, the take's frames as they are), with the same bytes every run, and with
--write-kit its row (the walk's ramps, the clip block with its fit; no `scale`: a clip sheet owes none, tools/src/kit/scale.ts) is put into the kit's kit.json, replacing the
rows of an earlier run; without it the rows are printed as JSON. Python 3 with numpy and Pillow only; every path is an argument."""
import argparse, json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

RACES = ("human", "elf", "skeleton")
WALK_VIEW = {"left": "left", "front": "down", "back": "up"}
FRAME = 128
DENSITY = 4
REJECTED = re.compile(r"-s\d+$")


def parse_table(path):
    """{(race, verb, view): (status, suffix)} from the cell table: columns are `<race> <view>`, rows are verbs."""
    lines = [l for l in Path(path).read_text().splitlines() if l.startswith("|")]
    head = [c.strip() for c in lines[0].strip("|").split("|")]
    cells = {}
    for line in lines[2:]:
        row = [c.strip() for c in line.strip("|").split("|")]
        for col, cell in zip(head[1:], row[1:]):
            race, view = col.split()
            m = re.match(r"(PASS|PARKED)(?: \((q34|g1)\))?$", cell)
            if not m:
                raise SystemExit(f"table cell not understood: {row[0]} {col}: {cell!r}")
            cells[(race, row[0], view)] = (m.group(1), m.group(2))
    return cells


INK = (0x1b, 0x1a, 0x2e)
SPECK_MAX = 24


def lab(rgb):
    c = np.asarray(rgb, dtype=np.float64).reshape(-1, 3) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]]) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def palette_of(palette_src, kit_dir, ramps):
    """Hex colours -> an array: the core palette of the kit and the named core ramps (tools/src/kit/palette.ts `CORE_RAMPS`)."""
    kit = json.loads((Path(kit_dir) / "kit.json").read_text())["kit"]
    hexes = list(kit["palette"])
    src = Path(palette_src).read_text()
    for rid, steps in re.findall(r"\{ id: '(\w+)', for: '\w+', steps: \[([^\]]*)\] \}", src):
        if rid in ramps:
            hexes += re.findall(r"#[0-9a-fA-F]{6}", steps)
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in dict.fromkeys(x.lower() for x in hexes)], dtype=np.uint8)


def fill_specks(a):
    """Enclosed see-through pockets of at most SPECK_MAX px (8-connected, the frame's border is outside) take the nearest solid colour."""
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
    todo = clear & ~seen
    out = a.copy()
    left = set(zip(*np.nonzero(todo)))
    while left:
        # one ring at a time: a pocket pixel with a solid 4-neighbour takes its colour (first in the order up, down, left, right)
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


def kit_frame(a, pal):
    """One take frame as the kit holds a sprite: hard alpha, no specks, kit colours, the ink edge."""
    a = a.copy()
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a[a[..., 3] == 0] = 0
    a = fill_specks(a)
    m = a[..., 3] == 255
    px = lab(a[..., :3][m])
    d = ((px[:, None] - lab(pal)[None]) ** 2).sum(-1)
    a[..., :3][m] = pal[d.argmin(1)]
    pad = np.pad(m, 1)
    edge = m & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    a[edge, :3] = INK
    return a


def box(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


def walk_standing(kit_dir, race, view):
    """(height, lowest row, mid x, kit row) of the walk's standing frame, its last."""
    kit = json.loads((Path(kit_dir) / "kit.json").read_text())["kit"]["sprites"]
    info = kit[f"chars/{race}_{WALK_VIEW[view]}"]
    sheet = np.array(Image.open(Path(kit_dir) / info["file"]).convert("RGBA"))
    n = sheet.shape[1] // info["w"]
    x0, x1, y0, y1 = box(sheet[:, (n - 1) * info["w"]: n * info["w"]])
    return y1 - y0 + 1, y1, (x0 + x1) / 2, info


def load_take(folder):
    files = sorted(folder.glob("f[0-9][0-9].png"))
    frames = [np.array(Image.open(f).convert("RGBA")) for f in files]
    for f in frames:
        if f.shape != (FRAME, FRAME, 4):
            raise SystemExit(f"{folder}: a frame is not {FRAME} x {FRAME}")
    return frames, json.loads((folder / "clip.json").read_text())


def strip(frames):
    """The take's frames side by side, bytes fixed by the pixels alone (no metadata, no timestamps)."""
    sheet = np.concatenate(frames, axis=1)
    img = Image.fromarray(sheet, "RGBA")
    return img


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", required=True)
    ap.add_argument("--table", required=True)
    ap.add_argument("--kit", required=True, help="content/kit/core")
    ap.add_argument("--palette", required=True, help="tools/src/kit/palette.ts, where the core ramps are")
    ap.add_argument("--out-table")
    ap.add_argument("--write", action="store_true", help="write the sheets of the cells inside the band")
    ap.add_argument("--write-kit", action="store_true", help="put the rows into the kit's kit.json")
    ap.add_argument("--band", type=float, default=2, help="world pixels the displayed height or feet may differ from the walk's")
    a = ap.parse_args()
    cells = parse_table(a.table)
    rows, rows_out, parked = [], {}, []
    for (race, verb, view), (status, suffix) in sorted(cells.items(), key=lambda kv: (RACES.index(kv[0][0]), kv[0][1], kv[0][2])):
        if status == "PARKED":
            parked.append(f"{race} {verb} {view}")
            continue
        name = f"{verb}-{view}" + (f"-{suffix}" if suffix else "")
        if REJECTED.search(name):
            raise SystemExit(f"{name}: a rejected try")
        folder = Path(a.set) / race / name
        frames, meta = load_take(folder)
        if not str(meta.get("verdict", "")).startswith("PASS"):
            raise SystemExit(f"{folder}: verdict {meta.get('verdict')!r}, not a pass")
        wh, wlow, wmid, walk = walk_standing(a.kit, race, view)
        anchor = walk["stride"]["anchor"]
        frames = [kit_frame(f, palette_of(a.palette, a.kit, walk.get("ramps", []))) for f in frames]
        boxes = [box(f) for f in frames]
        heights = sorted(b[3] - b[2] + 1 for b in boxes)
        th = int(meta.get("c_stance_height") or heights[len(heights) // 2])  # the stance the take was gated against, not a reach or a crouch
        fit = round(1000 * wh / th)
        f = fit / 1000
        tlow = int(np.median([b[3] for b in boxes]))
        offset = wlow - anchor[1]                      # the walk's feet under its anchor, sheet rows
        anc = [anchor[0], round(tlow - offset / f)]
        shown_h = th * f / DENSITY                     # world pixels
        walk_h = wh / DENSITY
        feet = ((tlow - anc[1]) * f - offset) / DENSITY  # the take's feet under the body point against the walk's, world pixels
        tmid = float(np.median([(b[0] + b[1]) / 2 for b in boxes]))
        dx = ((tmid - anc[0]) * f - (wmid - anchor[0])) / DENSITY
        tall = heights[-1] * f / DENSITY
        ok = abs(shown_h - walk_h) <= a.band and abs(feet) <= a.band / 2
        sheet = f"chars/{race}_{verb}_{view}"
        rows.append(dict(race=race, verb=verb, view=view, folder=name, frames=len(frames), take_h=th, walk_h=wh, fit=fit,
                         shown=shown_h, walk_shown=walk_h, dh=shown_h - walk_h, tall=tall, take_low=tlow, anchor=anc, feet=feet, dx=dx,
                         ms=meta.get("ms"), route=meta.get("route"), ok=ok, sheet=sheet))
        if ok and a.write:
            save(strip(frames), Path(a.kit) / f"{sheet}.png")
        if ok:
            clip = {"race": f"core/{race}", "view": view, "verb": verb, "frame_ms": int(meta["ms"]), "anchor": anc, "fit_permille": fit}
            row = {"file": f"{sheet}.png", "w": FRAME, "h": FRAME, "frames": len(frames), "density": DENSITY}
            if "ramps" in walk:
                row["ramps"] = walk["ramps"]
            row["clip"] = clip
            rows_out[sheet] = row
    if a.write_kit:
        path = Path(a.kit) / "kit.json"
        data = json.loads(path.read_text())
        sprites = {k: v for k, v in data["kit"]["sprites"].items() if "clip" not in v}
        keys = list(sprites)
        last = max(i for i, k in enumerate(keys) if re.fullmatch(r"chars/(human|elf|skeleton)_(down|up|left)", k))
        data["kit"]["sprites"] = {**{k: sprites[k] for k in keys[: last + 1]}, **rows_out, **{k: sprites[k] for k in keys[last + 1:]}}
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    if a.out_table:
        worst = max(rows, key=lambda r: max(abs(r["dh"]), abs(r["feet"]) * 2))
        out = ["# Pack table: each passing cell against the same race and view's walk", "",
               f"Sheets at their own size (128 px frames, density {DENSITY}), shown at the clip's fit. Heights and offsets in world pixels (a sheet pixel at density {DENSITY} is a quarter of one): "
               f"`shown` is the take's standing figure after the fit, `walk` the walk's standing figure; `feet` is the take's feet against the walk's under the body point (anchor y rounded to a row); "
               f"`dx` is the take's middle against the walk's after the fit; `tall` is the take's tallest frame after the fit (a reach), information only. Band {a.band}.", "",
               "| race | verb | view | take | frames | take h | walk h | fit | shown | walk | dh | tall | take low | anchor | feet | dx | ms | route | in band |",
               "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for r in rows:
            out.append(f"| {r['race']} | {r['verb']} | {r['view']} | {r['folder']} | {r['frames']} | {r['take_h']} | {r['walk_h']} | {r['fit'] / 1000:.3f} | {r['shown']:.2f} | {r['walk_shown']:.2f} | "
                       f"{r['dh']:+.2f} | {r['tall']:.2f} | {r['take_low']} | {r['anchor'][0]},{r['anchor'][1]} | {r['feet']:+.2f} | {r['dx']:+.2f} | {r['ms']} | {r['route']} | {'yes' if r['ok'] else 'NO'} |")
        out += ["", f"{len(rows)} rows, {sum(r['ok'] for r in rows)} in band, {sum(not r['ok'] for r in rows)} refused. Parked: {', '.join(parked) or 'none'}.",
                f"Worst: {worst['race']} {worst['verb']} {worst['view']}: height {worst['dh']:+.2f}, feet {worst['feet']:+.2f}, middle {worst['dx']:+.2f}.",
                f"Largest middle shift: {max(rows, key=lambda r: abs(r['dx']))['race']} {max(rows, key=lambda r: abs(r['dx']))['verb']} {max(rows, key=lambda r: abs(r['dx']))['view']} ({max(rows, key=lambda r: abs(r['dx']))['dx']:+.2f})."]
        Path(a.out_table).write_text("\n".join(out) + "\n")
    print(f"{len(rows)} cells read, {sum(r['ok'] for r in rows)} inside the band of {a.band}, {sum(not r['ok'] for r in rows)} refused; parked: {len(parked)}")
    if not a.write_kit:
        for k, v in rows_out.items():
            print(json.dumps({k: v}))


if __name__ == "__main__":
    sys.exit(main())
