"""One edit of one bare frame into a dressed frame: PixelLab's pixen edit, one generation. The description is the set's own
(constant over the frames of a set, the only colour anchor pixen has) and the seed is kept per frame so a retry changes it.

  draw.py --bare FRAME.png --desc "..." --seed N --label NAME --out DIR
"""
import argparse
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pl  # noqa: E402


def edit(bare_path, desc, seed, label, out):
    bare = Image.open(bare_path).convert('RGBA')
    body = {'image': pl.img(bare), 'description': desc, 'width': bare.width, 'height': bare.height, 'seed': seed, 'no_background': True}
    return pl.call('/edit-image-pixen', body, label, out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--bare', required=True)
    ap.add_argument('--desc', required=True)
    ap.add_argument('--seed', type=int, default=11)
    ap.add_argument('--label', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    f = edit(a.bare, a.desc, a.seed, a.label, a.out)
    sys.exit(0 if f else 1)
