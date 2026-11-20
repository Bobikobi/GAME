#!/usr/bin/env python3
"""Tests of the pure functions of cutgrid.py, skelinterp.py and compare.py. No network, no files outside a temp folder. Run: python3 -I tools/anim/routes/test_routes.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compare  # noqa: E402
import cutgrid  # noqa: E402
import skelinterp  # noqa: E402

class Cutgrid(unittest.TestCase):
    def test_blob_bbox_takes_the_biggest(self):
        m = np.zeros((20, 20), bool)
        m[2:4, 2:4] = True
        m[8:16, 5:9] = True
        self.assertEqual(cutgrid.blob_bbox(m), (5, 8, 9, 16))
        self.assertIsNone(cutgrid.blob_bbox(np.zeros((4, 4), bool)))

    def test_snap(self):
        pal = np.array([[0, 0, 0], [200, 100, 50]], np.uint8)
        out = cutgrid.snap_to(np.array([[[190, 110, 40], [10, 10, 10]]], np.uint8), pal)
        self.assertEqual(out.tolist(), [[[200, 100, 50], [0, 0, 0]]])


class Skelinterp(unittest.TestCase):
    def test_catmull_passes_through_the_keys(self):
        pts = np.array([[0.0], [1.0], [0.0], [-1.0]])
        out = skelinterp.catmull(pts, 4)
        self.assertEqual(out[:, 0].round(6).tolist(), [0.0, 1.0, 0.0, -1.0])

    def test_catmull_length(self):
        self.assertEqual(len(skelinterp.catmull(np.arange(6.0).reshape(6, 1), 15)), 15)


    def test_pin_sets_the_named_joint_only(self):
        frames = [[{"x": 0.1, "y": 0.2, "label": "A"}, {"x": 0.3, "y": 0.4, "label": "B"}]]
        out = skelinterp.pin(frames, [{"label": "A", "x": 0.9, "y": 0.8}], ["A"])
        self.assertEqual((out[0][0]["x"], out[0][0]["y"]), (0.9, 0.8))
        self.assertEqual((out[0][1]["x"], out[0][1]["y"]), (0.3, 0.4))


class Compare(unittest.TestCase):
    def test_bar_lines(self):
        m = {"b1_height_min": 90, "b1_height_max": 100, "b1_height_stance": 96, "b1_palette_dist_mean": 0.0, "b2_foot_edge_drift": 1,
             "b2_lowest_row_spread": 0, "b3_limb_jump_mean": 5.5, "b3_limb_jump_max": 12.0, "b3_mad_max": 7.0, "b4_close_limb_jump": 2.0, "b4_loop_ok": True}
        lines = compare.bar_lines(m, 30, 48.0)
        self.assertTrue(lines[0].startswith("30 frames, 48 ms each = 21 fps"))
        self.assertIn("ok", lines[-1])



if __name__ == "__main__":
    unittest.main()
