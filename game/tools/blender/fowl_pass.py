"""Make a game-ready ground fowl from the CC0 "Chicken (animated)" by CDmir (OpenGameArt, chickenV2.blend, Blender 2.74).

Run:  blender -b --factory-startup --disable-autoexec -P fowl_pass.py -- <chickenV2.blend> <out.glb> [--height 0.35] [--tex 1024]

The file is opened with its scripts off (`--disable-autoexec`, and `use_scripts=False` here as well), so nothing it
carries ever runs.

What it does, in the manner of quad_pass.py (the wolf) and the other animal passes:
- keeps the armature and joins the body and eye meshes into one skinned mesh (the clip renderer draws one mesh, the
  one with the most vertices); drops the camera, the lamps and the 'Cylinder' helper (no vertex groups, so it cannot
  follow the rig, and on a hidden layer of the file: not a visible part), and every UV layer but the one the colour
  map is painted on,
- rebuilds the Blender Internal materials as a Principled BSDF on the packed colour map (UV-Texture.png, re-encoded as
  JPEG at quality 90 at export) and gives the eyes a plain dark material; the packed normal map (ChickenNorm.png) is
  not used: at 128 px it would only add noise,
- centres the body over the origin and scales it to --height metres standing (bind pose; it already faces -Y), the
  scale baked into the bones and the mesh at the end; adds a sole bone under each foot with a tip bone below it (the
  renderer reads a foot from its contact bone's tail, and glTF loses a leaf bone's length),
- adds two wing bones, Wing_L and Wing_R, parented to the backbone at the shoulder and lying along the top edge of
  the folded wing (the hinge it opens on), and weights the wing region of the body to them: the vertices of the
  folded wing only (an ellipse on the side of the body, the side-facing surface), full weight inside and a smooth
  edge into the bones that carried them. The file has no wing bones; the lift and the flutter need them. A weighted
  patch opens as a flare, not a feathered wing: it reads at tile size, the texture stretches between it and the body,
- makes eight actions with the rig's leg and head IK (six keyed from the file's standing pose 'Stand', two from its
  own actions), then bakes each to plain bone keys and drops the IK targets and every constraint before export:
  Idle    from the standing pose: a breath, a head turn, a head bob and a tail flick, four poses that differ.
  Walk    keyed here on the leg IK targets: alternate steps with a low swing, the body level and the head carried
          low with a bob each step. The file's Walk steps nearly in place (it is measured below); the kernel's walk
          (190 ms a tile, HUNTING.md section 2) needs about 0.9 m of ground a cycle for four poses to hold a planted
          foot, so the stride is that long and each foot is down for a short share of it (the clip is rendered with
          one floor a cycle, `locomotion.airborne`).
  Run     the same keying, longer and faster: the body leaned forward and low, the neck out, a longer stride with a
          higher swing and a bob, the wings held a little out (about 1.8 m a cycle for the run of 95 ms a tile).
  Alert   from the standing pose: the neck stretched up tall with the head up, then a head turn and a tail flick.
  Graze   pecking, from the file's Pecking1, Pecking2 and EndPecking: tipped forward with the beak on the ground, the
          head a little up, a second peck, then the head part way up. The beak is held just above the floor the
          feet stand on (the renderer stands a pose on its lowest point).
  Lie     the last pose of the file's Dying, on its side, the wings closed and the legs drawn in, turned to lie along
          its standing line and moved back to where the body stood, held still: no fall is played and nothing
          twitches; the client fades it.
  Lift    the burst: stand, crouch, spring as the wings open, the wings at the top of the stroke with the legs
          stretched below (the renderer grounds every pose, so the rise is in the pose).
  Fly     the short low flight of a ground fowl (BESTIARY: it runs, then flutters up): the wings beating, the body
          level, the legs tucked.
- caps the colour map at --tex pixels and exports one GLB with the eight clips on NLA tracks.
Prints one DIAG line per fact.

Nothing belongs to the hen alone in the bones or the weights: the comb and the wattles are the file's own loose
shells and its colour map, so the same body can carry other ramps.
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]


def opt(name, default, kind=str):
    return kind(argv[argv.index(name) + 1]) if name in argv else default


HEIGHT = opt("--height", 0.35, float)
TEX = opt("--tex", 1024, int)
FPS = 24

# All lengths below are in the file's units (the bird stands about 12.65 units high, so a unit is about 2.8 mm at
# 0.35 m), in the armature's own axes: the bird faces -Y, +X is its left, +Z up.
LEGS = {"L": ("IK-Leg_L", "Leg_L.001", ["Finger1_L", "Finger2_L", "Finger3_L", "Finger4_L"], 0.0),
        "R": ("IK-Leg_R", "Leg_R.001", ["Finger1_R", "Finger2_R", "Finger3_R", "Finger4_R"], 0.5)}   # (ankle target, hip bone, toes, phase of mid-stance)
IK_BONES = ["IK-Leg_L", "IK-Leg_R", "IK-Knee_L", "IK-Knee_R", "IK-Head"]
SOLES = {"L": "Foot_L", "R": "Foot_R"}    # the contact bones (a sole under the middle toe), each with a tip bone below

# the wings: an ellipse on the side of the body in the side view (y, z), the folded wing's dark feathers on the colour
# map, from the shoulder below the neck back and down to the primaries' tips above the thigh
WING_CENTRE = (0.9, 6.6)
WING_AXES = (3.5, 1.9)                 # half-length along the wing, half-width across it
WING_ANGLE = math.radians(-16.5)        # the folded wing runs back and down
WING_CORE = 0.6                         # full weight inside this share of the ellipse, a smooth edge out to its rim
WING_SIDE = (0.0, 0.3)                 # the side-facing surface only (the normal's outward x, smoothed between these)
WING_HEAD = (2.3, -1.8, 8.4)            # the shoulder (x for the left wing), at the top of the folded wing
WING_TAIL = (2.9, 3.9, 6.9)             # along its top edge to the tip: the hinge the wing opens on

# the walk (one cycle of WALK_FRAMES, four poses at 0, 8, 16, 24): each foot down for WALK_DUTY of the cycle, carried
# back WALK_STANCE units under the body; the ground a cycle covers is WALK_STANCE / WALK_DUTY units (about 0.92 m:
# four poses at the kernel's walk of 190 ms a tile stay under 30 poses a second with a cycle of at least 45 px seen
# from above, ANIMATION 5.1). The bird's leg reaches about 3 units fore and aft of the hip, so the stance is short
# and the swing low and quick; the body level and the head low tell it from the run.
WALK_FRAMES = 32
WALK_STANCE = 4.0
WALK_DUTY = 0.12
WALK_LIFT = (0.8, 1.3)     # a swinging foot rises at once to the first (out of the planted band of the check) and peaks at the second
WALK_CENTRE = -0.4         # the stance centred this far ahead of the rest ankle
WALK_CROUCH = 0.5          # the hips carried lower than standing, so each leg reaches its stance
WALK_HEAD = (-0.6, -1.6)   # the head carried forward and low (y, z from standing)
WALK_BOB = 0.7             # the head's bob along the body (forward and back once a step)
WALK_CURL = 0              # degrees the toes curl at the top of the swing: none, a curled toe hangs below the low swing
                           # and would set the floor of the cycle (the toes are under 2 px at tile size)
# the run: the same keying, the body leaned forward and low, the neck out, a longer stride at a shorter duty, a
# higher swing, the body rising in the flight, the wings held a little out (about 1.8 m a cycle for 95 ms a tile)
RUN_FRAMES = 32
RUN_STANCE = 6.0
RUN_DUTY = 0.09
RUN_LIFT = (0.9, 2.4)
RUN_CENTRE = -0.6
RUN_CROUCH = 1.2
RUN_LEAN = 30              # degrees the body pitches forward about the hips
RUN_BOB = 0.5              # the body's rise in the flight
RUN_HEAD = (-2.6, -2.3)    # the neck stretched forward
RUN_WING = (35, 5)         # the wings held a little out (spread and raise as for Lift below)
RUN_CURL = 0
SWING_TANGENT_MAX = 1.0
# Alert: the neck stretched up tall and the head up, then a head turn
ALERT_RAISE = (0.4, 1.6)   # the head target moved back and up (y, z)
ALERT_PITCH = -8           # degrees the body tips up about the hips
ALERT_TURN = 55            # degrees the head turns in the second pose (to the bird's left)
ALERT_TAIL = 14            # degrees the tail flicks up in the second pose
# Idle: four poses, 700 ms each (frames 0, 24, 48, 72 of 96)
IDLE_TURN = 40
IDLE_BOB = (-0.7, -1.0)
IDLE_TAIL = 18
# Graze: the beak this far above the floor the feet stand on
BEAK_CLEAR = 0.1
# Lie: the legs drawn in this share of the way to their hip joints
LIE_TUCK = 0.5
# Lie: the fall leaves the body across its standing line; it is turned back so its long axis lies along it, this many degrees off
LIE_YAW = 20
# Lift (36 frames, four poses at 0, 9, 18, 27) and Fly (16 frames, four poses at 0, 4, 8, 12): the wings' spread
# (degrees out from the body on the hinge, 90 level and more above the back, then degrees the tip is raised)
LIFT_WINGS = [(0, 0), (10, 0), (70, 10), (150, 25)]
FLY_WINGS = [(165, 25), (95, 5), (40, -8), (95, 10)]


def diag(*a):
    print("DIAG", *a, flush=True)


def all_fcurves(action):
    try:
        if len(action.fcurves):
            return list(action.fcurves)
    except Exception:  # noqa: BLE001
        pass
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False, use_scripts=False)
scene = bpy.context.scene
scene.render.fps = FPS
vl = bpy.context.view_layer
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
arm = bpy.data.objects["Armature"]
body = bpy.data.objects["Chicken"]
eyes = bpy.data.objects["Eyes"]

# ------------------------------------------------------------------ the helper: check it is not a visible part, then drop it
cyl = bpy.data.objects.get("Cylinder")
if cyl is not None:
    hidden = all(c.hide_render for c in cyl.users_collection) or cyl.hide_render
    diag("helper Cylinder:", len(cyl.data.vertices), "verts,", sum(len(p.vertices) - 2 for p in cyl.data.polygons), "tris,", len(cyl.vertex_groups),
         "vertex groups, modifiers", [m.type for m in cyl.modifiers], "on a hidden layer" if hidden else "VISIBLE")
    if not hidden or len(cyl.vertex_groups):
        raise SystemExit("the Cylinder helper is a visible or rigged part: look at it before dropping it")
for o in list(bpy.data.objects):
    if o not in (arm, body, eyes):
        bpy.data.objects.remove(o, do_unlink=True)

# ------------------------------------------------------------------ one mesh
bpy.ops.object.select_all(action="DESELECT")
for o in (body, eyes):
    o.hide_viewport = False
    o.hide_set(False)
    o.select_set(True)
vl.objects.active = body
bpy.ops.object.join()
mesh = body
mesh.name = "Fowl"
mesh.data.name = "Fowl"
for n in [u.name for u in mesh.data.uv_layers if u.name != "UVMap"]:
    mesh.data.uv_layers.remove(mesh.data.uv_layers[n])
mesh.data.uv_layers["UVMap"].active_render = True
diag("joined body and eyes into", mesh.name, "verts", len(mesh.data.vertices), "tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons),
     "uv layers kept", [u.name for u in mesh.data.uv_layers])

# ------------------------------------------------------------------ materials
img = bpy.data.images.get("UV-Texture.png")
if img is None or img.packed_file is None:
    raise SystemExit("no packed colour map UV-Texture.png in the source file: the fowl would ship untextured")


def principled(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    return mat, bsdf


coat, coat_bsdf = principled("Fowl")
nt = coat.node_tree
uvn = nt.nodes.new("ShaderNodeUVMap")
uvn.uv_map = "UVMap"
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], coat_bsdf.inputs["Base Color"])
eye, eye_bsdf = principled("Eye")
eye_bsdf.inputs["Base Color"].default_value = (0.03, 0.025, 0.03, 1.0)
old = [m.name if m else "" for m in mesh.data.materials]
idx = np.empty(len(mesh.data.polygons), dtype=np.int32)
mesh.data.polygons.foreach_get("material_index", idx)
is_eye = np.array([old[i] == "Material.001" for i in range(len(old))])
new_idx = np.where(is_eye[idx], 1, 0).astype(np.int32)
mesh.data.materials.clear()
mesh.data.materials.append(coat)
mesh.data.materials.append(eye)
mesh.data.polygons.foreach_set("material_index", new_idx)
mesh.data.update()
diag("materials", old, "->", [m.name for m in mesh.data.materials], "eye faces", int(new_idx.sum()), "colour map", img.name, tuple(img.size),
     "normal map not used:", [i.name for i in bpy.data.images if i.name != img.name and i.size[0] > 0])
if max(img.size) > TEX:
    k_ = TEX / max(img.size)
    img.scale(max(1, round(img.size[0] * k_)), max(1, round(img.size[1] * k_)))
    diag("map cut to", tuple(img.size))

# ------------------------------------------------------------------ rest pose, measures
if arm.animation_data:
    arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
    pb.rotation_mode = "QUATERNION"
vl.update()


def world_verts():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = (co.reshape(-1, 3) @ np.array(ev.matrix_world)[:3, :3].T) + np.array(ev.matrix_world)[:3, 3]
    ev.to_mesh_clear()
    return co


MW = np.array(mesh.matrix_world)
rest_co = np.empty(len(mesh.data.vertices) * 3)
mesh.data.vertices.foreach_get("co", rest_co)
rest_co = rest_co.reshape(-1, 3) @ MW[:3, :3].T + MW[:3, 3]
rest_no = np.empty(len(mesh.data.vertices) * 3)
mesh.data.vertices.foreach_get("normal", rest_no)
rest_no = rest_no.reshape(-1, 3) @ MW[:3, :3].T
rest_no /= np.maximum(np.linalg.norm(rest_no, axis=1, keepdims=True), 1e-9)
lo, hi = rest_co.min(axis=0), rest_co.max(axis=0)
UNIT_HEIGHT = float(hi[2] - lo[2])
FLOOR = float(lo[2])
head_y = arm.data.bones["Head"].head_local.y
hips_y = arm.data.bones["Hip"].head_local.y
diag("facing: head y", round(head_y, 3), "hips y", round(hips_y, 3), "(faces -Y)" if head_y < hips_y else "WARNING: does not face -Y")
diag("bind box (units): height", round(UNIT_HEIGHT, 3), "length", round(float(hi[1] - lo[1]), 3), "width", round(float(hi[0] - lo[0]), 3), "floor", round(FLOOR, 3))
groups = {g.name: g.index for g in mesh.vertex_groups}
gname = {i: n for n, i in groups.items()}


def dominant(v):
    return gname[max(v.groups, key=lambda g: g.weight).group] if v.groups else None


head_vs = [v.index for v in mesh.data.vertices if dominant(v) == "Head"]
BEAK = min(head_vs, key=lambda i: rest_co[i][1])    # the most forward vertex of the head: the beak's tip
diag("beak tip: vertex", BEAK, "at", tuple(round(float(c), 3) for c in rest_co[BEAK]))

# ------------------------------------------------------------------ the wings: two bones and their weights
bpy.ops.object.select_all(action="DESELECT")
arm.hide_viewport = False
arm.hide_set(False)
vl.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for side, s in (("L", 1), ("R", -1)):
    eb = arm.data.edit_bones.new("Wing_" + side)
    eb.head = Vector((s * WING_HEAD[0], WING_HEAD[1], WING_HEAD[2]))
    eb.tail = Vector((s * WING_TAIL[0], WING_TAIL[1], WING_TAIL[2]))
    eb.roll = 0.0
    eb.parent = arm.data.edit_bones["Backbone"]
    eb.use_connect = False
    eb.use_deform = True
# the soles: a contact bone under each foot, from the toes' root down to the floor under the middle toe, and a tip
for side, s in (("L", 1), ("R", -1)):
    toe = arm.data.edit_bones["Finger3_" + side]
    sole = arm.data.edit_bones.new(SOLES[side])
    mid = (toe.head + toe.tail) / 2
    sole.head = toe.head.copy()
    sole.tail = Vector((mid.x, mid.y, FLOOR))
    sole.parent = toe
    sole.use_connect = False
    sole.use_deform = False
    tip = arm.data.edit_bones.new(SOLES[side] + "_tip")
    tip.head = sole.tail.copy()
    tip.tail = sole.tail + (sole.tail - sole.head).normalized() * max(1e-4, sole.length * 0.25)
    tip.parent = sole
    tip.use_connect = True
    tip.use_deform = False
bpy.ops.object.mode_set(mode="OBJECT")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
diag("bones added: Wing_L, Wing_R under Backbone; soles", list(SOLES.values()), "with tips under Finger3_L/R")


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


ca, sa = math.cos(WING_ANGLE), math.sin(WING_ANGLE)
dy, dz = rest_co[:, 1] - WING_CENTRE[0], rest_co[:, 2] - WING_CENTRE[1]
u = (dy * ca + dz * sa) / WING_AXES[0]
w_ = (-dy * sa + dz * ca) / WING_AXES[1]
r = np.sqrt(u * u + w_ * w_)
mesh.vertex_groups.new(name="Wing_L")
mesh.vertex_groups.new(name="Wing_R")
groups = {g.name: g.index for g in mesh.vertex_groups}
gname = {i: n for n, i in groups.items()}
for side, s in (("L", 1), ("R", -1)):
    w = (1.0 - smooth(WING_CORE, 1.0, r)) * smooth(WING_SIDE[0], WING_SIDE[1], s * rest_no[:, 0]) * (s * rest_co[:, 0] > 0.5)
    vg = mesh.vertex_groups["Wing_" + side]
    picked = np.nonzero(w > 1e-3)[0]
    for i in picked:
        v = mesh.data.vertices[int(i)]
        wi = float(w[i])
        for g in v.groups:            # the bones that carried it keep the rest of its weight
            g.weight *= (1.0 - wi)
        vg.add([int(i)], wi, "REPLACE")
    full = int((w > 0.99).sum())
    diag("wing", side, "weights", len(picked), "vertices,", full, "at full weight; box (units)", rest_co[picked].min(axis=0).round(2), rest_co[picked].max(axis=0).round(2))

# ------------------------------------------------------------------ centre and scale (baked into the data at the end)
arm.matrix_world = Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])) @ arm.matrix_world
vl.update()
K = HEIGHT / UNIT_HEIGHT
arm.matrix_world = Matrix.Scale(K, 4) @ arm.matrix_world
vl.update()
co = world_verts()
diag("scaled by", round(K, 6), "to", HEIGHT, "m standing; box now", (co.max(axis=0) - co.min(axis=0)).round(3), "m")

# ------------------------------------------------------------------ actions: helpers
src = {a.name: a for a in bpy.data.actions}
for a in src.values():
    a.name = "source " + a.name
BONES = [pb.name for pb in arm.pose.bones]


def set_action(act):
    arm.animation_data_create()
    arm.animation_data.action = act
    if act is not None and hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None):
        arm.animation_data.action_slot = act.slots[0]


def pose_at(act, f):
    """Every bone's basis (rotation, location, scale) of an action at frame f; bones it does not key at rest."""
    set_action(act)
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    scene.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    out = {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in arm.pose.bones}
    set_action(None)
    return out


def put(p):
    if arm.animation_data and arm.animation_data.action is not None:
        set_action(None)
    for b, (q, loc, sc) in p.items():
        pb = arm.pose.bones[b]
        pb.rotation_quaternion, pb.location, pb.scale = q, loc, sc
    vl.update()


def copy(p):
    return {b: (v[0].copy(), v[1].copy(), v[2].copy()) for b, v in p.items()}


def local_delta(bone, d):
    """An armature-space offset as a location channel of a bone whose parent is unposed (the IK targets and the hips hang off Main)."""
    return arm.data.bones[bone].matrix_local.to_3x3().inverted() @ Vector(d)


def move(p, bone, d):
    q, loc, sc = p[bone]
    p[bone] = (q, loc + local_delta(bone, d), sc)


def turn(p, bone, R):
    """Turn a bone's basis by an armature-space rotation R about the bone (applied in its rest frame)."""
    q, loc, sc = p[bone]
    rest = arm.data.bones[bone].matrix_local.to_3x3()
    p[bone] = ((rest.inverted() @ R @ rest).to_quaternion() @ q, loc, sc)


def rx(deg):   # about the body's side axis: positive takes +Y (behind) to +Z: the rear up, the nose down
    return Matrix.Rotation(math.radians(deg), 3, "X")


def rz(deg):   # about the vertical: positive turns the head (-Y) toward +X, the bird's left
    return Matrix.Rotation(math.radians(deg), 3, "Z")


WING_AXIS = {side: (arm.data.bones["Wing_" + side].tail_local - arm.data.bones["Wing_" + side].head_local).normalized() for side in ("L", "R")}


def wings(p, spread, raised):
    """The wings opened: turned out from the body by `spread` degrees on the hinge along the folded wing's top edge (the
    lower edge swings out and up; 90 is level, more is above the back), then raised by `raised` degrees about the
    body's side axis (the tip up)."""
    for side, s in (("L", 1), ("R", -1)):
        R = rx(raised) @ Matrix.Rotation(math.radians(-s * spread), 3, WING_AXIS[side])
        turn(p, "Wing_" + side, R)


HIP_HEAD = arm.data.bones["Hip"].head_local.copy()
PIVOT = (arm.data.bones["Leg_L.001"].head_local + arm.data.bones["Leg_R.001"].head_local) / 2   # the hip joints


def lean(p, deg):
    """The body pitched about its hip joints (the Hip bone's own head is far back, by the tail): positive tips the
    breast down. The joints stay where they were, so the legs keep their reach."""
    turn(p, "Hip", rx(deg))
    rel = PIVOT - HIP_HEAD
    move(p, "Hip", tuple(rel - rx(deg) @ rel))


def head_to(p, d, yaw=0.0, pitch=0.0):
    """The head target moved by d (armature space) and turned: yaw about the vertical, pitch about the side axis."""
    move(p, "IK-Head", d)
    if yaw or pitch:
        turn(p, "IK-Head", rz(yaw) @ rx(pitch))


def blend(p0, p1, t):
    out = {}
    for b in p0:
        q0, l0, s0 = p0[b]
        q1, l1, s1 = p1[b]
        out[b] = (q0.slerp(q1, t), l0.lerp(l1, t), s0.lerp(s1, t))
    return out


def ease(t):
    return t * t * (3 - 2 * t)


def keyed(poses_at, length):
    """Frames 0..length from key poses {frame: pose}, eased between them (the last key repeats to the end)."""
    keys = sorted(poses_at)
    frames = []
    for f in range(length + 1):
        k0 = max(k for k in keys if k <= f)
        later = [k for k in keys if k > f]
        if not later:
            frames.append(copy(poses_at[k0]))
            continue
        k1 = later[0]
        frames.append(blend(poses_at[k0], poses_at[k1], ease((f - k0) / (k1 - k0))))
    return frames


def orient_toes(p, curls):
    """Each foot's toes laid as they lie at rest (flat on the ground while planted), curled down by `curls[side]` degrees
    in the swing. The IK bends the leg above them, so each toe's basis is found by posing the frame and asking for its
    armature-space matrix."""
    put(p)
    for side, (_, _, toes, _) in LEGS.items():
        for toe in toes:
            pb = arm.pose.bones[toe]
            head = pb.matrix.translation.copy()
            rest = arm.data.bones[toe].matrix_local.to_3x3()
            pb.matrix = Matrix.Translation(head) @ (rx(-curls[side]) @ rest).to_4x4()
            vl.update()
            p[toe] = (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy())


def swing_y(s, stance, duty, tangent_max=SWING_TANGENT_MAX):
    """A swinging foot from behind (+stance/2) to in front (-stance/2): a cubic Hermite that leaves and meets the ground
    at the stance's own speed (up to tangent_max stances per unit of swing)."""
    m = min(stance * (1 - duty) / duty, tangent_max * stance)
    h00, h10, h01, h11 = 2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2
    return h00 * stance / 2 + h10 * m + h01 * (-stance / 2) + h11 * m


stand = pose_at(src["Stand"], 1)
REST_POSE = {b: (Quaternion(), Vector(), Vector((1, 1, 1))) for b in BONES}
for b in BONES:
    stand.setdefault(b, REST_POSE[b])
actions = {}

# what the file's own Walk covers: the ankle target's travel while it is planted
fw = src["Walk"]
f0, f1 = (int(round(v)) for v in fw.frame_range)
travel = []
for side, (ik, _, _, _) in LEGS.items():
    pts = [pose_at(fw, f) for f in range(f0, f1 + 1)]
    put(stand)
    ys, zs = [], []
    for pp in pts:
        put(pp)
        m = arm.pose.bones[ik].matrix.translation
        ys.append(m.y)
        zs.append(m.z)
    zs = np.array(zs)
    ys = np.array(ys)
    planted = zs <= zs.min() + 0.1
    travel.append(float(ys[planted].max() - ys[planted].min()) if planted.any() else 0.0)
diag("the file's Walk:", f1 - f0, "frames a cycle; a planted ankle travels", [round(t, 2) for t in travel], "units a step:",
     round(float(np.mean(travel)) * 2 * K, 3), "m a cycle (", round(float(np.mean(travel)) * 2 * K * 66 * math.sin(math.radians(50)), 1), "px seen from above)")


# ------------------------------------------------------------------ Idle
def idle_pose(i):
    p = copy(stand)
    if i == 0:      # breath in: the chest up a little
        move(p, "Hip", (0, 0, 0.15))
    elif i == 1:    # a head turn to its left, the head a little up
        head_to(p, (0, 0.1, 0.25), yaw=IDLE_TURN)
    elif i == 2:    # a head bob: forward and down
        head_to(p, (0, IDLE_BOB[0], IDLE_BOB[1]), pitch=12)
    else:           # a tail flick up and to the side, the head turned a little the other way
        turn(p, "Bone.006", rz(IDLE_TAIL) @ rx(-IDLE_TAIL * 0.6))
        head_to(p, (0, 0, 0), yaw=-15)
    orient_toes(p, {"L": 0.0, "R": 0.0})     # the toes flat on the ground whatever the legs do above them
    return p


actions["Idle"] = keyed({0: idle_pose(0), 24: idle_pose(1), 48: idle_pose(2), 72: idle_pose(3), 96: idle_pose(0)}, 96)


# ------------------------------------------------------------------ Walk and Run
def gait(frames, stance, duty, lift, centre, crouch, head, bob_head, curl, pitch=0.0, bob=0.0, wing=None):
    out = []
    for i in range(frames + 1):
        t = i / frames
        p = copy(stand)
        curls = {}
        for side, (ik, _, _, mid) in LEGS.items():
            ph = (t - mid + duty / 2) % 1.0
            if ph < duty:                       # stance: in front to behind at one speed
                s = ph / duty
                y = stance * (s - 0.5)
                z = 0.0
                curls[side] = 0.0
            else:                               # swing: behind to in front, lifted at once out of the planted band
                s = (ph - duty) / (1 - duty)
                y = swing_y(s, stance, duty)
                z = lift[0] + (lift[1] - lift[0]) * math.sin(math.pi * s)
                curls[side] = curl * math.sin(math.pi * s)
            move(p, ik, (0, y + centre, z))
        rise = bob * (0.5 - 0.5 * math.cos(4 * math.pi * t))   # lowest at each mid-stance (t = 0, 0.5), highest in the flight
        move(p, "Hip", (0, 0, -crouch + rise))
        if pitch:
            lean(p, pitch)
        hb = -bob_head * math.cos(4 * math.pi * t)              # the head thrust forward at each mid-stance, back between
        head_to(p, (0, head[0] + hb, head[1] - crouch + rise))
        if wing is not None:
            wings(p, *wing)
        orient_toes(p, curls)
        out.append(p)
    return out


actions["Walk"] = gait(WALK_FRAMES, WALK_STANCE, WALK_DUTY, WALK_LIFT, WALK_CENTRE, WALK_CROUCH, WALK_HEAD, WALK_BOB * 0.5, WALK_CURL)
actions["Run"] = gait(RUN_FRAMES, RUN_STANCE, RUN_DUTY, RUN_LIFT, RUN_CENTRE, RUN_CROUCH, RUN_HEAD, 0.0, RUN_CURL, pitch=RUN_LEAN, bob=RUN_BOB, wing=RUN_WING)


# ------------------------------------------------------------------ Alert
def alert_pose(look):
    p = copy(stand)
    lean(p, (ALERT_PITCH))
    head_to(p, (0, ALERT_RAISE[0], ALERT_RAISE[1]), yaw=ALERT_TURN if look else 0.0, pitch=-10)
    if look:
        turn(p, "Bone.006", rx(-ALERT_TAIL))
    orient_toes(p, {"L": 0.0, "R": 0.0})
    return p


actions["Alert"] = keyed({0: alert_pose(False), 24: alert_pose(True), 48: alert_pose(False)}, 48)


# ------------------------------------------------------------------ Graze: pecking
FOOT_VS = [v.index for v in mesh.data.vertices if dominant(v) and dominant(v).startswith("Finger")]


def lowest_parts():
    co_ = world_verts()
    return round(float(co_[BEAK][2] - co_[FOOT_VS][:, 2].min()) / K, 3)   # the beak above the lowest toe (units)


def frames_of(act):
    a0, a1 = (int(round(v)) for v in act.frame_range)
    return range(a0, a1 + 1)


def beak_at(act, f):
    put(pose_at(act, f))
    return lowest_parts()


p1 = src["Pecking1"]
p2 = src["Pecking2"]
endp = src["EndPecking"]
h1 = {f: beak_at(p1, f) for f in frames_of(p1)}
h2 = {f: beak_at(p2, f) for f in frames_of(p2)}
he = {f: beak_at(endp, f) for f in frames_of(endp)}
diag("beak above the toes (units): Pecking1", h1, "Pecking2", h2, "EndPecking", he)
down1 = min(h1, key=h1.get)
up1 = max(h1, key=h1.get)
down2 = min(h2, key=h2.get)
half = (h1[down1] + max(he.values())) / 2
part = min(he, key=lambda f: abs(he[f] - half))


def solved(p):
    """The beak set BEAK_CLEAR units above the lowest toe, by moving the head target up or down."""
    for _ in range(3):
        put(p)
        err = lowest_parts() - BEAK_CLEAR
        move(p, "IK-Head", (0, 0, -err))
    put(p)
    return p


graze_keys = [solved(pose_at(p1, down1)), pose_at(p1, up1), solved(pose_at(p2, down2)), pose_at(endp, part)]
for gp in graze_keys:
    for b in BONES:
        gp.setdefault(b, REST_POSE[b])
put(graze_keys[0])
diag("graze: Pecking1 frame", down1, "(beak down, solved to", lowest_parts(), "units), frame", up1, "(between pecks), Pecking2 frame", down2,
     ", EndPecking frame", part, "(the head part way up)")
actions["Graze"] = keyed({0: graze_keys[0], 12: graze_keys[1], 24: graze_keys[2], 36: graze_keys[3], 48: graze_keys[0]}, 48)

# ------------------------------------------------------------------ Lie: the last pose of Dying, the legs drawn in, held still
die = src["Dying"]
lie_pose = pose_at(die, die.frame_range[1])
for b in BONES:
    lie_pose.setdefault(b, REST_POSE[b])
put(lie_pose)
goals = {}
for side, (ik, hip_bone, _, _) in LEGS.items():
    f_ = arm.pose.bones[ik].matrix.translation.copy()
    r_ = arm.pose.bones[hip_bone].head.copy()
    goals[ik] = f_ + (r_ - f_) * LIE_TUCK
for ik, g in goals.items():
    move(lie_pose, ik, tuple(g - arm.pose.bones[ik].matrix.translation))
    put(lie_pose)


def body_line():
    """The body's long axis seen from above (the main axis of its vertices), pointed toward the beak."""
    co_ = world_verts()[:, :2]
    c0 = co_ - co_.mean(axis=0)
    w, v = np.linalg.eigh(c0.T @ c0)
    ax = v[:, int(np.argmax(w))]
    if float(c0[BEAK] @ ax) < 0:
        ax = -ax
    return math.atan2(float(ax[1]), float(ax[0]))


put(stand)
line_stand = body_line()
put(lie_pose)
yaw = math.degrees(line_stand - body_line()) + LIE_YAW
yaw = (yaw + 180) % 360 - 180
turn(lie_pose, "Main", rz(yaw))
put(lie_pose)
diag("lie: the body turned", round(yaw, 1), "degrees about the vertical to lie along its standing line,", LIE_YAW, "off")
put(stand)
c_stand = world_verts()
put(lie_pose)
c_lie = world_verts()
shift = (c_stand.min(axis=0) + c_stand.max(axis=0)) / 2 - (c_lie.min(axis=0) + c_lie.max(axis=0)) / 2
# the fall carries the body off its spot: move it back (Main is the root; the shift is in metres, the channel in units)
move(lie_pose, "Main", tuple(arm.matrix_world.inverted().to_3x3() @ Vector((float(shift[0]), float(shift[1]), 0.0))))
put(lie_pose)
diag("lie: Dying frame", int(die.frame_range[1]), "legs drawn in by", LIE_TUCK, "moved back by", shift[:2].round(3), "m")
actions["Lie"] = [copy(lie_pose) for _ in range(9)]


# ------------------------------------------------------------------ Lift: stand, crouch, spring, the top of the stroke
def lift_pose(i):
    p = copy(stand)
    if i == 1:      # crouch: the hips down, the body tipped forward, the head forward and down
        move(p, "Hip", (0, 0, -1.3))
        lean(p, (12))
        head_to(p, (0, -0.8, -2.0))
    elif i == 2:    # spring: the legs stretched, the heels up, the body tipped up, the wings opening
        move(p, "Hip", (0, 0, 0.7))
        lean(p, (-16))
        for side, (ik, _, _, _) in LEGS.items():
            move(p, ik, (0, 0.6, 0.9))
        head_to(p, (0, 0.2, 1.2), pitch=-10)
    elif i == 3:    # the top of the stroke: the legs stretched below and trailing, the body tipped up, the wings high
        move(p, "Hip", (0, 0, 0.9))
        lean(p, (-22))
        for side, (ik, _, _, _) in LEGS.items():
            move(p, ik, (0, 1.6, 1.4))
        head_to(p, (0, 0.0, 1.0), pitch=-10)
    wings(p, *LIFT_WINGS[i])
    curls = {"L": 0.0, "R": 0.0} if i < 2 else {"L": 35.0 if i == 2 else 55.0, "R": 35.0 if i == 2 else 55.0}
    orient_toes(p, curls)
    return p


actions["Lift"] = keyed({0: lift_pose(0), 9: lift_pose(1), 18: lift_pose(2), 27: lift_pose(3), 36: lift_pose(3)}, 36)


# ------------------------------------------------------------------ Fly: the flutter
def fly_pose(i):
    p = copy(stand)
    move(p, "Hip", (0, 0, 0.6))
    lean(p, (6))
    for side, (ik, _, _, _) in LEGS.items():   # the legs tucked under the belly and back
        move(p, ik, (0, 1.8, 2.3))
    head_to(p, (0, -1.4, -0.9))
    wings(p, *FLY_WINGS[i])
    orient_toes(p, {"L": 70.0, "R": 70.0})
    return p


actions["Fly"] = keyed({0: fly_pose(0), 4: fly_pose(1), 8: fly_pose(2), 12: fly_pose(3), 16: fly_pose(0)}, 16)


# ------------------------------------------------------------------ bake the IK: armature-space matrices per frame
def evaluate(p):
    put(p)
    return {b: arm.pose.bones[b].matrix.copy() for b in BONES}


miss = {}
for name, poses in actions.items():
    worst = [0.0, 0.0]
    for p in poses:
        put(p)
        for side, (ik, _, _, _) in LEGS.items():
            ankle = arm.pose.bones["Leg_" + side + ".002"].tail
            tgt = arm.pose.bones[ik].matrix.translation
            down = tgt.z < arm.data.bones[ik].head_local.z + 0.01
            worst[0 if down else 1] = max(worst[0 if down else 1], (ankle - tgt).length)
    miss[name] = (round(worst[0], 3), round(worst[1], 3))
diag("the legs' reach: worst ankle miss from its target (units), (feet down, feet up)", miss)
baked = {name: [evaluate(p) for p in poses] for name, poses in actions.items()}
diag("evaluated with the IK:", {k: len(v) for k, v in baked.items()})

for pb in arm.pose.bones:
    for cn in list(pb.constraints):
        pb.constraints.remove(cn)
vl.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name in IK_BONES:
    arm.data.edit_bones.remove(arm.data.edit_bones[name])
bpy.ops.object.mode_set(mode="OBJECT")
BONES = [pb.name for pb in arm.pose.bones]
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
diag("dropped the IK targets and every constraint; bones now", len(BONES))

ORDER = []
for b in arm.data.bones:            # parents first
    depth, x = 0, b
    while x is not None:
        depth += 1
        x = x.parent
    ORDER.append((depth, b.name))
ORDER = [n for _, n in sorted(ORDER)]


def basis_from(mats):
    out = {}
    for b in ORDER:
        bone = arm.data.bones[b]
        rest = bone.matrix_local
        if bone.parent is None:
            m = rest.inverted() @ mats[b]
        else:
            m = (mats[bone.parent.name] @ bone.parent.matrix_local.inverted() @ rest).inverted() @ mats[b]
        loc, rot, sc = m.decompose()
        out[b] = (rot, loc, sc)
    return out


def new_action(name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None) is not None:
        slot = act.slots.new(id_type="OBJECT", name=arm.name) if len(act.slots) == 0 else act.slots[0]
        arm.animation_data.action_slot = slot
    return act


final = []
worst = 0.0
for name, frames in baked.items():
    act = new_action(name)
    prev = {}
    for i, mats in enumerate(frames):
        for b, (q, loc, sc) in basis_from(mats).items():
            if b in prev and prev[b].dot(q) < 0:   # keep the quaternions on one side, so the curve takes the short way
                q = -q
            prev[b] = q
            pb = arm.pose.bones[b]
            pb.rotation_quaternion, pb.location, pb.scale = q, loc, sc
            pb.keyframe_insert("rotation_quaternion", frame=i)
            pb.keyframe_insert("location", frame=i)
            pb.keyframe_insert("scale", frame=i)
    final.append(act)
    for i in (0, len(frames) // 3, len(frames) - 1):   # check: the baked action plays the evaluated soles
        scene.frame_set(i)
        for so in SOLES.values():
            worst = max(worst, (arm.pose.bones[so].tail - (frames[i][so] @ Vector((0, arm.data.bones[so].length, 0, 1))).to_3d()).length)
    set_action(None)
diag("baked to bone keys:", [(a.name, tuple(a.frame_range)) for a in final], "worst sole error", round(worst * K * 1000, 3), "mm")
for a in list(bpy.data.actions):
    if a not in final:
        bpy.data.actions.remove(a)


# the renderer sets each pose on its lowest vertex: say where the lowest vertex is against the lowest sole
def soles_z():
    return min((arm.matrix_world @ arm.pose.bones[so].tail).z for so in SOLES.values())


for act in final:
    set_action(act)
    a0, a1 = (int(round(v)) for v in act.frame_range)
    rows = []
    for f in sorted({a0, a0 + (a1 - a0) // 4, a0 + (a1 - a0) // 2, a0 + 3 * (a1 - a0) // 4}):
        scene.frame_set(f)
        c = world_verts()
        rows.append((f, round((float(c[:, 2].min()) - soles_z()) * 1000, 1), round(float(c[BEAK][2] - c[:, 2].min()) * 1000, 1),
                     round(float(c[:, 0].max() - c[:, 0].min()) * 1000), round(float(c[:, 2].max() - c[:, 2].min()) * 1000)))
    diag("drawn frames of", act.name, "(frame, lowest vertex minus lowest sole mm, beak above the lowest vertex mm, width mm, height mm)", rows)
    set_action(None)


# ------------------------------------------------------------------ how fast each gait carries the body
def ground_speed(act):
    set_action(act)
    a0, a1 = (int(round(v)) for v in act.frame_range)
    speeds, duty = [], []
    for so in SOLES.values():
        pts = []
        for f in range(a0, a1 + 1):
            scene.frame_set(f)
            pts.append(arm.matrix_world @ arm.pose.bones[so].tail)
        z = np.array([q.z for q in pts])
        y = np.array([q.y for q in pts])
        planted = z <= z.min() + 0.004
        v = [(y[i + 1] - y[i]) * FPS for i in range(len(y) - 1) if planted[i] and planted[i + 1]]
        duty.append(round(float(planted[:-1].mean()), 2))
        if v:
            speeds.append(abs(float(np.median(v))))
    set_action(None)
    return speeds, duty


for act in final:
    if act.name not in ("Walk", "Run"):
        continue
    sp, duty = ground_speed(act)
    mean = float(np.mean(sp)) if sp else 0.0
    act["groundSpeed"] = round(mean, 3)
    cyc = mean * (act.frame_range[1] - act.frame_range[0]) / FPS
    diag("ground speed", act.name, round(mean, 3), "m/s; ground a cycle", round(cyc, 3), "m (", round(cyc * 66 * math.sin(math.radians(50)), 1),
         "px seen from above,", round(cyc * 66, 1), "px side-on); planted share", duty)


# ------------------------------------------------------------------ bake the object transforms into the data
def bake_object_transforms(arm_, mesh_):
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for o in (arm_, mesh_):
        o.hide_viewport = False
        o.hide_set(False)
    set_action(None)
    for pb in arm_.pose.bones:
        pb.matrix_basis.identity()
    vl.update()
    W = arm_.matrix_world.copy()
    s = W.to_scale()
    assert max(s) - min(s) < 1e-6, ("the bake needs a uniform scale", s)
    k_ = float(s[0])
    M = mesh_.matrix_world.copy()
    me = mesh_.data
    c = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", c)
    c = c.reshape(-1, 3) @ np.array(M)[:3, :3].T + np.array(M)[:3, 3]
    me.vertices.foreach_set("co", c.reshape(-1))
    me.update()
    vl.objects.active = arm_
    bpy.ops.object.mode_set(mode="EDIT")
    R3 = W.to_3x3().normalized()
    saved = [(eb, W @ eb.head, W @ eb.tail, R3 @ eb.z_axis) for eb in arm_.data.edit_bones]
    for eb, h, t, _ in saved:
        eb.head = h
        eb.tail = t
    for eb, _, _, z in saved:
        eb.align_roll(z)
    bpy.ops.object.mode_set(mode="OBJECT")
    arm_.matrix_world = Matrix.Identity(4)
    mesh_.parent = arm_
    mesh_.matrix_parent_inverse = Matrix.Identity(4)
    mesh_.matrix_basis = Matrix.Identity(4)
    vl.update()
    n = 0
    for act in bpy.data.actions:
        for fc in all_fcurves(act):
            if fc.data_path.startswith("pose.bones") and fc.data_path.endswith("location"):
                for kp in fc.keyframe_points:
                    kp.co.y *= k_
                    kp.handle_left.y *= k_
                    kp.handle_right.y *= k_
                n += 1
    diag("baked the object transforms: scale", round(k_, 6), "into", len(arm_.data.bones), "bones and", len(me.vertices), "vertices;", n, "location channels scaled")


bake_object_transforms(arm, mesh)
set_action(final[0])
scene.frame_set(0)
c = world_verts()
set_action(None)
diag("after the bake: Idle frame 0 box", c.min(axis=0).round(4), c.max(axis=0).round(4))

# ------------------------------------------------------------------ export: each action on a track, one clip each
ad = arm.animation_data
ad.action = None
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)
for act in final:
    tr = ad.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, "action_slot") and st.action_slot is None and len(getattr(act, "slots", [])):
        st.action_slot = act.slots[0]
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
want = dict(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
            export_animation_mode="ACTIONS", export_extras=True, export_skins=True, export_image_format="JPEG",
            export_jpeg_quality=90, export_image_quality=90, export_yup=True, export_apply=False,
            export_force_sampling=True, export_optimize_animation_size=True, export_anim_slide_to_zero=True)
kw = {k_: v for k_, v in want.items() if k_ in props}
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
vl.objects.active = arm
bpy.ops.export_scene.gltf(**kw)
diag("wrote", OUT, "options skipped", sorted(set(want) - set(kw)))
