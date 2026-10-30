"""Make the game-ready wild boar from the CC0 "Boar" by Teh_Bucket (OpenGameArt, boar_0.blend, Blender 2.74).

Run:  blender -b --factory-startup --disable-autoexec -P boar_pass.py -- <boar_0.blend> <out.glb> [--height 0.8] [--tex 1024]

The file is opened with its scripts off (`--disable-autoexec`, and `use_scripts=False` here as well), so nothing it
carries ever runs.

What it does, in the manner of quad_pass.py (the wolf) and deer_pass.py (the deer family):
- keeps the armature and the one skinned mesh and applies its mirror, edge-split and triangulate modifiers (the file
  models one half of the boar; the clip renderer draws one whole mesh),
- rebuilds the Blender Internal material as a Principled BSDF on the packed colour map (`boar.png`, re-encoded as JPEG
  at export) on the mesh's `UVMap` layer, and drops the unused `projection-test` layer; the map draws nearly black on
  the ramps (the coat's median value 0.27 of white), so the coat is lifted to a dark grey-brown with grey bristle
  tips and written into a new packed map (--coat-gain, --coat-gamma, --coat-grey, --grizzle; the tusks' white is left
  alone), and the snout's disc and the hooves get a plain dark material,
- turns the body to face -Y (the file's boar faces +Y), centres it over the origin, scales it to --height metres at the
  withers (bind pose) and bakes the turn and the scale into the bones and the mesh; adds a tip bone under each hoof
  (the renderer reads a foot from its bone's tail, and glTF loses a leaf bone's length),
- makes seven actions, every bone keyed on every frame, all from the file's rest pose ('default') with the leg IK of the
  rig, then bakes each to plain bone keys (visual keying) and drops the IK targets and every constraint before export:
  Idle   from the rest pose: a breath, a lift of the snout to sniff, a tail flick; four poses that differ.
  Walk   keyed here on the leg IK targets: a calm four-beat pace (hind left, fore left, hind right, fore right, a
         quarter of the cycle apart), three hooves on the ground in every drawn pose, the body low and level and the
         head carried low. The file's walk is a trot (the diagonal pairs swing together, half the cycle on the
         ground), so it is not used.
  Run    keyed the same way: a short, heavy rotary gallop (hind left, hind right, fore right, fore left), the body low
         with little bounce, the stride long enough for the run at half the walk's step.
  Alert  the bluff, from the rest pose: the head held low toward the front, the forelegs braced, a snort with a toss
         of the head and a stamp of a forefoot, a loop of four poses.
  Graze  rooting: the snout down to the earth, pushing forward and up, then a lift and a toss of the head (no soil is
         drawn; the ground is not rendered). Each key's neck and head bend is solved so the snout touches the floor
         the hooves stand on and never goes below it (the renderer stands a pose on its lowest point).
  Lie    on its side, the legs drawn in, held still: no fall is played and nothing twitches; the client fades it.
  Charge the file's attack (a lowered head and an upward toss), renamed and baked; kept for the defender's charge once
         the fight exists, not rendered now,
- caps the map at --tex pixels and exports one GLB with the seven clips on NLA tracks.
Prints one DIAG line per fact.

The file names its sides as seen from the front: its `_L` bones (+X in the file, where the boar faces +Y) carry the
boar's right legs. The bones keep the file's names; the anim.json contacts map them to the boar's own sides.
Nothing that belongs to the boar alone (tusks, mane) lives in the bones, so the same body can carry another ramp.
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


HEIGHT = opt("--height", 0.8, float)
TEX = opt("--tex", 1024, int)
FPS = 24

# the legs, by the boar's own side (the file's _L bones are its right): (IK target, hoof bone, leg root)
LH = ("body_R.004", "body_R.002", "body_R")
LF = ("body.001_R.004", "body.001_R.002", "body.001_R")
RH = ("body_L.004", "body_L.002", "body_L")
RF = ("body.001_L.004", "body.001_L.002", "body.001_L")
LEGS = {"LH": LH, "LF": LF, "RH": RH, "RF": RF}
TARGETS = [v[0] for v in LEGS.values()]
HOOVES = [v[1] for v in LEGS.values()]
TAIL = ["tail", "tail.001", "tail.002", "tail.003"]
TAIL_TARGET = "tail.004"

# All lengths below are in the file's units (the withers stand about WITHERS_UNITS high; the pass prints it), in the
# armature's own axes: the boar faces +Y there, +X is its right, +Z up. The turn to -Y comes with the bake at the end.

# Idle: four poses a loop, 700 ms each (frames 0, 24, 48, 72 of 96): breath in and the snout lifted to sniff, the
# tail flicked to one side, breath out with the head a little down, and the rest pose
IDLE_FRAMES = 96

# the walk: a calm four-beat pace keyed on the leg IK targets. Four poses are drawn (frames 0, 8, 16, 24 of 32), each
# with one hoof at the top of a low swing and the other three planted; in those poses a planted hoof sits a quarter
# of the stride ahead of or behind its middle spot whatever the duty, so the stride alone sets how far the legs spread
WALK_FRAMES = 32
WALK_DUTY = 0.65       # the share of the cycle a hoof is on the ground: three down in every drawn pose
WALK_LIFT = 0.2        # how high a swinging hoof rises: a step, not a trot
WALK_STRIDE_M = opt("--walk-stride", 0.95, float)   # metres of ground one cycle covers (set by the rules' pace, see below)
WALK_CROUCH = 0.06     # the body carried this much lower than standing (metres), so each planted hoof reaches its spot
WALK_HEAD = -14        # degrees the neck and head are carried lower than standing
# where each hoof's stance is centred, ahead (+) of its rest spot, in metres
WALK_CENTRE = {"LH": 0.04, "RH": 0.04, "LF": 0.0, "RF": 0.0}
# the swing phase at the middle of each foot's swing; the four drawn poses (0, 1/4, 1/2, 3/4) each show one foot at
# the top of its swing, in the order of a lateral walk: hind left, fore left, hind right, fore right
WALK_MID = {"LH": 0.0, "LF": 0.25, "RH": 0.5, "RF": 0.75}

# the run: a short, heavy rotary gallop. The fore feet land in the hind feet's order (the rotary order), so no drawn
# pose gathers both far legs under the belly at once (in the transverse order one pose does, a lump under the belly)
RUN_FRAMES = 12
RUN_STRIDE_M = opt("--run-stride", 2.0, float)   # metres of ground one cycle covers
RUN_DUTY = 0.3
RUN_LIFT = 0.32        # a swinging hoof's height (units): low, a heavy animal with short legs
RUN_FORE_LIFT = 0.9
RUN_LIFT_SHAPE = 0.6   # the swing's height as sin ** this: the hoof clears the ground at once
RUN_BOB = 0.015        # metres up and down: little bounce
RUN_PITCH = 3.0        # degrees the trunk rocks (the shoulders and the hips rise and fall against each other)
RUN_CROUCH = 0.10      # metres lower than standing: the body carried low
RUN_HEAD = -10         # degrees: the head carried low and forward, riding the body
RUN_CENTRE = {"LH": 0.06, "RH": 0.06, "LF": 0.04, "RF": 0.04}
RUN_DOWN = {"LH": 0.0, "RH": 0.25, "RF": 0.5, "LF": 0.75}   # each foot's touchdown, a share of the cycle
RUN_PHASE = 1 / RUN_FRAMES   # the cycle starts one frame before the hind left lands, so no drawn pose sits on a touchdown
SWING_TANGENT_MAX = 1.0
RUN_TANGENT_MAX = 0.7

# Alert (the bluff): four poses by time, 600 ms each (frames 0, 12, 24, 36 of 48)
ALERT_FRAMES = 48
# Graze (rooting): four poses by time, 400 ms each (frames 0, 12, 24, 36 of 48)
GRAZE_FRAMES = 48
# Lie: held still
LIE_FRAMES = 8
LIE_ROLL = opt("--lie-roll", 80.0, float)   # degrees the body is rolled onto its left side
LIE_TUCK = 0.55        # each hoof moved this share of the way toward its leg's root: the legs drawn in


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
diag("texts in the file (never run):", [t.name for t in bpy.data.texts])
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers))
for o in list(bpy.data.objects):
    if o not in (arm, mesh):
        bpy.data.objects.remove(o, do_unlink=True)
diag("kept", arm.name, mesh.name, "raw verts", len(mesh.data.vertices), "modifiers", [m.type for m in mesh.modifiers])

# ------------------------------------------------------------------ one whole mesh: apply everything but the armature
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
for m in list(mesh.modifiers):
    if m.type == "ARMATURE":
        continue
    with bpy.context.temp_override(object=mesh, active_object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
        bpy.ops.object.modifier_apply(modifier=m.name)
left = [m.type for m in mesh.modifiers]
if left != ["ARMATURE"]:
    raise SystemExit(f"a modifier did not apply, the mesh would ship in halves: {left}")
arm.data.pose_position = "POSE"
mesh.name = "Boar"
mesh.data.name = "Boar"
diag("mesh after apply: verts", len(mesh.data.vertices), "tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons))

# ------------------------------------------------------------------ material
UV = "UVMap"
for name in [u.name for u in mesh.data.uv_layers if u.name != UV and not u.name.startswith(".")]:
    uv = mesh.data.uv_layers.get(name)
    if uv is not None:
        mesh.data.uv_layers.remove(uv)
mesh.data.uv_layers[UV].active = True
mesh.data.uv_layers[UV].active_render = True
img = bpy.data.images.get("boar")
if img is None:
    raise SystemExit("no colour map 'boar' in the source file: the boar would ship untextured")


def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.0
    return m, b


# the coat, written into the map itself (glTF carries the image, not a node chain): the file's coat is nearly black
# (half its pixels under 8 % luminance), which the snap draws as one dark blot; its value is lifted (v -> COAT_GAIN *
# v ** COAT_GAMMA, the hue kept) so it lands in bark's middle steps, and its lighter bristle tips are turned grey
# (a share GRIZZLE, from COAT_GRIZZLE_FROM to COAT_GRIZZLE_TO luminance), so the snap draws a grey grizzle in stone.
# The pale tusks (the white of the map) are left as they are and fall on stone's top step.
COAT_GAIN, COAT_GAMMA = opt("--coat-gain", 1.0, float), opt("--coat-gamma", 0.6, float)
COAT_GREY = opt("--coat-grey", 0.5, float)   # the share of grey in the whole coat: a dark grey-brown, not a red one
GRIZZLE, COAT_GRIZZLE_FROM, COAT_GRIZZLE_TO = opt("--grizzle", 0.9, float), 0.10, 0.22
W_, H_ = img.size
px = np.empty(W_ * H_ * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(-1, 4)
orig = px.copy()
rgb = px[:, :3]
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
coat = lum < 0.6
v = np.maximum(lum, 1e-4)
lifted = COAT_GAIN * v ** COAT_GAMMA
brown = rgb * (lifted / v)[:, None]
w = np.clip((lum - COAT_GRIZZLE_FROM) / (COAT_GRIZZLE_TO - COAT_GRIZZLE_FROM), 0, 1)
w = (COAT_GREY + (GRIZZLE - COAT_GREY) * w * w * (3 - 2 * w))[:, None]
grey = lifted[:, None] * np.array([0.97, 1.0, 1.04], dtype=np.float32)
out = np.clip(brown * (1 - w) + grey * w, 0, 1)
rgb[coat] = out[coat]
px[:, :3] = rgb
coat_img = bpy.data.images.new("boar-coat", W_, H_, alpha=False)
coat_img.pixels.foreach_set(px.reshape(-1))
coat_img.pack()
diag("coat: value lifted by", COAT_GAIN, "* v **", COAT_GAMMA, "; grey", COAT_GREY, "of it, bristle tips grey from", COAT_GRIZZLE_FROM, "to", COAT_GRIZZLE_TO, "luminance at", GRIZZLE,
     "; median luminance", round(float(np.median(lum[coat])), 3), "->", round(float(np.median((rgb @ np.array([0.2126, 0.7152, 0.0722]))[coat])), 3))

mat, bsdf = principled("Boar")
nt = mat.node_tree
uvn = nt.nodes.new("ShaderNodeUVMap")
uvn.uv_map = UV
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = coat_img
nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
# the tip of the snout (its disc) and the hooves in one plain dark material: they fall on the ramps' dark steps
dark, dark_bsdf = principled("Dark")
dark_bsdf.inputs["Base Color"].default_value = (0.035, 0.028, 0.024, 1.0)
mesh.data.materials.clear()
mesh.data.materials.append(mat)
mesh.data.materials.append(dark)
if coat_img.size[0] > TEX or coat_img.size[1] > TEX:
    k = TEX / max(coat_img.size)
    coat_img.scale(max(1, round(coat_img.size[0] * k)), max(1, round(coat_img.size[1] * k)))
SNOUT_DEPTH = 0.07     # file units back from the tip of the snout: its disc
HOOF_HEIGHT = 0.12     # file units above the floor: the hooves
MW = np.array(mesh.matrix_world)
bind = np.empty(len(mesh.data.vertices) * 3)
mesh.data.vertices.foreach_get("co", bind)
bind = bind.reshape(-1, 3) @ MW[:3, :3].T + MW[:3, 3]
uvd = mesh.data.uv_layers[UV].data
pix = orig.reshape(H_, W_, 4)


def texel_lum(pl):
    u = sum(uvd[li].uv[0] for li in pl.loop_indices) / pl.loop_total
    v_ = sum(uvd[li].uv[1] for li in pl.loop_indices) / pl.loop_total
    c = pix[min(H_ - 1, max(0, int(v_ * H_))), min(W_ - 1, max(0, int(u * W_)))]
    return float(c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722)


front = float(bind[:, 1].max())     # the file's boar faces +Y
floor_z = float(bind[:, 2].min())
snout, hooves, tusks = 0, 0, 0
for pl in mesh.data.polygons:
    ys = [bind[i, 1] for i in pl.vertices]
    zs = [bind[i, 2] for i in pl.vertices]
    if texel_lum(pl) > 0.6:
        tusks += 1
        continue
    if min(ys) > front - SNOUT_DEPTH:
        pl.material_index = 1
        snout += 1
    elif max(zs) < floor_z + HOOF_HEIGHT:
        pl.material_index = 1
        hooves += 1
diag("material Boar on", coat_img.name, tuple(coat_img.size), "packed", coat_img.packed_file is not None, "uv", UV, "uv layers", [u.name for u in mesh.data.uv_layers],
     "; dark:", snout, "faces of the snout's disc and", hooves, "of the hooves;", tusks, "tusk faces (the map's white) left pale")

# ------------------------------------------------------------------ rest pose ('default'), measures
src = {a.name: a for a in bpy.data.actions}
for a in src.values():          # out of the way of the names this pass writes
    a.name = "source " + a.name
BONES = [pb.name for pb in arm.pose.bones]
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
# the tail is posed by hand (its IK target would pin its tip in place while the hips move)
for cn in list(arm.pose.bones["tail.003"].constraints):
    arm.pose.bones["tail.003"].constraints.remove(cn)


def set_action(act):
    arm.animation_data_create()
    arm.animation_data.action = act
    if act is not None and hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None):
        arm.animation_data.action_slot = act.slots[0]


def pose_at(act, f):
    """Every bone's basis (rotation, location, scale) of an action at frame f."""
    set_action(act)
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    scene.frame_set(int(math.floor(f)), subframe=f - math.floor(f))
    out = {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in arm.pose.bones}
    set_action(None)
    return out


def put(pose):
    set_action(None)
    for b, (q, loc, sc) in pose.items():
        pb = arm.pose.bones[b]
        pb.rotation_quaternion, pb.location, pb.scale = q, loc, sc
    bpy.context.view_layer.update()


def world_verts():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = (co.reshape(-1, 3) @ np.array(ev.matrix_world)[:3, :3].T) + np.array(ev.matrix_world)[:3, 3]
    ev.to_mesh_clear()
    return co


REST = pose_at(src["default"], 0)
put(REST)
co = world_verts()
lo, hi = co.min(axis=0), co.max(axis=0)
AW = arm.matrix_world.copy()
shoulder_y = (AW @ arm.data.bones["body.001_L"].head_local).y
band = (np.abs(co[:, 1] - shoulder_y) < 0.25) & (np.abs(co[:, 0] - AW.translation.x) < 0.25)
WITHERS_UNITS = float(co[band, 2].max() - lo[2])
UNIT = HEIGHT / WITHERS_UNITS          # metres a file unit
head_y = (AW @ arm.data.bones["nose"].tail_local).y
hips_y = (AW @ arm.data.bones["Hips"].head_local).y
diag("bind box (units): height", round(float(hi[2] - lo[2]), 3), "length", round(float(hi[1] - lo[1]), 3), "width", round(float(hi[0] - lo[0]), 3),
     "floor", round(float(lo[2]), 3), "withers", round(WITHERS_UNITS, 3), "-> metres a unit", round(UNIT, 4))
diag("facing: snout y", round(head_y, 3), "hips y", round(hips_y, 3), "(faces +Y: turned at the bake)" if head_y > hips_y else "(faces -Y)")
FACES_PLUS_Y = head_y > hips_y
REST_BOX = (lo.copy(), hi.copy())


def m2u(m):
    return m / UNIT


# ------------------------------------------------------------------ tip bones under the hooves
def add_tips(names):
    arm.hide_viewport = False
    arm.hide_set(False)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name in names:
        eb = arm.data.edit_bones[name]
        tip = arm.data.edit_bones.new(name + "_tip")
        tip.head = eb.tail.copy()
        tip.tail = eb.tail + (eb.tail - eb.head).normalized() * max(1e-4, eb.length * 0.25)
        tip.parent = eb
        tip.use_connect = True
        tip.use_deform = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for name in names:
        arm.pose.bones[name + "_tip"].rotation_mode = "QUATERNION"
    diag("tip bones added under", names)


add_tips(HOOVES)
BONES = [pb.name for pb in arm.pose.bones]
REST = {b: REST.get(b, (Quaternion(), Vector(), Vector((1, 1, 1)))) for b in BONES}


# ------------------------------------------------------------------ helpers to build poses (armature axes)
def copy_pose(p):
    return {b: (v[0].copy(), v[1].copy(), v[2].copy()) for b, v in p.items()}


def local_delta(bone, d):
    """An armature-space offset as a location channel of a bone whose parent is unposed (the IK targets and the hips
    hang off ROOT)."""
    return arm.data.bones[bone].matrix_local.to_3x3().inverted() @ Vector(d)


def move(p, bone, d):
    q, loc, sc = p[bone]
    p[bone] = (q, loc + local_delta(bone, d), sc)


def spin(p, bone, axis_arm, deg):
    """Turn a bone's basis by deg degrees about an armature-space axis through the bone (applied in its rest frame)."""
    q, loc, sc = p[bone]
    ax = (arm.data.bones[bone].matrix_local.to_3x3().inverted() @ Vector(axis_arm)).normalized()
    p[bone] = (Quaternion(ax, math.radians(deg)) @ q, loc, sc)


def pitch(p, bone, deg):    # + lifts a forward-pointing bone's tip
    spin(p, bone, (1, 0, 0), deg)


def yaw(p, bone, deg):      # + turns toward the boar's left (-X)
    spin(p, bone, (0, 0, 1), deg)


def roll(p, bone, deg):
    spin(p, bone, (0, 1, 0), deg)


def head_carriage(p, neck=0.0, head=0.0, nose=0.0, turn=0.0):
    pitch(p, "body.002", neck)
    pitch(p, "head", head)
    pitch(p, "nose", nose)
    if turn:
        yaw(p, "body.002", turn * 0.5)
        yaw(p, "head", turn * 0.5)


def tail_carriage(p, side=0.0, lift=0.0):
    for i, b in enumerate(TAIL):
        w = (0.4, 0.8, 1.0, 1.0)[i]
        if lift:
            pitch(p, b, lift * w)
        if side:
            yaw(p, b, side * w)


def body_shift(p, dz=0.0, dy=0.0):
    """Move the whole body (the hips carry the spine and both leg roots), the hooves staying where their targets are."""
    move(p, "Hips", (0, dy, dz))


def body_pitch(p, deg):
    """Pitch the trunk about the hips: + raises the shoulders."""
    pitch(p, "body", deg * 0.5)
    pitch(p, "body.001", deg * 0.5)


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, t)))


def blend_keys(keys, n, f):
    """A pose parameter set at frame f of a looping action of n frames from {frame: value-dict} keys (cosine eased)."""
    fr = sorted(keys)
    f = f % n
    for a, b in zip(fr, fr[1:] + [fr[0] + n]):
        if a <= f <= b:
            t = ease((f - a) / (b - a)) if b > a else 0.0
            va, vb = keys[a], keys[b % n if b % n in keys else fr[0]]
            return {k: va.get(k, 0.0) + (vb.get(k, 0.0) - va.get(k, 0.0)) * t for k in set(va) | set(vb)}
    return dict(keys[fr[0]])


actions = {}


def store(name, poses):
    actions[name] = poses
    diag("action", name, len(poses) - 1, "frames =", round((len(poses) - 1) / FPS, 3), "s")


def hoof_rest(leg):
    return arm.data.bones[LEGS[leg][0]].head_local.copy()   # the IK target's head: the hoof's planted spot at rest


# ------------------------------------------------------------------ Idle
IDLE_KEYS = {
    0: {},
    24: {"breath": 1.0, "nose": 14.0, "head": 6.0, "neck": 3.0},
    48: {"breath": 0.4, "tail_side": 40.0, "tail_lift": 25.0, "head": -2.0},
    72: {"breath": -0.6, "head": -6.0, "neck": -3.0, "turn": 8.0},
}
idle = []
for i in range(IDLE_FRAMES + 1):
    k = blend_keys(IDLE_KEYS, IDLE_FRAMES, i)
    p = copy_pose(REST)
    body_shift(p, dz=m2u(0.008) * k.get("breath", 0.0))
    pitch(p, "body.001", 1.2 * k.get("breath", 0.0))
    head_carriage(p, neck=k.get("neck", 0.0), head=k.get("head", 0.0), nose=k.get("nose", 0.0), turn=k.get("turn", 0.0))
    tail_carriage(p, side=k.get("tail_side", 0.0), lift=k.get("tail_lift", 0.0))
    idle.append(p)
store("Idle", idle)


# ------------------------------------------------------------------ Walk
def swing_y(s, stance, duty, tangent_max):
    """A swinging hoof from behind (-stance/2) to in front (+stance/2): a cubic Hermite that leaves and meets the
    ground at the stance's own speed (up to tangent_max stances per unit of swing)."""
    m = min(stance * (1 - duty) / duty, tangent_max * stance)
    h00, h10, h01, h11 = 2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2
    return h00 * (-stance / 2) + h10 * m + h01 * (stance / 2) + h11 * m


WALK_STANCE = m2u(WALK_STRIDE_M) * WALK_DUTY
walk = []
for i in range(WALK_FRAMES + 1):
    t = i / WALK_FRAMES
    p = copy_pose(REST)
    for leg, (ik, hoof, root) in LEGS.items():
        s0 = WALK_MID[leg] - (1 - WALK_DUTY) / 2
        ph = (t - s0) % 1.0
        if ph < 1 - WALK_DUTY:                  # swing: from behind to in front, lifted
            s = ph / (1 - WALK_DUTY)
            y = swing_y(s, WALK_STANCE, WALK_DUTY, SWING_TANGENT_MAX)
            z = WALK_LIFT * math.sin(math.pi * s)
        else:                                   # stance: from in front to behind at one speed
            s = (ph - (1 - WALK_DUTY)) / WALK_DUTY
            y = WALK_STANCE * (0.5 - s)
            z = 0.0
        move(p, ik, (0, y + m2u(WALK_CENTRE[leg]), z))
    body_shift(p, dz=-m2u(WALK_CROUCH))
    head_carriage(p, neck=WALK_HEAD * 0.6, head=WALK_HEAD * 0.4)
    tail_carriage(p, lift=-5.0, side=6.0 * math.sin(2 * math.pi * t))
    walk.append(p)
store("Walk", walk)

# ------------------------------------------------------------------ Run
RUN_STANCE = m2u(RUN_STRIDE_M) * RUN_DUTY
run = []
for i in range(RUN_FRAMES + 1):
    t = i / RUN_FRAMES
    p = copy_pose(REST)
    for leg, (ik, hoof, root) in LEGS.items():
        ph = (t - RUN_DOWN[leg] - RUN_PHASE) % 1.0   # from the touchdown
        fore = leg.endswith("F")
        if ph < RUN_DUTY:                       # stance: in front to behind at one speed
            s = ph / RUN_DUTY
            y = RUN_STANCE * (0.5 - s)
            z = 0.0
        else:                                   # swing: behind to in front, lifted
            s = (ph - RUN_DUTY) / (1 - RUN_DUTY)
            y = swing_y(s, RUN_STANCE, RUN_DUTY, RUN_TANGENT_MAX)
            z = RUN_LIFT * (RUN_FORE_LIFT if fore else 1.0) * math.sin(math.pi * s) ** RUN_LIFT_SHAPE
        move(p, ik, (0, y + m2u(RUN_CENTRE[leg]), z))
    bob = -RUN_BOB * math.cos(2 * math.pi * (t - 0.6 - RUN_PHASE))
    body_shift(p, dz=m2u(bob) - m2u(RUN_CROUCH))
    body_pitch(p, RUN_PITCH * math.sin(2 * math.pi * (t - 0.35 - RUN_PHASE)))
    head_carriage(p, neck=RUN_HEAD * 0.6, head=RUN_HEAD * 0.4)
    tail_carriage(p, lift=20.0, side=0.0)
    run.append(p)
store("Run", run)

# ------------------------------------------------------------------ Alert (the bluff)
# four key poses (frames 0, 12, 24, 36): head low toward the front with the forelegs braced; the snort, the snout
# driven lower and forward; the toss, the head flung up; the stamp, the left forefoot lifted with the head low again
ALERT_KEYS = {
    0: {"neck": -16.0, "head": -10.0, "nose": 4.0, "brace": 1.0, "lean": -0.03},
    12: {"neck": -22.0, "head": -14.0, "nose": 8.0, "brace": 1.0, "lean": -0.05, "tail": 30.0},
    24: {"neck": 6.0, "head": 14.0, "nose": -4.0, "brace": 1.0, "lean": -0.01, "tail": 30.0, "turn": 10.0},
    36: {"neck": -16.0, "head": -10.0, "nose": 4.0, "brace": 1.0, "lean": -0.03, "stamp": 1.0},
}
alert = []
for i in range(ALERT_FRAMES + 1):
    k = blend_keys(ALERT_KEYS, ALERT_FRAMES, i)
    p = copy_pose(REST)
    for leg in ("LF", "RF"):
        move(p, LEGS[leg][0], (m2u(0.03) * (-1 if leg == "LF" else 1) * k.get("brace", 0.0), m2u(0.08) * k.get("brace", 0.0), 0))
    stamp = k.get("stamp", 0.0)
    move(p, LF[0], (0, m2u(0.02) * stamp, m2u(0.09) * math.sin(math.pi * min(1.0, stamp))))
    body_shift(p, dz=-m2u(0.03), dy=m2u(k.get("lean", 0.0)))
    body_pitch(p, -4.0 * k.get("brace", 0.0))
    head_carriage(p, neck=k.get("neck", 0.0), head=k.get("head", 0.0), nose=k.get("nose", 0.0), turn=k.get("turn", 0.0))
    tail_carriage(p, lift=k.get("tail", 0.0))
    alert.append(p)
store("Alert", alert)

# ------------------------------------------------------------------ Graze (rooting)
GRAZE_KEYS = {
    0: {"neck": -34.0, "head": -22.0, "nose": 4.0, "push": 0.0, "fore": 0.04},
    12: {"neck": -30.0, "head": -26.0, "nose": 6.0, "push": 1.0, "fore": 0.04},
    24: {"neck": -22.0, "head": -12.0, "nose": -6.0, "push": 0.6, "fore": 0.04},
    36: {"neck": -6.0, "head": 4.0, "nose": -4.0, "push": 0.0, "fore": 0.02, "turn": 14.0, "tail": 25.0},
}
def graze_pose(k, m=1.0):
    """One rooting pose from a key's values; m scales how far the neck and the head bend down."""
    p = copy_pose(REST)
    for leg in ("LF", "RF"):
        move(p, LEGS[leg][0], (0, m2u(k.get("fore", 0.0)), 0))
    body_shift(p, dz=-m2u(0.03), dy=m2u(0.04) * k.get("push", 0.0))
    body_pitch(p, -5.0 - 2.0 * k.get("push", 0.0))
    head_carriage(p, neck=k.get("neck", 0.0) * m, head=k.get("head", 0.0) * m, nose=k.get("nose", 0.0), turn=k.get("turn", 0.0))
    tail_carriage(p, lift=k.get("tail", 0.0))
    return p


def snout_low(p):
    """How far the lowest point of the head sits above the floor the hooves stand on (units)."""
    put(p)
    c = world_verts()
    head = c[:, 1] > shoulder_y + 0.4 if FACES_PLUS_Y else c[:, 1] < shoulder_y - 0.4
    return float(c[head, 2].min() - REST_BOX[0][2])


# the snout pushes into the ground but never below the hooves' floor (the renderer stands each pose on its lowest
# point, so a snout below the floor would lift the hooves off it): each key's neck and head bend is scaled to touch it
SNOUT_TOUCH = m2u(0.003)
for f, k in GRAZE_KEYS.items():
    if snout_low(graze_pose(k)) >= SNOUT_TOUCH:
        continue
    a, b = 0.0, 1.0
    for _ in range(24):
        m = (a + b) / 2
        a, b = (m, b) if snout_low(graze_pose(k, m)) >= SNOUT_TOUCH else (a, m)
    for key in ("neck", "head"):
        k[key] = round(k[key] * a, 2)
    diag("graze key", f, "neck and head bend scaled by", round(a, 3), "-> neck", k["neck"], "head", k["head"])
graze = [graze_pose(blend_keys(GRAZE_KEYS, GRAZE_FRAMES, i)) for i in range(GRAZE_FRAMES + 1)]
store("Graze", graze)

# ------------------------------------------------------------------ Lie
p = copy_pose(REST)
put(p)
goals = {}
for leg, (ik, hoof, root) in LEGS.items():
    f = arm.pose.bones[ik].matrix.translation.copy()
    r = arm.pose.bones[root].head.copy()
    goals[ik] = f + (r - f) * LIE_TUCK
for ik, g in goals.items():
    move(p, ik, tuple(g - arm.pose.bones[ik].matrix.translation))
head_carriage(p, neck=-6.0, head=-4.0)
tail_carriage(p, lift=-10.0, side=20.0)
# rolled onto its left side about the long axis through the middle of the body, the body brought back to the floor
pivot = Vector((AW.inverted() @ Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))))
R = Matrix.Rotation(math.radians(-LIE_ROLL), 4, "Y")
q, loc, sc = p["ROOT"]
rest_root = arm.data.bones["ROOT"].matrix_local
posed = Matrix.Translation(pivot) @ R @ Matrix.Translation(-pivot) @ rest_root
basis = rest_root.inverted() @ posed
p["ROOT"] = (basis.to_quaternion() @ q, loc + basis.to_translation(), sc)
# the roll carries the body off its spot and through the floor: bring it back over where it stood, on the floor
put(p)
c = world_verts()
rest_c = (REST_BOX[0] + REST_BOX[1]) / 2
move(p, "ROOT", (float(rest_c[0] - (c[:, 0].min() + c[:, 0].max()) / 2), float(rest_c[1] - (c[:, 1].min() + c[:, 1].max()) / 2), float(REST_BOX[0][2] - c[:, 2].min())))
lie = [p for _ in range(LIE_FRAMES + 1)]
store("Lie", lie)

# ------------------------------------------------------------------ Charge (the file's attack)
att = src["attack"]
a0, a1 = (int(round(v)) for v in att.frame_range)
charge = [pose_at(att, f) for f in range(a0, a1 + 1)]
for cp in charge:
    for b in BONES:
        cp.setdefault(b, REST[b])
store("Charge", charge)


# ------------------------------------------------------------------ bake the IK: armature-space matrices per frame
def evaluate(pose):
    put(pose)
    return {b: arm.pose.bones[b].matrix.copy() for b in BONES}


baked = {name: [evaluate(p) for p in poses] for name, poses in actions.items()}
diag("evaluated with the IK:", {k: len(v) for k, v in baked.items()})

# drop the constraints and the IK targets
for pb in arm.pose.bones:
    for cn in list(pb.constraints):
        pb.constraints.remove(cn)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name in TARGETS + [TAIL_TARGET]:
    arm.data.edit_bones.remove(arm.data.edit_bones[name])
bpy.ops.object.mode_set(mode="OBJECT")
BONES = [pb.name for pb in arm.pose.bones]
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
diag("dropped the IK targets and every constraint; bones now", len(BONES))

ORDER = []
for b in arm.data.bones:            # parents first
    chain = []
    x = b
    while x is not None:
        chain.append(x.name)
        x = x.parent
    ORDER.append((len(chain), b.name))
ORDER = [n for _, n in sorted(ORDER)]


def basis_from(mats):
    """The local basis of each bone that gives these armature-space matrices (parent chain taken from mats)."""
    out = {}
    for b in ORDER:
        bone = arm.data.bones[b]
        rest = bone.matrix_local
        if bone.parent is None:
            m = rest.inverted() @ mats[b]
        else:
            prest = bone.parent.matrix_local
            m = (mats[bone.parent.name] @ prest.inverted() @ rest).inverted() @ mats[b]
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
        bas = basis_from(mats)
        for b, (q, loc, sc) in bas.items():
            if b in prev and prev[b].dot(q) < 0:   # keep the quaternions on one side, so the curve takes the short way
                q = -q
            prev[b] = q
            pb = arm.pose.bones[b]
            pb.rotation_quaternion, pb.location, pb.scale = q, loc, sc
            pb.keyframe_insert("rotation_quaternion", frame=i)
            pb.keyframe_insert("location", frame=i)
            pb.keyframe_insert("scale", frame=i)
    final.append(act)
    # check: the baked action plays the evaluated hooves
    for i in (0, len(frames) // 3, len(frames) - 1):
        scene.frame_set(i)
        for h in HOOVES:
            worst = max(worst, (arm.pose.bones[h].tail - (frames[i][h] @ Vector((0, arm.data.bones[h].length, 0))).to_3d()).length)
    set_action(None)
diag("baked to bone keys:", [(a.name, tuple(a.frame_range)) for a in final], "worst hoof error", round(worst * UNIT * 1000, 3), "mm")
for a in list(bpy.data.actions):
    if a not in final:
        bpy.data.actions.remove(a)
# the renderer sets each pose on its lowest vertex: say where the lowest vertex is against the lowest hoof
for act in final:
    set_action(act)
    f0, f1 = (int(round(v)) for v in act.frame_range)
    rows = []
    for f in sorted({f0, f0 + (f1 - f0) // 4, f0 + (f1 - f0) // 2, f0 + 3 * (f1 - f0) // 4}):
        scene.frame_set(f)
        c = world_verts()
        hz = min((arm.matrix_world @ arm.pose.bones[h].tail).z for h in HOOVES)
        rows.append((f, round((float(c[:, 2].min()) - hz) * UNIT * 100, 1)))
    diag("lowest vertex minus lowest hoof (cm) at the drawn frames", act.name, rows)
    set_action(None)


# ------------------------------------------------------------------ how fast each gait carries the body; the feet
def ground_speed(act):
    set_action(act)
    f0, f1 = (int(round(v)) for v in act.frame_range)
    speeds, duty = [], []
    for h in HOOVES:
        pts = []
        for f in range(f0, f1 + 1):
            scene.frame_set(f)
            pts.append(arm.pose.bones[h].tail.copy())
        z = np.array([q.z for q in pts])
        y = np.array([q.y for q in pts])
        planted = z <= z.min() + 0.02
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
    mean = float(np.mean(sp)) * UNIT
    act["groundSpeed"] = round(mean, 3)
    diag("ground speed", act.name, round(mean, 3), "m/s; ground a cycle", round(mean * (act.frame_range[1] - act.frame_range[0]) / FPS, 3), "m; duty", duty)


# ------------------------------------------------------------------ the turn to -Y, the centre and the scale, baked into the data
put({b: (Quaternion(), Vector(), Vector((1, 1, 1))) for b in BONES})
co = world_verts()
lo, hi = co.min(axis=0), co.max(axis=0)
T = Matrix.Translation((-float((lo[0] + hi[0]) / 2), -float((lo[1] + hi[1]) / 2), -float(lo[2])))
turn = Matrix.Rotation(math.pi, 4, "Z") if FACES_PLUS_Y else Matrix.Identity(4)
arm.matrix_world = Matrix.Scale(UNIT, 4) @ turn @ T @ arm.matrix_world
bpy.context.view_layer.update()


def bake_object_transforms(arm_, mesh_):
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    set_action(None)
    for pb in arm_.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
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
    bpy.context.view_layer.objects.active = arm_
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
    bpy.context.view_layer.update()
    n = 0
    for act in bpy.data.actions:
        for fc in all_fcurves(act):
            if fc.data_path.startswith("pose.bones") and fc.data_path.endswith("location"):
                for kp in fc.keyframe_points:
                    kp.co.y *= k_
                    kp.handle_left.y *= k_
                    kp.handle_right.y *= k_
                n += 1
    diag("baked the object transforms: scale", round(k_, 5), "and the turn into", len(arm_.data.bones), "bones and", len(me.vertices), "vertices;", n,
         "location channels scaled")


bake_object_transforms(arm, mesh)
co = world_verts()
lo, hi = co.min(axis=0), co.max(axis=0)
nose = arm.pose.bones["nose"].tail
diag("box now (m): height", round(float(hi[2] - lo[2]), 3), "length", round(float(hi[1] - lo[1]), 3), "width", round(float(hi[0] - lo[0]), 3),
     "floor", round(float(lo[2]), 4), "snout y", round(nose.y, 3), "(faces -Y)" if nose.y < 0 else "WARNING: not facing -Y")
diag("object transforms", tuple(round(v, 4) for v in arm.matrix_world.to_translation()), tuple(round(v, 4) for v in arm.matrix_world.to_scale()),
     tuple(round(v, 4) for v in mesh.matrix_world.to_scale()))

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
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(**kw)
diag("wrote", OUT, "options skipped", sorted(set(want) - set(kw)))
