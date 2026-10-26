"""Side-by-side GIFs of trial 2, one column per strength, every column lined up on its first blow.
Usage: compose.py CAPTURE_DIR OUT_DIR DIR [DIR...]"""
import json
import sys
from pathlib import Path
from PIL import Image

BEFORE, AFTER = 12, 48
cap, out, names = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
out.mkdir(parents=True, exist_ok=True)
cols = []
for name in names:
    files = sorted((cap / name).glob('*.png'))
    h = json.loads((cap / name / 'hits.json').read_text())
    first = h['start'] + next(i for i, v in enumerate(h['hits']) if v >= 1)
    lo = max(0, first - BEFORE)
    cols.append(files[lo:first + AFTER])
    print(name, 'first blow at frame', first)
n = min(len(c) for c in cols)
frames = []
for i in range(n):
    ims = [Image.open(c[i]).convert('RGB') for c in cols]
    w, h = ims[0].size
    f = Image.new('RGB', (w * len(ims) + 12 * (len(ims) - 1), h), (40, 40, 40))
    for k, im in enumerate(ims):
        f.paste(im, (k * (w + 12), 0))
    frames.append(f.resize((f.width * 2 // 3, f.height * 2 // 3), Image.NEAREST))
for name, ms in (('chop.gif', 20), ('chop_slow.gif', 100)):
    frames[0].save(out / name, save_all=True, append_images=frames[1:], duration=ms, loop=0)
print(n, 'frames', frames[0].size)
