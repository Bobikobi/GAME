"""Summary of a set's run on one race: per clip the frames that passed, S4 over the clip, and the worst case of every bar.

  summary.py --set core/reed-walker --race human
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bars  # noqa: E402
import run  # noqa: E402


def summarize(set_id, race):
    key = set_id.split('/')[1]
    rep = json.load(open(os.path.join(run.WORK, 'out', key, race, 'report.json')))
    clips = {}
    for r in rep:
        clips.setdefault(r['clip'], []).append(r)
    out = dict(clips={}, worst={}, bare=[], frames=len(rep))
    worst = dict(S1_height=0, S1_feet=0, S2_face=0.0, S2_out=0.0, S3_px=0, S5_specks=0, ramp_min=1.0, S4=0.0)
    for clip, frames in clips.items():
        frames.sort(key=lambda r: r['i'])
        areas = []
        for r in frames:
            good = next((t for t in r['tries'] if t.get('ok') and t['seed'] == r['seed']), None)
            areas.append(good['garment_area'] if good else 0)
            if good:
                g = good['rep']
                worst['S1_height'] = max(worst['S1_height'], g['S1']['height_diff'])
                worst['S1_feet'] = max(worst['S1_feet'], g['S1']['feet_row_diff'])
                worst['S2_face'] = max(worst['S2_face'], g['S2']['face_share'])
                worst['S2_out'] = max(worst['S2_out'], g['S2']['share'])
                worst['S3_px'] = max(worst['S3_px'], g['S3']['garment_px'])
                worst['S5_specks'] = max(worst['S5_specks'], g['S5']['specks'])
                worst['ramp_min'] = min(worst['ramp_min'], g['ramp_share'])
            else:
                out['bare'].append(f'{clip}-f{r["i"]}')
        s4 = bars.s4(areas, cyclic=True)
        out['clips'][clip] = dict(areas=areas, S4=s4)
        if all(a > 0 for a in areas):
            worst['S4'] = max(worst['S4'], s4['max_change'])
    out['worst'] = worst
    out['gens_per_frame_attempts'] = sum(len(r['tries']) for r in rep) / max(len(rep), 1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--set', required=True)
    ap.add_argument('--race', default='human')
    a = ap.parse_args()
    print(json.dumps(summarize(a.set, a.race), indent=1))
