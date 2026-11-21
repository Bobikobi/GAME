"""The hat as its own layer (head-wear sets: manifest key head_layer; trial of 21.11, accepted by the manager) for one set on one race (manager ruling 21.11): per view one hat drawing taken from a
passing frame, laid on every frame at its own head anchor; the body below the neck is the drawn frame (the best raw try).
Writes .scratch/clothing-sets/hat/<set>/<race>/<clip>/fN.png and report.json. No generations are spent.

  hat_trial.py --set core/reed-walker --race human   (sources per view from the manifest's head_layer, or --src front=idle-front/f0,...)
"""
import argparse
import glob
import json
import os
import re
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402
import hatlayer  # noqa: E402
import pack  # noqa: E402
import run  # noqa: E402


def L(p):
    return np.array(Image.open(p).convert('RGBA'))


def trial(set_id, race, src, ship=False):
    sdef, places, ramp = run.load_set(set_id)
    key = set_id.split('/')[1]
    K = f'{run.KEPT}/{race}'
    O = f'{run.WORK}/out/{key}/{race}'
    sprites = {}
    for name, s in src.items():
        # name: a view (front, back, left) for every clip of that view, or a clip (idle-left) that has its own hat drawing;
        # s: clip/frame, taken from the delivered frames, or clip/frame@sSEED taken from that seed's raw drawing
        ref, _, seed = s.partition('@')
        c, f = ref.split('/')
        view = run.view_of(c)
        if seed:
            drawn = run.deliver(L(f'{run.WORK}/raw/{key}/{race}/{c}-{f}-{seed}{"v" if run.uses_clauses(sdef, race) else ""}-0.png'))
        else:
            drawn = L(f'{O}/{c}/{f}.png')
        sprites[name] = hatlayer.extract(L(f'{K}/{c}/{f}.png'), drawn, view)
    outdir = f'{run.WORK}/hat/{key}/{race}'
    rep = []
    for clip in run.CLIPS:
        view = run.view_of(clip)
        os.makedirs(f'{outdir}/{clip}', exist_ok=True)
        cands = []
        shipped = pack.shipped_area(set_id, race, view) if ship else None
        for i in range(run.nframes(race, clip)):
            bare = L(f'{K}/{clip}/f{i}.png')
            cs = []
            for rp in sorted(glob.glob(f'{run.WORK}/raw/{key}/{race}/{clip}-f{i}-s*-0.png')):
                body = run.deliver(L(rp))
                comp, hm = hatlayer.compose(body, bare, sprites.get(clip, sprites[view]), view)
                d = run.finish(bare, comp, sdef, places, view)
                r = bars.frame_report(bare, d, places, ramp, view)
                v = run.verdict(r)
                bad = [k for k in v if not v[k]]
                cs.append(dict(raw=os.path.basename(rp), d=d, r=r, bad=bad, poke=hatlayer.poke_through(bare, hm), area=shipped(d, bare) if shipped else r['garment_area']))
            cands.append(cs)
        opts = [[c for c in cs if not c['bad']] for cs in cands]
        if all(opts):       # every frame has a passing try: the steadiest combination (S4, cyclic)
            pick = [o[i] for o, i in zip(opts, bars.best_combo([[c['area'] for c in o] for o in opts]))]
        else:               # otherwise each frame's best: passing first, then the fewest failing bars, then the smallest outside change
            pick = [min(cs, key=lambda c: (len(c['bad']), c['r']['S2']['share'])) for cs in cands]
        s4 = bars.s4([c['r']['garment_area'] for c in pick], cyclic=True)
        for i, c in enumerate(pick):
            r = c['r']
            Image.fromarray(c['d']).save(f'{outdir}/{clip}/f{i}.png')
            rep.append(dict(clip=clip, i=i, raw=c['raw'], bad=c['bad'], S1=r['S1']['height_diff'], S2_face=round(r['S2']['face_share'], 3),
                            S2_out=round(r['S2']['share'], 3), S2_aligned=round(r['S2']['aligned_share'], 3), S3=r['S3']['garment_px'],
                            S5=r['S5']['specks'], garment_area=r['garment_area'], poke=c['poke'], S4_clip=round(s4['max_change'], 3)))
    json.dump(rep, open(f'{outdir}/report.json', 'w'), indent=1)
    return rep


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', required=True)
    ap.add_argument('--race', default='human')
    ap.add_argument('--src', default='', help='view=clip/frame,... (default: the manifest set\'s head_layer)')
    ap.add_argument('--ship', action='store_true', help='choose the steadiest combination on the shipped sheet\'s garment area (pack.shipped_area)')
    a = ap.parse_args()
    sd = run.load_set(a.set)[0]
    src = dict(x.split('=') for x in a.src.split(',')) if a.src else sd.get('head_layer_by_race', {}).get(a.race, sd['head_layer'])
    rep = trial(a.set, a.race, src, a.ship)
    for r in rep:
        print(r['clip'], r['i'], r['raw'], r['bad'] or 'PASS', 'S1', r['S1'], 'S2f', r['S2_face'], 'o', r['S2_out'], 'al', r['S2_aligned'], 'S3', r['S3'], 'poke', r['poke'], 'S4', r['S4_clip'])
