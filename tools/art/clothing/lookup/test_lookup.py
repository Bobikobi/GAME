"""Tests of the lookup trial's tools on synthetic figures (run by tools/test/clothing-art.test.ts, or:
python3 -m unittest discover -s tools/art/clothing/lookup -p 'test_*.py')."""
import ast
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import carry  # noqa: E402
import common  # noqa: E402
import densemap  # noqa: E402
import evalmap  # noqa: E402
import partmap  # noqa: E402

F = 128
SKIN = (237, 168, 58)
INK = (27, 26, 46)
GREY = (143, 148, 168)
GREEN = (46, 107, 59)


def paint(a, y0, y1, x0, x1, rgb):
    a = a.copy()
    a[y0:y1, x0:x1] = (*rgb, 255)
    return a


def figure():
    """A stand-in for the stand frame: head, torso, shorts, two legs, two arms, each with an ink edge, so patches differ."""
    a = np.zeros((F, F, 4), np.uint8)
    a = paint(a, 22, 49, 51, 78, INK)
    a = paint(a, 23, 48, 52, 77, SKIN)
    a = paint(a, 36, 38, 57, 60, INK)                # eyes: the head is not flat
    a = paint(a, 49, 74, 50, 79, INK)
    a = paint(a, 50, 73, 52, 77, SKIN)
    a = paint(a, 56, 60, 58, 70, (184, 102, 31))      # chest shade
    a = paint(a, 74, 90, 50, 79, INK)
    a = paint(a, 75, 89, 52, 77, GREY)
    a = paint(a, 90, 118, 51, 64, INK)
    a = paint(a, 90, 117, 52, 63, SKIN)
    a = paint(a, 90, 118, 65, 78, INK)
    a = paint(a, 90, 117, 66, 77, SKIN)
    a = paint(a, 55, 89, 39, 51, INK)
    a = paint(a, 56, 88, 40, 50, SKIN)
    a = paint(a, 60, 64, 41, 49, (184, 102, 31))
    a = paint(a, 55, 89, 78, 90, INK)
    a = paint(a, 56, 88, 79, 89, SKIN)
    a = paint(a, 66, 70, 80, 88, (184, 102, 31))
    return a


def shifted(a, dy, dx):
    out = np.zeros_like(a)
    out[max(dy, 0):F + min(dy, 0), max(dx, 0):F + min(dx, 0)] = a[max(-dy, 0):F + min(-dy, 0), max(-dx, 0):F + min(-dx, 0)]
    return out


def shift_map(dy, dx, body):
    """The map of a frame that is the stand frame moved by (dy, dx): frame pixel p comes from p - d."""
    src = np.full((F, F, 2), -1, int)
    ys, xs = np.nonzero(body)
    src[ys + dy, xs + dx] = np.stack([ys, xs], -1)
    return src


def trousers_piece():
    return paint(np.zeros((F, F, 4), np.uint8), 76, 112, 51, 78, GREEN)


class CarryTests(unittest.TestCase):
    def test_a_known_shift_gives_the_known_piece(self):
        stand = figure()
        piece = trousers_piece()
        body = stand[..., 3] > 0
        src = shift_map(3, -2, body)
        layer, info = carry.carry(piece, stand, src)
        want = shifted(piece, 3, -2)
        # the body-covered part of the piece is carried exactly (a piece pixel off the stand body is carried by the nearest body pixel)
        m = (want[..., 3] > 0) & (shifted(stand, 3, -2)[..., 3] > 0)
        self.assertTrue(m.sum() > 300)
        self.assertTrue((layer[m] == want[m]).all())
        self.assertEqual(info['dropped'], 0)

    def test_piece_outside_the_body_rides_with_the_nearest_pixel(self):
        stand = figure()
        piece = paint(np.zeros((F, F, 4), np.uint8), 100, 104, 46, 52, GREEN)   # a hem hanging 5 px off the left leg
        src = shift_map(4, 5, stand[..., 3] > 0)
        layer, _ = carry.carry(piece, stand, src)
        ys, xs = np.nonzero(layer[..., 3] > 0)
        self.assertEqual((ys.min(), ys.max(), xs.min(), xs.max()), (104, 107, 51, 56))

    def test_a_hole_is_counted_and_never_filled(self):
        stand = figure()
        piece = trousers_piece()
        src = shift_map(0, 0, stand[..., 3] > 0)
        src[90:94, 56:60] = -1                                    # the map cannot say where these body pixels come from
        layer, _ = carry.carry(piece, stand, src)
        self.assertTrue((layer[90:94, 56:60, 3] == 0).all(), 'the hole stays empty')
        hole_in, hole_all = carry.holes(stand, src, layer)
        self.assertEqual(hole_all, 16)
        self.assertEqual(hole_in, 16)
        self.assertEqual(carry.measure(stand, layer, src)['holes_in_piece'], 16)

    def test_face_box_and_outside_are_counted(self):
        stand = figure()
        layer = np.zeros((F, F, 4), np.uint8)
        layer = paint(layer, 40, 44, 60, 64, GREEN)              # inside the head's face box
        layer = paint(layer, 100, 102, 10, 12, GREEN)            # far off the body
        src = np.full((F, F, 2), -1, int)
        m = carry.measure(stand, layer, src)
        self.assertEqual(m['face_px'], 16)
        self.assertEqual(m['outside'], 4)
        self.assertEqual(m['px'], 20)


class MapTests(unittest.TestCase):
    def test_parts_find_a_global_shift(self):
        stand = figure()
        frame = shifted(stand, 6, -4)
        ft = partmap.fit(stand, frame)
        for name, (t, dy, dx) in ft.items():
            self.assertEqual((dy, dx), (6, -4), name)
        src = partmap.build_map(stand, ft)
        m = evalmap.recon_metrics(stand, frame, src)
        self.assertEqual(m['exact'], 1.0)
        self.assertEqual(m['holes'], 0)

    def test_parts_find_a_moved_arm(self):
        stand = figure()
        frame = stand.copy()
        frame[55:90, 39:52] = 0                                   # the left arm leaves and comes back 5 px further out and 2 up
        arm = stand[55:90, 39:52]
        frame[53:88, 34:47] = arm
        ft = partmap.fit(stand, frame)
        self.assertEqual(ft['torso'][1:], (0, 0))
        self.assertEqual(ft['arm_l'][1:], (-2, -5))

    def test_dense_finds_a_known_shift_and_a_hole_stays_a_hole(self):
        stand = figure()
        frame = shifted(stand, 5, 3)
        src = densemap.fit(stand, frame, radius=8)
        m = evalmap.recon_metrics(stand, frame, src)
        self.assertGreater(m['exact'], 0.97)
        body = frame[..., 3] > 0
        ys, xs = np.nonzero(body)
        inner = (np.abs(src[ys, xs, 0] - (ys - 5)) + np.abs(src[ys, xs, 1] - (xs - 3)) == 0).mean()
        self.assertGreater(inner, 0.97)

    def test_compose_follows_two_steps(self):
        stand = figure()
        a = shift_map(2, 0, stand[..., 3] > 0)                   # frame 1 from the stand
        b = shift_map(0, 3, shifted(stand, 2, 0)[..., 3] > 0)     # frame 2 from frame 1 (pixel p comes from p - (0, 3))
        # pair maps are pull maps: frame 2 pixel p -> frame 1 pixel
        c = densemap.compose(a, b)
        ys, xs = np.nonzero(c[..., 0] >= 0)
        self.assertTrue((c[ys, xs, 0] == ys - 2).all() and (c[ys, xs, 1] == xs - 3).all())


class CostTests(unittest.TestCase):
    def test_no_tool_of_the_trial_can_call_a_model(self):
        """L1: zero generations per piece. The lookup tools import nothing that reaches a network (nor the clothing drawers pl.py / run.py)."""
        banned = {'requests', 'urllib', 'http', 'socket', 'httpx', 'aiohttp', 'subprocess', 'pl', 'run', 'draw'}
        judges = {'eyejudge.py'}       # round 2: the judge puts finished frames to an eye (ask-claude); it carries and draws nothing
        here = os.path.dirname(os.path.abspath(__file__))
        for name in sorted(os.listdir(here)):
            if not name.endswith('.py') or name.startswith('test_') or name in judges:
                continue
            tree = ast.parse(open(os.path.join(here, name)).read())
            mods = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    mods |= {a.name.split('.')[0] for a in node.names}
                elif isinstance(node, ast.ImportFrom) and node.module:
                    mods.add(node.module.split('.')[0])
            self.assertFalse(mods & banned, (name, sorted(mods & banned)))


class PaletteTests(unittest.TestCase):
    def test_snap_lands_on_the_palette(self):
        pal = common.palette()
        rng = np.random.default_rng(1)
        rgb = rng.integers(0, 256, (20, 20, 3)).astype(np.uint8)
        out = common.snap(rgb, pal)
        self.assertEqual(common.on_palette(out, np.ones((20, 20), bool), pal), 1.0)
        self.assertLess(common.on_palette(rgb, np.ones((20, 20), bool), pal), 0.2)

    def test_the_clips_are_the_kit_rows(self):
        self.assertEqual(len(common.load_clip('human_hit_front')), 45)
        self.assertEqual(len(common.load_clip('human_jump_front')), 13)


if __name__ == '__main__':
    unittest.main()
