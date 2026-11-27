#!/usr/bin/env python3
"""Tests of bars.py on synthetic frames. No network, no files outside a temp folder. Run: python3 -I tools/anim/creature/test_bars.py"""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bars  # noqa: E402


def frame(back_top=60, foot=100, x0=40, x1=90):
    """A body box (the back line at back_top, the lowest row at foot) in a 128 px frame."""
    a = np.zeros((128, 128, 4), np.uint8)
    a[back_top:foot, x0:x1] = (120, 110, 100, 255)
    return a


class BarsTest(unittest.TestCase):
    def test_a_still_loop_passes_every_bar(self):
        f = frame()
        r = bars.bars([f, f, f, f], f, 600, "loop", "wolf")
        self.assertEqual(r["b1_drift"], 0)
        self.assertTrue(r["b1_pass"] and r["b2_pass"] and r["b3_pass"])

    def test_the_back_line_range_is_the_drift_and_fails_over_two_pixels(self):
        ref = frame()
        r = bars.bars([frame(60), frame(62), frame(63), frame(60)], ref, 600, "loop", "wolf")
        self.assertEqual(r["b1_back_line_range"], [60, 63])
        self.assertEqual(r["b1_drift"], 3)
        self.assertFalse(r["b1_pass"])

    def test_feet_that_leave_the_ground_fail_the_lowest_row_bar(self):
        ref = frame()
        r = bars.bars([frame(foot=100), frame(foot=96), frame(foot=100), frame(foot=100)], ref, 600, "loop", "wolf")
        self.assertEqual(r["b2_lowest_row_spread"], 4)
        self.assertFalse(r["b2_pass"])

    def test_a_loop_whose_last_frame_is_far_from_the_first_does_not_close(self):
        ref = frame()
        r = bars.bars([frame(x0=40, x1=90), frame(x0=44, x1=94), frame(x0=48, x1=98), frame(x0=70, x1=120)], ref, 600, "loop", "wolf")
        self.assertFalse(r["b3_loop_closes"])

    def test_a_move_must_end_where_the_idle_can_follow(self):
        ref = frame()
        near = bars.bars([frame(), frame()], ref, 600, "move", "wolf")
        far = bars.bars([frame(), frame(x0=60, x1=110)], ref, 600, "move", "wolf")
        self.assertTrue(near["b3_pass"])
        self.assertFalse(far["b3_pass"])


if __name__ == "__main__":
    unittest.main()
