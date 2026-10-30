"""Make the game-ready deer family from the CC0 "Deer Female" by CDmir (OpenGameArt, doe.blend, Blender 2.76).

Run:  blender -b --factory-startup -P deer_pass.py -- <doe.blend> <out.glb> [--look roe|hart] [--height 0.75]
                                                       [--tex 1024] [--lie-from Die.001]

One body, two looks:
- roe (default): the doe as she comes, a warm red-brown roe deer, 0.75 m at the withers.
- hart: the same body and the same actions, the colour maps washed to a silver white (written into the images, as
  glTF carries no node chain), a pair of dark branched antlers modelled here and skinned to the head, 1.1 m at the
  withers (the default --height for this look).

What it does, in the manner of hare_pass.py (the hare, from the same artist's rig):
- keeps the armature and joins the body, head and eye meshes into one skinned mesh (the clip renderer draws one
  mesh, the one with the most vertices); drops the camera, the lamps and the ground plane,
- rebuilds the three Blender Internal materials as Principled BSDFs on the packed colour maps (body, head) and a
  dark eye,
- centres the body over the origin, scales it to --height metres at the withers (bind pose; it already faces -Y)
  and bakes the scale into the bones; adds a tip bone under each hoof (the renderer reads a foot from its bone's
  tail, and glTF loses a leaf bone's length),
- makes six actions, every bone keyed on every frame so a stray channel of the file does not travel:
  Idle from the file's Idle.
  Walk keyed on the leg IK targets: four beats (hind left, fore left, hind right, fore right, a quarter of the
  cycle apart), each hoof three quarters of the cycle on the ground moving back at one speed and held flat, so a
  planted hoof keeps its spot; the swing leaves and meets the ground at that speed.
  Run keyed the same way, a gallop (hind left, hind right, fore left, fore right), the body carried lower, pitching
  and flexing. The file's own Run swings the legs nearly in place (about 3 px of ground a cycle at the tile), so no
  pace could lock its feet.
  Alert from the file's LookAround with the head carried high and the ears up (a still body, a slow head turn).
  Graze from the file's Eat held at its lowest head, with a small chew and an ear flick.
  Lie from the last pose of a Die of the file (--lie-from, the second by default: seen side-on its legs rest on the
  ground, where the first's stand up in the air), the legs drawn in, moved back to where the body stood and held still: no fall
  is played and nothing twitches; the client fades it,
- caps every map at --tex pixels and exports one GLB with the six clips on NLA tracks.
Prints one DIAG line per fact.
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]


def opt(name, default, kind=str):
    return kind(argv[argv.index(name) + 1]) if name in argv else default


LOOK = opt("--look", "roe")
assert LOOK in ("roe", "hart"), LOOK
HEIGHT = opt("--height", 1.1 if LOOK == "hart" else 0.75, float)
TEX = opt("--tex", 1024, int)
FPS = 24

# the walk, in the file's units (the withers stand about 3.5 units high)
WALK_FRAMES = 32       # one cycle; four poses of it sit at frames 0, 8, 16, 24
WALK_STANCE = 2.4      # how far a planted hoof travels back under the body in one stance
WALK_LIFT = 0.6        # how high a swinging hoof rises
WALK_DUTY = 0.75       # the share of the cycle a hoof is on the ground
WALK_BOB = 0.07        # the body's rise and fall, twice a cycle
WALK_NOD = 0.12        # the head's nod, twice a cycle
WALK_FLICK = 35        # degrees the hoof folds at the top of its swing
# the run, keyed the same way: a gallop (hind left, hind right, fore left, fore right), each hoof a little over a
# third of the cycle on the ground, a moment with all four off it, the body pitching and the back flexing
RUN_FRAMES = 12
RUN_STANCE = 2.2
RUN_LIFT = 0.85
RUN_FORE_LIFT = 0.65   # the fore hooves rise less: seen from the front a high fore hoof hangs below the chest and swells the outline
RUN_DUTY = 0.36
RUN_BOB = 0.12
RUN_PITCH = 0.12       # the hips and the withers rise and fall against each other
RUN_FLEX = 0.06        # the back gathers and stretches
RUN_FLICK = 50
RUN_CROUCH = 0.22      # the body carried lower and flatter than standing, so each leg reaches its whole stance
RUN_BACK = {"IK-Backleg_L": 0.0, "IK-Backleg_R": 0.0, "IK-Frontleg_L": -0.1, "IK-Frontleg_R": -0.1}   # as STANCE_BACK: a galloping fore leg reaches forward
# the touchdown of each foot as a share of the cycle
RUN_DOWN = {"IK-Backleg_L": 0.0, "IK-Backleg_R": 0.1, "IK-Frontleg_L": 0.38, "IK-Frontleg_R": 0.48}
# the four feet: (IK target, hoof bone, the phase at the middle of its swing); poses fall at 0, 1/4, 1/2, 3/4, so
# each pose shows one hoof at the top of its swing, in the order of a walk: hind left, fore left, hind right, fore right
FEET = [("IK-Backleg_L", "Backleg_L.002", 0.0), ("IK-Frontleg_L", "Frontleg_L.002", 0.25),
        ("IK-Backleg_R", "Backleg_R.002", 0.5), ("IK-Frontleg_R", "Frontleg_R.002", 0.75)]
HOOVES = [h for _, h, _ in FEET]
LIE_FROM = opt("--lie-from", "Die.001")
# where each hoof's stance is centred, behind its rest spot (+y): the fore leg cannot reach as far forward as it
# can back, and a hoof that cannot reach the ground at the front of its stance lands late
STANCE_BACK = {"IK-Backleg_L": 0.0, "IK-Backleg_R": 0.0, "IK-Frontleg_L": 0.55, "IK-Frontleg_R": 0.55}


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
parts = [bpy.data.objects[n] for n in ("Body", "Head", "Eyes")]
for o in list(bpy.data.objects):
    if o is not arm and o not in parts:
        bpy.data.objects.remove(o, do_unlink=True)

# ------------------------------------------------------------------ one mesh
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.hide_viewport = False
    o.hide_set(False)
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = parts[0]
mesh.name = "Deer"
mesh.data.name = "Deer"
diag("joined body, head and eyes into", mesh.name, "verts", len(mesh.data.vertices), "tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons),
     "materials", [m.name for m in mesh.data.materials])

# ------------------------------------------------------------------ materials
UV = mesh.data.uv_layers[0].name
for i, uv in enumerate(mesh.data.uv_layers):
    uv.active_render = i == 0
mesh.data.uv_layers.active_index = 0


def principled(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.0
    return mat, bsdf


def textured(name, image_name):
    img = bpy.data.images.get(image_name)
    if img is None:
        raise SystemExit(f"no colour map {image_name} in the source file: the deer would ship untextured")
    mat, bsdf = principled(name)
    nt = mat.node_tree
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = UV
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    col = tex.outputs["Color"]
    if LOOK == "hart":
        # a silver white, written into the map itself (glTF carries the image, not a node chain): most of the
        # colour taken out, the value lifted, then mixed toward a cool white
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        lum = px[:, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        rgb = lum[:, None] + (px[:, :3] - lum[:, None]) * 0.18
        rgb = np.clip(rgb * 1.9, 0, 1)
        rgb = rgb * 0.55 + np.array([0.86, 0.87, 0.9], dtype=np.float32) * 0.45
        px[:, :3] = rgb
        pale = bpy.data.images.new(img.name + "-hart", img.size[0], img.size[1], alpha=False)
        pale.pixels.foreach_set(px.reshape(-1))
        pale.pack()
        tex.image = pale
        img = pale
    nt.links.new(col, bsdf.inputs["Base Color"])
    diag("material", name, "on", img.name, tuple(img.size), "packed", img.packed_file is not None, "uv", UV, "look", LOOK)
    return mat


eye, eye_bsdf = principled("Eye")
eye_bsdf.inputs["Base Color"].default_value = (0.03, 0.025, 0.03, 1.0)
new_mats = {"body": textured("Body", "doe-body"), "head": textured("Head", "doe-head"), "Eye": eye}
for i, m in enumerate(mesh.data.materials):
    mesh.data.materials[i] = new_mats[m.name]
for im in bpy.data.images:
    if im.type == "IMAGE" and (im.size[0] > TEX or im.size[1] > TEX):
        k = TEX / max(im.size)
        im.scale(max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k)))
        diag("map", im.name, "cut to", tuple(im.size))

# ------------------------------------------------------------------ rest pose, facing, centre and scale
if arm.animation_data:
    arm.animation_data.action = None
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
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


co = world_verts()
lo, hi = co.min(axis=0), co.max(axis=0)
# the withers: the top of the back between the front legs
fy = [(arm.matrix_world @ arm.data.bones[b].head_local).y for b in ("Frontleg_L", "Frontleg_R")]
band = (np.abs(co[:, 1] - float(np.mean(fy))) < 0.35) & (np.abs(co[:, 0]) < 0.3)
withers = float(co[band, 2].max() - lo[2])
head_y = (arm.matrix_world @ arm.data.bones["Head"].head_local).y
hips_y = (arm.matrix_world @ arm.data.bones["Hip"].head_local).y
diag("facing: head y", round(head_y, 3), "hips y", round(hips_y, 3), "(faces -Y)" if head_y < hips_y else "WARNING: does not face -Y")
diag("bind box (units): height", round(float(hi[2] - lo[2]), 3), "length", round(float(hi[1] - lo[1]), 3), "width", round(float(hi[0] - lo[0]), 3),
     "floor", round(float(lo[2]), 3), "withers", round(withers, 3))
UNIT_WITHERS = withers

# ------------------------------------------------------------------ the hart's antlers (file units, skinned to the head)
if LOOK == "hart":
    hb = arm.data.bones["Head"]
    hh = arm.matrix_world @ hb.head_local
    ht = arm.matrix_world @ hb.tail_local
    # the crown: the highest point of the skull in a band behind the eyes, off the ears
    skull = (np.abs(co[:, 1] - (hh.y - 0.12)) < 0.18) & (np.abs(co[:, 0]) < 0.2) & (co[:, 2] < ht.z)
    crown_z = float(co[skull, 2].max())
    bm = bmesh.new()

    def limb(p0, p1, r0, r1, seg=6):
        """A tapered tube from p0 to p1, closed at the tip."""
        d = (p1 - p0)
        q = d.to_track_quat("Z", "Y")
        ring0, ring1 = [], []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            off = Vector((math.cos(a), math.sin(a), 0))
            ring0.append(bm.verts.new(p0 + q @ (off * r0)))
            ring1.append(bm.verts.new(p1 + q @ (off * r1)))
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        bm.faces.new(list(reversed(ring0)))
        tip = bm.verts.new(p1 + d.normalized() * r1 * 2)
        for i in range(seg):
            bm.faces.new((ring1[i], ring1[(i + 1) % seg], tip))

    def curve(p0, dirs, lengths):
        pts = [p0]
        for d, ln in zip(dirs, lengths):
            pts.append(pts[-1] + Vector(d).normalized() * ln)
        return pts

    for sx in (1, -1):
        base = Vector((sx * 0.17, hh.y - 0.05, crown_z - 0.05))
        # the beam: up and out, sweeping back, then forward at the top;
        # wide, as a lyre: seen from the front the beams stand out past the neck
        beam = curve(base, [(sx * 1.0, 0.2, 1.0), (sx * 0.7, 0.4, 1.0), (sx * 0.2, 0.1, 1.0), (sx * 0.0, -0.35, 1.0)],
                     [0.55, 0.6, 0.5, 0.4])
        radii = [0.13, 0.11, 0.085, 0.07, 0.05]
        for a, b, ra, rb in zip(beam, beam[1:], radii, radii[1:]):
            limb(a, b, ra, rb)
        limb(beam[0] + (beam[1] - beam[0]) * 0.35, beam[0] + (beam[1] - beam[0]) * 0.35 + Vector((sx * 0.1, -1.0, 0.35)).normalized() * 0.55, 0.08, 0.035)  # brow tine
        limb(beam[2], beam[2] + Vector((sx * 0.1, -1.0, 0.6)).normalized() * 0.45, 0.07, 0.03)    # trez tine
        limb(beam[3], beam[3] + Vector((sx * 0.4, 0.3, 1.0)).normalized() * 0.4, 0.055, 0.028)     # the crown's fork
        limb(beam[3], beam[3] + Vector((-sx * 0.2, -0.6, 0.9)).normalized() * 0.35, 0.055, 0.028)
    ame = bpy.data.meshes.new("Antlers")
    bm.to_mesh(ame)
    bm.free()
    ant = bpy.data.objects.new("Antlers", ame)
    scene.collection.objects.link(ant)
    ant.matrix_world = mesh.matrix_world.copy()
    ant.data.transform(mesh.matrix_world.inverted())
    amat, absdf = principled("Antler")
    absdf.inputs["Base Color"].default_value = (0.16, 0.145, 0.13, 1.0)   # a weathered dark grey-brown, darker than the coat so the antlers read against it
    ame.materials.append(amat)
    vg = ant.vertex_groups.new(name="Head")
    vg.add(list(range(len(ame.vertices))), 1.0, "REPLACE")
    mod = ant.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    ant.parent = arm
    ant.matrix_parent_inverse = arm.matrix_world.inverted()
    ant.matrix_world = mesh.matrix_world.copy()
    bpy.ops.object.select_all(action="DESELECT")
    ant.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.join()
    diag("antlers modelled on the crown at z", round(crown_z, 3), "skinned to Head; mesh now", len(mesh.data.vertices), "verts")
    co = world_verts()
    lo, hi = co.min(axis=0), co.max(axis=0)

# centre the body over the origin (x, y) with its floor at 0, then scale about the origin
cx, cy = float((lo[0] + hi[0]) / 2), float((lo[1] + hi[1]) / 2)
arm.matrix_world = Matrix.Translation((-cx, -cy, -float(lo[2]))) @ arm.matrix_world
bpy.context.view_layer.update()
k = HEIGHT / UNIT_WITHERS
arm.matrix_world = Matrix.Scale(k, 4) @ arm.matrix_world
bpy.context.view_layer.update()
co = world_verts()
lo, hi = co.min(axis=0), co.max(axis=0)
diag("scaled by", round(k, 5), "to", HEIGHT, "m at the withers; box now height", round(float(hi[2] - lo[2]), 3), "length", round(float(hi[1] - lo[1]), 3), "m")


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
    diag("tip bones added under", names)


add_tips(HOOVES)

# ------------------------------------------------------------------ actions
src = {a.name: a for a in bpy.data.actions}
for a in src.values():          # out of the way of the names this pass writes
    a.name = "source " + a.name
BONES = [pb.name for pb in arm.pose.bones]
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"


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
    return {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in arm.pose.bones}


def new_action(name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and getattr(act, "slots", None) is not None:
        slot = act.slots.new(id_type="OBJECT", name=arm.name) if len(act.slots) == 0 else act.slots[0]
        arm.animation_data.action_slot = slot
    return act


def write_action(name, poses):
    """Key a list of poses (frame 0..n-1), every bone each frame."""
    act = new_action(name)
    for i, pose in enumerate(poses):
        for b, (q, loc, sc) in pose.items():
            pb = arm.pose.bones[b]
            pb.rotation_quaternion = q
            pb.location = loc
            pb.scale = sc
            pb.keyframe_insert("rotation_quaternion", frame=i)
            pb.keyframe_insert("location", frame=i)
            pb.keyframe_insert("scale", frame=i)
    set_action(None)
    diag("action", name, len(poses) - 1, "frames =", round((len(poses) - 1) / FPS, 3), "s")
    return act


def local_delta(bone, d):
    """An armature-space offset as a location channel of a bone whose parent is unposed (the IK targets hang off Main)."""
    return arm.data.bones[bone].matrix_local.to_3x3().inverted() @ Vector(d)


def spin(q, bone, axis_arm, ang):
    """Turn a bone's basis by ang about an armature-space axis through the bone (applied in its rest frame)."""
    ax = (arm.data.bones[bone].matrix_local.to_3x3().inverted() @ Vector(axis_arm)).normalized()
    return Quaternion(ax, ang) @ q


def orient_hooves(p, flicks):
    """Set each hoof's turn so it lies as it does at rest (flat on the ground while planted), folded by its flick
    (radians about the body's side axis) in the swing. The IK bends the leg above it, so the hoof's basis is found by
    posing the frame and asking for the hoof's armature-space matrix."""
    if arm.animation_data and arm.animation_data.action is not None:
        set_action(None)
    for b, (q, loc, sc) in p.items():
        pb = arm.pose.bones[b]
        pb.rotation_quaternion, pb.location, pb.scale = q, loc, sc
    bpy.context.view_layer.update()
    for hoof, flick in flicks.items():
        pb = arm.pose.bones[hoof]
        head = pb.matrix.translation.copy()
        rest = arm.data.bones[hoof].matrix_local.to_3x3()
        pb.matrix = Matrix.Translation(head) @ (Matrix.Rotation(flick, 3, "X") @ rest).to_4x4()
        bpy.context.view_layer.update()
        p[hoof] = (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy())


def resample(act, frames=None, step=1.0):
    f0, f1 = act.frame_range
    n = int(round((f1 - f0) / step)) if frames is None else frames
    return [pose_at(act, f0 + (f1 - f0) * i / n) for i in range(n + 1)]


actions = []

# Idle: the file's own
actions.append(write_action("Idle", resample(src["Idle.000"])))


# Walk: keyed on the IK targets from the standing pose
stand = pose_at(src["Stand"], 0)


def swing_y(s, stance, duty):
    """A swinging hoof from behind (+stance/2) to in front (-stance/2): a cubic Hermite that leaves and meets the
    ground at the stance's own speed, so the hoof neither stops nor jumps where it lifts and lands."""
    m = stance * (1 - duty) / duty
    h00, h10, h01, h11 = 2 * s ** 3 - 3 * s ** 2 + 1, s ** 3 - 2 * s ** 2 + s, -2 * s ** 3 + 3 * s ** 2, s ** 3 - s ** 2
    return h00 * stance / 2 + h10 * m + h01 * (-stance / 2) + h11 * m


walk = []
for i in range(WALK_FRAMES + 1):
    t = i / WALK_FRAMES
    p = {b: (v[0].copy(), v[1].copy(), v[2].copy()) for b, v in stand.items()}
    flicks = {}
    for ik, hoof, mid in FEET:
        # the phase from the start of the swing
        s0 = mid - (1 - WALK_DUTY) / 2
        ph = (t - s0) % 1.0
        if ph < 1 - WALK_DUTY:                  # swing: from behind to in front, lifted
            s = ph / (1 - WALK_DUTY)
            y = swing_y(s, WALK_STANCE, WALK_DUTY)  # +y is behind (the deer faces -Y)
            z = WALK_LIFT * math.sin(math.pi * s)
            flick = math.sin(math.pi * s) * math.radians(WALK_FLICK)
        else:                                   # stance: from in front to behind at one speed
            s = (ph - (1 - WALK_DUTY)) / WALK_DUTY
            y = WALK_STANCE * (s - 0.5)
            z = 0.0
            flick = 0.0
        q, loc, sc = p[ik]
        p[ik] = (q, loc + local_delta(ik, (0, y + STANCE_BACK[ik], z)), sc)
        flicks[hoof] = flick                    # the toe folds down and back as it lifts
    bob = -WALK_BOB * math.cos(4 * math.pi * t)
    for b in ("IK-Hip", "IK-Backbone"):
        q, loc, sc = p[b]
        p[b] = (q, loc + local_delta(b, (0, 0, bob)), sc)
    q, loc, sc = p["IK-Head"]
    p["IK-Head"] = (q, loc + local_delta("IK-Head", (0, -0.5 * WALK_NOD * math.sin(4 * math.pi * t), bob + WALK_NOD * math.sin(4 * math.pi * t + 0.6))), sc)
    orient_hooves(p, flicks)
    walk.append(p)
actions.append(write_action("Walk", walk))

# Run: a gallop keyed on the IK targets from the standing pose
run = []
for i in range(RUN_FRAMES + 1):
    t = i / RUN_FRAMES
    p = {b: (v[0].copy(), v[1].copy(), v[2].copy()) for b, v in stand.items()}
    flicks = {}
    for ik, hoof, _ in FEET:
        ph = (t - RUN_DOWN[ik]) % 1.0           # from the touchdown
        if ph < RUN_DUTY:                       # stance: in front to behind at one speed
            s = ph / RUN_DUTY
            y = RUN_STANCE * (s - 0.5)
            z = 0.0
            flick = 0.0
        else:                                   # swing: behind to in front, lifted and folded
            s = (ph - RUN_DUTY) / (1 - RUN_DUTY)
            y = swing_y(s, RUN_STANCE, RUN_DUTY)
            z = RUN_LIFT * (RUN_FORE_LIFT if "Front" in ik else 1.0) * math.sin(math.pi * s)
            flick = math.sin(math.pi * s) * math.radians(RUN_FLICK)
        q, loc, sc = p[ik]
        p[ik] = (q, loc + local_delta(ik, (0, y + RUN_BACK[ik], z)), sc)
        flicks[hoof] = flick
    # the body is lowest in the middle of the fore feet's stance (0.6) and highest in the moment of suspension; the
    # withers dip while the fore feet carry it and the hips while the hind feet do, so a planted leg keeps the ground
    bob = -RUN_BOB * math.cos(2 * math.pi * (t - 0.6))
    pitch = RUN_PITCH * math.sin(2 * math.pi * (t - 0.35))
    flex = RUN_FLEX * math.cos(2 * math.pi * (t - 0.35))
    for b, sp, sf in (("IK-Hip", 1, 1), ("IK-Backbone", -1, -1)):
        q, loc, sc = p[b]
        p[b] = (q, loc + local_delta(b, (0, sf * flex, bob + sp * pitch - RUN_CROUCH)), sc)
    q, loc, sc = p["IK-Head"]
    # the head held level and a little forward: it rides the body's rise and fall but not its pitch, so seen from
    # the front it stays over the chest and the outline keeps its size
    p["IK-Head"] = (q, loc + local_delta("IK-Head", (0, -0.25, bob + 0.5 * pitch - 0.1 - RUN_CROUCH)), sc)
    orient_hooves(p, flicks)
    run.append(p)
actions.append(write_action("Run", run))

# Alert: the file's LookAround with the head carried high and back, the ears turned up
ALERT_RAISE = (0.0, 0.5, 0.85)
alert = resample(src["LookAround.000"], frames=96)
for p in alert:
    q, loc, sc = p["IK-Head"]
    p["IK-Head"] = (q, loc + local_delta("IK-Head", ALERT_RAISE), sc)
    for ear, sx in (("Head_L.001", 1), ("Head_R.001", -1)):
        eq, el, es = p[ear]
        p[ear] = (spin(eq, ear, (1, 0, 0), math.radians(-18)), el, es)
actions.append(write_action("Alert", alert))

# Graze: the file's Eat at its lowest head, with a small chew and an ear flick
eat = src["Eat.001"]
ef0, ef1 = eat.frame_range
low_f, low_z = ef0, 1e9
for f in range(int(ef0), int(ef1) + 1):
    pose_at(eat, f)
    z = (arm.matrix_world @ arm.pose.bones["Head"].tail).z
    if z < low_z:
        low_f, low_z = f, z
base = pose_at(eat, low_f)
diag("graze holds Eat at frame", low_f, "head tip z", round(low_z, 3))
graze = []
GRAZE_FRAMES = 48
for i in range(GRAZE_FRAMES + 1):
    t = i / GRAZE_FRAMES
    p = {b: (v[0].copy(), v[1].copy(), v[2].copy()) for b, v in base.items()}
    q, loc, sc = p["IK-Head"]
    chew = math.sin(2 * math.pi * t)
    p["IK-Head"] = (spin(q, "IK-Head", (1, 0, 0), math.radians(6) * chew), loc + local_delta("IK-Head", (0, 0.06 * chew, 0.1 * max(0.0, chew))), sc)
    eq, el, es = p["Head_L.001"]
    p["Head_L.001"] = (spin(eq, "Head_L.001", (0, 1, 0), math.radians(20) * max(0.0, math.sin(2 * math.pi * t + 1.0))), el, es)
    graze.append(p)
actions.append(write_action("Graze", graze))

# Lie: the last pose of the first Die, held still
die = src[LIE_FROM]
lie_pose = pose_at(die, die.frame_range[1])
# the legs drawn in, knees bent, as a deer lies at rest: each hoof target moved part of the way to its leg's root
LIE_TUCK = 0.4
roots = {"IK-Backleg_L": "Backleg_L", "IK-Backleg_R": "Backleg_R", "IK-Frontleg_L": "Frontleg_L", "IK-Frontleg_R": "Frontleg_R"}
goals = {}
for ik, root in roots.items():
    f = arm.pose.bones[ik].matrix.translation.copy()
    r = arm.pose.bones[root].head.copy()
    goals[ik] = (f + (r - f) * LIE_TUCK, arm.pose.bones[ik].matrix.to_3x3())
set_action(None)
for b, (q, loc, sc) in lie_pose.items():
    pb = arm.pose.bones[b]
    pb.rotation_quaternion, pb.location, pb.scale = q, loc, sc
bpy.context.view_layer.update()
for ik, (g, r3) in goals.items():
    pb = arm.pose.bones[ik]
    pb.matrix = Matrix.Translation(g) @ r3.to_4x4()
    bpy.context.view_layer.update()
    lie_pose[ik] = (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy())
diag("lie: the legs drawn in by", LIE_TUCK, "of the way to their roots")
# the fall carries the body sideways off its spot: move the root back so the lying body sits where it stood
rest_c = (lo + hi) / 2
c = world_verts()
lc = (c.min(axis=0) + c.max(axis=0)) / 2
q, loc, sc = lie_pose["Main"]
lie_pose["Main"] = (q, loc + local_delta("Main", (arm.matrix_world.inverted().to_3x3() @ Vector((float(rest_c[0] - lc[0]), float(rest_c[1] - lc[1]), 0.0)))), sc)
diag("lie: the body moved back by", round(float(rest_c[0] - lc[0]), 3), round(float(rest_c[1] - lc[1]), 3), "m to its standing spot")
actions.append(write_action("Lie", [lie_pose for _ in range(9)]))

for a in list(bpy.data.actions):
    if a not in actions:
        bpy.data.actions.remove(a)
diag("actions kept", [(a.name, tuple(a.frame_range)) for a in actions])


# ------------------------------------------------------------------ how fast each gait carries the body
def ground_speed(act):
    set_action(act)
    a0, a1 = (int(round(v)) for v in act.frame_range)
    speeds = []
    for hoof in HOOVES:
        pts = []
        for f in range(a0, a1 + 1):
            scene.frame_set(f)
            pts.append(arm.matrix_world @ arm.pose.bones[hoof].tail)
        z = np.array([p.z for p in pts])
        y = np.array([p.y for p in pts])
        planted = z <= z.min() + 0.15 * (z.max() - z.min())
        v = [(y[i + 1] - y[i]) * FPS for i in range(len(y) - 1) if planted[i] and planted[i + 1]]
        if v:
            speeds.append(float(np.median(v)))
    set_action(None)
    return speeds


for act in actions:
    if act.name not in ("Walk", "Run"):
        continue
    sp = ground_speed(act)
    if sp:
        act["groundSpeed"] = round(float(np.mean(sp)), 3)
    diag("ground speed", act.name, [round(v, 3) for v in sp], "mean", act.get("groundSpeed"), "m/s; stride per cycle",
         round(float(np.mean(sp)) * (act.frame_range[1] - act.frame_range[0]) / FPS, 3) if sp else None, "m")


# ------------------------------------------------------------------ bake the object transforms into the data (as hare_pass.py)
def bake_object_transforms(arm_, mesh_):
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for o in (arm_, mesh_):
        o.hide_viewport = False
        o.hide_set(False)
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
        for cn in pb.constraints:
            kinds[cn.type] = kinds.get(cn.type, 0) + 1
            if cn.type == "STRETCH_TO":
                cn.rest_length = 0.0
            elif cn.type == "LIMIT_DISTANCE":
                cn.distance *= k_
    diag("baked the object transforms: scale", round(k_, 5), "into", len(arm_.data.bones), "bones and", len(me.vertices), "vertices;", n,
         "location channels scaled; constraints", kinds)


bake_object_transforms(arm, mesh)

# ------------------------------------------------------------------ export: each action on a track, one clip each
ad = arm.animation_data
ad.action = None
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)
for act in actions:
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
