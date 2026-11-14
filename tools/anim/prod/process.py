#!/usr/bin/env python3
"""Frames -> a delivered clip: snapped to the race's kept palette, re-snapped to the kept ground row, gated.

  process.py --kept KEPT --out OUT --race skeleton --view left --motion strike --route p SRC... [options]

SRC are 128 x 128 PNGs in play order (files, or folders holding f*.png). Writes OUT/<race>/<motion>-<view>[-<variant>]/f00.png..
and clip.json (the gate numbers and the facts passed in). The eye read (gate d) and the verdict are added with `verdict.py`."""
import argparse, glob, json, sys
from pathlib import Path
from PIL import Image
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gates


def expand(srcs):
    files = []
    for s in srcs:
        p = Path(s)
        files += sorted(glob.glob(str(p / "f[0-9]*.png")) or glob.glob(str(p / "*.png"))) if p.is_dir() else [str(p)]
    return files


def key_range(kept, race, motion):
    hs = [gates.height(gates.load(f)) for f in sorted(glob.glob(str(Path(kept) / race / motion / "f[0-9]*.png")))]
    return (min(hs) - 0, max(hs)) if hs else None


def preview(frames, path, ms, tile=None, zoom=3):
    n = gates.SIZE * zoom
    if tile:
        t = np.array(Image.open(tile).convert("RGBA"))
        bg = Image.fromarray(gates.scale(t, n // t.shape[0]))
    else:
        bg = Image.new("RGBA", (n, n), (70, 96, 58, 255))
    out = []
    for a in frames:
        g = bg.copy()
        g.alpha_composite(Image.fromarray(gates.scale(a, zoom)))
        out.append(g.convert("RGB"))
    out[0].save(path, save_all=True, append_images=out[1:], loop=0, duration=ms, disposal=1)


def ints(s):
    return [int(x) for x in s.split(",") if x != ""]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="+")
    ap.add_argument("--kept", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--race", required=True); ap.add_argument("--view", default="left"); ap.add_argument("--motion", required=True)
    ap.add_argument("--route", default="p"); ap.add_argument("--variant", default="")
    ap.add_argument("--ms", type=int, default=120); ap.add_argument("--air", default=""); ap.add_argument("--bend", default=""); ap.add_argument("--effect", default="", help="frames that carry a drawn effect (a hit flash): left out of gate c, written to the manifest")
    ap.add_argument("--drop", default="", help="indexes (of the listed sources) to leave out"); ap.add_argument("--loop", action="store_true"); ap.add_argument("--loop-from", type=int, default=0, help="first frame of the looping part (guard: the hold)")
    ap.add_argument("--pingpong", type=int, default=-1, help="hold build: from this frame on, play forward then back (frames N..last, then last-1..N+1), so the hold loops; sets --loop-from"); ap.add_argument("--anchor-x", action="store_true", help="pin the feet band midpoint to frame 0 by whole pixels (kept key frames translate the whole figure)"); ap.add_argument("--no-resnap", action="store_true"); ap.add_argument("--keys", default="", help="kept motion folder (e.g. chop-left) whose height range replaces the stance height in gate c")
    ap.add_argument("--meta", default="{}", help="json: job ids, seeds, generations, effects, notes"); ap.add_argument("--tile", default="")
    a = ap.parse_args(argv)
    ref = gates.Reference(a.kept, a.race, a.view)
    files = expand(a.src); drop = set(ints(a.drop))
    files = [f for i, f in enumerate(files) if i not in drop]
    frames = [gates.load(f) for f in files]
    if a.pingpong >= 0:
        frames = frames + frames[-2:a.pingpong:-1]
        a.loop, a.loop_from = True, a.pingpong
    kr = key_range(a.kept, a.race, a.keys) if a.keys else None
    fr, m = gates.run(frames, ref, air=ints(a.air), bend=ints(a.bend), effect=ints(a.effect), loop=a.loop, loop_from=a.loop_from, no_resnap=a.no_resnap, anchor_x=a.anchor_x, key_range=kr)
    name = f"{a.motion}-{a.view}" + (f"-{a.variant}" if a.variant else "")
    d = Path(a.out) / a.race / name
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("f*.png"):
        old.unlink()
    for i, x in enumerate(fr):
        Image.fromarray(x).save(d / f"f{i:02d}.png")
    m.update({"race": a.race, "motion": a.motion, "view": a.view, "route": a.route.upper(), "variant": a.variant, "ms": a.ms, "loops": a.loop,
              "key_height_range": kr, "pingpong_from": a.pingpong, "sources": files, "meta": json.loads(a.meta)})
    old = d / "clip.json"
    if old.exists():
        prev = json.loads(old.read_text())
        for k in ("eye", "verdict", "tries"):
            if k in prev:
                m[k] = prev[k]
    old.write_text(json.dumps(m, indent=1))
    preview(fr, d / "preview.gif", a.ms, a.tile or None)
    brief = {k: m[k] for k in ("frames", "a_raw_spread", "a_spread_after", "a_bob_px", "gate_a", "b_identity_max", "gate_b", "c_heights", "c_upright_dev_max", "c_lowest_height", "gate_c", "e_close", "e_step_max", "gate_e", "f_flags")}
    print(name, json.dumps(brief))
    return m


if __name__ == "__main__":
    main()
