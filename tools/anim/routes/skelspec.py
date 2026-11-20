#!/usr/bin/env python3
"""Write the spec (for plclient.py) of one /animate-with-skeleton-v3 job: skelspec.py KP.json EST.json OUT.json --pick 0,4,8 --seed N --name NAME [--image REL_PNG]
KP.json is retarget.py's output; EST.json the /estimate-skeleton answer for the stance. --pick lists the frame indices to draw (3 to 15)."""
import json
import sys

WORDS = {
    "description": "a shirtless muscular man with spiky orange hair and grey shorts, bare empty fists, sharp pixel edges, no motion blur, no trails, nothing else in the picture",
    "action": "swing",
}


def spec(kp, est, pick, seed, name, image="../../ref/f0.png", direction="west", view="low top-down"):
    assert 3 <= len(pick) <= 15, "the endpoint draws 3 to 15 frames a job"
    first = [{"x": p["x"], "y": p["y"], "label": p["label"], "z_index": int(p.get("z_index", 0))} for p in est]
    return {"name": name, "path": "/animate-with-skeleton-v3", "body": {
        **WORDS, "direction": direction, "view": view, "first_frame": "@" + image, "first_frame_keypoints": first,
        "keypoints": [kp["frames"][i] for i in pick], "seed": seed, "no_background": True, "template_id": "mannequin"}}


def main():
    a = sys.argv[1:]
    opt = {}
    for flag in ("--pick", "--seed", "--name", "--image", "--direction"):
        if flag in a:
            i = a.index(flag)
            opt[flag] = a[i + 1]
            del a[i:i + 2]
    kp, est = json.load(open(a[0])), json.load(open(a[1]))
    est = est["keypoints"] if "keypoints" in est else est
    pick = [int(x) for x in opt["--pick"].split(",")]
    s = spec(kp, est, pick, int(opt.get("--seed", 0)), opt["--name"], opt.get("--image", "../../ref/f0.png"), opt.get("--direction", "west"))
    json.dump(s, open(a[2], "w"))
    print(f"{s['name']}: {len(pick)} frames, seed {opt.get('--seed', 0)}")


if __name__ == "__main__":
    main()
