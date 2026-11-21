#!/usr/bin/env python3
"""Write the eye read (gate d) and the verdict into a clip's clip.json.
  verdict.py CLIP_DIR --eye yes,yes,yes --verdict "PASS (eye)" [--tries 1] [--effects TEXT] [--note TEXT] [--gens N] [--jobs ids] [--seeds s] [--parked REASON]
--eye: planted foot stays, weight moves with it, identity holds. All yes + gates a, b, c (and e on a loop) = "PASS (eye)"; the verdict
text is the reader's, but the tool refuses "PASS (eye)" when a gate failed or an answer is not yes."""
import argparse, json
from pathlib import Path


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("clip"); ap.add_argument("--eye", required=True); ap.add_argument("--verdict", required=True)
    ap.add_argument("--tries", type=int); ap.add_argument("--effects", default=None); ap.add_argument("--note", default=None)
    ap.add_argument("--gens", type=float); ap.add_argument("--jobs", default=None); ap.add_argument("--seeds", default=None); ap.add_argument("--parked", default=None)
    a = ap.parse_args(argv)
    p = Path(a.clip) / "clip.json"
    m = json.loads(p.read_text())
    eye = [x.strip() == "yes" for x in a.eye.split(",")]
    assert len(eye) == 3, "--eye takes three answers"
    gates_ok = all(m.get(k) in ("PASS", "n/a") for k in ("gate_a", "gate_b", "gate_c", "gate_e"))
    if a.verdict.startswith("PASS (eye)") and not (all(eye) and gates_ok):
        raise SystemExit(f"refused: PASS (eye) needs three yes and gates a, b, c, e not FAIL (eye={eye}, gates ok={gates_ok})")
    m["eye"] = {"planted_foot": eye[0], "weight_with_foot": eye[1], "identity": eye[2]}
    m["verdict"] = a.verdict
    for k, v in (("tries", a.tries), ("effects", a.effects), ("note", a.note), ("parked", a.parked), ("gens", a.gens)):
        if v is not None:
            m[k] = v
    meta = m.setdefault("meta", {})
    if a.jobs is not None:
        meta["jobs"] = a.jobs.split(",")
    if a.seeds is not None:
        meta["seeds"] = a.seeds.split(",")
    p.write_text(json.dumps(m, indent=1))
    print(p, m["verdict"])


if __name__ == "__main__":
    main()
