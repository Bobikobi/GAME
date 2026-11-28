"""The lookup trial driver: maps for a clip by a method, pieces carried through them, the bars L1-L6 and the sheets.

  trial.py --clip human_jump_front --method parts|rot|dense|global [--pieces trousers,gloves,shirt] [--sheet OUT.png]

Maps are cached in the work folder (.scratch/clothing-lookup/work/maps/<clip>.<method>.npz) because dense maps take seconds a frame.
"""
import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import partmap  # noqa: E402
import densemap  # noqa: E402
import evalmap  # noqa: E402
import carry as carrymod  # noqa: E402

WORK = os.path.join(common.REPO, '.scratch', 'clothing-lookup', 'work')
STAND = ('human_hit_front', 0)


def stand_frame():
    return common.load_clip(STAND[0])[STAND[1]]


def make_maps(clip, method, stand, frames):
    """Maps for all frames and the seconds it took (no generations: it is arithmetic on the kit's own pictures)."""
    os.makedirs(os.path.join(WORK, 'maps'), exist_ok=True)
    path = os.path.join(WORK, 'maps', f'{clip}.{method}.npz')
    if os.path.exists(path):
        z = np.load(path)
        return z['maps'], float(z['seconds'])
    t0 = time.time()
    maps = []
    for f in frames:
        if method == 'dense':
            maps.append(densemap.fit(stand, f))
        elif method in ('chain', 'anchor', 'prefine', 'rrefine') or method.startswith('bi'):
            break
        elif method == 'global':
            ft = partmap.fit(stand, f)
            t = ft['torso']
            maps.append(partmap.build_map(stand, {n: t for n in ft}))
        else:
            ft = partmap.fit(stand, f, rotate=(method == 'rot'))
            maps.append(partmap.build_map(stand, ft))
    if method == 'chain':
        maps = densemap.chain(stand, frames)
    if method in ('prefine', 'rrefine'):
        maps = []
        for f in frames:
            ft = partmap.fit(stand, f, rotate=(method == 'rrefine'))
            maps.append(densemap.refine(stand, f, partmap.build_map(stand, ft), radius=4))
    if method.startswith('bi'):
        info = {}
        thr = float(method[2:]) / 100 if len(method) > 2 else 0.85        # bi70: frames the direct map rebuilds at 0.70 or better are anchors
        os.makedirs(os.path.join(WORK, 'maps', 'parts'), exist_ok=True)
        maps = densemap.chain_bi(stand, frames, anchor_exact=thr, report=info, cache=os.path.join(WORK, 'maps', 'parts', clip))
        print('anchors', info['anchors'], 'direct exact', [round(x, 2) for x in info['direct_exact']])
    if method == 'anchor':
        maps = densemap.chain_anchored(stand, frames)
    sec = time.time() - t0
    np.savez_compressed(path, maps=np.array(maps), seconds=sec)
    return np.array(maps), sec


def load_pieces(names):
    d = os.path.join(WORK, 'pieces')
    return {n: np.array(Image.open(os.path.join(d, n + '.png')).convert('RGBA')) for n in names}


def run(clip, method, names, max_use=None):
    stand = stand_frame()
    frames = common.load_clip(clip)
    maps, sec = make_maps(clip, method, stand, frames)
    pieces = load_pieces(names)
    rep = dict(clip=clip, method=method, seconds_per_clip=round(sec, 1), frames=len(frames), recon=[], pieces={})
    for i, f in enumerate(frames):
        rep['recon'].append(evalmap.recon_metrics(stand, f, maps[i]))
    layers = {}
    for n, p in pieces.items():
        rows, ls = [], []
        for i, f in enumerate(frames):
            layer, info = carrymod.carry(p, stand, maps[i], max_use)
            layer, info['specks'] = carrymod.despeckle(layer)
            m = carrymod.measure(f, layer, carrymod.limit_use(maps[i], max_use))
            m.update(info)
            rows.append(m)
            ls.append(layer)
        layers[n] = ls
        rep['pieces'][n] = rows
    return rep, layers, frames, stand


def summarize(rep):
    out = {}
    r = rep['recon']
    out['recon'] = {k: round(float(np.mean([x[k] for x in r])), 3) for k in ('iou', 'exact', 'holes', 'spill')}
    for n, rows in rep['pieces'].items():
        px = [x['px'] for x in rows]
        nz = [p for p in px if p > 0]
        out[n] = dict(
            L2_worst=round(max(x['outside_share'] for x in rows), 3),
            L3_worst=max(x['face_px'] for x in rows),
            L4=round(max(nz) / min(nz), 2) if nz else None,
            L5=min(x['on_palette'] for x in rows),
            L6_worst=max(x['holes_in_piece'] for x in rows),
            L6_worst_frame=int(np.argmax([x['holes_in_piece'] for x in rows])),
            px_min=min(px), px_max=max(px))
    return out


def sheet(layers, frames, names, path, crop=(24, 0, 104, 128), scale=4, cols=None, stacked_only=False):
    """A sheet at `scale`x, nearest: per line of `cols` frames the rows are bare, one row per piece, then all pieces stacked
    (`stacked_only`: bare and stacked). Each cell carries its frame number."""
    from PIL import ImageDraw
    x0, y0, x1, y1 = crop
    w, h = x1 - x0, y1 - y0
    cols = cols or len(frames)
    lines = (len(frames) + cols - 1) // cols
    rows = ['bare'] + ([] if stacked_only else list(names)) + ['stacked']
    im = Image.new('RGB', (cols * w * scale, lines * len(rows) * h * scale), (120, 160, 120))
    bg = (120, 160, 120, 255)
    d = ImageDraw.Draw(im)

    def paste(a, r, i):
        t = Image.fromarray(a).crop(crop)
        b = Image.new('RGBA', t.size, bg)
        b.alpha_composite(t)
        b = b.convert('RGB').resize((w * scale, h * scale), Image.NEAREST)
        x, y = (i % cols) * w * scale, ((i // cols) * len(rows) + r) * h * scale
        im.paste(b, (x, y))
        if r == 0:
            d.text((x + 3, y + 2), str(i), fill=(255, 255, 255))

    for i, f in enumerate(frames):
        paste(f, 0, i)
        st = f
        r = 1
        for n in names:
            one = carrymod.dress(f, layers[n][i])
            if not stacked_only:
                paste(one, r, i)
                r += 1
            st = carrymod.dress(st, layers[n][i])
        paste(st, len(rows) - 1, i)
    im.save(path)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--clip', default='human_jump_front')
    ap.add_argument('--method', default='parts')
    ap.add_argument('--pieces', default='trousers,gloves,shirt')
    ap.add_argument('--sheet')
    a = ap.parse_args()
    names = a.pieces.split(',')
    rep, layers, frames, stand = run(a.clip, a.method, names)
    print(json.dumps(summarize(rep), indent=1))
    if a.sheet:
        sheet(layers, frames, names, a.sheet, cols=15)


if __name__ == '__main__':
    main()
