#!/usr/bin/env python3
"""A set of delivered clips -> kit sheets and kit rows (#742, stage 2).

  packclips.py --set SET --table eight_table.md --kit content/kit/core [--out-table T.md] [--write] [--band 8]

SET holds `<race>/<verb>-<view>[-q34|-g1]/f00.png.. + clip.json` (the production route's take folders; a folder with an `-s<number>`
suffix is a rejected try and is never read). The table is the owner-approved cell table: one row a verb, one column a race and view,
a cell `PASS`, `PASS (q34)`, `PASS (g1)` or `PARKED`. Per passing cell this reads the take and the same race and view's walk sheet in
the kit (`chars/<race>_down|up|left.png`, frames in order and, last, the standing pose), and measures:

  - the figure's height, the take's standing height (clip.json `c_stance_height`, else its median frame) against the walk's standing frame (sheet pixels at the walk's density);
  - the ground point: the walk's feet stand `walk_low - anchor_y` rows under its anchor, so the take's anchor is the take's own lowest
    row (frame 0) minus that offset, and its x is the walk's;
  - the take's own `ms` (the speed the owner saw) as the clip's `frame_ms`.

A cell whose figure is further than `--band` sheet pixels (default 8: two pixels of the 16-to-a-tile grid at density 4) from the walk's is
REFUSED and listed: a take is never resampled here, because nobody scales a drawing by a factor that is not a whole one of the walk's
density. Only a cell inside the band is written, one horizontal strip a cell (`chars/<race>_<verb>_<view>.png`, 128 x 128 frames, the
take's frames as they are), with the same bytes every run, and its kit row is printed as JSON. Python 3 with numpy and Pillow only; every
path is an argument."""
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


def box(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


def walk_standing(kit_dir, race, view):
    """(height, lowest row, mid x) of the walk's standing frame, its last, and the kit's anchor for that sheet."""
    kit = json.loads((Path(kit_dir) / "kit.json").read_text())["kit"]["sprites"]
    name = f"chars/{race}_{WALK_VIEW[view]}"
    info = kit[name]
    sheet = np.array(Image.open(Path(kit_dir) / info["file"]).convert("RGBA"))
    n = sheet.shape[1] // info["w"]
    x0, x1, y0, y1 = box(sheet[:, (n - 1) * info["w"]: n * info["w"]])
    return y1 - y0 + 1, y1, (x0 + x1) / 2, info["stride"]["anchor"]


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
    ap.add_argument("--out-table")
    ap.add_argument("--write", action="store_true", help="write the sheets of the cells inside the band")
    ap.add_argument("--band", type=int, default=8, help="sheet pixels of height a take may differ from the walk's standing figure")
    a = ap.parse_args()
    cells = parse_table(a.table)
    rows, rows_out, parked = [], [], []
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
        wh, wlow, wmid, anchor = walk_standing(a.kit, race, view)
        x0, x1, y0, y1 = box(frames[0])
        heights = sorted(box(f)[3] - box(f)[2] + 1 for f in frames)
        th = int(meta.get("c_stance_height") or heights[len(heights) // 2])  # the stance the take was gated against (the kept standing figure), not a reach or a crouch
        tall = heights[-1]
        offset = wlow - anchor[1]
        tlow = y1
        anc = [anchor[0], tlow - offset]
        diff = th - wh
        ok = abs(diff) <= a.band
        sheet = f"chars/{race}_{verb}_{view}"
        row = dict(race=race, verb=verb, view=view, folder=name, frames=len(frames), take_h=th, tall=tall, walk_h=wh,
                   diff=diff, ratio=round(th / wh, 2), take_low=tlow, walk_low_off=offset, anchor=anc,
                   walk_anchor=anchor, ms=meta.get("ms"), route=meta.get("route"), ok=ok, sheet=sheet)
        rows.append(row)
        if ok and a.write:
            save(strip(frames), Path(a.kit) / f"{sheet}.png")
            clip = {"race": f"core/{race}", "view": view, "verb": verb, "frame_ms": int(meta["ms"]), "anchor": anc}
            rows_out.append({sheet: {"file": f"{sheet}.png", "w": FRAME, "h": FRAME, "frames": len(frames), "density": DENSITY, "clip": clip}})
    if a.out_table:
        worst = max(rows, key=lambda r: abs(r["diff"]))
        out = ["# Pack table: each passing cell against the same race and view's walk", "",
               f"Heights in sheet pixels (128 frames, density {DENSITY}): the take's standing height against the walk's standing frame. "
               f"Band {a.band}. Ground: the take's lowest row, and the walk's lowest row as an offset under its anchor (anchor y 90).", "",
               "| race | verb | view | take | frames | take h | walk h | diff | ratio | take low | walk low-anchor | anchor | ms | route | in band |",
               "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for r in rows:
            out.append(f"| {r['race']} | {r['verb']} | {r['view']} | {r['folder']} | {r['frames']} | {r['take_h']} | {r['walk_h']} | {r['diff']:+d} | {r['ratio']} | "
                       f"{r['take_low']} | {r['walk_low_off']} | {r['anchor'][0]},{r['anchor'][1]} | {r['ms']} | {r['route']} | {'yes' if r['ok'] else 'NO'} |")
        out += ["", f"{len(rows)} rows, {sum(r['ok'] for r in rows)} in band, {sum(not r['ok'] for r in rows)} refused. Parked: {', '.join(parked) or 'none'}.",
                f"Worst: {worst['race']} {worst['verb']} {worst['view']}, take {worst['take_h']} against walk {worst['walk_h']} ({worst['diff']:+d})."]
        Path(a.out_table).write_text("\n".join(out) + "\n")
    print(f"{len(rows)} cells read, {sum(r['ok'] for r in rows)} inside the band of {a.band}, {sum(not r['ok'] for r in rows)} refused; parked: {len(parked)}")
    for r in rows_out:
        print(json.dumps(r))


if __name__ == "__main__":
    sys.exit(main())
