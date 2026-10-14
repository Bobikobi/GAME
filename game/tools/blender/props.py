"""Build the props the people of the 3D trial carry, every map drawn in code, and check one on a person.

Run:  blender -b -P props.py -- <out dir> [--fit PROP PERSON.glb]...
      blender -b -P props.py -- --check <person.glb> <prop.glb> [--probe PREFIX]

Build writes prop-spade.glb, prop-basket.glb and prop-hat.glb into <out dir>:
- the spade: an ash shaft with a T grip wrapped in indigo cloth, a wooden blade with an iron shoe, carried
  across the back with the blade up above the left shoulder;
- the basket: plain-woven willow with a rust-red cloth lining folded over the rim, and two leather straps
  that run over the shoulders, down the chest and back under the arms;
- the hat: soft moss-green felt, a round uncreased crown, a wide brim that droops in front and behind, a
  darker ribbed band.
A prop's origin is the socket it hangs from, named in its node extras ("socket": socket_back for the spade
and the basket, socket_head for the hat), and its axes are the person's: +X the person's left, -Y forward,
+Z up (in glTF +Z forward and +Y up). The colour and normal maps tile, so they stay small.

  --fit PROP PERSON.glb   fit PROP (spade, basket or hat) to a person rigged by person_rig.py, as the rest
                          pose stands. Repeat it for every person who carries the prop. The spade and the
                          basket are one shape that clears them all: they stand off the back and lean with
                          it. What lies on the body is fitted to each of them in turn, and the file holds
                          one copy per person, a child node whose extras name the person's look ("wearer":
                          forager-f for character-forager-f.glb): the straps, which follow the shoulders,
                          the chest and the sides under the arms, and the hat, whose crown takes the head
                          at its band. Without a --fit a prop keeps the sizes measured on the first people,
                          the basket has no straps and the hat is one copy for anyone.

Check hangs <prop.glb> from its socket on <person.glb>, with the copy fitted to that person (the first
copy when none is), and reports, for the rest pose and every frame of every clip, how close the prop comes
to the body and to the arms (negative: inside).
  --probe PREFIX          also renders the rest pose, three frames of every clip and each clip's closest
                          frame, from the front, the side and the back (PREFIX-<pose>-<view>.png)
Prints one DIAG line per fact.
"""
import math
import os
import re
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
CHECK = "--check" in argv
PROBE = argv[argv.index("--probe") + 1] if "--probe" in argv else None
FITS = {"spade": [], "basket": [], "hat": []}
for i, a in enumerate(argv):
    if a == "--fit":
        assert argv[i + 1] in FITS, "--fit: spade, basket or hat"
        FITS[argv[i + 1]].append(argv[i + 2])

# the spade in its own frame: s runs along +Z from the middle of the grip to the blade's edge, the blade's
# width lies along X and its faces look along Y
SPADE_TILT = 25.0  # degrees from upright, the blade toward the person's left
SPADE_PIVOT = 0.42  # the point of the shaft that sits at the socket, from the grip: the grip end clears the hips
SPADE_CLEAR = 0.012  # metres between the back and the spade
BLADE = (0.70, 0.98)  # the wooden blade along s; the iron shoe ends 2 mm past it
SHOE = 0.74  # the shoe covers the blade from this share of its length
# the basket, socket-relative: rim height, height, half-axes (across, front to back) at the bottom and the rim
BASKET_TOP, BASKET_H = 0.14, 0.56
BASKET_RX, BASKET_RY = (0.13, 0.19), (0.11, 0.155)
BASKET_CLEAR = 0.012
STRAP_W, STRAP_T, STRAP_GAP = 0.032, 0.004, 0.004
# the hat, socket-relative: the band sits this far under the top of the skull, the crown rises this far
# above it, the brim reaches this far out
HAT_Z, HAT_CLEAR, HAT_CROWN, HAT_BRIM = -0.07, 0.008, 0.125, 0.105
# sizes measured on the first people (the digger, the forager), used when a prop has no --fit
DEFAULT = {"spade": (0.051, 0.079), "basket": (0.165, -0.03), "hat": (0.095, 0.113, 0.019)}
ARM = re.compile(r"(Left|Right)(Arm|ForeArm|Hand.*)")


def diag(*a):
    print("DIAG", *a, flush=True)


def short(name):
    return name.split(":")[-1]


# ---------------------------------------------------------------- maps, drawn in code
# Every map is an array whose row 0 is the bottom of the image (Blender's order), so +V is up and the normal
# maps follow the OpenGL convention glTF asks for (green up).


def tnoise(h, w, cy, cx, rng):
    """Tileable value noise in [0, 1]: h x w pixels over cy x cx cells, smoothstep between the cells."""
    g = rng.random((cy, cx))
    y = np.arange(h) * cy / h
    x = np.arange(w) * cx / w
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = y - y0, x - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    y1, x1 = (y0 + 1) % cy, (x0 + 1) % cx
    top = g[np.ix_(y0, x0)] * (1 - fx) + g[np.ix_(y0, x1)] * fx
    bot = g[np.ix_(y1, x0)] * (1 - fx) + g[np.ix_(y1, x1)] * fx
    return top * (1 - fy[:, None]) + bot * fy[:, None]


def fbm(h, w, cy, cx, rng, octaves=4):
    out, amp, tot = np.zeros((h, w)), 1.0, 0.0
    for o in range(octaves):
        out += amp * tnoise(h, w, min(h, cy << o), min(w, cx << o), rng)
        tot += amp
        amp *= 0.5
    return out / tot


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def normal_map(hgt, strength):
    """The tangent-space normal map of a tileable height field (OpenGL convention, green up)."""
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5 * strength
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5 * strength
    n = np.dstack([-dx, -dy, np.ones_like(hgt)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def tint(base, *factors):
    c = np.array(base, dtype=np.float64)[None, None, :]
    for f in factors:
        c = c * (f[..., None] if np.ndim(f) == 2 else f)
    return c


def draw_wood(rng, w=256, h=512):
    """Ash along the grain: one tile is about 0.1 m around a shaft and 0.25 m along it."""
    rings = (tnoise(h, w, 3, 20, rng) * 7 + tnoise(h, w, 8, 40, rng) * 0.6) % 1.0
    late = np.exp(-((rings - 0.5) / 0.09) ** 2)
    streak = tnoise(h, w, 6, 64, rng)
    fine = tnoise(h, w, 128, 128, rng)
    col = tint((0.76, 0.63, 0.46), 0.9 + 0.12 * streak, 1 - 0.2 * late, 0.96 + 0.06 * fine)
    return col, normal_map(0.5 * late + 0.25 * streak + 0.15 * fine, 1.6)


def draw_iron(rng, n=256):
    """Hammered iron with patches of rust: one tile is about 0.1 m."""
    m = fbm(n, n, 3, 3, rng, 5)
    rust = smooth(0.56, 0.72, m)
    dents = tnoise(n, n, 9, 9, rng)
    fine = tnoise(n, n, 96, 96, rng)
    iron = tint((0.27, 0.27, 0.285), 0.85 + 0.25 * dents)
    col = iron * (1 - rust[..., None]) + tint((0.43, 0.25, 0.15), 0.8 + 0.4 * fine) * rust[..., None]
    return col, normal_map(0.7 * dents + 0.25 * fine + 0.2 * rust, 2.5)


def draw_wrap(rng, n=256):
    """A strip of indigo cloth wound round a grip: one tile is once round the bar and 0.04 m along it."""
    y, x = np.mgrid[0:n, 0:n] / n
    d = (x + 4 * y) % 1.0
    ridge = np.sin(np.pi * d) ** 0.5
    weave = (np.sin(np.pi * x * 48) * np.sin(np.pi * y * 48)) * 0.5 + 0.5
    fade = tnoise(n, n, 4, 4, rng)
    col = tint((0.17, 0.2, 0.37), 0.6 + 0.4 * ridge, 0.92 + 0.12 * weave, 0.9 + 0.2 * fade)
    return col, normal_map(0.8 * ridge + 0.1 * weave, 5.0)


def draw_leather(rng, w=256, h=512):
    """A stitched leather strap: U runs across it (0 to 1 is its width), one tile is twice its width along."""
    y, x = np.mgrid[0:h, 0:w]
    u, v = x / w, y / h
    edge = np.clip(np.minimum(u, 1 - u) / 0.08, 0, 1)
    seam = (np.abs(u - 0.14) < 0.016) | (np.abs(u - 0.86) < 0.016)
    stitch = seam & ((v * 12) % 1.0 < 0.62)
    grain = fbm(h, w, 32, 16, rng, 3)
    wear = tnoise(h, w, 4, 2, rng)
    hgt = np.sqrt(edge) * 0.7 + 0.12 * grain - 0.18 * seam + 0.3 * stitch
    col = tint((0.34, 0.2, 0.11), 0.85 + 0.25 * grain, 1 + 0.25 * (1 - edge) * wear, 1 - 0.25 * seam)
    col[stitch] = (0.62, 0.52, 0.36)
    return col, normal_map(hgt, 6.0)


def draw_wicker(rng, n=512):
    """Plain-woven willow: one tile is four stakes across and fourteen rows of weavers up. Each weaver
    swells out where it passes over a stake and sinks behind the next, the next row the other way round."""
    y, x = np.mgrid[0:n, 0:n] / n
    su, rv = x * 4, y * 14
    r = np.floor(rv).astype(int)
    fr = rv - r
    bulge = np.sin(np.pi * fr) ** 0.65
    over = np.cos(np.pi * (su - 0.5) + np.pi * r)
    weaver = bulge * (0.72 + 0.28 * over)
    k = (su % 1.0) - 0.5
    stake = np.where(over < -0.2, 0.95 * np.sqrt(np.clip(1 - (k / 0.13) ** 2, 0, 1)), 0)
    on_stake = stake > weaver
    hgt = np.maximum(weaver, stake)
    rod = ((np.floor(su).astype(int) + rng.integers(0, 4, 14)[r]) // 2) % 2
    shade = rng.uniform(0.8, 1.12, (14, 2))[r, rod]
    grey = rng.uniform(0.0, 0.45, (14, 2))[r, rod]
    grain = tnoise(n, n, 56, 6, rng)
    base = np.array((0.69, 0.53, 0.33))
    weathered = np.array((0.58, 0.53, 0.42))
    col = base * (1 - grey[..., None]) + weathered * grey[..., None]
    col = col * (shade * (0.9 + 0.18 * grain))[..., None]
    col[on_stake] = col[on_stake] * 0.82
    col = col * (0.32 + 0.68 * hgt ** 0.6)[..., None]
    return col, normal_map(hgt + 0.08 * grain, 7.0)


def draw_cloth(rng, base, n=256, threads=64):
    """Coarse plain-woven cloth, threads across the tile each way, a little uneven in thread and dye."""
    y, x = np.mgrid[0:n, 0:n] / n
    sx, sy = np.sin(np.pi * x * threads), np.sin(np.pi * y * threads)
    warp, weft = np.abs(sx) ** 0.6, np.abs(sy) ** 0.6
    hgt = np.where(sx * sy > 0, 0.8 * warp + 0.2 * weft, 0.8 * weft + 0.2 * warp)
    slub = tnoise(n, n, 4, threads, rng) * 0.5 + tnoise(n, n, threads, 4, rng) * 0.5
    dye = fbm(n, n, 3, 3, rng, 4)
    col = tint(base, 0.82 + 0.2 * hgt, 0.88 + 0.24 * dye, 0.94 + 0.12 * slub)
    return col, normal_map(hgt * 0.6 + 0.3 * slub, 3.0)


def draw_felt(rng, base, n=512):
    """Felt: soft mottling and a fine fuzz."""
    mottle = fbm(n, n, 3, 3, rng, 5)
    fuzz = tnoise(n, n, 160, 160, rng)
    col = tint(base, 0.84 + 0.26 * mottle, 0.95 + 0.1 * fuzz)
    return col, normal_map(0.5 * mottle + 0.3 * fuzz, 1.5)


def draw_band(rng, w=256, h=128):
    """A grosgrain ribbon: fine ribs across it; U runs along the ribbon."""
    y, x = np.mgrid[0:h, 0:w]
    rib = np.abs(np.sin(np.pi * (x / w) * 72)) ** 0.7
    mottle = tnoise(h, w, 2, 6, rng)
    col = tint((0.2, 0.235, 0.13), 0.78 + 0.25 * rib, 0.92 + 0.16 * mottle)
    return col, normal_map(rib, 2.0)


def image(name, rgb, data=False):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    if data:
        img.colorspace_settings.name = "Non-Color"
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(px.ravel())
    return img


def material(name, maps, rough, metal=0.0, two_sided=False):
    """A principled material from a (colour, normal) pair of maps."""
    col, nrm = maps
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = not two_sided
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexImage")
    tc.image = image(name + "_color", col)
    nt.links.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.image = image(name + "_normal", nrm, data=True)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    nt.nodes.active = tc  # what a workbench render shows
    return m


# ---------------------------------------------------------------- shapes


class Part:
    """One prop: a bmesh with a UV layer, built from grids of points, and the materials its faces use."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.verify()
        self.mats = []

    def grid(self, P, UV, mat, flip=False, smooth_faces=True):
        """Quads between neighbouring points of a (rows, cols) grid; a row whose points coincide is one
        vertex (a pole). Without flip a face looks to the left of the rows' direction when the columns run
        counter-clockwise round it: a lathe whose rows rise and whose columns turn counter-clockwise seen
        from above looks outward. Points that repeat (a closing column) are welded; the UVs stay apart."""
        if mat not in self.mats:
            self.mats.append(mat)
        k = self.mats.index(mat)
        rows, cols = P.shape[:2]
        V = []
        for i in range(rows):
            if np.ptp(P[i], axis=0).max() < 1e-9:
                V.append([self.bm.verts.new(tuple(map(float, P[i, 0])))] * cols)
            else:
                V.append([self.bm.verts.new(tuple(map(float, p))) for p in P[i]])
        for i in range(rows - 1):
            for j in range(cols - 1):
                vs, uv = [], []
                for a, b in ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)):
                    if V[a][b] not in vs:
                        vs.append(V[a][b])
                        uv.append(UV[a, b])
                if len(vs) < 3:
                    continue
                if flip:
                    vs.reverse()
                    uv.reverse()
                try:
                    f = self.bm.faces.new(vs)
                except ValueError:
                    continue
                f.material_index = k
                f.smooth = smooth_faces
                for loop, t in zip(f.loops, uv):
                    loop[self.uv].uv = (float(t[0]), float(t[1]))
        made = list(dict.fromkeys(v for row in V for v in row))  # in order, so a rebuild writes the same file
        bmesh.ops.remove_doubles(self.bm, verts=made, dist=1e-7)
        return [v for v in made if v.is_valid]

    def lathe(self, prof, n, mat, ku, vlen, flip=False):
        """A surface of revolution about Z: prof is a list of rows (rx, ry, cy, z), an ellipse of half-axes
        rx, ry centred at (0, cy) at height z. U goes ku times round, V is the length along the profile
        over vlen."""
        th = np.linspace(0, 2 * np.pi, n + 1)
        prof = np.asarray(prof, dtype=np.float64)
        P = np.zeros((len(prof), n + 1, 3))
        P[:, :, 0] = prof[:, 0:1] * np.cos(th)
        P[:, :, 1] = prof[:, 2:3] + prof[:, 1:2] * np.sin(th)
        P[:, :, 2] = prof[:, 3:4]
        step = np.hypot(np.diff(prof[:, 0]), np.diff(prof[:, 3]))
        v = np.concatenate([[0], np.cumsum(step)]) / vlen
        UV = np.dstack([np.broadcast_to(ku * th / (2 * np.pi), P.shape[:2]), np.broadcast_to(v[:, None], P.shape[:2])])
        return self.grid(P, UV, mat, flip)

    def build(self, name, socket=None, parent=None, wearer=None):
        """The mesh object: a prop's top node names its socket; a copy fitted to one person hangs under
        it, named by the person's look."""
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        if socket:
            ob["socket"] = socket
        if wearer:
            ob["wearer"] = wearer
        ob.parent = parent
        return ob


def frame_along(d):
    """A rotation that turns +Z to the direction d."""
    return Vector((0, 0, 1)).rotation_difference(Vector(d)).to_matrix().to_4x4()


def dome(part, mat, at, normal, r):
    """A small rivet head at `at`, bulging along `normal`."""
    prof = [(r, r, 0, 0), (0.9 * r, 0.9 * r, 0, 0.35 * r), (0.6 * r, 0.6 * r, 0, 0.7 * r), (0, 0, 0, 0.8 * r)]
    made = part.lathe(prof, 8, mat, 1, 0.05)
    bmesh.ops.transform(part.bm, matrix=Matrix.Translation(Vector(at)) @ frame_along(normal), verts=made)


# ---------------------------------------------------------------- the spade


def spade_hw(s):
    """Half the width of the spade across its face at s, for the fit (shaft, collar, blade)."""
    u = (s - BLADE[0]) / (BLADE[1] - BLADE[0])
    return np.where(s < 0.03, 0.075, np.where(s < 0.64, 0.019, np.where(s < BLADE[0], 0.023, blade_hw(u) + 0.002)))


def spade_ht(s):
    u = (s - BLADE[0]) / (BLADE[1] - BLADE[0])
    return np.where(s < 0.64, 0.018, np.where(s < BLADE[0], 0.023, blade_ht(np.clip(u, 0, 1)) + 0.002))


def blade_hw(u):
    u = np.clip(u, 0, 1)
    shoulder = np.sin(np.pi / 2 * np.clip(u / 0.2, 0, 1))
    return (0.019 + 0.064 * shoulder) * (1 - 0.18 * np.clip((u - 0.93) / 0.07, 0, 1) ** 2)


def blade_ht(u):
    return (0.012 - 0.0055 * u) * (1 - 0.8 * np.clip((u - 0.88) / 0.12, 0, 1) ** 1.5)


def spade_matrix(a, lean):
    """The spade's frame into the person's: tilted toward the left, leaned toward the back, its pivot at
    the socket and `a` behind it."""
    return (Matrix.Translation((0, a, 0)) @ Matrix.Rotation(math.radians(SPADE_TILT), 4, "Y")
            @ Matrix.Rotation(lean, 4, "X") @ Matrix.Translation((0, 0, -SPADE_PIVOT)))


def fit_spade(V):
    """The spade's offset behind the socket and its lean: the smallest offset that keeps SPADE_CLEAR
    between every back vertex under the spade and the spade, at the lean that hugs the back best."""
    best = None
    for lean in np.radians(np.arange(-4, 12.01, 0.5)):
        R = np.array(spade_matrix(0.0, lean))
        q = (V - R[:3, 3]) @ R[:3, :3]  # into the spade's frame
        s, x, d = q[:, 2], q[:, 0], q[:, 1]
        under = (s > -0.02) & (s < BLADE[1] + 0.02) & (np.abs(x) < spade_hw(s) + 0.01)
        if not under.any():
            continue
        need = (d + spade_ht(s) + SPADE_CLEAR)[under] / math.cos(lean)
        a = need.max()
        bins = np.floor(s[under] / 0.03).astype(int)
        gap = np.mean([a - need[bins == b].max() for b in np.unique(bins)])
        if best is None or gap < best[0]:
            best = (gap, a, lean)
    if best is None:
        return DEFAULT["spade"]
    diag("spade fit: offset %.3f m behind the socket, lean %.1f deg, mean gap to the back %.1f mm" % (
        best[1], math.degrees(best[2]), best[0] * 1000))
    return best[1], best[2]


def build_spade(fit, mats):
    a, lean = fit
    wood, iron, wrap, leather = mats["wood"], mats["iron"], mats["wrap"], mats["leather"]
    P = Part()
    # the T grip: a wooden bar across the top of the shaft, wrapped in cloth where the hands go
    bar = [(0, 0, 0, -0.072)] + [(0.0135 * math.sin(t), 0.0135 * math.sin(t), 0, -0.0585 - 0.0135 * math.cos(t))
                                 for t in np.linspace(0.35, np.pi / 2, 4)]
    bar += [(r, r, 0, -z) for r, _, _, z in reversed(bar)]
    made = P.lathe(bar, 12, wood, 1, 0.25)
    made += P.lathe([(0.0128, 0.0128, 0, -0.058), (0.0163, 0.0163, 0, -0.055), (0.0163, 0.0163, 0, 0.055),
                     (0.0128, 0.0128, 0, 0.058)], 12, wrap, 1, 0.04)
    for v in made:  # lay the bar across: its axis (Z) along X
        v.co = Vector((v.co.z, v.co.x, v.co.y))
    # the shaft, a little thicker toward the blade
    P.lathe([(0.0155 + 0.0015 * s / 0.7, 0.0155 + 0.0015 * s / 0.7, 0, s) for s in np.linspace(0.0, 0.705, 12)],
            12, wood, 1, 0.25)
    # two leather bands round the shaft where it is strapped
    for s0 in (0.3, 0.56):
        th = np.linspace(0, 2 * np.pi, 13)
        rz = [(0.0158, s0 - 0.011), (0.0182, s0 - 0.009), (0.0182, s0 + 0.009), (0.0158, s0 + 0.011)]
        G = np.array([[(r * math.cos(t), r * math.sin(t), z) for t in th] for r, z in rz])
        UV = np.array([[((z - s0 + 0.011) / 0.022, t * 0.018 / 0.064) for t in th] for r, z in rz])
        P.grid(G, UV, leather)
    # the iron collar the blade sits in
    P.lathe([(0.0166, 0.0166, 0, 0.650), (0.0196, 0.0196, 0, 0.655), (0.0199, 0.0199, 0, 0.661),
             (0.0193, 0.0193, 0, 0.667), (0.0206, 0.0206, 0, 0.705), (0.0216, 0.0216, 0, 0.716),
             (0.012, 0.012, 0, 0.722), (0, 0, 0, 0.723)], 12, iron, 1, 0.1)
    # the blade: a loft of rounded, flat-faced sections, broad shoulders, thinning to the edge
    phi = np.linspace(0, 2 * np.pi, 25)

    def section(s, grow=0.0):
        u = (s - BLADE[0]) / (BLADE[1] - BLADE[0])
        hw, ht = blade_hw(u) + grow, blade_ht(np.clip(u, 0, 1)) + grow
        return np.stack([hw * np.cos(phi), ht * np.sign(np.sin(phi)) * np.abs(np.sin(phi)) ** 0.55,
                         np.full_like(phi, s)], axis=1)

    def loft(ss, grow, mat, end):
        rows = [np.tile([0, 0, ss[0]], (len(phi), 1))] + [section(s, grow) for s in ss]
        rows.append(np.tile([0, 0, end], (len(phi), 1)))
        G = np.array(rows)
        UV = np.dstack([G[:, :, 0] / 0.1 + 0.5, G[:, :, 2] / 0.25])
        P.grid(G, UV, mat)

    span = BLADE[1] - BLADE[0]
    ss = BLADE[0] + span * np.array([0, 0.02, 0.05, 0.09, 0.14, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.88, 0.94, 1.0])
    loft(ss[:-1], 0.0, wood, ss[-2])
    # the iron shoe over the end of the blade, 1.7 mm proud of the wood and 2 mm past it
    sh = BLADE[0] + span * np.array([SHOE, SHOE + 0.01, 0.8, 0.86, 0.91, 0.95, 0.98, 1.0])
    loft(np.append(sh, BLADE[1] + 0.002), 0.0017, iron, BLADE[1] + 0.002)
    for side in (1, -1):
        s_r = BLADE[0] + span * 0.84
        u_r = 0.84
        for x in (-0.045, 0.0, 0.045):
            t = blade_ht(u_r) * (1 - (x / blade_hw(u_r)) ** 2) ** 0.275 + 0.0017
            dome(P, iron, (x, side * t, s_r), (0, side, 0), 0.0042)
        dome(P, iron, (0, side * 0.0204, 0.69), (0, side, 0), 0.0036)
    bmesh.ops.transform(P.bm, matrix=spade_matrix(a, lean), verts=P.bm.verts)
    return P.build("spade", "socket_back")


# ---------------------------------------------------------------- the basket


def basket_r(t):
    """The basket's half-axes (across, front to back) at the share t of its height from the bottom."""
    belly = np.sin(np.pi * np.clip(t, 0, 1))
    rx = BASKET_RX[0] + (BASKET_RX[1] - BASKET_RX[0]) * t + 0.008 * belly
    ry = BASKET_RY[0] + (BASKET_RY[1] - BASKET_RY[0]) * t + 0.006 * belly
    return rx, ry


def fit_basket(V):
    """The basket's axis (y = a + b (z - middle)): the line closest to the back that keeps BASKET_CLEAR
    between every back vertex in front of the basket and its front face."""
    z0 = BASKET_TOP - BASKET_H
    zm = BASKET_TOP - BASKET_H / 2
    sel = (V[:, 2] > z0) & (V[:, 2] < BASKET_TOP)
    t = (V[sel, 2] - z0) / BASKET_H
    rx, ry = basket_r(t)
    x, y, z = V[sel, 0], V[sel, 1], V[sel, 2]
    inside = np.abs(x) < rx
    need = (y + BASKET_CLEAR + ry * np.sqrt(np.clip(1 - (x / rx) ** 2, 0, 1)))[inside]
    z = z[inside]
    bins = np.floor((z - z0) / 0.03).astype(int)
    best = None
    for b in np.arange(-0.25, 0.2501, 0.01):
        a = (need - b * (z - zm)).max()
        gap = np.mean([(a + b * (z[bins == k] - zm) - need[bins == k]).min() for k in np.unique(bins)])
        if best is None or gap < best[0]:
            best = (gap, a, b)
    diag("basket fit: axis %.3f m behind the socket at mid height, leaning %.1f deg, mean gap %.1f mm" % (
        best[1], math.degrees(math.atan(-best[2])), best[0] * 1000))
    return best[1], best[2]


def basket_front(fit, x, z):
    """The y of the basket's front face (the side on the back) at x, z."""
    a, b = fit
    t = (z - (BASKET_TOP - BASKET_H)) / BASKET_H
    rx, ry = basket_r(t)
    return a + b * (z - (BASKET_TOP - BASKET_H / 2)) - ry * math.sqrt(max(0.0, 1 - (x / rx) ** 2))


def cast(bvhs, origin, direction):
    """The first hit from outside over every fitted body: (point, normal) or None. A face met from behind
    is passed through: the bodies are open where the arms were left out, and a ray that enters there must
    not land on the inside of the far side."""
    d = Vector(direction).normalized()
    best = None
    for bvh in bvhs:
        o = Vector(origin)
        for _ in range(8):
            loc, nrm, _, dist = bvh.ray_cast(o, d)
            if loc is None:
                break
            if nrm.dot(d) < 0:
                far = (loc - Vector(origin)).length
                if best is None or far < best[0]:
                    best = (far, np.array(loc), np.array(nrm))
                break
            o = loc + d * 1e-4
    return None if best is None else best[1:]


def strap_path(bvhs, fit, side):
    """The centre line of one strap (side +1: the person's left) and its outward normals, socket-relative.
    It leaves the basket's front face high up, climbs the back, crosses the shoulder, runs down the chest
    and round the side under the arm to the basket's front face low down; every point keeps STRAP_GAP
    plus half the strap off the bodies (the arms left out)."""
    off = STRAP_GAP + STRAP_T / 2
    pts, nrms = [], []
    top = np.array([side * 0.085, basket_front(fit, side * 0.085, 0.07) + 0.01, 0.07])
    pts.append(top)
    nrms.append(np.array([0.0, 1.0, 0.0]))
    c = np.array([side * 0.115, -0.12, -0.03])
    for al in np.radians(np.arange(25, 156, 10)):
        d = np.array([0.0, math.cos(al), math.sin(al)])
        hit = cast(bvhs, c + d * 0.5, -d)
        if hit is not None and hit[0][2] > top[2] + 0.02:
            pts.append(hit[0] + hit[1] * off)
            nrms.append(hit[1])
    for k, z in enumerate((-0.03, -0.07, -0.105)):
        hit = cast(bvhs, (side * (0.125 + 0.0125 * k), -0.6, z), (0, 1, 0))
        if hit is not None:
            pts.append(hit[0] + hit[1] * off)
            nrms.append(hit[1])
    x_front = abs(pts[-1][0])  # round the side from here: only hits beside or behind the chest, on this side
    for be in np.radians(np.arange(50, 151, 10)):
        z = -0.12 - 0.05 * (math.degrees(be) - 50) / 100
        d = np.array([side * math.sin(be), -math.cos(be), 0.0])
        hit = cast(bvhs, np.array([0.0, -0.13, z]) + d * 0.5, -d)
        if hit is not None and side * hit[0][0] > 0 and (side * hit[0][0] > x_front - 0.01 or hit[0][1] > -0.12):
            pts.append(hit[0] + hit[1] * off)
            nrms.append(hit[1])
    low = np.array([side * 0.1, basket_front(fit, side * 0.1, -0.22) + 0.01, -0.22])
    pts.append(low)
    nrms.append(np.array([0.0, 1.0, 0.0]))
    pts, nrms = np.array(pts), np.array(nrms)
    # an even polyline, smoothed, then pushed out where smoothing pulled it in
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    ss = np.linspace(0, s[-1], max(8, int(s[-1] / 0.006)))
    P = np.stack([np.interp(ss, s, pts[:, k]) for k in range(3)], axis=1)
    N = np.stack([np.interp(ss, s, nrms[:, k]) for k in range(3)], axis=1)
    for _ in range(12):
        P[1:-1] = P[1:-1] * 0.5 + (P[:-2] + P[2:]) * 0.25
        N[1:-1] = N[1:-1] * 0.5 + (N[:-2] + N[2:]) * 0.25
    for i in range(2, len(P) - 2):  # the ends sit in the basket
        for bvh in bvhs:
            loc, nrm, _, dist = bvh.find_nearest(Vector(P[i]))
            if loc is None:
                continue
            sd = (Vector(P[i]) - loc).dot(nrm)
            if sd < off:
                P[i] = P[i] + np.array(nrm) * (off - sd)
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    return P, N, len(pts)


def strap(part, mat, P, N):
    """A flat strap of STRAP_W x STRAP_T along the centre line P, lying on the surface whose outward
    normals are N."""
    t = np.gradient(P, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    w = np.cross(t, N)
    w /= np.linalg.norm(w, axis=1, keepdims=True)
    n = np.cross(w, t)
    hw, ht = STRAP_W / 2, STRAP_T / 2
    corners = [(-hw, ht, 0.0), (hw, ht, 1.0), (hw, -ht, 1.0), (-hw, -ht, 0.0), (-hw, ht, 0.0)]
    G = np.stack([P + w * cw + n * cn for cw, cn, _ in corners], axis=1)
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    UV = np.stack([np.stack([np.full(len(P), cu), s / (2 * STRAP_W)], axis=1) for _, _, cu in corners], axis=1)
    part.grid(G, UV, mat)


def build_basket(fit, wearers, mats):
    """The basket, one shape for everyone, and under it a pair of straps for each (look, bodies) in
    wearers, fitted to those bodies."""
    a, b = fit
    z0, z1 = BASKET_TOP - BASKET_H, BASKET_TOP
    zm = (z0 + z1) / 2
    P = Part()

    def row(z, grow=0.0, share=1.0):
        rx, ry = basket_r((z - z0) / BASKET_H)
        return ((rx + grow) * share, (ry + grow) * share, a + b * (z - zm), z)

    # the willow outside, from the middle of the bottom round its edge up to under the fold of the lining
    wall = [row(z0 + 0.006, share=0), row(z0 + 0.002, share=0.5), row(z0, share=0.86), row(z0 + 0.006, share=0.97),
            row(z0 + 0.02)]
    wall += [row(z) for z in np.linspace(z0 + 0.04, z1 - 0.012, 26)]
    th = np.linspace(0, 2 * np.pi, 49)
    G = np.array([[(rx * math.cos(t), cy + ry * math.sin(t), z) for t in th] for rx, ry, cy, z in wall])
    v = np.array([z for _, _, _, z in wall]) - z0
    v[:5] = -np.array([0.19, 0.12, 0.05, 0.02, 0.0]) * 0.8
    UV = np.dstack([np.broadcast_to(7 * th / (2 * np.pi), G.shape[:2]), np.broadcast_to(v[:, None] / 0.154,
                                                                                     G.shape[:2])])
    P.grid(G, UV, mats["wicker"])
    # the lining: up the inside, over the rim, down the outside to a wavy hem
    inner = [row(z0 + 0.016, share=0), row(z0 + 0.016, -0.013, 0.55), row(z0 + 0.017, -0.013, 0.92),
             row(z0 + 0.03, -0.013)]
    inner += [row(z, -0.014) for z in np.linspace(z0 + 0.05, z1 - 0.003, 13)]
    rows = [(rx, ry, cy, z, 0.0) for rx, ry, cy, z in inner]
    for psi in np.radians(np.arange(150, -1, -30)):
        rx, ry, cy, _ = row(z1)
        d = -0.002 + 0.012 * math.cos(psi)
        rows.append((rx + d, ry + d, cy, z1 - 0.003 + 0.012 * math.sin(psi), 0.0))
    for k, (zz, g) in enumerate(((z1 - 0.016, 0.0065), (z1 - 0.03, 0.0055), (z1 - 0.045, 0.005))):
        rx, ry, cy, _ = row(zz)
        rows.append((rx + g, ry + g, cy, zz, (k + 1) / 3))
    R = np.array(rows)
    wob = 0.002 * np.sin(14 * th + 0.3)
    hem = 0.011 * np.sin(7 * th + 0.6) + 0.004 * np.sin(17 * th + 1.0)
    G = np.zeros((len(R), len(th), 3))
    for i, (rx, ry, cy, z, k) in enumerate(R):
        G[i, :, 0] = (rx + k * wob) * np.cos(th)
        G[i, :, 1] = cy + (ry + k * wob) * np.sin(th)
        G[i, :, 2] = z + k * hem
    step = np.hypot(np.diff(R[:, 0]), np.diff(R[:, 3]))
    v = np.concatenate([[0], np.cumsum(step)]) / 0.06
    UV = np.dstack([np.broadcast_to(16 * th / (2 * np.pi), G.shape[:2]), np.broadcast_to(v[:, None], G.shape[:2])])
    P.grid(G, UV, mats["lining"], flip=True)
    ob = P.build("basket", "socket_back")
    for look, bvhs in wearers:
        S = Part()
        for side in (1, -1):
            C, N, hits = strap_path(bvhs, fit, side)
            strap(S, mats["leather"], C, N)
            diag("strap", look, "left" if side > 0 else "right", "stations", hits, "length %.2f m" % (
                np.linalg.norm(np.diff(C, axis=0), axis=1).sum()))
        S.build("straps-" + look, parent=ob, wearer=look)
    return ob


# ---------------------------------------------------------------- the hat


def fit_hat(heads, who="-"):
    """The opening of the hat at its band: half-axes and the centre's offset behind the socket, the head
    at HAT_Z plus HAT_CLEAR all round, over every head given."""
    xs, ylo, yhi = [], [], []
    for H in heads:
        s = np.abs(H[:, 2] - HAT_Z) < 0.006
        xs.append(np.abs(H[s, 0]).max())
        ylo.append(H[s, 1].min())
        yhi.append(H[s, 1].max())
    A = max(xs) + HAT_CLEAR
    lo, hi = min(ylo), max(yhi)
    B, yc = (hi - lo) / 2 + HAT_CLEAR, (hi + lo) / 2
    diag("hat fit", who, "opening %.3f x %.3f m, centre %.3f m behind the socket" % (2 * A, 2 * B, yc))
    return A, B, yc


def crown_f(t):
    """The crown's half-axes at the share t of its height, as a share of those at the band: round, uncreased."""
    t = np.clip(t, 0, 1)
    return (1 - t ** 2.6) ** (1 / 2.6) * (1 - 0.06 * t)


def build_hat(fit, mats, name="hat", socket="socket_head", parent=None, wearer=None):
    A, B, yc = fit
    P = Part()
    th = np.linspace(0, 2 * np.pi, 49)
    droop = 0.028 - 0.010 * np.cos(2 * th) + 0.004 * np.sin(3 * th + 1.0)  # deeper in front and behind
    rows = []  # (rx, ry, z, droop share) from the top of the crown, outside, round to the top inside
    A1, B1 = A + 0.006, B + 0.006
    for t in np.sin(np.linspace(np.pi / 2, 0, 15)):
        f = crown_f(t)
        rows.append((A1 * f, B1 * f, HAT_Z + 0.002 + HAT_CROWN * t, 0.0))
    for q in np.linspace(0, 1, 9)[1:]:
        rows.append((A1 + HAT_BRIM * q, B1 + HAT_BRIM * q, HAT_Z + 0.002, q * q))
    for psi in np.radians((45, 0, -45)):
        d = 0.002 * math.cos(psi)
        rows.append((A1 + HAT_BRIM + d, B1 + HAT_BRIM + d, HAT_Z + 0.002 * math.sin(psi), 1.0))
    for q in np.linspace(1, 0, 9):
        rows.append((A + (HAT_BRIM + 0.006) * q, B + (HAT_BRIM + 0.006) * q, HAT_Z - 0.002, q * q))
    for t in np.sin(np.linspace(0, np.pi / 2, 13))[1:]:
        f = crown_f(t)
        rows.append((A * f, B * f, HAT_Z - 0.002 + (HAT_CROWN - 0.006) * t, 0.0))
    R = np.array(rows)
    G = np.zeros((len(R), len(th), 3))
    for i, (rx, ry, z, k) in enumerate(R):
        G[i, :, 0] = rx * np.cos(th)
        G[i, :, 1] = yc + ry * np.sin(th)
        G[i, :, 2] = z - k * droop
    step = np.hypot(np.diff(R[:, 0]), np.diff(R[:, 2]))
    v = np.concatenate([[0], np.cumsum(step)]) / 0.08
    UV = np.dstack([np.broadcast_to(6 * th / (2 * np.pi), G.shape[:2]), np.broadcast_to(v[:, None], G.shape[:2])])
    P.grid(G, UV, mats["felt"], flip=True)
    # the band, a ribbon round the foot of the crown
    band = []
    for z, d in ((0.0035, -0.001), (0.006, 0.0025), (0.022, 0.0025), (0.0245, -0.001)):
        f = crown_f((z - 0.002) / HAT_CROWN)
        band.append((A1 * f + d, B1 * f + d, yc, HAT_Z + z))
    P.lathe(band, 48, mats["band"], 12, 0.026)
    return P.build(name, socket, parent, wearer)


# ---------------------------------------------------------------- people


def look_of(path):
    """The look a person file stands for, as the trial names it: character-forager-f.glb -> forager-f."""
    return re.sub(r"^character-", "", os.path.basename(path)).rsplit(".", 1)[0]


def import_person(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    fig = [o for o in new if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)][0]
    arm = [o for o in new if o.type == "ARMATURE"][0]
    sockets = {o.name.split(".")[0]: o for o in new if o.name.startswith("socket_")}
    return new, fig, arm, sockets


def arm_share(fig):
    """Per vertex, the weight it takes from the arm bones (upper arm, forearm, hand)."""
    groups = {g.index for g in fig.vertex_groups if ARM.fullmatch(short(g.name))}
    return np.array([sum(e.weight for e in v.groups if e.group in groups) for v in fig.data.vertices])


def evaluated_co(fig):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = fig.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    return co.reshape(-1, 3)


def play(arm, act):
    """Poses the armature by one clip from now on (frame_set picks the frame)."""
    ad = arm.animation_data_create()
    for tr in ad.nla_tracks:
        tr.mute = True
    ad.action = act
    if act is not None and hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
        ad.action_slot = act.slots[0]
    return ad


def measure(path):
    """A person's body (the arms left out) in the rest pose, relative to each socket, and BVHs of it
    relative to socket_back for the straps: the rest pose and five frames of Idle, the pose the people
    stand in most of the time (the shoulders and the chest sit a little off the rest pose there)."""
    acts = set(bpy.data.actions)
    new, fig, arm, sockets = import_person(path)
    clips = {a.name.split(".")[0]: a for a in bpy.data.actions if a not in acts}
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    mw = np.array(fig.matrix_world)
    co = evaluated_co(fig) @ mw[:3, :3].T + mw[:3, 3]
    body = arm_share(fig) < 0.5
    polys = [tuple(p.vertices) for p in fig.data.polygons if body[list(p.vertices)].all()]
    sb = np.array(sockets["socket_back"].matrix_world.translation)
    sh = np.array(sockets["socket_head"].matrix_world.translation)
    out = {"back": co[body] - sb, "head": co[body] - sh,
           "bvhs": [BVHTree.FromPolygons([Vector(c) for c in co - sb], polys)]}
    idle = clips.get("Idle")
    if idle is not None:
        play(arm, idle)
        arm.data.pose_position = "POSE"
        f0, f1 = idle.frame_range
        for f in np.linspace(f0, f1, 6)[:-1]:
            bpy.context.scene.frame_set(int(round(f)))
            S = np.array(sockets["socket_back"].matrix_world.inverted() @ fig.matrix_world)
            out["bvhs"].append(BVHTree.FromPolygons(
                [Vector(c) for c in evaluated_co(fig) @ S[:3, :3].T + S[:3, 3]], polys))
    diag("person", os.path.basename(path), "vertices", len(co), "body", int(body.sum()), "socket_back",
         np.round(sb, 3).tolist(), "socket_head", np.round(sh, 3).tolist(), "strap poses", len(out["bvhs"]))
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in clips.values():
        bpy.data.actions.remove(a)
    return out


# ---------------------------------------------------------------- check


def select_only(objs, active):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def check(person, prop):
    new, fig, arm, sockets = import_person(person)
    acts_before = set(bpy.data.actions)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=prop)
    got = [o for o in bpy.data.objects if o not in before]
    pm = [o for o in got if "socket" in o.keys()][0]
    # the copy fitted to this person (the first copy when none is) stays, the others go
    copies = [o for o in got if "wearer" in o.keys()]
    mine = next((o for o in copies if o["wearer"] == look_of(person)), copies[0] if copies else None)
    for o in copies:
        if o is not mine:
            bpy.data.objects.remove(o, do_unlink=True)
    clips = [a for a in bpy.data.actions if a not in acts_before]
    for a in clips:  # a prop has no clips; anything new here came with it
        bpy.data.actions.remove(a)
    clips = sorted(bpy.data.actions, key=lambda a: a.name)
    sock = sockets[pm["socket"]]
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    parts = [o for o in [pm] + list(pm.children_recursive) if o.type == "MESH"]
    rel = {o: pm.matrix_world.inverted() @ o.matrix_world for o in parts}
    pm.parent = sock
    pm.matrix_parent_inverse = Matrix.Identity(4)
    pm.matrix_basis = Matrix.Identity(4)
    body = arm_share(fig) < 0.5
    polys = [tuple(p.vertices) for p in fig.data.polygons]
    on_arm = [body[list(p)].mean() < 0.5 for p in polys]
    pv, vmat = [], []  # every vertex of the prop in its top node's frame, and the material it shows
    for o in parts:
        pv += [rel[o] @ v.co for v in o.data.vertices]
        k = np.zeros(len(o.data.vertices), dtype=int)
        for p in o.data.polygons:
            k[list(p.vertices)] = p.material_index
        vmat += [o.data.materials[i].name for i in k]
    diag("check", os.path.basename(person), os.path.basename(prop), "on", sock.name, "copy",
         mine["wearer"] if mine else "-", "prop vertices", len(pv), "materials", list(dict.fromkeys(vmat)),
         "clips", [a.name for a in clips])

    ray = Vector((0.31, 0.22, 0.92)).normalized()

    def crossings(tree, q):
        n, o = 0, q.copy()
        while n < 50:
            loc = tree.ray_cast(o, ray)[0]
            if loc is None:
                return n
            n += 1
            o = loc + ray * 1e-5
        return n

    def clearance():
        """(closest signed distance, its vertex, vertices inside) to the body and to the arms: the nearest face
        of the whole figure gives the distance and the part, its side the sign, and a point that seems inside
        must also cross the figure an odd number of times along a ray."""
        tree = BVHTree.FromPolygons([Vector(c) for c in evaluated_co(fig)], polys)
        M = fig.matrix_world.inverted() @ pm.matrix_world
        best = [(1e9, -1), (1e9, -1)]
        inside = [0, 0]
        for i, p in enumerate(pv):
            q = M @ p
            loc, nrm, k, dist = tree.find_nearest(q)
            if loc is None:
                continue
            sd = dist if (q - loc).dot(nrm) >= 0 or crossings(tree, q) % 2 == 0 else -dist
            part = int(on_arm[k])
            inside[part] += sd < 0
            if sd < best[part][0]:
                best[part] = (sd, i)
        return [(best[k][0], best[k][1], inside[k]) for k in (0, 1)]

    def report(tag, worst, frames):
        for (sd, i, inside, f), part in zip(worst, ("body", "arms")):
            at = np.round(np.array(pv[i]), 3).tolist() if i >= 0 else None
            diag("clear", tag, part, "min %+.1f mm" % (sd * 1000) if i >= 0 else "min none", "frame", f, "at", at,
                 vmat[i] if i >= 0 else "-", "inside (vertex-frames)", inside, "of", len(pv) * frames)

    play(arm, None)
    r = clearance()
    report("rest", [(sd, i, n, "rest") for sd, i, n in r], 1)
    arm.data.pose_position = "POSE"
    closest = {}
    for act in clips:
        play(arm, act)
        f0, f1 = (int(round(x)) for x in act.frame_range)
        worst = [(1e9, -1, 0, f0), (1e9, -1, 0, f0)]
        for f in range(f0, f1 + 1):
            bpy.context.scene.frame_set(f)
            for k, (sd, i, n) in enumerate(clearance()):
                w = worst[k]
                worst[k] = (sd, i, w[2] + n, f) if sd < w[0] else (w[0], w[1], w[2] + n, w[3])
        report(act.name, worst, f1 - f0 + 1)
        closest[act.name] = min(worst)[3]
    if PROBE:
        probe(fig, arm, clips, closest)


def probe(fig, arm, clips, closest):
    scene = bpy.context.scene
    top = evaluated_co(fig)[:, 2].max() + 0.1
    cam_data = bpy.data.cameras.new("probe")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = top * 1.08
    cam = bpy.data.objects.new("probe", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.light = "STUDIO"
    scene.render.resolution_x, scene.render.resolution_y = 420, 760
    zc = top / 2
    views = {"front": ((0, -6, zc), (math.pi / 2, 0, 0)), "side": ((6, 0, zc), (math.pi / 2, 0, math.pi / 2)),
             "back": ((0, 6, zc), (math.pi / 2, 0, math.pi))}

    def shoot(tag):
        for vn, (loc, rot) in views.items():
            cam.location, cam.rotation_euler = loc, rot
            scene.render.filepath = "%s-%s-%s.png" % (PROBE, tag, vn)
            bpy.ops.render.render(write_still=True)

    play(arm, None)
    arm.data.pose_position = "REST"
    shoot("rest")
    arm.data.pose_position = "POSE"
    for act in clips:
        play(arm, act)
        f0, f1 = (int(round(x)) for x in act.frame_range)
        for f in sorted({f0, f0 + (f1 - f0) // 4, f0 + (f1 - f0) // 2, closest[act.name]}):
            scene.frame_set(f)
            shoot("%s-%02d" % (act.name, f))


# ---------------------------------------------------------------- main

bpy.ops.wm.read_factory_settings(use_empty=True)
if CHECK:
    i = argv.index("--check")
    check(argv[i + 1], argv[i + 2])
    sys.exit(0)

OUT = argv[0]
people = {p: measure(p) for p in sorted({p for ps in FITS.values() for p in ps})}
rng = np.random.default_rng(7)
mats = {"wood": material("ash", draw_wood(rng), 0.7), "iron": material("iron", draw_iron(rng), 0.55, 0.65),
        "wrap": material("indigo_cloth", draw_wrap(rng), 0.9),
        "leather": material("leather", draw_leather(rng), 0.6),
        "wicker": material("willow", draw_wicker(rng), 0.75),
        "lining": material("rust_cloth", draw_cloth(rng, (0.6, 0.25, 0.15)), 0.9, two_sided=True),
        "felt": material("felt", draw_felt(rng, (0.37, 0.43, 0.23)), 0.95),
        "band": material("band", draw_band(rng), 0.8)}
spade_fit = fit_spade(np.vstack([people[p]["back"] for p in FITS["spade"]])) if FITS["spade"] else DEFAULT["spade"]
basket_fit = (fit_basket(np.vstack([people[p]["back"] for p in FITS["basket"]])) if FITS["basket"]
              else DEFAULT["basket"])
wearers = {k: list(dict.fromkeys(ps)) for k, ps in FITS.items()}
basket = build_basket(basket_fit, [(look_of(p), people[p]["bvhs"]) for p in wearers["basket"]], mats)
if wearers["hat"]:  # an empty top node, one hat under it for every head
    hat = bpy.data.objects.new("hat", None)
    bpy.context.scene.collection.objects.link(hat)
    hat["socket"] = "socket_head"
    for p in wearers["hat"]:
        build_hat(fit_hat([people[p]["head"]], look_of(p)), mats, "hat-" + look_of(p), None, hat, look_of(p))
else:
    hat = build_hat(DEFAULT["hat"], mats)
built = {"spade": build_spade(spade_fit, mats), "basket": basket, "hat": hat}
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
for name, ob in built.items():
    path = os.path.join(OUT, "prop-%s.glb" % name)
    nodes = [ob] + list(ob.children_recursive)
    select_only(nodes, ob)
    want = dict(filepath=path, export_format="GLB", use_selection=True, export_extras=True, export_yup=True,
                export_apply=True, export_animations=False, export_image_format="JPEG", export_jpeg_quality=90,
                export_image_quality=90, export_materials="EXPORT")
    bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props})
    diag("wrote", path, "%.0f KB" % (os.path.getsize(path) / 1024), "nodes", len(nodes))
    for o in nodes:
        if o.type != "MESH":
            continue
        co = np.array([(o.matrix_world @ v.co)[:] for v in o.data.vertices])
        diag("  node", o.name, "wearer", o.get("wearer", "-"), "triangles",
             sum(len(f.vertices) - 2 for f in o.data.polygons), "materials", [m.name for m in o.data.materials],
             "box", np.round(co.min(axis=0), 3).tolist(), np.round(co.max(axis=0), 3).tolist())
if not wearers["basket"]:
    diag("basket: no --fit, so no straps")
