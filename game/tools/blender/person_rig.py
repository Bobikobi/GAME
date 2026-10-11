"""Rig a static character with the skeleton and clips of an already rigged one, fitted to its body.

Run:  blender -b -P person_rig.py -- <rigged.glb> <static.glb> <out.glb> [options]

  --tris N        decimate the static mesh to about N triangles first (default 0 = keep it; a
                  seam-aware glTF simplifier, such as gltf-transform's simplify, does the final cap)
  --tex PX        cap every texture at PX pixels (default 1024)
  --headwear M    metres of hat or hood above the skull, left out of the body height (default 0)
  --height M      scale the figure so its body (without the headwear) is M metres tall (default: as drawn)
  --skirt         blend a tunic or robe between the hips and the hem over both thighs
  --cut x0,y0,z0,x1,y1,z1   delete the vertices inside this box (metres, after the figure is grounded
                  and centred; +X is the figure's left, -Y its front, +Z up); may be repeated. The copies
                  a draft keeps along its map seams are welded first and every hole the cut leaves is
                  closed, so the watertight copy of step 2 still works
  --palms DIR     which way the figure's palms face as drawn: up, down, forward, back, in or out. The
                  forearm and the hand turn about their own lines until these palms face like the rigged
                  ones (half the turn in the forearm, all of it in the hand). Leave it out for arms that
                  hang like the rigged ones; the arms DIAG line shows how far the palms are turned
                  ("width_turn", up to a half turn either way)
  --joints FILE   arm joints measured by hand where the tracker cannot find them (an arm held out to the
                  side, a hand pressed on a hem or under a cape): a JSON object {"Left": {"shoulder": [x, y, z],
                  "elbow": [..], "wrist": [..], "tip": [..], "r_arm": metres, "reach": 2.5}, "Right": {..}} in
                  the figure's metres (after grounding, centring and --height; axes as --cut). Each side it names
                  replaces the tracker's joints for that arm; the arms DIAG line says "given" and how deep inside
                  the body each joint sits. "reach" (optional, in units of r_arm, default 2.5): away from
                  the shoulder, a vertex farther than this from the arm's line is the body's, whatever it touches
                  (a dress the draft fused to a hanging arm)
  --probe PREFIX  also write PREFIX-joints.json and front and side renders of the rest pose and of
                  every clip (PREFIX-rest-front.png, PREFIX-<clip>-<frame>-front.png, ...)

The rigged file supplies a Mixamo-style humanoid skeleton and its clips; its own mesh is only
measured. The static file supplies the mesh (a textured draft, origin anywhere, facing glTF +Z).
1. Ground and centre the figure (feet on the floor, torso on the vertical axis).
2. Measure both bodies on a voxel grid made from a watertight voxel copy: height, the feet, the
   torso's width and depth at the chest with the arms cut out, and each arm in 3-D: the fingertip
   (the cell farthest from the chest through the body, nearer the chest than the hips), the line
   traced back from it through the shells of equal distance, and the upper arm seen from outside.
   The wrist is where the shells grow from the hand into the forearm (at the rigged proportion of
   the hand when that lands far from it), the elbow where the forearm and upper-arm lines meet
   (on the rigged proportions when the arm hangs straight). The tracker runs on the rigged body
   too and reports how far it lands from that rig's joints.
3. Build the figure's skeleton from the rigged one: spine, neck and head scaled to the body, legs
   from the hips to the measured ankles, arms on the measured joints (the rigged arm, scaled, when
   none is found). Each bone keeps the rigged bone's roll turned by the same swing, so the clips
   need no twist correction; with --palms the forearm and hand also turn about their own lines.
4. Bind with automatic (bone heat) weights on the watertight copy, carried to the mesh by
   nearest-face interpolation, at most four bones per vertex. Each vertex then keeps only the bones
   of its own part, an arm or the rest of the body, found over the figure's own surface, so what
   touches an arm in the copy (a hem, a belt end, the back) does not move with it. Where the draft
   itself fused a forearm or a hand to the body, the body's side of that touch is cut away and both
   holes are closed. For an arm given by --joints, the body below the middle of its upper arm (a
   cape, a hem, a strap) drops the upper-arm weight, and from there up to a quarter of the upper
   arm below the shoulder that weight passes over to the collarbone, so a bare armpit stretches
   over that band and not over one row of faces.
5. Retarget every clip: each bone copies the world rotation of the rigged bone of the same name, the
   hips also its position (scaled to the body), baked to keys. Walk and Run get extras.groundSpeed,
   the speed of a planted foot in metres per second.
6. Add empties for props: socket_back on the upper spine at the surface of the back and socket_head
   on the head at the top of the skull, both with the figure's own axes.
7. Export one GLB (mesh, skin, clips, sockets, maps capped at --tex).
Prints one DIAG line per fact.
"""
import heapq
import json
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:]
RIGGED, STATIC, OUT = argv[0], argv[1], argv[2]


def opt(name, default, cast=float):
    return cast(argv[argv.index(name) + 1]) if name in argv else default


TRIS = opt("--tris", 0, int)
TEX = opt("--tex", 1024, int)
HEADWEAR = opt("--headwear", 0.0)
HEIGHT = opt("--height", 0.0)  # body height in metres without the headwear (0 = keep the draft's size)
PROBE = opt("--probe", None, str)
JOINTS = opt("--joints", None, str)
SKIRT = "--skirt" in argv
PALMS = opt("--palms", None, str)
assert PALMS in (None, "up", "down", "forward", "back", "in", "out"), "--palms: up, down, forward, back, in or out"
CUTS = [tuple(float(v) for v in argv[i + 1].split(",")) for i, a in enumerate(argv) if a == "--cut"]
CELL = 0.012  # voxel grid step, metres
END_BONES = ("_End", "headfront", "HandMiddle4")  # helpers that carry no skin


def diag(*a):
    print("DIAG", *a, flush=True)


def import_glb(path):
    """Import a GLB; every new object is unparented with its world transform kept."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    worlds = {o: o.matrix_world.copy() for o in new}
    for o in new:
        if o.parent is not None and o.parent.type != "ARMATURE":
            o.parent = None
            o.matrix_world = worlds[o]
    return new


def short(name):
    return name.split(":")[-1]


def select_only(objs, active):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


def world_verts(o):
    mw = np.array(o.matrix_world)
    co = np.array([v.co[:] for v in o.data.vertices], dtype=np.float64)
    return co @ mw[:3, :3].T + mw[:3, 3]


def voxel_copy(o, size):
    """A watertight voxel copy of a mesh object (world space, transforms applied)."""
    c = o.copy()
    c.data = o.data.copy()
    c.name = o.name + "_voxel"
    bpy.context.scene.collection.objects.link(c)
    for m in list(c.modifiers):
        c.modifiers.remove(m)
    c.parent = None
    c.matrix_world = o.matrix_world.copy()
    r = c.modifiers.new("voxel", "REMESH")
    r.mode = "VOXEL"
    r.voxel_size = size
    r.adaptivity = 0.0
    r.use_smooth_shade = False
    select_only([c], c)
    bpy.ops.object.modifier_apply(modifier=r.name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return c


def occupancy(o, cell=CELL):
    """Boolean voxel grid of the inside of a closed mesh, by ray parity along +X."""
    v = world_verts(o)
    faces = [tuple(p.vertices) for p in o.data.polygons]
    bvh = BVHTree.FromPolygons([tuple(x) for x in v], faces)
    lo = v.min(0) - 2 * cell
    hi = v.max(0) + 2 * cell
    n = np.ceil((hi - lo) / cell).astype(int) + 1
    occ = np.zeros(n, dtype=bool)
    span = float(hi[0] - lo[0]) + 4 * cell
    d = Vector((1.0, 0.0, 0.0))
    for j in range(n[1]):
        y = lo[1] + cell * j
        for k in range(n[2]):
            z = lo[2] + cell * k
            o_ = Vector((lo[0] - cell, y, z))
            left = span
            hits = []
            while left > 0:
                loc, _nrm, _idx, dist = bvh.ray_cast(o_, d, left)
                if loc is None:
                    break
                hits.append(loc.x)
                o_ = loc + d * 1e-5
                left -= dist + 1e-5
            if len(hits) % 2:
                hits = hits[:-1]
            for a, b in zip(hits[0::2], hits[1::2]):
                i0 = int(math.ceil((a - lo[0]) / cell))
                i1 = int(math.floor((b - lo[0]) / cell))
                if i1 >= i0:
                    occ[i0:i1 + 1, j, k] = True
    return occ, lo


def runs(row):
    """(start, end) index pairs, inclusive, of the True stretches of a 1-D boolean array."""
    idx = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
    return [(int(a), int(b) - 1) for a, b in zip(idx[0::2], idx[1::2])]


class Body:
    """Measurements of one figure on its voxel grid (grounded, facing -Y)."""

    def __init__(self, occ, lo, cell=CELL):
        self.occ, self.lo, self.cell = occ, lo, cell
        self.front = occ.any(axis=1)  # (x, z)
        zs = np.flatnonzero(self.front.any(axis=0))
        self.z0 = self.z(zs[0])
        self.top = self.z(zs[-1])

    def x(self, i):
        return float(self.lo[0] + self.cell * i)

    def y(self, j):
        return float(self.lo[1] + self.cell * j)

    def z(self, k):
        return float(self.lo[2] + self.cell * k)

    def k(self, z):
        return int(round((z - self.lo[2]) / self.cell))

    def i(self, x):
        return int(round((x - self.lo[0]) / self.cell))

    def xruns(self, z):
        return runs(self.front[:, self.k(z)])

    def yrange(self, i0, i1, z):
        """Widest y stretch of the cells between columns i0..i1 at height z: (y_front, y_back)."""
        col = self.occ[i0:i1 + 1, :, self.k(z)].any(axis=0)
        rs = runs(col)
        if not rs:
            return None
        a, b = max(rs, key=lambda r: r[1] - r[0])
        return self.y(a), self.y(b)

    def torso(self, z, xc=0.0):
        """Run of the slice at height z that holds (or is nearest to) x = xc: (x0, x1, y0, y1)."""
        rs = self.xruns(z)
        if not rs:
            return None
        ic = self.i(xc)
        a, b = min(rs, key=lambda r: 0 if r[0] <= ic <= r[1] else min(abs(r[0] - ic), abs(r[1] - ic)))
        yr = self.yrange(a, b, z)
        return self.x(a), self.x(b), yr[0], yr[1]

    def feet(self, z):
        """Centres of the two feet at height z: [(x, y_front, y_back), ...] left (+X) first."""
        rs = sorted(self.xruns(z), key=lambda r: r[1] - r[0], reverse=True)[:2]
        if len(rs) == 1:  # feet touching: split at the middle
            a, b = rs[0]
            m = self.i(0.0)
            rs = [(m + 1, b), (a, m)] if a < m < b else rs
        out = []
        for a, b in rs:
            yr = self.yrange(a, b, z)
            out.append(((self.x(a) + self.x(b)) / 2, yr[0], yr[1]))
        return sorted(out, key=lambda f: -f[0])

    def pos(self, ijk):
        """Centre of cell (i, j, k), or of each row of an (n, 3) array of them."""
        return self.lo + self.cell * np.asarray(ijk, float)

    def idx(self, p):
        return tuple(int(round(v)) for v in (np.asarray(p, float) - self.lo) / self.cell)


# ---------------------------------------------------------------- the arms in 3-D
CROSS = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))


def shifted(m, d):
    """m moved by d cells; cells nothing moves into are False."""
    out = np.zeros_like(m)
    src = tuple(slice(max(-k, 0), m.shape[a] - max(k, 0)) for a, k in enumerate(d))
    dst = tuple(slice(max(k, 0), m.shape[a] - max(-k, 0)) for a, k in enumerate(d))
    out[dst] = m[src]
    return out


def dilate(m, cube):
    """One step of growth: to the 26 neighbours (cube) or to the 6 face neighbours."""
    if cube:
        out = m
        for a in range(3):
            d = [0, 0, 0]
            d[a] = 1
            g = out | shifted(out, tuple(d))
            d[a] = -1
            out = g | shifted(out, tuple(d))
        return out
    out = m.copy()
    for d in CROSS:
        out |= shifted(m, d)
    return out


def erode(m):
    """One step of shrinking: a cell stays when its 6 face neighbours are all set."""
    out = m.copy()
    for d in CROSS:
        out &= shifted(m, d)
    return out


def opened(m):
    """m without its parts thinner than about three cells (a fingertip resting on a hem, a strap)."""
    return dilate(erode(m), False) & m


def geodesic(mask, seeds, max_steps):
    """Steps from the seeds through mask, alternating 26- and 6-neighbour steps (close to the straight-line
    distance in cells); -1 where not reached."""
    dist = np.full(mask.shape, -1, np.int32)
    front = seeds & mask
    dist[front] = 0
    seen = front.copy()
    step = 0
    while front.any() and step < max_steps:
        step += 1
        front = dilate(front, step % 2 == 1) & mask & ~seen
        dist[front] = step
        seen |= front
    return dist


def flood2(mask, seed):
    """Cells of a 2-D mask joined to seed through their 4 neighbours."""
    out = np.zeros_like(mask)
    if not mask[seed]:
        return out
    out[seed] = True
    while True:
        grown = out.copy()
        grown[1:] |= out[:-1]
        grown[:-1] |= out[1:]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        grown &= mask
        if (grown == out).all():
            return out
        out = grown


def mid_cell(g, z, x=0.0):
    """The occupied cell nearest to the middle of the body's depth at (x, z)."""
    i, _, k = g.idx((x, 0.0, z))
    js = np.flatnonzero(g.occ[i, :, k])
    mid = (js[0] + js[-1]) / 2
    return i, int(js[np.argmin(np.abs(js - mid))]), k


def arm_reach(g, z_chest, z_hips):
    """What both arms of one body share: the body with its thin parts opened away, and the steps through it
    from the middle of the chest and from the middle of the hips."""
    go = Body(opened(g.occ), g.lo, g.cell)
    chest, hips = mid_cell(go, z_chest), mid_cell(go, z_hips)
    seeds = np.zeros_like(go.occ)
    seeds[chest] = True
    dc = geodesic(go.occ, seeds, 400)
    seeds[:] = False
    seeds[hips] = True
    dh = geodesic(go.occ, seeds, 400)
    gap = 0.15 * float(np.linalg.norm(go.pos(chest) - go.pos(hips))) / go.cell
    return go, dc, dh, gap


def find_tip(reach, side, z_lo, z_hi):
    """The fingertip: of the cells on this side between z_lo and z_hi that are reached from the chest sooner
    than from the hips (the arm hangs from the shoulder, a leg or a hem from the hips), the one farthest from
    the chest through the body."""
    go, dc, dh, gap = reach
    ii = np.argwhere((dc >= 0) & (dh >= 0) & (dh - dc > gap))
    p = go.pos(ii)
    ii = ii[(side * p[:, 0] > 0.05) & (p[:, 2] >= z_lo) & (p[:, 2] <= z_hi)]
    if not len(ii):
        return None
    return tuple(ii[dc[tuple(ii.T)].argmax()])


def trace(g, tip, r_win, max_len, band=2):
    """Follow the arm from the fingertip: centroids of the shells of equal distance from the tip, each shell
    taken only inside a window of radius r_win around where the arm is expected (so a sleeve pressed on the
    body does not pull the line into the torso). Stops past max_len, or where the window fills up (the
    shoulder or the torso). Returns a list of dicts (point p, arc length s, count n, fill)."""
    seeds = np.zeros_like(g.occ)
    seeds[tip] = True
    dist = geodesic(g.occ, seeds, int(max_len * 1.6 / g.cell) + 4)
    ii = np.argwhere(dist >= 0)
    dd = dist[tuple(ii.T)]
    order = np.argsort(dd, kind="stable")
    dd, P = dd[order], g.pos(ii[order])
    bounds = np.searchsorted(dd, np.arange(0, dd.max() + band + 1, band))
    out = [dict(p=g.pos(tip), s=0.0, n=1, fill=0.0)]
    prev, direc = g.pos(tip), None
    disk = math.pi * r_win ** 2 / g.cell ** 2 * band  # cells in a full slab of the window
    for b in range(1, len(bounds) - 1):
        shell = P[bounds[b]:bounds[b + 1]]
        if not len(shell):
            break
        c = prev + (direc * band * g.cell * 1.15 if direc is not None else 0.0)
        near = shell[:0]
        for _ in range(4):  # mean shift inside the window
            near = shell[((shell - c) ** 2).sum(1) <= r_win ** 2]
            if not len(near):
                break
            c = near.mean(0)
        if not len(near):
            break
        fill = len(near) / disk
        s = out[-1]["s"] + float(np.linalg.norm(c - prev))
        out.append(dict(p=c, s=s, n=len(near), fill=fill))
        if len(out) >= 3:
            d = out[-1]["p"] - out[max(0, len(out) - 4)]["p"]
            if np.linalg.norm(d) > 1e-6:
                direc = d / np.linalg.norm(d)
        prev = c
        if s > max_len or fill > 0.9:
            break
    return out


def at_length(P, s, at):
    """Point at arc length `at` along the points P with arc lengths s."""
    for i in range(1, len(P)):
        if s[i] >= at:
            t = (at - s[i - 1]) / max(s[i] - s[i - 1], 1e-9)
            return P[i - 1] + t * (P[i] - P[i - 1])
    return P[-1]


def two_segment(P):
    """Best split of a polyline into two straight pieces: (index, angle between them in degrees, error)."""
    best = None
    for i in range(2, len(P) - 2):
        err = 0.0
        for Q in (P[:i + 1], P[i:]):
            u = (Q[-1] - Q[0]) / max(np.linalg.norm(Q[-1] - Q[0]), 1e-9)
            v = Q - Q[0]
            err += float((np.linalg.norm(v - np.outer(v @ u, u), axis=1) ** 2).sum())
        u1, u2 = P[i] - P[0], P[-1] - P[i]
        ang = math.degrees(math.acos(float(np.clip(u1 @ u2 / max(np.linalg.norm(u1) * np.linalg.norm(u2), 1e-9),
                                                   -1, 1))))
        if best is None or err < best[2]:
            best = (i, ang, err)
    return best


def outer_centre(g, side, z, r):
    """Centre of the arm at height z seen from outside: one arm radius r in from the outermost cell of the slice
    on this side, at the middle depth of the outer bulge (a sleeve pressed on the body does not move it)."""
    k = g.k(z)
    ii = np.argwhere(g.occ[:, :, k])
    if not len(ii):
        return None
    p = g.pos(np.c_[ii, np.full(len(ii), k)])
    p = p[side * p[:, 0] > 0]
    if not len(p):
        return None
    sx = side * p[:, 0]
    xm = float(sx.max())
    return np.array([side * (xm - r), float(p[sx >= xm - 0.5 * r, 1].mean()), z])


def fit_line(P):
    """Centre and unit direction of the straight line through points P (least squares)."""
    P = np.asarray(P, float)
    c = P.mean(0)
    return c, np.linalg.svd(P - c)[2][0]


def closest(c1, u1, c2, u2):
    """Points of two lines (centre, unit direction) closest to each other; None when close to parallel."""
    w = c1 - c2
    b = float(u1 @ u2)
    den = 1.0 - b * b
    if den < 0.05:
        return None
    t = (b * float(u2 @ w) - float(u1 @ w)) / den
    s = (float(u2 @ w) - b * float(u1 @ w)) / den
    return c1 + t * u1, c2 + s * u2


def fit_arm(g, reach, side, H, z_sh, share, max_len, band=2):
    """Joints of one arm from the voxel body: tip, wrist, elbow, shoulder (points) and what was measured.
    The fingertip and the line of the hand and forearm come from the body with its thin parts opened away (a
    hand resting on a hem does not join the hem there); the upper arm from the outside of the body below the
    shoulder (a sleeve may touch the body there); the elbow where the two lines meet; the wrist where the
    shells grow from the hand into the forearm. share: proportions of the rigged arm, used where the shape
    gives no answer: "hand" = hand / (hand + forearm), "fore" = forearm / (forearm + upper arm),
    "low" = (hand + forearm) / arm. Returns None without a fingertip."""
    go = reach[0]
    tip = find_tip(reach, side, 0.3 * H, z_sh)
    if tip is None:
        return None
    pts = trace(go, tip, 0.05 * H, max_len, band)
    for i in range(2, len(pts)):  # the line turned into the body: a step nearly straight inwards
        d = pts[i]["p"] - pts[i - 1]["p"]
        if side * d[0] < -0.8 * np.linalg.norm(d):
            pts = pts[:i]
            break
    P = np.array([q["p"] for q in pts])
    s = np.array([q["s"] for q in pts])
    n = np.array([q["n"] for q in pts])
    # the fingertip as far as the unopened body goes along the hand
    k = min(3, len(P) - 1)
    hd = (P[0] - P[k]) / max(np.linalg.norm(P[0] - P[k]), 1e-9)
    cells = g.pos(np.argwhere(g.occ))
    near = cells[((cells - P[0]) ** 2).sum(1) <= (0.03 * H) ** 2]
    ext = max(float(((near - P[0]) @ hd).max()), 0.0) if len(near) else 0.0
    P[0] = P[0] + hd * ext
    s[1:] += ext
    info = dict(trace=len(P), traced=round(float(s[-1]), 3), tip_ext=round(ext, 3))
    # the wrist: the start of the steepest growth of the shells from the hand into the forearm
    iw, best = None, 1.4
    for i in range(len(P) - 2):
        if 0.06 * H <= s[i] <= 0.17 * H and n[i] > 0 and n[i + 2] / n[i] > best:
            iw, best = i, n[i + 2] / n[i]
    info["wrist_by"] = "shells x%.2f" % best if iw is not None else "share"
    # arm thickness from the forearm shells (a shell of `band` steps holds about pi r^2 * 1.15 band cells)
    if iw is not None:
        fore_n = n[(s >= s[iw] + 0.03 * H) & (s <= s[iw] + 0.12 * H)]
    else:
        fore_n = n[(s >= 0.35 * s[-1]) & (s <= 0.75 * s[-1])]
    r_arm = g.cell * math.sqrt(float(np.median(fore_n)) / (math.pi * 1.15 * band)) if len(fore_n) else 0.03 * H
    r_arm = float(np.clip(r_arm, 0.018 * H, 0.04 * H))
    # where the traced line bends (two straight pieces) past the wrist: the end of its forearm part
    j0 = iw if iw is not None else int(np.searchsorted(s, 0.15 * s[-1]))
    bend = two_segment(P[j0:]) if len(P) - j0 >= 6 else None
    ib = j0 + bend[0] if bend is not None else len(P) - 1
    s_b = float(s[ib])
    info["bend"] = round(bend[1], 1) if bend is not None else None
    # the upper arm seen from outside, from just under the shoulder down to above the bend
    z_low = min(P[ib][2] + 2.5 * r_arm, z_sh - 0.1 * H)
    cs = [outer_centre(g, side, z, r_arm) for z in np.arange(z_sh - 0.02 * H, z_low, -2 * g.cell)]
    cs = [c for c in cs if c is not None]
    if len(cs) < 3:
        return None
    cu, uu = fit_line(cs)
    if uu[2] < 0:
        uu = -uu
    shoulder = cu + uu * (z_sh - cu[2]) / max(float(uu[2]), 1e-3)
    info["upper"] = len(cs)
    # the elbow: where the forearm line (traced, from the wrist to the bend) meets the upper arm line
    how, elbow = "straight", None
    s_w = float(s[iw]) if iw is not None else 0.45 * s_b
    sel = P[(s >= s_w) & (s <= s_w + 0.9 * (s_b - s_w))]
    if len(sel) >= 3:
        cf, uf = fit_line(sel)
        ang = math.degrees(math.acos(min(abs(float(uu @ uf)), 1.0)))
        info["angle"] = round(ang, 1)
        cl = closest(cu, uu, cf, uf) if ang >= 25.0 else None
        if cl is not None:
            e = (cl[0] + cl[1]) / 2
            gap = float(np.linalg.norm(cl[0] - cl[1]))
            off = float(np.sqrt(((P - e) ** 2).sum(1).min()))
            info.update(gap=round(gap, 3), off=round(off, 3))
            if gap <= 1.5 * r_arm and off <= 3 * r_arm and e[2] <= z_sh - 0.1 * H:
                elbow, how = e, "lines meet"
            else:
                elbow, how = P[ib], "bend"
    reach_len = float(np.linalg.norm(P[0] - shoulder))
    s_e = float(s[np.argmin(((P - elbow) ** 2).sum(1))]) if elbow is not None else share["low"] * reach_len
    # a hand far shorter or longer than the rigged proportion: the shells grew where something else joins the
    # hand (a spread thumb, a wide cuff); the wrist at that proportion instead
    s_hand = share["hand"] * s_e
    if iw is not None and not 0.75 <= float(s[iw]) / max(s_hand, 1e-9) <= 1.4:
        info["wrist_by"] = "share (the shells gave %.2f of the rigged hand)" % (float(s[iw]) / s_hand)
        iw = None
    wrist = P[iw] if iw is not None else at_length(P, s, s_hand)
    if elbow is None:  # a straight arm: the elbow at the rigged share between the wrist and the shoulder
        elbow = wrist + (shoulder - wrist) * share["fore"]
    info.update(how=how, r_arm=round(r_arm, 3))
    return dict(tip=P[0], wrist=np.asarray(wrist, float), elbow=np.asarray(elbow, float), shoulder=shoulder,
                info=info)


def hand_frame(g, reach, wrist, tip):
    """Axes of the hand from the wrist to the fingertip: "along", "width" (the widest way across, knuckle to
    knuckle) and "thick" (through the palm, sign unknown), with how much wider than thick it is ("ratio").
    Cells nearer to the opened trunk or legs than to the opened arm (a hand resting on a hem) are left out."""
    go, dc, dh, gap = reach
    along = tip - wrist
    L = float(np.linalg.norm(along))
    if L < 3 * g.cell:
        return None
    along = along / L
    lab = np.zeros(g.occ.shape, np.int8)  # 1 = arm, 2 = the rest, each grown into the nearest unopened cells
    arm_ok = go.occ & (dc >= 0) & (dh >= 0) & (dh - dc > gap)
    lab[arm_ok] = 1
    lab[go.occ & ~arm_ok] = 2
    for _ in range(4):
        free = g.occ & (lab == 0)
        a1 = dilate(lab == 1, True) & free
        a2 = dilate(lab == 2, True) & free & ~a1
        lab[a1] = 1
        lab[a2] = 2
    ii = np.argwhere(g.occ & (lab != 2))
    v = g.pos(ii) - wrist
    t = v @ along
    r = np.linalg.norm(v - np.outer(t, along), axis=1)
    keep = ii[(t >= -0.5 * g.cell) & (t <= L + 2 * g.cell) & (r <= 0.6 * L)]
    if len(keep) < 20:
        return None
    mask = np.zeros_like(g.occ)
    mask[tuple(keep.T)] = True
    seeds = np.zeros_like(g.occ)
    seeds[tuple(keep[((g.pos(keep) - tip) ** 2).sum(1).argmin()])] = True
    hand = np.argwhere(geodesic(mask, seeds, int(2 * L / g.cell) + 4) >= 0)
    v = g.pos(hand) - wrist
    q = v - np.outer(v @ along, along)
    w, U = np.linalg.eigh(np.cov((q - q.mean(0)).T))
    width = U[:, 2]
    return dict(along=along, width=width, thick=np.cross(along, width), ratio=float(w[2] / max(w[1], 1e-12)),
                cells=len(hand))


def torso_slice(g, z, chains):
    """x0, x1, y0, y1 of the body's slice at height z with the arms cut out: the cells nearer than r_cut to an
    arm's chain of joints are dropped (chains: [(points, r_cut)]), thin remnants are opened away and the patch
    holding x = 0 is kept. The depth is that of the column at x = 0. None when that column is empty."""
    k = g.k(z)
    m = g.occ[:, :, k].copy()
    ii = np.argwhere(m)
    p = g.pos(np.c_[ii, np.full(len(ii), k)])
    cut = np.zeros(len(p), bool)
    for chain, r_cut in chains:
        for a, b in zip(chain[:-1], chain[1:]):
            d = b - a
            t = np.clip(((p - a) @ d) / max(float(d @ d), 1e-12), 0, 1)
            cut |= ((p - (a + t[:, None] * d)) ** 2).sum(1) <= r_cut ** 2
    m[tuple(ii[cut].T)] = False
    e = m.copy()  # open: shrink by one cell, keep the patch, grow it back
    e[1:] &= m[:-1]
    e[:-1] &= m[1:]
    e[:, 1:] &= m[:, :-1]
    e[:, :-1] &= m[:, 1:]
    i0 = g.i(0.0)
    js = np.flatnonzero(e[i0])
    if not len(js):
        return None
    keep = flood2(e, (i0, int(js[len(js) // 2])))
    grown = keep.copy()
    grown[1:] |= keep[:-1]
    grown[:-1] |= keep[1:]
    grown[:, 1:] |= keep[:, :-1]
    grown[:, :-1] |= keep[:, 1:]
    grown &= m
    xi = np.flatnonzero(grown.any(axis=1))
    yj = np.flatnonzero(grown[i0])
    return g.x(xi[0]), g.x(xi[-1]), g.y(yj[0]), g.y(yj[-1])


# ---------------------------------------------------------------- 1. the rigged file
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
src_objs = import_glb(RIGGED)
src_arm = [o for o in src_objs if o.type == "ARMATURE"][0]
src_body = [o for o in src_objs if o.type == "MESH" and len(o.data.vertices) > 1000]
for o in src_objs:
    if o.type == "MESH" and o not in src_body:
        bpy.data.objects.remove(o, do_unlink=True)  # helper meshes (a stray icosphere)
ad = src_arm.animation_data
clips = []
if ad:
    for t in ad.nla_tracks:
        for s in t.strips:
            if s.action not in clips:
                clips.append(s.action)
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    ad.action = None
if not clips:
    clips = list(bpy.data.actions)
for a in clips:
    a["clip"] = a.name
    a.name = "src_" + a.name
for pb in src_arm.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()
diag("rigged: bones", len(src_arm.data.bones), "clips", [a["clip"] for a in clips],
     "frames", [tuple(round(f) for f in a.frame_range) for a in clips])

SB = {short(b.name): b for b in src_arm.data.bones}
amw = src_arm.matrix_world
S_HEAD = {n: Vector(amw @ b.head_local) for n, b in SB.items()}
S_TAIL = {n: Vector(amw @ b.tail_local) for n, b in SB.items()}

src_join = src_body[0]
if len(src_body) > 1:
    select_only(src_body, src_body[0])
    bpy.ops.object.join()
src_vox = voxel_copy(src_join, CELL * 0.75)
occ, lo = occupancy(src_vox)
SRC = Body(occ, lo)
bpy.data.objects.remove(src_vox, do_unlink=True)
bpy.data.objects.remove(src_join, do_unlink=True)
s_height = SRC.top - SRC.z0
diag("rigged body: floor", round(SRC.z0, 3), "top", round(SRC.top, 3))

# ---------------------------------------------------------------- 2. the static figure
st_objs = import_glb(STATIC)
st_meshes = [o for o in st_objs if o.type == "MESH"]
for o in st_objs:
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
select_only(st_meshes, st_meshes[0])
if len(st_meshes) > 1:
    bpy.ops.object.join()
fig = bpy.context.view_layer.objects.active
fig.name = "Character"
fig.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
v = world_verts(fig)
fig.data.transform(Matrix.Translation(Vector((-(v[:, 0].min() + v[:, 0].max()) / 2,
                                               -(v[:, 1].min() + v[:, 1].max()) / 2, -v[:, 2].min()))))
diag("static: verts", len(fig.data.vertices), "tris", sum(len(p.vertices) - 2 for p in fig.data.polygons),
     "size", tuple(round(float(x), 3) for x in (v.max(0) - v.min(0))))

# centre the torso on the vertical axis (a pack or a cape must not pull the body off it)
vox = voxel_copy(fig, CELL * 0.75)
occ, lo = occupancy(vox)
B = Body(occ, lo)
t = B.torso(B.z0 + 0.5 * (B.top - B.z0))
shift = Vector((-(t[0] + t[1]) / 2, -(t[2] + t[3]) / 2, 0.0))
fig.data.transform(Matrix.Translation(shift))
bpy.data.objects.remove(vox, do_unlink=True)
diag("torso centred: moved", tuple(round(x, 3) for x in shift))
if HEIGHT:  # Meshy drafts all come out 1.897 m tall; the role's build sets the real height
    k = (HEIGHT + HEADWEAR) / float(world_verts(fig)[:, 2].max())
    fig.data.transform(Matrix.Scale(k, 4))
    diag("scaled to body height", HEIGHT, "factor", round(k, 4))


def close_holes(bm, side=None):
    """Close every open loop of edges. Returns the number of loops closed.
    Without side: a fan of triangles around the loop's centre. Each triangle takes the map coordinates of its rim
    edge (the centre corner sits halfway along it), so the patch repeats the colours around the hole instead of a
    random spot of the map.
    With side (an int layer of bm.verts, each vertex's part): no new vertices. A loop that runs through more than
    one part is closed part by part: each run of one part is stitched across itself, then the ends of the runs are
    stitched together, so only those last triangles join two parts that move apart (where the arm meets the body
    at the shoulder). Stitching zips the two sides of a long, bent hole towards each other along the shorter
    diagonal, so the patch follows the hole instead of fanning across it. Each patch takes one spot of the map from
    its own rim (the corner nearest the rim's median), one flat colour instead of streaks."""
    uv = bm.loops.layers.uv.active
    start = {}  # rim half-edges a -> b, in the direction the face beside them runs
    for e in bm.edges:
        if e.is_boundary:
            lp = e.link_loops[0]
            start.setdefault(lp.vert, []).append(lp)
    rings = []
    while start:
        a0 = next(iter(start))
        ring, a = [], a0
        while a in start:
            lp = start[a].pop()
            if not start[a]:
                del start[a]
            ring.append(lp)
            a = lp.link_loop_next.vert
            if a is a0:
                break
        if len(ring) >= 3:
            rings.append(ring)

    def stitch(lps):  # the polygon of these rim corners, in rim order, zipped from both ends
        vs = [lp.vert for lp in lps]
        if uv is not None:
            us = np.array([lp[uv].uv[:] for lp in lps])
            u = us[int(np.argmin(((us - np.median(us, axis=0)) ** 2).sum(1)))]
        i, j = 0, len(vs) - 1
        while j - i > 1:
            if (vs[i + 1].co - vs[j].co).length < (vs[i].co - vs[j - 1].co).length:
                tri, i = (vs[j], vs[i + 1], vs[i]), i + 1
            else:
                tri, j = (vs[j], vs[j - 1], vs[i]), j - 1
            try:
                f = bm.faces.new(tri)
            except ValueError:
                continue
            f.material_index, f.smooth = lps[0].face.material_index, lps[0].face.smooth
            if uv is not None:
                for fl in f.loops:
                    fl[uv].uv = u

    closed = 0
    for ring in rings:
        if side is not None:
            lab = [lp.vert[side] for lp in ring]
            if len(set(lab)) == 1:  # one part: start at the far end of the loop
                c = sum((lp.vert.co for lp in ring), Vector()) / len(ring)
                k = max(range(len(ring)), key=lambda t: (ring[t].vert.co - c).length)
                stitch(ring[k:] + ring[:k])
            else:
                k = next(t for t in range(len(ring)) if lab[t] != lab[t - 1])
                ring, lab = ring[k:] + ring[:k], lab[k:] + lab[:k]
                ends, run = [], [ring[0]]
                for lp, lb, prev in zip(ring[1:] + [None], lab[1:] + [None], lab):
                    if lb == prev:
                        run.append(lp)
                        continue
                    if len(run) >= 3:
                        stitch(run)
                    ends.extend(run if len(run) <= 2 else [run[0], run[-1]])
                    run = [lp]
                if len(ends) >= 3:
                    stitch(ends)
            closed += 1
            continue
        c = bm.verts.new(sum((lp.vert.co for lp in ring), Vector()) / len(ring))
        for lp in ring:
            nxt = lp.link_loop_next
            try:
                f = bm.faces.new((nxt.vert, lp.vert, c))
            except ValueError:
                continue
            f.material_index, f.smooth = lp.face.material_index, lp.face.smooth
            if uv is not None:
                ub, ua = nxt[uv].uv.copy(), lp[uv].uv.copy()
                for fl in f.loops:
                    fl[uv].uv = ub if fl.vert is nxt.vert else ua if fl.vert is lp.vert else (ua + ub) / 2
        closed += 1
    return closed

if CUTS:
    bm = bmesh.new()
    bm.from_mesh(fig.data)
    # weld the copies a draft keeps along its map seams, so the cut leaves only real holes, then close them:
    # the voxel copy needs a closed surface, and an open hole would show the inside of the clothes
    nv0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    nv1 = len(bm.verts)
    open0 = sum(e.is_boundary for e in bm.edges)
    gone = [vv for vv in bm.verts if any(c[0] <= vv.co.x <= c[3] and c[1] <= vv.co.y <= c[4] and c[2] <= vv.co.z <= c[5]
                                         for c in CUTS)]
    bmesh.ops.delete(bm, geom=gone, context="VERTS")
    rings = close_holes(bm)
    open1 = sum(e.is_boundary for e in bm.edges)
    bm.to_mesh(fig.data)
    bm.free()
    diag("cut: vertices removed", len(gone), "welded", nv0 - nv1, "open edges after the weld", open0,
         "holes closed", rings, "open edges left", open1)

tris = sum(len(p.vertices) - 2 for p in fig.data.polygons)
if TRIS and tris > TRIS:
    m = fig.modifiers.new("decimate", "DECIMATE")
    m.decimate_type = "COLLAPSE"
    m.ratio = TRIS / tris
    m.use_collapse_triangulate = True
    select_only([fig], fig)
    bpy.ops.object.modifier_apply(modifier=m.name)
diag("decimated: tris", sum(len(p.vertices) - 2 for p in fig.data.polygons), "verts", len(fig.data.vertices))

vox = voxel_copy(fig, CELL * 0.75)
occ, lo = occupancy(vox)
B = Body(occ, lo)
height = B.top - B.z0 - HEADWEAR
sz = height / s_height
diag("figure body: top", round(B.top, 3), "body height", round(height, 3), "scale z", round(sz, 4))
# ---------------------------------------------------------------- 3. measurements and the skeleton
# the arms in 3-D: first on the rigged body, whose rig gives the proportions of its arm up to the fingertip the
# tracker finds (and shows how far the tracker lands from a rig's joints), then on the figure
L_up = (S_HEAD["LeftForeArm"] - S_HEAD["LeftArm"]).length
L_fo = (S_HEAD["LeftHand"] - S_HEAD["LeftForeArm"]).length
L_ha = 1.27 * (S_TAIL["LeftHand"] - S_HEAD["LeftHand"]).length  # until the fingertip is traced


def shares():
    return dict(hand=L_ha / (L_ha + L_fo), fore=L_fo / (L_fo + L_up), low=(L_ha + L_fo) / (L_ha + L_fo + L_up))


s_reach = arm_reach(SRC, S_HEAD["Spine1"].z, S_HEAD["Hips"].z)
s_fits = {pre: fit_arm(SRC, s_reach, side, s_height, S_HEAD[pre + "Arm"].z, shares(), (L_up + L_fo + L_ha) * 1.15)
          for side, pre in ((1, "Left"), (-1, "Right"))}
if s_fits["Left"] is not None:
    L_ha = float(np.linalg.norm(s_fits["Left"]["tip"] - np.array(S_HEAD["LeftHand"])))
share = shares()
diag("rigged arm: upper", round(L_up, 3), "forearm", round(L_fo, 3), "hand to the traced fingertip", round(L_ha, 3))
diag("arm tracker on the rigged body, metres from its joints",
     {pre: None if f is None else {j: round(float(np.linalg.norm(f[j] - np.array(S_HEAD[pre + b]))), 3)
                                   for j, b in (("shoulder", "Arm"), ("elbow", "ForeArm"), ("wrist", "Hand"))}
      for pre, f in s_fits.items()})
f_reach = arm_reach(B, S_HEAD["Spine1"].z * sz, S_HEAD["Hips"].z * sz)
fits = {pre: fit_arm(B, f_reach, side, height, S_HEAD[pre + "Arm"].z * sz, share, (L_up + L_fo + L_ha) * sz * 1.15)
        for side, pre in ((1, "Left"), (-1, "Right"))}
if JOINTS:
    with open(JOINTS) as fh:
        given = json.load(fh)
    occ_d = np.zeros(B.occ.shape, np.int32)  # cells from the outside, to say how deep a given joint sits
    shell, n = B.occ.copy(), 0
    while shell.any() and n < 40:
        n += 1
        occ_d[shell] = n
        shell = erode(shell)
    for side, pre in ((1, "Left"), (-1, "Right")):
        if pre in given:
            gj = given[pre]
            fits[pre] = dict({j: np.array(gj[j], float) for j in ("shoulder", "elbow", "wrist", "tip")},
                             info=dict(how="given", r_arm=float(gj.get("r_arm", 0.02 * height)),
                                       reach=float(gj.get("reach", 2.5))))
            depth = {}
            for j in ("shoulder", "elbow", "wrist", "tip"):
                ijk = B.idx(fits[pre][j])
                ok = all(0 <= a < b for a, b in zip(ijk, B.occ.shape))
                depth[j] = round(float(occ_d[ijk]) * B.cell, 3) if ok else None
            diag("arm joints given", pre, "depth inside the body, metres (0 = outside)", depth)
hands = {pre: hand_frame(B, f_reach, f["wrist"], f["tip"]) for pre, f in fits.items() if f is not None}
s_hands = {pre: hand_frame(SRC, s_reach, f["wrist"], f["tip"]) for pre, f in s_fits.items() if f is not None}
del s_reach, f_reach


def ratios(z_src):
    ts, tf = SRC.torso(z_src), B.torso(z_src * sz)
    return (tf[1] - tf[0]) / (ts[1] - ts[0]), (tf[3] - tf[2]) / (ts[3] - ts[2]), ts, tf


# the chest with the arms cut out (an arm resting on the body must not widen it); the hips as seen from the front
r_src = float(np.mean([f["info"]["r_arm"] for f in s_fits.values() if f is not None] or [0.035 * s_height]))
s_chains = [([np.array(S_HEAD[pre + n]) for n in ("Arm", "ForeArm", "Hand")] + [np.array(S_TAIL[pre + "Hand"])],
             1.6 * r_src) for pre in ("Left", "Right")]
f_chains = [([f[j] for j in ("shoulder", "elbow", "wrist", "tip")], 1.6 * f["info"]["r_arm"])
            for f in fits.values() if f is not None]
ts_chest = torso_slice(SRC, S_HEAD["Spine1"].z, s_chains)
tf_chest = torso_slice(B, S_HEAD["Spine1"].z * sz, f_chains)
if ts_chest is None or tf_chest is None:
    sx_chest, sy_chest, ts_chest, tf_chest = ratios(S_HEAD["Spine1"].z)
    diag("chest measured as seen from the front (no torso at x = 0 in the slice)")
else:
    sx_chest = (tf_chest[1] - tf_chest[0]) / (ts_chest[1] - ts_chest[0])
    sy_chest = (tf_chest[3] - tf_chest[2]) / (ts_chest[3] - ts_chest[2])
sx_hip, sy_hip, ts_hip, tf_hip = ratios(S_HEAD["LeftUpLeg"].z)
sx_chest = float(np.clip(sx_chest, 0.8, 1.6))
sy_chest = float(np.clip(sy_chest, 0.7, 1.6))
sx_hip = float(np.clip(sx_hip, 0.8, 1.6))
diag("width ratio chest", round(sx_chest, 3), "hips", round(sx_hip, 3), "depth ratio chest", round(sy_chest, 3),
     "chest x0 x1 y0 y1 (arms cut out)", tuple(round(float(x), 3) for x in tf_chest))
src_yc = (ts_chest[2] + ts_chest[3]) / 2
fig_yc = (tf_chest[2] + tf_chest[3]) / 2


def scaled(p, sx):
    """A rigged-body point carried into the figure's body (x by sx, z by sz, y about the torso centre)."""
    return Vector((p.x * sx, fig_yc + (p.y - src_yc) * sy_chest, p.z * sz))


NEW_HEAD, NEW_TAIL = {}, {}
for n in ("Hips", "Spine", "Spine1", "Spine2", "Neck", "Head", "HeadTop_End", "headfront"):
    if n in SB:
        NEW_HEAD[n] = scaled(S_HEAD[n], 1.0)
        NEW_TAIL[n] = scaled(S_TAIL[n], 1.0)

# feet and legs
s_feet = SRC.feet(SRC.z0 + 0.025 * s_height)
f_feet = B.feet(B.z0 + 0.025 * height)
legs = {}
for side, pre in ((0, "Left"), (1, "Right")):
    sf, ff = s_feet[side], f_feet[side]
    s_len, f_len = sf[2] - sf[1], ff[2] - ff[1]
    s_ank = S_HEAD[pre + "Foot"]
    # where the rigged ankle sits along its foot (0 = toe end, 1 = heel end), kept for the figure
    u = (s_ank.y - sf[1]) / s_len
    ank = Vector((ff[0], ff[1] + u * f_len, s_ank.z * sz))
    hip = scaled(S_HEAD[pre + "UpLeg"], sx_hip)
    s_hip, s_knee = S_HEAD[pre + "UpLeg"], S_HEAD[pre + "Leg"]
    w = (s_knee.z - s_ank.z) / (s_hip.z - s_ank.z)
    off = s_knee - s_ank.lerp(s_hip, w)  # the rigged knee's bend off the hip-ankle line
    knee = ank.lerp(hip, w) + Vector((off.x * sx_hip, off.y * sy_chest, off.z * sz))
    k_foot = f_len / s_len
    NEW_HEAD[pre + "UpLeg"], NEW_TAIL[pre + "UpLeg"] = hip, knee
    NEW_HEAD[pre + "Leg"], NEW_TAIL[pre + "Leg"] = knee, ank
    for n in ("Foot", "ToeBase", "Toe_End"):
        if pre + n in SB:
            NEW_HEAD[pre + n] = ank + (S_HEAD[pre + n] - s_ank) * k_foot
            NEW_TAIL[pre + n] = ank + (S_TAIL[pre + n] - s_ank) * k_foot
    for n in ("Foot", "ToeBase", "Toe_End"):  # keep the sole on the floor
        if pre + n in NEW_HEAD:
            NEW_HEAD[pre + n].z = max(NEW_HEAD[pre + n].z, 0.0)
            NEW_TAIL[pre + n].z = max(NEW_TAIL[pre + n].z, 0.0)
    legs[pre] = dict(hip=hip, knee=knee, ankle=ank, foot_len=f_len)
diag("legs", {k: {kk: tuple(round(x, 3) for x in vv) if isinstance(vv, Vector) else round(vv, 3)
                  for kk, vv in d.items()} for k, d in legs.items()})


def unit(v):
    v = np.asarray(v, float)
    return v / max(float(np.linalg.norm(v)), 1e-12)


def perp(v, axis):
    """v without its part along the unit axis, made unit."""
    return unit(v - (v @ axis) * axis)


def turn_about(u, v, axis):
    """Degrees that turn u into v about axis (right hand), both square to it."""
    return math.degrees(math.atan2(float(np.cross(u, v) @ axis), float(u @ v)))


def palm_turn(side, pre, wrist, tip):
    """How far the figure's hand is turned about its own line from the rigged hand swung onto it: by the
    widest way across the two hands (up to a half turn either way) and, with --palms, by the palms."""
    hf, hs = hands.get(pre), s_hands.get(pre)
    if hf is None or hs is None:
        return {}
    a_w = unit(np.array(S_TAIL[pre + "Hand"] - S_HEAD[pre + "Hand"]))
    a_f = unit(np.array(tip - wrist))
    swing = np.array(Vector(tuple(a_w)).rotation_difference(Vector(tuple(a_f))).to_matrix())
    width = turn_about(perp(swing @ perp(hs["width"], a_w), a_f), perp(hf["width"], a_f), a_f)
    out = dict(palm_ratio=round(hf["ratio"], 2), width_turn=round((width + 90.0) % 180.0 - 90.0, 1))
    if PALMS:
        n_w = hs["thick"] if hs["thick"][0] * -side >= 0 else -hs["thick"]  # the rigged palms face in
        n_s = perp(swing @ perp(n_w, a_w), a_f)
        want = {"up": (0, 0, 1), "down": (0, 0, -1), "forward": (0, -1, 0), "back": (0, 1, 0),
                "in": (-side, 0, 0), "out": (side, 0, 0)}[PALMS]
        n_f = hf["thick"] if hf["ratio"] >= 1.5 else np.array(want, float)  # a flat hand gives its own palm
        n_f = perp(n_f if n_f @ np.array(want, float) >= 0 else -n_f, a_f)
        out["palm_turn"] = round(turn_about(n_s, n_f, a_f), 1)
    return out


# arms: on the measured joints; the rigged arm, scaled, where the tracker found none or one out of proportion
L_rig = (L_up + L_fo + L_ha) * sz
arms = {}
TWIST = {}  # bone -> radians about its own line, on top of the swung roll
for side, pre in ((1, "Left"), (-1, "Right")):
    f = fits[pre]
    sh0 = scaled(S_HEAD[pre + "Arm"], sx_chest)
    how = "scaled (no fingertip found)" if f is None else f["info"]["how"]
    if f is not None:
        sh, elbow, wrist, tip = (Vector(tuple(float(x) for x in f[j])) for j in ("shoulder", "elbow", "wrist", "tip"))
        L = (elbow - sh).length + (wrist - elbow).length + (tip - wrist).length
        if how == "given":
            pass
        elif not 0.7 <= L / L_rig <= 1.4:
            how, f = "scaled (measured arm %.2f of the rigged one)" % (L / L_rig), None
        elif not 0.6 <= abs(sh.x) / max(abs(sh0.x), 1e-6) <= 1.5:
            how, f = "scaled (measured shoulder out of range %.3f)" % sh.x, None
    if f is None:
        sh, elbow, wrist, tip = [sh0] + [scaled(S_HEAD[pre + n], sx_chest) for n in ("ForeArm", "Hand")] + \
                                [scaled(S_TAIL[pre + "Hand"], sx_chest)]
    if f is None or f["info"]["how"] == "straight":
        # bend the elbow a little backwards (+Y) so it folds the right way when the clips bend it
        elbow = elbow + Vector((0.0, 0.01 * height, 0.0))
    clav = scaled(S_HEAD[pre + "Shoulder"], sx_chest)
    NEW_HEAD[pre + "Shoulder"], NEW_TAIL[pre + "Shoulder"] = clav, sh
    NEW_HEAD[pre + "Arm"], NEW_TAIL[pre + "Arm"] = sh, elbow
    NEW_HEAD[pre + "ForeArm"], NEW_TAIL[pre + "ForeArm"] = elbow, wrist
    NEW_HEAD[pre + "Hand"], NEW_TAIL[pre + "Hand"] = wrist, tip
    if pre + "HandMiddle4" in SB:
        NEW_HEAD[pre + "HandMiddle4"] = tip
        NEW_TAIL[pre + "HandMiddle4"] = tip + (tip - wrist) * 0.5
    arms[pre] = dict(how=how, shoulder=sh, elbow=elbow, wrist=wrist, tip=tip)
    if fits[pre] is not None:
        arms[pre].update({k: v for k, v in fits[pre]["info"].items() if k != "how"})
    if f is not None:
        arms[pre].update(palm_turn(side, pre, wrist, tip))
        if "palm_turn" in arms[pre]:
            TWIST[pre + "ForeArm"] = math.radians(arms[pre]["palm_turn"]) / 2
            TWIST[pre + "Hand"] = TWIST[pre + "HandMiddle4"] = math.radians(arms[pre]["palm_turn"])
diag("arms", {k: {kk: (tuple(round(x, 3) for x in vv) if isinstance(vv, Vector) else
                       (round(vv, 3) if isinstance(vv, float) else vv)) for kk, vv in d.items()}
              for k, d in arms.items()})
if not PALMS and any(abs(d.get("width_turn", 0.0)) > 45.0 for d in arms.values()):
    diag("palms turned far from the rigged ones", {k: d.get("width_turn") for k, d in arms.items()},
         "- check the clips and pass --palms with the way they face")

missing = [n for n in SB if n not in NEW_HEAD]
assert not missing, "bones without a place: %s" % missing

# the figure's armature: a copy of the rigged one with every bone moved
arm = src_arm.copy()
arm.data = src_arm.data.copy()
arm.name = "Armature"
arm.animation_data_clear()
scene.collection.objects.link(arm)
arm.matrix_world = Matrix.Identity(4)
select_only([arm], arm)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones
src_dir, src_z = {}, {}  # the copy's bones are still in the rigged object's space: their world directions
for b in eb:
    src_dir[short(b.name)] = (amw.to_3x3() @ (b.tail - b.head)).normalized()
    src_z[short(b.name)] = (amw.to_3x3() @ b.z_axis).normalized()
for b in eb:
    b.use_connect = False
for b in eb:
    n = short(b.name)
    b.head = NEW_HEAD[n]
    b.tail = NEW_TAIL[n]
    if (b.tail - b.head).length < 1e-4:
        b.tail = b.head + src_dir[n] * 0.02
    q = src_dir[n].rotation_difference((b.tail - b.head).normalized())
    b.align_roll(Matrix.Rotation(TWIST.get(n, 0.0), 3, (b.tail - b.head).normalized()) @ (q @ src_z[n]))
bpy.ops.object.mode_set(mode="OBJECT")
for b in arm.data.bones:
    b.use_deform = not any(short(b.name).endswith(e) for e in END_BONES)
diag("skeleton built: deform bones", sum(b.use_deform for b in arm.data.bones))

joints = {short(b.name): [list(map(float, arm.matrix_world @ b.head_local)),
                          list(map(float, arm.matrix_world @ b.tail_local))] for b in arm.data.bones}

# ---------------------------------------------------------------- 4. bind
select_only([vox, arm], arm)
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
deform = {b.name for b in arm.data.bones if b.use_deform}
vw = np.zeros(len(vox.data.vertices))
for vv in vox.data.vertices:
    vw[vv.index] = sum(g.weight for g in vv.groups if vox.vertex_groups[g.group].name in deform)
diag("bone heat on the voxel copy: verts", len(vw), "without weight", int((vw < 0.5).sum()))

for g in vox.vertex_groups:
    if g.name not in fig.vertex_groups:
        fig.vertex_groups.new(name=g.name)
dt = fig.modifiers.new("weights", "DATA_TRANSFER")
dt.object = vox
dt.use_vert_data = True
dt.data_types_verts = {"VGROUP_WEIGHTS"}
dt.vert_mapping = "POLYINTERP_NEAREST"
dt.layers_vgroup_select_src = "ALL"
dt.layers_vgroup_select_dst = "NAME"
select_only([fig], fig)
bpy.ops.object.modifier_apply(modifier=dt.name)
bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)

co = world_verts(fig)
nv = len(co)
names = [b.name for b in arm.data.bones if b.use_deform]
H_ = np.array([list(arm.matrix_world @ arm.data.bones[n].head_local) for n in names])
T_ = np.array([list(arm.matrix_world @ arm.data.bones[n].tail_local) for n in names])
D_ = T_ - H_
L2 = np.maximum((D_ * D_).sum(1), 1e-9)
tt = np.clip(((co[:, None, :] - H_[None]) * D_[None]).sum(2) / L2[None], 0, 1)
dist = np.linalg.norm(co[:, None, :] - (H_[None] + tt[:, :, None] * D_[None]), axis=2)
nearest = dist.argmin(1)
empty = [vv.index for vv in fig.data.vertices if sum(g.weight for g in vv.groups) < 0.5]
for vi in empty:
    for g in fig.vertex_groups:
        try:
            g.remove([vi])
        except RuntimeError:
            pass
    fig.vertex_groups[names[nearest[vi]]].add([vi], 1.0, "REPLACE")
diag("weights carried to the mesh; filled from the nearest bone", len(empty), "of", nv)

# each vertex keeps the bones of its own part. The watertight copy joins whatever touches (a hand on the hem, a
# sleeve on the back, a belt end on the hand), so bone heat leaks across the touch. The cores of the arms and
# everything far from them are sure; every other vertex goes with the one it reaches first over the figure's own
# (welded) surface. Body vertices lose forearm and hand weights, arm vertices lose leg and other-arm weights.
CHAIN = ("Arm", "ForeArm", "Hand")
LEGS = ("UpLeg", "Leg", "Foot", "ToeBase")
wm = np.zeros((nv, len(names)))
col = {fig.vertex_groups[n].index: k for k, n in enumerate(names) if n in fig.vertex_groups}
for vv in fig.data.vertices:
    for g in vv.groups:
        if g.group in col:
            wm[vv.index, col[g.group]] = g.weight
k_of = {short(n): k for k, n in enumerate(names)}
GIVEN = [pre for pre in ("Left", "Right") if arms[pre]["how"] == "given"]
near = {}  # arm bone -> vertex distance to it in units of its own thickness
for pre in ("Left", "Right"):
    for b in CHAIN:
        k = k_of[pre + b]
        r_b = float(np.median(dist[wm[:, k] > 0.5, k])) if (wm[:, k] > 0.5).any() else 0.04 * height
        if pre in GIVEN:  # the measured thickness: bone heat leaks into a cape or a hem pressed on the arm
            r_b = arms[pre]["r_arm"]
            if b == "Hand":  # a spread thumb sits far from the hand's line
                r_b = max(r_b, 0.3 * (arms[pre]["tip"] - arms[pre]["wrist"]).length)
        near[pre + b] = dist[:, k] / max(r_b, 0.01 * height)
side_near = {pre: np.min([near[pre + b] for b in CHAIN], axis=0) for pre in ("Left", "Right")}
part = np.full(nv, -1)  # 0 body, 1 left arm, 2 right arm
part[np.minimum(side_near["Left"], side_near["Right"]) > 2.5] = 0
facing = {pre: np.zeros(nv, bool) for pre in ("Left", "Right")}
if GIVEN:
    # a surface near a given arm that faces it (a hem, a cape or a pocket pressed on the arm) is the body's: its
    # normal points at the arm's line, where the arm's own surface points away from it. Not between the fingers.
    nrm = np.zeros(nv * 3)
    fig.data.vertex_normals.foreach_get("vector", nrm)
    nrm = nrm.reshape(-1, 3) @ np.array(fig.matrix_world.to_3x3()).T
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    for pre in GIVEN:
        ks = [k_of[pre + b] for b in CHAIN]
        kn = np.array(ks)[np.argmin([near[pre + b] for b in CHAIN], axis=0)]  # the nearest bone of this arm
        rad = co - (H_[kn] + tt[np.arange(nv), kn][:, None] * D_[kn])
        out = (rad * nrm).sum(1) / np.maximum(np.linalg.norm(rad, axis=1), 1e-9)
        sn = side_near[pre]
        facing[pre] = (sn <= 2.5) & (out < -0.2) & ((kn != k_of[pre + "Hand"]) | (sn > 1.0))
        part[facing[pre]] = 0
    diag("given arms: vertices facing them, made the body's", {pre: int(facing[pre].sum()) for pre in GIVEN})
    beyond = {}
    for pre in GIVEN:  # a hem or a pocket the draft fused along a hanging arm sticks out of the arm's thickness
        a = arms[pre]
        away = np.linalg.norm(co - np.array(a["shoulder"]), axis=1) > 0.5 * (a["elbow"] - a["shoulder"]).length
        sel = away & (side_near[pre] > a["reach"]) & (side_near[pre] <= side_near["Right" if pre == "Left" else "Left"])
        part[sel] = 0
        beyond[pre] = (a["reach"], int(sel.sum()))
    diag("given arms: reach (in r_arm) and the vertices beyond it, made the body's", beyond)
part[(side_near["Left"] <= 1.0) & ~facing["Left"]] = 1
part[(side_near["Right"] <= 1.0) & (side_near["Right"] < side_near["Left"]) & ~facing["Right"]] = 2
_, node = np.unique(np.round(co / 1e-5).astype(np.int64), axis=0, return_inverse=True)
node = node.ravel()
nn = int(node.max()) + 1
ev = np.array([e.vertices[:] for e in fig.data.edges], dtype=np.int64).reshape(-1, 2)
ea, eb_ = node[ev[:, 0]], node[ev[:, 1]]
elen = np.linalg.norm(co[ev[:, 0]] - co[ev[:, 1]], axis=1)
keep_e = ea != eb_
ea, eb_, elen = np.r_[ea[keep_e], eb_[keep_e]], np.r_[eb_[keep_e], ea[keep_e]], np.r_[elen[keep_e], elen[keep_e]]
order = np.argsort(ea, kind="stable")
ea, eb_, elen = ea[order], eb_[order], elen[order]
start = np.searchsorted(ea, np.arange(nn + 1))
seed = np.full(nn, -1)
for p in (0, 1, 2):
    seed[node[part == p]] = p
best = np.full(nn, np.inf)
lab = np.full(nn, -1)
heap = [(0.0, int(i), int(seed[i])) for i in np.flatnonzero(seed >= 0)]
heapq.heapify(heap)
while heap:
    d0, i, p = heapq.heappop(heap)
    if lab[i] >= 0:
        continue
    lab[i] = p
    for j, w in zip(eb_[start[i]:start[i + 1]], elen[start[i]:start[i + 1]]):
        if lab[j] < 0 and d0 + w < best[j]:
            best[j] = d0 + w
            heapq.heappush(heap, (d0 + w, int(j), p))
if GIVEN:
    # a piece of the body joined to the rest of the body only through an arm (a thumb, a cuff) is that arm's
    islands, moved_isl = np.full(nn, -1), 0
    for i0 in np.flatnonzero(lab == 0):
        if islands[i0] >= 0:
            continue
        islands[i0] = i0
        comp, stack, touch_arm = [i0], [i0], set()
        while stack:
            i = stack.pop()
            for j in eb_[start[i]:start[i + 1]]:
                if lab[j] == 0 and islands[j] < 0:
                    islands[j] = i0
                    comp.append(j)
                    stack.append(j)
                elif lab[j] > 0:
                    touch_arm.add(int(lab[j]))
        if len(comp) < 0.05 * nn and len(touch_arm) == 1:
            p = touch_arm.pop()
            if ("Left", "Right")[p - 1] in GIVEN:
                lab[comp] = p
                moved_isl += len(comp)
    diag("body pieces inside a given arm moved to it: nodes", moved_isl)
part = lab[node]
drop = {0: [k_of[pre + b] for pre in ("Left", "Right") for b in ("ForeArm", "Hand")],
        1: [k_of["Right" + b] for b in CHAIN] + [k_of[pre + b] for pre in ("Left", "Right") for b in LEGS],
        2: [k_of["Left" + b] for b in CHAIN] + [k_of[pre + b] for pre in ("Left", "Right") for b in LEGS]}
moved = {0: 0, 1: 0, 2: 0}
pending = {}  # given arms: vertex -> bones it may not keep, weighted below as its nearest neighbour of its part


def reweight(vi, w):
    w = w / w.sum()
    for n in [fig.vertex_groups[g.group].name for g in fig.data.vertices[vi].groups]:
        if n in col_of:
            fig.vertex_groups[n].remove([int(vi)])
    for k in np.flatnonzero(w > 0.01):
        fig.vertex_groups[names[k]].add([int(vi)], float(w[k]), "REPLACE")


def nearest_bone(vi, ks):
    dd = dist[vi].copy()
    dd[ks] = np.inf
    w = np.zeros(len(names))
    w[int(dd.argmin())] = 1.0
    return w


col_of = {n: k for k, n in enumerate(names)}
for p, ks in drop.items():
    sel = np.flatnonzero((part == p) & (wm[:, ks].max(axis=1) > 0.01))
    for vi in sel:
        w = wm[vi].copy()
        w[ks] = 0.0
        moved[p] += 1
        if w.sum() < 0.05:  # nothing of its own part
            if GIVEN:
                pending[int(vi)] = list(ks)
                continue
            w = nearest_bone(vi, ks)  # the nearest bone it may keep
        reweight(vi, w)
for pre in GIVEN:  # the body below the middle of a given upper arm (a cape, a hem, a strap) does not follow it
    a = arms[pre]
    L_up = (a["elbow"] - a["shoulder"]).length
    z_cut, z_full = a["shoulder"].z - 0.5 * L_up, a["shoulder"].z - 0.25 * L_up
    ka = k_of[pre + "Arm"]
    sel = np.flatnonzero((part == 0) & (co[:, 2] < z_cut) & (wm[:, ka] > 0.01))
    for vi in sel:
        ex = drop[0] + [ka]
        w = wm[vi].copy()
        w[ex] = 0.0
        if int(vi) in pending or w.sum() < 0.05:
            pending[int(vi)] = sorted(set(pending.get(int(vi), [])) | set(ex))
            continue
        reweight(vi, w)
    # and above it the body's share of the upper arm grows from none to all of it a quarter of the upper arm below
    # the shoulder (the rest goes to the collarbone), so a bare armpit stretches over that band instead of over the
    # one row of faces at the cut
    fade = np.flatnonzero((part == 0) & (co[:, 2] >= z_cut) & (co[:, 2] < z_full) & (wm[:, ka] > 0.01))
    for vi in fade:
        if int(vi) in pending:
            continue
        w = wm[vi].copy()
        w[drop[0]] = 0.0
        moved_w = w[ka] * (z_full - co[vi, 2]) / (z_full - z_cut)  # to the collarbone, which carries the arm
        w[ka] -= moved_w
        w[k_of[pre + "Shoulder"]] += moved_w
        if w.sum() >= 0.05:
            reweight(vi, w)
    diag("given arm", pre, "upper arm weight taken from the body below z", round(z_cut, 3), "vertices", len(sel),
         "faded up to z", round(z_full, 3), "vertices", len(fade))
for p, pre in ((1, "Left"), (2, "Right")):
    # a given arm away from its shoulder moves with its own bones only: where the draft fused it to a dress, bone
    # heat gave its inner side the hips and the spine, and those corners would stay behind when it swings
    if pre not in GIVEN:
        continue
    a = arms[pre]
    ks = [k_of[pre + b] for b in CHAIN]
    away = np.linalg.norm(co - np.array(a["shoulder"]), axis=1) > 0.5 * (a["elbow"] - a["shoulder"]).length
    sel = np.flatnonzero((part == p) & away)
    for vi in sel:
        pending.pop(int(vi), None)
        w = np.zeros(len(names))
        w[ks] = wm[vi, ks]
        if w.sum() < 0.05:
            w[ks[int(np.argmin(dist[vi, ks]))]] = 1.0
        reweight(vi, w)
    diag("given arm", pre, "away from the shoulder, on its own bones only: vertices", len(sel))
if pending:
    # a vertex left with nothing of its own part (a dress the draft fused to an arm, which bone heat gave only the
    # forearm) takes the weights of the nearest vertex of its part that kept some, so it blends into the cloth
    # around it instead of jumping to whichever bone is nearest (an upper arm, for a dress at the wrist)
    filled = 0
    for p in (0, 1, 2):
        vs = [vi for vi in pending if part[vi] == p]
        good = np.flatnonzero(part == p)
        good = good[~np.isin(good, list(pending))]
        if not vs:
            continue
        kd = KDTree(len(good))
        for i in good:
            kd.insert(Vector(co[i]), int(i))
        kd.balance()
        for vi in vs:
            w = np.zeros(len(names))
            if len(good):
                for g in fig.data.vertices[kd.find(Vector(co[vi]))[1]].groups:
                    n = fig.vertex_groups[g.group].name
                    if n in col_of:
                        w[col_of[n]] = g.weight
            w[pending[vi]] = 0.0
            if w.sum() < 0.05:
                w = nearest_bone(vi, pending[vi])
            reweight(vi, w)
            filled += 1
    diag("given arms: vertices with nothing of their own part, weighted as their nearest neighbour", filled)
diag("weights kept to each vertex's own part: vertices body / left arm / right arm",
     [int((part == p).sum()) for p in (0, 1, 2)], "unreached", int((part < 0).sum()),
     "re-weighted", [moved[p] for p in (0, 1, 2)])

if SKIRT:
    # the hem: the lowest height above the knees where the legs are still one stretch of cloth
    hips_z = NEW_HEAD["LeftUpLeg"].z
    knee_z = (legs["Left"]["knee"].z + legs["Right"]["knee"].z) / 2
    hem_z = knee_z
    for k in range(B.k(hips_z), B.k(knee_z * 0.8), -1):
        rs = [r for r in runs(B.front[:, k]) if B.x(r[1]) - B.x(r[0]) > 0.03]
        if len(rs) >= 2:
            hem_z = B.z(k)
            break
    hips_name = [n for n in names if short(n) == "Hips"][0]
    lup = [n for n in names if short(n) == "LeftUpLeg"][0]
    rup = [n for n in names if short(n) == "RightUpLeg"][0]
    upper = {"Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "RightShoulder", "LeftArm", "RightArm",
             "LeftForeArm", "RightForeArm", "LeftHand", "RightHand"}
    band = 0.12 * height / 1.75
    changed = 0
    for vi in range(nv):
        z, x = co[vi, 2], co[vi, 0]
        if z >= hips_z or z <= hem_z or short(names[nearest[vi]]) in upper:
            continue
        f = float(np.clip((z - hem_z) / max(0.06 * height, 1e-6), 0.0, 1.0))  # 0 at the hem: legs keep it
        u = float(np.clip(0.5 - x / (2 * band), 0.0, 1.0))  # 1 = the right thigh (-X)
        h = 0.15 + 0.45 * float(np.clip((z - knee_z) / max(hips_z - knee_z, 1e-6), 0.0, 1.0))
        old = {fig.vertex_groups[g.group].name: g.weight for g in fig.data.vertices[vi].groups}
        new = {hips_name: h, lup: (1 - h) * (1 - u), rup: (1 - h) * u}
        mix = {n: (1 - f) * old.get(n, 0.0) + f * new.get(n, 0.0) for n in set(old) | set(new)}
        for g in list(fig.data.vertices[vi].groups):
            fig.vertex_groups[g.group].remove([vi])
        for n, w in mix.items():
            if w > 0.01:
                fig.vertex_groups[n].add([vi], w, "REPLACE")
        changed += 1
    select_only([fig], fig)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    diag("skirt: hem z", round(hem_z, 3), "hips z", round(hips_z, 3), "re-weighted", changed)

# where a forearm or a hand touches the rest of the body (a belt end tucked under the thumb, a hand on the hip) the
# draft fused the two into one surface, which would stretch as soon as the arm swings. Each place an arm's part
# meets the body's part over the surface is one touch; the shoulder seam, where the upper arm meets the body,
# stays. At every other touch the body's side, one vertex deep, is cut away and both holes are closed.
one = ea < eb_  # every welded edge once
ka, kb = ea[one], eb_[one]
la, lb = lab[ka], lab[kb]
crossing = (np.minimum(la, lb) == 0) & (np.maximum(la, lb) > 0)
n_body = np.where(la == 0, ka, kb)[crossing]
n_arm = np.where(la == 0, kb, ka)[crossing]
pos = np.zeros((nn, 3))
pos[node] = co
rep = np.zeros(nn, dtype=np.int64)
rep[node] = np.arange(nv)
mid = (pos[n_body] + pos[n_arm]) / 2
touch = np.full(len(mid), -1)  # touches: crossing edges of one arm chained by their midpoints
n_touch = 0
for i in range(len(mid)):
    if touch[i] >= 0:
        continue
    touch[i] = n_touch
    stack = [i]
    while stack:
        j = stack.pop()
        nb = np.flatnonzero((touch < 0) & (lab[n_arm] == lab[n_arm[j]]) &
                            (np.linalg.norm(mid - mid[j], axis=1) < 0.009 * height))
        touch[nb] = n_touch
        stack.extend(nb.tolist())
    n_touch += 1
gone_nodes = []
for t in range(n_touch):
    sel = touch == t
    pre = "Left" if lab[n_arm[sel][0]] == 1 else "Right"
    if pre in GIVEN:  # a measured arm: every crossing edge away from the shoulder is a touch, whatever it holds
        a = arms[pre]
        far = np.linalg.norm(mid[sel] - np.array(a["shoulder"]), axis=1) > 0.5 * (a["elbow"] - a["shoulder"]).length
        gone_nodes.extend(np.unique(n_body[sel][far]).tolist())
        diag("arm touch", pre, "edges", int(sel.sum()), "centre", tuple(round(float(x), 3) for x in mid[sel].mean(0)),
             "given arm: cut away %d, kept at the shoulder %d" % (int(far.sum()), int((~far).sum())))
        continue
    lower = np.median(wm[rep[n_arm[sel]]][:, [k_of[pre + "ForeArm"], k_of[pre + "Hand"]]].sum(axis=1))
    cut = lower > 0.5
    if cut:
        gone_nodes.extend(np.unique(n_body[sel]).tolist())
    diag("arm touch", pre, "edges", int(sel.sum()), "centre", tuple(round(float(x), 3) for x in mid[sel].mean(0)),
         "forearm and hand share %.2f" % lower, "cut away" if cut else "kept (the shoulder seam)")
if gone_nodes:
    gone = np.flatnonzero(np.isin(node, gone_nodes))
    bm = bmesh.new()
    bm.from_mesh(fig.data)
    bm.verts.ensure_lookup_table()
    side = bm.verts.layers.int.new("part") if GIVEN else None
    if side is not None:  # a given arm's holes are closed part by part (see close_holes)
        for vv in bm.verts:
            vv[side] = int(part[vv.index])
    bmesh.ops.delete(bm, geom=[bm.verts[int(i)] for i in gone], context="VERTS")
    nv0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    nv1 = len(bm.verts)
    rings = close_holes(bm, side)
    if side is not None:
        bm.verts.layers.int.remove(side)
    dl = bm.verts.layers.deform.verify()
    for vv in bm.verts:  # the centre of each closing fan: the mean weights of its rim
        if not vv[dl].keys():
            rim = [e.other_vert(vv) for e in vv.link_edges]
            for u in rim:
                for g, w in u[dl].items():
                    vv[dl][g] = vv[dl].get(g, 0.0) + w / len(rim)
    open1 = sum(e.is_boundary for e in bm.edges)
    bm.to_mesh(fig.data)
    bm.free()
    select_only([fig], fig)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    diag("touches cut: vertices removed", len(gone), "welded", nv0 - nv1, "holes closed", rings,
         "open edges left", open1)

counts = {}
for vv in fig.data.vertices:
    for g in vv.groups:
        if g.weight > 0.3:
            nm = short(fig.vertex_groups[g.group].name)
            counts[nm] = counts.get(nm, 0) + 1
diag("verts per bone (>0.3)", sorted(counts.items(), key=lambda x: -x[1]))
bpy.data.objects.remove(vox, do_unlink=True)
fig.parent = arm
am = fig.modifiers.new("Armature", "ARMATURE")
am.object = arm

# ---------------------------------------------------------------- 5. retarget the clips
src_arm.scale = tuple(s * sz for s in src_arm.scale)
bpy.context.view_layer.update()
src_hips = src_arm.matrix_world @ SB["Hips"].head_local
src_arm.location = src_arm.location + (NEW_HEAD["Hips"] - src_hips)
bpy.context.view_layer.update()
for pb in arm.pose.bones:
    c = pb.constraints.new("COPY_ROTATION")
    c.target, c.subtarget = src_arm, [b.name for b in src_arm.data.bones if short(b.name) == short(pb.name)][0]
    c.target_space = c.owner_space = "WORLD"
    if short(pb.name) == "Hips":
        c2 = pb.constraints.new("COPY_LOCATION")
        c2.target, c2.subtarget = src_arm, c.subtarget
        c2.target_space = c2.owner_space = "WORLD"
src_arm.animation_data_create()
arm.animation_data_create()
baked = []
for a in clips:
    name = a["clip"]
    src_arm.animation_data.action = a
    if hasattr(src_arm.animation_data, "action_slot") and len(getattr(a, "slots", [])):
        src_arm.animation_data.action_slot = a.slots[0]
    f0, f1 = int(round(a.frame_range[0])), int(round(a.frame_range[1]))
    scene.frame_start, scene.frame_end = f0, f1
    select_only([arm], arm)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, step=1, only_selected=False, visual_keying=True,
                     clear_constraints=False, clear_parents=False, use_current_action=False,
                     clean_curves=False, bake_types={"POSE"})
    bpy.ops.object.mode_set(mode="OBJECT")
    act = arm.animation_data.action
    act.name = name
    baked.append((act, f0, f1))
    arm.animation_data.action = None
    diag("baked", name, "frames", f0, f1)
for pb in arm.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
src_arm.animation_data.action = None


def ground_speed(act, f0, f1):
    """Metres per second at this size: how fast a planted foot slides back under the body (as quad_pass.py,
    without the frames where a low foot still swings forward as it lands or lifts)."""
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and len(getattr(act, "slots", [])):
        arm.animation_data.action_slot = act.slots[0]
    out = []
    for side in ("LeftToeBase", "RightToeBase"):
        pb = [p for p in arm.pose.bones if short(p.name) == side][0]
        pts = []
        for f in range(f0, f1 + 1):
            scene.frame_set(f)
            pts.append(arm.matrix_world @ pb.head)
        z = np.array([p.z for p in pts])
        y = np.array([p.y for p in pts])
        planted = z <= z.min() + 0.15 * (z.max() - z.min())
        v = [(y[i + 1] - y[i]) * scene.render.fps for i in range(len(y) - 1)
             if planted[i] and planted[i + 1] and y[i + 1] > y[i]]
        if v:
            out.append(float(np.median(v)))
    arm.animation_data.action = None
    diag("ground speed per foot", act.name, [round(x, 3) for x in out])
    return float(np.mean(out)) if out else 0.0


ad = arm.animation_data
for act, f0, f1 in baked:
    if act.name in ("Walk", "Run"):
        act["groundSpeed"] = round(ground_speed(act, f0, f1), 4)
        diag("ground speed", act.name, act["groundSpeed"], "m/s")
    tr = ad.nla_tracks.new()
    tr.name = act.name
    tr.strips.new(act.name, f0, act)

# ---------------------------------------------------------------- 6. sockets
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
z_back = NEW_HEAD["Spine2"].z
t_back = B.torso(z_back)
y_back = t_back[3]
col = B.occ[B.i(-0.08):B.i(0.08) + 1, :, :].any(axis=0)  # (y, z) near the middle
k_head = B.k(NEW_HEAD["Head"].z)
head_top = NEW_TAIL["HeadTop_End"].z if "HeadTop_End" in NEW_TAIL else B.top - HEADWEAR
z_skull = min(B.top - HEADWEAR, max(head_top, NEW_HEAD["Head"].z + 0.06 * height))
sockets = {"socket_back": ("Spine2", Vector((0.0, y_back, z_back))),
           "socket_head": ("Head", Vector((0.0, NEW_HEAD["Head"].y, z_skull)))}
for nm, (bone, pos) in sockets.items():
    e = bpy.data.objects.new(nm, None)
    e.empty_display_size = 0.05
    scene.collection.objects.link(e)
    e.parent = arm
    e.parent_type = "BONE"
    e.parent_bone = [b.name for b in arm.data.bones if short(b.name) == bone][0]
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(pos)
    joints[nm] = [list(map(float, pos)), list(map(float, pos))]
diag("sockets", {k: tuple(round(x, 3) for x in v[1]) for k, v in sockets.items()})
arm.data.pose_position = "POSE"

# ---------------------------------------------------------------- 7. export
for img in bpy.data.images:
    w, h = img.size
    if max(w, h) > TEX:
        k = TEX / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
diag("maps", [(i.name, tuple(i.size)) for i in bpy.data.images if i.size[0]])

if PROBE:
    with open(PROBE + "-joints.json", "w") as fh:
        json.dump({"joints": joints, "height": height, "top": B.top}, fh)
    cam_data = bpy.data.cameras.new("probe")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = (B.top - B.z0) * 1.12
    cam = bpy.data.objects.new("probe", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.light = "STUDIO"
    scene.render.resolution_x, scene.render.resolution_y = 420, 760
    scene.render.film_transparent = False
    zc = (B.top + B.z0) / 2
    views = {"front": (Vector((0, -6, zc)), (math.pi / 2, 0, 0)),
             "side": (Vector((6, 0, zc)), (math.pi / 2, 0, math.pi / 2))}

    def shoot(tag):
        for vn, (loc, rot) in views.items():
            cam.location, cam.rotation_euler = loc, rot
            scene.render.filepath = "%s-%s-%s.png" % (PROBE, tag, vn)
            bpy.ops.render.render(write_still=True)

    arm.data.pose_position = "REST"
    shoot("rest")
    arm.data.pose_position = "POSE"
    for act, f0, f1 in baked:
        ad.action = act
        if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
            ad.action_slot = act.slots[0]
        for tr in ad.nla_tracks:
            tr.mute = True
        for f in (f0, f0 + (f1 - f0) // 4, f0 + (f1 - f0) // 2):
            scene.frame_set(f)
            shoot("%s-%02d" % (act.name, f))
        ad.action = None
    for tr in ad.nla_tracks:
        tr.mute = False
    bpy.data.objects.remove(cam, do_unlink=True)

for o in [src_arm] + [o for o in bpy.data.objects if o.parent == src_arm]:
    bpy.data.objects.remove(o, do_unlink=True)
for a in clips:
    bpy.data.actions.remove(a)
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
keep = [fig, arm] + [o for o in bpy.data.objects if o.name.startswith("socket_")]
select_only(keep, arm)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
want = dict(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
            export_animation_mode="ACTIONS", export_extras=True, export_skins=True, export_image_format="JPEG",
            export_jpeg_quality=90, export_image_quality=90, export_yup=True, export_apply=False,
            export_force_sampling=True, export_optimize_animation_size=True, export_anim_slide_to_zero=True)
kw = {k: v for k, v in want.items() if k in props}
bpy.ops.export_scene.gltf(**kw)
diag("wrote", OUT, "options skipped", sorted(set(want) - set(kw)))
