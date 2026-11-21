"""Tests of the kit packer (pack.py) on synthetic figures (run by tools/test/clothing-art.test.ts, or: python3 -m unittest)."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pack  # noqa: E402

PAL = np.array([[0x1b, 0x1a, 0x2e], [200, 150, 90], [120, 80, 40], [240, 200, 160]], np.uint8)


def figure(h=96, top=22, x0=52, x1=75, color=(190, 140, 80)):
    a = np.zeros((128, 128, 4), np.uint8)
    a[top:top + h, x0:x1 + 1, :3] = color
    a[top:top + h, x0:x1 + 1, 3] = 255
    return a


def box(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


class Pack(unittest.TestCase):
    def test_plan_puts_the_standing_figure_on_the_walks_height_and_feet(self):
        stand = figure()
        target = dict(h=67, low=100, mid=66.0)
        f, ox, oy = pack.plan(stand, target)
        baked = pack.bake(stand, f, ox, oy)
        x0, x1, y0, y1 = box(baked)
        self.assertLessEqual(abs((y1 - y0 + 1) - 67), 1)
        self.assertEqual(y1, 100)
        self.assertLessEqual(abs((x0 + x1) / 2 - 66.0), 1)

    def test_every_frame_of_a_sheet_moves_by_the_same_transform(self):
        stand = figure()
        step = np.roll(stand, 4, 1)                      # the same figure 4 px to the right: a walk pose
        f, ox, oy = pack.plan(stand, dict(h=67, low=100, mid=64.0))
        a = box(pack.bake(stand, f, ox, oy))
        b = box(pack.bake(step, f, ox, oy))
        self.assertLessEqual(abs((b[0] - a[0]) - round(4 * f)), 1)
        self.assertEqual((a[2], a[3]), (b[2], b[3]))      # the feet row does not move with the pose

    def test_kit_frame_is_on_the_palette_with_an_ink_edge_and_no_specks(self):
        a = figure(h=40, top=40)
        a[55:57, 60:62, 3] = 0                           # a 4 px pocket of see-through inside the figure
        k = pack.kit_frame(a, PAL)
        self.assertTrue((k[55:57, 60:62, 3] == 255).all())
        solid = k[..., 3] == 255
        for rgb in {tuple(p) for p in k[solid][:, :3]}:
            self.assertIn(rgb, {tuple(p) for p in PAL})
        self.assertEqual(tuple(k[40, 60, :3]), (0x1b, 0x1a, 0x2e))   # the top row is edge
        self.assertEqual(tuple(k[60, 52, :3]), (0x1b, 0x1a, 0x2e))   # the left column is edge
        self.assertNotEqual(tuple(k[60, 60, :3]), (0x1b, 0x1a, 0x2e))  # the inside is not

    def test_strip_is_the_frames_side_by_side_with_the_standing_pose_last(self):
        frames = [figure(), np.roll(figure(), 2, 1)]
        s = pack.strip(frames[:1], frames[1])
        self.assertEqual(s.shape, (128, 256, 4))
        self.assertTrue(np.array_equal(s[:, 128:], frames[1]))

    def test_row_follows_the_walk_of_the_race(self):
        walk = dict(travel_mpx=14428, poses=10, anchor=[64, 90], ramps=['wood', 'red', 'skin'], scale=1)
        row = pack.sheet_row('chars/human_reed-walker_down.png', 5, walk, ['bark'], poses=4)
        self.assertEqual(row['frames'], 5)
        self.assertEqual(row['density'], 4)
        self.assertEqual(row['stride']['anchor'], [64, 90])
        self.assertIs(row['stride']['bob'], False)
        self.assertEqual(row['stride']['travel_mpx'], round(14428 * 10 / 4))   # the same cycle length over fewer poses
        self.assertEqual(row['ramps'], ['wood', 'red', 'skin', 'bark'])
        self.assertLessEqual(len(row['ramps']), 4)


if __name__ == '__main__':
    unittest.main()
