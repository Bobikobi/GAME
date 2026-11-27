#!/usr/bin/env python3
"""Tests of measure.py on synthetic frames. No network, no files outside a temp folder. Run: python3 -I tools/anim/routes/test_measure.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import measure  # noqa: E402


def frame(boxes, colour=(200, 120, 60)):
    a = np.zeros((128, 128, 4), np.uint8)
    for y0, y1, x0, x1 in boxes:
        a[y0:y1, x0:x1] = (*colour, 255)
    return a


class MeasureTest(unittest.TestCase):
    def test_hausdorff_is_zero_for_equal_frames_and_the_shift_for_a_shifted_box(self):
        a = frame([(20, 100, 40, 60)])
        self.assertEqual(measure.hausdorff(a, a), 0.0)
        b = frame([(20, 100, 45, 65)])
        self.assertEqual(measure.hausdorff(a, b), 5.0)

    def test_a_far_limb_dominates_the_jump(self):
        a = frame([(20, 100, 40, 60)])
        b = frame([(20, 100, 40, 60), (30, 34, 90, 94)])
        self.assertGreater(measure.hausdorff(a, b), 25)

    def test_measure_reads_heights_feet_and_loop(self):
        ref = frame([(20, 116, 40, 60)])
        frames = [frame([(20, 116, 40, 60)]), frame([(10, 116, 40, 60)]), frame([(20, 116, 41, 61)]), frame([(20, 116, 40, 60)])]
        m = measure.measure(frames, ref, 1440)
        self.assertEqual(m["frames"], 4)
        self.assertEqual(m["ms_per_frame"], 360.0)
        self.assertEqual((m["b1_height_min"], m["b1_height_max"], m["b1_height_stance"]), (96, 106, 96))
        self.assertEqual(m["b2_lowest_row_spread"], 0)
        self.assertEqual(m["b2_foot_edge_drift"], 1)
        self.assertEqual(m["b1_palette_dist_max"], 0.0)
        self.assertTrue(m["b4_loop_ok"])

    def test_a_loop_that_jumps_more_than_its_inner_steps_is_flagged(self):
        ref = frame([(20, 116, 40, 60)])
        frames = [frame([(20, 116, 40 + 10 * k, 60 + 10 * k)]) for k in range(4)]
        self.assertFalse(measure.measure(frames, ref)["b4_loop_ok"])


if __name__ == "__main__":
    unittest.main()
