#!/usr/bin/env python3
"""python3 tools/anim/prod/selftest.py - builds synthetic frames and shows each gate reads them right. No pictures, no network, no paths outside a temp folder."""
import json, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gates, process, verdict, manifest

BONE, DARK, SKIN = (226, 190, 140), (40, 24, 28), (170, 120, 90)
GROUND, STAND = 117, 60


def figure(top=GROUND - STAND + 1, feet=GROUND, x0=50, arm=0, colour=BONE, blob=None):
    """A stick figure: head, body, two legs ending on `feet`, optional arm reaching left by `arm` px, optional detached blob."""
    a = np.zeros((128, 128, 4), np.uint8)
    def box(y0, y1, x0_, x1_, c):
        a[y0:y1 + 1, x0_:x1_ + 1, :3] = c; a[y0:y1 + 1, x0_:x1_ + 1, 3] = 255
    box(top, top + 9, x0 + 4, x0 + 13, colour)
    box(top + 10, top + (feet - top) // 2, x0 + 3, x0 + 14, SKIN)
    box(top + (feet - top) // 2 + 1, feet, x0 + 3, x0 + 7, colour)
    box(top + (feet - top) // 2 + 1, feet, x0 + 10, x0 + 14, colour)
    box(top, top, x0 + 4, x0 + 13, DARK)
    if arm:
        box(top + 14, top + 16, x0 + 3 - arm, x0 + 2, colour)
    if blob:
        box(blob[0], blob[0] + 3, blob[1], blob[1] + 3, (255, 255, 255))
    return a


def kept(tmp):
    for race in ("t",):
        for motion in ("idle-left", "chop-left"):
            d = Path(tmp) / race / motion
            d.mkdir(parents=True)
            for i in range(4):
                Image.fromarray(figure(top=GROUND - STAND + 1 + (0 if motion == "idle-left" else -4 * (i % 2)))).save(d / f"f{i}.png")
    return Path(tmp)


def check(name, cond):
    print(("ok   " if cond else "FAIL ") + name)
    if not cond:
        check.bad += 1
check.bad = 0


def main():
    with tempfile.TemporaryDirectory() as tmp:
        k = kept(Path(tmp) / "kept")
        ref = gates.Reference(k, "t", "left")
        check("reference reads the kept ground row and stance height", (ref.ground, ref.stand_h) == (GROUND, STAND))
        clean = [figure(), figure(arm=8), figure(arm=14), figure()]
        fr, m = gates.run(clean, ref)
        check("clean clip: a, b, c pass", (m["gate_a"], m["gate_b"], m["gate_c"]) == ("PASS", "PASS", "PASS"))
        _, m = gates.run([figure(), figure(feet=GROUND - 2, top=GROUND - STAND - 1), figure()], ref)
        check("a: a 2 px lift is re-snapped (spread 0, bob 2)", m["a_raw_spread"] == 2 and m["a_spread_after"] == 0 and m["a_bob_px"] == 2 and m["gate_a"] == "PASS")
        _, m = gates.run([figure(), figure(feet=GROUND - 5, top=GROUND - STAND - 4), figure()], ref)
        check("a: a 5 px bob fails the 3 px bob limit", m["a_bob_px"] == 5 and m["gate_a"] == "FAIL")
        _, m = gates.run([figure(), figure(feet=GROUND - 20, top=GROUND - STAND - 19), figure()], ref, air=[1])
        check("a: an airborne frame is exempt", m["gate_a"] == "PASS" and m["a_shifts"][1] == 0)
        _, m = gates.run([figure(), figure(colour=(255, 0, 255)), figure()], ref)
        check("b: a magenta body fails identity", m["gate_b"] == "FAIL" and m["b_identity_max"] > 18)
        crouch = figure(top=GROUND - STAND + 15)
        _, m = gates.run([figure(), crouch, figure()], ref)
        check("c: an undeclared crouch fails", m["gate_c"] == "FAIL")
        _, m = gates.run([figure(), crouch, figure()], ref, bend=[1])
        check("c: a declared crouch is the motion, lowest height written", m["gate_c"] == "PASS" and m["c_lowest_height"] == STAND - 14)
        _, m = gates.run([crouch, figure(), figure()], ref, bend=[0])
        check("c: the first frame is held to the stance even when declared", m["gate_c"] == "FAIL")
        _, m = gates.run([figure(), figure(arm=8), figure(arm=14), figure(arm=8), figure()], ref, loop=True)
        check("e: a loop that returns passes", m["gate_e"] == "PASS" and m["e_close"] <= m["e_step_max"])
        _, m = gates.run([figure(), figure(arm=3), figure(arm=6), figure(arm=9), figure(arm=30)], ref, loop=True)
        check("e: a jump from the last frame to the first fails", m["gate_e"] == "FAIL")
        _, m = gates.run([figure(), figure(arm=4), figure(arm=8), figure(arm=4)], ref, loop=True, loop_from=1)
        check("e: a hold that loops on its own frames passes (loop_from)", m["gate_e"] == "PASS")
        _, m = gates.run([figure(), figure(blob=(20, 100)), figure()], ref)
        check("f: a detached blob is flagged for the eye", [f["frame"] for f in m["f_flags"]] == [1])
        _, m = gates.run([figure(), figure(blob=(20, 100)), figure()], ref, effect=[1])
        check("f: an effect frame is declared and left out of c", m["effect_frames"] == [1])
        sl = [figure(), figure(x0=59), figure(x0=45), figure()]
        _, m = gates.run(sl, ref)
        check("feet edges read a figure that translated 9 px", m["aid_foot_edges"][1][0] - m["aid_foot_edges"][0][0] == 9)
        _, m = gates.run(sl, ref, anchor_x=True)
        check("anchor_x pins the feet midpoint to frame 0 by whole pixels", len({tuple(e) for e in m["aid_foot_edges"]}) == 1 and m["aid_x_shifts"] == [0, -9, 5, 0])
        sn = gates.snap(figure(colour=(250, 250, 250)), ref.race_palette)
        check("snap: every opaque pixel lands on a kept colour", {tuple(c) for c in sn[..., :3][sn[..., 3] > 0]} <= {tuple(c) for c in ref.race_palette})
        # the CLI end to end, the verdict guard, the manifest
        src = Path(tmp) / "src"; src.mkdir()
        for i, f in enumerate(clean):
            Image.fromarray(f).save(src / f"f{i}.png")
        out = Path(tmp) / "set"
        process.main([str(src), "--kept", str(k), "--out", str(out), "--race", "t", "--motion", "strike", "--route", "p", "--meta", '{"jobs":["J0"],"seeds":[1]}'])
        d = out / "t" / "strike-left"
        check("process writes frames, preview and clip.json", len(list(d.glob("f*.png"))) == 4 and (d / "preview.gif").exists() and (d / "clip.json").exists())
        verdict.main([str(d), "--eye", "yes,yes,yes", "--verdict", "PASS (eye)", "--tries", "1", "--gens", "1"])
        try:
            verdict.main([str(d), "--eye", "yes,no,yes", "--verdict", "PASS (eye)"]); refused = False
        except SystemExit:
            refused = True
        check("verdict refuses PASS (eye) with a no", refused)
        manifest.main([str(out), str(Path(tmp) / "m.json")])
        rows = json.loads((Path(tmp) / "m.json").read_text())["rows"]
        check("manifest has one row with the verdict and gates", len(rows) == 1 and rows[0]["verdict"] == "PASS (eye)" and rows[0]["gates"]["gate_a"] == "PASS")
    print("selftest:", "FAILED %d" % check.bad if check.bad else "all passed")
    return 1 if check.bad else 0


if __name__ == "__main__":
    sys.exit(main())
