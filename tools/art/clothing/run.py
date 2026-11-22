"""Dress the stand and walk frames of one race in one set: one edit per frame, the bars on every result, one retry with
another seed for a frame that fails, a frame that fails twice kept bare and listed (never forced).

  run.py --set core/reed-walker --race human [--clips idle-front,...] [--dry] [--jobs 4]

The set's description (constant over its frames: pixen takes no reference picture, so it is the only anchor for the
set's look) and the seeds come from sets.py. Raw outputs land in WORK/raw/<set>/<race>/ and are never deleted; delivered
frames in WORK/out/<set>/<race>/<clip>/fN.png; the verdicts in WORK/out/<set>/<race>/report.json.
"""
import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402
import draw  # noqa: E402
import pl  # noqa: E402

REPO = pl.REPO
WORK = os.environ.get('CLOTHING_WORK', os.path.join(REPO, '.scratch', 'clothing-sets'))
KEPT = os.path.expanduser(os.environ.get('CLOTHING_KEPT', '~/Projects/GAME.worktrees/art-elf-slim/.scratch/set'))
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'manifest.json')
CLIPS = ['idle-front', 'idle-back', 'idle-left', 'walk-front', 'walk-back', 'walk-left']
# the trial's A still (edit-images-v2, clothing-look 20.11), measured with bars.s2 on the same landmarks: face-box and outside shares
S2_FACE_MAX = 0.564
S2_OUT_MAX = 0.526
RAMP_MIN = 0.90
SEEDS = tuple(int(x) for x in os.environ.get('CLOTHING_SEEDS', '90,5,17,31').split(','))  # first try, the retry, and (manager ruling 21.11 for sets 1 and 3) two more seeds on a bare frame


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def load_set(set_id):
    m = json.load(open(MANIFEST))
    s = next(x for x in m['sets'] if x['id'] == set_id)
    places = [p for piece in s['pieces'] for p in piece['bars_places']]
    ramp = [hexrgb(h) for piece in s['pieces'] for h in piece['ramp'] + piece.get('accent_ramp', [])]
    return s, places, ramp


def ramps_of(s):
    main = [hexrgb(h) for piece in s['pieces'] for h in piece['ramp']]
    acc = [hexrgb(h) for piece in s['pieces'] for h in piece.get('accent_ramp', [])]
    return main, acc


def final_dir(sdef, race):
    """Where a set's delivered frames are: WORK/out/<set>/<race>, or for a head-wear set (manifest head_layer) the hat-layer result
    WORK/hat/<set>/<race> (the drawn body with the hat laid by code; see hat_trial.py)."""
    key = sdef['id'].split('/')[1]
    return os.path.join(WORK, 'hat' if sdef.get('head_layer') else 'out', key, race)


def nframes(race, clip):
    """Frames of a kept clip (4 for most; the skeleton's front and back walks are 16-frame takes)."""
    return len([f for f in os.listdir(os.path.join(KEPT, race, clip)) if re.fullmatch(r'f\d+\.png', f)])


def uses_clauses(sdef, race):
    """The view clauses (front/back/left wording) are a set's flag, or per race when the flag is a map."""
    v = sdef.get('use_view_clauses')
    return bool(v.get(race)) if isinstance(v, dict) else bool(v)


def describe(sdef, view, race='human'):
    """The set's description, with the view's clause when the set uses them (max 500 characters, the API's limit)."""
    m = json.load(open(MANIFEST))
    d = sdef.get('description_by_race', {}).get(race, sdef['description']) + (m['view_clauses'].get(view, '') if uses_clauses(sdef, race) else '')
    assert len(d) <= 500, (len(d), d)
    return d


def view_of(clip):
    return clip.split('-')[1]


def deliver(a):
    """The delivered form of a drawn frame: hard alpha, nothing under the figure's colour where it is clear. (The kit's palette
    snap and ink edge belong to the sheet step; the bars here and there measure the same pixels.)"""
    a = a.copy()
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a[a[..., 3] == 0] = 0
    return a


def verdict(rep):
    """Frame pass: S1, S2 (both shares under the trial's A-still noise), S3, S5, and the garment's colours on the ramp."""
    s2 = rep['S2']
    return {'S1': rep['S1']['ok'], 'S2': s2['face_share'] <= S2_FACE_MAX and s2['share'] <= S2_OUT_MAX and s2['aligned_share'] <= bars.S2_ALIGNED_MAX,
            'S3': rep['S3']['ok'], 'S5': rep['S5']['ok'], 'ramp': rep['ramp_share'] >= RAMP_MIN}


def measure(bare, raw, places, ramp, view):
    """The raw drawing against the bars; the delivered frame is this drawing with the garment put on the set's ramp."""
    d = deliver(raw)
    rep = bars.frame_report(bare, d, places, ramp, view)
    return d, rep, verdict(rep)


def finish(bare, raw, sdef, places, view):
    """The delivered frame: hard alpha, the garment's colours exactly on the set's ramp."""
    d = deliver(raw)
    main, acc = ramps_of(sdef)
    g = bars.garment_pixels(bare, d, bars.landmarks(bare, view), places)
    return bars.recolour(d, g, main, acc)


def dress_frame(args):
    sdef, places, ramp, race, clip, i, outdir, dry, allseeds = args
    desc = describe(sdef, view_of(clip), race)
    tag = 'v' if uses_clauses(sdef, race) else ''
    bare_path = os.path.join(KEPT, race, clip, f'f{i}.png')
    bare = np.array(Image.open(bare_path).convert('RGBA'))
    tries = []
    for n, seed in enumerate(SEEDS):
        label = f'{clip}-f{i}-s{seed}{tag}'
        raw_path = os.path.join(WORK, 'raw', sdef['id'].split('/')[1], race, f'{label}-0.png')
        if not os.path.exists(raw_path):
            if dry:
                tries.append(dict(seed=seed, missing=True))   # owed: the protocol's retry is not drawn yet
                break
            files = draw.edit(bare_path, desc, seed, label, os.path.dirname(raw_path))
            if not files:
                tries.append(dict(seed=seed, error='no picture'))
                continue
        raw = np.array(Image.open(raw_path).convert('RGBA'))
        d, rep, v = measure(bare, raw, places, ramp, view_of(clip))
        tries.append(dict(seed=seed, raw=raw_path, verdict=v, ok=all(v.values()), garment_area=rep['garment_area'], rep=rep))
        if all(v.values()) and not allseeds:
            break
    good = next((t for t in tries if t.get('ok')), None)
    owed = bool(tries) and bool(tries[-1].get('missing'))
    return dict(clip=clip, i=i, tries=tries, status='dressed' if good else ('owed' if owed else 'bare'), seed=good['seed'] if good else None)


def choose_combos(results):
    """Per clip, when every frame has a passing try, the combination of passing tries whose garment area changes least between
    neighbour frames (S4, cyclic): a frame's first passing try is kept unless another combination reads steadier. Sets each
    frame's `seed` to the chosen try's seed."""
    by = {}
    for r in results:
        by.setdefault(r['clip'], []).append(r)
    for clip, fr in by.items():
        fr.sort(key=lambda r: r['i'])
        opts = [[t for t in r['tries'] if t.get('ok')] for r in fr]
        if not all(opts):
            continue
        pick = bars.best_combo([[t['garment_area'] for t in o] for o in opts])
        for r, o, i in zip(fr, opts, pick):
            t = o[i]
            r['seed'] = t['seed']


def run(set_id, race, clips, jobs, dry, allseeds=()):
    sdef, places, ramp = load_set(set_id)
    key = set_id.split('/')[1]
    outdir = os.path.join(WORK, 'out', key, race)
    os.makedirs(outdir, exist_ok=True)
    tasks = [(sdef, places, ramp, race, c, i, outdir, dry, c in allseeds) for c in clips for i in range(nframes(race, c))]
    with ThreadPoolExecutor(jobs) as ex:
        results = list(ex.map(dress_frame, tasks))
    choose_combos(results)
    for r in results:
        cdir = os.path.join(outdir, r['clip'])
        os.makedirs(cdir, exist_ok=True)
        bare_path = os.path.join(KEPT, race, r['clip'], f'f{r["i"]}.png')
        if r['status'] == 'dressed':
            t = next(t for t in r['tries'] if t.get('ok') and t['seed'] == r['seed'])
            bare = np.array(Image.open(bare_path).convert('RGBA'))
            raw = np.array(Image.open(t['raw']).convert('RGBA'))
            Image.fromarray(finish(bare, raw, sdef, places, view_of(r['clip']))).save(os.path.join(cdir, f'f{r["i"]}.png'))
        elif r['status'] == 'bare':
            Image.open(bare_path).convert('RGBA').save(os.path.join(cdir, f'f{r["i"]}.png'))
    json.dump(results, open(os.path.join(outdir, 'report.json'), 'w'), indent=1, default=str)
    return results


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', required=True)
    ap.add_argument('--race', default='human')
    ap.add_argument('--clips', default=','.join(CLIPS))
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--allseeds', default='', help='clips drawn with every seed even when an earlier try passed (steadier combination)')
    a = ap.parse_args()
    res = run(a.set, a.race, a.clips.split(','), a.jobs, a.dry, tuple(x for x in a.allseeds.split(',') if x))
    for r in res:
        print(r['clip'], r['i'], r['status'], [(t['seed'], {k: v for k, v in t.get('verdict', {}).items() if not v} or ('missing' if t.get('missing') else '')) for t in r['tries']])
    print('spent so far', pl.spent_total())
