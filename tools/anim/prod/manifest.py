#!/usr/bin/env python3
"""Build manifest.json from every clip.json under a set folder, plus rows for motions parked without a clip.
  manifest.py SET_DIR MANIFEST_OUT [--parked parked.json] [--table]
parked.json: [{"race":..,"motion":..,"view":..,"verdict":"parked","parked":"reason","stand_in":"kept jump-left"}]
One row per clip: race, motion, view, route, variant, frames, ms, loops, the gate numbers, verdict, effects, job ids and seeds, generations."""
import argparse, json
from pathlib import Path

KEYS = ["a_raw_spread", "a_spread_after", "a_bob_px", "b_identity_max", "b_identity_mean", "c_stance_height", "c_lowest_height", "c_highest_height", "c_upright_dev_max",
        "e_close", "e_step_max", "gate_a", "gate_b", "gate_c", "gate_e"]


def row(d, m):
    meta = m.get("meta", {})
    r = {"race": m["race"], "motion": m["motion"], "view": m["view"], "route": m["route"], "variant": m.get("variant", ""), "clip": f"{m['race']}/{d.name}",
         "frames": m["frames"], "ms_per_frame": m["ms"], "loops": bool(m.get("loops")), "gates": {k: m.get(k) for k in KEYS},
         "declared": {"bend": m.get("bend", []), "airborne": m.get("airborne", []), "effect_frames": m.get("effect_frames", [])},
         "flags_for_the_eye": m.get("f_flags", []), "eye": m.get("eye"), "verdict": m.get("verdict", "unread"),
         "effects": m.get("effects", ""), "jobs": meta.get("jobs", []), "seeds": meta.get("seeds", []), "origin": meta.get("origin", ""),
         "generations": m.get("gens"), "tries": m.get("tries"), "note": m.get("note", ""), "parked": m.get("parked", "")}
    return r


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("set"); ap.add_argument("out"); ap.add_argument("--parked", default=""); ap.add_argument("--table", action="store_true")
    a = ap.parse_args(argv)
    rows = []
    for p in sorted(Path(a.set).glob("*/*/clip.json")):
        rows.append(row(p.parent, json.loads(p.read_text())))
    if a.parked and Path(a.parked).exists():
        for x in json.loads(Path(a.parked).read_text()):
            rows.append({"race": x["race"], "motion": x["motion"], "view": x["view"], "route": x.get("route", "P"), "variant": "", "clip": None, "verdict": x.get("verdict", "parked"),
                         "parked": x.get("parked", ""), "note": x.get("stand_in", ""), "generations": x.get("gens")})
    Path(a.out).write_text(json.dumps({"rows": rows}, indent=1))
    print(a.out, len(rows), "rows")
    if a.table:
        for r in rows:
            print(f"{r['race']:9} {r['motion']:7} {r['view']:6} {r['route']} {r['variant'] or '-':6} {r['verdict']}")


if __name__ == "__main__":
    main()
