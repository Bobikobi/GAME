"""Tests of the head-wear layer (hatlayer.py) on synthetic figures (run by tools/test/clothing-art.test.ts, or: python3 -m unittest)."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402
import hatlayer  # noqa: E402
from test_bars import STRAW, figure, paint  # noqa: E402


def with_hat(a):
    """The figure in a straw hat: a crown over the hair and a brim across the brow rows, outside the face box."""
    b = paint(a, 20, 24, 56, 71, STRAW)           # crown, 2 rows over the hair's top (inside S1)
    return paint(b, 31, 33, 48, 79, STRAW)        # brim, above the face box


def shifted(a, dy, dx):
    out = np.zeros_like(a)
    H, W = a.shape[:2]
    out[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = a[max(-dy, 0):H + min(-dy, 0), max(-dx, 0):W + min(-dx, 0)]
    return out


class HatLayer(unittest.TestCase):
    def setUp(self):
        self.bare = figure()
        self.dressed = with_hat(self.bare)
        self.sprite = hatlayer.extract(self.bare, self.dressed, 'front')

    def test_the_sprite_is_the_hat_and_nothing_of_the_face(self):
        lm = bars.landmarks(self.bare, 'front')
        self.assertGreater(int(self.sprite['mask'].sum()), 100)
        self.assertFalse((self.sprite['mask'] & bars.face_mask(lm, self.bare.shape)).any())

    def test_the_hat_follows_the_head_to_another_frame(self):
        moved = shifted(self.bare, 2, 1)                      # the head bobs: 2 rows down, 1 column right
        out, mask = hatlayer.lay(self.sprite, moved, 'front')
        want = shifted(self.sprite['mask'].astype(np.uint8), 2, 1).astype(bool)
        self.assertTrue((mask == want).all())
        self.assertTrue((out[mask][:, :3] == STRAW).all())

    def test_the_face_stays_the_bare_one_and_the_bars_pass(self):
        out, _ = hatlayer.compose(self.dressed, self.bare, self.sprite, 'front')
        r = bars.frame_report(self.bare, out, ['head'], [STRAW], 'front')
        self.assertTrue(r['S3']['ok'] and r['S1']['ok'] and r['S5']['ok'])
        self.assertEqual(r['S2']['face_share'], 0.0)

    def test_hair_standing_over_the_crown_is_cleared(self):
        tuft = paint(self.bare, 26, 30, 49, 50, (120, 55, 25))   # hair over the brim's outer part, above the brim's top row (31)
        out, mask = hatlayer.lay(self.sprite, tuft, 'front')
        self.assertGreater(hatlayer.poke_through(tuft, mask), 0)
        self.assertEqual(int(bars.opaque(out)[:31, 49:51].sum()), 0)

    def test_the_hat_area_is_the_same_on_every_frame(self):
        areas = []
        for dy, dx in ((0, 0), (1, 0), (2, 1), (1, -1)):
            out, _ = hatlayer.compose(shifted(self.dressed, dy, dx), shifted(self.bare, dy, dx), self.sprite, 'front')
            areas.append(bars.frame_report(shifted(self.bare, dy, dx), out, ['head'], [STRAW], 'front')['garment_area'])
        self.assertTrue(bars.s4(areas, cyclic=True)['ok'])


if __name__ == '__main__':
    unittest.main()
