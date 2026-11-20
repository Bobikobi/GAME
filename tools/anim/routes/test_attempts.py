#!/usr/bin/env python3
"""Tests of the pure functions of the dropped routes' scripts (cutout.py, r6.py, retarget.py); kept in the attempt tag. No network, no files outside a temp folder. Run: python3 -I tools/anim/routes/test_attempts.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cutout  # noqa: E402
import r6  # noqa: E402
import retarget  # noqa: E402

class Cutout(unittest.TestCase):
    def test_pose_is_cyclic_and_clamped(self):
        a, b = cutout.pose_at(0.0), cutout.pose_at(0.999)
        for k in a:
            self.assertAlmostEqual(a[k], b[k], delta=1.0)
        for t in np.linspace(0, 1, 40, endpoint=False):
            for k, v in cutout.pose_at(t).items():
                lo, hi = cutout.LIMITS[k]
                self.assertTrue(lo <= v <= hi)

    def test_clamp(self):
        self.assertEqual(cutout.clamp_pose({"shoulder_l": 400, "drop": -3})["shoulder_l"], 175)
        self.assertEqual(cutout.clamp_pose({"drop": -3})["drop"], 0)

    def test_rotated_point_quarter_turn(self):
        x, y = cutout.rotated_point((11, 10), (10, 10), 90)  # one px right of the pivot, counter-clockwise on screen -> above it
        self.assertAlmostEqual(x, 10, places=6)
        self.assertAlmostEqual(y, 9, places=6)


class R6(unittest.TestCase):
    def test_blend_pair_mask_is_the_union(self):
        a = np.zeros((4, 4, 4), np.uint8)
        b = np.zeros((4, 4, 4), np.uint8)
        a[0, 0] = (100, 0, 0, 255)
        b[1, 1] = (0, 100, 0, 255)
        rgb, m = r6.blend_pair(a, b)
        self.assertTrue(m[0, 0] and m[1, 1] and not m[2, 2])
        self.assertEqual(rgb[0, 0].tolist(), [100, 0, 0])


class Retarget(unittest.TestCase):
    def test_fit_similarity_recovers_scale_and_offset(self):
        src = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 2.0]])
        dst = src * 3.0 + np.array([5.0, -2.0])
        s, t, rms = retarget.fit_similarity(src, dst)
        self.assertAlmostEqual(s, 3.0, places=6)
        self.assertAlmostEqual(rms, 0.0, places=6)
        self.assertEqual(t.round(6).tolist(), [5.0, -2.0])

    def test_project_up_is_screen_up(self):
        a = retarget.project([0, 0, 0], 40, 35)
        b = retarget.project([0, 1, 0], 40, 35)
        self.assertLess(b[1], a[1])  # one metre up moves the point up the screen (smaller y)



if __name__ == "__main__":
    unittest.main()
