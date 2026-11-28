"""The lookup trial's bar table (L1-L6) for the final method, as markdown.

  report.py [--method bi70] [--out FILE]

Numbers come from trial.run on the kit's own clips; the stand frame's own measures (the piece laid on the stand frame by the identity
map) are printed beside them, because a piece that overhangs the body outline or touches the face box already on the stand frame
fails L2 or L3 before any map is made. Python 3 with numpy and Pillow only.
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import carry as carrymod  # noqa: E402
import common  # noqa: E402
import trial  # noqa: E402

CLIPS = ['human_jump_front', 'human_hit_front']
PIECES = ['trousers', 'gloves', 'shirt']
L2_MAX, L3_MAX, L4_MAX = 0.03, 3, 1.25


def stand_floor(stand, piece):
    """The piece on the stand frame itself, through the identity map."""
    src = np.full((common.FRAME, common.FRAME, 2), -1, int)
    ys, xs = np.nonzero(stand[..., 3] > 0)
    src[ys, xs] = np.stack([ys, xs], -1)
    layer, _ = carrymod.carry(piece, stand, src)
    m = carrymod.measure(stand, layer, src)
    return m


def pf(ok):
    return 'PASS' if ok else 'FAIL'


def build(method):
    stand = trial.stand_frame()
    pieces = trial.load_pieces(PIECES)
    floors = {n: stand_floor(stand, p) for n, p in pieces.items()}
    lines = []
    results = {}
    for clip in CLIPS:
        rep, layers, frames, _ = trial.run(clip, method, PIECES)
        r = rep['recon']
        results[clip] = dict(recon=dict(exact=float(np.mean([x['exact'] for x in r])), iou=float(np.mean([x['iou'] for x in r])),
                                        holes=float(np.mean([x['holes'] for x in r]))), pieces={})
        for n in PIECES:
            rows = rep['pieces'][n]
            px = [x['px'] for x in rows]
            ratio = max(px) / max(1, min(px))
            med = float(np.median(px))
            low = [i for i, p in enumerate(px) if p < 0.8 * med]
            fl = floors[n]
            worst2 = max(rows, key=lambda x: x['outside_share'])
            results[clip]['pieces'][n] = dict(
                L2=max(x['outside_share'] for x in rows), L2_floor=fl['outside_share'],
                L3=max(x['face_px'] for x in rows), L3_floor=fl['face_px'],
                L4=ratio, low_frames=low, area_min=min(px), area_max=max(px),
                L5=min(x['on_palette'] for x in rows),
                L6_worst=max(x['holes_in_piece'] for x in rows), L6_frame=int(np.argmax([x['holes_in_piece'] for x in rows])),
                L6_mean=float(np.mean([x['holes_in_piece'] for x in rows])), specks_mean=float(np.mean([x['specks'] for x in rows])),
                dropped_mean=float(np.mean([x['dropped'] for x in rows])), outside_px_worst=worst2['outside'])
    return results, floors


def table(results, floors):
    out = ['| clip | piece | L1 gen/piece | L2 outside (bar 3%; stand floor) | L3 face px (bar 3; stand floor) | L4 area max/min (bar 1.25) | L5 on palette | L6 holes worst frame (mean) |',
           '|---|---|---|---|---|---|---|---|']
    for clip, res in results.items():
        for n, v in res['pieces'].items():
            low = f" low: {v['low_frames']}" if v['low_frames'] else ''
            out.append(f"| {clip} | {n} | 0 PASS | {v['L2'] * 100:.1f}% ({v['L2_floor'] * 100:.1f}%) {pf(v['L2'] <= L2_MAX)} | {v['L3']} ({v['L3_floor']}) {pf(v['L3'] <= L3_MAX)} | "
                       f"{v['L4']:.2f} ({v['area_min']}-{v['area_max']} px){low} {pf(v['L4'] <= L4_MAX)} | {v['L5'] * 100:.0f}% {pf(v['L5'] >= 1.0)} | "
                       f"{v['L6_worst']} at frame {v['L6_frame']} ({v['L6_mean']:.1f}) |")
    out.append('')
    out.append('| clip | map rebuilds the bare frame (exact colour share) | silhouette IoU | body holes per frame |')
    out.append('|---|---|---|---|')
    for clip, res in results.items():
        r = res['recon']
        out.append(f"| {clip} | {r['exact']:.2f} | {r['iou']:.2f} | {r['holes']:.0f} |")
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--method', default='bi70')
    ap.add_argument('--out')
    a = ap.parse_args()
    results, floors = build(a.method)
    md = table(results, floors)
    print(md)
    if a.out:
        with open(a.out, 'w') as fh:
            fh.write(md + '\n')
        with open(os.path.splitext(a.out)[0] + '.json', 'w') as fh:
            json.dump(dict(results=results, floors=floors), fh, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))


if __name__ == '__main__':
    main()
