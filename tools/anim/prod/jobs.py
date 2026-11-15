#!/usr/bin/env python3
"""From a list of cells to one PixelLab spec: the job-list step of the route (README step 1-2), so nobody writes jobs.json by hand.

  jobs.py DIR --name NAME --cells CELLS.json [--max-gens N] [--account 1] [--provenance TEXT]

CELLS.json: [{"id": "human-strike-front", "first": "path/key.png", "last": "path/key.png" (optional; omit for a start-only job),
              "frames": 8, "seeds": [971, 972], "action": "..."}]. One job per cell and seed, id `<cell id>_S<seed>` (letters, digits, - and _ only).
Writes DIR/keys/ (a copy of every key picture, so the job's pictures stay beside it), DIR/jobs.json and DIR/spec.json and prints the expected
generations by the cost rule of plspec.py. Refuses when the cost passes --max-gens or a job costs more than 2 (8 frames or fewer)
unless the cell says "allow_gens": true. Paths are made absolute; nothing here knows a home folder."""
import argparse, json, re, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plspec

ID_OK = re.compile(r"^[A-Za-z0-9_-]+$")


def build_jobs(cells, keys_dir):
    keys_dir.mkdir(parents=True, exist_ok=True)
    copied = {}

    def keep(p):
        p = Path(p).resolve()
        if p not in copied:
            dst = keys_dir / f"k{len(copied):02d}_{p.parent.name}_{p.stem}.png"
            shutil.copyfile(p, dst)
            copied[p] = dst
        return str(copied[p])

    jobs = []
    for c in cells:
        for seed in c["seeds"]:
            jid = f"{c['id']}_S{seed}"
            if not ID_OK.match(jid):
                raise SystemExit(f"bad job id {jid!r}: letters, digits, - and _ only")
            j = {"id": jid, "first": keep(c["first"]), "frames": c.get("frames", 8), "seed": seed, "action": c["action"]}
            if c.get("last"):
                j["last"] = keep(c["last"])
            if plspec.gens(j["frames"]) > 2 and not c.get("allow_gens"):
                raise SystemExit(f"{jid}: {j['frames']} frames cost {plspec.gens(j['frames'])} generations; say allow_gens and why")
            jobs.append(j)
    ids = [j["id"] for j in jobs]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate job ids")
    return jobs


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("dir"); ap.add_argument("--name", required=True); ap.add_argument("--cells", required=True)
    ap.add_argument("--max-gens", type=int, default=0); ap.add_argument("--account", type=int, default=1); ap.add_argument("--provenance", default="")
    a = ap.parse_args(argv)
    d = Path(a.dir)
    d.mkdir(parents=True, exist_ok=True)
    jobs = build_jobs(json.loads(Path(a.cells).read_text()), d / "keys")
    cost = sum(plspec.gens(j["frames"]) for j in jobs)
    if a.max_gens and cost > a.max_gens:
        raise SystemExit(f"{len(jobs)} jobs cost {cost} generations, over --max-gens {a.max_gens}")
    (d / "jobs.json").write_text(json.dumps(jobs, indent=1))
    spec = plspec.build(a.name, d / "out", jobs, a.account, provenance=a.provenance)
    (d / "spec.json").write_text(json.dumps(spec, indent=1))
    print(d / "spec.json", "jobs", len(jobs), "expected generations", cost)


if __name__ == "__main__":
    main()
