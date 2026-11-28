"""The eye of round 2 (public #952): which frames a person sees as wrong, per family and clip, from a numbered sheet.

Each sheet holds up to CHUNK frames: the bare frame and the dressed frame side by side, 2x, numbered. The labels are a person's: `ask` puts a sheet to `ask-claude` (the plan's API
credit) when it is granted; when it is refused (exit 8) the session's own eye reads the sheets and `record` keeps the verdicts. They are cached in r2/eye/<family>/<clip>.json and named as the judge's in the report. They are the 'person'
against whom L7 (the rebuild score) is tested, and the second check on the bars.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import route2  # noqa: E402

CHUNK = 15
PER_ROW = 5
CROP = (16, 8, 112, 128)
QUESTION = """The picture shows numbered pairs of pixel-art frames of one animation of a man. In each pair the LEFT figure is the bare
body (grey shorts) and the RIGHT figure is the same frame with an outfit put on by a program: {pieces}. Garments may be a little bigger
than the body (thickness, a cuff, a sole): that is fine. Judge each RIGHT figure as a player would see it in a game, and list the frame
numbers where the outfit is visibly wrong, for any of: (a) torn: bare skin showing through a garment in a patch, or a garment broken into
pieces; (b) floating: garment pixels off the body or left behind where the body moved; (c) misplaced: a piece on the wrong body part (gloves
not on the hands, boots not on the feet, cap not on the head); (d) missing: a piece that should be visible is gone; (e) a garment covers the
face or chin. Small ragged edges of 1-2 pixels are not wrong. Answer ONLY with JSON: {{"wrong": {{"<frame number>": "<short reason>"}}}}
listing only wrong frames (an empty object if none)."""


def sheet(frames, layers, names, idx, path, scale=2):
    x0, y0, x1, y1 = CROP
    w, h = (x1 - x0) * scale, (y1 - y0) * scale
    rows = (len(idx) + PER_ROW - 1) // PER_ROW
    im = Image.new('RGB', (PER_ROW * (2 * w + 12), rows * (h + 14)), (120, 160, 120))
    d = ImageDraw.Draw(im)
    for j, i in enumerate(idx):
        f = frames[i]
        dressed = f.copy()
        for n in names:
            L = layers[n][i]
            m = L[..., 3] > 0
            dressed[m] = L[m]
        X, Y = (j % PER_ROW) * (2 * w + 12), (j // PER_ROW) * (h + 14)
        for k, a in enumerate((f, dressed)):
            t = Image.fromarray(a).crop(CROP)
            b = Image.new('RGBA', t.size, (120, 160, 120, 255))
            b.alpha_composite(t)
            im.paste(b.convert('RGB').resize((w, h), Image.NEAREST), (X + k * w, Y + 14))
        d.text((X + w - 6, Y + 1), str(i), fill=(255, 255, 255))
    im.save(path)


def sheets(family, clip, names=None):
    """Write the numbered judging sheets of a clip (r2/eye/<family>/<clip>.<first frame>.png); returns their paths."""
    out_dir = os.path.join(route2.R2, 'eye', family)
    os.makedirs(out_dir, exist_ok=True)
    frames = route2.load_frames(clip)
    z = np.load(os.path.join(route2.R2, 'res', family, clip + '.layers.npz'))
    names = names or [n for n in route2.PIECES if n in z.files]
    layers = {n: z[n] for n in names}
    paths = []
    for c0 in range(0, len(frames), CHUNK):
        idx = list(range(c0, min(len(frames), c0 + CHUNK)))
        img = os.path.join(out_dir, f'{clip}.{c0:02d}.png')
        sheet(frames, layers, names, idx, img)
        paths.append(img)
    return paths


def ask(img, names, model='sonnet'):
    """One ask-claude call on a sheet: {frame: reason} or None when the credit is refused (exit 8: the judge's own eye instead)."""
    r = subprocess.run(['ask-claude', '--model', model, '--image', img, QUESTION.format(pieces=', '.join(names))],
                       capture_output=True, text=True, timeout=600)
    if r.returncode == 8:
        return None
    txt = r.stdout.strip()
    s, e = txt.find('{'), txt.rfind('}')
    return {int(k): v for k, v in json.loads(txt[s:e + 1]).get('wrong', {}).items() if k.isdigit()}


def record(family, clip, wrong, judge, frames):
    """Store a clip's labels: wrong = {frame: reason}; judge names who looked ('own eye' or the ask-claude model)."""
    path = os.path.join(route2.R2, 'eye', family, clip + '.json')
    json.dump(dict(family=family, clip=clip, judge=judge, frames=frames, wrong={str(k): v for k, v in sorted(wrong.items())}),
              open(path, 'w'), indent=1)


def labels(family, clip):
    path = os.path.join(route2.R2, 'eye', family, clip + '.json')
    return json.load(open(path)) if os.path.exists(path) else None


if __name__ == '__main__':
    fam = sys.argv[1]
    for clip in sys.argv[2:]:
        print(fam, clip, sheets(fam, clip), flush=True)
