"""Family 2 of the clothing route (public #952, round 2): a body pose read from the picture.

The pixminimax clips carry no skeleton data, so the pose comes from the frame itself: an open keypoint model (RTMPose-x, body7,
Halpe 26 points, ONNX, Apache-2.0, run on the CPU by onnxruntime) on the frame scaled up by a whole step (nearest, so no pixel is
invented), with the figure's own box as the person box (no detector). Optional dependency: onnxruntime, opencv and rtmlib live in a
project-local venv (.scratch/clothing-lookup/venv); the rest of the lookup tools run without them.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

F = common.FRAME
MODELS = os.path.join(common.REPO, '.scratch', 'clothing-lookup', 'models')
MODEL = {
    'x': 'rtmpose-x_simcc-body7_pt-body7-halpe26_700e-384x288-7fb6e239_20230606',
    'm': 'rtmpose-m_simcc-body7_pt-body7-halpe26_700e-256x192-4d3e73dd_20230605',
}
SIZE = {'x': (288, 384), 'm': (192, 256)}
# Halpe 26: 0 nose 1 l_eye 2 r_eye 3 l_ear 4 r_ear 5 l_sh 6 r_sh 7 l_elb 8 r_elb 9 l_wri 10 r_wri 11 l_hip 12 r_hip 13 l_knee
# 14 r_knee 15 l_ank 16 r_ank 17 head 18 neck 19 hip 20 l_bigtoe 21 r_bigtoe 22 l_smalltoe 23 r_smalltoe 24 l_heel 25 r_heel
NAMES = ['nose', 'l_eye', 'r_eye', 'l_ear', 'r_ear', 'l_sh', 'r_sh', 'l_elb', 'r_elb', 'l_wri', 'r_wri', 'l_hip', 'r_hip', 'l_knee',
         'r_knee', 'l_ank', 'r_ank', 'head', 'neck', 'hip', 'l_btoe', 'r_btoe', 'l_stoe', 'r_stoe', 'l_heel', 'r_heel']
BG = (128, 128, 128)
UP = 3
PAD = 40            # frame px of margin round the figure: with a tight box a squat collapses (scores 0.36-0.5 at 6 px, 0.94-0.98 at 40)

_cache = {}


def model(kind='x'):
    if kind not in _cache:
        from rtmlib import RTMPose
        name = MODEL[kind]
        path = os.path.join(MODELS, name, '20230831', 'rtmpose_onnx', name, 'end2end.onnx')
        _cache[kind] = RTMPose(path, model_input_size=SIZE[kind], backend='onnxruntime', device='cpu')
    return _cache[kind]


def upscaled(frame, up=UP, bg=BG):
    """The frame on a flat background, scaled up `up` times by nearest neighbour, as a BGR uint8 image (opencv order)."""
    a = frame[..., 3:4].astype(float) / 255
    rgb = frame[..., :3] * a + np.array(bg) * (1 - a)
    big = np.repeat(np.repeat(rgb.astype(np.uint8), up, 0), up, 1)
    return np.ascontiguousarray(big[..., ::-1])


def estimate(frame, kind='x', up=UP, pad=PAD):
    """Keypoints of the figure in frame coordinates (26 x 2 float) and their scores (26), from the model on the upscaled frame."""
    ys, xs = np.nonzero(frame[..., 3] > 0)
    box = np.array([[max(0, xs.min() - pad) * up, max(0, ys.min() - pad) * up, min(F, xs.max() + 1 + pad) * up, min(F, ys.max() + 1 + pad) * up]])
    kp, sc = model(kind)(upscaled(frame, up), bboxes=box)
    return kp[0] / up - 0.5 + 0.5 / up, sc[0]
