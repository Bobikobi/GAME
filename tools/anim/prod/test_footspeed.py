#!/usr/bin/env python3
"""Tests of footspeed.py on synthetic frames. No network, no files outside a temp folder. Run: python3 -I tools/anim/prod/test_footspeed.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import footspeed  # noqa: E402

GROUND = 117


def frames(step, n=8, x0=30, width=6):
    """A body (a column) with one planted foot that is `step` raw px further along x in each next pose."""
    out = []
    for i in range(n):
        a = np.zeros((128, 128, 4), np.uint8)
        a[40:GROUND - 4, 60:70] = (200, 120, 60, 255)
        x = x0 + int(round(i * step))
        a[GROUND - 4:GROUND + 1, x:x + width] = (90, 60, 40, 255)
        out.append(a)
    return out


class FootSpeedTest(unittest.TestCase):
    def test_a_foot_that_slides_twelve_px_a_pose_measures_twelve(self):
        m = footspeed.measure(frames(12), fit=1.0)
        self.assertEqual(m["raw"], 12.0)
        self.assertEqual(m["art"], 12.0)
        self.assertAlmostEqual(m["walk_poses_s"], 28.1, places=1)

    def test_the_art_step_is_the_raw_step_at_the_clips_fit(self):
        self.assertAlmostEqual(footspeed.measure(frames(10), fit=0.719)["art"], 7.19, places=2)

    def test_a_bounce_in_place_fails_the_walk_pace(self):
        verdict, info = footspeed.gate_g(frames(6), fit=0.719)
        self.assertEqual(verdict, "FAIL")
        self.assertEqual(info["needs"], {"337": 11.2})
        self.assertAlmostEqual(info["walk_poses_s"], 78.1, places=0)

    def test_a_long_stride_passes_the_walk_pace_and_not_the_run_pace(self):
        self.assertEqual(footspeed.gate_g(frames(16), fit=1.0)[0], "PASS")
        self.assertEqual(footspeed.gate_g(frames(16), fit=1.0, paces=(footspeed.PACE_WALK, footspeed.PACE_RUN))[0], "FAIL")
        self.assertEqual(footspeed.gate_g(frames(24), fit=1.0, paces=(footspeed.PACE_WALK, footspeed.PACE_RUN))[0], "PASS")

    def test_a_foot_that_does_not_move_is_a_fail_not_a_division(self):
        verdict, info = footspeed.gate_g(frames(0), fit=1.0)
        self.assertEqual(verdict, "FAIL")
        self.assertEqual(info["art"], 0.0)

    def test_the_pose_ceiling_is_the_games(self):
        game = (Path(__file__).resolve().parents[3] / "game" / "src" / "work.ts").read_text()
        self.assertIn(f"POSES_PER_S_MAX = {footspeed.POSES_PER_S_MAX};", game)


if __name__ == "__main__":
    unittest.main()
