"""Tests of round 2's tools (public #952) on the synthetic figure of test_lookup.py, with keypoints written by hand: no pose model,
no torch, no OpenCV needed (the flow test runs only where OpenCV is installed)."""
import os
import sys
import unittest
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars2  # noqa: E402
import overhang  # noqa: E402
import parts  # noqa: E402
import posemap  # noqa: E402
from test_lookup import F, GREEN, figure, paint, shift_map, shifted, trousers_piece  # noqa: E402

# Halpe-26 points (x, y) for test_lookup.figure(): the figure's left side is the image's right
KP = np.array([(64, 40), (70, 37), (58, 37), (76, 38), (52, 38), (82, 52), (46, 52), (84, 68), (45, 68), (84, 84), (45, 84),
               (71, 78), (58, 78), (71, 98), (58, 98), (71, 114), (58, 114), (64, 24), (64, 49), (64, 78),
               (73, 117), (56, 117), (75, 117), (54, 117), (70, 117), (59, 117)], float)


def stand():
    fr = figure()
    body = fr[..., 3] > 0
    return SimpleNamespace(frame=fr, body=body, kp=KP, lab=parts.label(body, KP))


class Parts(unittest.TestCase):
    def test_labels_follow_the_bones(self):
        st = stand()
        name = lambda y, x: parts.NAMES[st.lab[y, x]]
        self.assertEqual(name(35, 64), 'head')
        self.assertEqual(name(62, 64), 'torso')
        self.assertIn(name(110, 70), ('shin_l', 'foot_l'))
        self.assertIn(name(105, 57), ('shin_r', 'foot_r'))
        self.assertIn(name(86, 84), ('hand_l', 'fore_l'))
        self.assertEqual(st.lab[0, 0], -1)

    def test_neighbours_are_symmetric(self):
        for a in parts.NAMES:
            for b in parts.NAMES:
                self.assertEqual(parts.neighbours(a, b), parts.neighbours(b, a))
        self.assertTrue(parts.neighbours('shin_l', 'foot_l'))
        self.assertFalse(parts.neighbours('hand_l', 'foot_l'))


class Posemap(unittest.TestCase):
    def test_a_moved_figure_maps_back_to_itself(self):
        st = stand()
        dy, dx = 3, -5
        fr = shifted(st.frame, dy, dx)
        src = posemap.fit(st, fr, KP + (dx, dy))
        want = shift_map(dy, dx, st.body)
        body = fr[..., 3] > 0
        same = (src == want).all(-1) & body
        self.assertGreater(same.sum() / body.sum(), 0.9)


class Overhang(unittest.TestCase):
    def test_thickness_is_band_and_a_stray_blob_is_misfit(self):
        st = stand()
        dist = parts.edt(st.body)
        tr = trousers_piece()
        tr = paint(tr, 100, 112, 49, 51, GREEN)                 # 2 px of cloth outside the leg's edge
        clean = overhang.analyse(tr[..., 3] > 0, st.body, st.lab, 'trousers', dist)
        self.assertEqual(clean['misfit'], 0)
        self.assertGreaterEqual(max(clean['band'].values()), 1)
        blob = paint(tr, 20, 24, 20, 24, GREEN)                # cloth floating far from the body
        bad = overhang.analyse(blob[..., 3] > 0, st.body, st.lab, 'trousers', dist)
        self.assertGreaterEqual(bad['misfit'], 16)

    def test_fit_never_adds_misfit(self):
        st = stand()
        tr = shifted(trousers_piece(), 0, 6)                   # a piece cut a little off the legs
        out, moves, before, after = overhang.fit(tr, st.body, st.lab, 'trousers')
        self.assertLessEqual(after['misfit'], before['misfit'])
        self.assertGreaterEqual(after['coverage'], before['coverage'])


class Carry(unittest.TestCase):
    def test_overhang_rides_the_part_it_hangs_from(self):
        st = stand()
        tr = paint(trousers_piece(), 100, 112, 49, 51, GREEN)
        dy, dx = 2, 4
        src = shift_map(dy, dx, st.body)
        fr_body = shifted(st.frame, dy, dx)[..., 3] > 0
        layer, lsrc, dropped = bars2.carry(tr, st.frame, src, st.lab, fr_body)
        want = shifted(tr, dy, dx)[..., 3] > 0
        self.assertEqual(dropped, 0)
        self.assertTrue(((layer[..., 3] > 0) == want).all())

    def test_overhang_is_dropped_where_the_body_has_left(self):
        st = stand()
        tr = paint(trousers_piece(), 100, 112, 49, 51, GREEN)
        src = shift_map(0, 0, st.body)
        fr_body = st.body.copy()
        fr_body[90:118, 40:64] = False                          # the right leg is gone from the frame
        src[~fr_body] = -1
        layer, lsrc, dropped = bars2.carry(tr, st.frame, src, st.lab, fr_body)
        self.assertGreater(dropped, 0)
        self.assertFalse((layer[100:112, 49:51, 3] > 0).any())


class L4Rule(unittest.TestCase):
    """The manager's ruling of 28.11: a piece's area is read as a share of the frame's own body area, against the stand frame's share."""

    @staticmethod
    def row(px, body):
        return dict(px=px, body_px=body, stray=0, part_agree=1.0, misfit=0, face_px=0, on_palette=1.0)

    def test_a_clip_that_loses_area_everywhere_is_not_failed_by_its_own_median(self):
        # the stand frame: piece 300 of body 3000 = 0.10. A squat: piece and body both shrink to 60%, the share holds.
        rows = [self.row(300, 3000)] + [self.row(180, 1800)] * 9
        v = bars2.verdicts(rows, 0, 0.10)
        self.assertTrue(all(x['L4'] for x in v))
        # most of the clip loses area, so the clip median is the squat's: the old form fails the standing frames, the new one none
        rows = [self.row(300, 3000)] * 2 + [self.row(180, 1800)] * 8
        v = bars2.verdicts(rows, 0, 0.10)
        self.assertTrue(all(x['L4'] for x in v))
        self.assertFalse(v[0]['L4_old'])

    def test_a_piece_that_shrinks_against_its_body_fails(self):
        rows = [self.row(300, 3000), self.row(180, 3000)]
        v = bars2.verdicts(rows, 0, 0.10)
        self.assertTrue(v[0]['L4'])
        self.assertFalse(v[1]['L4'])
        self.assertAlmostEqual(v[1]['area_ratio'], 0.6, places=3)
        # a whole clip of shrunk pieces passes the old median form and fails the new one (the round's f2b cap)
        v = bars2.verdicts([self.row(180, 3000)] * 5, 0, 0.10)
        self.assertTrue(all(x['L4_old'] and not x['L4'] and not x['all'] and x['all_old'] for x in v))

    def test_without_a_stand_share_it_falls_back_to_the_median(self):
        v = bars2.verdicts([self.row(100, 1000)] * 3, 0)
        self.assertTrue(all(x['L4'] == x['L4_old'] for x in v))


class Agree(unittest.TestCase):
    def test_auc_and_line(self):
        import agree
        self.assertEqual(agree.auc([0.9, 0.8, 0.3, 0.2], [False, False, True, True]), 1.0)
        self.assertEqual(agree.auc([0.5, 0.5], [False, True]), 0.5)
        self.assertIsNone(agree.auc([0.5], [False]))
        self.assertEqual(agree.best_line([0.9, 0.8, 0.3, 0.2], [False, False, True, True])[0], 1.0)


class Flow(unittest.TestCase):
    def test_dis_flow_finds_a_shift(self):
        try:
            import cv2  # noqa: F401
        except ImportError:
            self.skipTest('opencv not installed')
        import flowmap
        st = stand()
        fr = shifted(st.frame, 2, 3)
        src = flowmap.fit(st.frame, fr, variant='dis')
        want = shift_map(2, 3, st.body)
        body = fr[..., 3] > 0
        self.assertGreater(((src == want).all(-1) & body).sum() / body.sum(), 0.6)


if __name__ == '__main__':
    unittest.main()
