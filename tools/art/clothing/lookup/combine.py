"""A derived family of round 2 (public #952): pieces of one family's run taken from another's, per piece, no new map.

f2c = f2b's maps for shirt, trousers, gloves, boots (the face box looks up the head only, so no shirt over the face) and f2's map for the
cap (f2b's head-only lookup shrinks the cap by 40% on every frame: the new L4 shows it, the clip-median L4 hid it). The choice is made on the TUNE
clips only; the held-out clips are carried without any further choice. Python 3 with numpy only."""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import route2  # noqa: E402

SPEC = {'cap': 'f2', 'shirt': 'f2b', 'trousers': 'f2b', 'gloves': 'f2b', 'boots': 'f2b'}


def combine(name, spec, clip):
    res = os.path.join(route2.R2, 'res')
    reps = {f: json.load(open(os.path.join(res, f, clip + '.json'))) for f in set(spec.values())}
    lays = {f: np.load(os.path.join(res, f, clip + '.layers.npz')) for f in reps}
    base = reps[spec['cap']]
    rep = {k: v for k, v in base.items() if k != 'pieces'}
    rep['family'] = name
    rep['pieces'] = {p: reps[f]['pieces'][p] for p, f in spec.items()}
    out = os.path.join(res, name)
    os.makedirs(out, exist_ok=True)
    json.dump(rep, open(os.path.join(out, clip + '.json'), 'w'))
    np.savez_compressed(os.path.join(out, clip + '.layers.npz'), **{p: lays[f][p] for p, f in spec.items()})
    return rep


if __name__ == '__main__':
    for c in route2.TUNE + route2.held_clips(('front',)):
        r = combine('f2c', SPEC, c)
        print(c, route2.summary(r)['outfit_all'])
