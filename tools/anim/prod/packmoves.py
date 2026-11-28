#!/usr/bin/env python3
"""New clips of a race (the figure's moves, #929) -> kit sheets and kit rows, added beside the rows already there.

  packmoves.py --set SET --manifest moves.json --kit content/kit/core --palette tools/src/kit/palette.ts [--like hit] [--write] [--write-kit]

`packclips.py` rewrites every clip row of the kit from one table; this adds or replaces only the rows it is given, so the clips already
shipped stay as they are. The manifest is a list of `{"race", "verb", "view", "take", "ms", "from", "base"}`: `base` is the kit sprite the take was drawn from (the race's base, `chars/human_hit_left`; refused when it is a retired walk sheet, tools/kit-gen/bases.json) and is recorded there for `pnpm check`; `from` is the take folder under SET
(`<race>/<from>/f00.png.. + clip.json`, the production route's `process.py` output with its `verdict.py` read: it must say PASS), `take` is 1
for the first drawing of a clip and 2, 3 for a near-identical one kept as a variant (the game plays one of a clip's takes at random).

What a sheet is: the take's frames brought to what the kit holds (the importer part of `packclips.kit_frame`: hard alpha, no specks, kit
colours, the ink edge), side by side in rows of 16 when too long for one. Where it stands: every move is drawn from the same standing frame
the race's existing `--like` clip (default the hit) starts from, and `process.py` puts each frame's feet back on that frame's ground row, so
the new clip takes that row's `anchor` and `fit_permille` unchanged: the figure is the same size and in the same place as in the clip it came
from. A clip drawn on its own scale would have to be measured as `packclips.py` does.

A sheet is `chars/<race>_<verb>_<view>.png`, a later take `..._v<take>.png`. Python 3 with numpy and Pillow only; every path is an argument."""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import packclips as pc  # noqa: E402


BASES = Path(__file__).resolve().parents[3] / "tools" / "kit-gen" / "bases.json"


def base_problem(bases, race, base):
    """Why `base` (a kit sprite id) may not be what a clip of `race` was drawn from, or None. The same rules as tools/src/kit/bases.ts."""
    if not base:
        return "has no \"base\": name the base picture the take was drawn from (DECISIONS 2026-11-28, tools/kit-gen/bases.json)"
    if not base.startswith(f"chars/{race}_"):
        return f"{base} is not a picture of the {race}"
    seen = set()
    while base is not None and base not in seen:
        seen.add(base)
        if base in bases["retired"]:
            return f"{base} is a retired walk sheet: draw from the base of the {race}, {', '.join(bases['bases'][race].values())}"
        if base in bases["waiting"]:
            return f"{base} was drawn from a retired walk sheet and waits for its redraw"
        base = bases["clips"].get(base)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--kit", required=True)
    ap.add_argument("--palette", required=True)
    ap.add_argument("--like", default="hit", help="the shipped clip whose anchor and fit every new clip of the same race and view takes")
    ap.add_argument("--write", action="store_true", help="write the sheets")
    ap.add_argument("--write-kit", action="store_true", help="add the rows to the kit's kit.json")
    a = ap.parse_args()
    kit_path = Path(a.kit) / "kit.json"
    data = json.loads(kit_path.read_text())
    sprites = data["kit"]["sprites"]
    rows = {}
    bases = json.loads(BASES.read_text())
    recorded = {}
    for m in json.loads(Path(a.manifest).read_text()):
        race, verb, view, take = m["race"], m["verb"], m["view"], int(m.get("take", 1))
        why = base_problem(bases, race, m.get("base"))
        if why:
            raise SystemExit(f"{race} {verb} {view}: {why}")
        like = sprites.get(f"chars/{race}_{a.like}_{view}")
        if not like or "clip" not in like:
            raise SystemExit(f"no shipped {a.like} clip for {race} {view} to take the anchor and fit from")
        folder = Path(a.set) / race / m["from"]
        frames, meta = pc.load_take(folder)
        if not str(meta.get("verdict", "")).startswith("PASS"):
            raise SystemExit(f"{folder}: verdict {meta.get('verdict')!r}, not a pass")
        if frames[0].shape[0] != pc.FRAME:
            raise SystemExit(f"{folder}: frames are {frames[0].shape[0]} px, the sheets of {a.like} are {pc.FRAME}")
        walk_h, walk_low, walk_mid, walk = pc.walk_standing(a.kit, race, view)
        pal = pc.palette_of(a.palette, a.kit, walk.get("ramps", []))
        frames = [pc.kit_frame(f, pal) for f in frames]
        name = f"chars/{race}_{verb}_{view}" + (f"_v{take}" if take > 1 else "")
        clip = {"race": f"core/{race}", "view": view, "verb": verb, **({"take": take} if take > 1 else {}), "frame_ms": int(m["ms"]),
                "anchor": like["clip"]["anchor"], "fit_permille": like["clip"]["fit_permille"]}
        cols = pc.cols_for(len(frames))
        row = {"file": f"{name}.png", "w": pc.FRAME, "h": pc.FRAME, "frames": len(frames), **({"cols": cols} if cols else {}), "density": pc.DENSITY}
        if "ramps" in like:
            row["ramps"] = like["ramps"]
        row["clip"] = clip
        rows[name] = row
        recorded[name] = m["base"]
        if a.write:
            pc.save(pc.strip(frames), Path(a.kit) / f"{name}.png")
        print(f"{name}: {len(frames)} frames at {m['ms']} ms ({len(frames) * int(m['ms'])} ms), anchor {clip['anchor']}, fit {clip['fit_permille']}")
    if a.write_kit:
        # the new rows go after the last clip row, in the order given, replacing a row of the same name from an earlier run
        keep = {k: v for k, v in sprites.items() if k not in rows}
        keys = list(keep)
        last = max(i for i, k in enumerate(keys) if "clip" in keep[k])
        data["kit"]["sprites"] = {**{k: keep[k] for k in keys[: last + 1]}, **rows, **{k: keep[k] for k in keys[last + 1:]}}
        kit_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"{len(rows)} rows put in {kit_path}")
        # the base each clip was drawn from is kept beside the kit, where `pnpm check` reads it
        bases["waiting"] = [w for w in bases["waiting"] if w not in recorded]  # a redraw that lands takes its names off
        bases["clips"] = dict(sorted({**bases["clips"], **recorded}.items()))
        BASES.write_text(json.dumps(bases, indent=2, ensure_ascii=False) + "\n")
        print(f"{len(recorded)} bases recorded in {BASES}")


if __name__ == "__main__":
    sys.exit(main())
