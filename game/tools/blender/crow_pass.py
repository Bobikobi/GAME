"""Make a game-ready crow from the CC0 "Raven" by Teh_Bucket (OpenGameArt, raven.blend, Blender 2.74).

Run:  blender -b --factory-startup -P crow_pass.py -- <raven.blend> <out.glb> [--height 0.3] [--tex 1024]

What it does, in the manner of game/tools/blender/quad_pass.py (the wolf):
- keeps the mesh and the armature, applies the mirror and edge-split modifiers (one whole mesh for the skin),
- rebuilds the material as a Principled BSDF with the packed colour map (the Blender Internal material of 2.74 does
  not survive),
- turns the body to face -Y and scales it to --height metres standing,
- the file has one standing pose and a 34-frame flight. From them it makes three clips:
    Idle  144 frames: breath, a head turn, a head bob and a tail flick (poses chosen so four even frames differ);
    Hop   12 frames : six frames on the ground (both feet planted, swinging back under the body along a straight
                      line, the body riding the arc of the legs) and six in the air (legs swing forward, a small
                      wing flare), looping;
    Lift  36 frames : stand, crouch, spring with the wings opening, wings at the top of the stroke;
  and keeps the flight as Fly. The tail is held up a little in every clip so the bird stands on its feet, not on
  its tail tip (the sprite renderer grounds each pose on the body's lowest point).
  Three held poses for the hunt's states, two poses at most (a bird's idle budget):
    Alert 48 frames : standing tall, the head up; then a tail flick with the head turned a little;
    Peck  24 frames : tipped forward, the beak solved onto the floor; then the head part way back up;
    Lie   24 frames : on its side, the legs tucked back, the wings closed: one pose, held.
- caps every map at --tex pixels and exports one GLB with the clips on NLA tracks.
Prints one DIAG line per fact.
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
HEIGHT = float(argv[argv.index("--height") + 1]) if "--height" in argv else 0.3
TEX = int(argv[argv.index("--tex") + 1]) if "--tex" in argv else 1024
FPS = 24
TAIL_UP = 14.0        # degrees, every clip
LEG_L, LEG_R = "leg.L", "leg.R"
TOES = ["toe.L", "toe.R"]
LEG_CHAIN = {"leg.L", "leg.R", "leg.001.L", "leg.001.R", "toe.L", "toe.R", "toe.001.L", "toe.001.R", "toe.002.L", "toe.002.R", "toe.003.L", "toe.003.R"}
HEAD, BODY, ROOTB = "Bone", "Bone.001", "ROOT"
TAIL_BONES = ["Bone.004", "Bone.005"]
ALERT_PITCH, ALERT_HEAD, ALERT_TAIL, ALERT_FLICK = -32.0, -10.0, 56.0, 24.0   # degrees; negative pitch = nose up
PECK_PITCH, PECK_BODY, PECK_HEAD = 50.0, 30.0, 40.0   # degrees at the full reach: body, chest and head tipped forward
PECK_CLEAR = 0.002                    # metres between the beak and the floor
PECK_UP = 0.6                         # the second pose: the reach at this share of the first (the head comes up)
LIE_ROLL, LIE_LEGS, LIE_KNEE = 90.0, -85.0, 0.0   # degrees: on its side, the legs tucked back along the body
LIE_YAW = 22.0                        # degrees: the lying body turned across every view, so its length reads


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


bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = FPS
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers))
for o in list(bpy.data.objects):
    if o not in (arm, mesh):
        bpy.data.objects.remove(o, do_unlink=True)
diag("kept", [o.name for o in bpy.data.objects], "raw verts", len(mesh.data.vertices), "modifiers", [m.type for m in mesh.modifiers])

# ------------------------------------------------------------------ one whole mesh: apply everything but the armature
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
for m in list(mesh.modifiers):
    if m.type == "ARMATURE":
        continue
    with bpy.context.temp_override(object=mesh, active_object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh]):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:  # noqa: BLE001
            diag("could not apply", m.type, e)
left = [m.type for m in mesh.modifiers]
if left != ["ARMATURE"]:
    raise SystemExit(f"a modifier did not apply, the mesh would ship in halves: {left}")
arm.data.pose_position = "POSE"
diag("mesh after apply: verts", len(mesh.data.vertices), "tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons), "modifiers", [m.type for m in mesh.modifiers])


# ------------------------------------------------------------------ tip bones under the feet
# The clip renderer takes a foot as the TAIL of the contact bone, and the glTF importer guesses a leaf bone's tail
# (its length is lost in glTF). A small child bone at each foot's tip makes the foot bone's tail exact on import.
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
    diag("tip bones added under", names)

add_tips(["toe.L", "toe.R"])

# ------------------------------------------------------------------ material
img = None
for cand in ("raven", "raven.png"):
    if cand in bpy.data.images:
        img = bpy.data.images[cand]
if img is None:
    for im in bpy.data.images:
        if im.type == "IMAGE" and im.size[0] >= 256:
            img = im
mat = bpy.data.materials.new("Crow")
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Roughness"].default_value = 0.9
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
if img is not None:
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    hsv = nt.nodes.new("ShaderNodeHueSaturation")   # much lighter: the map is near black, and a 20 px crow needs its lit side in the mid greys to read as a body, not a hole
    hsv.inputs["Saturation"].default_value = 0.4
    hsv.inputs["Value"].default_value = 2.8
    nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])
    nt.links.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
    diag("material: colour map", img.name, tuple(img.size), "packed", img.packed_file is not None)
else:
    bsdf.inputs["Base Color"].default_value = (0.16, 0.16, 0.19, 1.0)
    diag("material: no colour map found, flat dark")
mesh.data.materials.clear()
mesh.data.materials.append(mat)
for im in bpy.data.images:
    if im.type == "IMAGE" and (im.size[0] > TEX or im.size[1] > TEX):
        k = TEX / max(im.size)
        im.scale(max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k)))
        diag("map", im.name, "cut to", tuple(im.size))

# ------------------------------------------------------------------ the two source poses: stand (one frame) and fly (0..34)
acts = {a.name: a for a in bpy.data.actions}
stand, fly = acts["stand"], acts["fly"]
bones = [pb.name for pb in arm.pose.bones]
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"


def use(action):
    arm.animation_data_create()
    arm.animation_data.action = action
    if hasattr(arm.animation_data, "action_slot") and getattr(action, "slots", None) is not None and len(action.slots):
        arm.animation_data.action_slot = action.slots[0]


def grab():
    return {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in arm.pose.bones}


use(stand)
scene.frame_set(0)
BASE = grab()
FLY = {}
use(fly)
for f in range(0, 35):
    scene.frame_set(f)
    FLY[f] = grab()
arm.animation_data.action = None
diag("source poses: stand keyed", len(BASE), "bones; fly frames", len(FLY))

# ------------------------------------------------------------------ facing, scale, ground
def put(pose):
    for pb in arm.pose.bones:
        q, l, s = pose[pb.name]
        pb.rotation_quaternion, pb.location, pb.scale = q, l, s
    bpy.context.view_layer.update()


def box():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = (co.reshape(-1, 3) @ np.array(ev.matrix_world)[:3, :3].T) + np.array(ev.matrix_world)[:3, 3]
    ev.to_mesh_clear()
    return co.min(axis=0), co.max(axis=0)


put(BASE)
beak_y = (arm.matrix_world @ arm.pose.bones[HEAD].tail).y
tail_y = (arm.matrix_world @ arm.pose.bones["Bone.005"].tail).y
diag("facing before: beak y", round(beak_y, 3), "tail y", round(tail_y, 3))
if beak_y > tail_y:
    arm.matrix_world = Matrix.Rotation(math.pi, 4, "Z") @ arm.matrix_world
    diag("turned 180 degrees about Z: the beak now points -Y")
bpy.context.view_layer.update()
lo, hi = box()
H0 = float(hi[2] - lo[2])
k = HEIGHT / H0
arm.matrix_world = Matrix.Scale(k, 4) @ arm.matrix_world
bpy.context.view_layer.update()
diag("stand box before (units): height", round(H0, 3), "length", round(float(hi[1] - lo[1]), 3), "width", round(float(hi[0] - lo[0]), 3))
diag("scaled by", round(k, 5), "to", HEIGHT, "m standing")
A3 = arm.matrix_world.to_3x3()
A3I = A3.inverted()
RA = arm.matrix_world.to_quaternion()


def toe_z():
    return min((arm.matrix_world @ arm.pose.bones[t].tail).z for t in TOES)


def rot_world(name, q_world):
    """rotate a bone about its head, the axis given in world space, on top of its current pose"""
    pb = arm.pose.bones[name]
    q_arm = (RA.inverted() @ q_world @ RA).normalized()
    head = pb.head.copy()
    pb.matrix = Matrix.Translation(head) @ q_arm.to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
    bpy.context.view_layer.update()


def shift_root(d_world):
    pb = arm.pose.bones[ROOTB]
    pb.matrix = Matrix.Translation(A3I @ Vector(d_world)) @ pb.matrix
    bpy.context.view_layer.update()


def rot_x(deg):   # positive = nose down for a body facing -Y
    return Quaternion((1, 0, 0), math.radians(deg))


def rot_y(deg):
    return Quaternion((0, 1, 0), math.radians(deg))


def rot_z(deg):   # positive turns the beak toward +X (the bird's left)
    return Quaternion((0, 0, 1), math.radians(deg))


def blend(a, b, w):
    out = {}
    for n in bones:
        qa, la, sa = a[n]
        qb, lb, sb = b[n]
        out[n] = (qa.slerp(qb, w) if w > 0 else qa.copy(), la.lerp(lb, w), sa.lerp(sb, w))
    return out


# the standing pose with the tail held up: the ground of every clip is where its toes are
put(BASE)
for tb in TAIL_BONES:
    rot_world(tb, rot_x(TAIL_UP / len(TAIL_BONES)))   # positive rot_x lifts what lies behind the body
STAND = grab()
put(STAND)
GROUND = toe_z()
hip = arm.matrix_world @ arm.pose.bones[LEG_L].head
ankle = arm.matrix_world @ arm.pose.bones["leg.001.L"].tail
LA = math.hypot(ankle.y - hip.y, ankle.z - hip.z)
PSI0 = math.atan2(-(ankle.y - hip.y), hip.z - ankle.z)    # the leg's angle from vertical (hip to ankle), positive = forward (toward -Y)
TOE_BONES = [b for b in bones if b.startswith("toe.")]   # the two _tip bones ride along: non-deform, and a foot is read
                                                        # at the tip's head, which the counter-turn does not move
PARTS = {"toe.L tail": ("toe.L", "tail"), "heel.L (toe.003 tail)": ("toe.003.L", "tail"), "wing tip L": ("Bone.001_L.005", "tail"), "wing tip R": ("Bone.001_R.005", "tail"), "tail tip": ("Bone.005", "tail"), "beak": (HEAD, "tail")}


def lowest():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = (co.reshape(-1, 3) @ np.array(ev.matrix_world)[:3, :3].T) + np.array(ev.matrix_world)[:3, 3]
    ev.to_mesh_clear()
    i = int(co[:, 2].argmin())
    return tuple(round(float(v), 4) for v in co[i])


def parts():
    out = {}
    for label, (bn, end) in PARTS.items():
        if bn in arm.pose.bones:
            p = arm.matrix_world @ getattr(arm.pose.bones[bn], end)
            out[label] = round(p.z, 4)
    return out


diag("stand: ground (toe tail z)", round(GROUND, 4), "body lowest point (x, y, z)", lowest(), "(y > 0 is behind the body); hip-to-ankle", round(LA, 4), "m, leg angle forward", round(math.degrees(PSI0), 1), "deg; parts z", parts())


def ground(lift=0.0):
    shift_root((0, 0, GROUND + lift - toe_z()))


# sign check of the leg swing: a positive rot_x on the hip must carry the ankle toward +Y (back) or -Y (forward)?
put(STAND)
rot_world(LEG_L, rot_x(20))
ay = (arm.matrix_world @ arm.pose.bones["leg.001.L"].tail).y
put(STAND)
ay0 = (arm.matrix_world @ arm.pose.bones["leg.001.L"].tail).y
SWING_SIGN = -1.0 if ay < ay0 else 1.0     # rot_x(+SWING_SIGN * deg) carries the foot back
diag("leg swing: rot_x(+20) moves the ankle y", round(ay0, 4), "->", round(ay, 4), "; SWING_SIGN", SWING_SIGN)


def legs_to(psi, knee=0.0):
    """swing both legs about the hips to `psi` from vertical (hip to ankle, positive = forward) with a knee bend; the
    feet are counter-rotated at the ankle so the sole stays level (the sole is the body's lowest point)"""
    d = math.degrees(psi - PSI0)          # positive: the foot goes forward
    for leg in (LEG_L, LEG_R):
        rot_world(leg, rot_x(-SWING_SIGN * d))
    kd = math.degrees(knee)
    if knee:
        for kn in ("leg.001.L", "leg.001.R"):
            rot_world(kn, rot_x(SWING_SIGN * kd))   # the shank swings back under the body
    for tb in TOE_BONES:
        rot_world(tb, rot_x(SWING_SIGN * (d - kd)))


def new_action(name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None) is not None:
        slot = act.slots.new(id_type="OBJECT", name=arm.name) if len(act.slots) == 0 else act.slots[0]
        arm.animation_data.action_slot = slot
    return act


def key_all(frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("scale", frame=frame)


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, t)))


# ------------------------------------------------------------------ Idle: 144 frames (6 s), keyed every 3 frames
idle = new_action("Idle")
for f in range(0, 145, 3):
    s = f / FPS
    put(STAND)
    breath = math.cos(2 * math.pi * s / 3)
    look = math.sin(2 * math.pi * s / 6)
    rot_world(BODY, rot_x(1.5 * breath))
    rot_world(HEAD, rot_z(18 * look) @ rot_x(6 * breath))
    for tb in TAIL_BONES:
        rot_world(tb, rot_x(4 * math.cos(2 * math.pi * s / 2)))
    ground()
    key_all(f)
    if f in (0, 36, 72, 108):
        diag("Idle frame", f, "lowest", lowest(), "toes", round(toe_z(), 4))
diag("Idle 144 frames: breath 3 s (cosine, so the even poses sit on its extremes), head turn 6 s, head bob with the breath, tail 2 s")

# ------------------------------------------------------------------ Hop: 12 frames, loops
hop = new_action("Hop")
N_HOP, N_STANCE = 12, 6
# straight legs swing from 35 degrees forward to 35 degrees back about the hip (the ankle's angle), the sole level:
# the body rides the arc (lowest at the landing and the push, highest mid-stance) and the heel stays its lowest point
PSI_LAND, PSI_OFF = math.radians(35), math.radians(-35)
toe_track = []


def hop_frame(i):
    """the hop's pose at frame i before the legs' swing; returns (psi guess, knee, lift)"""
    put(STAND)
    if i < N_STANCE:   # on the ground: the body level, the legs do the work
        u = i / (N_STANCE - 1)
        psi = PSI_LAND + (PSI_OFF - PSI_LAND) * u
        pitch, knee, wing, lift = 0.0, 0.0, 0.0, 0.0
    else:              # in the air: legs swing forward for the next landing, a small wing flare, nose up, the body on an arc
        u = (i - N_STANCE + 1) / (N_HOP - N_STANCE + 1)
        psi = PSI_OFF + (PSI_LAND - PSI_OFF) * ease(u)
        pitch = -6 * math.sin(math.pi * u)
        knee = math.radians(6) * math.sin(math.pi * u)
        wing = 0.18 * math.sin(math.pi * min(1.0, u * 1.4))
        lift = 0.18 * HEIGHT * math.sin(math.pi * u)
    if wing > 0:
        put(blend(STAND, FLY[8], wing) | {n: STAND[n] for n in bones if n in LEG_CHAIN or n in (ROOTB, HEAD, BODY)})
    if pitch:
        rot_world(ROOTB, rot_x(pitch))
        rot_world(HEAD, rot_x(-pitch * 0.7))
    return psi, knee, lift


def toe_y():
    return (arm.matrix_world @ arm.pose.bones["toe.L"].tail).y


# the planted toes travel back in equal steps of world y between the landing mark and the push-off mark (both measured,
# so both are reachable); each stance frame between solves its leg angle to sit on its mark
hop_frame(0)
legs_to(PSI_LAND)
y_land = toe_y()
hop_frame(N_STANCE - 1)
legs_to(PSI_OFF)
y_off = toe_y()
STRIDE = y_off - y_land
for f in range(0, N_HOP + 1):
    i = f % N_HOP
    psi, knee, lift = hop_frame(i)
    if 0 < i < N_STANCE - 1:
        target = y_land + STRIDE * i / (N_STANCE - 1)
        for _ in range(8):
            hop_frame(i)
            legs_to(psi, knee)
            err = toe_y() - target          # positive: the toe is behind its mark; a larger psi carries it forward
            if abs(err) < 1e-5:
                break
            psi += err / max(1e-6, LA * math.cos(psi))
    hop_frame(i)
    legs_to(psi, knee)
    ground(lift)
    key_all(f)
    t = arm.matrix_world @ arm.pose.bones["toe.L"].tail
    toe_track.append((f, round(t.y, 4), round(t.z, 4)))
    if f in (0, 3, 6, 9):
        diag("Hop frame", f, "lowest", lowest(), "toes", round(toe_z(), 4), "parts z", parts())
diag("Hop 12 frames, stance 0-5: toe.L tail (f, y, z)", toe_track)
stance_y = [y for f, y, z in toe_track[:N_STANCE]]
steps = [round(stance_y[i + 1] - stance_y[i], 4) for i in range(N_STANCE - 1)]
stride = stance_y[-1] - stance_y[0]
diag("Hop stride", round(abs(stride), 4), "m a hop; stance steps (m/frame)", steps, "ground speed", round(abs(stride) / (N_HOP / FPS), 3), "m/s")
hop["groundSpeed"] = round(abs(stride) / (N_HOP / FPS), 3)

# ------------------------------------------------------------------ Lift: 36 frames, one-shot (poses 0, 9, 18, 27 when drawn at four)
lift_a = new_action("Lift")
PSI_CROUCH, PSI_SPRING = math.radians(22), math.radians(-22)
for f in range(0, 37):
    put(STAND)
    if f <= 9:                      # stand -> crouch, head forward and down
        u = ease(f / 9)
        psi = PSI0 + (PSI_CROUCH - PSI0) * u
        knee = math.radians(10) * u
        pitch = 10 * u
        head = 8 * u
        wing_w, wing_f = 0.0, 0
        rise = 0.0
    elif f <= 18:                   # spring: legs extend back, body pitches up, wings open toward the top of the stroke
        u = ease((f - 9) / 9)
        psi = PSI_CROUCH + (PSI_SPRING - PSI_CROUCH) * u
        knee = math.radians(10) * (1 - u)
        pitch = 10 - 28 * u
        head = 8 - 18 * u
        wing_w, wing_f = 0.75 * u, 0
        rise = 0.0
    elif f <= 27:                   # wings reach the top, the body leans into the climb
        u = ease((f - 18) / 9)
        psi = PSI_SPRING
        knee = 0.0
        pitch = -18 - 6 * u
        head = -10 + 4 * u
        wing_w, wing_f = 0.75 + 0.25 * u, 0
        rise = 0.12 * HEIGHT * u
    else:                           # the first downstroke (the wings stay above the feet)
        u = ease((f - 27) / 9)
        psi = PSI_SPRING
        knee = 0.0
        pitch = -24
        head = -6
        wing_w, wing_f = 1.0, min(5, round(5 * u))
        rise = 0.12 * HEIGHT + 0.25 * HEIGHT * u
    if wing_w > 0:
        put(blend(STAND, FLY[wing_f], wing_w) | {n: STAND[n] for n in bones if n in LEG_CHAIN or n == ROOTB})
    rot_world(ROOTB, rot_x(pitch))
    rot_world(HEAD, rot_x(head - pitch * 0.5))
    legs_to(psi, knee)
    ground(rise)
    key_all(f)
    if f in (0, 9, 18, 27):
        diag("Lift frame", f, "lowest", lowest(), "toes", round(toe_z(), 4), "parts z", parts())
diag("Lift 36 frames: crouch to 9, spring to 18, wings at the top at 27, first downstroke to 36")

# ------------------------------------------------------------------ the hunt's held poses: Alert, Peck, Lie
# Two poses at most a verb (a bird's idle budget), keyed on the frames a clip draws evenly, the loop closed on the
# first. A body pitch is matched by swinging the legs the same amount, so the feet stay under the body.


def pitched(pitch, head=0.0, tail=0.0):
    """the stand with the body pitched (positive = nose down), the head turned further, the tail lifted, feet under it"""
    put(STAND)
    rot_world(ROOTB, rot_x(pitch))
    if head:
        rot_world(HEAD, rot_x(head))
    for tb in TAIL_BONES:
        rot_world(tb, rot_x(tail / len(TAIL_BONES)))
    legs_to(PSI0 + math.radians(pitch))
    for tb in TOE_BONES:            # legs_to levels the soles against the stand; take the body's pitch off them too
        rot_world(tb, rot_x(-pitch))


def held(name, length, poses):
    act = new_action(name)
    n = len(poses)
    for i in range(n + 1):
        poses[i % n]()
        key_all(round(length * i / n))
    return act


# Alert: standing tall (the body raised toward upright, the head up), then the same with a tail flick and the head
# turned a little. HUNTING 2: the head-up tell.
def alert_pose(flick):
    def f():
        pitched(ALERT_PITCH, ALERT_HEAD, ALERT_TAIL + (ALERT_FLICK if flick else 0.0))
        if flick:
            rot_world(HEAD, rot_z(15))
        ground()
    return f


alert = held("Alert", 48, [alert_pose(False), alert_pose(True)])
alert_pose(False)()
diag("Alert 48 frames, two poses: body", ALERT_PITCH, "deg, head", ALERT_HEAD, "deg, tail", ALERT_TAIL, "then a flick of", ALERT_FLICK, "deg and the head turned 15; lowest", lowest(), "toes", round(toe_z(), 4))


# Peck: the body tipped forward and the head down, the beak solved onto the floor (never below the feet: the
# renderer grounds the lowest point), then the head half up between pecks.
def beak_z():
    return (arm.matrix_world @ arm.pose.bones[HEAD].tail).z


def peck_reach(s):
    """the peck at a share s of the full reach: body, chest and head tipped forward together, the feet under it"""
    pitched(PECK_PITCH * s, PECK_HEAD * s, PECK_PITCH * s * 0.5)
    rot_world(BODY, rot_x(PECK_BODY * s))
    ground()


def peck_pose(share):
    """the beak on the floor (share 1), or the head part way back up (the reach at that share of it)"""
    def f():
        lo_s, hi_s = 0.0, 1.0
        for _ in range(24):          # bisect the reach until the beak meets the floor
            s = 0.5 * (lo_s + hi_s)
            peck_reach(s)
            if beak_z() > toe_z() + PECK_CLEAR:
                lo_s = s
            else:
                hi_s = s
        peck_reach(lo_s * share)
    return f


peck = held("Peck", 24, [peck_pose(1.0), peck_pose(PECK_UP)])
peck_pose(1.0)()
diag("Peck 24 frames, two poses: beak", round(beak_z() - toe_z(), 4), "m above the toes; then the reach at", PECK_UP, "of it; lowest", lowest(), "toes", round(toe_z(), 4))


# Lie: on its side, the legs folded in, the wings closed, nothing moving (HUNTING 10). One pose; the client fades it.
def lie_pose():
    put(STAND)
    legs_to(math.radians(LIE_LEGS), math.radians(LIE_KNEE))
    rot_world(HEAD, rot_x(10))
    rot_world(ROOTB, rot_y(LIE_ROLL))
    rot_world(ROOTB, rot_z(LIE_YAW))


lie = held("Lie", 24, [lie_pose])
lie_pose()
diag("Lie 24 frames, one pose: rolled", LIE_ROLL, "deg onto its side, turned", LIE_YAW, "deg, legs forward", LIE_LEGS, "deg with the knee", LIE_KNEE, "deg; lowest", lowest(), "parts z", parts())

# ------------------------------------------------------------------ keep the flight, drop the rest
fly.name = "Fly"
fly.use_fake_user = True
for name, a in list(acts.items()):
    if a not in (fly,):
        bpy.data.actions.remove(a)
arm.animation_data.action = None
put(STAND)

# ------------------------------------------------------------------ bake the object transforms into the data
# The clip renderer imports the glb with Blender's glTF importer, which guesses every bone's length from its child's
# distance in the skeleton's own units and then places the tail in the scaled object's space: a scaled armature
# object comes back with foot bones 1/scale too long, and the renderer reads the feet from those tails. Unit
# object matrices avoid it: the world transform goes into the rest bones and the mesh vertices, and every pose
# location channel (a bone-local offset, in the skeleton's units) is multiplied by the scale. Rotations are
# unchanged by a rigid, uniformly scaled change of the rest frame.
def bake_object_transforms(arm_, mesh_):
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for o in (arm_, mesh_):
        o.hide_viewport = False
        o.hide_set(False)
    arm_.animation_data.action = None
    for pb in arm_.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    W = arm_.matrix_world.copy()
    s = W.to_scale()
    assert max(s) - min(s) < 1e-6, ("the bake needs a uniform scale", s)
    k_ = float(s[0])
    M = mesh_.matrix_world.copy()
    me = mesh_.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) @ np.array(M)[:3, :3].T + np.array(M)[:3, 3]
    me.vertices.foreach_set("co", co.reshape(-1))
    me.update()
    bpy.context.view_layer.objects.active = arm_
    bpy.ops.object.mode_set(mode="EDIT")
    # not EditBone.transform(): with a scale it moves the tails by the scale squared and the connected chains
    # collapse. Head, tail and the roll (the bone's Z axis, turned with the frame) are set from saved values instead.
    R3 = W.to_3x3().normalized()
    saved = [(eb, W @ eb.head, W @ eb.tail, R3 @ eb.z_axis) for eb in arm_.data.edit_bones]
    for eb, h, t, _ in saved:
        eb.head = h
        eb.tail = t
    for eb, _, _, z in saved:
        eb.align_roll(z)
    bpy.ops.object.mode_set(mode="OBJECT")
    arm_.matrix_world = Matrix.Identity(4)
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
    kinds = {}
    for pb in arm_.pose.bones:
        for c in pb.constraints:
            kinds[c.type] = kinds.get(c.type, 0) + 1
            if c.type == "STRETCH_TO":
                c.rest_length = 0.0
            elif c.type == "LIMIT_DISTANCE":
                c.distance *= k_
            elif c.type == "LIMIT_LOCATION":
                for a in ("min_x", "min_y", "min_z", "max_x", "max_y", "max_z"):
                    setattr(c, a, getattr(c, a) * k_)
    diag("baked the object transforms: scale", round(k_, 5), "into", len(arm_.data.bones), "bones and", len(me.vertices), "vertices;", n,
         "location channels scaled; object matrices now identity", tuple(round(v, 4) for v in arm_.matrix_world.to_scale()),
         tuple(round(v, 4) for v in mesh_.matrix_world.to_scale()), "; constraints", kinds)


bake_object_transforms(arm, mesh)

# ------------------------------------------------------------------ export
ad = arm.animation_data
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)
for act in (idle, hop, lift_a, fly, alert, peck, lie):
    tr = ad.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act)
    if hasattr(st, "action_slot") and st.action_slot is None and len(getattr(act, "slots", [])):
        st.action_slot = act.slots[0]
    diag("action", act.name, "frames", tuple(round(v, 2) for v in act.frame_range))
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
want = dict(filepath=OUT, export_format="GLB", use_selection=True, export_animations=True,
            export_animation_mode="ACTIONS", export_extras=True, export_skins=True, export_image_format="JPEG",
            export_jpeg_quality=90, export_image_quality=90, export_yup=True, export_apply=False,
            export_force_sampling=True, export_optimize_animation_size=True, export_anim_slide_to_zero=True)
kw = {k_: v for k_, v in want.items() if k_ in props}
bpy.context.view_layer.objects.active = arm
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
for o in (arm, mesh):
    o.hide_viewport = False
    o.hide_render = False
    o.hide_set(False)
    o.select_set(True)
for k_ in list(scene.keys()):   # the 2.74 file's scene properties would land in the glb's extras
    del scene[k_]
kw["use_selection"] = False    # the whole scene: everything but the armature and the mesh was removed above
diag("export: objects", [(o.name, o.type, o.select_get(), o.visible_get()) for o in bpy.data.objects])
bpy.ops.export_scene.gltf(**kw)
diag("wrote", OUT, "options skipped", sorted(set(want) - set(kw)))
