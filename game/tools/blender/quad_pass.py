"""Make a game-ready four-legged character from a Meshy quadruped rig download.

Run:  blender -b -P quad_pass.py -- <walk_withSkin.glb> <out.glb> [--maps <textured.glb>] [--tex 1024]
                                     [--height 0.9] [--probe]

The rig download holds the mesh, a 27-joint skin and one clip (the walk). This pass:
- takes the material from --maps when the rig download came without images (same UV layout; the
  share of matching UV coordinates is printed),
- drops the emission input (the colour map wired to it flattens the light),
- turns the model so its head looks down glTF +Z and scales it to --height metres (ears, bind pose),
- names the walk "Walk", makes "Run" from it (one walk cycle played 1.8 times faster with longer leg
  swings, a body bob, a forward lean and the tail lifted) and "Idle" from the bind pose (breathing, a
  slow look around, a tail sway; a 6 s loop),
- measures how fast a planted foot slides back in Walk and Run and stores it on each clip as
  extras.groundSpeed (metres per second at the exported size), so a game can match the steps to the
  speed it moves the character at,
- caps every map at --tex pixels (default 1024) and exports one GLB with the three clips.
--probe prints the facts (bones, facing, clip, maps) and writes nothing.
Prints one DIAG line per fact.
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
MAPS = argv[argv.index("--maps") + 1] if "--maps" in argv else None
TEX = int(argv[argv.index("--tex") + 1]) if "--tex" in argv else 1024
HEIGHT = float(argv[argv.index("--height") + 1]) if "--height" in argv else 0.9
PROBE = "--probe" in argv
FPS = 30
RUN_SPEEDUP = 1.8
RUN_SWING = 1.5
IDLE_SECONDS = 6


def diag(*a):
    print("DIAG", *a, flush=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def all_fcurves(action):
    try:
        if len(action.fcurves):
            return list(action.fcurves)
    except Exception:
        pass
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def rest_pose(arm):
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()


def world_head(arm, name):
    return arm.matrix_world @ arm.pose.bones[name].head


# ------------------------------------------------------------------ load
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
objs = import_glb(SRC)
arms = [o for o in objs if o.type == "ARMATURE"]
assert len(arms) == 1, "expected one armature, got %d" % len(arms)
arm = arms[0]
diag("objects", [(o.name, o.type, o.parent.name if o.parent else None,
                  len(o.data.vertices) if o.type == "MESH" else None,
                  [m.type for m in o.modifiers] if o.type == "MESH" else None) for o in objs])
# the skinned mesh is the character; anything else (a bone display shape) is dropped
skinned = [o for o in objs if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
assert len(skinned) == 1, "expected one skinned mesh, got %d" % len(skinned)
mesh = skinned[0]
drop = [o for o in objs if o.type == "MESH" and o is not mesh]
objs = [o for o in objs if o not in drop]
for o in drop:
    bpy.data.objects.remove(o, do_unlink=True)
walk = [a for a in bpy.data.actions]
assert len(walk) == 1, "expected one clip in the rig download, got %s" % [a.name for a in walk]
walk = walk[0]
diag("source", SRC.rsplit("/", 1)[-1], "verts", len(mesh.data.vertices), "tris",
     sum(len(p.vertices) - 2 for p in mesh.data.polygons), "clip", walk.name, "frames", tuple(walk.frame_range))
diag("parents", {o.name: (o.parent.name if o.parent else None) for o in objs})

# ------------------------------------------------------------------ facing: head down glTF +Z = Blender -Y
rest_pose(arm)
hips = world_head(arm, "Hips")
head = world_head(arm, "head")
fwd = head - hips
turn = -math.pi / 2 - math.atan2(fwd.y, fwd.x)
rot = Matrix.Rotation(turn, 4, "Z")
for o in objs:
    if o.parent is None:
        o.matrix_world = rot @ o.matrix_world
bpy.context.view_layer.update()
hips = world_head(arm, "Hips")
fwd = world_head(arm, "head") - hips
diag("turned about Z by", round(math.degrees(turn), 1), "deg; head - hips now", tuple(round(v, 3) for v in fwd))

co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
lo, hi = co.min(axis=0), co.max(axis=0)
k = HEIGHT / float(hi[2] - lo[2])
grow = Matrix.Scale(k, 4)
for o in objs:
    if o.parent is None:
        o.matrix_world = grow @ o.matrix_world
bpy.context.view_layer.update()
diag("scaled by", round(k, 3), "to", HEIGHT, "m")
hips = world_head(arm, "Hips")
co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
lo, hi = co.min(axis=0), co.max(axis=0)
H = float(hi[2] - lo[2])
L = float(hi[1] - lo[1])
diag("bind-pose box (m): height", round(H, 3), "length", round(L, 3), "width", round(float(hi[0] - lo[0]), 3),
     "floor", round(float(lo[2]), 3))
for b in arm.data.bones:
    p = world_head(arm, b.name) - hips
    diag("bone", b.name, "parent", b.parent.name if b.parent else None, "head rel hips / H",
         tuple(round(v / H, 2) for v in p), "deform", b.use_deform)

# ------------------------------------------------------------------ material
mat = mesh.data.materials[0] if mesh.data.materials else None
if MAPS:
    tex_objs = import_glb(MAPS)
    tex_mesh = [o for o in tex_objs if o.type == "MESH"][0]

    def uvset(o):
        uv = o.data.uv_layers.active.data
        arr = np.empty(len(uv) * 2)
        uv.foreach_get("uv", arr)
        return set(map(tuple, np.round(arr.reshape(-1, 2), 4)))

    a, b = uvset(mesh), uvset(tex_mesh)
    diag("uv match: rigged coords found in the textured draft", round(len(a & b) / max(len(a), 1), 4),
         "draft verts", len(tex_mesh.data.vertices))
    mat = tex_mesh.data.materials[0]
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)
    for o in tex_objs:
        bpy.data.objects.remove(o, do_unlink=True)
bsdf = [n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"][0] if mat and mat.use_nodes else None
if bsdf:
    for name in ("Emission Color", "Emission"):
        if name in bsdf.inputs:
            for link in list(bsdf.inputs[name].links):
                mat.node_tree.links.remove(link)
            bsdf.inputs[name].default_value = (0, 0, 0, 1)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 0.0
    used = {s.name: (n.image.name, tuple(n.image.size)) for s in bsdf.inputs if s.is_linked
            for l in s.links for n in [l.from_node] if n.type == "TEX_IMAGE" and n.image}
    normal = [n for n in mat.node_tree.nodes if n.type == "NORMAL_MAP"]
    diag("material", mat.name, "maps", used, "normal map node", bool(normal))
for img in bpy.data.images:
    if img.size[0] > TEX or img.size[1] > TEX:
        k = TEX / max(img.size)
        before = tuple(img.size)
        if not PROBE:
            img.scale(max(1, round(img.size[0] * k)), max(1, round(img.size[1] * k)))
        diag("map", img.name, before, "->", tuple(img.size))

# ------------------------------------------------------------------ the walk: channels per bone
chan = {}
for fc in all_fcurves(walk):
    if not fc.data_path.startswith('pose.bones["'):
        continue
    bone = fc.data_path.split('"')[1]
    prop = fc.data_path.rsplit(".", 1)[-1]
    chan.setdefault(bone, {}).setdefault(prop, {})[fc.array_index] = fc
f0, f1 = walk.frame_range
cycle = f1 - f0
diag("walk channels", len(chan), "bones;", "cycle", round(cycle / FPS, 3), "s")


def sample(bone, t):
    c = chan.get(bone, {})
    q = Quaternion([c["rotation_quaternion"][i].evaluate(t) if i in c.get("rotation_quaternion", {}) else (1, 0, 0, 0)[i]
                    for i in range(4)]).normalized()
    loc = Vector([c["location"][i].evaluate(t) if i in c.get("location", {}) else 0.0 for i in range(3)])
    sc = Vector([c["scale"][i].evaluate(t) if i in c.get("scale", {}) else 1.0 for i in range(3)])
    return q, loc, sc


# root motion: where the hips travel over one cycle (in the world, after the turn)
amw = arm.matrix_world
hb = arm.data.bones["Hips"]
hips_rest = hb.matrix_local.to_3x3()
locs = []
for i in range(int(cycle) + 1):
    _, loc, _ = sample("Hips", f0 + i)
    locs.append(np.array(amw.to_3x3() @ (hips_rest @ loc)))
locs = np.array(locs)
drift = locs[-1] - locs[0]
diag("hips over the walk (m): drift", tuple(round(float(v), 3) for v in drift), "range",
     tuple(round(float(v), 3) for v in locs.max(axis=0) - locs.min(axis=0)))

if PROBE:
    diag("probe only, nothing written")
    sys.exit(0)

walk.name = "Walk"
walk.use_fake_user = True

# ------------------------------------------------------------------ helpers to key a pose
RA = amw.to_quaternion()


def world_to_basis(name, q_world):
    """a rotation about the bone's head, given in world axes, as the bone's pose-space rotation"""
    rb = arm.data.bones[name].matrix_local.to_quaternion()
    return (rb.inverted() @ RA.inverted() @ q_world @ RA @ rb).normalized()


def world_vec_to_basis(name, v_world):
    rb = arm.data.bones[name].matrix_local.to_3x3()
    return rb.inverted() @ (amw.to_3x3().inverted() @ v_world)


def rot_x(deg):  # positive = nose down, tail up (the model faces -Y)
    return Quaternion((1, 0, 0), math.radians(deg))


def rot_z(deg):  # turns the head toward +X
    return Quaternion((0, 0, 1), math.radians(deg))


def new_action(name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    return act


def key(pb, frame, q=None, loc=None, sc=None):
    pb.rotation_mode = "QUATERNION"
    if q is not None:
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)
    if sc is not None:
        pb.scale = sc
        pb.keyframe_insert("scale", frame=frame)


LEGS = [b.name for b in arm.data.bones if "leg" in b.name]
# "tail" sits on the hips and carries the rump; the visible tail starts at "tailstart"
TAIL = [n for n in ("tailstart", "tail1", "tail2", "tail3") if n in arm.pose.bones]

# ------------------------------------------------------------------ Run: one walk cycle, faster and longer
samples = {b.name: [sample(b.name, f0 + i) for i in range(int(cycle) + 1)] for b in arm.data.bones}
mean = {}
for name, ss in samples.items():
    acc = Vector((0, 0, 0, 0))
    ref = ss[0][0]
    for q, _, _ in ss:
        acc += Vector(q) if q.dot(ref) >= 0 else -Vector(q)
    mean[name] = Quaternion(acc).normalized()
amp = {n: RUN_SWING for n in LEGS}
amp.update({"Hips": 1.2, "chest": 1.2, "head": 0.8})
R = max(2, round(cycle / RUN_SPEEDUP))
run = new_action("Run")
lift = world_vec_to_basis("Hips", Vector((0, 0, 1)))
for i in range(R + 1):
    t = f0 + cycle * i / R
    u = i / R
    for b in arm.data.bones:
        pb = arm.pose.bones[b.name]
        q, loc, sc = sample(b.name, t)
        k = amp.get(b.name, 1.0)
        if k != 1.0:
            m = mean[b.name]
            d = m.inverted() @ q
            if d.w < 0:
                d.negate()
            axis, ang = d.to_axis_angle()
            q = m @ Quaternion(axis, ang * k)
        if b.name == "chest":
            q = world_to_basis("chest", rot_x(4)) @ q
        if b.name == "head":
            q = world_to_basis("head", rot_x(-4)) @ q
        if TAIL and b.name == TAIL[0]:
            q = world_to_basis(b.name, rot_x(18)) @ q
        if b.name == "Hips":
            loc = loc + lift * (0.028 * H * math.cos(4 * math.pi * u))
        key(pb, 1 + i, q, loc, sc)
diag("run", R, "frames =", round(R / FPS, 3), "s; leg swing x", RUN_SWING, "bob 2.8% of the height, tail +18 deg")

# ------------------------------------------------------------------ Idle: the bind pose, breathing
idle = new_action("Idle")
N = IDLE_SECONDS * FPS
STEP = 3
for i in range(0, N + 1, STEP):
    s = i / FPS
    breath = math.sin(2 * math.pi * s / 3)
    look = math.sin(2 * math.pi * s / IDLE_SECONDS)
    nod = math.sin(2 * math.pi * s / 3 + 1.0)
    for b in arm.data.bones:
        pb = arm.pose.bones[b.name]
        q = Quaternion()
        loc = Vector((0, 0, 0))
        if b.name == "Hips":
            loc = lift * (0.004 * H * breath)
        elif b.name == "chest":  # the chest bone is the neck: it turns the head from the shoulders
            q = world_to_basis("chest", rot_z(6 * look) @ rot_x(1.2 * breath))
        elif b.name == "head":  # the head bone pivots mid-skull, so it only adds a little
            q = world_to_basis("head", rot_z(4 * look) @ rot_x(3 * nod))
        elif b.name in TAIL:
            j = TAIL.index(b.name)
            q = world_to_basis(b.name, rot_z(6 * math.sin(2 * math.pi * s / 2 - 0.5 * j)))
        key(pb, 1 + i, q, loc, Vector((1, 1, 1)))
diag("idle", N, "frames =", IDLE_SECONDS, "s; breath 3 s, look 6 s, tail 2 s")

# ------------------------------------------------------------------ how fast each gait carries the body
FEET = [n for n in ("frontleg2", "R_frontleg2", "backleg2", "R_backleg2") if n in arm.pose.bones]


def ground_speed(act):
    """metres per second at this size: how fast a planted foot slides back under the body"""
    arm.animation_data.action = act
    a0, a1 = (int(round(v)) for v in act.frame_range)
    speeds = []
    for foot in FEET:
        pts = []
        for f in range(a0, a1 + 1):
            scene.frame_set(f)
            pts.append(arm.matrix_world @ arm.pose.bones[foot].head)
        z = np.array([p.z for p in pts])
        y = np.array([p.y for p in pts])
        planted = z <= z.min() + 0.15 * (z.max() - z.min())
        v = [(y[i + 1] - y[i]) * FPS for i in range(len(y) - 1) if planted[i] and planted[i + 1]]
        if v:
            speeds.append(float(np.median(v)))
    arm.animation_data.action = None
    return speeds


for act in (walk, run):
    sp = ground_speed(act)
    if sp:
        act["groundSpeed"] = round(float(np.mean(sp)), 3)
    diag("ground speed", act.name, [round(v, 3) for v in sp], "mean", act.get("groundSpeed"), "m/s at", HEIGHT, "m")

# ------------------------------------------------------------------ export: each action on a track, one clip each
ad = arm.animation_data
ad.action = None
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)
for act in (idle, walk, run):
    tr = ad.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, "action_slot") and st.action_slot is None and len(getattr(act, "slots", [])):
        st.action_slot = act.slots[0]
rest_pose(arm)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
want = dict(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
            export_animation_mode="ACTIONS", export_extras=True, export_skins=True, export_image_format="JPEG",
            export_jpeg_quality=90, export_image_quality=90, export_yup=True, export_apply=False,
            export_force_sampling=True, export_optimize_animation_size=True, export_anim_slide_to_zero=True)
kw = {k: v for k, v in want.items() if k in props}
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(**kw)
diag("wrote", OUT, "options skipped", sorted(set(want) - set(kw)))
