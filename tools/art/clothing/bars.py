"""The measured bars of the clothing-sets order (S1-S5), each against the bare frame of the same pose.

A frame is an RGBA numpy array (128 x 128 in the lane's frames, hard alpha). `bare` is the undressed figure's frame and
`dressed` the same pose with a set's pieces on it. Everything is computed from the two arrays and a list of wear places, so
the same script measures a drawing from any route.

  S1 height     the dressed figure's opaque height is within 2 px of the bare one's, and the feet stand on the same rows
  S2 identity   outside the garment's area (the wear places, grown by a margin) the figure is unchanged: the share of the
                bare figure's opaque pixels there that differ by more than a colour step, or that went missing
  S3 face       nothing of the garment inside the face box (brow to chin plus one pixel), on every frame
  S4 popping    (a clip) the garment's area changes by at most 12% between neighbour frames, and its colours stay on the
                set's ramp
  S5 one body   no loose specks: no opaque piece under SPECK px, no more pieces than the bare frame has

Landmarks (the figure's top and bottom rows, the head rows, the face box) come from the bare frame, never from the drawing
under test. The face box is the bounding box of the bare frame's skin-coloured pixels in the head rows, one pixel wider on
every side; on a back view it holds the ears and the nape, which is what a hat must not cover there either.
"""
import colorsys

import numpy as np

DIFF = 40            # a colour step: max channel difference that counts as a changed pixel
SPECK = 6            # opaque pieces under this many pixels are loose specks
S1_TOL = 2           # rows
S4_AREA = 0.12       # allowed change of the garment's area between neighbour frames
S4_RAMP_DE = 30.0    # Lab distance to the nearest ramp colour that still counts as on the ramp's colour family (the delivery then puts the garment exactly on the ramp)
S4_RAMP_SHARE = 0.90 # share of garment pixels that must be on the ramp
ALIGN_DE = 15.0      # S2: a pixel counts as recoloured when no pixel of its 3 x 3 neighbourhood in the drawing is within this Lab distance of it
S2_ALIGNED_MAX = 0.06  # S2: share of the figure's pixels outside the garment's area that may be recoloured (good frames measured at most 0.035; a recoloured pair of shorts 0.11 and 0.175)
S3_DE_NO_RAMP = 25.0  # S3 with no ramp given: a face-box pixel this far (Lab) from every colour of the bare box is garment
MARGIN = 2           # px by which a wear place grows into its neighbours
HEAD_FRAC = 0.27
BROW_FRAC = 0.156      # the brow row, as a share of the figure's height below its top (96 px: row 37)
BROW_FRAC_BACK = 0.23  # a back view: only the ears and nape
FACE_HALF = 0.27       # front view: the face box is the middle of the head, this share of the head's width to each side of the centre
FACE_SIDE = 0.55       # side view: the face box is this share of the head's width, from the nose side     # head rows: this share of the figure's height, from its top
# wear places as shares of the figure's height from its top row: [from, to)
PLACES = {'head': (-0.06, 0.26), 'top': (0.22, 0.62), 'legs': (0.50, 0.84), 'feet': (0.76, 1.02), 'hands': (0.44, 0.66)}


def opaque(a):
    return a[..., 3] > 0


def rows(a):
    ys = np.nonzero(opaque(a).any(1))[0]
    return int(ys.min()), int(ys.max())


def is_skin(rgb):
    """Skin-coloured: warm orange, saturated, bright (the kept bare body); hair and shade are darker."""
    r, g, b = [rgb[..., i].astype(float) / 255 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    s = (mx - mn) / np.maximum(mx, 1e-6)
    h = np.zeros_like(mx)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return (h >= 18) & (h <= 38) & (s >= 0.5) & (mx >= 0.70)


def landmarks(bare, view='front'):
    """Rows and the face box of the bare frame. The head is the first HEAD_FRAC of the figure's height from its top. The face
    box is the head's width (the silhouette's columns, one pixel wider) on the rows from the brow to the head's end:
    front and left views from BROW_FRAC of the height below the figure's top, a back view only the last rows of the head
    (ears and nape), since nothing of a face shows there. Skin colour alone does not find the face: the kept body's hair
    highlights are skin-coloured, so the rows are a rule of the figure's proportions (96 px body: brow row 37, chin row 48)."""
    top, bot = rows(bare)
    h = bot - top + 1
    head_end = top + int(round(HEAD_FRAC * h))
    op = opaque(bare)
    skin = is_skin(bare[..., :3]) & op
    brow = top + int(round((BROW_FRAC_BACK if view == 'back' else BROW_FRAC) * h))
    probe = op[brow:brow + max(2, int(round(0.08 * h)))]
    xs = np.nonzero(probe.any(0))[0]
    face = None
    if len(xs):
        x0, x1 = int(xs.min()), int(xs.max())
        w = x1 - x0 + 1
        if view == 'front':      # the middle of the head: the face, not the temples where a brim rightly sits
            c = (x0 + x1) / 2
            face = (int(round(c - FACE_HALF * w)), int(round(c + FACE_HALF * w)), brow, head_end)
        elif view == 'left':     # the facing side: from the nose side to the middle of the head
            face = (x0 - 1, int(round(x0 + FACE_SIDE * w)), brow, head_end)
        elif view == 'right':
            face = (int(round(x1 - FACE_SIDE * w)), x1 + 1, brow, head_end)
        else:                    # a back view: the ears and the nape, the whole width
            face = (x0 - 1, x1 + 1, brow, head_end)
    return dict(top=top, bot=bot, h=h, head_end=head_end, skin=skin, face=face, brow=brow, view=view)


def largest_component(mask):
    """The largest 8-connected piece of a boolean mask, as a mask, or None."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best = None
    for y0 in range(h):
        for x0 in range(w):
            if mask[y0, x0] and not seen[y0, x0]:
                st = [(y0, x0)]
                seen[y0, x0] = True
                pts = []
                while st:
                    y, x = st.pop()
                    pts.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True
                                st.append((yy, xx))
                if best is None or len(pts) > len(best):
                    best = pts
    if best is None:
        return None
    out = np.zeros_like(mask)
    for y, x in best:
        out[y, x] = True
    return out


def place_mask(lm, places, shape, margin=MARGIN):
    """Rows of the wear places, across the frame's width, grown by `margin` rows."""
    m = np.zeros(shape[:2], bool)
    for p in places:
        lo, hi = PLACES[p]
        y0 = int(round(lm['top'] + lo * lm['h'])) - margin
        y1 = int(round(lm['top'] + hi * lm['h'])) + margin
        m[max(0, y0):max(0, y1)] = True
    return m


def face_mask(lm, shape):
    m = np.zeros(shape[:2], bool)
    if lm['face']:
        x0, x1, y0, y1 = lm['face']
        m[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = True
    return m


def changed(bare, dressed, thr=DIFF):
    """Pixels that differ by a colour step, or that appear or disappear."""
    ob, od = opaque(bare), opaque(dressed)
    d = np.abs(bare[..., :3].astype(int) - dressed[..., :3].astype(int)).max(-1)
    return (ob != od) | (ob & od & (d > thr))


def garment_pixels(bare, dressed, lm, places):
    """The garment: pixels inside the wear places that the drawing changed, other than skin the model merely redrew as skin."""
    ch = changed(bare, dressed)
    skin_redrawn = is_skin(dressed[..., :3]) & lm['skin'] & opaque(dressed)
    return ch & opaque(dressed) & place_mask(lm, places, bare.shape) & ~skin_redrawn


def s1(bare, dressed):
    tb, bb = rows(bare)
    td, bd = rows(dressed)
    dh = abs((bd - td + 1) - (bb - tb + 1))
    dfeet = abs(bd - bb)
    return dict(height_diff=dh, feet_row_diff=dfeet, ok=dh <= S1_TOL and dfeet <= 1)


def s2(bare, dressed, places, view='front'):
    lm = landmarks(bare, view)
    outside = opaque(bare) & (~place_mask(lm, places, bare.shape) | face_mask(lm, bare.shape))
    n = int(outside.sum())
    bad = int((changed(bare, dressed) & outside).sum())
    sk = outside & lm['skin']
    nsk = int(sk.sum())
    badsk = int((changed(bare, dressed) & sk).sum())
    fm = face_mask(lm, bare.shape) & opaque(bare)
    nf = int(fm.sum())
    badf = int((changed(bare, dressed) & fm).sum())
    de = aligned_de(bare, dressed)
    aligned = float((de[outside] > ALIGN_DE).mean()) if n else 0.0
    return dict(outside_px=n, changed_px=bad, share=bad / max(n, 1), aligned_share=aligned, skin_px=nsk, skin_changed=badsk,
                skin_share=badsk / max(nsk, 1), face_px=nf, face_changed=badf, face_share=badf / max(nf, 1))


def lab_grid(a):
    return lab(a[..., :3].reshape(-1, 3)).reshape(a.shape[:2] + (3,))


def aligned_de(bare, dressed):
    """Per pixel, the smallest Lab distance between the bare pixel and the dressed pixels of its 3 x 3 neighbourhood: a figure
    that moved one pixel is the same figure, a pair of shorts that went from grey to blue is not."""
    lb, ld = lab_grid(bare), lab_grid(dressed)
    best = np.full(bare.shape[:2], 1e9)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            best = np.minimum(best, np.sqrt(((lb - np.roll(np.roll(ld, dy, 0), dx, 1)) ** 2).sum(-1)))
    return best


S3_DE = 40.0   # S3: a face-box pixel counts as changed when no pixel of its 3 x 3 neighbourhood in the drawing is within this Lab distance
S3_MAX = 3     # px of the face box that may change (clean frames measured 0 to 2, frames with a brim, a peak or a collar 9 and up)


EAR_COLS = 3   # S3, back view: the head's outer columns on each side, at ear height (the rows of the old nape band)


def s3_back(bare, dressed, places):
    """S3 for a back view (manager 21.11): a back has no face. The box is the two ear columns at ear height, and a collar over the
    nape is allowed up to the hairline. A piece that is not head-wear may not cover hair: changed pixels inside the bare frame's
    hair above the nape band (non-skin pixels of the head rows above the band's first row) count with the ear boxes, pass at S3_MAX or fewer. Head-wear sets skip the hair term."""
    lm = landmarks(bare, 'back')
    x0, x1, y0, y1 = lm['face']
    x0, x1 = x0 + 1, x1 - 1                       # the face box of a back view is one pixel wider than the head each side
    ears = np.zeros(bare.shape[:2], bool)
    ears[y0:y1 + 1, x0:x0 + EAR_COLS] = True
    ears[y0:y1 + 1, x1 - EAR_COLS + 1:x1 + 1] = True
    ears &= opaque(bare)
    de = aligned_de(bare, dressed)
    bad_ear = ears & (~opaque(dressed) | (de > S3_DE))
    hair_px = 0
    if 'head' not in places:
        hair = opaque(bare) & ~lm['skin']
        hair[y0:] = False                      # above the nape band: the collar's rows are the hairline
        hair[:lm['top']] = False
        hair_px = int((changed(bare, dressed) & hair).sum())
    n = int(bad_ear.sum()) + hair_px
    return dict(face_box=lm['face'], garment_px=n, ear_px=int(bad_ear.sum()), hair_px=hair_px, ok=n <= S3_MAX)


def s3(bare, dressed, places, view='front', ramp=None):
    """Nothing of the garment inside the face box. A face-box pixel counts when the drawing made it clear where the bare figure
    had a face, or when its colour is S3_DE or more (Lab) from every dressed pixel of its 3 x 3 neighbourhood: the face redrawn
    with its own shading and a nudge of a pixel is the same face, a brim, a peak or a collar over it is a strong change. Pass at
    S3_MAX pixels or fewer. A back view has its own rule (s3_back). (ramp is kept in the signature for the callers.)"""
    if view == 'back':
        return s3_back(bare, dressed, places)
    lm = landmarks(bare, view)
    fm = face_mask(lm, bare.shape) & opaque(bare)
    if not fm.any():
        return dict(face_box=None, garment_px=0, ok=True)
    de = aligned_de(bare, dressed)
    gone = fm & ~opaque(dressed)
    strong = fm & opaque(dressed) & (de > S3_DE)
    n = int((gone | strong).sum())
    return dict(face_box=lm['face'], garment_px=n, ok=n <= S3_MAX)


def components(mask):
    """8-connected pieces of a boolean mask: a list of pixel counts."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    sizes = []
    for y0 in range(h):
        for x0 in range(w):
            if mask[y0, x0] and not seen[y0, x0]:
                st = [(y0, x0)]
                seen[y0, x0] = True
                c = 0
                while st:
                    y, x = st.pop()
                    c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True
                                st.append((yy, xx))
                sizes.append(c)
    return sizes


def s5(bare, dressed):
    sb, sd = components(opaque(bare)), components(opaque(dressed))
    specks = [c for c in sd if c < SPECK]
    return dict(pieces_bare=len(sb), pieces=len(sd), specks=len(specks), ok=len(specks) == 0 and len(sd) <= len(sb))


def lab(rgb):
    c = np.asarray(rgb, dtype=np.float64).reshape(-1, 3) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.2126, 0.0193], [0.3576, 0.7152, 0.1192], [0.1805, 0.0722, 0.9505]]) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)


def ramp_share(dressed, gmask, ramp):
    """The share of garment pixels within S4_RAMP_DE (Lab) of a colour of the set's ramp; the ink outline is allowed."""
    pts = dressed[gmask][:, :3]
    if len(pts) == 0:
        return 1.0
    pal = np.vstack([np.asarray(ramp, dtype=np.uint8).reshape(-1, 3), np.array([[0x1b, 0x1a, 0x2e]], np.uint8)])
    d = np.sqrt(((lab(pts)[:, None] - lab(pal)[None]) ** 2).sum(-1)).min(1)
    return float((d <= S4_RAMP_DE).mean())


def s4(areas, cyclic=False):
    """Largest change of the garment's area between neighbour frames (a clip's list of areas, in order)."""
    pairs = list(zip(areas, areas[1:])) + ([(areas[-1], areas[0])] if cyclic and len(areas) > 1 else [])
    worst = 0.0
    for a, b in pairs:
        worst = max(worst, abs(a - b) / max(a, b, 1))
    return dict(max_change=worst, ok=worst <= S4_AREA)


def frame_report(bare, dressed, places, ramp, view='front'):
    lm = landmarks(bare, view)
    g = garment_pixels(bare, dressed, lm, places)
    return dict(S1=s1(bare, dressed), S2=s2(bare, dressed, places, view), S3=s3(bare, dressed, places, view, ramp),
                S5=s5(bare, dressed), garment_area=int(g.sum()), ramp_share=ramp_share(dressed, g, ramp))


def lum(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def recolour(dressed, gmask, ramp, accent=()):
    """Put the garment exactly on the set's ramp ("a hide's colour is final": the colour comes from the ramp, the drawing gives
    only the light and shade). Each garment pixel except the ink outline goes to the nearest of the ramp and the accent
    ramp, then takes the step of its own ramp that has the same rank of lightness among the garment's pixels of that ramp."""
    out = dressed.copy()
    idx = np.argwhere(gmask & (dressed[..., :3].max(-1) >= 0.2 * 255) & (dressed[..., 3] > 0))
    if len(idx) == 0:
        return out
    pts = dressed[idx[:, 0], idx[:, 1], :3]
    ramps = [np.array(sorted(ramp, key=lambda c: lum(np.array(c, float))), np.uint8)]
    if len(accent):
        ramps.append(np.array(sorted(accent, key=lambda c: lum(np.array(c, float))), np.uint8))
    allc = np.vstack(ramps)
    owner = np.concatenate([[i] * len(r) for i, r in enumerate(ramps)])
    near = owner[np.sqrt(((lab(pts)[:, None] - lab(allc)[None]) ** 2).sum(-1)).argmin(1)]
    y = lum(pts.astype(float))
    for i, r in enumerate(ramps):
        sel = near == i
        if not sel.any():
            continue
        ys = y[sel]
        lo, hi = np.percentile(ys, 3), np.percentile(ys, 97)
        t = np.clip((ys - lo) / max(hi - lo, 1e-6), 0, 1)
        step = np.minimum((t * len(r)).astype(int), len(r) - 1)
        out[idx[sel, 0], idx[sel, 1], :3] = r[step]
    return out
