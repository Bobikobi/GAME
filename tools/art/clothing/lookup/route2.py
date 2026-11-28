"""Round 2 driver (public #952): every family's body maps, the same pieces carried the same way, the same bars, per clip.

  route2.py --family f1|f2|f3 --clips tune|held|<name,...> [--views front,left] [--sheet DIR]

Clips: the tuning pair (the kit's human_jump_front, human_hit_front) and the held-out human B sheets drawn on 28.11 by the
figure-moves lane (read only, never written), named <verb>-<view>. The stand frame of a view is frame 0 of chars/human_hit_<view>.
The pieces are the fitted ones (overhang.fit) of .scratch/clothing-lookup/r2/pieces/<view>/<piece>_fit.png. Keypoints (pose.py) are
cached per clip; they are the judge of L2a(ii) and L3 for every family, and the input of family 2.
"""
import argparse
import glob
import json
import os
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import parts  # noqa: E402
import overhang  # noqa: E402
import bars2  # noqa: E402
import bars  # noqa: E402

R2 = os.path.join(common.REPO, '.scratch', 'clothing-lookup', 'r2')
HELD = os.path.expanduser('~/Projects/GAME.worktrees/feat-figure-moves/.scratch/figure-moves/set-b/human')
TUNE = ['human_jump_front', 'human_hit_front']
HELD_VERBS = ['die', 'run', 'hit_heavy', 'down', 'hit_behind', 'sneak', 'idle', 'idle-v2', 'dig']
PIECES = ['cap', 'shirt', 'trousers', 'gloves', 'boots']


def held_clips(views=('front', 'left')):
    out = []
    for v in views:
        for verb in HELD_VERBS:
            out.append(f'idle-{v}-v2' if verb == 'idle-v2' else f'{verb}-{v}')
    return out


def view_of(clip):
    for v in ('front', 'left', 'back'):
        if f'_{v}' in clip or f'-{v}' in clip:
            return v
    return 'front'


def load_frames(clip):
    if clip.startswith('human_'):
        return common.load_clip(clip)
    fs = sorted(glob.glob(os.path.join(HELD, clip, 'f*.png')))
    return [np.array(Image.open(f).convert('RGBA')) for f in fs]


class Stand:
    """The stand frame of a view with what every family and bar needs: keypoints, part labels, distances, face box, fitted pieces."""

    def __init__(self, view):
        self.view = view
        self.frame = common.load_clip('human_hit_' + view)[0]
        self.body = self.frame[..., 3] > 0
        kp = json.load(open(os.path.join(R2, 'stand_kp.json')))[view]
        self.kp = np.array(kp['kp'])
        self.lab = parts.label(self.body, self.kp)
        self.dist = parts.edt(self.body)
        self.face = bars.landmarks(self.frame, view)['face']
        self.pieces, self.an = {}, {}
        for n in PIECES:
            p = os.path.join(R2, 'pieces', view, n + '_fit.png')
            if os.path.exists(p):
                a = np.array(Image.open(p).convert('RGBA'))
                self.pieces[n] = a
                self.an[n] = overhang.analyse(a[..., 3] > 0, self.body, self.lab, n, self.dist)


def prep(view):
    """Fit the cut pieces of a view to B's parts on its stand frame (overhang.fit): r2/pieces/<view>/<piece>.png -> <piece>_fit.png,
    and the before/after numbers in r2/fit_<view>.json."""
    st = Stand(view)
    rep = {}
    for n in PIECES:
        p = os.path.join(R2, 'pieces', view, n + '.png')
        if not os.path.exists(p):
            continue
        a = np.array(Image.open(p).convert('RGBA'))
        out, moves, b, af = overhang.fit(a, st.body, st.lab, n, face=st.face)
        common.save_rgba(out, os.path.join(R2, 'pieces', view, n + '_fit.png'))
        rep[n] = dict(moves=moves, before={k: v for k, v in b.items() if k != 'misfit_mask'}, after={k: v for k, v in af.items() if k != 'misfit_mask'})
        print(view, n, moves, 'misfit', b['misfit'], '->', af['misfit'], 'coverage', b['coverage'], '->', af['coverage'], 'band', af['band'])
    json.dump(rep, open(os.path.join(R2, f'fit_{view}.json'), 'w'), indent=1)


def keypoints(clip, frames):
    """Keypoints of every frame (cached in r2/kp/<clip>.json)."""
    os.makedirs(os.path.join(R2, 'kp'), exist_ok=True)
    path = os.path.join(R2, 'kp', clip + '.json')
    if os.path.exists(path):
        d = json.load(open(path))
        return np.array(d['kp']), np.array(d['sc'])
    import pose
    kps, scs = [], []
    for f in frames:
        k, s = pose.estimate(f)
        kps.append(k.tolist())
        scs.append(s.tolist())
    json.dump(dict(kp=kps, sc=scs), open(path, 'w'))
    return np.array(kps), np.array(scs)


def maps_for(family, clip, stand, frames, kps):
    """A family's maps for a clip (cached in r2/maps/<family>/<clip>.npz) and the seconds they took."""
    d = os.path.join(R2, 'maps', family)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, clip + '.npz')
    if os.path.exists(path):
        z = np.load(path)
        return z['maps'], float(z['seconds'])
    t0 = time.time()
    if family.startswith('f1'):
        import densemap
        thr = 0.70
        cache = os.path.join(d, 'parts')
        os.makedirs(cache, exist_ok=True)
        fitfn = None
        if family == 'f1b':
            # tuning round: a candidate must join parts that are the same or neighbours (pose labels on both frames)
            labs = {id(stand.frame): stand.lab}
            for f, k in zip(frames, kps):
                labs[id(f)] = parts.label(f[..., 3] > 0, np.array(k))
            allowed = np.array([[parts.neighbours(a, b) for b in parts.NAMES] for a in parts.NAMES], bool)
            fitfn = lambda a, b, r: densemap.fit(a, b, radius=r, labels=(labs[id(a)], labs[id(b)], allowed))
        maps = densemap.chain_bi(stand.frame, frames, anchor_exact=thr, cache=os.path.join(cache, clip), fitfn=fitfn)
    elif family.startswith('f2'):
        import posemap
        kw = dict(stretch=(0.25, 1.6), gate=3.0, patch=3) if family == 'f2b' else {}
        maps = [posemap.fit(stand, f, k, head_only=bars2.face_box_on(k, stand.kp, stand.face) if family == 'f2b' else None, **kw)
                for f, k in zip(frames, kps)]
    elif family.startswith('f3'):
        import flowmap
        maps = flowmap.clip_maps(stand, frames, variant=family)
    else:
        raise SystemExit('unknown family ' + family)
    sec = time.time() - t0
    np.savez_compressed(path, maps=np.array(maps), seconds=sec)
    return np.array(maps), sec


def run_clip(family, clip, stands, pieces=PIECES):
    view = view_of(clip)
    st = stands[view]
    frames = load_frames(clip)
    kps, scs = keypoints(clip, frames)
    maps, sec = maps_for(family, clip, st, frames, kps)
    pal = common.palette()
    rep = dict(family=family, clip=clip, view=view, frames=len(frames), map_seconds=round(sec, 1), pieces={}, layers={})
    t0 = time.time()
    for n in pieces:
        if n not in st.pieces:
            continue
        rows, layers = [], []
        for i, f in enumerate(frames):
            layer, lsrc, dropped = bars2.carry(st.pieces[n], st.frame, maps[i], st.lab, f[..., 3] > 0)
            r = bars2.frame_bars(f, layer, lsrc, maps[i], st.frame, st.lab, st.dist, kps[i], st.kp, st.face, n, st.an[n], pal, dropped)
            rows.append(r)
            layers.append(layer)
        v = bars2.verdicts(rows, st.an[n]['misfit'])
        for r, x in zip(rows, v):
            r.update(x)
        rep['pieces'][n] = rows
        rep['layers'][n] = layers
    rep['carry_seconds'] = round(time.time() - t0, 1)
    rep['exact'] = [bars2.recon(st.frame, f, maps[i])['exact'] for i, f in enumerate(frames)]
    return rep, frames


def summary(rep):
    out = dict(clip=rep['clip'], family=rep['family'], frames=rep['frames'], map_seconds=rep['map_seconds'],
               exact_mean=round(float(np.mean(rep['exact'])), 3))
    for n, rows in rep['pieces'].items():
        out[n] = {b: round(float(np.mean([r[b] for r in rows])), 3) for b in ('L2a', 'L2b', 'L3', 'L4', 'all')}
        out[n]['fail_frames'] = [i for i, r in enumerate(rows) if not r['all']]
    allp = [all(rep['pieces'][n][i]['all'] for n in rep['pieces']) for i in range(rep['frames'])]
    out['outfit_all'] = round(float(np.mean(allp)), 3)
    return out


def sheet(rep, frames, path, scale=4, crop=(16, 8, 112, 128), cols=None, names=None):
    """Rows: bare, then the whole outfit stacked; each cell numbered. 4x nearest."""
    from PIL import ImageDraw
    names = names or list(rep['pieces'])
    x0, y0, x1, y1 = crop
    w, h = x1 - x0, y1 - y0
    n = len(frames)
    cols = cols or min(n, 13)
    lines = (n + cols - 1) // cols
    im = Image.new('RGB', (cols * w * scale, lines * 2 * h * scale), (120, 160, 120))
    d = ImageDraw.Draw(im)
    for i, f in enumerate(frames):
        dressed = f.copy()
        for nm in names:
            L = rep['layers'][nm][i]
            m = L[..., 3] > 0
            dressed[m] = L[m]
        for r, a in enumerate((f, dressed)):
            t = Image.fromarray(a).crop(crop)
            b = Image.new('RGBA', t.size, (120, 160, 120, 255))
            b.alpha_composite(t)
            b = b.convert('RGB').resize((w * scale, h * scale), Image.NEAREST)
            x, y = (i % cols) * w * scale, ((i // cols) * 2 + r) * h * scale
            im.paste(b, (x, y))
            if r == 0:
                d.text((x + 3, y + 2), str(i), fill=(255, 255, 255))
            else:
                bad = [nm for nm in names if not rep['pieces'][nm][i]['all']]
                if bad:
                    d.text((x + 3, y + 2), ' '.join(b_[:2] for b_ in bad), fill=(255, 60, 60))
    im.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--family')
    ap.add_argument('--prep', help='fit the pieces of a view and stop')
    ap.add_argument('--clips', default='tune')
    ap.add_argument('--views', default='front,left')
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--tag', default='')
    a = ap.parse_args()
    if a.prep:
        return prep(a.prep)
    views = a.views.split(',')
    clips = TUNE if a.clips == 'tune' else held_clips(views) if a.clips == 'held' else a.clips.split(',')
    stands = {v: Stand(v) for v in set(view_of(c) for c in clips)}
    outdir = os.path.join(R2, 'res', a.family + a.tag)
    os.makedirs(outdir, exist_ok=True)
    for c in clips:
        rep, frames = run_clip(a.family, c, stands)
        s = summary(rep)
        print(json.dumps(s), flush=True)
        keep = {k: v for k, v in rep.items() if k != 'layers'}
        json.dump(keep, open(os.path.join(outdir, c + '.json'), 'w'))
        np.savez_compressed(os.path.join(outdir, c + '.layers.npz'), **{n: np.array(v) for n, v in rep['layers'].items()})
        if a.sheet:
            sheet(rep, frames, os.path.join(outdir, c + '_4x.png'))
    print('ROUTE2_DONE', a.family, a.clips, flush=True)


if __name__ == '__main__':
    main()
