#!/usr/bin/env python3
"""Build manifest.json from every clip.json under a set folder, plus rows for motions parked without a clip.
  manifest.py SET_DIR MANIFEST_OUT [--parked parked.json] [--ledger ledger.jsonl] [--table]
parked.json: [{"race":..,"motion":..,"view":..,"verdict":"parked","parked":"reason","stand_in":"kept jump-left"}]
--ledger: the run ledger (one json line per PixelLab run: at, before, after, note). The spend is the fall of the server balance from the first row's
`before` to the last row's `after`; per-run numbers overlap when runs overlap, the two ends do not. A clip's own `generations` is an estimate
(2 for an 8 frame job, by the cost rule in README), so the sum of the clips need not equal the spend.
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


def spend(led, cap):
    """Server-balance spend of a run ledger sorted by time: first `before` minus last `after`."""
    start, end = led[0]["before"], led[-1]["after"]
    return {"start_balance": start, "end_balance": end, "generations_spent": round(start - end, 1), "cap": cap, "runs": len(led),
            "runs_over_8_generations": [{"at": r["at"], "note": r["note"], "jobs": r.get("own_count"), "server_spent": r["server_spent"]} for r in led if r["server_spent"] > 8]}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("set"); ap.add_argument("out"); ap.add_argument("--parked", default=""); ap.add_argument("--ledger", default=""); ap.add_argument("--cap", type=int, default=600); ap.add_argument("--table", action="store_true")
    a = ap.parse_args(argv)
    rows = []
    for p in sorted(Path(a.set).glob("*/*/clip.json")):
        rows.append(row(p.parent, json.loads(p.read_text())))
    if a.parked and Path(a.parked).exists():
        for x in json.loads(Path(a.parked).read_text()):
            rows.append({"race": x["race"], "motion": x["motion"], "view": x["view"], "route": x.get("route", "P"), "variant": "", "clip": None, "verdict": x.get("verdict", "parked"),
                         "parked": x.get("parked", ""), "note": x.get("stand_in", ""), "generations": x.get("gens")})
    out = {"rows": rows}
    if a.ledger and Path(a.ledger).exists():
        led = sorted((json.loads(l) for l in Path(a.ledger).read_text().splitlines() if l.strip()), key=lambda r: r["at"])
        out["spend"] = spend(led, a.cap)
    Path(a.out).write_text(json.dumps(out, indent=1))
    print(a.out, len(rows), "rows")
    if a.table:
        for r in rows:
            print(f"{r['race']:9} {r['motion']:7} {r['view']:6} {r['route']} {r['variant'] or '-':6} {r['verdict']}")


if __name__ == "__main__":
    main()
