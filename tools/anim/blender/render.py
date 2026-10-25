"""tools/anim: the Blender half. Library samples -> (bone-mask layer) -> retarget -> (2-bone IK overlay) -> props -> ortho Cycles.

blender -b --factory-startup --offline-mode -P tools/anim/blender/render.py -- <job.json>   (pnpm anim render writes the job)

The Quaternius Universal Animation Libraries 1 and 2 share one 65-bone skeleton, so every action of both is played
on one source armature. A sample's source pose is the base action at its frame, with the bones of an optional mask
taken from a second action (local rotations, so a layered arm rides the base's spine). The target is the forager
(glb, Mixamo names) or a 19-bone body rig (.blend). Trunk, head and legs copy the source bone's world rotation
relative to its rest pose; arms and hands are aimed along the source's bone directions with the source's twist;
the hips travel by the leg-length ratio. An IK overlay moves one wrist along a curve through a few control points
(Catmull-Rom); only the two arm bones and the hand are solved, every other bone keeps the library pose. Nothing is
keyed by hand. Props are built here from boxes, cones and spheres: a hand prop, set pieces fixed on the ground by
the body (a herb, a berry bush) and worn parts on the hips (a pouch); an IK point may name a worn part. Each view is
rendered twice: lit (Cycles, flat albedo, one sun) and as a flat ID pass (blue body, red flame, green tool metal,
yellow leaves) that tells the snap which ramp a pixel may use. Writes <name>_<view>_<ii>.png, <name>_<view>_<ii>_id.png and <name>_meta.json (the projected feet).
"""
import bpy, sys, json, os, math, time
T0 = time.time()
import numpy as np
from mathutils import Vector, Matrix, Euler
from bpy_extras.object_utils import world_to_camera_view

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1]))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = cfg["out"]; os.makedirs(OUT, exist_ok=True)
FW, FH = cfg.get("frame", [64, 96]); SS = cfg.get("ss", 4); W, H = FW * SS, FH * SS
TARGET = cfg.get("target", "forager")
IS_RIG = TARGET.startswith("rig:")
ELEV = math.radians(cfg.get("elev", 30 if IS_RIG else 35)); PXM = cfg.get("pxm", 10.0 if IS_RIG else 53.0)
ANCHOR = tuple(cfg.get("anchor", [32, 84]))

if IS_RIG:
    bpy.ops.wm.open_mainfile(filepath=TARGET[4:])
    for o in list(bpy.data.objects):
        if o.type in ("CAMERA", "LIGHT"): bpy.data.objects.remove(o, do_unlink=True)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 0, 1000
sc.render.fps = int(cfg.get("fps", 24))

def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

# ------------------------------------------------------------------ target
RIG19 = {   # the 19-bone body rig: hips, spine, neck, head, upper_arm/forearm/hand per side, thigh/shin/foot per side
    "delta": {"hips": "pelvis", "spine": "spine_03", "neck": "neck_01", "head": "Head",
              "thigh.L": "thigh_l", "shin.L": "calf_l", "foot.L": "foot_l", "thigh.R": "thigh_r", "shin.R": "calf_r", "foot.R": "foot_r"},
    "delta_aim": {"spine": ["spine_01", "neck_01"]},
    "aim": {"upper_arm.L": ["upperarm_l", "lowerarm_l"], "forearm.L": ["lowerarm_l", "hand_l"], "hand.L": ["hand_l", "middle_01_l"],
            "upper_arm.R": ["upperarm_r", "lowerarm_r"], "forearm.R": ["lowerarm_r", "hand_r"], "hand.R": ["hand_r", "middle_01_r"]},
    "order": ["hips", "spine", "neck", "head", "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
              "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R"],
    "hips": "hips", "thigh": "thigh.L",
    "arm": {"R": ["upper_arm.R", "forearm.R", "hand.R"], "L": ["upper_arm.L", "forearm.L", "hand.L"]},
    "contacts": {"Left": "foot.L", "Right": "foot.R"},
}
ROOT = bpy.data.objects.new("Root", None); sc.collection.objects.link(ROOT)
if IS_RIG:
    tarm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    tarm.animation_data_clear()
    PROPS_RIG = ("axe", "pick", "rod", "torch", "lantern", "flint", "steel", "food", "trowel", "backpack", "crate")
    keep_props = tuple(cfg.get("rig_props", []))
    BODY = []
    for o in bpy.data.objects:
        if o.type != "MESH": continue
        if o.name.startswith(PROPS_RIG):
            if not o.name.startswith(keep_props) or not keep_props:
                o.hide_render = True; o.hide_viewport = True
            continue
        BODY.append(o)
    for o in bpy.data.objects:
        if o.type == "MESH" and o.parent is None and o not in BODY:
            o.hide_render = True
    P = ""
    MAP = RIG19
else:
    tobjs = imp(cfg["target_path"])
    tarm = next(o for o in tobjs if o.type == "ARMATURE")
    tmesh = next(o for o in tobjs if o.type == "MESH" and o.name.startswith("Character"))
    for o in tobjs:
        if o.type == "MESH" and o is not tmesh:
            bpy.data.objects.remove(o, do_unlink=True)
    tarm.animation_data_clear()
    BODY = [tmesh]
    P = "mixamorig:"
    MAP = {
        "delta": {"Hips": "pelvis", "Spine": "spine_01", "Spine1": "spine_02", "Spine2": "spine_03",
                  "Neck": "neck_01", "Head": "Head", "LeftShoulder": "clavicle_l", "RightShoulder": "clavicle_r",
                  "LeftUpLeg": "thigh_l", "LeftLeg": "calf_l", "LeftFoot": "foot_l", "LeftToeBase": "ball_l",
                  "RightUpLeg": "thigh_r", "RightLeg": "calf_r", "RightFoot": "foot_r", "RightToeBase": "ball_r"},
        "aim": {"LeftArm": ["upperarm_l", "lowerarm_l"], "LeftForeArm": ["lowerarm_l", "hand_l"],
                "LeftHand": ["hand_l", "middle_01_l"], "RightArm": ["upperarm_r", "lowerarm_r"],
                "RightForeArm": ["lowerarm_r", "hand_r"], "RightHand": ["hand_r", "middle_01_r"]},
        "order": ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
                  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
                  "RightShoulder", "RightArm", "RightForeArm", "RightHand",
                  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
                  "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"],
        "hips": "Hips", "thigh": "LeftUpLeg",
        "arm": {"R": ["RightArm", "RightForeArm", "RightHand"], "L": ["LeftArm", "LeftForeArm", "LeftHand"]},
        "contacts": {"Left": "LeftToeBase", "Right": "RightToeBase"},
    }
mw = tarm.matrix_world.copy(); tarm.parent = ROOT; tarm.matrix_world = mw
BASKET = None
if cfg.get("basket") and not IS_RIG:   # the repo's own basket (prop-basket.glb, made in Blender by props.py), on socket_back
    bobjs = imp(cfg["basket_path"])
    keep = [o for o in bobjs if o.name == "basket" or o.get("wearer") == cfg.get("wearer", "forager-m")]
    for o in bobjs:
        if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
    BASKET = next(o for o in keep if o.name == "basket")
    BACK_OFF = Vector(cfg.get("socket_back", [0.0, 0.181, 0.0]))   # socket_back: 18 cm behind the Spine2 joint (the glb node)

# ------------------------------------------------------------------ source: both libraries on one armature
sarm = None
for g in cfg["libs"]:
    objs = imp(g)
    a = next(o for o in objs if o.type == "ARMATURE")
    for o in objs:
        if o.type == "MESH": bpy.data.objects.remove(o, do_unlink=True)
    if sarm is None:
        sarm = a
    else:
        bpy.data.objects.remove(a, do_unlink=True)
for ac in bpy.data.actions: ac.use_fake_user = True
sarm.animation_data_create()
smix = sarm.copy(); smix.animation_data_clear(); sc.collection.objects.link(smix)

def act(name):
    a = bpy.data.actions.get(name)
    if a is None: raise SystemExit(f"no action {name}")
    return a

def eval_basis(action_name, fr):
    a = act(action_name)
    sarm.animation_data.action = a
    if hasattr(sarm.animation_data, "action_slot") and a.slots:
        sarm.animation_data.action_slot = a.slots[0]
    sc.frame_set(int(math.floor(fr)), subframe=fr - math.floor(fr))
    return {pb.name: pb.matrix_basis.copy() for pb in sarm.pose.bones}

MASKS = {
    "arm_r": ["clavicle_r", "upperarm_r", "lowerarm_r", "hand_r"],
    "arm_l": ["clavicle_l", "upperarm_l", "lowerarm_l", "hand_l"],
}
def mask_bones(spec):
    out = []
    for m in spec:
        if m in MASKS:
            out += MASKS[m]
            side = m[-1]
            out += [b.name for b in sarm.data.bones if b.name.endswith("_" + side) and b.name.split("_")[0] in ("index", "middle", "pinky", "ring", "thumb")]
        else:
            out.append(m)
    return out

def source_pose(sample, clip):
    base_a, base_f = sample["base"]
    B = eval_basis(base_a, base_f)
    lay = clip.get("layer")
    if lay:
        lf = sample.get("layer_f", lay.get("frame", 0))
        O = eval_basis(lay["action"], lf)
        for b in mask_bones(lay["mask"]):
            B[b] = O[b]
    for pb in smix.pose.bones:
        pb.matrix_basis = B[pb.name]
    bpy.context.view_layer.update()

# ------------------------------------------------------------------ materials: flat albedo, no specular, no normal map
def flatten(m):
    if not m or not m.use_nodes: return
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            for k, v in (("Metallic", 0.0), ("Roughness", 1.0), ("Specular IOR Level", 0.0)):
                if k in n.inputs:
                    for l in list(m.node_tree.links):
                        if l.to_socket == n.inputs[k]: m.node_tree.links.remove(l)
                    n.inputs[k].default_value = v
            for l in list(m.node_tree.links):
                if l.to_socket == n.inputs["Normal"]: m.node_tree.links.remove(l)
for m in bpy.data.materials: flatten(m)

def mat(name, rgb, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = 1
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1); b.inputs["Emission Strength"].default_value = emit
    return m
def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

if IS_RIG:   # the rig's parts carry flat guide colours; give each body part a cloth / skin albedo instead
    RIGCOL = cfg.get("rig_colours", {})
    cache = {}
    for o in BODY:
        key = next((k for k in RIGCOL if o.name.split(".")[0] == k), None)
        if key is None: continue
        h = RIGCOL[key]
        if h not in cache: cache[h] = mat("rig_" + h, srgb(h))
        o.data.materials.clear(); o.data.materials.append(cache[h])
        o.active_material = cache[h]
        for p in o.material_slots: p.link = "OBJECT"; p.material = cache[h]

# ------------------------------------------------------------------ retarget
def rest_rot(arm, name): return (arm.matrix_world @ arm.data.bones[name].matrix_local).to_3x3().normalized()
def rest_head(arm, name): return arm.matrix_world @ arm.data.bones[name].head_local
def pose_rot(arm, name): return (arm.matrix_world @ arm.pose.bones[name].matrix).to_3x3().normalized()
def pose_head(arm, name): return arm.matrix_world @ arm.pose.bones[name].head
def pose_tail(arm, name): return arm.matrix_world @ arm.pose.bones[name].tail

s_rest = {b: rest_rot(smix, b) for b in smix.data.bones.keys()}
t_rest = {b: rest_rot(tarm, b) for b in tarm.data.bones.keys()}
HIPS = P + MAP["hips"]
t_hip_rest = rest_head(tarm, HIPS)
s_hip_rest = rest_head(smix, "pelvis")
SCALE_V = rest_head(tarm, P + MAP["thigh"]).z / rest_head(smix, "thigh_l").z
SCALE_H = SCALE_V / cfg.get("kz", 1.0)
TWIST_K = cfg.get("twist", 1.0)

def set_world(pb, rot3, head_world):
    pb.matrix = tarm.matrix_world.inverted() @ (Matrix.Translation(head_world) @ rot3.to_4x4())
    bpy.context.view_layer.update()

def aim_bone(pb, want, extra=None):
    head = tarm.matrix_world @ pb.head
    cur = ((tarm.matrix_world @ pb.tail) - head).normalized()
    R = cur.rotation_difference(want.normalized()).to_matrix() @ pose_rot(tarm, pb.name)
    if extra is not None: R = R @ extra
    set_world(pb, R, head)

def twist_of(sb):
    qs = (s_rest[sb].inverted() @ pose_rot(smix, sb)).to_quaternion()
    ang = 2 * math.atan2(qs.y, qs.w)
    return (ang + math.pi) % (2 * math.pi) - math.pi

def retarget():
    for pb in tarm.pose.bones:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    for tb in MAP["order"]:
        full = P + tb; pb = tarm.pose.bones[full]
        if tb in MAP["delta"]:
            sb = MAP["delta"][tb]
            R = (pose_rot(smix, sb) @ s_rest[sb].inverted()) @ t_rest[full]
            if tb == MAP["hips"]:
                d = pose_head(smix, "pelvis") - s_hip_rest
                head = t_hip_rest + Vector((d.x * SCALE_H, d.y * SCALE_H, d.z * SCALE_V))
            else:
                head = tarm.matrix_world @ pb.head
            set_world(pb, R, head)
            if tb in MAP.get("delta_aim", {}):   # a long target bone standing for several source bones: aim it too
                a, b = MAP["delta_aim"][tb]
                aim_bone(pb, pose_head(smix, b) - pose_head(smix, a))
        else:
            a, b = MAP["aim"][tb]
            want = (pose_head(smix, b) - pose_head(smix, a)).normalized()
            aim_bone(pb, want, Matrix.Rotation(twist_of(a) * TWIST_K, 3, "Y"))

# ------------------------------------------------------------------ IK overlay (2 bones, analytic, in the body frame)
def body_vec(v, side):   # body axes: x outward on the tool side, y forward (the body faces -Y), z up
    return Vector(((-v[0] if side == "R" else v[0]), -v[1], v[2]))

def catmull(points, t):
    n = len(points) - 1
    t = min(max(t, 0.0), 1.0) * n
    i = min(int(t), n - 1); u = t - i
    p0 = points[max(i - 1, 0)]; p1 = points[i]; p2 = points[i + 1]; p3 = points[min(i + 2, n)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)

FLOOR0 = [None]
def ik_overlay(ik, t):
    side = ik.get("side", "R")
    up, fore, hand = (tarm.pose.bones[P + n] for n in MAP["arm"][side])
    S = tarm.matrix_world @ up.head
    a = (tarm.matrix_world @ up.tail - S).length
    b = ((tarm.matrix_world @ fore.tail) - (tarm.matrix_world @ fore.head)).length
    def point(p):
        if isinstance(p, str):   # a worn part (anchor body): the hand goes to its top
            W = WORN[p][0].matrix_world.translation
            return Vector(body_vec((W.x / SCALE_H, W.y / SCALE_H, (W.z - FLOOR0[0]) / SCALE_V + 0.07), side))
        return Vector(p)
    pts = [point(p) for p in ik["points"]]
    off = body_vec(catmull(pts, t), side)
    if ik.get("anchor", "shoulder") == "shoulder":
        T = S + off * SCALE_H
    elif ik["anchor"] == "body":   # a fixed spot by the body, from the floor under it: a plant, a pouch
        T = Vector((off.x * SCALE_H, off.y * SCALE_H, FLOOR0[0] + off.z * SCALE_V))
    else:   # the library's own wrist at this sample, moved by the curve
        T = (tarm.matrix_world @ hand.head) + off * SCALE_H
    if "floor" in ik and FLOOR0[0] is not None:   # keep the wrist above the ground (the lowest body point before the IK)
        T.z = max(T.z, FLOOR0[0] + ik["floor"] * SCALE_V)
    d = max(min((T - S).length, a + b - 1e-4), abs(a - b) + 1e-4)
    u = (T - S).normalized(); T = S + u * d
    pole = body_vec(ik.get("pole", [0.4, -0.3, -1.0]), side).normalized()
    v = (pole - u * pole.dot(u)).normalized()
    x = (a * a - b * b + d * d) / (2 * d); y = math.sqrt(max(a * a - x * x, 0.0))
    E = S + u * x + v * y
    aim_bone(up, E - S)
    aim_bone(fore, T - (tarm.matrix_world @ fore.head))
    hd = ik.get("hand_dir")
    if hd == "tangent":
        tan = body_vec(catmull(pts, min(t + 0.02, 1)) - catmull(pts, max(t - 0.02, 0)), side)
        aim_bone(hand, tan if tan.length > 1e-6 else (T - E))
    elif hd:
        aim_bone(hand, body_vec(hd, side))
    else:
        aim_bone(hand, T - E)
    return {"S": S, "E": E, "T": T, "tan": body_vec(catmull(pts, min(t + 0.02, 1)) - catmull(pts, max(t - 0.02, 0)), side)}

# ------------------------------------------------------------------ props (made here from boxes and a cone; no outside asset)
PROP = None; PARTS = {}
CLASS_OF = {}   # object name -> snap class (body / fire / cool), drawn by the ID pass
pc = cfg.get("prop")
LEAF, LEAF_LIGHT, BERRY = (0.16, 0.40, 0.10), (0.40, 0.68, 0.20), (0.80, 0.08, 0.10)
def part(name, dim, rgb, emit=0.0, loc=(0, 0, 0), cone=False, cls="body", parent=None, sphere=False, rot=(0, 0, 0), flat=1.0):
    if cone:
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=dim[0], radius2=0, depth=dim[2])
    elif sphere:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
    o = bpy.context.active_object; o.name = name
    if not cone:
        o.dimensions = dim
    elif flat != 1.0:   # a leaf: a cone pressed flat
        o.scale = (1.0, flat, 1.0)
    o.rotation_euler = rot
    o.location = loc
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(mat(name, rgb, emit)); o.parent = PROP if parent is None else parent
    CLASS_OF[o.name] = cls
    return o
if pc:
    PROP = bpy.data.objects.new("Prop", None); sc.collection.objects.link(PROP)
    k = SCALE_H   # props are sized in metres of the library body
    if pc == "hatchet":     # local Z = the haft, from the fist outwards; local Y = the blade's side
        L = 0.55 * k
        part("haft", (0.04 * k, 0.04 * k, L), (0.30, 0.16, 0.07), loc=(0, 0, L / 2 - 0.10 * k))
        part("head", (0.03 * k, 0.16 * k, 0.10 * k), (0.33, 0.37, 0.52), loc=(0, 0.05 * k, L - 0.15 * k), cls="cool")
    elif pc == "pick":
        L = 0.62 * k
        part("haft", (0.04 * k, 0.04 * k, L), (0.30, 0.16, 0.07), loc=(0, 0, L / 2 - 0.10 * k))
        part("head", (0.035 * k, 0.40 * k, 0.045 * k), (0.33, 0.37, 0.52), loc=(0, 0.0, L - 0.14 * k), cls="cool")
    elif pc == "torch":     # local Z = up the haft to the flame
        L = 0.42 * k
        part("haft", (0.035 * k, 0.035 * k, L), (0.22, 0.11, 0.05), loc=(0, 0, L / 2 - 0.08 * k))
        part("wrap", (0.06 * k, 0.06 * k, 0.07 * k), (0.42, 0.24, 0.10), loc=(0, 0, L - 0.08 * k))
        part("flame", (0.07 * k, 0, 0.20 * k), (1.0, 0.55, 0.05), emit=cfg.get("flame_emit", 1.2), loc=(0, 0, L + 0.03 * k), cone=True, cls="fire")
    elif pc == "trowel":    # local Z = the blade's point
        part("grip", (0.03 * k, 0.03 * k, 0.11 * k), (0.30, 0.16, 0.07), loc=(0, 0, 0.0))
        part("blade", (0.075 * k, 0.012 * k, 0.13 * k), (0.33, 0.37, 0.52), loc=(0, 0, 0.12 * k), cls="cool")
    elif pc == "crate":     # held between the hands
        d = cfg.get("crate_dim", [0.30, 0.40, 0.26])
        part("crate", (d[0] * k, d[1] * k, d[2] * k), (0.40, 0.22, 0.09))
    elif pc == "seedbag":
        part("bag", (0.10 * k, 0.08 * k, 0.12 * k), (0.55, 0.40, 0.22))
    elif pc == "sprig":     # a picked sprig: two leaves in a V out of the fist
        for q, a in enumerate((-0.45, 0.45)):
            h = 0.26 * k
            part(f"sprig{q}", (0.07 * k, 0, h), LEAF_LIGHT, loc=(math.sin(a) * h / 2, 0, 0.02 * k + math.cos(a) * h / 2), cone=True, cls="leaf", rot=(0, a, 0), flat=0.35)
    elif pc == "berries":   # a small handful
        for q, (bx, by, bz) in enumerate(((0, 0, 0.05), (0.05, 0.02, 0.03), (-0.04, 0.03, 0.04), (0.01, -0.04, 0.08))):
            part(f"berries{q}", (0.065 * k,) * 3, BERRY, loc=(bx * k, by * k, bz * k), sphere=True)

# ------------------------------------------------------------------ set pieces (fixed on the ground by the body) and worn parts (on the hips)
SIDE = (cfg.get("ik") or {}).get("side", cfg.get("prop_side", "R"))
SETP = None
if cfg.get("set"):
    SETP = bpy.data.objects.new("Set", None); sc.collection.objects.link(SETP)
    for j, sp in enumerate(cfg["set"]):
        s_ = sp.get("size", 1.0) * SCALE_H
        c = body_vec((sp["at"][0], sp["at"][1], 0.0), sp.get("side", SIDE)); c = Vector((c.x * SCALE_H, c.y * SCALE_H, 0.0))
        if sp["kind"] == "herb":     # a leafy tuft, about 0.32 m tall: a dark heart and seven leaves fanned out
            part(f"herb{j}c", (0.06 * s_, 0, 0.24 * s_), LEAF, loc=c + Vector((0, 0, 0.12 * s_)), cone=True, cls="leaf", parent=SETP)
            for q in range(7):
                az = math.radians(q * 360 / 7 + 10); tilt = math.radians(28 + 14 * (q % 3)); h = (0.30 + 0.05 * (q % 2)) * s_
                top = Vector((math.sin(tilt) * math.sin(az), -math.sin(tilt) * math.cos(az), math.cos(tilt)))
                part(f"herb{j}_{q}", (0.075 * s_, 0, h), LEAF_LIGHT if q % 2 else LEAF, loc=c + top * (h / 2), cone=True, cls="leaf", parent=SETP, rot=(tilt, 0, az), flat=0.3)
        elif sp["kind"] == "bush":   # a lumpy berry bush, about 0.8 m tall, red berries on its face
            r = 0.45 * s_
            part(f"bush{j}", (2 * r, 2 * r, 1.6 * r), LEAF, loc=c + Vector((0, 0, 0.8 * r)), sphere=True, cls="leaf", parent=SETP)
            for q, a in enumerate((30, 100, 170, 240, 310)):
                lx, ly = 0.55 * r * math.cos(math.radians(a)), 0.55 * r * math.sin(math.radians(a))
                part(f"bush{j}_{q}", (1.0 * r, 1.0 * r, 0.9 * r), LEAF_LIGHT if q % 2 == 0 else LEAF, loc=c + Vector((lx, ly, (1.05 + 0.15 * (q % 2)) * r)), sphere=True, cls="leaf", parent=SETP)
            for q in range(12):
                a = math.radians(q * 30 + 15); zq = (0.75 + 0.35 * ((q * 7) % 3) / 2) * r
                rq = 1.0 * r * math.sqrt(max(0.0, 1 - ((zq - 0.8 * r) / (0.95 * r)) ** 2)) + 0.03 * s_
                part(f"berry{j}_{q}", (0.11 * s_,) * 3, BERRY, loc=c + Vector((rq * math.cos(a), rq * math.sin(a), zq)), sphere=True, parent=SETP)
WORN = {}
for j, wp in enumerate(cfg.get("worn", [])):
    e = bpy.data.objects.new(f"Worn{j}", None); sc.collection.objects.link(e)
    if wp["kind"] == "pouch":     # a leather pouch with its flap
        part(f"pouch{j}", (0.13 * SCALE_H, 0.08 * SCALE_H, 0.14 * SCALE_H), (0.66, 0.50, 0.30), parent=e)
        part(f"pouchflap{j}", (0.135 * SCALE_H, 0.085 * SCALE_H, 0.04 * SCALE_H), (0.36, 0.20, 0.08), loc=(0, 0, 0.07 * SCALE_H), parent=e)
    WORN[wp["kind"]] = (e, wp)

def place_worn():
    nm = P + MAP["hips"]
    Rd = pose_rot(tarm, nm) @ t_rest[nm].inverted()
    for e, wp in WORN.values():
        o = body_vec(wp["at"], wp.get("side", SIDE)); o = Vector((o.x * SCALE_H, o.y * SCALE_H, o.z * SCALE_V))
        e.parent = None
        e.matrix_world = Matrix.Translation(pose_head(tarm, nm) + Rd @ o) @ Rd.to_4x4()
    bpy.context.view_layer.update()

def src_grip(side):
    s = side.lower()
    g = pose_head(smix, f"index_01_{s}") - pose_head(smix, f"pinky_01_{s}")
    f = pose_head(smix, f"middle_01_{s}") - pose_head(smix, f"hand_{s}")
    return g.normalized(), f.normalized()

def frame_from(z, y):
    z = z.normalized(); y = (y - z * y.dot(z)).normalized(); x = y.cross(z)
    M = Matrix((x, y, z)).transposed(); return M

def place_basket():
    if BASKET is None: return
    nm = P + "Spine2"
    Rd = pose_rot(tarm, nm) @ t_rest[nm].inverted()
    BASKET.matrix_world = Matrix.Translation(pose_head(tarm, nm) + Rd @ BACK_OFF) @ Rd.to_4x4()

def place_prop(ikinfo):
    if PROP is None: return
    side = cfg.get("prop_side", "R")
    hand = tarm.pose.bones[P + MAP["arm"][side][2]]
    hh = tarm.matrix_world @ hand.head; ht = tarm.matrix_world @ hand.tail
    palm = hh + (ht - hh) * cfg.get("palm_along", 0.55)
    if pc == "crate":
        o = tarm.pose.bones[P + MAP["arm"]["L" if side == "R" else "R"][2]]
        oh = tarm.matrix_world @ o.head; ot = tarm.matrix_world @ o.tail
        mid = (palm + (oh + (ot - oh) * cfg.get("palm_along", 0.55))) / 2
        across = (palm - oh); fwd = Vector((0, -1, 0))
        PROP.matrix_world = Matrix.Translation(mid + Vector(cfg.get("crate_off", [0, 0, 0])) * SCALE_H) @ frame_from(Vector((0, 0, 1)), across).to_4x4()
        return
    if ikinfo is not None and cfg.get("prop_from") == "ik":
        haft = (ikinfo["T"] - ikinfo["S"]) if cfg.get("haft_from", "radial") == "radial" else (ikinfo["T"] - ikinfo["E"])
        if cfg.get("haft_sign", 1) < 0: haft = -haft
        blade = ikinfo["tan"] if ikinfo["tan"].length > 1e-6 else Vector((0, -1, 0))
        R = frame_from(haft, blade)
    else:
        g, f = src_grip(side)
        z = g if cfg.get("grip_sign", 1) > 0 else -g
        R = frame_from(z, f)
    extra = Matrix.Rotation(math.radians(cfg.get("prop_rx", 0)), 3, "X")
    PROP.matrix_world = Matrix.Translation(palm) @ (R @ extra).to_4x4()

def body_min_z():
    dg = bpy.context.evaluated_depsgraph_get(); zs = []
    for o in BODY:
        if o.hide_render: continue
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        m = np.array(ev.matrix_world); zs.append(float((co @ m[:3, :3].T + m[:3, 3])[:, 2].min()))
        ev.to_mesh_clear()
    return min(zs)

# ------------------------------------------------------------------ scene
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); sc.collection.objects.link(cam); sc.camera = cam
cd = cam.data; cd.type = "ORTHO"; cd.sensor_fit = "VERTICAL"; cd.ortho_scale = FH / PXM
R = 60.0
cam.location = Vector((0, -R * math.cos(ELEV), R * math.sin(ELEV)))
cam.rotation_euler = Euler((math.pi / 2 - ELEV, 0, 0))
cd.shift_x = (FW / 2 - ANCHOR[0]) / FH; cd.shift_y = (ANCHOR[1] - FH / 2) / FH
cd.clip_start = 0.1; cd.clip_end = 300
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = cfg.get("sun", 3.2); sun.data.angle = 0.0
Ld = Vector((0.45, 0.55, -0.70)).normalized()
wd = bpy.data.worlds.new("W"); wd.use_nodes = True; sc.world = wd
bg = wd.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.62, 0.66, 1); bg.inputs[1].default_value = cfg.get("amb", 0.55)
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = int(cfg.get("cycles_samples", 12))
sc.cycles.use_denoising = False; sc.cycles.filter_width = 0.01
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.render.threads = int(cfg.get("threads", 4))
if PROP is not None: PROP.parent = None

IDCOL = {"body": (0.0, 0.0, 1.0, 1.0), "fire": (1.0, 0.0, 0.0, 1.0), "cool": (0.0, 1.0, 0.0, 1.0), "leaf": (1.0, 1.0, 0.0, 1.0)}
IDMAT = {}
def idmat(c):
    if c not in IDMAT:
        m = bpy.data.materials.new("id_" + c); m.use_nodes = True; nt = m.node_tree
        for n in list(nt.nodes): nt.nodes.remove(n)
        e = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
        e.inputs["Color"].default_value = IDCOL[c]; e.inputs["Strength"].default_value = 1.0
        nt.links.new(e.outputs[0], o.inputs["Surface"]); IDMAT[c] = m
    return IDMAT[c]
def render_id(path):
    """The same view once more with flat emission colours per snap class: blue body, red flame, green tool metal, yellow leaves."""
    saved = []
    for o in sc.objects:
        if o.type != "MESH" or o.hide_render: continue
        m = idmat(CLASS_OF.get(o.name, "body"))
        if not o.material_slots:
            o.data.materials.append(m); saved.append((o, None)); continue
        saved.append((o, [(s.link, s.material) for s in o.material_slots]))
        for s in o.material_slots:
            s.link = "OBJECT"; s.material = m
    ns = sc.cycles.samples; sc.cycles.samples = 1
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    sc.cycles.samples = ns
    for o, st in saved:
        if st is None: o.data.materials.pop(); continue
        for s, (lk, m) in zip(o.material_slots, st):
            s.link = lk; s.material = m

def ground_z():
    if not cfg.get("ground_from_feet"): return body_min_z()
    return min((tarm.matrix_world @ tarm.pose.bones[P + n].head).z for n in MAP["contacts"].values())
def feet_now():
    feet = {}
    for foot, nm in MAP["contacts"].items():
        pb = tarm.pose.bones[P + nm]
        wp = tarm.matrix_world @ (pb.tail if IS_RIG else pb.head)
        feet[foot] = {"world": [round(c, 4) for c in wp], "px": to_px(wp)}
    return feet

DIRS = {k: v for k, v in {"down": 0.0, "up": math.pi, "left": math.pi / 2}.items() if k in cfg.get("dirs", ["down", "up", "left"])}
def to_px(world):
    v = world_to_camera_view(sc, cam, world)
    return [round(v.x * FW, 2), round((1 - v.y) * FH, 2)]

clip = cfg
samples = cfg["samples"]
meta = {"frame": [FW, FH], "anchor": list(ANCHOR), "pxm": PXM, "elev_deg": math.degrees(ELEV), "name": cfg["name"],
        "target": TARGET, "scale_v": SCALE_V, "scale_h": SCALE_H, "samples": samples, "poses": []}
for i, s in enumerate(samples):
    ROOT.rotation_euler = (0, 0, 0); ROOT.location = (0, 0, 0)
    if PROP is not None: PROP.parent = None
    if BASKET is not None: BASKET.parent = None
    bpy.context.view_layer.update()
    if SETP is not None: SETP.parent = None
    source_pose(s, clip)
    retarget()
    place_worn()
    info = None
    ikc = cfg.get("ik") or {}
    FLOOR0[0] = body_min_z() if (ikc.get("floor") is not None or ikc.get("anchor") == "body") else None
    if cfg.get("ik"):
        info = ik_overlay(cfg["ik"], s.get("t", 0.0))
    place_prop(info)
    if PROP is not None and cfg.get("prop_poses") is not None:   # the hand prop only on these poses (a picked sprig)
        for ch in PROP.children: ch.hide_render = i not in cfg["prop_poses"]
    place_basket()
    for ob in (PROP, BASKET, *[e for e, _ in WORN.values()]):   # ride with the body through the ground shift and the view turn
        if ob is None: continue
        mwp = ob.matrix_world.copy(); ob.parent = ROOT; ob.matrix_world = mwp
    bpy.context.view_layer.update()
    z = body_min_z() if not cfg.get("ground_from_feet") else min((tarm.matrix_world @ tarm.pose.bones[P + n].head).z for n in MAP["contacts"].values())
    ROOT.location = (0, 0, -z + cfg.get("ground_lift", 0.0)); bpy.context.view_layer.update()
    if SETP is not None:   # on the floor under the body, turning with it
        SETP.parent = ROOT; SETP.matrix_world = Matrix.Identity(4); bpy.context.view_layer.update()
    rec = {"sample": s, "ground_shift": -z}
    for d, ang in DIRS.items():
        ROOT.rotation_euler = (0, 0, ang)
        Ld2 = Vector((-Ld.x, Ld.y, Ld.z)) if d == "left" else Ld
        sun.rotation_euler = Vector((0, 0, -1)).rotation_difference(Ld2).to_euler()
        bpy.context.view_layer.update()
        feet = {}
        for foot, nm in MAP["contacts"].items():
            pb = tarm.pose.bones[P + nm]
            wp = tarm.matrix_world @ (pb.tail if IS_RIG else pb.head)
            feet[foot] = {"world": [round(c, 4) for c in wp], "px": to_px(wp)}
        sc.render.filepath = os.path.join(OUT, f"{cfg['name']}_{d}_{i:02d}.png")
        if cfg.get("render", True):
            bpy.ops.render.render(write_still=True)
            if cfg.get("id_pass", True): render_id(os.path.join(OUT, f"{cfg['name']}_{d}_{i:02d}_id.png"))
        rec[d] = feet
    meta["poses"].append(rec)
dn = cfg.get("dense")
if dn:   # the feet at every source frame (no render): the travel fit needs more than the drawn poses of a run or a sprint
    base_a = samples[0]["base"][0]; f = 0.0; dense = []
    while f < dn["length"] - 1e-6:
        ROOT.rotation_euler = (0, 0, 0); ROOT.location = (0, 0, 0)
        if PROP is not None: PROP.parent = None
        if BASKET is not None: BASKET.parent = None
        bpy.context.view_layer.update()
        source_pose({"base": [base_a, f]}, {}); retarget(); bpy.context.view_layer.update()
        ROOT.location = (0, 0, -ground_z() + cfg.get("ground_lift", 0.0)); bpy.context.view_layer.update()
        rec = {"f": round(f, 3)}
        for d, ang in DIRS.items():
            ROOT.rotation_euler = (0, 0, ang); bpy.context.view_layer.update()
            rec[d] = feet_now()
        dense.append(rec); f += dn.get("step", 1.0)
    meta["dense"] = dense; meta["dense_step"] = dn.get("step", 1.0)
meta["blender_s"] = round(time.time() - T0, 1)
json.dump(meta, open(os.path.join(OUT, f"{cfg['name']}_meta.json"), "w"), indent=1)
print("DONE", cfg["name"], len(samples), meta["blender_s"])
