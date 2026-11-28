"""How the bars and L7 agree with the eye (round 2, public #952).

For each family and clip with eye labels (eyejudge.record): the frames the bars pass (all four on every piece) against the frames the
eye calls right, and L7 (the bare rebuild's exact share, whole body and under the garments) as a predictor of 'seen wrong': the area
under the ROC curve and the line that best splits the two. Python 3 with numpy only.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import route2  # noqa: E402
import eyejudge  # noqa: E402


def auc(score, bad):
    """P(score of a right frame > score of a wrong frame); ties count half. None when one side is empty."""
    s, b = np.asarray(score, float), np.asarray(bad, bool)
    good, wrong = s[~b], s[b]
    if not len(good) or not len(wrong):
        return None
    gt = (good[:, None] > wrong[None, :]).mean()
    eq = (good[:, None] == wrong[None, :]).mean()
    return round(float(gt + 0.5 * eq), 3)


def best_line(score, bad):
    """The threshold t (frames with score < t called wrong) with the most frames called as the eye calls them."""
    s, b = np.asarray(score, float), np.asarray(bad, bool)
    best = (0, None)
    for t in np.unique(s):
        hit = ((s < t) == b).mean()
        if hit > best[0]:
            best = (round(float(hit), 3), round(float(t), 3))
    return best


def frame_rows(family, clip):
    rep = json.load(open(os.path.join(route2.R2, 'res', family, clip + '.json')))
    lab = eyejudge.labels(family, clip)
    if lab is None:
        return None
    n = rep['frames']
    bad = np.array([str(i) in lab['wrong'] for i in range(n)])
    bars_ok = np.array([all(rep['pieces'][p][i]['all'] for p in rep['pieces']) for i in range(n)])
    exact = np.array(rep['exact'], float)
    under = np.array([np.mean([rep['pieces'][p][i]['exact_under'] for p in rep['pieces']]) for i in range(n)])
    return dict(bad=bad, bars_ok=bars_ok, exact=exact, under=under, judge=lab['judge'])


def table(families, clips):
    out = []
    for f in families:
        rows = [r for r in (frame_rows(f, c) for c in clips) if r is not None]
        if not rows:
            continue
        cat = {k: np.concatenate([r[k] for r in rows]) for k in ('bad', 'bars_ok', 'exact', 'under')}
        bad, ok = cat['bad'], cat['bars_ok']
        out.append(dict(family=f, frames=int(len(bad)), eye_right=round(float((~bad).mean()), 3), bars_pass=round(float(ok.mean()), 3),
                        agree=round(float((ok == ~bad).mean()), 3), bars_pass_eye_wrong=int((ok & bad).sum()),
                        bars_fail_eye_right=int((~ok & ~bad).sum()), l7_auc=auc(cat['exact'], bad), l7_under_auc=auc(cat['under'], bad),
                        l7_line=best_line(cat['exact'], bad), judge=rows[0]['judge']))
    return out


if __name__ == '__main__':
    fams = sys.argv[1].split(',')
    clips = sys.argv[2].split(',') if len(sys.argv) > 2 else route2.TUNE
    for r in table(fams, clips):
        print(json.dumps(r))
