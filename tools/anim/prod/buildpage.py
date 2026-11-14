#!/usr/bin/env python3
"""Build the moving page: one screen at 1440 x 900, English, standalone.
  buildpage.py SET_DIR MANIFEST KEPT OUT.html [--halo-json HALO.json]

Buttons choose race, view and motion (and the take when a clip has variants). Each clip plays at 3x beside the kept stance of its race and view.
The halo is its own layer drawn by the page behind the figure (never part of the frames) with a switch: black for the skeleton from the
measured rule in halo.json (peak alpha, falloff, breath), white for the elf with the same numbers (borrowed, not judged), none for the human."""
import argparse, base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gates

HERE = Path(__file__).resolve().parent
DEFAULT_HALO = {"peak": 0.54, "tau": 3.5, "breath": 0.12, "period_ms": 3200}
RACES = ["skeleton", "human", "elf"]
MOTIONS = ["strike", "guard", "dodge", "hit", "fell", "quarry", "fish", "pickup"]
VIEWS = ["left", "front", "back"]


def png64(a):
    b = io.BytesIO()
    Image.fromarray(a).save(b, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


def strip(paths):
    frames = [gates.load(p) for p in paths]
    return png64(np.concatenate(frames, axis=1)), len(frames)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("set"); ap.add_argument("manifest"); ap.add_argument("kept"); ap.add_argument("out"); ap.add_argument("--halo-json", default="")
    a = ap.parse_args(argv)
    mj = json.loads(Path(a.manifest).read_text())
    man, spend = mj["rows"], mj.get("spend")
    halo = dict(DEFAULT_HALO)
    if a.halo_json and Path(a.halo_json).exists():
        h = json.loads(Path(a.halo_json).read_text()).get("rule_used_on_the_page", {})
        halo.update({k: h[k] for k in ("peak", "tau", "breath", "period_ms") if k in h})
    clips = []
    for r in man:
        c = dict(r)
        if r.get("clip"):
            d = Path(a.set) / r["clip"]
            c["sheet"], c["n"] = strip(sorted(d.glob("f[0-9]*.png")))
        clips.append(c)
    stances = {}
    for race in RACES:
        for view in VIEWS:
            p = Path(a.kept) / race / f"idle-{view}" / "f0.png"
            if p.exists():
                stances[f"{race}/{view}"] = png64(gates.load(p))
    html = (HERE / "page_template.html").read_text().replace("/*DATA*/", "const CLIPS=" + json.dumps(clips) + ";const STANCES=" + json.dumps(stances) + ";const HALO=" + json.dumps(halo) + ";const SPEND=" + json.dumps(spend) + ";")
    Path(a.out).write_text(html)
    print(a.out, len(html) // 1024, "KB,", len(clips), "rows")


if __name__ == "__main__":
    main()
