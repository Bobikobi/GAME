#!/usr/bin/env python3
"""Write a PixelLab spec (recipe `keyframes`, animate-with-text-v3) for the art runner, and the cost rule of the lane.

  plspec.py SPEC_OUT --name NAME --out OUTDIR --account 1 --jobs JOBS.json

JOBS.json: [{"id": "A", "first": "k0.png", "last": "k1.png" (optional), "frames": 4, "seed": 7, "action": "..."}]. Paths are made absolute.
Cost rule (measured from the ledger's before/after reads, 14.11): a 128 px job costs ceil(128*128*frames/65536) generations:
4 frames 1, 6 and 8 frames 2, 12 frames 3, 16 frames 4. The runner's own estimate (1 a job) undercounts; the server's balance is the truth."""
import argparse, json, math
from pathlib import Path


def gens(frames, size=128):
    return math.ceil(size * size * frames / 65536)


def build(name, out, jobs, account=1, label="", provenance=""):
    spec = {"name": name, "out": str(Path(out).resolve()), "label": label or name, "provenance": provenance or f"{name}, production lane #716, not shipped", "jobs": []}
    for j in jobs:
        i = {"first_frame": str(Path(j["first"]).resolve()), "action": j["action"], "frame_count": j["frames"], "no_background": True}
        if j.get("last"):
            i["last_frame"] = str(Path(j["last"]).resolve())
        spec["jobs"].append({"id": j["id"], "recipe": "keyframes", "inputs": i, "seed": j["seed"], "account": account})
    return spec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec"); ap.add_argument("--name", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--account", type=int, default=1); ap.add_argument("--jobs", required=True)
    a = ap.parse_args()
    jobs = json.loads(Path(a.jobs).read_text())
    Path(a.spec).write_text(json.dumps(build(a.name, a.out, jobs, a.account), indent=1))
    print(a.spec, "jobs", len(jobs), "expected generations", sum(gens(j["frames"]) for j in jobs))


if __name__ == "__main__":
    main()
