"""Route (a) for a work clip: the one-generation edit on each frame of a 45-frame clip, the set's own description and the bars on
every result (one retry with another seed, a second failure kept bare and listed).

  pilot.py --frames DIR --set core/hardened-leathers --view left --tag fell-left-a [--jobs 4] [--dry]

Frames are DIR/f00.png.. (128 px, the clip's own bare drawings). Raw pictures go to WORK/raw/pilot-<tag>/, delivered frames and
report.json to WORK/pilot/<tag>/.
"""
import argparse
import glob
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402
import draw  # noqa: E402
import pl  # noqa: E402
import run  # noqa: E402


def one(args):
    sdef, places, ramp, desc, view, path, tag, dry = args
    name = os.path.splitext(os.path.basename(path))[0]
    bare = np.array(Image.open(path).convert('RGBA'))
    tries = []
    for seed in run.SEEDS[:2]:
        label = f'{name}-s{seed}'
        raw_path = os.path.join(run.WORK, 'raw', f'pilot-{tag}', f'{label}-0.png')
        if not os.path.exists(raw_path):
            if dry:
                tries.append(dict(seed=seed, missing=True))
                break
            if not draw.edit(path, desc, seed, label, os.path.dirname(raw_path)):
                tries.append(dict(seed=seed, error='no picture'))
                continue
        raw = np.array(Image.open(raw_path).convert('RGBA'))
        d, rep, v = run.measure(bare, raw, places, ramp, view)
        tries.append(dict(seed=seed, raw=raw_path, verdict=v, ok=all(v.values()), garment_area=rep['garment_area'], rep=rep))
        if all(v.values()):
            break
    good = next((t for t in tries if t.get('ok')), None)
    return dict(frame=name, tries=tries, status='dressed' if good else 'bare', seed=good['seed'] if good else None, bare_path=path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', required=True)
    ap.add_argument('--set', required=True)
    ap.add_argument('--view', required=True)
    ap.add_argument('--tag', required=True)
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    sdef, places, ramp = run.load_set(a.set)
    desc = run.describe(sdef, a.view)
    paths = sorted(glob.glob(os.path.join(a.frames, 'f*.png')))
    with ThreadPoolExecutor(a.jobs) as ex:
        res = list(ex.map(one, [(sdef, places, ramp, desc, a.view, p, a.tag, a.dry) for p in paths]))
    out = os.path.join(run.WORK, 'pilot', a.tag)
    os.makedirs(out, exist_ok=True)
    for r in res:
        bare = np.array(Image.open(r['bare_path']).convert('RGBA'))
        if r['status'] == 'dressed':
            t = next(t for t in r['tries'] if t.get('ok'))
            Image.fromarray(run.finish(bare, np.array(Image.open(t['raw']).convert('RGBA')), sdef, places, a.view)).save(f'{out}/{r["frame"]}.png')
        elif r['status'] == 'bare':
            Image.fromarray(bare).save(f'{out}/{r["frame"]}.png')
    json.dump(res, open(f'{out}/report.json', 'w'), indent=1, default=str)
    areas = [next((t['garment_area'] for t in r['tries'] if t.get('ok')), 0) for r in res]
    print('frames', len(res), 'dressed', sum(r['status'] == 'dressed' for r in res), 'bare', [r['frame'] for r in res if r['status'] == 'bare'])
    print('S4 over the clip (cyclic)', bars.s4(areas, cyclic=True), 'spent so far', pl.spent_total())
