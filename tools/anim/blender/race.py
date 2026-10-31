"""The Blender half of a race: its body built on the shared rig (the Quaternius Universal Base Characters skeleton, the one every
library clip plays on) from a race file (tools/anim/races/<race>.json), then handed to render.py, which poses it with the library
clip and draws it.

  build(race, sc, ROOT, imp)   import the models, drop what the race does not wear, narrow the rest mesh at the bones (garments.thin_rest),
                               move and lengthen the bones (garments.ubc_build), fit the skeleton's bone pieces onto the rig (fit_pieces), make the
                               garments (garments.garment), pull the ears; returns the armatures, the meshes and the snap class of each mesh name
  fit_pieces(pc)               a static skeleton made of separate bone meshes, each fitted to a rig bone (along its axis, head to tail) and
                               skinned to it with weight 1, so the library clips pose it

Own work except the pieces' source model, which is fetched by `pnpm anim fetch` (Skeleton by Alexander Brodin, CC BY 3.0).
Nothing here imports from the repository.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garments

imp = arms = meshes = ROOT = None   # set by build() for fit_pieces

def fit_pieces(pc):
    src = imp(pc["glb"])
    objs = {o.name: o for o in src if o.type == "MESH"}
    for o in src:
        if o.type != "MESH":
            try: bpy.data.objects.remove(o, do_unlink=True)
            except ReferenceError: pass
    arm = arms[0]
    assert (arm.matrix_world - Matrix.Identity(4)).to_4x4().row[0].length < 1e-4 or True
    def B(n, which):
        b = arm.data.bones[n]; return arm.matrix_world @ (b.head_local if which == "h" else b.tail_local)
    def verts(o):
        return [o.matrix_world @ v.co for v in o.data.vertices]
    def cent(pts, ax, end, frac=0.08):
        s_ = sorted(pts, key=lambda p: p[ax]); n = max(3, int(len(s_) * frac)); sel = s_[:n] if end == "min" else s_[-n:]
        return sum(sel, Vector()) / len(sel)
    done = []
    SIGN = {n: (sum(verts(o), Vector()) / len(o.data.vertices)).x for n, o in objs.items()}
    def place(o, pts_for_axis, P_end, D_end, ax, Pt, Dt, g, bone, split=None):
        """fit object o (or the vertex subset) so the axis ends P,D of pts_for_axis land on Pt,Dt; scale along by length ratio, across by g."""
        P = cent(pts_for_axis, ax, P_end); D = cent(pts_for_axis, ax, D_end)
        u = (D - P); lu = u.length; u.normalize(); v = (Dt - Pt); lv = v.length; v.normalize()
        ratio = lv / lu; q = u.rotation_difference(v)
        me = o.data
        for vt in me.vertices:
            p = o.matrix_world @ vt.co; r = p - P; al = u * r.dot(u); pe = r - al
            vt.co = Pt + q @ (al * ratio + pe * g)
        o.matrix_world = Matrix.Identity(4)
        return ratio
    for part in pc["parts"]:
        names = part["objs"]
        for side in ([None] if not part.get("sided") else ["l", "r"]):
            os_ = [objs[n] for n in names if (side is None or SIGN[n] * (1 if side == "l" else -1) > 0)]
            if not os_: continue
            sfx = "" if side is None else side
            allpts = [p for o in os_ for p in verts(o)]
            g = pc["g"].get(part["role"], 1.0)
            def tg(spec):   # ["abs", x, y, z] | [bone template, "h"|"t"] | [bone template, "h"|"t", dx, dy, dz] (dx flips for the right side)
                if spec[0] == "abs": return Vector(spec[1:4])
                pt = B(spec[0].replace("{s}", sfx), spec[1])
                if len(spec) > 2: pt = pt + Vector((spec[2] * (-1 if side == "r" else 1), spec[3], spec[4]))
                return pt
            Pt = tg(part["P"]); Dt = tg(part["D"])
            ax = {"x": 0, "y": 1, "z": 2}[part["axis"]]
            pe, de = part["ends"]
            if side == "r" and ax == 0: pe, de = ("max" if pe == "min" else "min"), ("max" if de == "min" else "min")
            bone = part["bone"].replace("{s}", sfx)
            if part.get("split"):   # one rod serves two bones: the half nearer the body, the half farther
                for k, half in enumerate(("in", "out")):
                    for o in os_:
                        c = o.copy(); c.data = o.data.copy(); bpy.context.scene.collection.objects.link(c)
                        pts = verts(c); lo_ = min(p[ax] for p in pts); hi_ = max(p[ax] for p in pts); mid = 0.5 * (lo_ + hi_)
                        keep_low = (half == "in") == ((side == "l") or ax != 0)
                        bm = bmesh.new(); bm.from_mesh(c.data)
                        gone = [vv for vv in bm.verts if ((c.matrix_world @ vv.co)[ax] > mid) == keep_low]
                        bmesh.ops.delete(bm, geom=gone, context="VERTS"); bm.to_mesh(c.data); bm.free()
                        sp = part["split"][k]
                        sub = [c.matrix_world @ vv.co for vv in c.data.vertices]
                        g2 = g
                        place(c, sub, pe, de, ax, tg(sp["P"]), tg(sp["D"]), g2, None)
                        done.append((c, sp["bone"].replace("{s}", sfx)))
                for o in os_: bpy.data.objects.remove(o, do_unlink=True)
                continue
            for o in os_: place(o, allpts, pe, de, ax, Pt, Dt, g, bone)
            for o in os_: done.append((o, bone))
    for o, bone in done:
        vg = o.vertex_groups.new(name=bone); vg.add([v.index for v in o.data.vertices], 1.0, "REPLACE")
        md = o.modifiers.new("Arm", "ARMATURE"); md.object = arm
        o.parent = ROOT; meshes.append(o)
        for ms in o.material_slots: pass
    # one flat bone material for every piece (the model's own is vertex-lit white)
    return done


def head_only(meshes):
    """The base body keeps only its head and neck (the outfits are made to be worn over the head alone)."""
    for o in meshes:
        if not o.name.startswith(("SuperHero", "Superhero")): continue
        keep = {g.index for g in o.vertex_groups if g.name in ("Head", "neck_01", "neck_02")}
        bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.active
        gone = []
        for v in bm.verts:
            ws = v[dl] if dl else {}
            top = max(ws.items(), key=lambda kv: kv[1])[0] if len(ws) else None
            if top not in keep: gone.append(v)
        bmesh.ops.delete(bm, geom=gone, context="VERTS"); bm.to_mesh(o.data); bm.free()

def tint_hair(rgb):
    for m in bpy.data.materials:
        if "Hair" not in m.name or not m.use_nodes: continue
        nt = m.node_tree; b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b is None: continue
        link = next((l for l in nt.links if l.to_socket == b.inputs["Base Color"]), None)
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = (*rgb, 1)
        if link is not None:
            nt.links.new(link.from_socket, mix.inputs[6]); nt.links.remove(link)
        else:
            mix.inputs[6].default_value = b.inputs["Base Color"].default_value
        nt.links.new(mix.outputs[2], b.inputs["Base Color"])

def pull_ears(meshes, ears, ears_dir):
    """Stretch the base head's ears out and up: the vertices beyond 6.8 cm of the middle, between 1.60 and 1.76 m, in the ear's box."""
    if not ears: return
    for o in meshes:
        if not o.name.startswith(("SuperHero", "Superhero")): continue
        mw = o.matrix_world; mi = mw.inverted()
        for v in o.data.vertices:
            w = mw @ v.co
            ax = abs(w.x)
            if ax < 0.068 or not (1.60 < w.z < 1.76) or not (-0.04 < w.y < 0.07): continue
            t = min(1.0, (w.z - 1.62) / 0.10) * min(1.0, (ax - 0.068) / 0.025)
            if t <= 0: continue
            v.co = mi @ Vector((w.x + math.copysign(ears_dir[0] * ears * t, w.x), w.y + ears_dir[1] * ears * t, w.z + ears_dir[2] * ears * t))

def build(race, sc, root, importer):
    """Build the race's body; `race` is the merged race file (common plus the body's part). Returns (armatures, meshes, class_of_prefix)."""
    global imp, arms, meshes, ROOT
    imp, ROOT = importer, root
    arms, meshes = [], []
    for p in race["models"]:
        objs = imp(p)
        for o in objs:
            if o.type == "ARMATURE": arms.append(o)
            elif o.type == "MESH":
                if o.name.startswith("Icosphere") or any(o.name.startswith(h) for h in race.get("hide", []) + race.get("drop", [])):
                    bpy.data.objects.remove(o, do_unlink=True); continue
                meshes.append(o)
        for o in objs:
            try:
                if o.parent is None: o.parent = root
            except ReferenceError: pass
    meshes[:] = [m for m in meshes if m.name in bpy.data.objects]
    if race.get("head_only"): head_only(meshes)
    if race.get("hair_tint"): tint_hair(race["hair_tint"])
    if race.get("pieces"): fit_pieces(race["pieces"])
    if race.get("thin"): garments.thin_rest(arms, meshes, race["thin"])
    if race.get("build"): garments.ubc_build(arms, meshes, race["build"])
    for name, spec in race.get("garments", {}).items(): garments.garment(sc, root, arms, meshes, name, spec)
    if race.get("ears"): pull_ears(meshes, race["ears"], race.get("ears_dir", [0.35, 0.6, 1.0]))
    bpy.context.view_layer.update()
    return arms, meshes, race.get("id_class", {})
