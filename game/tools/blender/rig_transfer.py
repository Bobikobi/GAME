"""Give a static character the skeleton and clips of an already rigged one.

Run:  blender -b -P rig_transfer.py -- <rigged.glb> <static.glb> <out.glb> [--skirt]

The rigged file supplies the armature (Mixamo-style joint names) and its clips; its own mesh
is dropped. The static file supplies the mesh. Steps: fit the skeleton to the mesh (height
from the bone span, feet on the floor, centred), bind with Blender's automatic (bone heat)
weights, fill any vertex the solver left empty with smoothed nearest-bone weights, and with
--skirt re-weight a long robe below the hips as a blend of the two thighs and the hips so it
stretches between the legs instead of tearing. Exports one GLB with mesh, skin and clips.
Prints one DIAG line per fact.
"""
import sys
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
RIGGED, STATIC, OUT = argv[0], argv[1], argv[2]
SKIRT = "--skirt" in argv


def diag(*a):
    print("DIAG", *a, flush=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def world_points(o):
    mw = o.matrix_world
    co = np.array([v.co[:] for v in o.data.vertices], dtype=np.float64)
    return co @ np.array(mw.to_3x3()).T + np.array(mw.translation)


def bone_points(arm):
    amw = arm.matrix_world
    pts = []
    for b in arm.data.bones:
        pts.append(np.array(amw @ b.head_local))
        pts.append(np.array(amw @ b.tail_local))
    return np.array(pts)


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


def short(name):
    return name.split(":")[-1]


# fresh scene
bpy.ops.wm.read_factory_settings(use_empty=True)

rig_objs = import_glb(RIGGED)
arms = [o for o in rig_objs if o.type == "ARMATURE"]
assert len(arms) == 1, "expected one armature in the rigged file, got %d" % len(arms)
arm = arms[0]
for o in [o for o in rig_objs if o.type == "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)
ad = arm.animation_data
diag("bones", len(arm.data.bones), "actions", [a.name for a in bpy.data.actions],
     "nla tracks", [t.name for t in ad.nla_tracks] if ad else None)
if ad:
    ad.action = None
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
bp = bone_points(arm)
b_lo, b_hi = bp.min(axis=0), bp.max(axis=0)
diag("bone span z", round(float(b_lo[2]), 4), round(float(b_hi[2]), 4), "height", round(float(b_hi[2] - b_lo[2]), 4))

st_objs = import_glb(STATIC)
st_meshes = [o for o in st_objs if o.type == "MESH"]
for o in st_objs:
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
assert st_meshes, "no mesh in the static file"
bpy.ops.object.select_all(action="DESELECT")
for o in st_meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = st_meshes[0]
if len(st_meshes) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = "Character"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
sp = world_points(mesh)
s_lo, s_hi = sp.min(axis=0), sp.max(axis=0)
s_h = float(s_hi[2] - s_lo[2])
diag("static mesh height", round(s_h, 4), "verts", len(mesh.data.vertices),
     "tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons))

# fit the skeleton: span = height, feet on the floor, centred in x and y
s = s_h / float(b_hi[2] - b_lo[2])
old_scale = arm.scale.z
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
arm.scale = (arm.scale.x * s, arm.scale.y * s, arm.scale.z * s)
bpy.context.view_layer.update()
bp = bone_points(arm)
b_lo, b_hi = bp.min(axis=0), bp.max(axis=0)
delta = Vector(((s_lo[0] + s_hi[0]) / 2 - (b_lo[0] + b_hi[0]) / 2,
                (s_lo[1] + s_hi[1]) / 2 - (b_lo[1] + b_hi[1]) / 2,
                s_lo[2] - b_lo[2]))
arm.location = arm.location + delta
bpy.context.view_layer.update()
bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
total = old_scale * s
n = 0
for a in bpy.data.actions:
    for fc in all_fcurves(a):
        if fc.data_path.endswith(".location"):
            for kp in fc.keyframe_points:
                kp.co[1] *= total
                kp.handle_left[1] *= total
                kp.handle_right[1] *= total
            n += 1
diag("fit: scale", round(s, 4), "moved", tuple(round(x, 4) for x in delta), "location fcurves rescaled", n)

# nearest bone per vertex (end bones and fingers excluded), used by the fill and the skirt pass
co = world_points(mesh)
nv = len(mesh.data.vertices)
amw = arm.matrix_world
heads, tails, names = [], [], []
for b in arm.data.bones:
    if not b.use_deform or b.name.endswith("_End") or "Hand" in short(b.name)[4:]:
        continue
    heads.append(np.array(amw @ b.head_local))
    tails.append(np.array(amw @ b.tail_local))
    names.append(b.name)
# keep the hand bones themselves (the filter above drops only finger bones such as HandMiddle1)
H, T = np.array(heads), np.array(tails)
D = T - H
L2 = np.maximum((D * D).sum(axis=1), 1e-9)
t = ((co[:, None, :] - H[None, :, :]) * D[None, :, :]).sum(axis=2) / L2[None, :]
t = np.clip(t, 0.0, 1.0)
closest = H[None, :, :] + t[:, :, None] * D[None, :, :]
dist = np.linalg.norm(co[:, None, :] - closest, axis=2)
nearest = np.argmin(dist, axis=1)
ndist = dist[np.arange(nv), nearest]
diag("nearest-bone candidates", [short(x) for x in names])

# bind: automatic weights first
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
deform_names = set(b.name for b in arm.data.bones if b.use_deform)


def deform_total(v):
    return sum(g.weight for g in v.groups if mesh.vertex_groups[g.group].name in deform_names)


def set_weights(vi, pairs):
    v = mesh.data.vertices[vi]
    for g in list(v.groups):
        if mesh.vertex_groups[g.group].name in deform_names:
            mesh.vertex_groups[g.group].remove([vi])
    ssum = sum(x for _, x in pairs) or 1.0
    for nm, x in pairs:
        if x <= 0.0:
            continue
        vg = mesh.vertex_groups.get(nm) or mesh.vertex_groups.new(name=nm)
        vg.add([vi], x / ssum, "REPLACE")


tot = np.array([deform_total(v) for v in mesh.data.vertices])
empty = np.where(tot < 0.5)[0]
diag("auto weights: empty or weak", len(empty), "of", nv)
if len(empty):
    w = 1.0 / (dist + 0.02) ** 3
    order = np.argsort(dist, axis=1)
    mask = np.zeros_like(w, dtype=bool)
    mask[np.arange(nv)[:, None], order[:, :3]] = True
    w = np.where(mask, w, 0.0)
    w /= np.maximum(w.sum(axis=1, keepdims=True), 1e-12)
    e = np.array([[ed.vertices[0], ed.vertices[1]] for ed in mesh.data.edges], dtype=np.int64)
    deg = np.bincount(e.ravel(), minlength=nv).astype(np.float64)
    for _ in range(4):
        acc = np.zeros_like(w)
        np.add.at(acc, e[:, 0], w[e[:, 1]])
        np.add.at(acc, e[:, 1], w[e[:, 0]])
        w = 0.5 * w + 0.5 * acc / np.maximum(deg, 1.0)[:, None]
        w /= np.maximum(w.sum(axis=1, keepdims=True), 1e-12)
    top = np.argsort(-w, axis=1)[:, :4]
    for vi in empty:
        vi = int(vi)
        set_weights(vi, [(names[j], float(w[vi, j])) for j in top[vi] if w[vi, j] > 0.02])
    diag("filled with smoothed nearest-bone weights", len(empty))

if SKIRT:
    def bone_head_z(suffix):
        b = [b for b in arm.data.bones if short(b.name) == suffix][0]
        return float((amw @ b.head_local).z), float((amw @ b.head_local).x)

    hips_z, _ = bone_head_z("Hips")
    knee_z, _ = bone_head_z("LeftLeg")
    _, right_x = bone_head_z("RightUpLeg")
    right_sign = 1.0 if right_x > 0 else -1.0
    hips_name = [b.name for b in arm.data.bones if short(b.name) == "Hips"][0]
    lup = [b.name for b in arm.data.bones if short(b.name) == "LeftUpLeg"][0]
    rup = [b.name for b in arm.data.bones if short(b.name) == "RightUpLeg"][0]
    keep_near = {"LeftLeg", "RightLeg", "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"}
    upper = {"Spine", "Spine1", "Spine2", "Neck", "Head", "LeftShoulder", "RightShoulder", "LeftArm", "RightArm",
             "LeftForeArm", "RightForeArm", "LeftHand", "RightHand"}
    band = 0.12  # metres of lateral blend around the centre line
    changed = kept = 0
    for vi in range(nv):
        z, x = co[vi, 2], co[vi, 0]
        if z >= hips_z:
            continue
        nb = short(names[nearest[vi]])
        if nb in upper or (nb in keep_near and ndist[vi] < 0.10):
            kept += 1
            continue
        u = float(np.clip(0.5 + right_sign * x / (2 * band), 0.0, 1.0))  # 1 = fully the right thigh
        h = 0.15 + 0.45 * float(np.clip((z - knee_z) / max(hips_z - knee_z, 1e-6), 0.0, 1.0))
        set_weights(vi, [(hips_name, h), (lup, (1 - h) * (1 - u)), (rup, (1 - h) * u)])
        changed += 1
    diag("skirt pass: hips z", round(hips_z, 3), "knee z", round(knee_z, 3), "re-weighted", changed, "kept (legs, boots, arms)", kept)

counts = {}
for v in mesh.data.vertices:
    for g in v.groups:
        if g.weight > 0.3:
            nm = short(mesh.vertex_groups[g.group].name)
            counts[nm] = counts.get(nm, 0) + 1
diag("verts per bone (>0.3)", sorted(counts.items(), key=lambda x: -x[1])[:12])

mode = "NLA_TRACKS" if (arm.animation_data and len(arm.animation_data.nla_tracks)) else "ACTIONS"
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
                          export_animation_mode=mode, export_skins=True, export_image_format="AUTO",
                          export_yup=True, export_apply=False, export_force_sampling=True,
                          export_optimize_animation_size=True)
diag("wrote", OUT, "mode", mode)
