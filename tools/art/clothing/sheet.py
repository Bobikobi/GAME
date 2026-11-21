"""Contact sheet of frames side by side on a flat green, enlarged by an integer factor (for the builder's own eye)."""
import sys

from PIL import Image


def contact(paths, out, zoom=3, crop=None, bg=(120, 160, 90, 255)):
    ims = []
    for p in paths:
        im = Image.open(p).convert('RGBA')
        g = Image.new('RGBA', im.size, bg)
        g.alpha_composite(im)
        if crop:
            g = g.crop(crop)
        ims.append(g.resize((g.width * zoom, g.height * zoom), Image.NEAREST))
    W = Image.new('RGB', (sum(i.width for i in ims), max(i.height for i in ims)))
    x = 0
    for i in ims:
        W.paste(i.convert('RGB'), (x, 0))
        x += i.width
    W.save(out)
    return W.size


if __name__ == '__main__':
    out, zoom = sys.argv[1], int(sys.argv[2])
    crop = tuple(int(v) for v in sys.argv[3].split(',')) if sys.argv[3] != '-' else None
    print(contact(sys.argv[4:], out, zoom, crop))
