"""A dressed set -> kit sheets and kit rows: one sheet per race, set and view (the kit's stride sheet: the walk's poses in order and,
last, the standing pose), shown at the height of the race's live walk.

  pack.py --set core/reed-walker --race human [--write] [--write-kit]

Why a bake: the drawn frames are 96 rows tall (100 for the elf), the live walk's standing figure is 67-71 (human), 79-84 (elf), 54
(skeleton). `fit_permille` lives in a clip block and clips are fight and work verbs, so a stand/walk sheet cannot carry it: the
reduction is made here, once, by the one pipeline the stills use (compose.py: box filter on premultiplied alpha, hard alpha), by one
factor per race and view taken from the bare standing frame and the live walk's last frame, so every frame of the sheet moves by
the same transform and the feet land on the walk's feet row, the middle on the walk's middle. Then what the kit asks of a sprite
(the importer's part, done here on the pixels as they are): hard alpha, pockets of see-through of at most 24 px filled, each solid
pixel on the nearest colour (CIELAB) of the core palette and the ramps the sheet names, the one-pixel ink edge #1b1a2e.

The bars are measured again on the shipped frames, against the bare frame put through the same transform (pack report). A sheet's
travel per pose keeps the race's live cycle length over our fewer poses. Python 3 with numpy and Pillow only.
"""
import argparse
import json
import os
import re
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402
import pl  # noqa: E402
import run  # noqa: E402

REPO = pl.REPO
KIT = os.path.join(REPO, 'content', 'kit', 'core')
PALETTE_SRC = os.path.join(REPO, 'tools', 'src', 'kit', 'palette.ts')
FRAME = 128
MAX_FRAMES = 16          # the kit schema's maximum frames of a sheet
DENSITY = 4
INK = (0x1b, 0x1a, 0x2e)
SPECK_MAX = 24
VIEWS = {'front': 'down', 'back': 'up', 'left': 'left'}
# the shared ramps a set's sheet may need besides its race's walk ramps (a sprite names at most four)
SET_RAMPS = {'core/reed-walker': ['red'], 'core/digger-leathers': ['bark'], 'core/hardened-leathers': ['bark']}


def box(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


def reduce_frame(a, f):
    """A 128 px RGBA frame reduced by f: box filter on premultiplied alpha, hard alpha (> 127). The frame is square."""
    a = np.asarray(a, dtype=np.float64)
    n = round(a.shape[0] * f)
    pre = a.copy()
    pre[..., :3] *= a[..., 3:4] / 255.0
    ch = [np.asarray(Image.fromarray(pre[..., c].astype(np.float32), 'F').resize((n, n), Image.BOX)) for c in range(4)]
    out = np.stack(ch, -1)
    al = out[..., 3]
    rgb = np.clip(np.where(al[..., None] > 0, out[..., :3] / np.maximum(al[..., None], 1e-6) * 255.0, 0), 0, 255)
    res = np.zeros((n, n, 4), np.uint8)
    res[..., :3] = rgb.round().astype(np.uint8)
    res[..., 3] = np.where(al > 127, 255, 0)
    res[res[..., 3] == 0] = 0
    return res


def paste(small, ox, oy):
    """The reduced frame on a 128 px canvas, its top-left at (ox, oy); what falls outside is cut."""
    out = np.zeros((FRAME, FRAME, 4), np.uint8)
    n = small.shape[0]
    x0, y0 = max(ox, 0), max(oy, 0)
    x1, y1 = min(ox + n, FRAME), min(oy + n, FRAME)
    if x1 > x0 and y1 > y0:
        out[y0:y1, x0:x1] = small[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return out


def plan(stand, target):
    """(factor, ox, oy) that put the bare standing frame on the walk's standing height, feet row and middle."""
    x0, x1, y0, y1 = box(stand)
    f = target['h'] / (y1 - y0 + 1)
    small = reduce_frame(stand, f)
    sx0, sx1, sy0, sy1 = box(small)
    return f, round(target['mid'] - (sx0 + sx1) / 2), target['low'] - sy1


def bake(frame, f, ox, oy):
    return paste(reduce_frame(frame, f), ox, oy)


def lab(rgb):
    c = np.asarray(rgb, dtype=np.float64).reshape(-1, 3) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]]) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def palette_of(ramps):
    """The core palette of the kit and the steps of the named shared ramps (tools/src/kit/palette.ts CORE_RAMPS), as an array."""
    kit = json.load(open(os.path.join(KIT, 'kit.json')))['kit']
    hexes = list(kit['palette'])
    src = open(PALETTE_SRC).read()
    found = set()
    for rid, steps in re.findall(r"\{ id: '(\w+)', for: '\w+', steps: \[([^\]]*)\] \}", src):
        if rid in ramps:
            found.add(rid)
            hexes += re.findall(r'#[0-9a-fA-F]{6}', steps)
    missing = set(ramps) - found
    if missing:
        raise SystemExit(f'not shared ramps: {sorted(missing)}')
    return np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in dict.fromkeys(x.lower() for x in hexes)], dtype=np.uint8)


def fill_specks(a):
    """Enclosed see-through pockets of at most SPECK_MAX px (8-connected, the frame's border is outside) take the nearest solid colour.
    The kit's own rule (the clips packer), kept the same."""
    h, w = a.shape[:2]
    clear = a[..., 3] < 128
    seen = np.zeros((h, w), bool)
    stack = [(y, x) for y in range(h) for x in range(w) if clear[y, x] and (y in (0, h - 1) or x in (0, w - 1))]
    for y, x in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for ny in range(max(0, y - 1), min(h, y + 2)):
            for nx in range(max(0, x - 1), min(w, x + 2)):
                if clear[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
    out = a.copy()
    left = set(zip(*np.nonzero(clear & ~seen)))
    while left:
        grown = {}
        for y, x in sorted(left):
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and out[ny, nx, 3] >= 128:
                    grown[(y, x)] = out[ny, nx].copy()
                    break
        if not grown:
            break
        for (y, x), c in grown.items():
            out[y, x] = c
            out[y, x, 3] = 255
        left -= set(grown)
    return out


def kit_frame(a, pal):
    """One frame as the kit holds a sprite: hard alpha, no specks, kit colours, the ink edge."""
    a = a.copy()
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a[a[..., 3] == 0] = 0
    a = fill_specks(a)
    m = a[..., 3] == 255
    px = lab(a[..., :3][m])
    d = ((px[:, None] - lab(pal)[None]) ** 2).sum(-1)
    a[..., :3][m] = pal[d.argmin(1)]
    pad = np.pad(m, 1)
    edge = m & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    a[edge, :3] = INK
    return a


def strip(walk_frames, standing):
    """The walk's poses in order and, last, the standing pose, side by side (the bytes fixed by the pixels alone)."""
    return np.concatenate(list(walk_frames) + [standing], axis=1)


def sheet_row(file, frames, walk, extra_ramps, poses):
    """The kit row of a sheet: the race's walk (anchor, ramps, scale) with our poses. The code bob is off, the drawn frames carry their own
    head travel; `travel_mpx` keeps the race's live cycle (its poses x its travel) over our fewer poses, so a planted foot stays near the ground."""
    ramps = list(walk['ramps'])
    for r in extra_ramps:
        if r not in ramps:
            ramps.append(r)
    if len(ramps) > 4:
        raise SystemExit(f'a sprite names at most four ramps: {ramps}')
    row = {'file': file, 'w': FRAME, 'h': FRAME, 'frames': frames, 'density': DENSITY, 'ramps': ramps,
           'stride': {'travel_mpx': round(walk['travel_mpx'] * walk['poses'] / poses), 'anchor': list(walk['anchor']), 'bob': False}}
    if walk.get('scale') is not None:
        row['scale'] = walk['scale']
    return row


def walk_of(race, view):
    """The live walk of a race and view: its standing frame (the last) and the sheet's own numbers."""
    k = json.load(open(os.path.join(KIT, 'kit.json')))['kit']['sprites'][f'chars/{race}_{VIEWS[view]}']
    sheet = np.array(Image.open(os.path.join(KIT, k['file'])).convert('RGBA'))
    n = sheet.shape[1] // k['w']
    x0, x1, y0, y1 = box(sheet[:, (n - 1) * k['w']:n * k['w']])
    return dict(h=y1 - y0 + 1, low=y1, mid=(x0 + x1) / 2, travel_mpx=k['stride']['travel_mpx'], poses=k['frames'] - 1, anchor=k['stride']['anchor'],
                ramps=k.get('ramps', []), scale=k.get('scale'))


def load(p):
    return np.array(Image.open(p).convert('RGBA'))


def save_png(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr, 'RGBA').save(path, format='PNG', optimize=True)


def walk_poses(n):
    """How many of a clip's poses a sheet keeps: the standing pose takes one of the kit's MAX_FRAMES places, so a longer walk drops its last pose."""
    return min(n, MAX_FRAMES - 1)


def shipped_area(set_id, race, view):
    """A function (dressed 128 frame, bare 128 frame) -> the garment's area as the shipped sheet frame measures it (after the reduction, the
    palette and the ink edge). The steadiest combination of tries for the packed sheet is chosen on these numbers (hat_trial.py --ship)."""
    sdef, places, ramp = run.load_set(set_id)
    walk = walk_of(race, view)
    f, ox, oy = plan(load(f'{run.KEPT}/{race}/idle-{view}/f0.png'), walk)
    row_ramps = list(walk['ramps'])
    for r in SET_RAMPS.get(set_id, []):
        if r not in row_ramps:
            row_ramps.append(r)
    pal = palette_of(row_ramps)

    def area(d, b):
        return bars.frame_report(kit_frame(bake(b, f, ox, oy), pal), kit_frame(bake(d, f, ox, oy), pal), places, ramp, view)['garment_area']
    return area


def pack_set(set_id, race, write=False):
    sdef, places, ramp = run.load_set(set_id)
    key = set_id.split('/')[1]
    final = run.final_dir(sdef, race)
    rows, report, total = {}, {}, 0
    for view, vname in VIEWS.items():
        walk = walk_of(race, view)
        bare_stand = load(f'{run.KEPT}/{race}/idle-{view}/f0.png')
        f, ox, oy = plan(bare_stand, walk)
        extra = SET_RAMPS.get(set_id, [])
        row_ramps = list(walk['ramps'])
        for r in extra:
            if r not in row_ramps:
                row_ramps.append(r)
        pal = palette_of(row_ramps)
        clip_names = [f'walk-{view}', f'idle-{view}']
        n_walk = walk_poses(run.nframes(race, clip_names[0]))
        sources = [(clip_names[0], i) for i in range(n_walk)] + [(clip_names[1], 0)]
        dressed, barefs, vr = [], [], []
        for c, i in sources:
            d = load(f'{final}/{c}/f{i}.png')
            b = load(f'{run.KEPT}/{race}/{c}/f{i}.png')
            dressed.append(kit_frame(bake(d, f, ox, oy), pal))
            barefs.append(kit_frame(bake(b, f, ox, oy), pal))
        for (c, i), d, b in zip(sources, dressed, barefs):
            rep = bars.frame_report(b, d, places, ramp, view)
            vr.append(dict(frame=f'{c}/f{i}', S1=rep['S1'], S2={k: rep['S2'][k] for k in ('face_share', 'share', 'aligned_share')}, S3=rep['S3'], S5=rep['S5'], garment_area=rep['garment_area']))
        sheet = strip(dressed[:-1], dressed[-1])
        name = f'chars/{race}_{key}_{vname}'
        row = sheet_row(f'{name}.png', len(dressed), walk, extra, n_walk)
        rows[name] = row
        path = os.path.join(KIT, f'{name}.png')
        if write:
            save_png(sheet, path)
            total += os.path.getsize(path)
        report[view] = dict(factor=round(f, 4), ox=ox, oy=oy, target=dict(h=walk['h'], low=walk['low'], mid=walk['mid']), frames=vr,
                            S4=bars.s4([v['garment_area'] for v in vr[:-1]], cyclic=True))
    return rows, report, total


def write_kit(rows):
    path = os.path.join(KIT, 'kit.json')
    data = json.load(open(path))
    sprites = data['kit']['sprites']
    for k, v in rows.items():
        sprites.pop(k, None)
        sprites[k] = v
    with open(path, 'w') as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', required=True)
    ap.add_argument('--race', required=True)
    ap.add_argument('--write', action='store_true', help='write the sheets under content/kit/core/chars')
    ap.add_argument('--write-kit', action='store_true', help='put the rows into content/kit/core/kit.json (they go last in sprites)')
    a = ap.parse_args()
    rows, report, total = pack_set(a.set, a.race, a.write)
    out = os.path.join(run.WORK, 'pack', a.set.split('/')[1], a.race)
    os.makedirs(out, exist_ok=True)
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), indent=1, default=str)
    if a.write_kit:
        write_kit(rows)
    for v, r in report.items():
        worst = lambda k: max((x[k]['height_diff'] if k == 'S1' else 0) for x in r['frames'])
        print(v, 'factor', r['factor'], 'offset', r['ox'], r['oy'], 'target', r['target'], 'S4', r['S4'],
              'S1 worst', max(max(x['S1']['height_diff'], x['S1']['feet_row_diff']) for x in r['frames']),
              'S3 worst', max(x['S3'].get('garment_px', 0) for x in r['frames']),
              'S5 bad', sum(not x['S5']['ok'] for x in r['frames']),
              'S2 aligned worst', round(max(x['S2']['aligned_share'] for x in r['frames']), 3))
    print('rows', list(rows), 'bytes written', total)
