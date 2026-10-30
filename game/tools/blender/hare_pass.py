"""Make a game-ready hare from the CC0 "Rabbit" by CDmir / TinyWorlds (OpenGameArt, rabbit.blend, Blender 2.76).

Run:  blender -b --factory-startup -P hare_pass.py -- <rabbit.blend> <out.glb> [--height 0.35] [--tex 1024] [--pied <pied.glb>]

What it does, in the manner of game/tools/blender/quad_pass.py (the wolf):
- keeps the Rabbit mesh and the armature; drops the fur shells (a second mesh of alpha cards that reads as noise at
  20 px and that the clip renderer would otherwise pick as "the body"), the camera, the lamps and the ground plane,
- rebuilds the material as a Principled BSDF with the packed colour map (the Blender Internal material of 2.76 does
  not survive), and warms it a little toward a sandy hare,
- scales the body to --height metres at the ears (bind pose); it already faces -Y,
- renames Guarding -> Idle; makes Walk from Running (one cycle played 1.6 times slower, the paw swings and the body
  bob at 0.3 of the bound's around their means, the paws' lift at 0.55 of it; the planted paws keep the ground) and
  Run from Running at its own tempo (swings and bob at 0.5, lift at 0.7); drops the rest,
- keys three held poses for the hunt's states on the rig's own controls: Alert (Guarding's sit-up, the ears pricked,
  the head turning: four poses), Graze (Guarding's crouch, the forequarters and the head turned to one side with
  the ears back apart, the nose solved onto the floor, nibbling: four poses) and
  Lie (Dying's last frame only, rolled onto its side with the legs drawn in: one pose, held),
- caps every map at --tex pixels and exports one GLB with the six clips on NLA tracks,
- with --pied, exports a second GLB of the same body and clips whose colour map carries white patches (a pied coat:
  patches on the back, the flanks and the face from seeded 3D noise over the body, the belly white), painted in
  texture space so the pattern is fixed to the body and cannot swim between frames.
Prints one DIAG line per fact.
"""
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
HEIGHT = float(argv[argv.index("--height") + 1]) if "--height" in argv else 0.35
TEX = int(argv[argv.index("--tex") + 1]) if "--tex" in argv else 1024
PIED = argv[argv.index("--pied") + 1] if "--pied" in argv else None
FPS = 24
WALK_SLOWDOWN = 1.6
WALK_SWING = 0.3    # the walk's swings and bob, as a share of the bound's
WALK_LIFT = 0.55    # the walk's paw lift off the floor, as a share of the bound's (a clear lift keeps a plant a plant;
                    # too much of it swings the silhouette seen from the front)
RUN_DAMP = 0.5      # the run's swings and bob
RUN_LIFT = 0.7      # the run's paw lift
ALERT_FRAME = 220   # Guarding's sit-up: the hare upright on its haunches, the base of Alert
ALERT_TURN = 28.0   # degrees, Alert's head turn to each side
GRAZE_CLEAR = 0.002  # metres between the nose and the floor in Graze (the renderer grounds the lowest point)
GRAZE_LIFT = 0.035  # metres, the nibble: the head comes up this much between bites
GRAZE_FORE_TURN = 18.0  # degrees, Graze: the forequarters swing to the cropping side, about the middle of the back
GRAZE_HEAD_TURN = 24.0  # degrees, Graze: the head swings this much further, about the base of the neck
GRAZE_REACH = 12.0      # degrees, Graze: the second bite is taken this much further round
GRAZE_SIDE = -1.0       # Graze turns to the hare's right: away from the side view's camera, so that view keeps the
                        # head in profile (a head turned toward it hides in front of the body); the right view is the
                        # left mirrored, so it turns away too
GRAZE_EAR_SPLAY = 50.0  # degrees, Graze: each ear out from the head's line, laid back (a V seen from above)
GRAZE_EAR_RISE = 68.0   # degrees, Graze: the ears raised off the horizontal
GRAZE_EAR_NEAR = -28.0  # degrees, Graze: the ear on the side of the turn this much lower (it clears the outline
                        # already), the far ear higher so its tip shows over the shoulder
LIE_FOLD = 0.6      # Lie: each paw drawn this share of the way in toward its leg's root
LIE_ROLL = 25.0     # Lie: degrees the rest is rolled about the body's long axis
PIED_SEED = 11      # the pied body: the noise's seed (a fixed pattern, the same file every run)
PIED_CELL = 0.06    # metres, the noise lattice: patches a few pixels across at the tile's scale
PIED_SHARE = 0.38   # the share of the surface painted white, belly included
PIED_BELLY = -0.45  # a face whose normal points further down than this (z of the unit normal) is belly: white
PIED_WHITE = (0.94, 0.93, 0.9)  # the patches' colour in the map (lit and snapped, it lands on the grey ramp's light steps)


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
mesh = bpy.data.objects["Rabbit"]
for o in list(bpy.data.objects):
    if o not in (arm, mesh):
        bpy.data.objects.remove(o, do_unlink=True)
diag("kept", [o.name for o in bpy.data.objects], "verts", len(mesh.data.vertices), "tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons))


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

add_tips(["BackPaw_L", "BackPaw_R", "FrontPaw_L", "FrontPaw_R"])

# ------------------------------------------------------------------ material: the packed colour map on a Principled BSDF
img = bpy.data.images.get("rabbot-skinn")   # the datablock's name in the source file (its path says rabbit-skinn)
if img is None:                             # a renamed datablock: the largest image in the file
    for im in bpy.data.images:
        if im.type == "IMAGE" and im.size[0] >= 256 and (img is None or im.size[0] > img.size[0]):
            img = im
mat = bpy.data.materials.new("Hare")
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Roughness"].default_value = 1.0
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
if img is not None:
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    hsv = nt.nodes.new("ShaderNodeHueSaturation")   # a little warmer and lighter: a sandy hare, not a grey one
    hsv.inputs["Hue"].default_value = 0.52
    hsv.inputs["Saturation"].default_value = 1.25
    hsv.inputs["Value"].default_value = 1.2
    nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])
    nt.links.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
    diag("material: colour map", img.name, tuple(img.size), "packed", img.packed_file is not None)
else:
    raise SystemExit("no colour map found in the source file: the hare would ship untextured")
mesh.data.materials.clear()
mesh.data.materials.append(mat)
for i, uv in enumerate(mesh.data.uv_layers):
    uv.active_render = i == 0
mesh.data.uv_layers.active_index = 0
for im in bpy.data.images:
    if im.type == "IMAGE" and (im.size[0] > TEX or im.size[1] > TEX):
        k = TEX / max(im.size)
        im.scale(max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k)))
        diag("map", im.name, "cut to", tuple(im.size))

# ------------------------------------------------------------------ rest pose, facing and scale
if arm.animation_data:
    arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ev = mesh.evaluated_get(dg)
me = ev.to_mesh()
co = np.empty(len(me.vertices) * 3)
me.vertices.foreach_get("co", co)
co = (co.reshape(-1, 3) @ np.array(ev.matrix_world)[:3, :3].T) + np.array(ev.matrix_world)[:3, 3]
ev.to_mesh_clear()
lo, hi = co.min(axis=0), co.max(axis=0)
head_y = (arm.matrix_world @ arm.pose.bones["Head"].head).y
hips_y = (arm.matrix_world @ arm.pose.bones["Hips"].head).y
diag("facing: head y", round(head_y, 3), "hips y", round(hips_y, 3), "(head at the smaller y: faces -Y)" if head_y < hips_y else "WARNING: does not face -Y")
H0 = float(hi[2] - lo[2])
k = HEIGHT / H0

arm.matrix_world = Matrix.Scale(k, 4) @ arm.matrix_world
bpy.context.view_layer.update()
diag("bind box before (units): height", round(H0, 3), "length", round(float(hi[1] - lo[1]), 3), "width", round(float(hi[0] - lo[0]), 3), "floor", round(float(lo[2]), 3))
diag("scaled by", round(k, 5), "to", HEIGHT, "m at the ears")

# ------------------------------------------------------------------ actions
acts = {a.name: a for a in bpy.data.actions}
run = acts["Running"]
idle = acts["Guarding"]
run.name = "Run"
idle.name = "Idle"
run.use_fake_user = True
idle.use_fake_user = True


def pose_of(action, t):
    """every pose channel of an action at frame t: {bone: {prop: {index: value}}}"""
    out = {}
    for fc in all_fcurves(action):
        if fc.data_path.startswith('pose.bones["'):
            bone = fc.data_path.split('"')[1]
            prop = fc.data_path.rsplit(".", 1)[-1]
            out.setdefault(bone, {}).setdefault(prop, {})[fc.array_index] = fc.evaluate(t)
    return out


# the hunt's held poses start from the file's own: the sit-up of Guarding, its crouch, and the last frame of Dying
# (its rest only: the fall is never played). Read here, before the other actions are dropped.
dying = acts["Dying.000"]
SRC_UP = pose_of(idle, ALERT_FRAME)
SRC_LOW = pose_of(idle, 0)
SRC_REST = pose_of(dying, dying.frame_range[1])
diag("hunt poses read: Guarding at", ALERT_FRAME, "(sitting up) and 0 (crouched), Dying at", dying.frame_range[1], "(its rest)")
for name, a in list(acts.items()):
    if a not in (run, idle):
        bpy.data.actions.remove(a)
diag("actions kept: Idle", tuple(idle.frame_range), "Run", tuple(run.frame_range))

chan = {}
for fc in all_fcurves(run):
    if not fc.data_path.startswith('pose.bones["'):
        continue
    bone = fc.data_path.split('"')[1]
    prop = fc.data_path.rsplit(".", 1)[-1]
    chan.setdefault(bone, {}).setdefault(prop, {})[fc.array_index] = fc
f0, f1 = run.frame_range
cycle = f1 - f0
diag("run channels", len(chan), "bones;", "cycle", int(cycle), "frames =", round(cycle / FPS, 3), "s")


def sample(bone, t):
    c = chan.get(bone, {})
    q = Quaternion([c["rotation_quaternion"][i].evaluate(t) if i in c.get("rotation_quaternion", {}) else (1, 0, 0, 0)[i] for i in range(4)]).normalized()
    loc = Vector([c["location"][i].evaluate(t) if i in c.get("location", {}) else 0.0 for i in range(3)])
    sc = Vector([c["scale"][i].evaluate(t) if i in c.get("scale", {}) else 1.0 for i in range(3)])
    return q, loc, sc


def new_action(name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None) is not None:
        slot = act.slots.new(id_type="OBJECT", name=arm.name) if len(act.slots) == 0 else act.slots[0]
        arm.animation_data.action_slot = slot
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


# Walk: the run's cycle, slower and smaller. Rotations shrink toward the per-bone mean; locations shrink toward the
# mean in x and y, and toward the lowest point in z for the paw targets (a planted paw keeps the ground) and toward
# the mean for the rest (a smaller bob).
keyed = list(chan.keys())
N = int(cycle)
samples = {b: [sample(b, f0 + i) for i in range(N + 1)] for b in keyed}
A3 = arm.matrix_world.to_3x3()
mean_q, mean_loc, up_axis, floor_up = {}, {}, {}, {}
for b, ss in samples.items():
    acc = Vector((0, 0, 0, 0))
    ref = ss[0][0]
    for q, _, _ in ss:
        acc += Vector(q) if q.dot(ref) >= 0 else -Vector(q)
    mean_q[b] = Quaternion(acc).normalized()
    locs = np.array([list(l) for _, l, _ in ss])
    mean_loc[b] = Vector(locs.mean(axis=0))
    # a bone's location channel lives in its own rest frame: this is the world's up in that frame (the parents of
    # the IK targets are not animated)
    u = ((A3 @ arm.data.bones[b].matrix_local.to_3x3()).inverted() @ Vector((0, 0, 1))).normalized()
    up_axis[b] = u
    floor_up[b] = min(float(Vector(l).dot(u)) for _, l, _ in ss) - float(mean_loc[b].dot(u))
paws = [b for b in keyed if "Paw" in b]


def shrunk_copy(name, R, swing, lift=None):
    """The run's cycle resampled to R frames with every swing at `swing` of the original around the per-bone means;
    a paw's height above its floor keeps `lift` of the original (default `swing`)."""
    lift = swing if lift is None else lift
    act = new_action(name)
    for i in range(R + 1):
        t = f0 + cycle * i / R
        for b in keyed:
            pb = arm.pose.bones[b]
            q, loc, sc = sample(b, t)
            m = mean_q[b]
            d = m.inverted() @ q
            if d.w < 0:
                d.negate()
            axis, ang = d.to_axis_angle()
            q = m @ Quaternion(axis, ang * swing)
            # shrink the travel around the mean; a paw target's height shrinks from its floor instead, so the
            # planted paw keeps the ground
            dev = loc - mean_loc[b]
            new = dev * swing
            if b in paws:
                u = up_axis[b]
                a = dev.dot(u)
                a_new = floor_up[b] + (a - floor_up[b]) * lift
                new += (a_new - a * swing) * u
            key(pb, i, q, mean_loc[b] + new, sc)
    diag(name, R, "frames =", round(R / FPS, 3), "s; swing and bob x", swing, "around the run's means; paws keep their floor, lift x", lift)
    return act


walk = shrunk_copy("Walk", max(2, round(cycle * WALK_SLOWDOWN)), WALK_SWING, WALK_LIFT)
# Run: the file's bound at its own tempo, its stretch and tuck damped so four poses of it keep a steady silhouette
# (the loop rule: the area of a pose within 10 % of the loop's mean)
bound = run
bound.name = "Bound"
run = shrunk_copy("Run", int(cycle), RUN_DAMP, RUN_LIFT)
bpy.data.actions.remove(bound)

# ------------------------------------------------------------------ how fast each gait carries the body (a planted paw's speed back under the body)
FEET = ["FrontPaw_L", "FrontPaw_R", "BackPaw_L", "BackPaw_R"]


def ground_speed(act):
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None):
        arm.animation_data.action_slot = act.slots[0]
    a0, a1 = (int(round(v)) for v in act.frame_range)
    speeds = []
    for foot in FEET:
        pts = []
        for f in range(a0, a1 + 1):
            scene.frame_set(f)
            pts.append(arm.matrix_world @ arm.pose.bones[foot].tail)
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
    diag("ground speed", act.name, [round(v, 3) for v in sp], "mean", act.get("groundSpeed"), "m/s at", HEIGHT, "m; stride per cycle", round(float(np.mean(sp)) * (act.frame_range[1] - act.frame_range[0]) / FPS, 3) if sp else None, "m")

# ------------------------------------------------------------------ the hunt's held poses: Alert, Graze, Lie
# Keyed by hand on the rig's own controls (the IK targets, the hips, the ears), from the poses read above. Each is a
# few poses a clip draws evenly (keys on those frames, the loop closed on the first), so a sheet takes them as keyed.
AW = arm.matrix_world.copy()
AWI = AW.inverted()
HEAD_GROUPS = {"Head", "Neck", "Ear_L", "Ear_R"}
gi = {g.index: g.name for g in mesh.vertex_groups}
head_v = np.array([any(gi.get(g.group) in HEAD_GROUPS and g.weight >= 0.5 for g in v.groups) for v in mesh.data.vertices])


def put_pose(p):
    for bn, props in p.items():
        pb = arm.pose.bones[bn]
        pb.rotation_mode = "QUATERNION"
        q = props.get("rotation_quaternion", {})
        lo_ = props.get("location", {})
        s_ = props.get("scale", {})
        pb.rotation_quaternion = [q.get(i, (1.0, 0.0, 0.0, 0.0)[i]) for i in range(4)]
        pb.location = [lo_.get(i, 0.0) for i in range(3)]
        pb.scale = [s_.get(i, 1.0) for i in range(3)]
    bpy.context.view_layer.update()


def move_world(name, d):
    """move a control by d (world metres)"""
    pb = arm.pose.bones[name]
    pb.matrix = Matrix.Translation(AWI.to_3x3() @ Vector(d)) @ pb.matrix
    bpy.context.view_layer.update()


def turn_world(name, axis, deg):
    """turn a control about its head, the axis in world space"""
    pb = arm.pose.bones[name]
    a = (AWI.to_3x3() @ Vector(axis)).normalized()
    head = pb.head.copy()
    pb.matrix = Matrix.Translation(head) @ Quaternion(a, np.radians(deg)).to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
    bpy.context.view_layer.update()


def turn_about(names, axis, deg, pivot):
    """turn controls together about one world pivot, the axis in world space"""
    a = (AWI.to_3x3() @ Vector(axis)).normalized()
    c = AWI @ Vector(pivot)
    m = Matrix.Translation(c) @ Quaternion(a, np.radians(deg)).to_matrix().to_4x4() @ Matrix.Translation(-c)
    for n in names:
        pb = arm.pose.bones[n]
        pb.matrix = m @ pb.matrix
        bpy.context.view_layer.update()


def wpos(name, end="head"):
    return AW @ getattr(arm.pose.bones[name], end)


def ears_up(lean_out=0.3, lean_fwd=0.12):
    """prick both ears: each ear's IK target straight above its root, a little outward and forward"""
    for side, sx in (("L", 1.0), ("R", -1.0)):
        root = wpos("Ear_" + side)
        tgt = wpos("IK_Ear_" + side)
        ln = (tgt - root).length
        d = Vector((sx * lean_out, -lean_fwd, 1.0)).normalized()
        move_world("IK_Ear_" + side, root + d * ln - tgt)


def mesh_z():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = (co.reshape(-1, 3) @ np.array(ev.matrix_world)[:3, :3].T) + np.array(ev.matrix_world)[:3, 3]
    ev.to_mesh_clear()
    assert len(co) == len(head_v), "the evaluated mesh changed its vertex count"
    return float(co[head_v, 2].min()), float(co[~head_v, 2].min())


HUNT_BONES = sorted({b for p in (SRC_UP, SRC_LOW, SRC_REST) for b in p})


def key_pose(frame):
    for b in HUNT_BONES:
        pb = arm.pose.bones[b]
        for prop in ("rotation_quaternion", "location", "scale"):
            pb.keyframe_insert(prop, frame=frame)


def hunt_action(name, length, poses):
    """an action of len(poses) poses keyed evenly over `length` frames, the loop closed on the first"""
    act = new_action(name)
    n = len(poses)
    for i in range(n + 1):
        poses[i % n]()
        key_pose(round(length * i / n))
    return act


# Alert: up on the haunches (Guarding's sit-up), the ears pricked straight up, the head turning: ahead, to one side,
# ahead with the nose up (a sniff), to the other side. HUNTING 2: the head-up tell a player reads.
def alert_pose(turn=0.0, nod=0.0):
    def f():
        put_pose(SRC_UP)
        ears_up()
        if nod:
            turn_world("IK_Head", (1, 0, 0), nod)
        if turn:
            turn_world("IK_Head", (0, 0, 1), turn)
    return f


alert = hunt_action("Alert", 96, [alert_pose(), alert_pose(ALERT_TURN), alert_pose(0.0, -12.0), alert_pose(-ALERT_TURN)])
diag("Alert 96 frames, four poses: ahead, head turned", ALERT_TURN, "deg, nose up 12 deg, turned", -ALERT_TURN, "deg; ears pricked")


# Graze: the crouch with the head down, the nose solved onto the floor (never below it: the renderer grounds the
# lowest point, so a nose under the paws would lift the feet), then lifted a little between bites. Seen from above
# a head straight down hides in front of the body and the crouch reads as a ball, so the forequarters and the head
# swing to one side as the hare crops (the front paws stay planted: their IK targets do not move), the ears lie back
# apart in a V, and the second bite is taken a little further round.
def ears_apart(side, yaw_deg):
    """the ears laid back along the turned head and apart in a V, raised off the back so both break the outline seen
    from above: the ear on the side of the turn clears it on the outside, the other stands higher to show over the
    shoulder"""
    yaw = np.radians(side * yaw_deg)
    rot = Quaternion((0, 0, 1), yaw)
    for s, sx in (("L", 1.0), ("R", -1.0)):
        root = wpos("Ear_" + s)
        tgt = wpos("IK_Ear_" + s)
        ln = (tgt - root).length
        v = np.radians(GRAZE_EAR_SPLAY)
        e = np.radians(GRAZE_EAR_RISE + (GRAZE_EAR_NEAR if sx * side > 0 else 0.0))
        d = rot @ Vector((sx * np.sin(v) * np.cos(e), np.cos(v) * np.cos(e), np.sin(e)))
        move_world("IK_Ear_" + s, root + d.normalized() * ln - tgt)


def graze_pose(lift=0.0, reach=0.0, side=GRAZE_SIDE):
    def f():
        put_pose(SRC_LOW)
        turn_world("IK_Head", (1, 0, 0), 35.0)
        move_world("IK_Head", (0, -0.02, 0))
        turn_about(["IK_Spine.001", "IK_Head"], (0, 0, 1), side * GRAZE_FORE_TURN, wpos("Spine"))
        turn_about(["IK_Head"], (0, 0, 1), side * (GRAZE_HEAD_TURN + reach), wpos("Neck"))
        ears_apart(side, GRAZE_FORE_TURN + GRAZE_HEAD_TURN + reach)
        # the head goes down on the neck, and the shoulders follow when the neck runs out of reach
        for _ in range(12):
            hz, fz = mesh_z()
            err = hz - (fz + GRAZE_CLEAR + lift)
            if abs(err) < 2e-4:
                break
            before = hz
            move_world("IK_Head", (0, 0, -err))
            if mesh_z()[0] > before - 0.5 * err:
                move_world("IK_Spine.001", (0, 0, -0.5 * err))
    return f


graze = hunt_action("Graze", 96, [graze_pose(), graze_pose(GRAZE_LIFT), graze_pose(0.0, GRAZE_REACH), graze_pose(GRAZE_LIFT, GRAZE_REACH)])
graze_pose()()
hz, fz = mesh_z()
diag("Graze 96 frames, four poses: nose to the floor, lifted", GRAZE_LIFT, "m, to the floor", GRAZE_REACH, "deg further round, lifted; forequarters turned",
     GRAZE_FORE_TURN, "deg to the hare's", "right" if GRAZE_SIDE < 0 else "left", "and the head", GRAZE_HEAD_TURN, "deg more; ears back apart; nose",
     round(hz - fz, 4), "m above the paws' floor")


# Lie: Dying's last frame held, nothing moves (HUNTING 10: no throes, no twitch). The clip draws one pose; the
# client fades it out for the take.
def lie_pose():
    """Dying's rest rolled onto its side, the legs drawn in toward the body: lying still, not legs out stiff"""
    put_pose(SRC_REST)
    if LIE_ROLL:
        turn_about(["Main", "Hips"], (0, 1, 0), LIE_ROLL, wpos("Hips"))
    for paw, root in (("FrontPaw_L", "FrontUpLeg_L"), ("FrontPaw_R", "FrontUpLeg_R"), ("BackPaw_L", "BackUpLeg_L"), ("BackPaw_R", "BackUpLeg_R")):
        move_world("IK_" + paw, (wpos(root) - wpos("IK_" + paw)) * LIE_FOLD)


lie = hunt_action("Lie", 24, [lie_pose])
diag("Lie 24 frames, one pose: Dying's rest, held, the paws drawn", LIE_FOLD, "of the way in toward the hips and shoulders")

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

# ------------------------------------------------------------------ export: each action on a track, one clip each
ad = arm.animation_data
ad.action = None
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)
for act in (idle, walk, run, alert, graze, lie):
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


# ------------------------------------------------------------------ the pied body: the same body and clips, white patches on the colour map
def noise3(p, seed):
    """smooth value noise over 3D points (n x 3, in lattice units), 0 to 1: the lattice values from an integer hash"""
    i = np.floor(p).astype(np.int64)
    f = p - i
    f = f * f * (3 - 2 * f)

    def at(ix, iy, iz):
        h = (ix * 73856093 ^ iy * 19349663 ^ iz * 83492791 ^ seed * 2654435761) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
        return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)

    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + w * at(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return out


def pied_field(p):
    """two octaves of the noise at the body's points (metres)"""
    q = p / PIED_CELL
    return 0.7 * noise3(q, PIED_SEED) + 0.3 * noise3(q * 2.1 + 17.0, PIED_SEED + 1)


def paint_pied(src_img):
    """a copy of the colour map with the white patches: each triangle rasterised in UV space, its texels' body points
    interpolated, white where the noise is over the threshold or the face is belly. The threshold is set so the
    white covers PIED_SHARE of the surface by area."""
    me = mesh.data
    me.calc_loop_triangles()
    uvl = me.uv_layers[0].data
    co = np.array([v.co[:] for v in me.vertices])
    tris = list(me.loop_triangles)
    P = np.array([[co[me.loops[li].vertex_index] for li in t.loops] for t in tris])
    UV = np.array([[uvl[li].uv[:] for li in t.loops] for t in tris])
    N = np.array([t.normal[:] for t in tris])
    area = np.array([t.area for t in tris])
    belly = N[:, 2] < PIED_BELLY
    # the threshold: area-weighted, at the face centres, so that noise over it or belly makes PIED_SHARE
    v = pied_field(P.mean(axis=1))
    order = np.argsort(-v)
    acc = np.cumsum(np.where(belly[order], 0.0, area[order]))
    need = PIED_SHARE * area.sum() - area[belly].sum()
    k = int(np.searchsorted(acc, max(0.0, need)))
    thr = float(v[order[min(k, len(order) - 1)]])
    white_faces = (v >= thr) | belly
    w, h = src_img.size
    px = np.array(src_img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    mask = np.zeros((h, w), dtype=bool)
    for t in range(len(tris)):
        uv = UV[t] * np.array([w, h])
        x0, y0 = np.floor(uv.min(axis=0)).astype(int) - 1
        x1, y1 = np.ceil(uv.max(axis=0)).astype(int) + 1
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w - 1), min(y1, h - 1)
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, c = uv
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12:
            continue
        l1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / d
        l2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
        l3 = 1 - l1 - l2
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        if not inside.any():
            continue
        if belly[t]:
            on = inside
        else:
            pts = l1[inside][:, None] * P[t, 0] + l2[inside][:, None] * P[t, 1] + l3[inside][:, None] * P[t, 2]
            on = np.zeros_like(inside)
            on[inside] = pied_field(pts) >= thr
        mask[y0:y1 + 1, x0:x1 + 1] |= on
    px[mask, 0], px[mask, 1], px[mask, 2] = PIED_WHITE
    out = bpy.data.images.new(src_img.name + "-pied", w, h, alpha=True)
    out.pixels.foreach_set(px.reshape(-1))
    out.pack()
    share = float(area[white_faces].sum() / area.sum())
    diag("pied map: threshold", round(thr, 4), "white faces", int(white_faces.sum()), "of", len(tris), "(", round(100 * share, 1), "% of the surface,",
         round(100 * float(area[belly].sum() / area.sum()), 1), "% belly ); texels painted", int(mask.sum()))
    return out


if PIED:
    tex_node = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE")
    tex_node.image = paint_pied(tex_node.image)
    bpy.ops.export_scene.gltf(**{**kw, "filepath": PIED})
    diag("wrote", PIED)
