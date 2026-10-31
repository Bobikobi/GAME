"""Make a game-ready four-legged character from a Meshy quadruped rig download.

Run:  blender -b -P quad_pass.py -- <walk_withSkin.glb> <out.glb> [--maps <textured.glb>] [--tex 1024]
                                     [--height 0.9] [--probe]
      blender -b -P quad_pass.py -- --states <wolf.glb> <out.glb>

The rig download holds the mesh, a 27-joint skin and one clip (the walk). This pass:
- takes the material from --maps when the rig download came without images (same UV layout; the
  share of matching UV coordinates is printed),
- drops the emission input (the colour map wired to it flattens the light),
- turns the model so its head looks down glTF +Z and scales it to --height metres (ears, bind pose),
- names the walk "Walk", makes "Run" from it (one walk cycle played 1.8 times faster with longer leg
  swings, a body bob, a forward lean and the tail lifted) and "Idle" from the bind pose (breathing, a
  slow look around, a tail sway; a 6 s loop),
- keys the hunt's three states from the bind pose (HUNTING.md section 2), every pose by forward
  kinematics: the rig has no IK, no jaw, no weight on the ears and one head bone on the chest bone, so a
  leg is set by turning its four bones, the two upper ones solved so the paw stays where the bind pose
  put it on the ground. "Alert" (the head and chest raised through the chest bone, the head keeping its
  standing angle, the forelegs straight, the tail lifted a little above level; a slow look ahead, to one
  side, ahead with the nose up, to the other side: four poses), "Graze" (the head down to the ground in front of the
  forepaws, the forelegs splayed; a bite, a pull back, a second bite and a chew done with the head bone:
  four poses, of which the first two are a loop on their own) and "Lie" (the body down, the legs folded,
  the head low on the forepaws, the tail wrapped round: one pose, held),
- measures how fast a planted foot slides back in Walk and Run and stores it on each clip as
  extras.groundSpeed (metres per second at the exported size), so a game can match the steps to the
  speed it moves the character at,
- caps every map at --tex pixels (default 1024) and exports one GLB with the six clips.
--probe prints the facts (bones, facing, clip, maps) and writes nothing.
--states adds Alert, Graze and Lie to a finished wolf (character-wolf-grim.glb or -bright.glb, made by the
pass above before it keyed them) and keeps every other byte of the file: the mesh, the skin, the maps and
the Idle, Walk and Run samplers. The three clips are keyed by the same code, exported, and spliced into
the glb's own JSON and binary chunk, the nodes matched by name (an Alert, Graze or Lie already in the file
is replaced, so a second run writes the same file).
Prints one DIAG line per fact.
"""
import json
import math
import os
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
STATES = argv[0] == "--states"
if STATES:
    argv = argv[1:]
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


# ------------------------------------------------------------------ helpers to key a pose
def world_to_basis(name, q_world):
    """a rotation about the bone's head, given in world axes, as the bone's pose-space rotation"""
    rb = arm.data.bones[name].matrix_local.to_quaternion()
    return (rb.inverted() @ RA.inverted() @ q_world @ RA @ rb).normalized()


def world_vec_to_basis(name, v_world):
    rb = arm.data.bones[name].matrix_local.to_3x3()
    return rb.inverted() @ (amw.to_3x3().inverted() @ v_world)


def rot_x(deg):  # positive = nose down, tail up (the model faces -Y)
    return Quaternion((1, 0, 0), math.radians(deg))


def rot_y(deg):  # positive rolls the top toward +X (the wolf's left)
    return Quaternion((0, 1, 0), math.radians(deg))


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


# ------------------------------------------------------------------ the hunt's states (HUNTING.md section 2)
# Every pose is set by forward kinematics from the bind pose. The body has three bones (Hips; the chest bone, which is
# the neck and carries the forelegs; one head bone that pivots mid-skull), four bones a leg, a tail of four, and no
# weight on the ears (earend, R_earend, headend) and no jaw, so a pose reads through the head's height, the legs and
# the tail. Where a pose keeps a paw on the ground, the leg's two upper bones are solved so its third bone's head (the
# wrist or the hock) stays where the bind pose put it, or where the pose moves it, and the paw keeps the bind pose's
# turn: the paws stay flat on the floor the renderer stands the body on (the lowest point of the mesh).
LEG_CHAINS = {  # shoulder or hip to toe
    "LF": ("frontleg", "frontleg0", "frontleg1", "frontleg2"),
    "RF": ("R_frontleg", "R_frontleg0", "R_frontleg1", "R_frontleg2"),
    "LB": ("backleg", "backleg0", "backleg1", "backleg2"),
    "RB": ("R_backleg", "R_backleg0", "R_backleg1", "R_backleg2"),
}
HUNT_TAIL = ("tailstart", "tail1", "tail2", "tail3")
ALERT_SECONDS = 4     # four poses a second apart; the clip plays them by time (600 ms each)
ALERT_PAWS = 0.03     # share of the height, each forepaw set forward under its shoulder, so the foreleg stands
                      # straight and upright and takes the weight
ALERT_RISE = 3.0      # degrees, the most the front may turn up about the hips; the solve takes the largest turn at
                      # which the straight forelegs still stand on the floor, which on both wolves is about 3 degrees
                      # down (the front tipped forward), so the head's height comes from the chest bone
ALERT_CHEST = 32.0    # degrees, the chest bone (the neck) raised
ALERT_HEAD = 32.0     # degrees, the head bone turned back down by the chest bone's raise, so the head keeps its
                      # standing angle: the muzzle points ahead, and the ears stand up where a view from behind
                      # sees them
ALERT_LOOK = 30.0     # degrees, the look to each side, shared by the chest bone and the head bone
ALERT_SNIFF = 8.0     # degrees, the third pose lifts the nose (a scent on the air)
ALERT_TAIL = (80.0, 12.0, 6.0, 0.0)  # degrees, the tail lifted from its hang to a little above level, bone by bone;
                                     # seen from behind it leaves the gap between the hind legs open
GRAZE_SECONDS = 2     # four poses half a second apart; the clip plays them by time (400 ms each)
GRAZE_CROUCH = 0.035  # share of the height, the whole body lowered (every leg bends under it)
GRAZE_CHEST = 30.0    # degrees, the chest bone (the neck) lowered
GRAZE_HEAD = 40.0     # degrees, the head bone nose down, so the muzzle meets the ground and not the forehead
GRAZE_SPLAY = 0.045   # share of the height, each forepaw moved outward (the forelegs splayed)
GRAZE_REACH = 0.02    # share of the height, each forepaw moved forward
GRAZE_CLEAR = 0.006   # metres between the muzzle and the floor at a bite (the body's forward tip is solved to it)
GRAZE_PULL = 0.035    # share of the height, the body drawn back on the pull (the paws stay)
GRAZE_PULL_UP = 6.0   # degrees less forward tip on the pull, the muzzle still low
GRAZE_PULL_TURN = 14.0  # degrees, the head turned and rolled on the pull, a tug to one side
GRAZE_BITE2 = -10.0   # degrees, the second bite taken a little to the other side
GRAZE_CHEW = (4.0, 8.0)  # degrees, the chew: less forward tip, the head bone's nod up
GRAZE_TAIL = (8.0, 0.0, 0.0, 0.0)  # degrees, the tail eased off the legs
LIE_SECONDS = 1       # one pose, held
LIE_BELLY = 0.01      # metres between the belly and the floor (the body is lowered to it)
LIE_BACK = 0.06       # share of the height, the lying body set back, so the forepaws keep inside the frame
LIE_ELBOW = 0.03      # metres, each elbow above the floor, just behind its shoulder; the forearm lies along the
                      # floor ahead of it
LIE_FORE_OUT = 0.01   # share of the height, each forepaw moved outward
LIE_PASTERN = -80.0   # degrees, the forepaw's two bones turned forward to lie flat (negative: the end swings forward)
LIE_HOCK = (0.05, 0.08)  # share of the height, each hock outward and back of its hip, on the floor
LIE_HOCK_Z = 0.035    # metres, the hock above the floor (lowered per body where the folded leg would stay clear of it)
LIE_SHANK = -70.0     # degrees, the hind shank turned forward to lie along the floor (the hind paw keeps flat)
LIE_CHIN = 0.045      # metres between the head and the floor: the chin on the forepaws (the chest bone is solved
                      # to it)
LIE_HEAD = 12.0       # degrees, the head bone nose down
LIE_TAIL = (40.0, 0.0, 0.0, 0.0)        # degrees, the tail lifted off its hang to lie along the floor (more where
                                        # its curl would pass under the floor: solved)
LIE_WRAP = (15.0, 55.0, 55.0, 50.0)      # degrees about the vertical: the tail curled round the right flank (the side
                                         # the side view sees, so the curl reads there and in the down view)


def wpt(name, end="head"):
    return arm.matrix_world @ getattr(arm.pose.bones[name], end)


def wrot(name):
    return (arm.matrix_world @ arm.pose.bones[name].matrix).to_3x3().normalized().to_quaternion()


def turn(name, q_world, pivot=None):
    """turn a bone (its children ride along) by a rotation in world axes about its head, or about a world point"""
    pb = arm.pose.bones[name]
    aw = arm.matrix_world
    p = pb.head.copy() if pivot is None else aw.inverted() @ pivot
    ra = aw.to_3x3().normalized().to_quaternion()
    q = ra.inverted() @ q_world @ ra
    pb.matrix = Matrix.Translation(p) @ q.to_matrix().to_4x4() @ Matrix.Translation(-p) @ pb.matrix
    bpy.context.view_layer.update()


def shift(name, d_world):
    """move a bone (its children ride along) by d_world metres in world axes"""
    pb = arm.pose.bones[name]
    pb.matrix = Matrix.Translation(arm.matrix_world.inverted().to_3x3() @ d_world) @ pb.matrix
    bpy.context.view_layer.update()


def aim(name, child, target):
    """turn a bone about its head so the line from its head to its child's head points at a world point"""
    turn(name, (wpt(child) - wpt(name)).rotation_difference(target - wpt(name)))


def plant(leg, move=(0.0, 0.0, 0.0), at=None, paw=None):
    """solve a leg's two upper bones so its wrist or hock stands where the bind pose put it (moved by `move`, world
    metres), or at the world point `at`, the knee bending to the bind pose's side; the lower bone keeps its bind-pose
    turn (turned further by the world rotation `paw`, when given) and the paw keeps its bind-pose turn, flat on the
    floor. Returns how far the wrist or hock fell short (0 when the leg reached)."""
    a, b, c, d = LEG_CHAINS[leg]
    p0 = wpt(a)
    t = Vector(at) if at is not None else REST_P[c] + Vector(move)
    l1 = (REST_P[b] - REST_P[a]).length
    l2 = (REST_P[c] - REST_P[b]).length
    v = t - p0
    dist = v.length
    reach = min(max(dist, abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
    u = v.normalized()
    ru = (REST_P[c] - REST_P[a]).normalized()
    bend = REST_P[b] - REST_P[a]
    bend = bend - ru * bend.dot(ru)
    bend = (bend - u * bend.dot(u)).normalized()
    x = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach)
    aim(a, b, p0 + u * x + bend * math.sqrt(max(l1 * l1 - x * x, 0.0)))
    aim(b, c, t)
    turn(c, (paw or Quaternion()) @ REST_Q[c] @ wrot(c).inverted())
    turn(d, REST_Q[d] @ wrot(d).inverted())
    return abs(dist - reach)


def mesh_points():
    """the posed mesh's vertices in world space"""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    m = np.array(ev.matrix_world)
    co = co.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]
    ev.to_mesh_clear()
    return co


def snapshot():
    """the pose as it stands, bone by bone: (rotation, location, scale) in pose space"""
    return {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in arm.pose.bones}


def hunt_action(name, seconds, poses):
    """an action of len(poses) poses keyed evenly over `seconds`, the loop closed on the first; a clip that spreads
    len(poses) poses evenly over it draws them as keyed"""
    snaps = [p() for p in poses]
    act = new_action(name)
    n = len(snaps)
    last = {}
    for i in range(n + 1):
        frame = 1 + round(seconds * FPS * i / n)
        for b, (q, loc, sc) in snaps[i % n].items():
            if b in last and q.dot(last[b]) < 0:  # the shorter way round, so the keys do not flip between poses
                q = -q
            last[b] = q
            key(arm.pose.bones[b], frame, q, loc, sc)
    arm.animation_data.action = None
    return act


def hunt_states():
    """key Alert, Graze and Lie on the armature from its bind pose; returns the three actions"""
    global REST_P, REST_Q
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    rest_pose(arm)
    REST_P = {b.name: wpt(b.name) for b in arm.data.bones}
    REST_Q = {b.name: wrot(b.name) for b in arm.data.bones}
    gi = {g.index: g.name for g in mesh.vertex_groups}
    part = {"head": ("head",), "fore": ("frontleg0", "frontleg1", "frontleg2", "R_frontleg0", "R_frontleg1",
                                         "R_frontleg2"),
            "hind": ("backleg0", "backleg1", "backleg2", "R_backleg0", "R_backleg1", "R_backleg2"),
            "tail": HUNT_TAIL}
    weight = {k: np.zeros(len(mesh.data.vertices)) for k in part}
    for v in mesh.data.vertices:
        for g in v.groups:
            for k, names in part.items():
                if gi.get(g.group) in names:
                    weight[k][v.index] += g.weight
    region = {k: w >= 0.5 for k, w in weight.items()}
    region["trunk"] = ~(region["head"] | region["fore"] | region["hind"] | region["tail"])
    co = mesh_points()
    floor = float(co[:, 2].min())
    top = float(co[region["head"], 2].max())
    belly = float(co[region["trunk"], 2].min())

    def gaps():
        """each part's lowest point above the bind pose's floor, metres"""
        c = mesh_points()
        return {k: round(float(c[m, 2].min()) - floor, 3) for k, m in region.items()}

    def tail(degs, wrap=(0.0, 0.0, 0.0, 0.0)):
        for n, d, w in zip(HUNT_TAIL, degs, wrap):
            if d:
                turn(n, rot_x(d))
            if w:
                turn(n, rot_z(w))

    short = []

    def legs(name, fore=(0.0, 0.0, 0.0), splay=0.0, record=False):
        """every leg back on its paw (the forepaws moved by `fore`, world metres, and `splay` outward)"""
        worst = 0.0
        for leg in LEG_CHAINS:
            side = 1.0 if leg in ("LF", "LB") else -1.0
            mv = (fore[0] + side * splay, fore[1], fore[2]) if leg in ("LF", "RF") else (0.0, 0.0, 0.0)
            worst = max(worst, plant(leg, mv))
        if record and worst > 1e-4:
            short.append("%s %.3f" % (name, worst))
        return worst

    def bisect(f, lo_, hi_, steps=24):
        """the largest x in [lo_, hi_] with f(x) true, f true at lo_ and false past some point"""
        if f(hi_):
            return hi_
        for _ in range(steps):
            mid = 0.5 * (lo_ + hi_)
            if f(mid):
                lo_ = mid
            else:
                hi_ = mid
        return lo_

    # Alert: the head and chest up through the chest bone (the neck), the head bone keeping its standing angle, the
    # forelegs straight under the shoulders, the tail lifted a little above level; a slow look ahead, to one side, ahead
    # with the nose up, to the other.
    def alert_body(rise, look, sniff, record=False):
        rest_pose(arm)
        turn("Hips", rot_x(-rise))
        turn("chest", rot_x(-ALERT_CHEST))
        turn("head", rot_x(ALERT_HEAD - sniff))
        if look:
            turn("chest", rot_z(0.5 * look))
            turn("head", rot_z(0.5 * look))
        tail(ALERT_TAIL)
        return legs("Alert", fore=(0.0, -ALERT_PAWS * H, 0.0), record=record)

    def alert(look=0.0, sniff=0.0):
        def pose():
            rise = bisect(lambda r: alert_body(r, look, sniff) <= 1e-4, -15.0, ALERT_RISE)
            alert_body(rise, look, sniff, record=True)
            c = mesh_points()
            diag("alert pose: look", look, "sniff", sniff, "front raised", round(rise, 2), "deg; head top up",
                 round(float(c[region["head"], 2].max()) - top, 3), "m; gaps", gaps())
            return snapshot()
        return pose

    # Graze: the body crouched and tipped forward until the muzzle meets the floor in front of the splayed forepaws; a
    # bite, a pull back with the head turned, a second bite to the other side and a chew (the head bone nods up).
    def graze_body(tip, back=0.0, yaw=0.0, roll=0.0, nod=0.0, record=False):
        rest_pose(arm)
        shift("Hips", Vector((0, back * H, -GRAZE_CROUCH * H)))
        turn("Hips", rot_x(tip))
        turn("chest", rot_x(GRAZE_CHEST))
        turn("head", rot_x(GRAZE_HEAD - nod))
        if yaw:
            turn("head", rot_z(yaw))
        if roll:
            turn("head", rot_y(roll))
        tail(GRAZE_TAIL)
        legs("Graze", fore=(0.0, -GRAZE_REACH * H, 0.0), splay=GRAZE_SPLAY * H, record=record)
        return gaps()["head"]

    tips = {}

    def bite_tip(yaw):
        if yaw not in tips:
            tips[yaw] = bisect(lambda t: graze_body(t, yaw=yaw) > GRAZE_CLEAR, 0.0, 45.0)
        return tips[yaw]

    def graze(kind):
        def pose():
            if kind == "bite":
                t = bite_tip(0.0)
                graze_body(t, record=True)
            elif kind == "pull":
                t = bite_tip(0.0) - GRAZE_PULL_UP
                graze_body(t, back=GRAZE_PULL, yaw=GRAZE_PULL_TURN, roll=GRAZE_PULL_TURN, record=True)
            elif kind == "bite2":
                t = bite_tip(GRAZE_BITE2)
                graze_body(t, yaw=GRAZE_BITE2, record=True)
            else:
                t = bite_tip(0.0) - GRAZE_CHEW[0]
                graze_body(t, nod=GRAZE_CHEW[1], record=True)
            diag("graze pose:", kind, "tipped forward", round(t, 2), "deg; gaps", gaps())
            return snapshot()
        return pose

    # Lie: the body down on its belly and set back, each foreleg's elbow on the floor just behind its shoulder and the
    # forearm along the floor ahead of it, the hind legs folded with the shank flat and the hock out to the side, the
    # head low over the forepaws and the tail curled round the right flank. A leg whose skin would pass under the floor
    # is lifted until it rests on it, a folded hind leg that stays clear of it is lowered until it rests on it (both per
    # body), and the chest bone tips down until the chin is low or the chest meets the floor.
    def lie_legs(lift_fore, lift_hind):
        worst = 0.0
        for leg in ("LF", "RF"):
            a, b, c, _ = LEG_CHAINS[leg]
            side = 1.0 if leg == "LF" else -1.0
            sh = wpt(a)
            l1 = (REST_P[b] - REST_P[a]).length
            l2 = (REST_P[c] - REST_P[b]).length
            elbow_z = floor + LIE_ELBOW + lift_fore
            y_el = sh.y + math.sqrt(max(l1 * l1 - (sh.z - elbow_z) ** 2, 0.0))
            at = (REST_P[c].x + side * LIE_FORE_OUT * H, y_el - l2, elbow_z)
            worst = max(worst, plant(leg, at=at, paw=rot_x(LIE_PASTERN)))
        for leg in ("LB", "RB"):
            a = LEG_CHAINS[leg][0]
            side = 1.0 if leg == "LB" else -1.0
            hip = wpt(a)
            at = (hip.x + side * LIE_HOCK[0] * H, hip.y + LIE_HOCK[1] * H, floor + LIE_HOCK_Z + lift_hind)
            worst = max(worst, plant(leg, at=at, paw=rot_x(LIE_SHANK)))
        return worst

    def lie_body(chest, lift=LIE_TAIL[0]):
        rest_pose(arm)
        shift("Hips", Vector((0, LIE_BACK * H, -(belly - floor - LIE_BELLY))))
        turn("chest", rot_x(chest))
        turn("head", rot_x(LIE_HEAD))
        tail((lift,) + LIE_TAIL[1:], LIE_WRAP)
        lift_fore = lift_hind = 0.0
        for _ in range(3):
            worst = lie_legs(lift_fore, lift_hind)
            g = gaps()
            if g["fore"] >= -1e-3 and g["hind"] >= -1e-3:
                break
            lift_fore += max(0.0, 1e-3 - g["fore"])
            lift_hind += max(0.0, 1e-3 - g["hind"])
        if g["hind"] > 2e-3:  # a folded hind leg clear of the floor (the bright wolf's): the hock lowered to rest it
            drop = bisect(lambda d: (lie_legs(lift_fore, lift_hind - d), gaps()["hind"])[1] >= 1e-3,
                          0.0, LIE_HOCK_Z + lift_hind)
            worst = lie_legs(lift_fore, lift_hind - drop)
        return worst

    def lie():
        def low_enough(c):
            lie_body(c)
            g = gaps()
            return g["head"] > LIE_CHIN and g["trunk"] > 0.0
        chest = bisect(low_enough, 0.0, 60.0)
        # the tail lifted a little more where its curl would pass under the floor
        lift = 90.0 - bisect(lambda x: (lie_body(chest, 90.0 - x), gaps()["tail"])[1] >= 0.0, 0.0, 90.0 - LIE_TAIL[0])
        worst = lie_body(chest, lift)
        if worst > 1e-4:
            short.append("Lie %.3f" % worst)
        diag("lie pose: chest bone down", round(chest, 2), "deg; tail lifted", round(lift, 2), "deg; gaps", gaps())
        return snapshot()

    acts = [
        hunt_action("Alert", ALERT_SECONDS, [alert(), alert(look=ALERT_LOOK), alert(sniff=ALERT_SNIFF),
                                            alert(look=-ALERT_LOOK)]),
        hunt_action("Graze", GRAZE_SECONDS, [graze("bite"), graze("pull"), graze("bite2"), graze("chew")]),
        hunt_action("Lie", LIE_SECONDS, [lie]),
    ]
    rest_pose(arm)
    diag("hunt states", [(a.name, tuple(a.frame_range)) for a in acts], "at", FPS, "fps; legs that fell short (m)",
         short or "none")
    return acts


def export_glb(acts, path, images=True):
    """each action on an NLA track, one clip each, the body and its skin, one GLB"""
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = None
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    for act in acts:
        tr = ad.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, int(act.frame_range[0]), act)
        if hasattr(st, "action_slot") and st.action_slot is None and len(getattr(act, "slots", [])):
            st.action_slot = act.slots[0]
    rest_pose(arm)
    rna = bpy.ops.export_scene.gltf.get_rna_type().properties
    props = rna.keys()
    want = dict(filepath=path, export_format="GLB", use_selection=True, export_animations=True,
                export_animation_mode="ACTIONS", export_extras=True, export_skins=True, export_image_format="JPEG",
                export_jpeg_quality=90, export_image_quality=90, export_yup=True, export_apply=False,
                export_force_sampling=True, export_optimize_animation_size=True, export_anim_slide_to_zero=True)
    if not images and "NONE" in [e.identifier for e in rna["export_image_format"].enum_items]:
        want["export_image_format"] = "NONE"
    kw = {k: v for k, v in want.items() if k in props}
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.ops.export_scene.gltf(**kw)
    return sorted(set(want) - set(kw))


# ------------------------------------------------------------------ --states: splice new clips into a finished glb
def read_glb(path):
    with open(path, "rb") as f:
        b = f.read()
    magic, _, _ = struct.unpack_from("<III", b, 0)
    assert magic == 0x46546C67, "not a GLB: " + path
    jl, _ = struct.unpack_from("<II", b, 12)
    bl, _ = struct.unpack_from("<II", b, 20 + jl)
    return json.loads(b[20:20 + jl].decode("utf-8")), bytearray(b[28 + jl:28 + jl + bl])


def write_glb(path, j, bin_):
    js = json.dumps(j, separators=(",", ":")).encode("utf-8")
    js += b" " * (-len(js) % 4)
    bin_ = bytes(bin_) + b"\0" * (-len(bin_) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(bin_)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)


def splice(src, made, out, names):
    """write `out`: the glb `src` with the clips `names` taken from the glb `made` (nodes matched by name); clips of
    those names already in `src` are dropped first (their accessors and views are the file's tail, as this writes
    them). Everything else in `src` keeps its bytes."""
    j, b = read_glb(src)
    nj, nb = read_glb(made)
    old = [a for a in j.get("animations", []) if a["name"] in names]
    if old:
        drop = {s[k] for a in old for s in a["samplers"] for k in ("input", "output")}
        kept = {s[k] for a in j["animations"] if a["name"] not in names
                for s in a["samplers"] for k in ("input", "output")}
        first = min(drop)
        assert not drop & kept and drop == set(range(first, len(j["accessors"]))), \
            "the clips to replace are not the tail"
        views = {j["accessors"][i]["bufferView"] for i in drop}
        fv = min(views)
        assert views == set(range(fv, len(j["bufferViews"]))), "the views to replace are not the tail"
        cut = j["bufferViews"][fv].get("byteOffset", 0)
        del j["accessors"][first:]
        del j["bufferViews"][fv:]
        del b[cut:]
        j["animations"] = [a for a in j["animations"] if a["name"] not in names]
    node = {n["name"]: i for i, n in enumerate(j["nodes"])}
    taken = {}

    def take(i):
        if i not in taken:
            acc = dict(nj["accessors"][i])
            view = nj["bufferViews"][acc["bufferView"]]
            o = view.get("byteOffset", 0)
            b.extend(b"\0" * (-len(b) % 4))
            j["bufferViews"].append({"buffer": 0, "byteLength": view["byteLength"], "byteOffset": len(b)})
            b.extend(nb[o:o + view["byteLength"]])
            acc["bufferView"] = len(j["bufferViews"]) - 1
            j["accessors"].append(acc)
            taken[i] = len(j["accessors"]) - 1
        return taken[i]

    for name in names:
        a = next(x for x in nj["animations"] if x["name"] == name)
        chans = [{"sampler": c["sampler"], "target": {"node": node[nj["nodes"][c["target"]["node"]]["name"]],
                                                       "path": c["target"]["path"]}} for c in a["channels"]]
        samps = [dict(s, input=take(s["input"]), output=take(s["output"])) for s in a["samplers"]]
        new = {"channels": chans, "name": name, "samplers": samps}
        if "extras" in a:
            new["extras"] = a["extras"]
        j["animations"].append(new)
    j["buffers"][0]["byteLength"] = len(b) + (-len(b) % 4)
    write_glb(out, j, b)
    return j


if STATES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    objs = import_glb(SRC)
    arm = [o for o in objs if o.type == "ARMATURE"][0]
    mesh = [o for o in objs if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)][0]
    kept = sorted(a.name for a in bpy.data.actions)
    for a in list(bpy.data.actions):  # the file's own clips stay in the file as they are; only the new ones are made
        bpy.data.actions.remove(a)
    rest_pose(arm)
    amw = arm.matrix_world
    RA = amw.to_quaternion()
    co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
    H = float(co[:, 2].max() - co[:, 2].min())
    diag("states: source", SRC.rsplit("/", 1)[-1], "clips kept", kept, "height", round(H, 3), "m")
    made = hunt_states()
    tmp = OUT + ".states-tmp.glb"
    export_glb(made, tmp, images=False)
    j = splice(SRC, tmp, OUT, [a.name for a in made])
    os.remove(tmp)
    diag("wrote", OUT, "clips", [a["name"] for a in j["animations"]])
    sys.exit(0)


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
facing = -math.pi / 2 - math.atan2(fwd.y, fwd.x)  # not `turn`: that is the helper the hunt's states use
rot = Matrix.Rotation(facing, 4, "Z")
for o in objs:
    if o.parent is None:
        o.matrix_world = rot @ o.matrix_world
bpy.context.view_layer.update()
hips = world_head(arm, "Hips")
fwd = world_head(arm, "head") - hips
diag("turned about Z by", round(math.degrees(facing), 1), "deg; head - hips now", tuple(round(v, 3) for v in fwd))

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

# ------------------------------------------------------------------ world axes to pose space (the helpers are above)
RA = amw.to_quaternion()
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

# ------------------------------------------------------------------ the hunt's states, keyed from the bind pose
alert, graze, lie = hunt_states()

# ------------------------------------------------------------------ export: each action on a track, one clip each
skipped = export_glb((idle, walk, run, alert, graze, lie), OUT)
diag("wrote", OUT, "options skipped", skipped)
