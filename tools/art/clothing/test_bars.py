"""Tests of the clothing bars on synthetic figures (run by tools/test/clothing-art.test.ts, or: python3 -m unittest)."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402

SKIN = (240, 170, 80)
HAIR = (120, 55, 25)
GREY = (150, 146, 132)
STRAW = (201, 169, 106)
RAMP = [(0x7a, 0x5f, 0x33), (0xa6, 0x85, 0x4a), (0xc9, 0xa9, 0x6a), (0xe8, 0xd4, 0xa2)]


def figure():
    """A 128 px frame: body rows 22..117, hair rows 22..35, face rows 36..47, trunk 48..70, shorts 71..88, legs 89..117."""
    a = np.zeros((128, 128, 4), np.uint8)

    def box(y0, y1, x0, x1, c):
        a[y0:y1 + 1, x0:x1 + 1, :3] = c
        a[y0:y1 + 1, x0:x1 + 1, 3] = 255
    box(22, 35, 52, 75, HAIR)
    box(36, 47, 54, 73, SKIN)
    box(48, 70, 46, 81, SKIN)
    box(71, 88, 50, 77, GREY)
    box(89, 117, 52, 75, SKIN)
    return a


def paint(a, y0, y1, x0, x1, c):
    b = a.copy()
    b[y0:y1 + 1, x0:x1 + 1, :3] = c
    b[y0:y1 + 1, x0:x1 + 1, 3] = 255
    return b


class Bars(unittest.TestCase):
    def setUp(self):
        self.bare = figure()
        self.lm = bars.landmarks(self.bare, 'front')

    def test_landmarks_follow_the_figure(self):
        self.assertEqual((self.lm['top'], self.lm['bot'], self.lm['h']), (22, 117, 96))
        x0, x1, y0, y1 = self.lm['face']
        self.assertEqual(y0, 22 + round(bars.BROW_FRAC * 96))
        self.assertTrue(x0 > 54 and x1 < 73)          # the middle of the head, not the temples
        left = bars.landmarks(self.bare, 'left')['face']
        self.assertEqual(left[0], 53)                  # the nose side of the head
        back = bars.landmarks(self.bare, 'back')['face']
        self.assertTrue(back[2] > y0)                  # a back view keeps only the ears and nape rows

    def test_s1_height_and_feet(self):
        self.assertTrue(bars.s1(self.bare, self.bare)['ok'])
        taller = paint(self.bare, 17, 21, 56, 70, STRAW)          # a crown 5 rows over the hair
        self.assertFalse(bars.s1(self.bare, taller)['ok'])
        crown2 = paint(self.bare, 20, 21, 56, 70, STRAW)          # 2 rows are inside the bar
        self.assertTrue(bars.s1(self.bare, crown2)['ok'])
        sole = paint(self.bare, 118, 119, 52, 60, STRAW)          # a sole 2 rows under the feet
        self.assertFalse(bars.s1(self.bare, sole)['ok'])

    def test_s3_garment_in_the_face_box(self):
        brim = paint(self.bare, 30, 32, 50, 77, STRAW)            # a brim across the hair: not the face
        self.assertTrue(bars.s3(self.bare, brim, ['head'], 'front', RAMP)['ok'])
        over_brow = paint(self.bare, 38, 40, 56, 71, (150, 50, 40))  # a hat band over the brows: the face
        self.assertFalse(bars.s3(self.bare, over_brow, ['head'], 'front', RAMP)['ok'])
        self.assertFalse(bars.s3(self.bare, over_brow, ['head'])['ok'])   # and with no ramp given
        shade = paint(self.bare, 40, 41, 58, 62, (225, 155, 70))  # the face redrawn with its own shading: still the face
        self.assertTrue(bars.s3(self.bare, shade, ['head'], 'front', RAMP)['ok'])
        gone = self.bare.copy(); gone[40, 58:70, 3] = 0   # a row of the face gone clear
        self.assertFalse(bars.s3(self.bare, gone, ['head'])['ok'])

    def test_s3_back_view_collar_ok_ear_and_hair_not(self):
        leather = (110, 70, 40)
        collar = paint(self.bare, 46, 48, 54, 73, leather)        # a high collar over the nape, between the ears
        self.assertTrue(bars.s3(self.bare, collar, ['top', 'legs'], 'back')['ok'])
        wide = paint(self.bare, 44, 47, 46, 81, (240, 170, 80))   # a head as wide as the trunk, so the ear columns hold pixels
        ear = paint(wide, 44, 48, 46, 49, leather)                # a piece over an ear column
        self.assertFalse(bars.s3(wide, ear, ['top', 'legs'], 'back')['ok'])
        in_hair = paint(self.bare, 30, 32, 56, 70, (30, 20, 12))      # a garment (not head-wear) over the hair above the nape band
        r = bars.s3(self.bare, in_hair, ['top', 'legs'], 'back')
        self.assertFalse(r['ok'])
        self.assertGreater(r['hair_px'], bars.S3_MAX)
        self.assertTrue(bars.s3(self.bare, in_hair, ['head'], 'back')['ok'])   # head-wear covers hair by design

    def test_s2_recoloured_figure_outside_the_garment(self):
        same = bars.s2(self.bare, self.bare, ['head'])
        self.assertEqual(same['aligned_share'], 0.0)
        blue = paint(self.bare, 71, 88, 50, 77, (60, 80, 130))    # the shorts went blue while a hat was asked for
        r = bars.s2(self.bare, blue, ['head'])
        self.assertGreater(r['aligned_share'], bars.S2_ALIGNED_MAX)
        shifted = np.roll(self.bare, 1, 1)                        # one pixel sideways is the same figure
        self.assertLess(bars.s2(self.bare, shifted, ['head'])['aligned_share'], bars.S2_ALIGNED_MAX)

    def test_s5_specks(self):
        speck = self.bare.copy()
        speck[5, 5] = (255, 0, 0, 255)
        self.assertFalse(bars.s5(self.bare, speck)['ok'])
        self.assertTrue(bars.s5(self.bare, self.bare)['ok'])

    def test_s4_area_change(self):
        self.assertTrue(bars.s4([700, 720, 690, 705], cyclic=True)['ok'])
        self.assertFalse(bars.s4([700, 0, 700, 700])['ok'])       # a bare frame inside the clip
        self.assertFalse(bars.s4([600, 729])['ok'])               # +17%

    def test_recolour_puts_the_garment_on_the_ramp(self):
        hat = paint(self.bare, 28, 33, 48, 79, (210, 150, 60))
        hat[30, 60, :3] = (0x1b, 0x1a, 0x2e)                      # ink stays ink
        g = bars.garment_pixels(self.bare, hat, self.lm, ['head'])
        ramp = [(0x7a, 0x5f, 0x33), (0xa6, 0x85, 0x4a), (0xc9, 0xa9, 0x6a), (0xe8, 0xd4, 0xa2)]
        out = bars.recolour(hat, g, ramp)
        self.assertEqual(tuple(out[30, 60, :3]), (0x1b, 0x1a, 0x2e))
        self.assertEqual(bars.ramp_share(out, g, ramp), 1.0)
        self.assertTrue(np.array_equal(out[100], hat[100]))       # nothing outside the garment moves


class BestCombo(unittest.TestCase):
    def test_same_as_every_combination(self):
        import itertools
        import random
        rnd = random.Random(7)
        for _ in range(30):
            opts = [[rnd.randint(200, 800) for _ in range(rnd.randint(1, 3))] for _ in range(rnd.randint(2, 6))]
            pick = bars.best_combo(opts)
            got = bars.s4([o[i] for o, i in zip(opts, pick)], cyclic=True)['max_change']
            want = min(bars.s4(list(c), cyclic=True)['max_change'] for c in itertools.product(*opts))
            self.assertAlmostEqual(got, want, places=9)

    def test_one_option_each(self):
        self.assertEqual(bars.best_combo([[5], [6], [7]]), [0, 0, 0])


if __name__ == '__main__':
    unittest.main()
