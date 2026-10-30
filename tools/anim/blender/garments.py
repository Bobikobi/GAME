"""Race bodies and garments for the anim tool's Blender half.

A race's build is made on the shared rig (the Quaternius Universal Base Characters skeleton, the one every library clip
plays on), by moving and scaling the bones, never by fitting a garment to the human's width:

  thin_rest(arms, meshes, thin)    narrow the rest mesh about each bone's axis (chest, waist, limbs, hands)
  ubc_build(arms, meshes, build)   move the shoulders in and lengthen arms and legs: the bones themselves are edited and every
                                   mesh follows by its weights, so each wearable skinned to the rig fits the thin body
  make_garment / make_pouch        a cloak, robe or pouch made of own geometry (a loft of ellipse rings), skinned to the same
                                   rig by height and by thigh, one flat material each

The elf of the 27.10 pick (a tall, thin build with a pastel hooded cloak open at the front, sky blue at the pick and green since 30.10) is these four calls with
the numbers in tools/anim/races/elf.json. Own work, no outside licence. Written for Blender 5.x headless; nothing here
imports from the repository.
"""
import bpy, bmesh, math
from mathutils import Vector

def bone_world_rest(arms, name):
    for a in arms:
        if name in a.data.bones:
            b = a.data.bones[name]
            return a.matrix_world @ b.head_local, a.matrix_world @ b.tail_local
    return None, None
def thin_rest(arms, meshes, thin):
    """Narrow the rest mesh about each bone's axis: thin = [{"groups": [bone names], "axis": k} or {"groups": [...], "kx": a, "ky": b}].
    Each vertex moves by the weights of the bone groups it belongs to. Call it before ubc_build and before the garments are made."""
    rules = {}
    for r in thin:
        for gname in r["groups"]: rules[gname] = r
    if not rules: return
    for o in meshes:
        names = {gr.index: gr.name for gr in o.vertex_groups}
        if not names: continue
        mw = o.matrix_world; mi = mw.inverted(); cache = {}
        for n in names.values():
            if n in rules: cache[n] = bone_world_rest(arms, n)
        for v in o.data.vertices:
            if not v.groups: continue
            w = mw @ v.co; disp = Vector((0, 0, 0))
            for gr in v.groups:
                n = names[gr.group]
                if n not in cache or cache[n][0] is None: continue
                h, t = cache[n]; a = (t - h).normalized()
                r = rules[n]; off = w - (h + a * (w - h).dot(a))
                new = off * r["axis"] if "axis" in r else Vector((off.x * r["kx"], off.y * r["ky"], off.z))
                disp += gr.weight * (new - off)
            if disp.length > 0: v.co = mi @ (w + disp)

def ubc_build(arms, meshes, bd):
    d_in, ka, kl = bd.get("shoulder_in", 0.0), bd.get("arm_len", 1.0), bd.get("leg_len", 1.0)
    FING = ("thumb", "index", "middle", "ring", "pinky")
    infos = {}
    def info_of(a):
        if a.name in infos: return infos[a.name]
        mw = a.matrix_world; B = a.data.bones; inf = {}
        for sd, sg in (("_l", 1.0), ("_r", -1.0)):
            P = lambda n, w: mw @ (B[n + sd].head_local if w == "h" else B[n + sd].tail_local)
            ch, ct = P("clavicle", "h"), P("clavicle", "t")
            S0, E0, W0 = P("upperarm", "h"), P("lowerarm", "h"), P("hand", "h")
            S1 = S0 + Vector((-sg * d_in, 0, 0))
            E1 = S1 + (E0 - S0) * ka; W1 = E1 + (W0 - E0) * ka
            H0, K0, A0 = P("thigh", "h"), P("calf", "h"), P("foot", "h")
            K1 = H0 + (K0 - H0) * kl; A1 = K1 + (A0 - K0) * kl
            inf[sd] = dict(ch=ch, ct=ct, S0=S0, E0=E0, W0=W0, S1=S1, E1=E1, W1=W1, H0=H0, K0=K0, A0=A0, K1=K1, A1=A1)
        infos[a.name] = inf; return inf
    def disp(base, sd, w, I):
        if base == "clavicle":
            a_ = (I["ct"] - I["ch"]); L = a_.length; a_ /= L
            t = max(0.0, min(1.0, (w - I["ch"]).dot(a_) / L)); return (I["S1"] - I["S0"]) * t
        if base == "upperarm":
            a_ = (I["E0"] - I["S0"]).normalized(); r = w - I["S0"]
            return I["S1"] + (r - a_ * r.dot(a_)) + a_ * (r.dot(a_) * ka) - w
        if base == "lowerarm":
            a_ = (I["W0"] - I["E0"]).normalized(); r = w - I["E0"]
            return I["E1"] + (r - a_ * r.dot(a_)) + a_ * (r.dot(a_) * ka) - w
        if base == "hand" or base in FING: return I["W1"] - I["W0"]
        if base == "thigh":
            a_ = (I["K0"] - I["H0"]).normalized(); r = w - I["H0"]
            return I["H0"] + (r - a_ * r.dot(a_)) + a_ * (r.dot(a_) * kl) - w
        if base == "calf":
            a_ = (I["A0"] - I["K0"]).normalized(); r = w - I["K0"]
            return I["K1"] + (r - a_ * r.dot(a_)) + a_ * (r.dot(a_) * kl) - w
        if base in ("foot", "ball", "ball_leaf"): return I["A1"] - I["A0"]
        return None
    for o in meshes:
        names = {g.index: g.name for g in o.vertex_groups}
        if not names: continue
        ao = next((m.object for m in o.modifiers if m.type == "ARMATURE" and m.object), None) or arms[0]
        inf = info_of(ao); mw = o.matrix_world; mi = mw.inverted()
        for v in o.data.vertices:
            if not v.groups: continue
            w = mw @ v.co; dsp = Vector((0, 0, 0))
            for gr in v.groups:
                n = names[gr.group]
                if n[-2:] not in ("_l", "_r"): continue
                base = n[:-2]; first = base.split("_")[0]
                key = first if (first in FING or first == "ball") else base
                dd = disp(key, n[-2:], w, inf[n[-2:]])
                if dd is not None: dsp += gr.weight * dd
            if dsp.length > 0: v.co = mi @ (w + dsp)
    for ao, inf in [(a, infos[a.name]) for a in arms if a.name in infos]:
        bpy.context.view_layer.objects.active = ao
        bpy.ops.object.mode_set(mode="EDIT"); ai = ao.matrix_world.inverted(); eb = ao.data.edit_bones
        for sd in ("_l", "_r"):
            I = inf[sd]; sh = lambda v: ai.to_3x3() @ v
            eb["clavicle" + sd].tail = eb["clavicle" + sd].tail + sh(I["S1"] - I["S0"])
            eb["upperarm" + sd].head = ai @ I["S1"]; eb["upperarm" + sd].tail = ai @ I["E1"]
            eb["lowerarm" + sd].head = ai @ I["E1"]; eb["lowerarm" + sd].tail = ai @ I["W1"]
            hand_names = [b.name for b in eb if b.name.endswith(sd) and (b.name.split("_")[0] in FING or b.name == "hand" + sd)]
            for bn in hand_names:
                b_ = eb[bn]; t_ = sh(I["W1"] - I["W0"]); b_.head = b_.head + t_; b_.tail = b_.tail + t_ if bn != "hand" + sd else b_.tail + t_
            eb["thigh" + sd].tail = ai @ I["K1"]; eb["calf" + sd].head = ai @ I["K1"]; eb["calf" + sd].tail = ai @ I["A1"]
            for bn in ("foot", "ball", "ball_leaf"):
                b_ = eb[bn + sd]; t_ = sh(I["A1"] - I["A0"]); b_.head = b_.head + t_; b_.tail = b_.tail + t_
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
def flat_mat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value = (*rgb, 1)
    return m
CHAIN = [("spine_03", 1.40), ("spine_02", 1.245), ("spine_01", 1.125), ("pelvis", 1.0)]
def rest_weights(x, z, thigh_max):
    """weights {bone: w}: down the spine chain by height, then more and more to the thigh of that side below the hips."""
    ws = {}
    if z >= CHAIN[0][1]: ws["spine_03"] = 1.0
    elif z <= CHAIN[-1][1]: ws["pelvis"] = 1.0
    else:
        for (b0, z0), (b1, z1) in zip(CHAIN, CHAIN[1:]):
            if z1 <= z <= z0:
                t = (z - z1) / (z0 - z1); ws[b0] = t; ws[b1] = 1 - t; break
    if z < 0.95 and thigh_max > 0:
        t = min(1.0, (0.95 - z) / 0.6); t = t * t * (3 - 2 * t) * thigh_max
        side = max(-1.0, min(1.0, x / 0.10)); wl = t * (0.5 + 0.5 * side); wr = t * (0.5 - 0.5 * side)
        ws = {k_: v_ * (1 - t) for k_, v_ in ws.items()}
        if wl > 0: ws["thigh_l"] = wl
        if wr > 0: ws["thigh_r"] = wr
    return ws
def make_garment(sc, root, arms, meshes, name, spec, mat):
    """a loft of ellipse rings: spec = {"rings": [[z, rx, ry, cy], ...], "n": 36, "slit": [z_top, half_angle_deg] or None, "thigh": 0..1}"""
    n = spec.get("n", 36); rings = spec["rings"]
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    bm = bmesh.new(); rows = []
    for (z, rx, ry, cy) in rings:
        row = []
        for i in range(n):
            th = 2 * math.pi * i / n
            row.append(bm.verts.new((rx * math.sin(th), cy - ry * math.cos(th), z)))   # th = 0 is the front (-y)
        rows.append(row)
    sl = spec.get("slit")
    for r in range(len(rows) - 1):
        for i in range(n):
            j = (i + 1) % n; thm = 2 * math.pi * (i + 0.5) / n; thm = min(thm, 2 * math.pi - thm)
            zc = 0.5 * (rings[r][0] + rings[r + 1][0])
            if sl and zc < sl[0] and math.degrees(thm) < sl[1] * min(1.0, (sl[0] - zc) / 0.15): continue
            bm.faces.new((rows[r][i], rows[r][j], rows[r + 1][j], rows[r + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    names = set()
    wts = [rest_weights(v.co.x, v.co.z, spec.get("thigh", 0.3)) for v in me.vertices]
    for ws in wts: names |= set(ws)
    vgs = {nm: ob.vertex_groups.new(name=nm) for nm in names}
    for v, ws in zip(me.vertices, wts):
        for nm, w_ in ws.items(): vgs[nm].add([v.index], w_, "REPLACE")
    md = ob.modifiers.new("Arm", "ARMATURE"); md.object = arms[0]
    ob.parent = root; meshes.append(ob)
    return ob
def make_pouch(sc, root, arms, meshes, name, c, rad, mat):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
    for v in bm.verts: v.co = Vector((c[0] + v.co.x * rad[0], c[1] + v.co.y * rad[1], c[2] + v.co.z * rad[2]))
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    vg = ob.vertex_groups.new(name="spine_03"); vg.add([v.index for v in me.vertices], 1.0, "REPLACE")
    md = ob.modifiers.new("Arm", "ARMATURE"); md.object = arms[0]; ob.parent = root; meshes.append(ob)
    return ob
def garment(sc, root, arms, meshes, name, spec):
    """One garment from its spec: {"rgb", "rings", "slit", "thigh", "pouch": {"c", "r"}}; returns the cloth object."""
    mat = flat_mat(name + "Mat", spec["rgb"]); ob = make_garment(sc, root, arms, meshes, name, spec, mat) if spec.get("rings") else None
    if spec.get("pouch"): make_pouch(sc, root, arms, meshes, name + "Pouch", spec["pouch"]["c"], spec["pouch"]["r"], mat)
    return ob
