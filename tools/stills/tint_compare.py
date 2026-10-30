"""The tint comparison (docs/design/LIGHTING.md section 5, question 1): our square at five strengths of the hour's
tint, for 17:30 and for 19:00, measured in CIELAB beside the references and laid out as two phone-width boards.

    python3 tools/stills/tint_compare.py [workdir]

1. Renders the square of still A over `inputs/lighting-base.png` at 17:30 (`#eda83a` at 0, 12, 18, 28, 40%)
   and at 19:00 (`#e2533f` at 0, 18, 28, 40, 55%), with the build's pools at the hour's strength (poolAt:
   0.625 of B's alphas at 17:30, full at 19:00), Pell's window lit and the body light, 1170x2532 each.
2. Takes the references named in `refs/refs.json` (the key art and the frames of its video, cut by ffmpeg).
3. Measures every picture with `tools/src/light/tint-cli.ts` (mean a*, b* and chroma of the midtones, luma
   0.25 to 0.75, sky and ground apart; our top-down frames are all ground).
4. Writes `docs/design/frames/2026-10-30-tint-compare-1730.png` and `-1900.png` with every number under its
   picture and the strength closest to the references' median ground marked.

Pillow, numpy, ffmpeg and the repo's node. No network.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import lighting as L

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.mkdtemp(prefix='tint-'))
FRAMES = ROOT / 'docs/design/frames'
ROWS = {
    '17:30': {'tint': '#eda83a', 'pcts': [0, 12, 18, 28, 40], 'pools': 0.625},
    '19:00': {'tint': '#e2533f', 'pcts': [0, 18, 28, 40, 55], 'pools': 1.0},
}
BOARD_W = 1170
INK = (0x1b, 0x1a, 0x2e)
PAPER = (0xf5, 0xf4, 0xef)
GOLD = (0xf8, 0xde, 0x62)
SKYC = (0x7c, 0xc4, 0xec)
GROUNDC = (0xed, 0xa8, 0x3a)


def font(size, bold=False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/' + name, size)
    except OSError:
        return ImageFont.load_default()


def render(hour, pct):
    row = ROWS[hour]
    img = L.multiply(L.base.copy(), row['tint'], np.full((L.H, L.W), pct / 100.0))
    img = L.pools(img, gain=row['pools'])
    img = L.lit_window(img)
    img = L.body_light(img)
    return Image.fromarray(np.clip(np.rint(img), 0, 255).astype(np.uint8))


def refs():
    spec = json.loads((HERE / 'refs' / 'refs.json').read_text())
    out = []
    for r in spec:
        src = ROOT / r['source']
        if 'at' in r:  # a frame of a video, cut at a fixed second
            dst = WORK / f"{r['id']}.png"
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(r['at']), '-i', str(src), '-frames:v', '1', str(dst)], check=True)
            file = dst
        else:
            file = src
        out.append({**r, 'file': str(file)})
    return out


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    ours = []
    for hour, row in ROWS.items():
        for pct in row['pcts']:
            f = WORK / f"ours-{hour.replace(':', '')}-{pct:02d}.png"
            render(hour, pct).save(f)
            ours.append({'id': f.stem, 'file': str(f), 'hour': hour, 'pct': pct})
    rs = refs()
    manifest = WORK / 'manifest.json'
    manifest.write_text(json.dumps({'ours': ours, 'refs': [{k: r[k] for k in ('id', 'file', 'hours', 'sky', 'ground')} for r in rs]}, indent=1))
    measured = WORK / 'measured.json'
    subprocess.run(['npx', 'tsx', str(ROOT / 'tools/src/light/tint-cli.ts'), str(manifest), str(measured)], check=True, cwd=ROOT)
    data = json.loads(measured.read_text())
    byref = {r['id']: r for r in data['refs']}
    for h in data['result']:
        board(h, [byref[i] for i in h['refs']], {r['id']: r for r in rs})
    print(json.dumps({h['hour']: h['pick'] for h in data['result']}))


def nums(draw, x, y, m, f, extra=None):
    lines = [f"a* {m['a']:.1f}", f"b* {m['b']:.1f}", f"C {m['chroma']:.1f}"]
    if extra:
        lines.append(extra)
    for i, t in enumerate(lines):
        draw.text((x, y + i * 26), t, fill=PAPER, font=f)
    return y + len(lines) * 26


def board(h, rlist, rspec):
    col = BOARD_W // 5
    pw, ph = col - 12, int((col - 12) * 2532 / 1170)
    title, small, bold = font(30, True), font(20), font(22, True)
    ref_h = int(pw * 9 / 16)
    ref_rows = (len(rlist) + 4) // 5
    height = 24 + 44 + 34 + ph + 170 + 50 + ref_rows * (ref_h + 150) + 190
    sheet = Image.new('RGB', (BOARD_W, height), INK)
    d = ImageDraw.Draw(sheet)
    y = 24
    d.text((16, y), f"{h['hour']}  the hour's tint at five strengths, beside the references", fill=PAPER, font=title)
    y += 44
    d.text((16, y), 'Mean a*, b* and chroma (C) of the midtones (luma 0.25 to 0.75) in CIELAB. Ours: the whole frame is ground.', fill=PAPER, font=font(17))
    y += 34
    for i, o in enumerate(h['ours']):
        x = i * col + 6
        im = Image.open(o['file']).resize((pw, ph), Image.LANCZOS)
        sheet.paste(im, (x, y))
        picked = o['pct'] == h['pick']
        if picked:
            d.rectangle([x - 4, y - 4, x + pw + 3, y + ph + 3], outline=GOLD, width=4)
        d.text((x + 4, y + ph + 8), f"{o['pct']}%" + ('  closest' if picked else ''), fill=GOLD if picked else PAPER, font=bold)
        nums(d, x + 4, y + ph + 40, o['m'], small, f"distance {o['d']:.1f}")
    y += ph + 170
    t = h['target']
    d.text((16, y), f"References' median ground: a* {t['a']:.1f}  b* {t['b']:.1f}  C {t['chroma']:.1f}   sky: a* {h['sky']['a']:.1f}  b* {h['sky']['b']:.1f}  C {h['sky']['chroma']:.1f}", fill=GOLD, font=font(19, True))
    y += 50
    for i, r in enumerate(rlist):
        x = (i % 5) * col + 6
        yy = y + (i // 5) * (ref_h + 150)
        im = Image.open(rspec[r['id']]['file']).convert('RGB')
        sx, sy = pw / im.width, ref_h / im.height
        sheet.paste(im.resize((pw, ref_h), Image.LANCZOS), (x, yy))
        for boxes, c in ((rspec[r['id']]['sky'], SKYC), (rspec[r['id']]['ground'], GROUNDC)):
            for x0, y0, x1, y1 in boxes:
                d.rectangle([x + x0 * im.width * sx, yy + y0 * im.height * sy, x + x1 * im.width * sx - 1, yy + y1 * im.height * sy - 1], outline=c, width=2)
        d.text((x + 4, yy + ref_h + 6), rspec[r['id']]['label'], fill=PAPER, font=font(18, True))
        g = r['ground']
        d.text((x + 4, yy + ref_h + 32), f"ground a* {g['a']:.1f}", fill=PAPER, font=small)
        d.text((x + 4, yy + ref_h + 56), f"b* {g['b']:.1f}  C {g['chroma']:.1f}", fill=PAPER, font=small)
        s = r['sky']
        d.text((x + 4, yy + ref_h + 84), f"sky a* {s['a']:.1f}", fill=PAPER, font=small)
        d.text((x + 4, yy + ref_h + 108), f"b* {s['b']:.1f}  C {s['chroma']:.1f}", fill=PAPER, font=small)
    y += ref_rows * (ref_h + 150)
    d.text((16, y), 'Boxes on the references: blue the sky read, orange the ground read.', fill=PAPER, font=font(17))
    d.text((16, y + 30), f"Recommended: {h['pick']}%, the strength whose ground numbers sit closest to the references' median.", fill=GOLD, font=font(19, True))
    d.text((16, y + 62), 'Pools at the hour (poolAt), Pell\'s window lit and the body light are in every frame of the row; only the tint differs.', fill=PAPER, font=font(16))
    d.text((16, y + 88), 'The references are one painting, the key art, and its video: the open-licence photo sites were refused by the', fill=PAPER, font=font(16))
    d.text((16, y + 110), "session's network. More go into tools/stills/refs/refs.json and the board re-makes from one command.", fill=PAPER, font=font(16))
    d.text((16, y + 140), 'Made by tools/stills/tint_compare.py; numbers by tools/src/light/tint.ts. LIGHTING.md section 5.', fill=PAPER, font=font(16))
    out = FRAMES / f"2026-10-30-tint-compare-{h['hour'].replace(':', '')}.png"
    sheet.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(out, optimize=True)
    print(out.name, sheet.size, out.stat().st_size, file=sys.stderr)


if __name__ == '__main__':
    main()
